"""
Library Analytics – Circulation Statistics Lambda

Parses FY circulation .xlsm files uploaded to S3 and serves processed
graph data to the frontend dashboard via API Gateway.

Trigger:  S3 PUT on uploads/circulation/*.xlsm
API:      GET /circulation?category={name}

The response follows the existing frontend contract:

    APIResponse<CirculationData>
    ├── success: bool
    ├── data
    │   ├── data: CirculationDataPoint[]   ← { category, month, year, circulation }
    │   ├── lastUpdated: ISO timestamp
    │   └── totalRecords: int
    └── timestamp: ISO timestamp

Five graph categories are produced from the Excel totals row:
    Juvenile Fiction  →  TOTAL JUVENILE  (col I)
    Young Adult       →  TOTAL YA        (col M)
    Adult             →  TOTAL ADULT     (col E)
    Non-Print         →  TOTAL NONPRINT  (col V)
    Total Circulation →  GRAND TOTAL     (col X)
"""

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from io import BytesIO
from typing import Any

import boto3
import openpyxl

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

# ── Constants ────────────────────────────────────────────────────────────────

FY_MONTHS = [
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
]

MONTH_ABBR = {
    "JULY": "Jul", "AUGUST": "Aug", "SEPTEMBER": "Sep",
    "OCTOBER": "Oct", "NOVEMBER": "Nov", "DECEMBER": "Dec",
    "JANUARY": "Jan", "FEBRUARY": "Feb", "MARCH": "Mar",
    "APRIL": "Apr", "MAY": "May", "JUNE": "Jun",
}

# 0-based column indices in the Total row (from openpyxl values_only tuple)
COL_TOTAL_ADULT     = 4
COL_TOTAL_JUVENILE  = 8
COL_TOTAL_YA        = 12
COL_TOTAL_NONPRINT  = 21
COL_GRAND_TOTAL     = 23

# Maps frontend graph title → column index in Total row
CATEGORY_MAP = {
    "Juvenile Fiction":  COL_TOTAL_JUVENILE,
    "Young Adult":       COL_TOTAL_YA,
    "Adult":             COL_TOTAL_ADULT,
    "Non-Print":         COL_TOTAL_NONPRINT,
    "Total Circulation": COL_GRAND_TOTAL,
}

PROCESSED_KEY = "processed/circulation_data.json"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _env(name: str, fallback: str = "") -> str:
    """Read an env var at call time so tests can patch os.environ."""
    return os.environ.get(name, fallback)


def _safe_int(val: Any) -> int:
    if val is None:
        return 0
    if isinstance(val, str):
        val = val.strip()
        if val == "":
            return 0
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return 0


# ── Excel Parsing ────────────────────────────────────────────────────────────

def _find_total_row(sheet) -> tuple | None:
    for row in sheet.iter_rows(values_only=True):
        if row and row[0] and str(row[0]).strip() == "Total":
            return row
    return None


def _detect_year(sheet, month_name: str) -> int:
    """Extract the calendar year from the sheet header (e.g. 'JULY 2025')."""
    for row in sheet.iter_rows(min_row=1, max_row=5, values_only=True):
        for cell in row:
            if cell and isinstance(cell, str) and month_name in cell.upper():
                for token in cell.split():
                    if token.isdigit() and len(token) == 4:
                        return int(token)
    # Fallback: infer from fiscal year convention (Jul-Dec = first year)
    return datetime.now(timezone.utc).year


def parse_workbook(file_bytes: bytes) -> list[dict]:
    """
    Parse the .xlsm and return a list of month records in fiscal-year order.
    Each record: { month_name, display_month, year, totals: {category: int} }
    Only months with a non-zero grand total are included.
    """
    wb = openpyxl.load_workbook(
        BytesIO(file_bytes), read_only=True, data_only=True, keep_links=False,
    )

    result = []
    for month_name in FY_MONTHS:
        if month_name not in wb.sheetnames:
            continue

        sheet = wb[month_name]
        total_row = _find_total_row(sheet)
        if total_row is None:
            logger.warning("No Total row in sheet %s", month_name)
            continue

        grand_total = _safe_int(total_row[COL_GRAND_TOTAL])
        if grand_total == 0:
            continue

        year = _detect_year(sheet, month_name)
        abbr = MONTH_ABBR[month_name]
        display = f"{abbr} {year}"  # "Jul 2025"

        totals = {}
        for category, col_idx in CATEGORY_MAP.items():
            totals[category] = _safe_int(total_row[col_idx])

        result.append({
            "month_name": month_name,
            "display_month": display,
            "year": year,
            "totals": totals,
        })

    wb.close()

    # Keep only the most recent 12 months
    return result[-12:]


