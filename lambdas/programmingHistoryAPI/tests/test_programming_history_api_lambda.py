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
    get_sessions,
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
        # Use MAI (no departments) so one query returns exactly one item
        self.table.query.return_value = {"Items": [_dynamo_item(year_month="2024-07", attendance=1500, programs=67)]}
        result = get_branch_history("MAI")
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
        result = get_branch_history("MAI")
        months = [r["year_month"] for r in result["data"]]
        assert months == sorted(months, reverse=True)

    def test_metrics_are_calculated(self):
        items = [
            _dynamo_item(year_month="2024-08", attendance=2000, programs=80),
            _dynamo_item(year_month="2024-07", attendance=1000, programs=40),
        ]
        self.table.query.return_value = {"Items": items}
        result = get_branch_history("MAI")
        assert result["metrics"]["totalAttendance"] == 3000
        assert result["metrics"]["totalPrograms"] == 120
        assert result["metrics"]["averageMonthlyAttendance"] == 1500

    def test_growth_percent_is_calculated(self):
        items = [
            _dynamo_item(year_month="2024-08", attendance=2000, programs=80),
            _dynamo_item(year_month="2024-07", attendance=1000, programs=40),
        ]
        self.table.query.return_value = {"Items": items}
        result = get_branch_history("MAI")
        assert result["metrics"]["growthPercent"] == pytest.approx(100.0)

    def test_growth_is_none_with_single_data_point(self):
        self.table.query.return_value = {"Items": [_dynamo_item()]}
        result = get_branch_history("MAI")
        assert result["metrics"]["growthPercent"] is None

    def test_passes_limit_to_each_query(self):
        self.table.query.return_value = {"Items": []}
        get_branch_history("MAI", months=6)
        # MAI has no departments so only one query is made
        assert self.table.query.call_args.kwargs["Limit"] == 6

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



# ── TestGetBranchHistoryAggregation ──────────────────────────────────────────


class TestGetBranchHistoryAggregation:
    """
    Imaginon (IMG) aggregates Spangler (SPA) and Teen Loft (TEL).
    Each department uploads its own PDF independently; this suite verifies
    that get_branch_history("IMG") combines all three sources correctly.
    """

    @pytest.fixture(autouse=True)
    def setup(self, mock_dynamodb, monkeypatch):
        monkeypatch.setenv("DYNAMODB_TABLE", "test-table")
        self.table = _make_table(mock_dynamodb)

    def test_queries_img_spa_and_tel(self):
        self.table.query.return_value = {"Items": []}
        get_branch_history("IMG")
        called_codes = [
            call.kwargs["ExpressionAttributeValues"][":code"]
            for call in self.table.query.call_args_list
        ]
        assert set(called_codes) == {"IMG", "SPA", "TEL"}

    def test_sums_attendance_across_departments(self):
        # Spangler: 4389, Teen Loft: 500 for the same month → total 4889
        self.table.query.side_effect = [
            {"Items": []},   # IMG — no direct records
            {"Items": [_dynamo_item(year_month="2026-04", attendance=4389, programs=69)]},   # SPA
            {"Items": [_dynamo_item(year_month="2026-04", attendance=500, programs=15)]},    # TEL
        ]
        result = get_branch_history("IMG")
        assert result["dataFound"] is True
        assert result["attendance"][0] == 4889

    def test_sums_programs_across_departments(self):
        self.table.query.side_effect = [
            {"Items": []},
            {"Items": [_dynamo_item(year_month="2026-04", attendance=4389, programs=69)]},
            {"Items": [_dynamo_item(year_month="2026-04", attendance=500, programs=15)]},
        ]
        result = get_branch_history("IMG")
        assert result["programs"][0] == 84

    def test_months_from_only_one_department_still_appear(self):
        # Only SPA has data; TEL has none for this month
        self.table.query.side_effect = [
            {"Items": []},
            {"Items": [_dynamo_item(year_month="2026-03", attendance=3000, programs=50)]},
            {"Items": []},
        ]
        result = get_branch_history("IMG")
        assert "2026-03" in result["months"]
        assert result["attendance"][0] == 3000

    def test_different_months_across_departments_are_both_included(self):
        self.table.query.side_effect = [
            {"Items": []},
            {"Items": [_dynamo_item(year_month="2026-04", attendance=1000, programs=10)]},
            {"Items": [_dynamo_item(year_month="2026-03", attendance=2000, programs=20)]},
        ]
        result = get_branch_history("IMG")
        assert set(result["months"]) == {"2026-04", "2026-03"}

    def test_branch_name_is_imaginon(self):
        self.table.query.return_value = {"Items": [_dynamo_item()]}
        result = get_branch_history("IMG")
        assert result["branchName"] == "Imaginon"


