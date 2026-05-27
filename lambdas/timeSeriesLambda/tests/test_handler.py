"""
Tests for the time series Lambda handler.

Run:  pytest tests/ -v
"""

import json
import pytest
from unittest.mock import patch

from index import handler


# ── Helpers ───────────────────────────────────────────────────────────────────

def _event(body=None):
    e = {"httpMethod": "GET", "path": "/time-series"}
    if body is not None:
        e["body"] = json.dumps(body) if isinstance(body, dict) else body
    return e


# ── Success path ──────────────────────────────────────────────────────────────

class TestHandlerSuccess:
    def test_returns_200(self):
        result = handler(_event(), None)
        assert result["statusCode"] == 200

    def test_response_has_cors_headers(self):
        result = handler(_event(), None)
        assert result["headers"]["Access-Control-Allow-Origin"] == "*"

    def test_response_body_is_valid_json(self):
        result = handler(_event(), None)
        body = json.loads(result["body"])
        assert "message" in body
        assert "timestamp" in body

    def test_passes_body_through_to_data(self):
        payload = {"metric": "checkouts", "range": "30d"}
        result = handler(_event(body=payload), None)
        body = json.loads(result["body"])
        assert body["data"] == payload

    def test_empty_body_gives_empty_data(self):
        result = handler(_event(), None)
        body = json.loads(result["body"])
        assert body["data"] == {}

    def test_timestamp_is_iso_string(self):
        result = handler(_event(), None)
        body = json.loads(result["body"])
        # Basic ISO format check — contains "T" separator
        assert "T" in body["timestamp"]


# ── Error path ────────────────────────────────────────────────────────────────

class TestHandlerError:
    def test_invalid_json_body_returns_500(self):
        result = handler(_event(body="not-valid-json"), None)
        assert result["statusCode"] == 500

    def test_error_response_has_cors_headers(self):
        result = handler(_event(body="not-valid-json"), None)
        assert result["headers"]["Access-Control-Allow-Origin"] == "*"

    def test_error_body_has_message_and_error(self):
        result = handler(_event(body="not-valid-json"), None)
        body = json.loads(result["body"])
        assert "message" in body
        assert "error" in body
