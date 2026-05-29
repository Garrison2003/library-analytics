"""
Tests for programming_lambda.py

Run:  pytest tests/ -v
"""

import json
import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError

import programming_lambda as module
from programming_lambda import (
    _safe_int,
    _extract_branch_code,
    _get_branch_name,
    _find_data_sheet,
    _parse_date_row,
    _month_year_to_display,
    parse_workbook,
    handle_s3_event,
    handle_api_request,
    lambda_handler,
)

# ── Shared fixtures & helpers ─────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def mock_s3():
    """Patch the module-level s3 client for every test."""
    with patch("programming_lambda.s3") as mock:
        yield mock


def _s3_body(content: bytes):
    """Wrap bytes in a mock S3 Body object."""
    body = MagicMock()
    body.read.return_value = content
    return {"Body": body}


def _s3_event(bucket: str, key: str) -> dict:
    return {"Records": [{"s3": {"bucket": {"name": bucket}, "object": {"key": key}}}]}


def _api_event(branch: str) -> dict:
    return {"queryStringParameters": {"branch": branch}}


# Sample parsed data returned by parse_workbook
PARSED_DATA = {
    "data": [{"month": "07/24", "attendance": 1500, "programs": 67, "date": "2024-07-01"}],
    "months": ["07/24"],
    "attendance": [1500],
    "programs": [67],
}

BRANCH_PAYLOAD = {
    "branch": "IMG",
    "branchName": "Imaginon",
    "data": PARSED_DATA["data"],
    "months": PARSED_DATA["months"],
    "attendance": PARSED_DATA["attendance"],
    "programs": PARSED_DATA["programs"],
    "dataFound": True,
    "lastUpdated": "2024-07-01T00:00:00+00:00",
}


# ── TestSafeInt ───────────────────────────────────────────────────────────────


class TestSafeInt:
    def test_none_returns_zero(self):
        assert _safe_int(None) == 0

    def test_integer_passthrough(self):
        assert _safe_int(42) == 42

    def test_float_truncates(self):
        assert _safe_int(3.9) == 3

    def test_numeric_string(self):
        assert _safe_int("123") == 123

    def test_float_string_truncates(self):
        assert _safe_int("3.7") == 3

    def test_empty_string_returns_zero(self):
        assert _safe_int("") == 0

    def test_whitespace_string_returns_zero(self):
        assert _safe_int("   ") == 0

    def test_non_numeric_string_returns_zero(self):
        assert _safe_int("abc") == 0


# ── TestExtractBranchCode ─────────────────────────────────────────────────────


class TestExtractBranchCode:
    def test_extracts_three_letter_code(self):
        assert _extract_branch_code("IMG Monthly Stats FY26-28.xlsx") == "IMG"

    def test_extracts_mai_code(self):
        assert _extract_branch_code("MAI Stats.xlsx") == "MAI"

    def test_returns_none_when_no_space_after_code(self):
        assert _extract_branch_code("IMGSTATS.xlsx") is None

    def test_returns_none_for_lowercase_prefix(self):
        assert _extract_branch_code("img Monthly Stats.xlsx") is None

    def test_returns_none_for_empty_string(self):
        assert _extract_branch_code("") is None

    def test_returns_none_when_prefix_is_two_letters(self):
        assert _extract_branch_code("IM Monthly Stats.xlsx") is None


# ── TestGetBranchName ─────────────────────────────────────────────────────────


class TestGetBranchName:
    def test_img_returns_imaginon(self):
        assert _get_branch_name("IMG") == "Imaginon"

    def test_mai_returns_main(self):
        assert _get_branch_name("MAI") == "Main"

    def test_unknown_code_returns_the_code_itself(self):
        assert _get_branch_name("XYZ") == "XYZ"


# ── TestFindDataSheet ─────────────────────────────────────────────────────────


