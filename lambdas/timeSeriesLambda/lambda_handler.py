"""

Library Analytics – Time Series Lambda
 
Builds multi-fiscal-year circulation time series for a department:

  - Per-FY monthly print / non-print / total (from every FY .xlsm in S3)

  - Linear-trend seasonal forecast for any "future" trailing months in the

    latest FY (needs >= 2 historical non-zero data points for that month)

  - Year-over-year % change per month
 
Returns computed data only — no charts are rendered in the backend. The

frontend builds all visualizations from this JSON payload.
 
Trigger:  API Gateway  GET /timeseries?department={name}

Response: {success, data, error, timestamp, requestId} envelope, where

          data matches the frontend's TimeSeriesResponse type.

"""
 
import hashlib

import io

import json

import logging

import os

import uuid

from datetime import datetime, timezone

from typing import Any, Dict

import boto3

import numpy as np

import pandas as pd

from botocore.exceptions import ClientError

logger = logging.getLogger()

logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
 
# Fiscal year order: July → June

MONTHS = [

    ("JULY", "Jul"), ("AUGUST", "Aug"), ("SEPTEMBER", "Sep"),

    ("OCTOBER", "Oct"), ("NOVEMBER", "Nov"), ("DECEMBER", "Dec"),

    ("JANUARY", "Jan"), ("FEBRUARY", "Feb"), ("MARCH", "Mar"),

    ("APRIL", "Apr"), ("MAY", "May"), ("JUNE", "Jun"),

]

MONTH_LABELS = [short for _, short in MONTHS]
 
COL_DEPT = 0

COL_PRINT = 16     # TOTAL BOOKS

COL_NONPRINT = 21  # TOTAL NONPRINT
 
BUCKET = os.environ.get("CIRCULATION_BUCKET", "")

S3_PREFIX = os.environ.get("CIRCULATION_PREFIX", "circulation/")

CACHE_KEY = os.environ.get("TIMESERIES_CACHE_KEY", "processed/timeseries_cache.json")


# ── S3 / Excel loading ───────────────────────────────────────────────────────
 
def list_xlsm_files(bucket: str, prefix: str) -> list[str]:

    """Return sorted S3 keys for every .xlsm file under prefix."""

    paginator = s3.get_paginator("list_objects_v2")

    keys = []

    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):

        for obj in page.get("Contents", []):

            if obj["Key"].endswith(".xlsm"):

                keys.append(obj["Key"])

    return sorted(keys)


def list_xlsm_objects(bucket: str, prefix: str) -> list[dict]:
    """Return sorted {key, etag} metadata for every .xlsm file under prefix.

    A plain listing call — no file bodies are downloaded — so this is cheap
    enough to call on every request just to fingerprint the source data.
    """
    paginator = s3.get_paginator("list_objects_v2")
    objects = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            if obj["Key"].endswith(".xlsm"):
                objects.append({"key": obj["Key"], "etag": obj["ETag"]})
    return sorted(objects, key=lambda o: o["key"])


def _source_signature(objects: list[dict]) -> str:
    """Fingerprint of the current source .xlsm files (order-independent)."""
    raw = "|".join(f'{o["key"]}:{o["etag"]}' for o in sorted(objects, key=lambda o: o["key"]))
    return hashlib.sha256(raw.encode()).hexdigest()


def _read_cache(bucket: str, key: str) -> dict:
    try:
        body = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
        return json.loads(body)
    except ClientError as exc:
        if exc.response["Error"]["Code"] not in ("NoSuchKey", "404"):
            logger.warning("Failed to read timeseries cache: %s", exc)
        return {}
    except Exception:
        logger.exception("Failed to read/parse timeseries cache")
        return {}


def _write_cache(bucket: str, key: str, cache: dict) -> None:
    try:
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(cache),
            ContentType="application/json",
        )
    except Exception:
        logger.exception("Failed to write timeseries cache")


