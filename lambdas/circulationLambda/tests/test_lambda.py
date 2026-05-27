"""
Tests for the circulation statistics Lambda.

Run:  pytest tests/ -v
"""

import json
import os
import pytest
from unittest.mock import patch, MagicMock
from io import BytesIO

import openpyxl

from lambda_function import (
    parse_workbook,
    build_circulation_data,
    _safe_int,
    _find_total_row,
    lambda_handler,
    FY_MONTHS,
    CATEGORY_MAP,
    COL_TOTAL_ADULT,
    COL_TOTAL_JUVENILE,
    COL_TOTAL_YA,
    COL_TOTAL_NONPRINT,
    COL_GRAND_TOTAL,
)


# ── Test data ────────────────────────────────────────────────────────────────

# Real values from FY2026 workbook
REAL_DATA = {
    "JULY": {
        COL_TOTAL_ADULT: 139948,
        COL_TOTAL_JUVENILE: 285031,
        COL_TOTAL_YA: 21107,
        COL_TOTAL_NONPRINT: 169159,
        COL_GRAND_TOTAL: 847261,
    },
    "AUGUST": {
        COL_TOTAL_ADULT: 130799,
        COL_TOTAL_JUVENILE: 262962,
        COL_TOTAL_YA: 19115,
        COL_TOTAL_NONPRINT: 164248,
        COL_GRAND_TOTAL: 806225,
    },
    "SEPTEMBER": {
        COL_TOTAL_ADULT: 123320,
        COL_TOTAL_JUVENILE: 247639,
        COL_TOTAL_YA: 16360,
        COL_TOTAL_NONPRINT: 159559,
        COL_GRAND_TOTAL: 780814,
    },
    "APRIL": {
        COL_TOTAL_ADULT: 110500,
        COL_TOTAL_JUVENILE: 213936,
        COL_TOTAL_YA: 14985,
        COL_TOTAL_NONPRINT: 167013,
        COL_GRAND_TOTAL: 771287,
    },
}