class TestFindDataSheet:
    def _wb(self, names):
        wb = MagicMock()
        wb.sheetnames = names
        return wb

    def test_finds_program_23_sheet(self):
        assert _find_data_sheet(self._wb(["Summary", "Program 23-26"])) == "Program 23-26"

    def test_finds_program_24_sheet(self):
        assert _find_data_sheet(self._wb(["Program 24-27", "Summary"])) == "Program 24-27"

    def test_fallback_to_teen_programs(self):
        assert _find_data_sheet(self._wb(["Teen Programs", "Summary"])) == "Teen Programs"

    def test_fallback_to_juv_programs(self):
        assert _find_data_sheet(self._wb(["Summary", "Juv Programs"])) == "Juv Programs"

    def test_program_23_preferred_over_fallback_sheets(self):
        assert _find_data_sheet(self._wb(["Teen Programs", "Program 23-26"])) == "Program 23-26"

    def test_returns_none_when_no_match(self):
        assert _find_data_sheet(self._wb(["Sheet1", "Data"])) is None


# ── TestParseDateRow ──────────────────────────────────────────────────────────


class TestParseDateRow:
    def test_datetime_returns_month_and_year(self):
        assert _parse_date_row([datetime(2024, 7, 1)]) == (7, 24)

    def test_december_2024(self):
        assert _parse_date_row([datetime(2024, 12, 1)]) == (12, 24)

    def test_january_2025(self):
        assert _parse_date_row([datetime(2025, 1, 1)]) == (1, 25)

    def test_empty_row_returns_none(self):
        assert _parse_date_row([]) is None

    def test_none_first_cell_returns_none(self):
        assert _parse_date_row([None]) is None

    def test_string_cell_returns_none(self):
        assert _parse_date_row(["July 2024"]) is None


# ── TestMonthYearToDisplay ────────────────────────────────────────────────────


class TestMonthYearToDisplay:
    def test_july_24(self):
        assert _month_year_to_display(7, 24) == "07/24"

    def test_january_25(self):
        assert _month_year_to_display(1, 25) == "01/25"

    def test_december_24(self):
        assert _month_year_to_display(12, 24) == "12/24"


# ── TestParseWorkbook ─────────────────────────────────────────────────────────


class TestParseWorkbook:
    @pytest.fixture()
    def mock_wb(self):
        wb = MagicMock()
        ws = MagicMock()
        wb.sheetnames = ["Program 23-26"]
        wb.__getitem__ = MagicMock(return_value=ws)
        ws.iter_rows.return_value = [
            ("Date", "Attendance", "Programs"),    # header row — skipped
            (datetime(2024, 7, 1), 1500, 67),
            (datetime(2024, 8, 1), 1200, 55),
        ]
        return wb

    def test_returns_correct_number_of_data_rows(self, mock_wb):
        with patch("programming_lambda.openpyxl.load_workbook", return_value=mock_wb):
            result = parse_workbook(b"fake")
        assert len(result["data"]) == 2

    def test_month_label_format(self, mock_wb):
        with patch("programming_lambda.openpyxl.load_workbook", return_value=mock_wb):
            result = parse_workbook(b"fake")
        assert result["data"][0]["month"] == "07/24"

    def test_attendance_values(self, mock_wb):
        with patch("programming_lambda.openpyxl.load_workbook", return_value=mock_wb):
            result = parse_workbook(b"fake")
        assert result["attendance"] == [1500, 1200]

    def test_programs_values(self, mock_wb):
        with patch("programming_lambda.openpyxl.load_workbook", return_value=mock_wb):
            result = parse_workbook(b"fake")
        assert result["programs"] == [67, 55]

    def test_date_field_format(self, mock_wb):
        with patch("programming_lambda.openpyxl.load_workbook", return_value=mock_wb):
            result = parse_workbook(b"fake")
        assert result["data"][0]["date"] == "2024-07-01"

    def test_skips_rows_where_both_attendance_and_programs_are_zero(self):
        wb = MagicMock()
        ws = MagicMock()
        wb.sheetnames = ["Program 23-26"]
        wb.__getitem__ = MagicMock(return_value=ws)
        ws.iter_rows.return_value = [
            ("Date", "Attendance", "Programs"),
            (datetime(2024, 7, 1), 0, 0),         # all zeros — skip
            (datetime(2024, 8, 1), 1200, 55),
        ]
        with patch("programming_lambda.openpyxl.load_workbook", return_value=wb):
            result = parse_workbook(b"fake")
        assert len(result["data"]) == 1
        assert result["data"][0]["month"] == "08/24"

    def test_no_matching_sheet_returns_empty_result(self):
        wb = MagicMock()
        wb.sheetnames = ["Summary", "Random"]
        with patch("programming_lambda.openpyxl.load_workbook", return_value=wb):
            result = parse_workbook(b"fake")
        assert result["data"] == []
        assert result["months"] == []
        assert result["attendance"] == []
        assert result["programs"] == []


