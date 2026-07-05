"""
Tests for the time series Lambda handler.

Run:  pytest tests/ -v
"""

import json
import pytest
from unittest.mock import patch

from lambda_handler import handler


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

