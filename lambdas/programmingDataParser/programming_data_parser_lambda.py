"""
Library Analytics – Programming Statistics Lambda (Enhanced with DynamoDB)

Parses programming statistics .xlsx files uploaded to S3 and:
1. Writes current data to S3 (for fast API responses)
2. Writes historical data to DynamoDB (for trend analysis)

Features:
  - Extracts monthly in-person attendance and program count data
  - Identifies department/branch by 3-letter code in filename
  - Returns data organized by month in fiscal year format
  - Stores historical data for trend analysis
  - Supports branch-level filtering via query parameter

Trigger:  S3 PUT on uploads/programming/*.xlsx
API:      GET /programming?branch={CODE}
          GET /programming/history?branch={CODE}&months=12
"""

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import unquote_plus

import boto3
import openpyxl
from botocore.exceptions import ClientError
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

# ── Constants ────────────────────────────────────────────────────────────────

# Branch code to full name mapping
BRANCH_CODE_MAP = {
    "IMG": "Imaginon",
    "MAI": "Main",
    "PLZ": "Plaza Midwood",
    "NOR": "Northlake",
    "CHS": "Charlotte",
    "SPA": "Spangler",
    "CAR": "Carmel",
    "COM": "Community",
    "EAS": "East",
    "WES": "West",
}

PROCESSED_DIR = "processed/programming"

# ── Helpers ──────────────────────────────────────────────────────────────────

def _env(name: str, fallback: str = "") -> str:
    """Get environment variable or fallback."""
    return os.environ.get(name, fallback)


def _safe_int(val: Any) -> int:
    """Safely convert value to int, returning 0 on failure."""
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


def _extract_branch_code(filename: str) -> Optional[str]:
    """
    Extract 3-letter branch code from filename.
    Example: "IMG Monthly Stats FY26-28.xlsx" → "IMG"
    """
    match = re.match(r"^([A-Z]{3})\s+", filename)
    return match.group(1) if match else None


def _get_branch_name(code: str) -> str:
    """Get full branch name from code, or return code if not found."""
    return BRANCH_CODE_MAP.get(code, code)


def _date_to_year_month(date_obj) -> Optional[str]:
    """
    Convert date object to YYYY-MM format for DynamoDB sort key.
    Example: datetime(2024, 5, 15) → "2024-05"
    """
    try:
        if hasattr(date_obj, "month") and hasattr(date_obj, "year"):
            return f"{date_obj.year:04d}-{date_obj.month:02d}"
    except (AttributeError, TypeError):
        pass
    return None


def _month_year_to_display(month: int, year: int) -> str:
    """Convert month (1-12) and year (24, 25...) to MM/YY format."""
    return f"{month:02d}/{year:02d}"


# ── Excel Parsing ────────────────────────────────────────────────────────────

def _find_data_sheet(workbook) -> Optional[str]:
    """
    Find the appropriate data sheet in the workbook.
    Looks for "Program 23-26", "Program 23-27", or similar patterns.
    Falls back to "Teen Programs" or "Juv Programs".
    """
    for sheet_name in workbook.sheetnames:
        if "Program 23" in sheet_name or "Program 24" in sheet_name:
            return sheet_name
    for sheet_name in ["Teen Programs", "Juv Programs"]:
        if sheet_name in workbook.sheetnames:
            return sheet_name
    return None


