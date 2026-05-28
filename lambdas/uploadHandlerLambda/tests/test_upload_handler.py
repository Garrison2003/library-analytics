"""
Tests for the Upload Handler Lambda.

Run:  pytest tests/ -v
"""

import base64
import json
import pytest
from unittest.mock import patch
from botocore.exceptions import ClientError

import upload_handler_lambda as module
from upload_handler_lambda import (
    FILE_TYPE_CONFIG,
    _parse_multipart,
    get_file_extension,
    handle_upload,
    handle_validate,
    lambda_handler,
    validate_file,
)

# ── Multipart helpers ─────────────────────────────────────────────────────────

BOUNDARY = "testboundary123"
XLSM_MIME = "application/vnd.ms-excel.sheet.macroEnabled.12"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PDF_MIME = "application/pdf"
XLSM_BYTES = b"PK\x03\x04" + b"\x00" * 20  # Fake Excel magic bytes


def _build_multipart(*parts):
    """
    Build a multipart/form-data body.
    Each part is either:
      ("name", "string_value")                          — text field
      ("name", "filename.ext", b"content", "mime/type") — file field
    Returns (content_type_header, body_bytes).
    """
    body = b""
    for part in parts:
        if len(part) == 2:
            name, value = part
            body += (
                f"--{BOUNDARY}\r\n"
                f'Content-Disposition: form-data; name="{name}"\r\n'
                "\r\n"
            ).encode()
            body += value.encode() if isinstance(value, str) else value
            body += b"\r\n"
        else:
            name, filename, content, ct = part
            body += (
                f"--{BOUNDARY}\r\n"
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                f"Content-Type: {ct}\r\n"
                "\r\n"
            ).encode()
            body += content if isinstance(content, bytes) else content.encode()
            body += b"\r\n"
    body += f"--{BOUNDARY}--\r\n".encode()
    return f"multipart/form-data; boundary={BOUNDARY}", body


def _event(path, method, ct, body):
    """Build an API Gateway proxy event with a base64-encoded multipart body."""
    return {
        "path": path,
        "httpMethod": method,
        "headers": {"Content-Type": ct},
        "body": base64.b64encode(body).decode(),
        "isBase64Encoded": True,
    }


def _upload_event(filename, content, mime, file_type="circulation", overwrite=None):
    parts = [("file", filename, content, mime), ("fileType", file_type)]
    if overwrite is not None:
        parts.append(("overwrite", str(overwrite).lower()))
    ct, body = _build_multipart(*parts)
    return _event("/upload", "POST", ct, body)


def _validate_event(filename, content, mime, file_type=None):
    parts = [("file", filename, content, mime)]
    if file_type is not None:
        parts.append(("fileType", file_type))
    ct, body = _build_multipart(*parts)
    return _event("/upload/validate", "POST", ct, body)


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def mock_s3():
    """Patch the module-level s3 client for every test."""
    with patch("upload_handler_lambda.s3") as mock:
        # Default: file does not exist (head_object raises), put_object succeeds
        mock.head_object.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}}, "HeadObject"
        )
        mock.put_object.return_value = {"ETag": '"etag123"'}
        yield mock


@pytest.fixture()
def bucket(monkeypatch):
    """Set UPLOAD_BUCKET to a non-empty test value."""
    monkeypatch.setattr(module, "UPLOAD_BUCKET", "test-bucket")


# ── TestGetFileExtension ──────────────────────────────────────────────────────


class TestGetFileExtension:
    def test_returns_xlsm(self):
        assert get_file_extension("report.xlsm") == "xlsm"

    def test_returns_xlsx(self):
        assert get_file_extension("data.xlsx") == "xlsx"

    def test_returns_pdf(self):
        assert get_file_extension("programs.pdf") == "pdf"

    def test_lowercases_extension(self):
        assert get_file_extension("report.PDF") == "pdf"

    def test_returns_last_segment_for_multiple_dots(self):
        assert get_file_extension("my.report.2026.pdf") == "pdf"

    def test_returns_empty_for_no_extension(self):
        assert get_file_extension("filename") == ""


# ── TestValidateFile ──────────────────────────────────────────────────────────


