"""
Tests for programming_history_api_lambda.py

Run:  pytest tests/ -v
"""

import json
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch

from programming_history_api_lambda import (
    _get_branch_name,
    _convert_decimal,
    get_branch_history,
    compare_branches,
    lambda_handler,
)

# ── Shared fixtures & helpers ─────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def mock_dynamodb():
    with patch("programming_history_api_lambda.dynamodb") as mock:
        yield mock


def _make_table(mock_dynamodb, items=None):
    table = MagicMock()
    mock_dynamodb.Table.return_value = table
    table.query.return_value = {"Items": items or []}
    return table


def _dynamo_item(branch="IMG", year_month="2024-07", attendance=1500, programs=67, virtual=200):
    return {
        "branch_code": branch,
        "year_month": year_month,
        "attendance": attendance,
        "programs": programs,
        "virtual_attendance": virtual,
    }


def _history_event(branch="IMG", months=None):
    params = {"branch": branch}
    if months is not None:
        params["months"] = str(months)
    return {"httpMethod": "GET", "path": "/programming/history", "queryStringParameters": params}


def _compare_event(branches="IMG,MAI", month=None):
    params = {"branches": branches}
    if month:
        params["month"] = month
    return {"httpMethod": "GET", "path": "/programming/compare", "queryStringParameters": params}


# ── TestGetBranchName ─────────────────────────────────────────────────────────


class TestGetBranchName:
    def test_img_returns_imaginon(self):
        assert _get_branch_name("IMG") == "Imaginon"

    def test_mai_returns_main(self):
        assert _get_branch_name("MAI") == "Main"

    def test_unknown_code_returns_code_itself(self):
        assert _get_branch_name("XYZ") == "XYZ"


# ── TestConvertDecimal ────────────────────────────────────────────────────────


class TestConvertDecimal:
    def test_whole_decimal_converts_to_int(self):
        assert _convert_decimal(Decimal("42")) == 42
        assert isinstance(_convert_decimal(Decimal("42")), int)

    def test_fractional_decimal_converts_to_float(self):
        assert _convert_decimal(Decimal("3.14")) == pytest.approx(3.14)
        assert isinstance(_convert_decimal(Decimal("3.14")), float)

    def test_zero_converts_to_int(self):
        assert _convert_decimal(Decimal("0")) == 0
        assert isinstance(_convert_decimal(Decimal("0")), int)

    def test_non_decimal_raises_type_error(self):
        with pytest.raises(TypeError):
            _convert_decimal("not a decimal")

    def test_usable_as_json_default(self):
        data = {"attendance": Decimal("1500"), "ratio": Decimal("1.5")}
        result = json.loads(json.dumps(data, default=_convert_decimal))
        assert result["attendance"] == 1500
        assert result["ratio"] == pytest.approx(1.5)


# ── TestGetBranchHistory ──────────────────────────────────────────────────────


