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
    _extract_branch_code_from_name,
    _get_branch_name,
    _date_to_year_month,
    _month_year_to_display,
    _find_data_sheet,
    parse_workbook,
    parse_pdf_report,
    write_programming_data_to_dynamodb,
    write_pdf_data_to_dynamodb,
    update_branch_metadata,
    handle_s3_event,
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


# ── TestExtractBranchCodeFromName ─────────────────────────────────────────────


class TestExtractBranchCodeFromName:
    def test_spangler_maps_to_spa(self):
        assert _extract_branch_code_from_name("Spangler_In-House_Programs_April_2026.pdf") == "SPA"

    def test_imaginon_maps_to_img(self):
        assert _extract_branch_code_from_name("Imaginon_Outreach_Programs_March_2026.pdf") == "IMG"

    def test_allegra_westbrooks_maps_to_alw(self):
        assert _extract_branch_code_from_name("Allegra_Westbrooks_In-House_2026.pdf") == "ALW"

    def test_north_county_preferred_over_bare_north(self):
        # "north county" is a longer key and must match before "north" alone
        assert _extract_branch_code_from_name("North_County_Regional_Outreach_2026.pdf") == "NCR"

    def test_case_insensitive(self):
        assert _extract_branch_code_from_name("SPANGLER_IN-HOUSE.pdf") == "SPA"

    def test_returns_none_for_unknown_branch(self):
        assert _extract_branch_code_from_name("Unknown_Branch_2026.pdf") is None


# ── TestParsePdfReport ────────────────────────────────────────────────────────

PDF_TEXT_IN_HOUSE = (
    "JM Spangler In-House Programs\n"
    "Primary Facilitator  Program Name  Date\n"
    "Grand Summary: 69 4389\n"
    "Filter Criteria Applied:\n"
    "Program Date: Apr 2026(Included)\n"
)

PDF_TEXT_OUTREACH = (
    "JM Spangler Outreach Programs\n"
    "Primary Facilitator  Outreach Site  Program Name  Date\n"
    "Grand Summary: 23 529\n"
    "Filter Criteria Applied:\n"
    "Program Date: Apr 2026(Included)\n"
)


def _mock_pdf(text: str, table_rows=None):
    """
    Build a minimal pdfplumber mock.

    pdfplumber.extract_tables() returns list[table] where each table is list[row]
    and each row is list[cell]. Supply table_rows as a single row (list of cells)
    and this wraps it in the correct [[row]] structure.
    """
    page = MagicMock()
    page.extract_text.return_value = text
    # [[table_rows]] = one table containing one row
    page.extract_tables.return_value = [[table_rows]] if table_rows else []
    pdf = MagicMock()
    pdf.__enter__ = MagicMock(return_value=pdf)
    pdf.__exit__ = MagicMock(return_value=False)
    pdf.pages = [page]
    return pdf


class TestParsePdfReport:
    def test_extracts_year_month_from_filter_line(self):
        with patch("programming_data_parser_lambda.pdfplumber.open", return_value=_mock_pdf(PDF_TEXT_IN_HOUSE)):
            result = parse_pdf_report(b"fake")
        assert result["year_month"] == "2026-04"

    def test_detects_in_house_report(self):
        with patch("programming_data_parser_lambda.pdfplumber.open", return_value=_mock_pdf(PDF_TEXT_IN_HOUSE)):
            result = parse_pdf_report(b"fake")
        assert result["is_outreach"] is False

    def test_detects_outreach_report(self):
        with patch("programming_data_parser_lambda.pdfplumber.open", return_value=_mock_pdf(PDF_TEXT_OUTREACH)):
            result = parse_pdf_report(b"fake")
        assert result["is_outreach"] is True

    def test_extracts_programs_from_text_fallback(self):
        with patch("programming_data_parser_lambda.pdfplumber.open", return_value=_mock_pdf(PDF_TEXT_IN_HOUSE)):
            result = parse_pdf_report(b"fake")
        assert result["programs"] == 69

    def test_extracts_attendance_from_text_fallback(self):
        with patch("programming_data_parser_lambda.pdfplumber.open", return_value=_mock_pdf(PDF_TEXT_IN_HOUSE)):
            result = parse_pdf_report(b"fake")
        assert result["attendance"] == 4389

    def test_extracts_from_table_row_when_present(self):
        table_row = ["Grand Summary:", "", "69", "4389"]
        mock_pdf = _mock_pdf(
            "JM Spangler In-House Programs\nProgram Date: Apr 2026(Included)\n",
            table_rows=table_row,
        )
        with patch("programming_data_parser_lambda.pdfplumber.open", return_value=mock_pdf):
            result = parse_pdf_report(b"fake")
        assert result["programs"] == 69
        assert result["attendance"] == 4389

    def test_returns_none_when_month_not_found(self):
        text = "JM Spangler In-House Programs\nGrand Summary: 10 100\n"
        with patch("programming_data_parser_lambda.pdfplumber.open", return_value=_mock_pdf(text)):
            result = parse_pdf_report(b"fake")
        assert result is None

    def test_returns_none_on_exception(self):
        with patch("programming_data_parser_lambda.pdfplumber.open", side_effect=Exception("parse error")):
            result = parse_pdf_report(b"fake")
        assert result is None


# ── TestWritePdfDataToDynamoDB ────────────────────────────────────────────────