class TestValidateFile:
    def test_valid_circulation_xlsm(self):
        ok, msg, _ = validate_file("data.xlsm", 1024, XLSM_MIME, "circulation")
        assert ok is True
        assert msg == ""

    def test_valid_circulation_xlsx(self):
        ok, msg, _ = validate_file("data.xlsx", 1024, XLSX_MIME, "circulation")
        assert ok is True
        assert msg == ""

    def test_valid_programs_pdf(self):
        ok, msg, _ = validate_file("report.pdf", 1024, PDF_MIME, "programs")
        assert ok is True
        assert msg == ""

    def test_unsupported_file_type_returns_false(self):
        ok, msg, details = validate_file("data.xlsm", 1024, XLSM_MIME, "invoices")
        assert ok is False
        assert "invoices" in msg
        assert "supportedTypes" in details

    def test_wrong_extension_for_circulation_returns_false(self):
        ok, msg, details = validate_file("report.pdf", 1024, PDF_MIME, "circulation")
        assert ok is False
        assert ".pdf" in msg
        assert details["extension"] == "pdf"
        assert "xlsm" in details["expectedExtensions"]

    def test_wrong_extension_for_programs_returns_false(self):
        ok, msg, _ = validate_file("data.xlsm", 1024, XLSM_MIME, "programs")
        assert ok is False
        assert ".xlsm" in msg

    def test_circulation_file_too_large_returns_false(self):
        max_bytes = FILE_TYPE_CONFIG["circulation"]["maxSizeBytes"]
        ok, msg, details = validate_file("data.xlsm", max_bytes + 1, XLSM_MIME, "circulation")
        assert ok is False
        assert "too large" in msg.lower()
        assert details["actualSizeBytes"] == max_bytes + 1

    def test_programs_file_too_large_returns_false(self):
        max_bytes = FILE_TYPE_CONFIG["programs"]["maxSizeBytes"]
        ok, msg, _ = validate_file("report.pdf", max_bytes + 1, PDF_MIME, "programs")
        assert ok is False
        assert "too large" in msg.lower()

    def test_at_exact_size_limit_passes(self):
        max_bytes = FILE_TYPE_CONFIG["circulation"]["maxSizeBytes"]
        ok, _, _ = validate_file("data.xlsm", max_bytes, XLSM_MIME, "circulation")
        assert ok is True

    def test_mime_mismatch_does_not_fail_validation(self):
        # Browsers sometimes send the wrong MIME type; only extension matters
        ok, _, _ = validate_file("data.xlsm", 1024, "application/octet-stream", "circulation")
        assert ok is True

    def test_no_extension_returns_false(self):
        ok, msg, _ = validate_file("datafile", 1024, XLSM_MIME, "circulation")
        assert ok is False
        assert "extension" in msg.lower()


# ── TestParseMultipart ────────────────────────────────────────────────────────


class TestParseMultipart:
    def test_parses_text_field(self):
        ct, body = _build_multipart(("fileType", "circulation"))
        event = _event("/upload", "POST", ct, body)
        fields = _parse_multipart(event)
        assert fields["fileType"]["content"] == b"circulation"

    def test_parses_file_filename(self):
        ct, body = _build_multipart(("file", "data.xlsm", XLSM_BYTES, XLSM_MIME))
        event = _event("/upload", "POST", ct, body)
        fields = _parse_multipart(event)
        assert fields["file"]["filename"] == "data.xlsm"

    def test_parses_file_content_bytes(self):
        ct, body = _build_multipart(("file", "data.xlsm", XLSM_BYTES, XLSM_MIME))
        event = _event("/upload", "POST", ct, body)
        fields = _parse_multipart(event)
        assert fields["file"]["content"] == XLSM_BYTES

    def test_preserves_arbitrary_binary_content(self):
        binary = bytes(range(256))
        ct, body = _build_multipart(("file", "data.xlsm", binary, XLSM_MIME))
        event = _event("/upload", "POST", ct, body)
        fields = _parse_multipart(event)
        assert fields["file"]["content"] == binary

    def test_parses_multiple_fields(self):
        ct, body = _build_multipart(
            ("file", "data.xlsm", XLSM_BYTES, XLSM_MIME),
            ("fileType", "circulation"),
            ("overwrite", "true"),
        )
        event = _event("/upload", "POST", ct, body)
        fields = _parse_multipart(event)
        assert "file" in fields
        assert fields["fileType"]["content"] == b"circulation"
        assert fields["overwrite"]["content"] == b"true"

    def test_returns_empty_dict_for_non_multipart_body(self):
        event = {
            "path": "/upload",
            "httpMethod": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": '{"key": "val"}',
            "isBase64Encoded": False,
        }
        assert _parse_multipart(event) == {}


