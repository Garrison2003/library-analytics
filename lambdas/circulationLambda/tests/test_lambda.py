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
    _is_skip_department,
    _find_header_row,
    _find_totals_row,
    _api_ok,
    _api_err,
    lambda_handler,
    FY_MONTHS,
    CATEGORY_MAP,
    COL_TOTAL_ADULT,
    COL_TOTAL_JUVENILE,
    COL_TOTAL_YA,
    COL_TOTAL_NONPRINT,
    COL_GRAND_TOTAL,
)


# ── Fixtures & helpers ────────────────────────────────────────────────────────

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
    Build a minimal .xlsx in memory that parse_workbook can read.
    months_with_data: { "JULY": { col_index: value, ... }, ... }
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    for month_name in FY_MONTHS:
        ws = wb.create_sheet(month_name)
        year = fy_start_year if FY_MONTHS.index(month_name) < 6 else fy_start_year + 1

        # Row 1: year header — _detect_year scans rows 1-5 for month+year string
        header = [None] * 25
        header[0] = f"{month_name} {year}"
        ws.append(header)

        # Total row — _find_totals_row looks for row[0] == "Total"
        total = [None] * 25
        total[0] = "Total"
        if month_name in months_with_data:
            for col_idx, value in months_with_data[month_name].items():
                total[col_idx] = value
        ws.append(total)

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


class MockSheet:
    """Sheet stub whose iter_rows always returns a fresh iterator."""
    def __init__(self, rows):
        self._rows = rows

    def iter_rows(self, values_only=False, **kwargs):
        return iter(self._rows)


def _row(col_dict: dict, size: int = 25) -> tuple:
    row = [None] * size
    for col, val in col_dict.items():
        row[col] = val
    return tuple(row)


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

    def test_float_string_truncates(self):
        assert _safe_int("42.9") == 42

    def test_non_numeric_returns_zero(self):
        assert _safe_int("abc") == 0


# ── _is_skip_department ──────────────────────────────────────────────────────

class TestIsSkipDepartment:
    def test_none_is_skipped(self):
        assert _is_skip_department(None) is True

    def test_empty_string_is_skipped(self):
        assert _is_skip_department("") is True

    def test_department_header_is_skipped(self):
        assert _is_skip_department("Department") is True

    def test_total_is_skipped(self):
        assert _is_skip_department("Total") is True

    def test_library_name_is_skipped(self):
        assert _is_skip_department("Charlotte Mecklenburg Library") is True

    def test_regular_branch_is_not_skipped(self):
        assert _is_skip_department("Main Branch") is False

    def test_another_branch_is_not_skipped(self):
        assert _is_skip_department("Plaza Midwood") is False


# ── _find_header_row ─────────────────────────────────────────────────────────

class TestFindHeaderRow:
    def test_finds_department_row_at_index_zero(self):
        sheet = MockSheet([
            _row({0: "Department"}),
            _row({0: "Branch A", COL_GRAND_TOTAL: 100}),
        ])
        assert _find_header_row(sheet) == 0

    def test_finds_department_row_after_header_rows(self):
        sheet = MockSheet([
            _row({0: "JULY 2025"}),
            _row({}),
            _row({0: "Department"}),
            _row({0: "Branch A", COL_GRAND_TOTAL: 100}),
        ])
        assert _find_header_row(sheet) == 2

    def test_returns_minus_one_when_not_found(self):
        sheet = MockSheet([
            _row({0: "JULY 2025"}),
            _row({0: "Total", COL_GRAND_TOTAL: 500}),
        ])
        assert _find_header_row(sheet) == -1


# ── _find_totals_row ─────────────────────────────────────────────────────────

class TestFindTotalsRow:
    def test_finds_total_row(self):
        total = _row({0: "Total", COL_GRAND_TOTAL: 847261})
        sheet = MockSheet([
            _row({0: "Department"}),
            _row({0: "Branch A", COL_GRAND_TOTAL: 100}),
            total,
        ])
        result = _find_totals_row(sheet)
        assert result is not None
        assert result[0] == "Total"
        assert result[COL_GRAND_TOTAL] == 847261

    def test_returns_none_when_no_total_row(self):
        sheet = MockSheet([
            _row({0: "Department"}),
            _row({0: "Branch A", COL_GRAND_TOTAL: 100}),
        ])
        assert _find_totals_row(sheet) is None


# ── parse_workbook ───────────────────────────────────────────────────────────