# ── TestGetSessions ───────────────────────────────────────────────────────────


def _session_item(
    branch="MAI",
    program_date="2026-05-15",
    program_name="Story Time",
    facilitator="Jane Smith",
    attendance=45,
    programs=1,
    report_type="in-house",
    outreach_site="",
):
    return {
        "branch_code": branch,
        "session_key": f"{program_date}#{program_name}#{facilitator}",
        "program_date": program_date,
        "program_name": program_name,
        "primary_facilitator": facilitator,
        "branch_name": "Main",
        "total_attendance": attendance,
        "num_programs": programs,
        "report_type": report_type,
        "outreach_site": outreach_site,
    }


def _make_sessions_table(mock_dynamodb, items=None):
    table = MagicMock()
    mock_dynamodb.Table.return_value = table
    table.query.return_value = {"Items": items or []}
    return table


class TestGetSessions:
    @pytest.fixture(autouse=True)
    def setup(self, mock_dynamodb, monkeypatch):
        monkeypatch.setenv("PROGRAM_SESSIONS_TABLE", "test-sessions-table")
        self.table = _make_sessions_table(mock_dynamodb)

    def test_returns_empty_list_with_no_primary_filter(self):
        result = get_sessions()
        assert result["sessions"] == []
        assert result["count"] == 0
        assert "message" in result

    def test_queries_facilitator_index_when_facilitator_provided(self):
        self.table.query.return_value = {"Items": [_session_item()]}
        get_sessions(facilitator="Jane Smith")
        kwargs = self.table.query.call_args.kwargs
        assert kwargs["IndexName"] == "FacilitatorIndex"
        assert ":fac" in kwargs["ExpressionAttributeValues"]

    def test_queries_program_name_index_when_program_name_provided(self):
        self.table.query.return_value = {"Items": [_session_item()]}
        get_sessions(program_name="Story Time")
        kwargs = self.table.query.call_args.kwargs
        assert kwargs["IndexName"] == "ProgramNameIndex"
        assert ":pname" in kwargs["ExpressionAttributeValues"]

    def test_queries_main_table_when_only_branch_provided(self):
        self.table.query.return_value = {"Items": [_session_item()]}
        get_sessions(branch="MAI")
        kwargs = self.table.query.call_args.kwargs
        assert "IndexName" not in kwargs
        assert ":bcode" in kwargs["ExpressionAttributeValues"]

    def test_date_range_added_to_facilitator_key_condition(self):
        self.table.query.return_value = {"Items": []}
        get_sessions(facilitator="Jane Smith", date_from="2026-01-01", date_to="2026-06-30")
        kwargs = self.table.query.call_args.kwargs
        assert ":dfrom" in kwargs["ExpressionAttributeValues"]
        assert ":dto" in kwargs["ExpressionAttributeValues"]
        assert "BETWEEN" in kwargs["KeyConditionExpression"]

    def test_date_from_only_uses_gte(self):
        self.table.query.return_value = {"Items": []}
        get_sessions(facilitator="Jane Smith", date_from="2026-01-01")
        kwargs = self.table.query.call_args.kwargs
        assert ">=" in kwargs["KeyConditionExpression"]
        assert ":dfrom" in kwargs["ExpressionAttributeValues"]

    def test_branch_filter_added_as_filter_expression_for_facilitator_query(self):
        self.table.query.return_value = {"Items": []}
        get_sessions(facilitator="Jane Smith", branch="MAI")
        kwargs = self.table.query.call_args.kwargs
        assert "FilterExpression" in kwargs
        assert ":flt_branch" in kwargs["ExpressionAttributeValues"]

    def test_report_type_added_as_filter_expression(self):
        self.table.query.return_value = {"Items": []}
        get_sessions(facilitator="Jane Smith", report_type="outreach")
        kwargs = self.table.query.call_args.kwargs
        assert "FilterExpression" in kwargs
        assert ":rtype" in kwargs["ExpressionAttributeValues"]

    def test_results_contain_expected_fields(self):
        self.table.query.return_value = {"Items": [_session_item()]}
        result = get_sessions(branch="MAI")
        s = result["sessions"][0]
        assert s["program_date"] == "2026-05-15"
        assert s["program_name"] == "Story Time"
        assert s["primary_facilitator"] == "Jane Smith"
        assert s["total_attendance"] == 45
        assert s["report_type"] == "in-house"

    def test_results_sorted_newest_first(self):
        items = [
            _session_item(program_date="2026-03-01"),
            _session_item(program_date="2026-05-15"),
            _session_item(program_date="2026-01-10"),
        ]
        self.table.query.return_value = {"Items": items}
        result = get_sessions(branch="MAI")
        dates = [s["program_date"] for s in result["sessions"]]
        assert dates == sorted(dates, reverse=True)

    def test_img_branch_expands_to_departments(self):
        self.table.query.return_value = {"Items": []}
        get_sessions(branch="IMG")
        # IMG + SPA + TEL = 3 queries
        assert self.table.query.call_count == 3
        queried_codes = [
            call.kwargs["ExpressionAttributeValues"][":bcode"]
            for call in self.table.query.call_args_list
        ]
        assert set(queried_codes) == {"IMG", "SPA", "TEL"}

    def test_limit_caps_results(self):
        items = [_session_item(program_date=f"2026-0{i+1}-01") for i in range(5)]
        self.table.query.return_value = {"Items": items}
        result = get_sessions(branch="MAI", limit=3)
        assert result["count"] == 3

    def test_returns_none_on_exception(self):
        self.table.query.side_effect = Exception("DynamoDB error")
        assert get_sessions(branch="MAI") is None

    def test_filters_echoed_in_response(self):
        self.table.query.return_value = {"Items": []}
        result = get_sessions(branch="MAI", facilitator=None, date_from="2026-01-01")
        assert result["filters"]["branch"] == "MAI"
        assert result["filters"]["date_from"] == "2026-01-01"


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


