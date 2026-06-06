"""
Local debugging script for programmingDataParser Lambda.

Simulates S3 PUT events and calls the lambda handler with local files so you
can step through PDF/xlsx parsing and DynamoDB writes without deploying.

Set breakpoints in programming_data_parser_lambda.py, then run this script.

AWS credentials are loaded from ~/.aws/credentials by boto3 — DynamoDB writes
go to the real dev tables.  S3 reads are intercepted and served from local files.

To use different test files, update the paths in TEST_FILES below.
"""

import json
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(__file__))

os.environ.setdefault("DYNAMODB_TABLE",          "library-analytics-programming-data-dev")
os.environ.setdefault("PROGRAM_SESSIONS_TABLE",  "library-analytics-program-sessions-dev")
os.environ.setdefault("PROCESSED_BUCKET",        "library-analytics-circulation-dev")
os.environ.setdefault("AWS_REGION",              "us-east-1")

from programming_data_parser_lambda import lambda_handler

# ── Local test files ──────────────────────────────────────────────────────────
# Update these paths to point at real files on your machine.

TEST_FILES = {
    "in_house_pdf":  r"C:\Users\Morri\OneDrive\Documents\Library Analytics App-MoesPC\Spangler_In-House_Programs_April_2026.pdf",
    "outreach_pdf":  r"C:\Users\Morri\OneDrive\Documents\Library Analytics App-MoesPC\Spangler_Outreach_Programs_April_2026.pdf",
    # "xlsx":        r"C:\path\to\SPA Monthly Stats FY26.xlsx",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

class MockLambdaContext:
    function_name = "programmingDataParser"
    function_version = "$LATEST"
    invoked_function_arn = "arn:aws:lambda:us-east-1:000000000000:function:programmingDataParser"
    memory_limit_in_mb = 512
    aws_request_id = "local-debug-request-id"
    log_group_name = "/aws/lambda/programmingDataParser"
    log_stream_name = "local-debug-stream"

    def get_remaining_time_in_millis(self):
        return 60000


def _s3_event(bucket: str, key: str) -> dict:
    return {
        "Records": [{
            "s3": {
                "bucket": {"name": bucket},
                "object": {"key": key},
            }
        }]
    }


def _mock_s3_for(local_path: str):
    """Return a context manager that patches s3.get_object to serve a local file."""
    import programming_data_parser_lambda as mod

    mock_s3 = MagicMock(wraps=mod.s3)

    def fake_get_object(Bucket, Key):
        with open(local_path, "rb") as f:
            data = f.read()
        body = MagicMock()
        body.read.return_value = data
        return {"Body": body}

    mock_s3.get_object.side_effect = fake_get_object
    return patch.object(mod, "s3", mock_s3)


def _run(label: str, local_path: str, s3_key: str) -> None:
    print(f"\n{'='*70}")
    print(f"TEST: {label}")
    print(f"  file : {local_path}")
    print(f"  key  : {s3_key}")
    print("="*70)

    if not os.path.exists(local_path):
        print(f"  [SKIP] file not found — update TEST_FILES path")
        return

    event   = _s3_event("library-analytics-circulation-dev", s3_key)
    context = MockLambdaContext()

    with _mock_s3_for(local_path):
        result = lambda_handler(event, context)

    body = json.loads(result.get("body", "{}"))
    print(json.dumps({"statusCode": result["statusCode"], "body": body}, indent=2, default=str))


# ── Test cases ────────────────────────────────────────────────────────────────

def test_in_house_pdf():
    _run(
        "In-House PDF upload (Spangler, April 2026)",
        TEST_FILES["in_house_pdf"],
        "uploads/programming/Spangler_In-House_Programs_April_2026.pdf",
    )


def test_outreach_pdf():
    _run(
        "Outreach PDF upload (Spangler, April 2026)",
        TEST_FILES["outreach_pdf"],
        "uploads/programming/Spangler_Outreach_Programs_April_2026.pdf",
    )


def test_unknown_branch():
    """Verify graceful 400 when filename doesn't contain a known branch name."""
    print(f"\n{'='*70}")
    print("TEST: Unknown branch filename → expect 400")
    print("="*70)

    # Use the in-house PDF but pretend it was uploaded with a bad filename
    path = TEST_FILES["in_house_pdf"]
    if not os.path.exists(path):
        print("  [SKIP] file not found")
        return

    event   = _s3_event("library-analytics-circulation-dev", "uploads/programming/Unknown_Programs_April_2026.pdf")
    context = MockLambdaContext()

    with _mock_s3_for(path):
        result = lambda_handler(event, context)

    print(f"  statusCode: {result['statusCode']}  (expected 400)")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\nprogrammingDataParser — Local Debug Session")
    print("Set breakpoints in programming_data_parser_lambda.py to inspect state\n")

    try:
        test_in_house_pdf()
        test_outreach_pdf()
        test_unknown_branch()

        print(f"\n{'='*70}")
        print("All tests completed")
        print("="*70)
    except Exception as exc:
        print(f"\nError: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
