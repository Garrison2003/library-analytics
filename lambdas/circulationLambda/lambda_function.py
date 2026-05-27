"""
Library Analytics – Circulation Statistics Lambda (with Branch Support)

Parses FY circulation .xlsm files uploaded to S3 and serves processed
graph data to the frontend dashboard via API Gateway.

NEW: Extracts and returns branch-level data. API supports filtering by branch.

Trigger:  S3 PUT on uploads/circulation/*.xlsm
API:      GET /circulation?category={name}&branch={name}

Response includes:
  - branches: list of all branches with data
  - data: CirculationDataPoint[] filtered by optional category/branch
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
from botocore.exceptions import ClientError

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

# 0-based column indices in data rows
COL_TOTAL_ADULT     = 4
COL_TOTAL_JUVENILE  = 8
COL_TOTAL_YA        = 12
COL_TOTAL_NONPRINT  = 21
COL_GRAND_TOTAL     = 23

CATEGORY_MAP = {
    "Juvenile Fiction":  COL_TOTAL_JUVENILE,
    "Young Adult":       COL_TOTAL_YA,
    "Adult":             COL_TOTAL_ADULT,
    "Non-Print":         COL_TOTAL_NONPRINT,
    "Total Circulation": COL_GRAND_TOTAL,
}

PROCESSED_KEY = "processed/circulation_data.json"

# Branch names to skip (system totals, headers, etc.)
SKIP_DEPARTMENTS = {
    "Department", "Charlotte Mecklenburg Library", "CIRCULATION", "Page 1",
    "Total", "TOTAL ADULT", "TOTAL JUVENILE", "TOTAL YOUNG ADULT", 
    "TOTAL NONPRINT", "TOTAL BOOKS", "TOTAL PRINT & NONPRINT",
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _env(name: str, fallback: str = "") -> str:
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


def _is_skip_department(name: str) -> bool:
    """Check if a department name should be skipped (system total, header, etc.)"""
    if not name or not isinstance(name, str):
        return True
    name_upper = name.upper().strip()
    return any(skip.upper() in name_upper for skip in SKIP_DEPARTMENTS)


# ── Excel Parsing ────────────────────────────────────────────────────────────

def _find_header_row(sheet) -> int:
    """Find the row containing 'Department' header."""
    for i, row in enumerate(sheet.iter_rows(values_only=True)):
        if row and row[0] and str(row[0]).strip() == "Department":
            return i
    return -1


def _extract_departments(sheet) -> list[str]:
    """Extract all unique branch/department names from a sheet."""
    header_idx = _find_header_row(sheet)
    if header_idx < 0:
        return []

    departments = set()
    for i, row in enumerate(sheet.iter_rows(values_only=True)):
        if i <= header_idx:
            continue
        if row and row[0]:
            dept_name = str(row[0]).strip()
            if not _is_skip_department(dept_name):
                departments.add(dept_name)

    return sorted(list(departments))


def _find_totals_row(sheet) -> tuple | None:
    """Find the system-wide TOTAL row (for backward compatibility)."""
    for row in sheet.iter_rows(values_only=True):
        if row and row[0] and str(row[0]).strip() == "Total":
            return row
    return None


def _extract_branch_data(sheet, branch_name: str) -> dict | None:
    """Extract data for a specific branch from a sheet."""
    header_idx = _find_header_row(sheet)
    if header_idx < 0:
        return None

    for row in sheet.iter_rows(values_only=True):
        if row and row[0] and str(row[0]).strip() == branch_name:
            return {
                "adult":     _safe_int(row[COL_TOTAL_ADULT]),
                "juvenile":  _safe_int(row[COL_TOTAL_JUVENILE]),
                "ya":        _safe_int(row[COL_TOTAL_YA]),
                "nonprint":  _safe_int(row[COL_TOTAL_NONPRINT]),
                "grand_total": _safe_int(row[COL_GRAND_TOTAL]),
            }
    return None


def parse_workbook(file_bytes: bytes) -> tuple[list[dict], list[str]]:
    """
    Parse the .xlsm and return:
      1. List of month records in fiscal-year order with branch data
      2. List of unique branch names across all months

    Each month record: {
      month_name, display_month, year,
      system_totals: {category: int},
      branches: {branch_name: {category: int}}
    }
    """
    wb = openpyxl.load_workbook(
        BytesIO(file_bytes), read_only=True, data_only=True, keep_links=False,
    )

    result = []
    all_branches = set()

    for month_name in FY_MONTHS:
        if month_name not in wb.sheetnames:
            continue

        sheet = wb[month_name]
        total_row = _find_totals_row(sheet)
        if total_row is None:
            continue

        grand_total = _safe_int(total_row[COL_GRAND_TOTAL])
        if grand_total == 0:
            continue

        # Extract system totals
        year = _detect_year(sheet, month_name)
        abbr = MONTH_ABBR[month_name]
        display = f"{abbr} {year}"

        system_totals = {}
        for category, col_idx in CATEGORY_MAP.items():
            system_totals[category] = _safe_int(total_row[col_idx])

        # Extract branch data
        branches = {}
        for dept_name in _extract_departments(sheet):
            dept_data = _extract_branch_data(sheet, dept_name)
            if dept_data and dept_data["grand_total"] > 0:
                branches[dept_name] = {
                    "Juvenile Fiction": dept_data["juvenile"],
                    "Young Adult":      dept_data["ya"],
                    "Adult":            dept_data["adult"],
                    "Non-Print":        dept_data["nonprint"],
                    "Total Circulation": dept_data["grand_total"],
                }
                all_branches.add(dept_name)

        result.append({
            "month_name": month_name,
            "display_month": display,
            "year": year,
            "system_totals": system_totals,
            "branches": branches,
        })

    wb.close()
    return result[-12:], sorted(list(all_branches))


def _detect_year(sheet, month_name: str) -> int:
    """Extract the calendar year from the sheet header."""
    for row in sheet.iter_rows(min_row=1, max_row=5, values_only=True):
        for cell in row:
            if cell and isinstance(cell, str) and month_name in cell.upper():
                for token in cell.split():
                    if token.isdigit() and len(token) == 4:
                        return int(token)
    return datetime.now(timezone.utc).year


# ── Payload Builder ──────────────────────────────────────────────────────────

def build_circulation_data(months: list[dict], branch_filter: str = "") -> dict:
    """
    Convert parsed month records into CirculationData shape.
    
    If branch_filter is empty or "System", use system totals.
    If branch_filter is a branch name, use that branch's data.
    """
    now = datetime.now(timezone.utc).isoformat()
    points: list[dict] = []
    all_branches = set()

    # Collect all unique branches
    for month_rec in months:
        all_branches.update(month_rec["branches"].keys())

    # Extract data based on filter
    for month_rec in months:
        if not branch_filter or branch_filter == "System":
            # Use system totals
            for category, value in month_rec["system_totals"].items():
                points.append({
                    "category": category,
                    "month": month_rec["display_month"],
                    "year": month_rec["year"],
                    "circulation": value,
                })
        elif branch_filter in month_rec["branches"]:
            # Use branch data
            for category, value in month_rec["branches"][branch_filter].items():
                points.append({
                    "category": category,
                    "month": month_rec["display_month"],
                    "year": month_rec["year"],
                    "circulation": value,
                })

    return {
        "data": points,
        "branches": sorted(list(all_branches)),
        "selectedBranch": branch_filter or "System",
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
    """S3 PUT trigger. Downloads .xlsm, parses it, writes processed JSON."""
    record = event["Records"][0]["s3"]
    source_bucket = record["bucket"]["name"]
    source_key = record["object"]["key"]

    logger.info("Processing s3://%s/%s", source_bucket, source_key)

    file_bytes = read_s3(source_bucket, source_key)
    months, branches = parse_workbook(file_bytes)

    if not months:
        logger.error("No valid month data found")
        return {"statusCode": 400, "body": "No circulation data in workbook"}

    # Build with system totals (default view)
    payload = build_circulation_data(months, branch_filter="System")

    dest_bucket = _env("PROCESSED_BUCKET", source_bucket)
    dest_key = _env("PROCESSED_KEY", PROCESSED_KEY)
    write_json_s3(dest_bucket, dest_key, payload)

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Circulation data processed",
            "totalRecords": payload["totalRecords"],
            "branchesFound": len(branches),
        }),
    }


def handle_api_request(event: dict) -> dict:
    """GET /circulation?category={name}&branch={name}"""
    bucket = _env("PROCESSED_BUCKET")
    if not bucket:
        return _api_err(500, "CONFIG_ERROR", "PROCESSED_BUCKET not set")

    key = _env("PROCESSED_KEY", PROCESSED_KEY)

    try:
        payload = read_json_s3(bucket, key)
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        if code in ("NoSuchKey", "404"):
            return _api_err(404, "NOT_FOUND", "No data available. Upload a file first.")
        logger.exception("S3 error reading processed data")
        return _api_err(500, "INTERNAL_ERROR", f"Storage error: {code}")
    except Exception as exc:
        logger.exception("Error reading processed data")
        return _api_err(500, "INTERNAL_ERROR", str(exc))

    # Query parameters
    qs = event.get("queryStringParameters") or {}
    category_filter = qs.get("category")
    branch_filter = qs.get("branch", "System")

    # Filter by category if provided
    if category_filter:
        payload["data"] = [
            pt for pt in payload["data"]
            if pt["category"] == category_filter
        ]

    # Include branch info
    payload["selectedBranch"] = branch_filter
    payload["totalRecords"] = len(payload["data"])

    return _api_ok(payload)


# ── Entrypoint ───────────────────────────────────────────────────────────────

def lambda_handler(event: dict, context: Any) -> dict:
    """Routes based on event source."""
    logger.info("Event: %s", json.dumps(event, default=str)[:500])

    if "Records" in event and event["Records"][0].get("eventSource") == "aws:s3":
        return handle_s3_event(event)

    if "httpMethod" in event or "requestContext" in event:
        return handle_api_request(event)

    return {"statusCode": 400, "body": "Unrecognized event source"}
