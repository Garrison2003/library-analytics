"""
Programming History Lambda - Query historical data from DynamoDB

Handles API requests:
- GET /programming/history?branch=IMG&months=12
- GET /programming/compare?branches=IMG,MAI&month=2026-05

Returns historical data for trend analysis and comparisons.
"""

import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")

# ── Constants ────────────────────────────────────────────────────────────────

BRANCH_CODE_MAP = {
    "ALW": "Allegra Westbrooks Regional",
    "CAR": "Carmel",
    "TEL": "Teen Loft",
    "CHS": "Charlotte",
    "COM": "Community",
    "COR": "Cornelius",
    "DAV": "Davidson",
    "EAS": "East",
    "HCG": "Hickory Grove",
    "IMG": "Imaginon",
    "INR": "Independence Regional",
    "LAC": "Library Admin Center",
    "MAI": "Main",
    "MAT": "Matthews",
    "MNH": "Mint Hill",
    "MOB": "Mobile Library",
    "MTI": "Mountain Island",
    "MYP": "Myers Park",
    "NCR": "North County Regional",
    "NOR": "Northlake",
    "PIN": "Pineville",
    "PLZ": "Plaza Midwood",
    "SBL": "South Boulevard",
    "SCR": "South County Regional",
    "SGC": "Sugar Creek",
    "SPA": "Spangler",
    "SPK": "SouthPark Regional",
    "STC": "Steele Creek",
    "UCR": "University City Regional",
    "WBL": "West Boulevard",
    "WES": "West",
}

# Departments that roll up into a parent branch.
# When the parent is queried, all department records are aggregated.
BRANCH_DEPARTMENTS: Dict[str, list] = {
    "IMG": ["SPA", "TEL"],  # Imaginon = Spangler + Teen Loft
}

# ── Helpers ──────────────────────────────────────────────────────────────────

def _env(name: str, fallback: str = "") -> str:
    """Get environment variable or fallback."""
    return os.environ.get(name, fallback)


def _get_branch_name(code: str) -> str:
    """Get full branch name from code, or return code if not found."""
    return BRANCH_CODE_MAP.get(code, code)


def _convert_decimal(obj):
    """Convert DynamoDB Decimal objects to int/float for JSON serialization."""
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")


# ── DynamoDB Queries ─────────────────────────────────────────────────────────

def _query_branch_items(table, branch_code: str, months: int) -> List[Dict]:
    """Query DynamoDB for all months of a single branch code."""
    response = table.query(
        KeyConditionExpression="branch_code = :code",
        ExpressionAttributeValues={":code": branch_code},
        ScanIndexForward=False,
        Limit=months,
    )
    return response.get("Items", [])


