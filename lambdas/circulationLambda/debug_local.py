import json
import shutil
import sys
import os
import boto3
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(__file__))

XLSM_PATH = r"C:\Users\Morri\OneDrive\Documents\Library Analytics App-MoesPC\FY2026 Circulation Statistics.xlsm"
XLSM_COPY = r"C:\Users\Morri\AppData\Local\Temp\circ_debug.xlsm"
S3_KEY    = "uploads/circulation/FY2026 Circulation Statistics.xlsm"

# OneDrive locks the file while open in Excel — copy first
shutil.copy2(XLSM_PATH, XLSM_COPY)
with open(XLSM_COPY, "rb") as f:
    file_bytes = f.read()
os.remove(XLSM_COPY)

# ── Step 1: parse locally ────────────────────────────────────────────────────

from lambda_function import parse_workbook, build_circulation_data
from datetime import datetime, timezone

months, branches = parse_workbook(file_bytes)

print(f"Months parsed : {len(months)}")
print(f"Branches found: {len(branches)}")

# Verify a branch-level data point
sample = build_circulation_data(months, "Imaginon")
imaginon_adult = next(
    (d for d in sample["data"] if d["month"] == "Jul 2025" and d["category"] == "Adult"), None
)
print(f"Imaginon Jul Adult: {imaginon_adult}")

# ── Step 2: push raw months data to S3 ──────────────────────────────────────
# Stores months + all branch data so the API can filter by any branch at request time

BUCKET        = os.environ.get("CIRCULATION_BUCKET", "")
PROCESSED_KEY = "processed/circulation_data.json"

stored = build_circulation_data(months, "System")

if not BUCKET:
    print("\n[SKIP] Set CIRCULATION_BUCKET env var to push to S3.")
    print("  Example:  $env:CIRCULATION_BUCKET='library-analytics-circulation-dev-688567267460'")
    print("            py debug_local.py")
else:
    real_s3 = boto3.client("s3", region_name="us-east-1")
    real_s3.put_object(
        Bucket=BUCKET,
        Key=PROCESSED_KEY,
        Body=json.dumps(stored).encode(),
        ContentType="application/json",
    )
    print(f"\n[S3 WRITE] s3://{BUCKET}/{PROCESSED_KEY}")
    print("Done — refresh the frontend to see updated data.")