def parse_workbook(file_bytes: bytes) -> Dict[str, Any]:
    """
    Parse programming .xlsx and extract monthly data.

    Returns dict with:
      data: List of monthly records with attendance & program counts
      months: List of MM/YY labels
      attendance: List of attendance values
      programs: List of program counts
      year_month_data: List of tuples (year_month string, attendance, programs)
    """
    file_obj = BytesIO(file_bytes)
    wb = openpyxl.load_workbook(file_obj, data_only=True)

    data_sheet_name = _find_data_sheet(wb)
    if not data_sheet_name:
        logger.warning("No data sheet found in workbook. Available: %s", wb.sheetnames)
        wb.close()
        return {
            "data": [],
            "months": [],
            "attendance": [],
            "programs": [],
            "year_month_data": [],
        }

    ws = wb[data_sheet_name]
    logger.info("Parsing sheet: %s", data_sheet_name)

    result_data = []
    months_list = []
    attendance_list = []
    programs_list = []
    year_month_data = []  # For DynamoDB storage

    # Iterate through rows starting from row 2 (row 1 is headers)
    for row_idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
        if row_idx == 1:
            # Skip header row
            continue

        if not row or not row[0]:
            # Skip empty rows
            continue

        # Get date from first column
        date_obj = row[0] if row else None
        if not date_obj:
            continue

        # Convert date to YYYY-MM format for DynamoDB
        year_month = _date_to_year_month(date_obj)
        if not year_month:
            continue

        # Also get MM/YY format for display
        try:
            if hasattr(date_obj, "month") and hasattr(date_obj, "year"):
                month = date_obj.month
                year = date_obj.year
                month_display = _month_year_to_display(month, year)
            else:
                continue
        except (AttributeError, TypeError):
            continue

        # Column mapping (0-based):
        # Col 0: Date
        # Col 1: TOTAL ATTENDANCE IN-PERSON
        # Col 2: TOTAL PROGRAMS
        # (Further columns: TOTAL VIRTUAL ATTENDANCE, increases, etc.)

        attendance = _safe_int(row[1]) if len(row) > 1 else 0
        programs = _safe_int(row[2]) if len(row) > 2 else 0
        virtual_attendance = _safe_int(row[3]) if len(row) > 3 else 0

        # Skip rows with no meaningful data
        if attendance == 0 and programs == 0:
            continue

        months_list.append(month_display)
        attendance_list.append(attendance)
        programs_list.append(programs)

        result_data.append({
            "month": month_display,
            "attendance": attendance,
            "programs": programs,
            "virtual_attendance": virtual_attendance,
            "date": f"{year_month}-01",
        })

        # Store for DynamoDB (with year_month key)
        year_month_data.append({
            "year_month": year_month,
            "attendance": attendance,
            "programs": programs,
            "virtual_attendance": virtual_attendance,
        })

    wb.close()

    logger.info("Parsed %d months of data", len(result_data))

    return {
        "data": result_data,
        "months": months_list,
        "attendance": attendance_list,
        "programs": programs_list,
        "year_month_data": year_month_data,
    }


# ── S3 I/O ───────────────────────────────────────────────────────────────────

def read_s3(bucket: str, key: str) -> bytes:
    """Read file from S3."""
    return s3.get_object(Bucket=bucket, Key=key)["Body"].read()


def write_json_s3(bucket: str, key: str, payload: dict) -> None:
    """Write JSON payload to S3."""
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(payload, indent=2),
        ContentType="application/json",
    )
    logger.info("Wrote s3://%s/%s", bucket, key)


# ── DynamoDB I/O ─────────────────────────────────────────────────────────────

def write_programming_data_to_dynamodb(
    branch_code: str,
    branch_name: str,
    year_month_data: List[Dict],
    filename: str,
) -> bool:
    """
    Write monthly data to DynamoDB for historical tracking.
    
    Args:
        branch_code: 3-letter code (e.g., "IMG")
        branch_name: Full name (e.g., "Imaginon")
        year_month_data: List of dicts with year_month, attendance, programs
        filename: Source filename for audit trail
    
    Returns:
        True if successful, False otherwise
    """
    table_name = _env("DYNAMODB_TABLE", "programming-data")
    
    try:
        table = dynamodb.Table(table_name)
        
        with table.batch_writer(batch_size=25) as batch:
            for data in year_month_data:
                item = {
                    "branch_code": branch_code,
                    "year_month": data["year_month"],  # YYYY-MM format
                    "year_month_gsi": data["year_month"],  # For GSI
                    "branch_name": branch_name,
                    "attendance": data["attendance"],
                    "programs": data["programs"],
                    "virtual_attendance": data.get("virtual_attendance", 0),
                    "created_date": datetime.now(timezone.utc).isoformat(),
                    "data_source_file": filename,
                }
                
                logger.info(
                    "Writing to DynamoDB: %s %s (attendance=%d, programs=%d)",
                    branch_code,
                    data["year_month"],
                    data["attendance"],
                    data["programs"],
                )
                
                batch.put_item(Item=item)
        
        # Update branch metadata
        update_branch_metadata(branch_code, branch_name)
        
        logger.info("Successfully wrote %d records to DynamoDB for %s", len(year_month_data), branch_code)
        return True
        
    except Exception as exc:
        logger.exception("Error writing to DynamoDB: %s", str(exc))
        return False


def update_branch_metadata(branch_code: str, branch_name: str) -> bool:
    """Update or create branch metadata record."""
    table_name = _env("DYNAMODB_METADATA_TABLE", "branch-metadata")
    
    try:
        table = dynamodb.Table(table_name)
        
        table.update_item(
            Key={"branch_code": branch_code},
            UpdateExpression="SET branch_name = :name, last_updated = :now, #ts = if_not_exists(#ts, :now)",
            ExpressionAttributeNames={
                "#ts": "created_date",  # created_date is a reserved word
            },
            ExpressionAttributeValues={
                ":name": branch_name,
                ":now": datetime.now(timezone.utc).isoformat(),
            },
        )
        
        logger.info("Updated metadata for branch %s", branch_code)
        return True
        
    except Exception as exc:
        logger.exception("Error updating branch metadata: %s", str(exc))
        return False