# ── TestHandleS3Event ─────────────────────────────────────────────────────────


class TestHandleS3Event:
    @pytest.fixture(autouse=True)
    def s3_setup(self, mock_s3):
        mock_s3.get_object.return_value = _s3_body(b"fake xlsx bytes")
        mock_s3.put_object.return_value = {}

    def _event(self, filename="IMG Monthly Stats.xlsx", bucket="source-bucket"):
        return _s3_event(bucket, f"uploads/programming/{filename}")

    def test_successful_processing_returns_200(self, mock_s3):
        with patch("programming_lambda.parse_workbook", return_value=PARSED_DATA):
            resp = handle_s3_event(self._event())
        assert resp["statusCode"] == 200

    def test_writes_processed_json_to_s3(self, mock_s3):
        with patch("programming_lambda.parse_workbook", return_value=PARSED_DATA):
            handle_s3_event(self._event())
        kwargs = mock_s3.put_object.call_args.kwargs
        assert kwargs["Key"] == "processed/programming/IMG.json"
        assert kwargs["ContentType"] == "application/json"

    def test_written_json_contains_branch_info(self, mock_s3):
        with patch("programming_lambda.parse_workbook", return_value=PARSED_DATA):
            handle_s3_event(self._event())
        body = json.loads(mock_s3.put_object.call_args.kwargs["Body"])
        assert body["branch"] == "IMG"
        assert body["branchName"] == "Imaginon"
        assert body["dataFound"] is True

    def test_written_json_contains_monthly_data(self, mock_s3):
        with patch("programming_lambda.parse_workbook", return_value=PARSED_DATA):
            handle_s3_event(self._event())
        body = json.loads(mock_s3.put_object.call_args.kwargs["Body"])
        assert body["months"] == ["07/24"]
        assert body["attendance"] == [1500]

    def test_uses_processed_bucket_env_when_set(self, mock_s3, monkeypatch):
        monkeypatch.setenv("PROCESSED_BUCKET", "proc-bucket")
        with patch("programming_lambda.parse_workbook", return_value=PARSED_DATA):
            handle_s3_event(self._event(bucket="source-bucket"))
        assert mock_s3.put_object.call_args.kwargs["Bucket"] == "proc-bucket"

    def test_falls_back_to_source_bucket_when_env_unset(self, mock_s3, monkeypatch):
        monkeypatch.delenv("PROCESSED_BUCKET", raising=False)
        with patch("programming_lambda.parse_workbook", return_value=PARSED_DATA):
            handle_s3_event(self._event(bucket="source-bucket"))
        assert mock_s3.put_object.call_args.kwargs["Bucket"] == "source-bucket"

    def test_invalid_filename_without_branch_code_returns_400(self):
        resp = handle_s3_event(_s3_event("bucket", "uploads/programming/Monthly Stats.xlsx"))
        assert resp["statusCode"] == 400

    def test_empty_workbook_data_returns_400(self):
        empty = {"data": [], "months": [], "attendance": [], "programs": []}
        with patch("programming_lambda.parse_workbook", return_value=empty):
            resp = handle_s3_event(self._event())
        assert resp["statusCode"] == 400


