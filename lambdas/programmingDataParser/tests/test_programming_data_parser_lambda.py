"""
Tests for programming_data_parser_lambda.py

Run:  pytest tests/ -v
"""

import json
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError

from programming_data_parser_lambda import (
    _safe_int,
    _extract_branch_code,
    _get_branch_name,
    _date_to_year_month,
    _month_year_to_display,
    _find_data_sheet,
    parse_workbook,
    write_programming_data_to_dynamodb,
    update_branch_metadata,
    handle_s3_event,
    handle_api_request,
    lambda_handler,
)

# ── Shared fixtures & helpers ─────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def mock_s3():
    with patch("programming_data_parser_lambda.s3") as mock:
        yield mock


@pytest.fixture(autouse=True)
def mock_dynamodb():
    with patch("programming_data_parser_lambda.dynamodb") as mock:
        yield mock


def _s3_body(content: bytes):
    body = MagicMock()
    body.read.return_value = content
    return {"Body": body}


def _s3_event(bucket: str, key: str) -> dict:
    return {"Records": [{"s3": {"bucket": {"name": bucket}, "object": {"key": key}}}]}


def _api_event(branch: str) -> dict:
    return {"queryStringParameters": {"branch": branch}}


def _mock_table(mock_dynamodb):
    table = MagicMock()
    mock_dynamodb.Table.return_value = table
    batch = MagicMock()
    table.batch_writer.return_value.__enter__ = MagicMock(return_value=batch)
    table.batch_writer.return_value.__exit__ = MagicMock(return_value=False)
    return table, batch


YEAR_MONTH_DATA = [
    {"year_month": "2024-07", "attendance": 1500, "programs": 67, "virtual_attendance": 200},
    {"year_month": "2024-08", "attendance": 1200, "programs": 55, "virtual_attendance": 150},
]

PARSED_DATA = {
    "data": [
        {"month": "07/2024", "attendance": 1500, "programs": 67, "virtual_attendance": 200, "date": "2024-07-01"},
        {"month": "08/2024", "attendance": 1200, "programs": 55, "virtual_attendance": 150, "date": "2024-08-01"},
    ],
    "months": ["07/2024", "08/2024"],
    "attendance": [1500, 1200],
    "programs": [67, 55],
    "year_month_data": YEAR_MONTH_DATA,
}