# ── API Response Helpers ─────────────────────────────────────────────────────

def _api_ok(data: Any) -> dict:
    """Successful API response."""
    return _api_response(200, {
        "success": True,
        "data": data,
        "error": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "requestId": f"req_{uuid.uuid4().hex[:12]}",
    })


def _api_err(status: int, code: str, message: str) -> dict:
    """Error API response."""
    return _api_response(status, {
        "success": False,
        "data": None,
        "error": {"code": code, "message": message},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "requestId": f"req_{uuid.uuid4().hex[:12]}",
    })


def _api_response(status: int, body: dict) -> dict:
    """Format API response with CORS headers."""
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        "body": json.dumps(body, default=str),
    }


# ── Handlers ─────────────────────────────────────────────────────────────────

def handle_s3_event(event: dict) -> dict:
    """S3 PUT trigger. Downloads .xlsx, parses it, writes to S3 and DynamoDB."""
    try:
        record = event["Records"][0]["s3"]
        source_bucket = record["bucket"]["name"]
        source_key = unquote_plus(record["object"]["key"])

        logger.info("Processing s3://%s/%s", source_bucket, source_key)

        # Extract branch code from filename
        filename = source_key.split("/")[-1]
        branch_code = _extract_branch_code(filename)

        if not branch_code:
            logger.error("Cannot extract branch code from filename: %s", filename)
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Invalid filename format"}),
            }

        # Read and parse file
        file_bytes = read_s3(source_bucket, source_key)
        parsed = parse_workbook(file_bytes)

        if not parsed["data"]:
            logger.warning("No valid data found in file")
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "No valid data in workbook"}),
            }

        branch_name = _get_branch_name(branch_code)

        # Write to DynamoDB (historical data)
        dynamodb_success = write_programming_data_to_dynamodb(
            branch_code,
            branch_name,
            parsed["year_month_data"],
            filename,
        )

        if not dynamodb_success:
            logger.warning("DynamoDB write failed, but continuing to S3")

        # Prepare output JSON for S3 (current data)
        output_payload = {
            "branch": branch_code,
            "branchName": branch_name,
            "data": parsed["data"],
            "months": parsed["months"],
            "attendance": parsed["attendance"],
            "programs": parsed["programs"],
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
            "dataFound": True,
        }

        # Write to S3: processed/programming/{BRANCH_CODE}.json
        dest_bucket = _env("PROCESSED_BUCKET", source_bucket)
        dest_key = f"{PROCESSED_DIR}/{branch_code}.json"
        write_json_s3(dest_bucket, dest_key, output_payload)

        logger.info("Successfully processed %s for branch %s", filename, branch_code)
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Programming data processed",
                "branch": branch_code,
                "dataPoints": len(parsed["data"]),
                "dynamodbSuccess": dynamodb_success,
            }),
        }

    except Exception as exc:
        logger.exception("Error processing S3 event")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(exc)}),
        }


def handle_api_request(event: dict) -> dict:
    """GET /programming?branch={CODE} - Return programming data for a branch."""
    try:
        bucket = _env("PROCESSED_BUCKET")
        if not bucket:
            return _api_err(500, "CONFIG_ERROR", "PROCESSED_BUCKET not set")

        # Get branch code from query parameters
        query_params = event.get("queryStringParameters") or {}
        branch_code = query_params.get("branch", "").upper()

        if not branch_code:
            return _api_err(400, "MISSING_PARAMETER", "branch query parameter required")

        # Try to read branch-specific file from S3
        key = f"{PROCESSED_DIR}/{branch_code}.json"

        try:
            file_bytes = read_s3(bucket, key)
            payload = json.loads(file_bytes)
            return _api_ok(payload)
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("NoSuchKey", "404"):
                # Return no-data response instead of 404
                return _api_ok({
                    "branch": branch_code,
                    "branchName": _get_branch_name(branch_code),
                    "data": [],
                    "months": [],
                    "attendance": [],
                    "programs": [],
                    "dataFound": False,
                    "lastUpdated": datetime.now(timezone.utc).isoformat(),
                })
            raise

    except Exception as exc:
        logger.exception("Error handling API request")
        return _api_err(500, "INTERNAL_ERROR", str(exc))


# ── Lambda Handler Entrypoint ────────────────────────────────────────────────

def lambda_handler(event, context):
    """Main Lambda entry point. Routes S3 events vs API Gateway requests."""
    logger.info("Event: %s", json.dumps(event, default=str)[:500])

    # Determine event type
    if "Records" in event:
        # S3 event
        return handle_s3_event(event)
    else:
        # API Gateway request
        return handle_api_request(event)