# ── TestHandleApiRequest ──────────────────────────────────────────────────────


class TestHandleApiRequest:
    @pytest.fixture(autouse=True)
    def bucket_env(self, monkeypatch):
        monkeypatch.setenv("PROCESSED_BUCKET", "test-bucket")

    def test_missing_bucket_env_returns_500(self, mock_s3, monkeypatch):
        monkeypatch.delenv("PROCESSED_BUCKET", raising=False)
        resp = handle_api_request(_api_event("IMG"))
        assert resp["statusCode"] == 500
        assert json.loads(resp["body"])["error"]["code"] == "CONFIG_ERROR"

    def test_missing_branch_param_returns_400(self, mock_s3):
        resp = handle_api_request({"queryStringParameters": {}})
        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["error"]["code"] == "MISSING_PARAMETER"

    def test_none_query_params_returns_400(self, mock_s3):
        resp = handle_api_request({"queryStringParameters": None})
        assert resp["statusCode"] == 400

    def test_returns_branch_data_on_success(self, mock_s3):
        mock_s3.get_object.return_value = _s3_body(json.dumps(BRANCH_PAYLOAD).encode())
        resp = handle_api_request(_api_event("IMG"))
        assert resp["statusCode"] == 200
        assert json.loads(resp["body"])["success"] is True

    def test_reads_correct_s3_key(self, mock_s3):
        mock_s3.get_object.return_value = _s3_body(json.dumps(BRANCH_PAYLOAD).encode())
        handle_api_request(_api_event("IMG"))
        kwargs = mock_s3.get_object.call_args.kwargs
        assert kwargs["Key"] == "processed/programming/IMG.json"
        assert kwargs["Bucket"] == "test-bucket"

    def test_uppercases_branch_code(self, mock_s3):
        mock_s3.get_object.return_value = _s3_body(json.dumps(BRANCH_PAYLOAD).encode())
        handle_api_request({"queryStringParameters": {"branch": "img"}})
        assert mock_s3.get_object.call_args.kwargs["Key"] == "processed/programming/IMG.json"

    def test_no_such_key_returns_200_with_data_found_false(self, mock_s3):
        mock_s3.get_object.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "Not Found"}}, "GetObject"
        )
        resp = handle_api_request(_api_event("XYZ"))
        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        assert body["data"]["dataFound"] is False
        assert body["data"]["branch"] == "XYZ"

    def test_s3_404_code_also_returns_empty_data(self, mock_s3):
        mock_s3.get_object.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}}, "GetObject"
        )
        resp = handle_api_request(_api_event("MAI"))
        assert resp["statusCode"] == 200
        assert json.loads(resp["body"])["data"]["dataFound"] is False

    def test_response_has_cors_headers(self, mock_s3):
        mock_s3.get_object.return_value = _s3_body(json.dumps(BRANCH_PAYLOAD).encode())
        resp = handle_api_request(_api_event("IMG"))
        assert resp["headers"]["Access-Control-Allow-Origin"] == "*"


# ── TestLambdaHandler ─────────────────────────────────────────────────────────


class TestLambdaHandler:
    def test_routes_records_event_to_s3_handler(self, mock_s3, monkeypatch):
        monkeypatch.setenv("PROCESSED_BUCKET", "test-bucket")
        mock_s3.get_object.return_value = _s3_body(b"fake xlsx")
        mock_s3.put_object.return_value = {}
        with patch("programming_lambda.parse_workbook", return_value=PARSED_DATA):
            resp = lambda_handler(_s3_event("bucket", "uploads/programming/IMG Monthly.xlsx"), None)
        assert resp["statusCode"] == 200

    def test_routes_api_gateway_event_to_api_handler(self, mock_s3, monkeypatch):
        monkeypatch.setenv("PROCESSED_BUCKET", "test-bucket")
        mock_s3.get_object.return_value = _s3_body(json.dumps(BRANCH_PAYLOAD).encode())
        resp = lambda_handler(_api_event("IMG"), None)
        assert resp["statusCode"] == 200