# ── TestLambdaHandlerSessions ─────────────────────────────────────────────────


def _sessions_event(**params):
    return {
        "httpMethod": "GET",
        "path": "/programming/sessions",
        "queryStringParameters": {k: v for k, v in params.items() if v is not None},
    }


class TestLambdaHandlerSessions:
    @pytest.fixture(autouse=True)
    def setup(self, mock_dynamodb, monkeypatch):
        monkeypatch.setenv("DYNAMODB_TABLE", "test-table")
        monkeypatch.setenv("PROGRAM_SESSIONS_TABLE", "test-sessions-table")
        self.table = _make_table(mock_dynamodb, items=[])

    def test_routes_sessions_path_to_get_sessions(self):
        with patch("programming_history_api_lambda.get_sessions") as mock_fn:
            mock_fn.return_value = {"sessions": [], "count": 0, "filters": {}}
            lambda_handler(_sessions_event(branch="MAI"), None)
        mock_fn.assert_called_once()

    def test_sessions_uppercases_branch_code(self):
        with patch("programming_history_api_lambda.get_sessions") as mock_fn:
            mock_fn.return_value = {"sessions": [], "count": 0, "filters": {}}
            lambda_handler(_sessions_event(branch="mai"), None)
        assert mock_fn.call_args.kwargs["branch"] == "MAI"

    def test_sessions_passes_facilitator_param(self):
        with patch("programming_history_api_lambda.get_sessions") as mock_fn:
            mock_fn.return_value = {"sessions": [], "count": 0, "filters": {}}
            lambda_handler(_sessions_event(facilitator="Jane Smith"), None)
        assert mock_fn.call_args.kwargs["facilitator"] == "Jane Smith"

    def test_sessions_passes_date_params(self):
        with patch("programming_history_api_lambda.get_sessions") as mock_fn:
            mock_fn.return_value = {"sessions": [], "count": 0, "filters": {}}
            lambda_handler(_sessions_event(
                branch="MAI", date_from="2026-01-01", date_to="2026-06-30"
            ), None)
        kwargs = mock_fn.call_args.kwargs
        assert kwargs["date_from"] == "2026-01-01"
        assert kwargs["date_to"] == "2026-06-30"

    def test_sessions_returns_200_on_success(self):
        with patch("programming_history_api_lambda.get_sessions") as mock_fn:
            mock_fn.return_value = {"sessions": [], "count": 0, "filters": {}}
            resp = lambda_handler(_sessions_event(branch="MAI"), None)
        assert resp["statusCode"] == 200

    def test_sessions_returns_500_on_internal_error(self):
        with patch("programming_history_api_lambda.get_sessions", return_value=None):
            resp = lambda_handler(_sessions_event(branch="MAI"), None)
        assert resp["statusCode"] == 500