# ── Payload Builder ──────────────────────────────────────────────────────────

def build_circulation_data(months: list[dict]) -> dict:
    """
    Convert parsed month records into the CirculationData shape expected by
    the frontend:

        {
          data: CirculationDataPoint[],
          lastUpdated: str,
          totalRecords: int
        }

    One CirculationDataPoint per (category × month) combination.
    """
    now = datetime.now(timezone.utc).isoformat()
    points: list[dict] = []

    for month_rec in months:
        for category, value in month_rec["totals"].items():
            points.append({
                "category":    category,
                "month":       month_rec["display_month"],
                "year":        month_rec["year"],
                "circulation": value,
            })

    return {
        "data": points,
        "lastUpdated": now,
        "totalRecords": len(points),
    }


# ── S3 I/O ───────────────────────────────────────────────────────────────────

def read_s3(bucket: str, key: str) -> bytes:
    return s3.get_object(Bucket=bucket, Key=key)["Body"].read()


def write_json_s3(bucket: str, key: str, payload: dict) -> None:
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(payload, indent=2),
        ContentType="application/json",
    )
    logger.info("Wrote s3://%s/%s", bucket, key)


def read_json_s3(bucket: str, key: str) -> dict:
    return json.loads(s3.get_object(Bucket=bucket, Key=key)["Body"].read())


# ── API response helpers ─────────────────────────────────────────────────────

def _api_ok(data: Any) -> dict:
    return _api_response(200, {
        "success": True,
        "data": data,
        "error": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "requestId": f"req_{uuid.uuid4().hex[:12]}",
    })


def _api_err(status: int, code: str, message: str) -> dict:
    return _api_response(status, {
        "success": False,
        "data": None,
        "error": {"code": code, "message": message},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "requestId": f"req_{uuid.uuid4().hex[:12]}",
    })


def _api_response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        "body": json.dumps(body),
    }


# ── Handlers ─────────────────────────────────────────────────────────────────

def handle_s3_event(event: dict) -> dict:
    """
    S3 PUT trigger.  Downloads the .xlsm, parses it, writes processed JSON.
    Repeated uploads overwrite the same key — idempotent by design.
    """
    record = event["Records"][0]["s3"]
    source_bucket = record["bucket"]["name"]
    source_key = record["object"]["key"]

    logger.info("Processing s3://%s/%s", source_bucket, source_key)

    file_bytes = read_s3(source_bucket, source_key)
    months = parse_workbook(file_bytes)

    if not months:
        logger.error("No valid month data found")
        return {"statusCode": 400, "body": "No circulation data in workbook"}

    payload = build_circulation_data(months)

    dest_bucket = _env("PROCESSED_BUCKET", source_bucket)
    dest_key = _env("PROCESSED_KEY", PROCESSED_KEY)
    write_json_s3(dest_bucket, dest_key, payload)

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Circulation data processed",
            "totalRecords": payload["totalRecords"],
        }),
    }


def handle_api_request(event: dict) -> dict:
    """
    GET /circulation?category={name}

    Returns CirculationDataPoint[] for the requested category,
    or all categories if no filter is provided.
    """
    bucket = _env("PROCESSED_BUCKET")
    if not bucket:
        return _api_err(500, "CONFIG_ERROR", "PROCESSED_BUCKET not set")

    key = _env("PROCESSED_KEY", PROCESSED_KEY)

    try:
        payload = read_json_s3(bucket, key)
    except s3.exceptions.NoSuchKey:
        return _api_err(404, "NOT_FOUND", "No data available. Upload a circulation file first.")
    except Exception as exc:
        logger.exception("Error reading processed data")
        return _api_err(500, "INTERNAL_ERROR", str(exc))

    # Optional category filter
    qs = event.get("queryStringParameters") or {}
    category_filter = qs.get("category")

    if category_filter:
        payload["data"] = [
            pt for pt in payload["data"]
            if pt["category"] == category_filter
        ]
        payload["totalRecords"] = len(payload["data"])

    return _api_ok(payload)


# ── Entrypoint ───────────────────────────────────────────────────────────────

def lambda_handler(event: dict, context: Any) -> dict:
    """
    Routes based on event source:
      • S3 event  → parse workbook, write JSON
      • API GW    → return processed JSON (with optional ?category= filter)
    """
    logger.info("Event: %s", json.dumps(event, default=str)[:500])

    if "Records" in event and event["Records"][0].get("eventSource") == "aws:s3":
        return handle_s3_event(event)

    if "httpMethod" in event or "requestContext" in event:
        return handle_api_request(event)

    return {"statusCode": 400, "body": "Unrecognized event source"}
