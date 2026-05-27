import json
import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(__file__))

XLSM_PATH = r"C:\Users\Morri\OneDrive\Documents\Library Analytics App-MoesPC\FY2026 Circulation Statistics.xlsm"
BUCKET = "test-bucket"
KEY = "uploads/circulation/FY2026 Circulation Statistics.xlsm"

with open(XLSM_PATH, "rb") as f:
    file_bytes = f.read()

written_json = {}

def fake_get_object(Bucket, Key):
    return {"Body": MagicMock(read=lambda: file_bytes)}

def fake_put_object(**kwargs):
    written_json["bucket"] = kwargs["Bucket"]
    written_json["key"] = kwargs["Key"]
    written_json["body"] = json.loads(kwargs["Body"])
    print(f"[S3 WRITE] s3://{kwargs['Bucket']}/{kwargs['Key']}")

mock_s3 = MagicMock()
mock_s3.get_object.side_effect = fake_get_object
mock_s3.put_object.side_effect = fake_put_object

s3_event = {
    "Records": [{
        "eventSource": "aws:s3",
        "s3": {
            "bucket": {"name": BUCKET},
            "object": {"key": KEY}
        }
    }]
}

with patch("lambda_function.s3", mock_s3), \
     patch.dict(os.environ, {"PROCESSED_BUCKET": BUCKET, "PROCESSED_KEY": "processed/circulation_data.json"}):
    from lambda_function import lambda_handler
    result = lambda_handler(s3_event, None)

print("\n=== S3 Trigger Result ===")
print(json.dumps(result, indent=2))

if written_json:
    body = written_json["body"]
    print(f"\nData points written: {body['totalRecords']}")
    print(f"Branches: {body['branches'][:5]}")
    print(f"Sample point: {body['data'][0]}")

# Now simulate the API call reading what was written
print("\n=== API Handler Simulation ===")
api_event = {
    "httpMethod": "GET",
    "queryStringParameters": None,
    "requestContext": {"httpMethod": "GET"}
}

def fake_get_processed(Bucket, Key):
    body_bytes = json.dumps(written_json["body"]).encode()
    return {"Body": MagicMock(read=lambda: body_bytes)}

mock_s3.get_object.side_effect = fake_get_processed

with patch("lambda_function.s3", mock_s3), \
     patch.dict(os.environ, {"PROCESSED_BUCKET": BUCKET, "PROCESSED_KEY": "processed/circulation_data.json"}):
    api_result = lambda_handler(api_event, None)

print(f"Status: {api_result['statusCode']}")
api_body = json.loads(api_result["body"])
print(f"Success: {api_body['success']}")
if api_body["data"]:
    print(f"Data points returned: {api_body['data']['totalRecords']}")