def download_s3_file(bucket: str, key: str) -> io.BytesIO:

    response = s3.get_object(Bucket=bucket, Key=key)

    return io.BytesIO(response["Body"].read())
 
 
def _load_month(circ_file, sheet_name: str, department: str) -> tuple[float, float]:

    df = pd.read_excel(circ_file, sheet_name=sheet_name, header=None)

    # Rows 0-6 are blank/header rows; data begins at row 7

    data = df.iloc[7:, [COL_DEPT, COL_PRINT, COL_NONPRINT]].copy()

    data.columns = ["department", "print", "nonprint"]

    data = data.dropna(subset=["department"])
 
    match = data[data["department"].str.strip().str.lower() == department.strip().lower()]

    if match.empty:

        available = data["department"].tolist()

        raise ValueError(

            f"Department '{department}' not found in sheet '{sheet_name}'. "

            f"Available: {available}"

        )
 
    row = match.iloc[0]

    return float(row["print"] or 0), float(row["nonprint"] or 0)
 
 
# ── Forecasting ──────────────────────────────────────────────────────────────
 
def _seasonal_trend_forecast(

    fy_data: dict, fy_labels: list[str], month_idx: int

) -> tuple[float, float, float] | None:

    """

    For a given month position (0-11), collect all historical FY values for that

    month, fit a linear trend across years, and project one year ahead.

    Returns (pred_print, pred_nonprint, se_total) or None if < 2 non-zero points.

    """

    xs, print_ys, nonprint_ys = [], [], []

    for i, fy in enumerate(fy_labels):

        p = float(fy_data[fy]["print"].iloc[month_idx])

        n = float(fy_data[fy]["nonprint"].iloc[month_idx])

        if p + n > 0:

            xs.append(float(i))

            print_ys.append(p)

            nonprint_ys.append(n)
 
    if len(xs) < 2:

        return None
 
    xs_arr = np.array(xs)

    next_x = float(len(fy_labels))

    coef_p = np.polyfit(xs_arr, print_ys, 1)

    coef_n = np.polyfit(xs_arr, nonprint_ys, 1)

    pred_p = max(0.0, float(np.polyval(coef_p, next_x)))

    pred_n = max(0.0, float(np.polyval(coef_n, next_x)))

    se = float(

        np.std(np.array(print_ys) - np.polyval(coef_p, xs_arr))

        + np.std(np.array(nonprint_ys) - np.polyval(coef_n, xs_arr))

    )

    return pred_p, pred_n, se
 
 
# ── Core calculation ───────────────────────────────────────────────────────
 
def compute_time_series(department: str) -> dict:

    keys = list_xlsm_files(BUCKET, S3_PREFIX)

    if not keys:

        raise LookupError(f"No .xlsm files found in s3://{BUCKET}/{S3_PREFIX}")
 
    files: dict[str, io.BytesIO] = {

        os.path.basename(key): download_s3_file(BUCKET, key) for key in keys

    }
 
    fy_data: dict[str, pd.DataFrame] = {}

    for filename in sorted(files.keys()):

        fy_label = filename.split()[0]  # "FY2025 Circulation..." → "FY2025"

        buf = files[filename]

        records = []

        for sheet, short in MONTHS:

            buf.seek(0)

            print_total, nonprint_total = _load_month(buf, sheet, department)

            records.append({

                "month": short,

                "print": print_total,

                "nonprint": nonprint_total,

                "total": print_total + nonprint_total,

            })

        fy_data[fy_label] = pd.DataFrame(records)
 
    fy_labels = list(fy_data.keys())

    latest_fy = fy_labels[-1]

    latest_totals = fy_data[latest_fy]["total"].values

    nonzero_idxs = [i for i, v in enumerate(latest_totals) if v > 0]

    last_actual = max(nonzero_idxs) if nonzero_idxs else -1

    future_idxs = list(range(last_actual + 1, 12))
 
    forecasts: dict[int, tuple[float, float, float]] = {

        m: result

        for m in future_idxs

        if (result := _seasonal_trend_forecast(fy_data, fy_labels, m)) is not None

    }

    has_forecast = bool(forecasts)
 
    return {

        "department": department,

        "fy_labels": fy_labels,

        "fy_data": fy_data,

        "latest_fy": latest_fy,

        "last_actual": last_actual,

        "forecasts": forecasts,

        "has_forecast": has_forecast,

    }
 
 