class TestWritePdfDataToDynamoDB:
    @pytest.fixture(autouse=True)
    def setup(self, mock_dynamodb, monkeypatch):
        monkeypatch.setenv("DYNAMODB_TABLE", "test-table")
        monkeypatch.setenv("DYNAMODB_METADATA_TABLE", "test-meta-table")
        self.table, _ = _mock_table(mock_dynamodb)

    def _in_house_data(self):
        return {"year_month": "2026-04", "programs": 69, "attendance": 4389, "is_outreach": False}

    def _outreach_data(self):
        return {"year_month": "2026-04", "programs": 23, "attendance": 529, "is_outreach": True}

    def test_returns_true_on_success(self):
        assert write_pdf_data_to_dynamodb("SPA", "Spangler", self._in_house_data(), "test.pdf") is True

    def test_in_house_sets_attendance_and_programs(self):
        write_pdf_data_to_dynamodb("SPA", "Spangler", self._in_house_data(), "test.pdf")
        # call_args_list[0] is the data write; call_args_list[1] is update_branch_metadata
        kwargs = self.table.update_item.call_args_list[0].kwargs
        assert ":a" in kwargs["ExpressionAttributeValues"]
        assert kwargs["ExpressionAttributeValues"][":a"] == 4389
        assert kwargs["ExpressionAttributeValues"][":p"] == 69

    def test_outreach_sets_outreach_fields(self):
        write_pdf_data_to_dynamodb("SPA", "Spangler", self._outreach_data(), "outreach.pdf")
        kwargs = self.table.update_item.call_args_list[0].kwargs
        expr = kwargs["UpdateExpression"]
        assert "outreach_attendance" in expr
        assert "outreach_programs" in expr

    def test_uses_update_item_not_put_item(self):
        write_pdf_data_to_dynamodb("SPA", "Spangler", self._in_house_data(), "test.pdf")
        assert self.table.update_item.called
        assert not self.table.put_item.called

    def test_key_contains_branch_code_and_year_month(self):
        write_pdf_data_to_dynamodb("SPA", "Spangler", self._in_house_data(), "test.pdf")
        key = self.table.update_item.call_args_list[0].kwargs["Key"]
        assert key == {"branch_code": "SPA", "year_month": "2026-04"}

    def test_returns_false_on_exception(self):
        self.table.update_item.side_effect = Exception("DynamoDB error")
        result = write_pdf_data_to_dynamodb("SPA", "Spangler", self._in_house_data(), "test.pdf")
        assert result is False


# ── TestHandleS3Event (PDF path) ──────────────────────────────────────────────


class TestHandleS3EventPdf:
    @pytest.fixture(autouse=True)
    def setup(self, mock_s3, mock_dynamodb, monkeypatch):
        monkeypatch.setenv("PROCESSED_BUCKET", "proc-bucket")
        monkeypatch.setenv("DYNAMODB_TABLE", "test-table")
        monkeypatch.setenv("DYNAMODB_METADATA_TABLE", "test-meta-table")
        mock_s3.get_object.return_value = _s3_body(b"fake pdf bytes")
        _mock_table(mock_dynamodb)

    PDF_DATA = {"year_month": "2026-04", "programs": 69, "attendance": 4389, "is_outreach": False}

    def test_pdf_returns_200(self):
        with patch("programming_data_parser_lambda.parse_pdf_report", return_value=self.PDF_DATA):
            resp = handle_s3_event(_s3_event("bucket", "uploads/programming/Spangler_In-House_Programs_April_2026.pdf"))
        assert resp["statusCode"] == 200

    def test_pdf_response_contains_year_month(self):
        with patch("programming_data_parser_lambda.parse_pdf_report", return_value=self.PDF_DATA):
            resp = handle_s3_event(_s3_event("bucket", "uploads/programming/Spangler_In-House_Programs_April_2026.pdf"))
        body = json.loads(resp["body"])
        assert body["yearMonth"] == "2026-04"

    def test_pdf_unknown_branch_returns_400(self):
        resp = handle_s3_event(_s3_event("bucket", "uploads/programming/Unknown_In-House_2026.pdf"))
        assert resp["statusCode"] == 400

    def test_pdf_parse_failure_returns_400(self):
        with patch("programming_data_parser_lambda.parse_pdf_report", return_value=None):
            resp = handle_s3_event(_s3_event("bucket", "uploads/programming/Spangler_In-House_2026.pdf"))
        assert resp["statusCode"] == 400


# ── TestLambdaHandler ─────────────────────────────────────────────────────────


class TestLambdaHandler:
    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch, mock_dynamodb):
        monkeypatch.setenv("PROCESSED_BUCKET", "test-bucket")
        monkeypatch.setenv("DYNAMODB_TABLE", "test-table")
        monkeypatch.setenv("DYNAMODB_METADATA_TABLE", "test-meta-table")
        _mock_table(mock_dynamodb)

    def test_routes_s3_xlsx_event(self, mock_s3):
        mock_s3.get_object.return_value = _s3_body(b"fake xlsx")
        mock_s3.put_object.return_value = {}
        with patch("programming_data_parser_lambda.parse_workbook", return_value=PARSED_DATA):
            resp = lambda_handler(_s3_event("bucket", "uploads/programming/IMG Monthly.xlsx"), None)
        assert resp["statusCode"] == 200

    def test_routes_s3_pdf_event(self, mock_s3):
        mock_s3.get_object.return_value = _s3_body(b"fake pdf")
        pdf_data = {"year_month": "2026-04", "programs": 69, "attendance": 4389, "is_outreach": False}
        with patch("programming_data_parser_lambda.parse_pdf_report", return_value=pdf_data):
            resp = lambda_handler(_s3_event("bucket", "uploads/programming/Spangler_In-House_2026.pdf"), None)
        assert resp["statusCode"] == 200