# ── TestHandleValidate ────────────────────────────────────────────────────────


class TestHandleValidate:
    def test_valid_xlsm_returns_valid_true(self):
        resp = handle_validate(_validate_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        body = json.loads(resp["body"])
        assert resp["statusCode"] == 200
        assert body["data"]["valid"] is True
        assert body["data"]["errors"] == []

    def test_invalid_extension_returns_valid_false(self):
        resp = handle_validate(_validate_event("report.pdf", b"%PDF-1.4", PDF_MIME))
        body = json.loads(resp["body"])
        assert body["data"]["valid"] is False
        assert len(body["data"]["errors"]) == 1

    def test_oversized_file_returns_valid_false(self):
        big = b"x" * (FILE_TYPE_CONFIG["circulation"]["maxSizeBytes"] + 1)
        resp = handle_validate(_validate_event("data.xlsm", big, XLSM_MIME))
        body = json.loads(resp["body"])
        assert body["data"]["valid"] is False
        assert "too large" in body["data"]["errors"][0].lower()

    def test_defaults_file_type_to_circulation_when_omitted(self):
        # No fileType field in the request
        resp = handle_validate(_validate_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        body = json.loads(resp["body"])
        assert body["data"]["fileType"] == "circulation"

    def test_explicit_programs_file_type(self):
        resp = handle_validate(_validate_event("report.pdf", b"%PDF-1.4", PDF_MIME, "programs"))
        body = json.loads(resp["body"])
        assert body["data"]["valid"] is True
        assert body["data"]["fileType"] == "programs"

    def test_response_includes_warnings_list(self):
        resp = handle_validate(_validate_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        body = json.loads(resp["body"])
        assert isinstance(body["data"]["warnings"], list)

    def test_response_has_timestamp_and_request_id(self):
        resp = handle_validate(_validate_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        body = json.loads(resp["body"])
        assert "timestamp" in body
        assert body["requestId"].startswith("req_")

    def test_does_not_call_s3(self, mock_s3):
        handle_validate(_validate_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        mock_s3.put_object.assert_not_called()
        mock_s3.head_object.assert_not_called()


# ── TestHandleUpload ──────────────────────────────────────────────────────────


class TestHandleUpload:
    def test_missing_bucket_returns_500(self, monkeypatch):
        monkeypatch.setattr(module, "UPLOAD_BUCKET", "")
        resp = handle_upload(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        assert resp["statusCode"] == 500
        assert json.loads(resp["body"])["error"]["code"] == "CONFIG_ERROR"

    def test_missing_file_type_returns_400(self, bucket):
        ct, body = _build_multipart(("file", "data.xlsm", XLSM_BYTES, XLSM_MIME))
        resp = handle_upload(_event("/upload", "POST", ct, body))
        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["error"]["code"] == "MISSING_PARAMETER"

    def test_missing_file_returns_400(self, bucket):
        ct, body = _build_multipart(("fileType", "circulation"))
        resp = handle_upload(_event("/upload", "POST", ct, body))
        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["error"]["code"] == "NO_FILE"

    def test_wrong_extension_returns_400(self, bucket):
        resp = handle_upload(_upload_event("report.pdf", b"%PDF", PDF_MIME, "circulation"))
        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["error"]["code"] == "INVALID_FILE"

    def test_oversized_file_returns_400(self, bucket):
        big = b"x" * (FILE_TYPE_CONFIG["circulation"]["maxSizeBytes"] + 1)
        resp = handle_upload(_upload_event("data.xlsm", big, XLSM_MIME))
        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["error"]["code"] == "INVALID_FILE"

    def test_successful_upload_returns_200(self, bucket):
        resp = handle_upload(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        assert resp["statusCode"] == 200

    def test_successful_upload_response_shape(self, bucket):
        resp = handle_upload(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        data = json.loads(resp["body"])["data"]
        assert data["fileName"] == "data.xlsm"
        assert data["fileType"] == "circulation"
        assert data["processingStatus"] == "pending"
        assert data["fileSizeBytes"] == len(XLSM_BYTES)
        assert data["s3Location"] == "s3://test-bucket/uploads/circulation/data.xlsm"

    def test_puts_object_with_correct_bucket_and_key(self, bucket, mock_s3):
        handle_upload(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        kwargs = mock_s3.put_object.call_args.kwargs
        assert kwargs["Bucket"] == "test-bucket"
        assert kwargs["Key"] == "uploads/circulation/data.xlsm"

    def test_puts_object_with_s3_metadata(self, bucket, mock_s3):
        handle_upload(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        metadata = mock_s3.put_object.call_args.kwargs["Metadata"]
        assert metadata["fileType"] == "circulation"
        assert metadata["originalFilename"] == "data.xlsm"
        assert "uploadedAt" in metadata

    def test_file_exists_without_overwrite_returns_409(self, bucket, mock_s3):
        mock_s3.head_object.side_effect = None
        mock_s3.head_object.return_value = {"ContentLength": 100}
        resp = handle_upload(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        assert resp["statusCode"] == 409
        assert json.loads(resp["body"])["error"]["code"] == "FILE_EXISTS"

    def test_overwrite_true_skips_head_object_check(self, bucket, mock_s3):
        mock_s3.head_object.side_effect = None
        mock_s3.head_object.return_value = {"ContentLength": 100}
        resp = handle_upload(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME, overwrite=True))
        assert resp["statusCode"] == 200
        mock_s3.head_object.assert_not_called()

    def test_s3_put_error_returns_500(self, bucket, mock_s3):
        mock_s3.put_object.side_effect = ClientError(
            {"Error": {"Code": "InternalError", "Message": "S3 error"}}, "PutObject"
        )
        resp = handle_upload(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        assert resp["statusCode"] == 500
        assert json.loads(resp["body"])["error"]["code"] == "S3_ERROR"

    def test_pdf_upload_uses_programs_s3_destination(self, bucket, mock_s3):
        resp = handle_upload(_upload_event("report.pdf", b"%PDF-1.4", PDF_MIME, "programs"))
        assert resp["statusCode"] == 200
        kwargs = mock_s3.put_object.call_args.kwargs
        assert kwargs["Key"] == "uploads/programs/report.pdf"

    def test_response_has_timestamp_and_request_id(self, bucket):
        resp = handle_upload(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME))
        body = json.loads(resp["body"])
        assert "timestamp" in body
        assert body["requestId"].startswith("req_")

    def test_each_response_has_unique_request_id(self, bucket):
        r1 = json.loads(handle_upload(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME))["body"])
        r2 = json.loads(handle_upload(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME))["body"])
        assert r1["requestId"] != r2["requestId"]


# ── TestLambdaHandler ─────────────────────────────────────────────────────────


class TestLambdaHandler:
    def test_options_returns_200(self):
        event = {"path": "/upload", "httpMethod": "OPTIONS", "headers": {}, "body": ""}
        assert lambda_handler(event, None)["statusCode"] == 200

    def test_options_includes_cors_header(self):
        event = {"path": "/upload", "httpMethod": "OPTIONS", "headers": {}, "body": ""}
        resp = lambda_handler(event, None)
        assert resp["headers"]["Access-Control-Allow-Origin"] == "*"

    def test_routes_post_upload_to_handle_upload(self, bucket):
        resp = lambda_handler(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME), None)
        assert resp["statusCode"] == 200

    def test_routes_post_upload_validate_to_handle_validate(self):
        resp = lambda_handler(_validate_event("data.xlsm", XLSM_BYTES, XLSM_MIME), None)
        body = json.loads(resp["body"])
        assert "valid" in body["data"]

    def test_unknown_path_returns_404(self):
        event = {"path": "/other", "httpMethod": "POST", "headers": {}, "body": ""}
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 404
        assert json.loads(resp["body"])["error"]["code"] == "NOT_FOUND"

    def test_get_method_on_upload_returns_404(self):
        event = {"path": "/upload", "httpMethod": "GET", "headers": {}, "body": ""}
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 404

    def test_upload_response_includes_cors_header(self, bucket):
        resp = lambda_handler(_upload_event("data.xlsm", XLSM_BYTES, XLSM_MIME), None)
        assert resp["headers"]["Access-Control-Allow-Origin"] == "*"