class TestGetBranchHistory:
    @pytest.fixture(autouse=True)
    def setup(self, mock_dynamodb, monkeypatch):
        monkeypatch.setenv("DYNAMODB_TABLE", "test-table")
        self.table = _make_table(mock_dynamodb)

    def test_returns_data_found_true_when_items_exist(self):
        self.table.query.return_value = {"Items": [_dynamo_item()]}
        result = get_branch_history("IMG")
        assert result["dataFound"] is True

    def test_returns_data_found_false_when_no_items(self):
        self.table.query.return_value = {"Items": []}
        result = get_branch_history("IMG")
        assert result["dataFound"] is False
        assert result["branch"] == "IMG"

    def test_branch_name_is_resolved(self):
        self.table.query.return_value = {"Items": [_dynamo_item()]}
        result = get_branch_history("IMG")
        assert result["branchName"] == "Imaginon"

    def test_data_list_contains_correct_fields(self):
        self.table.query.return_value = {"Items": [_dynamo_item(year_month="2024-07", attendance=1500, programs=67)]}
        result = get_branch_history("IMG")
        record = result["data"][0]
        assert record["year_month"] == "2024-07"
        assert record["attendance"] == 1500
        assert record["programs"] == 67
        assert record["date"] == "2024-07-01"

    def test_data_is_sorted_newest_first(self):
        items = [
            _dynamo_item(year_month="2024-07"),
            _dynamo_item(year_month="2024-09"),
            _dynamo_item(year_month="2024-08"),
        ]
        self.table.query.return_value = {"Items": items}
        result = get_branch_history("IMG")
        months = [r["year_month"] for r in result["data"]]
        assert months == sorted(months, reverse=True)

    def test_metrics_are_calculated(self):
        items = [
            _dynamo_item(year_month="2024-08", attendance=2000, programs=80),
            _dynamo_item(year_month="2024-07", attendance=1000, programs=40),
        ]
        self.table.query.return_value = {"Items": items}
        result = get_branch_history("IMG")
        assert result["metrics"]["totalAttendance"] == 3000
        assert result["metrics"]["totalPrograms"] == 120
        assert result["metrics"]["averageMonthlyAttendance"] == 1500

    def test_growth_percent_is_calculated(self):
        # newest first after sort: 2024-08 (2000), 2024-07 (1000)
        # oldest=1000, newest=2000 → 100% growth
        items = [
            _dynamo_item(year_month="2024-08", attendance=2000, programs=80),
            _dynamo_item(year_month="2024-07", attendance=1000, programs=40),
        ]
        self.table.query.return_value = {"Items": items}
        result = get_branch_history("IMG")
        assert result["metrics"]["growthPercent"] == pytest.approx(100.0)

    def test_growth_is_none_with_single_data_point(self):
        self.table.query.return_value = {"Items": [_dynamo_item()]}
        result = get_branch_history("IMG")
        assert result["metrics"]["growthPercent"] is None

    def test_passes_limit_to_query(self):
        self.table.query.return_value = {"Items": []}
        get_branch_history("IMG", months=6)
        kwargs = self.table.query.call_args.kwargs
        assert kwargs["Limit"] == 6

    def test_returns_none_on_exception(self):
        self.table.query.side_effect = Exception("DynamoDB error")
        assert get_branch_history("IMG") is None


# ── TestCompareBranches ───────────────────────────────────────────────────────


class TestCompareBranches:
    @pytest.fixture(autouse=True)
    def setup(self, mock_dynamodb, monkeypatch):
        monkeypatch.setenv("DYNAMODB_TABLE", "test-table")
        self.table = _make_table(mock_dynamodb)

    def test_returns_success_true(self):
        self.table.query.return_value = {"Items": [_dynamo_item()]}
        result = compare_branches(["IMG"])
        assert result["success"] is True

    def test_includes_all_requested_branches(self):
        self.table.query.return_value = {"Items": [_dynamo_item()]}
        result = compare_branches(["IMG", "MAI"])
        assert "IMG" in result["comparison"]["branches"]
        assert "MAI" in result["comparison"]["branches"]

    def test_branch_entry_contains_required_fields(self):
        self.table.query.return_value = {"Items": [_dynamo_item(attendance=1500, programs=67)]}
        result = compare_branches(["IMG"])
        branch = result["comparison"]["branches"]["IMG"]
        assert branch["attendance"] == 1500
        assert branch["programs"] == 67
        assert branch["branchName"] == "Imaginon"

    def test_comparison_metrics_are_calculated(self):
        def query_side_effect(**kwargs):
            code = kwargs["ExpressionAttributeValues"][":code"]
            return {"Items": [_dynamo_item(branch=code, attendance=2000 if code == "IMG" else 1000, programs=80)]}
        self.table.query.side_effect = query_side_effect
        result = compare_branches(["IMG", "MAI"])
        comp = result["comparison"]["comparison"]
        assert comp["highestAttendance"] == 2000
        assert comp["lowestAttendance"] == 1000
        assert comp["averageAttendance"] == 1500

    def test_specific_month_is_queried_when_provided(self):
        self.table.query.return_value = {"Items": [_dynamo_item(year_month="2026-05")]}
        compare_branches(["IMG"], year_month="2026-05")
        kwargs = self.table.query.call_args.kwargs
        assert ":month" in kwargs["ExpressionAttributeValues"]
        assert kwargs["ExpressionAttributeValues"][":month"] == "2026-05"

    def test_latest_month_queried_when_no_month_provided(self):
        self.table.query.return_value = {"Items": [_dynamo_item()]}
        compare_branches(["IMG"])
        kwargs = self.table.query.call_args.kwargs
        assert kwargs.get("Limit") == 1
        assert kwargs.get("ScanIndexForward") is False

    def test_empty_comparison_when_no_items_found(self):
        self.table.query.return_value = {"Items": []}
        result = compare_branches(["IMG", "MAI"])
        assert result["comparison"]["branches"] == {}
        assert result["comparison"]["comparison"] == {}

    def test_returns_none_on_exception(self):
        self.table.query.side_effect = Exception("error")
        assert compare_branches(["IMG"]) is None