class TestParseWorkbook:
    def test_extracts_months_with_data(self):
        wb = _make_workbook({"JULY": REAL_DATA["JULY"], "AUGUST": REAL_DATA["AUGUST"]})
        months, _ = parse_workbook(wb)
        assert len(months) == 2
        assert months[0]["month_name"] == "JULY"
        assert months[1]["month_name"] == "AUGUST"

    def test_skips_zero_grand_total_months(self):
        wb = _make_workbook({"JULY": REAL_DATA["JULY"]})
        months, _ = parse_workbook(wb)
        assert len(months) == 1
        assert months[0]["month_name"] == "JULY"

    def test_returns_empty_list_for_empty_workbook(self):
        wb = _make_workbook({})
        months, branches = parse_workbook(wb)
        assert months == []
        assert branches == []

    def test_values_match_real_data(self):
        wb = _make_workbook({"JULY": REAL_DATA["JULY"]})
        months, _ = parse_workbook(wb)
        totals = months[0]["system_totals"]
        assert totals["Juvenile Fiction"] == 285031
        assert totals["Young Adult"] == 21107
        assert totals["Adult"] == 139948
        assert totals["Non-Print"] == 169159
        assert totals["Total Circulation"] == 847261

    def test_display_month_format(self):
        wb = _make_workbook({"JULY": REAL_DATA["JULY"]})
        months, _ = parse_workbook(wb)
        assert months[0]["display_month"] == "Jul 2025"

    def test_caps_at_twelve_months(self):
        all_months = {m: REAL_DATA["JULY"] for m in FY_MONTHS}
        wb = _make_workbook(all_months)
        months, _ = parse_workbook(wb)
        assert len(months) == 12

    def test_fiscal_year_order_preserved(self):
        data = {
            "JULY": REAL_DATA["JULY"],
            "SEPTEMBER": REAL_DATA["SEPTEMBER"],
            "APRIL": REAL_DATA["APRIL"],
        }
        wb = _make_workbook(data)
        months, _ = parse_workbook(wb)
        assert [r["month_name"] for r in months] == ["JULY", "SEPTEMBER", "APRIL"]

    def test_year_detection_first_half(self):
        wb = _make_workbook({"JULY": REAL_DATA["JULY"]}, fy_start_year=2025)
        months, _ = parse_workbook(wb)
        assert months[0]["year"] == 2025

    def test_year_detection_second_half(self):
        wb = _make_workbook({"APRIL": REAL_DATA["APRIL"]}, fy_start_year=2025)
        months, _ = parse_workbook(wb)
        assert months[0]["year"] == 2026

    def test_returns_branch_list(self):
        wb = _make_workbook({"JULY": REAL_DATA["JULY"]})
        _, branches = parse_workbook(wb)
        # No "Department" row in _make_workbook → no branches extracted
        assert isinstance(branches, list)


# ── build_circulation_data ───────────────────────────────────────────────────