BRANCH_PAYLOAD = {
    "branch": "IMG",
    "branchName": "Imaginon",
    "data": PARSED_DATA["data"],
    "months": PARSED_DATA["months"],
    "attendance": PARSED_DATA["attendance"],
    "programs": PARSED_DATA["programs"],
    "dataFound": True,
    "lastUpdated": "2025-07-01T00:00:00+00:00",
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


# ── TestDateToYearMonth ───────────────────────────────────────────────────────


class TestDateToYearMonth:
    def test_july_2024(self):
        assert _date_to_year_month(datetime(2024, 7, 1)) == "2024-07"

    def test_single_digit_month_is_zero_padded(self):
        assert _date_to_year_month(datetime(2024, 1, 15)) == "2024-01"

    def test_december(self):
        assert _date_to_year_month(datetime(2025, 12, 31)) == "2025-12"

    def test_none_returns_none(self):
        assert _date_to_year_month(None) is None

    def test_string_returns_none(self):
        assert _date_to_year_month("July 2024") is None


# ── TestMonthYearToDisplay ────────────────────────────────────────────────────


class TestMonthYearToDisplay:
    def test_july_24(self):
        assert _month_year_to_display(7, 24) == "07/24"

    def test_january_25(self):
        assert _month_year_to_display(1, 25) == "01/25"

    def test_december_24(self):
        assert _month_year_to_display(12, 24) == "12/24"


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


# ── TestParseWorkbook ─────────────────────────────────────────────────────────


class TestParseWorkbook:
    @pytest.fixture()
    def mock_wb(self):
        wb = MagicMock()
        ws = MagicMock()
        wb.sheetnames = ["Program 23-26"]
        wb.__getitem__ = MagicMock(return_value=ws)
        ws.iter_rows.return_value = [
            ("Date", "Attendance", "Programs", "Virtual"),   # header — skipped
            (datetime(2024, 7, 1), 1500, 67, 200),
            (datetime(2024, 8, 1), 1200, 55, 150),
        ]
        return wb

    def test_returns_correct_number_of_data_rows(self, mock_wb):
        with patch("programming_data_parser_lambda.openpyxl.load_workbook", return_value=mock_wb):
            result = parse_workbook(b"fake")
        assert len(result["data"]) == 2

    def test_attendance_values(self, mock_wb):
        with patch("programming_data_parser_lambda.openpyxl.load_workbook", return_value=mock_wb):
            result = parse_workbook(b"fake")
        assert result["attendance"] == [1500, 1200]

    def test_programs_values(self, mock_wb):
        with patch("programming_data_parser_lambda.openpyxl.load_workbook", return_value=mock_wb):
            result = parse_workbook(b"fake")
        assert result["programs"] == [67, 55]

    def test_date_field_format(self, mock_wb):
        with patch("programming_data_parser_lambda.openpyxl.load_workbook", return_value=mock_wb):
            result = parse_workbook(b"fake")
        assert result["data"][0]["date"] == "2024-07-01"

    def test_year_month_data_is_populated(self, mock_wb):
        with patch("programming_data_parser_lambda.openpyxl.load_workbook", return_value=mock_wb):
            result = parse_workbook(b"fake")
        assert len(result["year_month_data"]) == 2
        assert result["year_month_data"][0]["year_month"] == "2024-07"

    def test_year_month_data_contains_attendance_and_programs(self, mock_wb):
        with patch("programming_data_parser_lambda.openpyxl.load_workbook", return_value=mock_wb):
            result = parse_workbook(b"fake")
        record = result["year_month_data"][0]
        assert record["attendance"] == 1500
        assert record["programs"] == 67
        assert record["virtual_attendance"] == 200

    def test_skips_rows_where_both_attendance_and_programs_are_zero(self):
        wb = MagicMock()
        ws = MagicMock()
        wb.sheetnames = ["Program 23-26"]
        wb.__getitem__ = MagicMock(return_value=ws)
        ws.iter_rows.return_value = [
            ("Date", "Attendance", "Programs"),
            (datetime(2024, 7, 1), 0, 0),
            (datetime(2024, 8, 1), 1200, 55),
        ]
        with patch("programming_data_parser_lambda.openpyxl.load_workbook", return_value=wb):
            result = parse_workbook(b"fake")
        assert len(result["data"]) == 1

    def test_no_matching_sheet_returns_empty_result(self):
        wb = MagicMock()
        wb.sheetnames = ["Summary", "Random"]
        with patch("programming_data_parser_lambda.openpyxl.load_workbook", return_value=wb):
            result = parse_workbook(b"fake")
        assert result["data"] == []
        assert result["year_month_data"] == []


# ── TestWriteProgrammingDataToDynamoDB ────────────────────────────────────────


class TestWriteProgrammingDataToDynamoDB:
    @pytest.fixture(autouse=True)
    def setup(self, mock_dynamodb, monkeypatch):
        monkeypatch.setenv("DYNAMODB_TABLE", "test-table")
        monkeypatch.setenv("DYNAMODB_METADATA_TABLE", "test-meta-table")
        self.table, self.batch = _mock_table(mock_dynamodb)

    def _records(self, count=1):
        return [
            {"year_month": f"2024-{7 + i:02d}", "attendance": 1500, "programs": 67, "virtual_attendance": 200}
            for i in range(count)
        ]

    def test_returns_true_on_success(self):
        assert write_programming_data_to_dynamodb("IMG", "Imaginon", self._records(), "test.xlsx") is True

    def test_calls_put_item_for_each_record(self):
        write_programming_data_to_dynamodb("IMG", "Imaginon", self._records(3), "test.xlsx")
        assert self.batch.put_item.call_count == 3

    def test_item_contains_branch_code(self):
        write_programming_data_to_dynamodb("IMG", "Imaginon", self._records(), "test.xlsx")
        item = self.batch.put_item.call_args.kwargs["Item"]
        assert item["branch_code"] == "IMG"
        assert item["branch_name"] == "Imaginon"

    def test_item_year_month_matches_record(self):
        write_programming_data_to_dynamodb("IMG", "Imaginon", self._records(), "test.xlsx")
        item = self.batch.put_item.call_args.kwargs["Item"]
        assert item["year_month"] == "2024-07"

    def test_gsi_key_duplicates_year_month(self):
        write_programming_data_to_dynamodb("IMG", "Imaginon", self._records(), "test.xlsx")
        item = self.batch.put_item.call_args.kwargs["Item"]
        assert item["year_month_gsi"] == item["year_month"]

    def test_item_contains_attendance_and_programs(self):
        write_programming_data_to_dynamodb("IMG", "Imaginon", self._records(), "test.xlsx")
        item = self.batch.put_item.call_args.kwargs["Item"]
        assert item["attendance"] == 1500
        assert item["programs"] == 67

    def test_item_contains_source_filename(self):
        write_programming_data_to_dynamodb("IMG", "Imaginon", self._records(), "IMG Stats.xlsx")
        item = self.batch.put_item.call_args.kwargs["Item"]
        assert item["data_source_file"] == "IMG Stats.xlsx"

    def test_returns_false_on_dynamodb_exception(self):
        self.table.batch_writer.side_effect = Exception("DynamoDB unavailable")
        result = write_programming_data_to_dynamodb("IMG", "Imaginon", self._records(), "test.xlsx")
        assert result is False


# ── TestUpdateBranchMetadata ──────────────────────────────────────────────────


class TestUpdateBranchMetadata:
    @pytest.fixture(autouse=True)
    def setup(self, mock_dynamodb, monkeypatch):
        monkeypatch.setenv("DYNAMODB_METADATA_TABLE", "test-meta-table")
        self.table, _ = _mock_table(mock_dynamodb)

    def test_returns_true_on_success(self):
        assert update_branch_metadata("IMG", "Imaginon") is True

    def test_calls_update_item_with_correct_key(self):
        update_branch_metadata("IMG", "Imaginon")
        kwargs = self.table.update_item.call_args.kwargs
        assert kwargs["Key"] == {"branch_code": "IMG"}

    def test_sets_branch_name(self):
        update_branch_metadata("MAI", "Main")
        kwargs = self.table.update_item.call_args.kwargs
        assert kwargs["ExpressionAttributeValues"][":name"] == "Main"

    def test_returns_false_on_exception(self):
        self.table.update_item.side_effect = Exception("error")
        assert update_branch_metadata("IMG", "Imaginon") is False


# ── TestHandleS3Event ─────────────────────────────────────────────────────────


class TestHandleS3Event:
    @pytest.fixture(autouse=True)
    def setup(self, mock_s3, mock_dynamodb, monkeypatch):
        monkeypatch.setenv("PROCESSED_BUCKET", "proc-bucket")
        monkeypatch.setenv("DYNAMODB_TABLE", "test-table")
        monkeypatch.setenv("DYNAMODB_METADATA_TABLE", "test-meta-table")
        mock_s3.get_object.return_value = _s3_body(b"fake xlsx bytes")
        mock_s3.put_object.return_value = {}
        _mock_table(mock_dynamodb)

    def _event(self, filename="IMG Monthly Stats.xlsx", bucket="source-bucket"):
        return _s3_event(bucket, f"uploads/programming/{filename}")

    def test_successful_processing_returns_200(self, mock_s3):
        with patch("programming_data_parser_lambda.parse_workbook", return_value=PARSED_DATA):
            resp = handle_s3_event(self._event())
        assert resp["statusCode"] == 200

    def test_writes_processed_json_to_s3(self, mock_s3):
        with patch("programming_data_parser_lambda.parse_workbook", return_value=PARSED_DATA):
            handle_s3_event(self._event())
        kwargs = mock_s3.put_object.call_args.kwargs
        assert kwargs["Key"] == "processed/programming/IMG.json"
        assert kwargs["ContentType"] == "application/json"

    def test_written_json_contains_branch_info(self, mock_s3):
        with patch("programming_data_parser_lambda.parse_workbook", return_value=PARSED_DATA):
            handle_s3_event(self._event())
        body = json.loads(mock_s3.put_object.call_args.kwargs["Body"])
        assert body["branch"] == "IMG"
        assert body["branchName"] == "Imaginon"
        assert body["dataFound"] is True

    def test_uses_processed_bucket_env(self, mock_s3):
        with patch("programming_data_parser_lambda.parse_workbook", return_value=PARSED_DATA):
            handle_s3_event(self._event(bucket="source-bucket"))
        assert mock_s3.put_object.call_args.kwargs["Bucket"] == "proc-bucket"

    def test_response_body_contains_dynamodb_success_flag(self, mock_s3):
        with patch("programming_data_parser_lambda.parse_workbook", return_value=PARSED_DATA):
            resp = handle_s3_event(self._event())
        body = json.loads(resp["body"])
        assert "dynamodbSuccess" in body

    def test_invalid_filename_without_branch_code_returns_400(self, mock_s3):
        resp = handle_s3_event(_s3_event("bucket", "uploads/programming/Monthly Stats.xlsx"))
        assert resp["statusCode"] == 400

    def test_empty_workbook_data_returns_400(self, mock_s3):
        empty = {"data": [], "months": [], "attendance": [], "programs": [], "year_month_data": []}
        with patch("programming_data_parser_lambda.parse_workbook", return_value=empty):
            resp = handle_s3_event(self._event())
        assert resp["statusCode"] == 400

    def test_dynamodb_failure_does_not_prevent_s3_write(self, mock_s3, mock_dynamodb):
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.batch_writer.side_effect = Exception("DynamoDB down")
        with patch("programming_data_parser_lambda.parse_workbook", return_value=PARSED_DATA):
            resp = handle_s3_event(self._event())
        assert resp["statusCode"] == 200
        assert mock_s3.put_object.called


# ── TestHandleApiRequest ──────────────────────────────────────────────────────


class TestHandleApiRequest:
    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch):
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
        assert json.loads(resp["body"])["data"]["dataFound"] is False

    def test_response_has_cors_headers(self, mock_s3):
        mock_s3.get_object.return_value = _s3_body(json.dumps(BRANCH_PAYLOAD).encode())
        resp = handle_api_request(_api_event("IMG"))
        assert resp["headers"]["Access-Control-Allow-Origin"] == "*"


# ── TestLambdaHandler ─────────────────────────────────────────────────────────


class TestLambdaHandler:
    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch, mock_dynamodb):
        monkeypatch.setenv("PROCESSED_BUCKET", "test-bucket")
        monkeypatch.setenv("DYNAMODB_TABLE", "test-table")
        monkeypatch.setenv("DYNAMODB_METADATA_TABLE", "test-meta-table")
        _mock_table(mock_dynamodb)

    def test_routes_records_event_to_s3_handler(self, mock_s3):
        mock_s3.get_object.return_value = _s3_body(b"fake xlsx")
        mock_s3.put_object.return_value = {}
        with patch("programming_data_parser_lambda.parse_workbook", return_value=PARSED_DATA):
            resp = lambda_handler(_s3_event("bucket", "uploads/programming/IMG Monthly.xlsx"), None)
        assert resp["statusCode"] == 200

    def test_routes_api_event_to_api_handler(self, mock_s3):
        mock_s3.get_object.return_value = _s3_body(json.dumps(BRANCH_PAYLOAD).encode())
        resp = lambda_handler(_api_event("IMG"), None)
        assert resp["statusCode"] == 200