# ── JSON payload builder ──────────────────────────────────────────────────────
 
def build_json_payload(calc: dict) -> dict:

    fy_labels = calc["fy_labels"]

    fy_data = calc["fy_data"]

    latest_fy = calc["latest_fy"]

    last_actual = calc["last_actual"]

    forecasts = calc["forecasts"]

    has_forecast = calc["has_forecast"]
 
    # 1) Overlay series: totals per FY per month, flagging forecast months

    overlay: dict[str, list[dict]] = {}

    for fy in fy_labels:

        totals = fy_data[fy]["total"].values

        points = []

        for i, month in enumerate(MONTH_LABELS):

            if fy == latest_fy and i in forecasts:

                p, n, se = forecasts[i]

                pred = p + n

                points.append({

                    "month": month, "total": round(pred, 1),

                    "forecast": True, "seLow": round(pred - se, 1), "seHigh": round(pred + se, 1),

                })

            elif fy == latest_fy and i > last_actual:

                continue  # no forecast possible (< 2 historical points) — leave gap

            else:

                points.append({"month": month, "total": float(totals[i]), "forecast": False})

        overlay[fy] = points
 
    # 2) Annual print vs non-print totals, with forecast portion split out

    annual = []

    for fy in fy_labels:

        row = {

            "fy": fy,

            "print": float(fy_data[fy]["print"].sum()),

            "nonprint": float(fy_data[fy]["nonprint"].sum()),

            "forecastPrint": 0.0,

            "forecastNonprint": 0.0,

        }

        if fy == latest_fy and has_forecast:

            row["forecastPrint"] = sum(forecasts[m][0] for m in forecasts)

            row["forecastNonprint"] = sum(forecasts[m][1] for m in forecasts)

        annual.append(row)
 
    # 3) Full chronological timeline (actual + forecast bridge)

    timeline = []

    idx = 0

    for fy in fy_labels:

        totals = fy_data[fy]["total"].values

        for i, month in enumerate(MONTH_LABELS):

            if fy == latest_fy and i in forecasts:

                p, n, se = forecasts[i]

                pred = p + n

                timeline.append({

                    "index": idx, "fy": fy, "month": month, "total": round(pred, 1),

                    "forecast": True, "seLow": round(pred - se, 1), "seHigh": round(pred + se, 1),

                })

            elif fy == latest_fy and i > last_actual:

                pass

            else:

                timeline.append({

                    "index": idx, "fy": fy, "month": month,

                    "total": float(totals[i]), "forecast": False,

                })

            idx += 1
 
    # 4) Year-over-year % change per month

    yoy: dict[str, list[dict]] = {}

    for fy in fy_labels[1:]:

        prior = fy_labels[fy_labels.index(fy) - 1]

        prior_vals = fy_data[prior]["total"].values.clip(min=1)

        curr_vals = fy_data[fy]["total"].values

        points = []

        limit = last_actual if fy == latest_fy else 11

        for i in range(limit + 1):

            pct = ((curr_vals[i] - prior_vals[i]) / prior_vals[i]) * 100

            points.append({"month": MONTH_LABELS[i], "pctChange": round(float(pct), 2), "forecast": False})

        if fy == latest_fy:

            for m in sorted(forecasts):

                pred = forecasts[m][0] + forecasts[m][1]

                pct = ((pred - prior_vals[m]) / prior_vals[m]) * 100

                points.append({"month": MONTH_LABELS[m], "pctChange": round(float(pct), 2), "forecast": True})

        yoy[f"{fy} vs {prior}"] = points
 
    return {

        "department": calc["department"],

        "fyLabels": fy_labels,

        "monthLabels": MONTH_LABELS,

        "latestFy": latest_fy,

        "lastActualIndex": last_actual,

        "hasForecast": has_forecast,

        "series": {

            "overlay": overlay,

            "annual": annual,

            "timeline": timeline,

            "yoy": yoy,

        },

    }
 
 