class TestBuildCirculationData:
    def _sample_months(self, count=3):
        months = []
        for i, m in enumerate(FY_MONTHS[:count]):
            months.append({
                "month_name": m,
                "display_month": f"{m[:3].title()} 2025",
                "year": 2025,
                "system_totals": {cat: 1000 * (i + 1) for cat in CATEGORY_MAP},
                "branches": {
                    "Main Branch": {cat: 500 * (i + 1) for cat in CATEGORY_MAP},
                },
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

    def test_default_selected_branch_is_system(self):
        months = self._sample_months(1)
        result = build_circulation_data(months)
        assert result["selectedBranch"] == "System"

    def test_branch_filter_uses_branch_data(self):
        months = self._sample_months(2)
        result = build_circulation_data(months, branch_filter="Main Branch")
        # 5 categories × 2 months = 10 points
        assert len(result["data"]) == 10
        assert result["selectedBranch"] == "Main Branch"

    def test_unknown_branch_returns_empty_data(self):
        months = self._sample_months(2)
        result = build_circulation_data(months, branch_filter="Ghost Branch")
        assert result["data"] == []

    def test_branches_list_in_result(self):
        months = self._sample_months(2)
        result = build_circulation_data(months)
        assert "Main Branch" in result["branches"]

    def test_category_values_correct(self):
        months = self._sample_months(1)
        result = build_circulation_data(months)
        adult_pt = next(pt for pt in result["data"] if pt["category"] == "Adult")
        assert adult_pt["circulation"] == 1000  # first month, multiplier 1


# ── API response helpers ──────────────────────────────────────────────────────

class TestApiHelpers:
    def test_api_ok_status_200(self):
        resp = _api_ok({"key": "value"})
        assert resp["statusCode"] == 200

    def test_api_ok_body_success_true(self):
        resp = _api_ok({"key": "value"})
        body = json.loads(resp["body"])
        assert body["success"] is True
        assert body["error"] is None
        assert "requestId" in body
        assert "timestamp" in body

    def test_api_err_status_code(self):
        resp = _api_err(404, "NOT_FOUND", "missing")
        assert resp["statusCode"] == 404

    def test_api_err_body_structure(self):
        resp = _api_err(500, "INTERNAL_ERROR", "boom")
        body = json.loads(resp["body"])
        assert body["success"] is False
        assert body["data"] is None
        assert body["error"]["code"] == "INTERNAL_ERROR"
        assert body["error"]["message"] == "boom"

    def test_cors_headers_present(self):
        resp = _api_ok({})
        assert resp["headers"]["Access-Control-Allow-Origin"] == "*"
        assert "GET" in resp["headers"]["Access-Control-Allow-Methods"]


# ── lambda_handler – S3 event ─────────────────────────────────────────────────

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
        wb = _make_workbook({"JULY": REAL_DATA["JULY"]})
        mock_read.return_value = wb
        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            lambda_handler(self._s3_event(), None)
            lambda_handler(self._s3_event(), None)
        assert mock_write.call_count == 2
        first = mock_write.call_args_list[0][0][2]
        second = mock_write.call_args_list[1][0][2]
        assert first["data"] == second["data"]

    @patch("lambda_function.write_json_s3")
    @patch("lambda_function.read_s3")
    def test_response_body_has_branch_count(self, mock_read, mock_write):
        mock_read.return_value = _make_workbook({"JULY": REAL_DATA["JULY"]})
        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            result = lambda_handler(self._s3_event(), None)
        body = json.loads(result["body"])
        assert "branchesFound" in body


# ── lambda_handler – API Gateway ──────────────────────────────────────────────

class TestApiHandler:
    def _api_event(self, category=None, branch=None):
        event = {
            "httpMethod": "GET",
            "path": "/circulation",
            "requestContext": {"stage": "Prod"},
            "queryStringParameters": {},
        }
        if category:
            event["queryStringParameters"]["category"] = category
        if branch:
            event["queryStringParameters"]["branch"] = branch
        return event

    def _stored_payload(self):
        return {
            "data": [
                {"category": "Adult", "month": "Jul 2025", "year": 2025, "circulation": 139948},
                {"category": "Non-Print", "month": "Jul 2025", "year": 2025, "circulation": 169159},
            ],
            "branches": ["Main Branch"],
            "selectedBranch": "System",
            "lastUpdated": "2026-01-01T00:00:00",
            "totalRecords": 2,
        }

    @patch("lambda_function.read_json_s3")
    def test_returns_all_data_when_no_filter(self, mock_read):
        mock_read.return_value = self._stored_payload()
        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            result = lambda_handler(self._api_event(), None)
        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert body["success"] is True
        assert len(body["data"]["data"]) == 2

    @patch("lambda_function.read_json_s3")
    def test_filters_by_category(self, mock_read):
        mock_read.return_value = self._stored_payload()
        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            result = lambda_handler(self._api_event(category="Adult"), None)
        body = json.loads(result["body"])
        assert body["success"] is True
        assert len(body["data"]["data"]) == 1
        assert body["data"]["data"][0]["category"] == "Adult"
        assert body["data"]["totalRecords"] == 1

    @patch("lambda_function.read_json_s3")
    def test_cors_headers_present(self, mock_read):
        mock_read.return_value = self._stored_payload()
        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            result = lambda_handler(self._api_event(), None)
        assert result["headers"]["Access-Control-Allow-Origin"] == "*"

    @patch("lambda_function.read_json_s3")
    def test_response_matches_api_contract(self, mock_read):
        mock_read.return_value = self._stored_payload()
        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            result = lambda_handler(self._api_event(), None)
        body = json.loads(result["body"])
        for field in ("success", "data", "error", "timestamp", "requestId"):
            assert field in body
        circ = body["data"]
        for field in ("data", "lastUpdated", "totalRecords"):
            assert field in circ

    def test_missing_bucket_config_returns_500(self):
        env = {k: v for k, v in os.environ.items() if k != "PROCESSED_BUCKET"}
        with patch.dict(os.environ, env, clear=True):
            result = lambda_handler(self._api_event(), None)
        body = json.loads(result["body"])
        assert result["statusCode"] == 500
        assert body["error"]["code"] == "CONFIG_ERROR"

    def test_unrecognized_event_returns_400(self):
        result = lambda_handler({"unknown": True}, None)
        assert result["statusCode"] == 400

    @patch("lambda_function.read_json_s3")
    def test_no_such_key_returns_404(self, mock_read):
        from botocore.exceptions import ClientError
        mock_read.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "The specified key does not exist."}},
            "GetObject",
        )
        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            result = lambda_handler(self._api_event(), None)
        assert result["statusCode"] == 404

    @patch("lambda_function.read_json_s3")
    def test_access_denied_returns_404(self, mock_read):
        # S3 returns AccessDenied instead of NoSuchKey when ListBucket is missing
        from botocore.exceptions import ClientError
        mock_read.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "GetObject",
        )
        with patch.dict(os.environ, {"PROCESSED_BUCKET": "b"}):
            result = lambda_handler(self._api_event(), None)
        assert result["statusCode"] == 404