# ── TestLambdaHandler ─────────────────────────────────────────────────────────


class TestLambdaHandler:
    @pytest.fixture(autouse=True)
    def setup(self, mock_dynamodb, monkeypatch):
        monkeypatch.setenv("DYNAMODB_TABLE", "test-table")
        self.table = _make_table(mock_dynamodb, items=[_dynamo_item()])

    def test_options_returns_200(self):
        resp = lambda_handler({"httpMethod": "OPTIONS", "path": "/programming/history", "queryStringParameters": {}}, None)
        assert resp["statusCode"] == 200

    def test_options_response_has_cors_headers(self):
        resp = lambda_handler({"httpMethod": "OPTIONS", "path": "/programming/history", "queryStringParameters": {}}, None)
        assert "Access-Control-Allow-Origin" in resp["headers"]

    def test_routes_history_path_to_get_branch_history(self):
        with patch("programming_history_api_lambda.get_branch_history") as mock_fn:
            mock_fn.return_value = {"branch": "IMG", "data": [], "dataFound": False}
            lambda_handler(_history_event("IMG"), None)
        mock_fn.assert_called_once_with("IMG", 12)

    def test_history_respects_months_parameter(self):
        with patch("programming_history_api_lambda.get_branch_history") as mock_fn:
            mock_fn.return_value = {"branch": "IMG", "data": [], "dataFound": False}
            lambda_handler(_history_event("IMG", months=6), None)
        mock_fn.assert_called_once_with("IMG", 6)

    def test_routes_compare_path_to_compare_branches(self):
        with patch("programming_history_api_lambda.compare_branches") as mock_fn:
            mock_fn.return_value = {"success": True, "comparison": {}}
            lambda_handler(_compare_event("IMG,MAI"), None)
        mock_fn.assert_called_once_with(["IMG", "MAI"], None)

    def test_compare_passes_month_parameter(self):
        with patch("programming_history_api_lambda.compare_branches") as mock_fn:
            mock_fn.return_value = {"success": True, "comparison": {}}
            lambda_handler(_compare_event("IMG,MAI", month="2026-05"), None)
        mock_fn.assert_called_once_with(["IMG", "MAI"], "2026-05")

    def test_history_missing_branch_returns_400(self):
        event = {"httpMethod": "GET", "path": "/programming/history", "queryStringParameters": {}}
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["error"]["code"] == "MISSING_PARAMETER"

    def test_compare_missing_branches_returns_400(self):
        event = {"httpMethod": "GET", "path": "/programming/compare", "queryStringParameters": {}}
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 400

    def test_unknown_path_returns_400(self):
        event = {"httpMethod": "GET", "path": "/programming/unknown", "queryStringParameters": {}}
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["error"]["code"] == "INVALID_PATH"

    def test_successful_history_response_has_cors_headers(self):
        with patch("programming_history_api_lambda.get_branch_history") as mock_fn:
            mock_fn.return_value = {"branch": "IMG", "data": [], "dataFound": True}
            resp = lambda_handler(_history_event("IMG"), None)
        assert resp["headers"]["Access-Control-Allow-Origin"] == "*"

    def test_internal_error_returns_500(self):
        with patch("programming_history_api_lambda.get_branch_history", return_value=None):
            resp = lambda_handler(_history_event("IMG"), None)
        assert resp["statusCode"] == 500