def _make_workbook(months_with_data: dict, fy_start_year: int = 2025) -> bytes:
    """
    Build a minimal .xlsx in memory.
    months_with_data: { "JULY": { col_index: value, ... }, ... }
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    for month_name in FY_MONTHS:
        ws = wb.create_sheet(month_name)
        # Header area (rows 1-5)
        ws.append([])
        ws.append([])
        year = fy_start_year if FY_MONTHS.index(month_name) < 6 else fy_start_year + 1
        header = [None] * 25
        header[0] = "Charlotte Mecklenburg Library"
        header[16] = f"{month_name} {year}"
        ws.append(header)
        ws.append([])
        ws.append([])

        total = [None] * 25
        total[0] = "Total"
        if month_name in months_with_data:
            for col_idx, value in months_with_data[month_name].items():
                total[col_idx] = value
        ws.append(total)

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── _safe_int ────────────────────────────────────────────────────────────────

class TestSafeInt:
    def test_none_returns_zero(self):
        assert _safe_int(None) == 0

    def test_empty_string_returns_zero(self):
        assert _safe_int("") == 0

    def test_whitespace_returns_zero(self):
        assert _safe_int("   ") == 0

    def test_integer_passthrough(self):
        assert _safe_int(847261) == 847261

    def test_float_truncates(self):
        assert _safe_int(0.8991) == 0

    def test_numeric_string(self):
        assert _safe_int("139948") == 139948

    def test_non_numeric_returns_zero(self):
        assert _safe_int("abc") == 0

    def test_space_character(self):
        assert _safe_int(" ") == 0


# ── parse_workbook ───────────────────────────────────────────────────────────

class TestParseWorkbook:
    def test_extracts_months_with_data(self):
        wb = _make_workbook({"JULY": REAL_DATA["JULY"], "AUGUST": REAL_DATA["AUGUST"]})
        result = parse_workbook(wb)
        assert len(result) == 2
        assert result[0]["month_name"] == "JULY"
        assert result[1]["month_name"] == "AUGUST"

    def test_skips_zero_grand_total_months(self):
        data = {"JULY": REAL_DATA["JULY"]}
        wb = _make_workbook(data)
        result = parse_workbook(wb)
        assert len(result) == 1
        assert result[0]["month_name"] == "JULY"

    def test_returns_empty_list_for_empty_workbook(self):
        wb = _make_workbook({})
        result = parse_workbook(wb)
        assert result == []

    def test_values_match_real_data(self):
        wb = _make_workbook({"JULY": REAL_DATA["JULY"]})
        result = parse_workbook(wb)
        totals = result[0]["totals"]
        assert totals["Juvenile Fiction"] == 285031
        assert totals["Young Adult"] == 21107
        assert totals["Adult"] == 139948
        assert totals["Non-Print"] == 169159
        assert totals["Total Circulation"] == 847261

    def test_display_month_format(self):
        wb = _make_workbook({"JULY": REAL_DATA["JULY"]})
        result = parse_workbook(wb)
        assert result[0]["display_month"] == "Jul 2025"

    def test_caps_at_twelve_months(self):
        # Fill all 12 months
        all_months = {}
        for m in FY_MONTHS:
            all_months[m] = REAL_DATA["JULY"]
        wb = _make_workbook(all_months)
        result = parse_workbook(wb)
        assert len(result) == 12

    def test_fiscal_year_order_preserved(self):
        data = {
            "JULY": REAL_DATA["JULY"],
            "SEPTEMBER": REAL_DATA["SEPTEMBER"],
            "APRIL": REAL_DATA["APRIL"],
        }
        wb = _make_workbook(data)
        result = parse_workbook(wb)
        names = [r["month_name"] for r in result]
        assert names == ["JULY", "SEPTEMBER", "APRIL"]

    def test_year_detection_first_half(self):
        wb = _make_workbook({"JULY": REAL_DATA["JULY"]}, fy_start_year=2025)
        result = parse_workbook(wb)
        assert result[0]["year"] == 2025

    def test_year_detection_second_half(self):
        wb = _make_workbook({"APRIL": REAL_DATA["APRIL"]}, fy_start_year=2025)
        result = parse_workbook(wb)
        assert result[0]["year"] == 2026


# ── build_circulation_data ───────────────────────────────────────────────────

class TestBuildCirculationData:
    def _sample_months(self, count=3):
        months = []
        for i, m in enumerate(FY_MONTHS[:count]):
            months.append({
                "month_name": m,
                "display_month": f"{m[:3]} 2025",
                "year": 2025,
                "totals": {cat: 1000 * (i + 1) for cat in CATEGORY_MAP},
            })
        return months

    def test_produces_correct_point_count(self):
        months = self._sample_months(3)
        result = build_circulation_data(months)
        # 5 categories × 3 months = 15 points
        assert result["totalRecords"] == 15
        assert len(result["data"]) == 15

    def test_data_point_shape(self):
        months = self._sample_months(1)
        result = build_circulation_data(months)
        point = result["data"][0]
        assert "category" in point
        assert "month" in point
        assert "year" in point
        assert "circulation" in point

    def test_all_five_categories_present(self):
        months = self._sample_months(1)
        result = build_circulation_data(months)
        categories = {pt["category"] for pt in result["data"]}
        assert categories == set(CATEGORY_MAP.keys())

    def test_last_updated_is_iso(self):
        months = self._sample_months(1)
        result = build_circulation_data(months)
        assert "T" in result["lastUpdated"]

    def test_filter_by_category(self):
        months = self._sample_months(3)
        result = build_circulation_data(months)
        filtered = [pt for pt in result["data"] if pt["category"] == "Adult"]
        assert len(filtered) == 3


# ── lambda_handler – S3 event ────────────────────────────────────────────────

class TestS3Handler:
    def _s3_event(self, bucket="test-bucket", key="uploads/circulation/FY2026.xlsm"):
        return {
            "Records": [{
                "eventSource": "aws:s3",
                "s3": {
                    "bucket": {"name": bucket},
                    "object": {"key": key},
                },
            }],
        }

    @patch("lambda_function.write_json_s3")
    @patch("lambda_function.read_s3")
    def test_processes_upload_and_writes_json(self, mock_read, mock_write):
        mock_read.return_value = _make_workbook({"JULY": REAL_DATA["JULY"]})

        with patch.dict(os.environ, {"PROCESSED_BUCKET": "test-bucket"}):
            result = lambda_handler(self._s3_event(), None)

        assert result["statusCode"] == 200
        mock_write.assert_called_once()
        written_payload = mock_write.call_args[0][2]
        assert written_payload["totalRecords"] == 5  # 5 categories × 1 month

    @patch("lambda_function.write_json_s3")
    @patch("lambda_function.read_s3")
    def test_empty_workbook_returns_400(self, mock_read, mock_write):
        mock_read.return_value = _make_workbook({})

        with patch.dict(os.environ, {"PROCESSED_BUCKET": "test-bucket"}):
            result = lambda_handler(self._s3_event(), None)

        assert result["statusCode"] == 400
        mock_write.assert_not_called()

    @patch("lambda_function.write_json_s3")
    @patch("lambda_function.read_s3")
    def test_idempotent_reupload(self, mock_read, mock_write):
        """Two uploads with same data produce the same output."""
        wb = _make_workbook({"JULY": REAL_DATA["JULY"]})
        mock_read.return_value = wb

        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            lambda_handler(self._s3_event(), None)
            lambda_handler(self._s3_event(), None)

        assert mock_write.call_count == 2
        first_payload = mock_write.call_args_list[0][0][2]
        second_payload = mock_write.call_args_list[1][0][2]
        # Data arrays are identical (timestamps differ)
        assert first_payload["data"] == second_payload["data"]


# ── lambda_handler – API Gateway ─────────────────────────────────────────────

class TestApiHandler:
    def _api_event(self, category=None):
        event = {
            "httpMethod": "GET",
            "path": "/circulation",
            "requestContext": {"stage": "Prod"},
            "queryStringParameters": {},
        }
        if category:
            event["queryStringParameters"]["category"] = category
        return event

    @patch("lambda_function.read_json_s3")
    def test_returns_all_categories(self, mock_read):
        mock_read.return_value = {
            "data": [
                {"category": "Adult", "month": "Jul 2025", "year": 2025, "circulation": 139948},
                {"category": "Non-Print", "month": "Jul 2025", "year": 2025, "circulation": 169159},
            ],
            "lastUpdated": "2026-01-01T00:00:00",
            "totalRecords": 2,
        }

        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            result = lambda_handler(self._api_event(), None)

        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert body["success"] is True
        assert len(body["data"]["data"]) == 2

    @patch("lambda_function.read_json_s3")
    def test_filters_by_category(self, mock_read):
        mock_read.return_value = {
            "data": [
                {"category": "Adult", "month": "Jul 2025", "year": 2025, "circulation": 139948},
                {"category": "Non-Print", "month": "Jul 2025", "year": 2025, "circulation": 169159},
            ],
            "lastUpdated": "2026-01-01T00:00:00",
            "totalRecords": 2,
        }

        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            result = lambda_handler(self._api_event(category="Adult"), None)

        body = json.loads(result["body"])
        assert body["success"] is True
        assert len(body["data"]["data"]) == 1
        assert body["data"]["data"][0]["category"] == "Adult"
        assert body["data"]["totalRecords"] == 1

    @patch("lambda_function.read_json_s3")
    def test_cors_headers_present(self, mock_read):
        mock_read.return_value = {"data": [], "lastUpdated": "", "totalRecords": 0}

        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            result = lambda_handler(self._api_event(), None)

        assert result["headers"]["Access-Control-Allow-Origin"] == "*"
        assert "GET" in result["headers"]["Access-Control-Allow-Methods"]

    @patch("lambda_function.read_json_s3")
    def test_response_matches_api_contract(self, mock_read):
        """Verify the response has the exact APIResponse<CirculationData> shape."""
        mock_read.return_value = {
            "data": [{"category": "Adult", "month": "Jul 2025", "year": 2025, "circulation": 100}],
            "lastUpdated": "2026-01-01T00:00:00",
            "totalRecords": 1,
        }

        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            result = lambda_handler(self._api_event(), None)

        body = json.loads(result["body"])
        # Top-level APIResponse fields
        assert "success" in body
        assert "data" in body
        assert "error" in body
        assert "timestamp" in body
        assert "requestId" in body
        # CirculationData fields
        circ = body["data"]
        assert "data" in circ
        assert "lastUpdated" in circ
        assert "totalRecords" in circ

    def test_missing_bucket_config_returns_500(self):
        with patch.dict(os.environ, {}, clear=True):
            result = lambda_handler(self._api_event(), None)
        body = json.loads(result["body"])
        assert result["statusCode"] == 500
        assert body["error"]["code"] == "CONFIG_ERROR"

    def test_unrecognized_event_returns_400(self):
        result = lambda_handler({"unknown": True}, None)
        assert result["statusCode"] == 400
