"""
Tests for the time series Lambda handler.

Run:  pytest tests/ -v
"""

import json
import pytest
from unittest.mock import patch

import lambda_handler
from lambda_handler import handler, _source_signature


# ── Helpers ───────────────────────────────────────────────────────────────────

def _event(department=None):
    e = {}
    if department is not None:
        e["department"] = department
    return e


# ── Input validation ──────────────────────────────────────────────────────────

class TestHandlerValidation:
    def test_missing_department_returns_400(self):
        result = handler({}, None)
        assert result["statusCode"] == 400

    def test_empty_department_returns_400(self):
        result = handler({"department": ""}, None)
        assert result["statusCode"] == 400

    def test_missing_department_body_has_error(self):
        result = handler({}, None)
        body = json.loads(result["body"])
        assert "error" in body


# ── S3 interaction ────────────────────────────────────────────────────────────

class TestHandlerS3:
    def test_no_s3_files_returns_500(self):
        with patch("lambda_handler.list_xlsm_files", return_value=[]):
            result = handler(_event(department="Imaginon"), None)
        assert result["statusCode"] == 500

    def test_no_s3_files_body_has_error(self):
        with patch("lambda_handler.list_xlsm_files", return_value=[]):
            result = handler(_event(department="Imaginon"), None)
        body = json.loads(result["body"])
        assert "error" in body


# ── Time series cache ────────────────────────────────────────────────────────

_OBJECTS_V1 = [{"key": "circulation/FY2025.xlsm", "etag": '"abc"'}]
_OBJECTS_V2 = [{"key": "circulation/FY2026.xlsm", "etag": '"new"'}]


class TestTimeSeriesCache:
    def test_source_signature_is_order_independent(self):
        a = [{"key": "b.xlsm", "etag": '"2"'}, {"key": "a.xlsm", "etag": '"1"'}]
        b = [{"key": "a.xlsm", "etag": '"1"'}, {"key": "b.xlsm", "etag": '"2"'}]
        assert _source_signature(a) == _source_signature(b)

    def test_source_signature_changes_when_etag_changes(self):
        a = [{"key": "a.xlsm", "etag": '"1"'}]
        b = [{"key": "a.xlsm", "etag": '"2"'}]
        assert _source_signature(a) != _source_signature(b)

    def test_cache_hit_skips_recompute(self):
        signature = _source_signature(_OBJECTS_V1)
        cached_payload = {"department": "Imaginon", "cached": True}
        cache = {"sourceSignature": signature, "departments": {"Imaginon": cached_payload}}

        with patch("lambda_handler.BUCKET", "test-bucket"), \
             patch("lambda_handler.list_xlsm_objects", return_value=_OBJECTS_V1), \
             patch("lambda_handler._read_cache", return_value=cache), \
             patch("lambda_handler.compute_time_series") as mock_compute:
            result = handler(_event(department="Imaginon"), None)

        mock_compute.assert_not_called()
        body = json.loads(result["body"])
        assert body["data"] == cached_payload

    def test_cache_miss_computes_and_writes(self):
        payload = {"department": "Imaginon", "cached": False}

        with patch("lambda_handler.BUCKET", "test-bucket"), \
             patch("lambda_handler.list_xlsm_objects", return_value=_OBJECTS_V1), \
             patch("lambda_handler._read_cache", return_value={}), \
             patch("lambda_handler._write_cache") as mock_write, \
             patch("lambda_handler.compute_time_series", return_value={}), \
             patch("lambda_handler.build_json_payload", return_value=payload):
            result = handler(_event(department="Imaginon"), None)

        assert result["statusCode"] == 200
        mock_write.assert_called_once()
        written_bucket, written_key, written_cache = mock_write.call_args[0]
        assert written_bucket == "test-bucket"
        assert written_cache["sourceSignature"] == _source_signature(_OBJECTS_V1)
        assert written_cache["departments"]["Imaginon"] == payload

    def test_new_upload_invalidates_other_cached_departments(self):
        stale_cache = {
            "sourceSignature": _source_signature(_OBJECTS_V1),
            "departments": {"OtherBranch": {"stale": True}},
        }
        payload = {"department": "Imaginon", "cached": False}

        with patch("lambda_handler.BUCKET", "test-bucket"), \
             patch("lambda_handler.list_xlsm_objects", return_value=_OBJECTS_V2), \
             patch("lambda_handler._read_cache", return_value=stale_cache), \
             patch("lambda_handler._write_cache") as mock_write, \
             patch("lambda_handler.compute_time_series", return_value={}), \
             patch("lambda_handler.build_json_payload", return_value=payload):
            handler(_event(department="Imaginon"), None)

        written_cache = mock_write.call_args[0][2]
        assert "OtherBranch" not in written_cache["departments"]
        assert written_cache["departments"]["Imaginon"] == payload
        assert written_cache["sourceSignature"] == _source_signature(_OBJECTS_V2)