# ── API response helpers (matches circulation lambda's envelope) ─────────────
 
def _api_ok(data: Any) -> dict:

    return _api_response(200, {

        "success": True,

        "data": data,

        "error": None,

        "timestamp": datetime.now(timezone.utc).isoformat(),

        "requestId": f"req_{uuid.uuid4().hex[:12]}",

    })
 
 
def _api_err(status: int, code: str, message: str) -> dict:

    return _api_response(status, {

        "success": False,

        "data": None,

        "error": {"code": code, "message": message},

        "timestamp": datetime.now(timezone.utc).isoformat(),

        "requestId": f"req_{uuid.uuid4().hex[:12]}",

    })
 
 
def _api_response(status: int, body: dict) -> dict:

    return {

        "statusCode": status,

        "headers": {

            "Content-Type": "application/json",

            "Access-Control-Allow-Origin": "*",

            "Access-Control-Allow-Methods": "GET, OPTIONS",

            "Access-Control-Allow-Headers": "Content-Type, Authorization",

        },

        "body": json.dumps(body),

    }
 
 
# ── Entry point ────────────────────────────────────────────────────────────
 
def handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:

    logger.info("Event: %s", json.dumps(event))
 
    # Support both API Gateway proxy events and direct test invokes

    department = (event.get("queryStringParameters") or {}).get("department") or event.get("department")
 
    if not department:

        return _api_err(400, "MISSING_PARAM", "Query parameter 'department' is required")
 
    if not BUCKET:

        return _api_err(500, "CONFIG_ERROR", "CIRCULATION_BUCKET not set")

    # Cache: fingerprint the source .xlsm files and reuse whatever was
    # computed for this department the first time a request came in against
    # that fingerprint. Source data only changes once a month, when a new
    # file lands and circulationLambda reprocesses it — so branch switches
    # between uploads should hit this cache instead of re-parsing every FY
    # workbook on every request.
    cache: dict = {}
    signature: str | None = None
    try:
        objects = list_xlsm_objects(BUCKET, S3_PREFIX)
        if objects:
            signature = _source_signature(objects)
            cache = _read_cache(BUCKET, CACHE_KEY)
            if cache.get("sourceSignature") == signature:
                cached_payload = cache.get("departments", {}).get(department)
                if cached_payload is not None:
                    return _api_ok(cached_payload)
    except Exception:
        logger.exception("Failed to check timeseries cache; falling back to full compute")

    try:

        calc = compute_time_series(department)

    except LookupError as exc:

        logger.error("No source data: %s", exc)

        return _api_err(404, "NOT_FOUND", str(exc))

    except ValueError as exc:

        logger.error("Bad department: %s", exc)

        return _api_err(400, "INVALID_DEPARTMENT", str(exc))

    except Exception as exc:  # noqa: BLE001

        logger.exception("Failed to compute time series")

        return _api_err(500, "INTERNAL_ERROR", str(exc))
 
    payload = build_json_payload(calc)

    if signature:
        if cache.get("sourceSignature") != signature:
            cache = {"sourceSignature": signature, "departments": {}}
        cache.setdefault("departments", {})[department] = payload
        _write_cache(BUCKET, CACHE_KEY, cache)

    return _api_ok(payload)
 
 
# Backwards-compatible alias if anything still imports `lambda_handler`

lambda_handler = handler
 