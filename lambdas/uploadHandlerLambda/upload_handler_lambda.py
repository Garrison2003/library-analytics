"""
File Upload Handler Lambda Function
Handles POST /upload and POST /upload/validate endpoints
Routes files to appropriate S3 folders based on fileType
Validates files before upload

Triggered by: API Gateway
Returns: JSON response with upload status or validation result
"""

import base64
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from email import policy as email_policy
from email.parser import BytesParser
from typing import Any, Dict, Tuple

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

# ── File Type Configuration (matches fileConfig.ts) ────────────────────────

FILE_TYPE_CONFIG = {
    "circulation": {
        "id": "circulation",
        "displayName": "Circulation Statistics",
        "allowedExtensions": ["xlsm", "xlsx"],
        "acceptedMimeTypes": [
            "application/vnd.ms-excel.sheet.macroEnabled.12",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        "maxSizeBytes": 10 * 1024 * 1024,  # 10 MB
        "s3Destination": "uploads/circulation",
    },
    "programs": {
        "id": "programs",
        "displayName": "Program Reports",
        "allowedExtensions": ["pdf"],
        "acceptedMimeTypes": ["application/pdf"],
        "maxSizeBytes": 20 * 1024 * 1024,  # 20 MB
        "s3Destination": "uploads/programs",
    },
}

UPLOAD_BUCKET = os.environ.get("UPLOAD_BUCKET", "")

# ── API Response Helpers ─────────────────────────────────────────────────


def _api_response(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def _success(data: Any) -> Dict[str, Any]:
    return _api_response(
        200,
        {
            "success": True,
            "data": data,
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "requestId": f"req_{uuid.uuid4().hex[:12]}",
        },
    )


def _error(status: int, code: str, message: str, details: Dict = None) -> Dict[str, Any]:
    error_obj: Dict[str, Any] = {"code": code, "message": message}
    if details:
        error_obj["details"] = details
    return _api_response(
        status,
        {
            "success": False,
            "data": None,
            "error": error_obj,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "requestId": f"req_{uuid.uuid4().hex[:12]}",
        },
    )


# ── Multipart Parsing ────────────────────────────────────────────────────


def _parse_multipart(event: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Parse multipart/form-data from an API Gateway proxy event.

    Handles binary bodies (isBase64Encoded=true) correctly — never decodes
    the raw bytes to a string, so binary file content (Excel, PDF) is preserved.

    Returns a dict of field_name -> {content: bytes, filename: str|None, content_type: str}.
    """
    headers = event.get("headers") or {}
    content_type = headers.get("Content-Type") or headers.get("content-type", "")

    raw_body = event.get("body") or b""
    if event.get("isBase64Encoded"):
        raw_body = base64.b64decode(raw_body)
    elif isinstance(raw_body, str):
        raw_body = raw_body.encode()

    raw = f"Content-Type: {content_type}\r\n\r\n".encode() + raw_body
    msg = BytesParser(policy=email_policy.compat32).parsebytes(raw)

    fields: Dict[str, Dict[str, Any]] = {}
    if msg.is_multipart():
        for part in msg.get_payload():
            disp = part.get("Content-Disposition", "")
            params: Dict[str, str] = {}
            for segment in disp.split(";"):
                segment = segment.strip()
                if "=" in segment:
                    k, v = segment.split("=", 1)
                    params[k.strip()] = v.strip().strip('"')
            name = params.get("name")
            if name:
                fields[name] = {
                    "content": part.get_payload(decode=True) or b"",
                    "filename": params.get("filename"),
                    "content_type": part.get_content_type(),
                }
    return fields


def _field_str(fields: Dict, key: str, default: str = "") -> str:
    """Decode a plain-text form field to a string."""
    raw = fields.get(key, {}).get("content", b"")
    decoded = raw.decode() if isinstance(raw, bytes) else raw
    return decoded or default


# ── File Validation ──────────────────────────────────────────────────────


def get_file_extension(filename: str) -> str:
    parts = filename.split(".")
    return parts[-1].lower() if len(parts) > 1 else ""


def validate_file(
    filename: str,
    file_size: int,
    content_type: str,
    file_type: str,
) -> Tuple[bool, str, Dict]:
    """
    Validate a file against its type configuration.
    Returns (is_valid, error_message, details).
    """
    if file_type not in FILE_TYPE_CONFIG:
        return (
            False,
            f"Unsupported file type '{file_type}'. Supported types: {', '.join(FILE_TYPE_CONFIG.keys())}",
            {"supportedTypes": list(FILE_TYPE_CONFIG.keys())},
        )

    config = FILE_TYPE_CONFIG[file_type]

    extension = get_file_extension(filename)
    if extension not in config["allowedExtensions"]:
        return (
            False,
            f"Invalid file extension '.{extension}'. Expected: {', '.join(config['allowedExtensions'])}",
            {
                "filename": filename,
                "extension": extension,
                "expectedExtensions": config["allowedExtensions"],
            },
        )

    if content_type not in config["acceptedMimeTypes"]:
        # Log MIME mismatch but don't fail — browsers sometimes report wrong types
        logger.warning(
            "MIME type mismatch: got %s, expected one of %s",
            content_type,
            config["acceptedMimeTypes"],
        )

    if file_size > config["maxSizeBytes"]:
        max_mb = config["maxSizeBytes"] / (1024 * 1024)
        actual_mb = file_size / (1024 * 1024)
        return (
            False,
            f"File too large. Max for {config['displayName']} is {max_mb:.1f} MB; your file is {actual_mb:.1f} MB.",
            {
                "maxSizeBytes": config["maxSizeBytes"],
                "actualSizeBytes": file_size,
                "maxSizeMB": max_mb,
                "actualSizeMB": actual_mb,
            },
        )

    return True, "", {}


# ── Request Handlers ─────────────────────────────────────────────────────


def handle_upload(event: Dict[str, Any]) -> Dict[str, Any]:
    if not UPLOAD_BUCKET:
        logger.error("UPLOAD_BUCKET environment variable not set")
        return _error(500, "CONFIG_ERROR", "Server not configured properly")

    try:
        fields = _parse_multipart(event)
    except Exception as exc:
        logger.exception("Failed to parse multipart body")
        return _error(400, "PARSE_ERROR", f"Failed to parse request: {exc}")

    file_type = _field_str(fields, "fileType")
    if not file_type:
        return _error(
            400,
            "MISSING_PARAMETER",
            "Missing required parameter: fileType",
            {"requiredParameters": ["fileType"]},
        )

    file_field = fields.get("file", {})
    file_content: bytes = file_field.get("content", b"")
    filename: str = file_field.get("filename") or ""
    content_type: str = file_field.get("content_type", "application/octet-stream")

    if not file_content or not filename:
        return _error(400, "NO_FILE", "No file provided in request")

    is_valid, error_msg, details = validate_file(
        filename, len(file_content), content_type, file_type
    )
    if not is_valid:
        logger.warning("File validation failed: %s", error_msg)
        return _error(400, "INVALID_FILE", error_msg, details)

    overwrite = _field_str(fields, "overwrite", "false").lower() == "true"
    config = FILE_TYPE_CONFIG[file_type]
    s3_key = f"{config['s3Destination']}/{filename}"

    if not overwrite:
        try:
            s3.head_object(Bucket=UPLOAD_BUCKET, Key=s3_key)
            return _error(
                409,
                "FILE_EXISTS",
                f"'{filename}' already exists. Set overwrite=true to replace it.",
                {"s3Key": s3_key},
            )
        except ClientError:
            pass  # Object does not exist — safe to upload

    try:
        s3.put_object(
            Bucket=UPLOAD_BUCKET,
            Key=s3_key,
            Body=file_content,
            ContentType=content_type,
            Metadata={
                "fileType": file_type,
                "originalFilename": filename,
                "uploadedAt": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.info("Uploaded file to s3://%s/%s", UPLOAD_BUCKET, s3_key)
    except ClientError as exc:
        logger.error("S3 upload error: %s", exc)
        return _error(500, "S3_ERROR", "Failed to upload file to storage", {"s3Error": str(exc)})

    return _success(
        {
            "fileName": filename,
            "fileType": file_type,
            "s3Location": f"s3://{UPLOAD_BUCKET}/{s3_key}",
            "uploadedAt": datetime.now(timezone.utc).isoformat(),
            "processingStatus": "pending",
            "fileSizeBytes": len(file_content),
        }
    )


def handle_validate(event: Dict[str, Any]) -> Dict[str, Any]:
    try:
        fields = _parse_multipart(event)
    except Exception as exc:
        logger.exception("Failed to parse multipart body")
        return _error(400, "PARSE_ERROR", f"Failed to parse request: {exc}")

    file_type = _field_str(fields, "fileType", "circulation")

    file_field = fields.get("file", {})
    file_content: bytes = file_field.get("content", b"")
    filename: str = file_field.get("filename") or ""
    content_type: str = file_field.get("content_type", "application/octet-stream")

    is_valid, error_msg, details = validate_file(
        filename, len(file_content), content_type, file_type
    )

    return _success(
        {
            "valid": is_valid,
            "errors": [error_msg] if error_msg else [],
            "warnings": [],
            "fileType": file_type,
            "details": details if details else {},
        }
    )


# ── Lambda Handler Entrypoint ────────────────────────────────────────────


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:  # noqa: ARG001
    logger.info("Event: %s", json.dumps(event, default=str)[:500])

    path = event.get("path", "")
    method = event.get("httpMethod", "")

    if method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": "",
        }

    if path == "/upload" and method == "POST":
        return handle_upload(event)
    if path == "/upload/validate" and method == "POST":
        return handle_validate(event)

    return _error(404, "NOT_FOUND", f"Endpoint {method} {path} not found")