def get_branch_history(branch_code: str, months: int = 12) -> Optional[Dict]:
    """
    Get historical programming data for a branch.

    If the branch has departments (e.g. Imaginon → Spangler + Teen Loft),
    all department records are queried and their monthly totals are summed
    before returning. Each department uploads its own PDF independently;
    this aggregation combines them transparently for the caller.
    """
    table_name = _env("DYNAMODB_TABLE", "programming-data")

    try:
        table = dynamodb.Table(table_name)

        # Collect all codes to query: the branch itself plus any departments
        department_codes = BRANCH_DEPARTMENTS.get(branch_code, [])
        all_codes = [branch_code] + department_codes

        # Aggregate monthly totals across all codes.
        # Key: year_month string; value: running totals dict.
        monthly: Dict[str, Dict] = {}

        for code in all_codes:
            for item in _query_branch_items(table, code, months):
                ym = item.get("year_month")
                if not ym:
                    continue
                if ym not in monthly:
                    monthly[ym] = {"attendance": 0, "programs": 0, "virtual_attendance": 0}
                monthly[ym]["attendance"] += int(item.get("attendance", 0))
                monthly[ym]["programs"] += int(item.get("programs", 0))
                monthly[ym]["virtual_attendance"] += int(item.get("virtual_attendance", 0))

        if not monthly:
            logger.info("No data found for branch %s", branch_code)
            return {
                "branch": branch_code,
                "branchName": _get_branch_name(branch_code),
                "data": [],
                "dataFound": False,
            }

        # Sort newest-first, cap at requested months
        sorted_months = sorted(monthly.keys(), reverse=True)[:months]

        data = []
        months_list = []
        attendance_list = []
        programs_list = []

        for ym in sorted_months:
            entry = monthly[ym]
            months_list.append(ym)
            attendance_list.append(entry["attendance"])
            programs_list.append(entry["programs"])
            data.append({
                "year_month": ym,
                "attendance": entry["attendance"],
                "programs": entry["programs"],
                "virtual_attendance": entry["virtual_attendance"],
                "date": f"{ym}-01",
            })

        total_attendance = sum(attendance_list)
        total_programs = sum(programs_list)
        avg_attendance = total_attendance // len(attendance_list) if attendance_list else 0

        growth = None
        if len(attendance_list) >= 2:
            oldest = attendance_list[-1]
            newest = attendance_list[0]
            if oldest > 0:
                growth = ((newest - oldest) / oldest) * 100

        logger.info(
            "Retrieved %d months for branch %s (codes: %s)",
            len(sorted_months), branch_code, all_codes,
        )

        return {
            "branch": branch_code,
            "branchName": _get_branch_name(branch_code),
            "data": data,
            "months": months_list,
            "attendance": attendance_list,
            "programs": programs_list,
            "metrics": {
                "totalAttendance": total_attendance,
                "totalPrograms": total_programs,
                "averageMonthlyAttendance": avg_attendance,
                "growthPercent": growth,
            },
            "dataFound": True,
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        logger.exception("Error querying branch history: %s", str(exc))
        return None


def compare_branches(branch_codes: List[str], year_month: Optional[str] = None) -> Optional[Dict]:
    """
    Compare metrics across multiple branches.
    
    Args:
        branch_codes: List of 3-letter codes
        year_month: Optional specific month (YYYY-MM format)
    
    Returns:
        Dict with comparison data
    """
    table_name = _env("DYNAMODB_TABLE", "programming-data")
    
    try:
        table = dynamodb.Table(table_name)
        
        comparison = {
            "branches": {},
            "comparison": {},
        }
        
        for code in branch_codes:
            if year_month:
                # Query specific month for this branch
                response = table.query(
                    KeyConditionExpression="branch_code = :code AND year_month = :month",
                    ExpressionAttributeValues={
                        ":code": code,
                        ":month": year_month,
                    }
                )
                items = response.get("Items", [])
                
                if items:
                    item = items[0]
                    comparison["branches"][code] = {
                        "branchName": _get_branch_name(code),
                        "month": year_month,
                        "attendance": int(item.get("attendance", 0)),
                        "programs": int(item.get("programs", 0)),
                        "virtual_attendance": int(item.get("virtual_attendance", 0)),
                    }
            else:
                # Get latest month for each branch
                response = table.query(
                    KeyConditionExpression="branch_code = :code",
                    ExpressionAttributeValues={":code": code},
                    ScanIndexForward=False,
                    Limit=1
                )
                items = response.get("Items", [])
                
                if items:
                    item = items[0]
                    comparison["branches"][code] = {
                        "branchName": _get_branch_name(code),
                        "month": item.get("year_month"),
                        "attendance": int(item.get("attendance", 0)),
                        "programs": int(item.get("programs", 0)),
                        "virtual_attendance": int(item.get("virtual_attendance", 0)),
                    }
        
        # Calculate comparison metrics
        if comparison["branches"]:
            attendances = [v["attendance"] for v in comparison["branches"].values()]
            programs = [v["programs"] for v in comparison["branches"].values()]
            
            if attendances:
                comparison["comparison"] = {
                    "highestAttendance": max(attendances),
                    "lowestAttendance": min(attendances),
                    "averageAttendance": sum(attendances) // len(attendances),
                    "totalPrograms": sum(programs),
                }
        
        logger.info("Compared %d branches", len(branch_codes))
        
        return {
            "success": True,
            "comparison": comparison,
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
        }
        
    except Exception as exc:
        logger.exception("Error comparing branches: %s", str(exc))
        return None


# ── API Response Helpers ─────────────────────────────────────────────────────

def _api_ok(data: Any) -> dict:
    """Successful API response."""
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        "body": json.dumps({
            "success": True,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "requestId": f"req_{uuid.uuid4().hex[:12]}",
        }, default=_convert_decimal),
    }


def _api_err(status: int, code: str, message: str) -> dict:
    """Error API response."""
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps({
            "success": False,
            "data": None,
            "error": {"code": code, "message": message},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "requestId": f"req_{uuid.uuid4().hex[:12]}",
        }),
    }


# ── Handler ──────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    """Handle API Gateway requests for historical data."""
    logger.info("Event: %s", json.dumps(event, default=str)[:500])
    
    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
            "body": "",
        }
    
    try:
        # Get path and query parameters
        path = event.get("path", "")
        query_params = event.get("queryStringParameters") or {}
        
        logger.info("Path: %s, Params: %s", path, query_params)
        
        # Route: /programming/history?branch=IMG&months=12
        if "/programming/history" in path:
            branch_code = query_params.get("branch", "").upper()
            months = int(query_params.get("months", 12))
            
            if not branch_code:
                return _api_err(400, "MISSING_PARAMETER", "branch query parameter required")
            
            data = get_branch_history(branch_code, months)
            if data:
                return _api_ok(data)
            else:
                return _api_err(500, "INTERNAL_ERROR", "Failed to query historical data")
        
        # Route: /programming/compare?branches=IMG,MAI,PLZ&month=2026-05
        elif "/programming/compare" in path:
            branches_param = query_params.get("branches", "")
            month_param = query_params.get("month")
            
            if not branches_param:
                return _api_err(400, "MISSING_PARAMETER", "branches query parameter required")
            
            branch_codes = [b.strip().upper() for b in branches_param.split(",")]
            
            data = compare_branches(branch_codes, month_param)
            if data:
                return _api_ok(data)
            else:
                return _api_err(500, "INTERNAL_ERROR", "Failed to compare branches")
        
        else:
            return _api_err(400, "INVALID_PATH", f"Unknown path: {path}")
    
    except ValueError as exc:
        logger.exception("Invalid parameter value: %s", str(exc))
        return _api_err(400, "INVALID_PARAMETER", str(exc))
    
    except Exception as exc:
        logger.exception("Unexpected error: %s", str(exc))
        return _api_err(500, "INTERNAL_ERROR", str(exc))
