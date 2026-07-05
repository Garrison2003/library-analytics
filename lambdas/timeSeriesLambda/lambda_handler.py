import io
import json
import logging
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from typing import Dict, Any
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Fiscal year order: July → June
MONTHS = [
    ("JULY",      "Jul"),
    ("AUGUST",    "Aug"),
    ("SEPTEMBER", "Sep"),
    ("OCTOBER",   "Oct"),
    ("NOVEMBER",  "Nov"),
    ("DECEMBER",  "Dec"),
    ("JANUARY",   "Jan"),
    ("FEBRUARY",  "Feb"),
    ("MARCH",     "Mar"),
    ("APRIL",     "Apr"),
    ("MAY",       "May"),
    ("JUNE",      "Jun"),
]

COL_DEPT     = 0
COL_PRINT    = 16   # TOTAL BOOKS
COL_NONPRINT = 21   # TOTAL NONPRINT

BUCKET = os.environ.get("CIRCULATION_BUCKET", "")
S3_PREFIX = os.environ.get("CIRCULATION_PREFIX", "circulation/")


def list_xlsm_files(bucket: str, prefix: str) -> list[str]:
    """Return sorted S3 keys for every .xlsm file under prefix."""
    s3 = boto3.client("s3")
    paginator = s3.get_paginator("list_objects_v2")
    keys = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            if obj["Key"].endswith(".xlsm"):
                keys.append(obj["Key"])
    return sorted(keys)


def download_s3_file(bucket: str, key: str) -> io.BytesIO:
    """Download a single S3 object and return its contents as a BytesIO buffer."""
    s3 = boto3.client("s3")
    response = s3.get_object(Bucket=bucket, Key=key)
    return io.BytesIO(response["Body"].read())

    

def _seasonal_trend_forecast(
    fy_data: dict, fy_labels: list[str], month_idx: int
) -> tuple[float, float, float] | None:
    """
    For a given month position (0-11), collect all historical FY values for that month,
    fit a linear trend across years, and project one year ahead.
    Returns (pred_print, pred_nonprint, se_total) or None if < 2 non-zero data points.
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

    xs_arr  = np.array(xs)
    next_x  = float(len(fy_labels))
    coef_p  = np.polyfit(xs_arr, print_ys, 1)
    coef_n  = np.polyfit(xs_arr, nonprint_ys, 1)
    pred_p  = max(0.0, float(np.polyval(coef_p, next_x)))
    pred_n  = max(0.0, float(np.polyval(coef_n, next_x)))
    se = float(
        np.std(np.array(print_ys)    - np.polyval(coef_p, xs_arr)) +
        np.std(np.array(nonprint_ys) - np.polyval(coef_n, xs_arr))
    )
    return pred_p, pred_n, se


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


def handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    
    department = event.get("department")
    if not department:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing 'department' in event"}),
        }

    logger.info(f"Building multi-year time series for department: {department}")

    keys = list_xlsm_files(BUCKET, S3_PREFIX)
    if not keys:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"No .xlsm files found in s3://{BUCKET}/{S3_PREFIX}"}),
        }
    logger.info(f"Found {len(keys)} files: {keys}")

    files: dict[str, io.BytesIO] = {
        os.path.basename(key): download_s3_file(BUCKET, key)
        for key in keys
    }

    # Build per-FY monthly DataFrame from every file, in chronological order
    fy_data: dict[str, pd.DataFrame] = {}
    for filename in sorted(files.keys()):
        fy_label = filename.split()[0]          # "FY2025 Circulation..." → "FY2025"
        buf = files[filename]
        records = []
        for sheet, short in MONTHS:
            buf.seek(0)
            print_total, nonprint_total = _load_month(buf, sheet, department)
            records.append({
                "month":    short,
                "print":    print_total,
                "nonprint": nonprint_total,
                "total":    print_total + nonprint_total,
            })
        fy_data[fy_label] = pd.DataFrame(records)

    fy_labels    = list(fy_data.keys())
    month_labels = [short for _, short in MONTHS]
    x = list(range(12))

    # ── Forecast detection ────────────────────────────────────────────────────────
    # "Future" months = trailing zeros in the latest FY after the last non-zero entry.
    latest_fy     = fy_labels[-1]
    latest_totals = fy_data[latest_fy]["total"].values
    nonzero_idxs  = [i for i, v in enumerate(latest_totals) if v > 0]
    last_actual   = max(nonzero_idxs) if nonzero_idxs else -1
    future_idxs   = list(range(last_actual + 1, 12))

    # Predict only months with ≥ 2 historical non-zero data points
    forecasts: dict[int, tuple[float, float, float]] = {
        m: result
        for m in future_idxs
        if (result := _seasonal_trend_forecast(fy_data, fy_labels, m)) is not None
    }
    has_forecast = bool(forecasts)

    FY_COLORS = ["#6366F1", "#16A34A", "#2563EB", "#D97706", "#DC2626", "#9333EA"]
    fy_colors = {fy: FY_COLORS[i % len(FY_COLORS)] for i, fy in enumerate(fy_labels)}

    plt.rcParams.update({
        "font.family":        "DejaVu Sans",
        "axes.spines.top":    False,
        "axes.spines.right":  False,
        "axes.grid":          True,
        "grid.linestyle":     "--",
        "grid.alpha":         0.4,
        "figure.dpi":         120,
    })

    fig, axes = plt.subplots(2, 2, figsize=(14, 9))
    fig.suptitle(
        f"Multi-Year Circulation Time Series — {department}\nCharlotte Mecklenburg Library",
        fontsize=13, fontweight="bold", y=1.02,
    )

    # ── Plot 1: Multi-year overlay — actual solid, forecast dashed ────────────────
    ax1 = axes[0, 0]
    for fy in fy_labels:
        totals = fy_data[fy]["total"].values
        color  = fy_colors[fy]
        if fy == latest_fy and has_forecast:
            # Solid line for confirmed months
            if last_actual >= 0:
                ax1.plot(range(last_actual + 1), totals[:last_actual + 1],
                         marker="o", linewidth=2, color=color, markersize=5, label=fy)
                bridge_x = [last_actual]
                bridge_y = [totals[last_actual]]
            else:
                bridge_x, bridge_y = [], []
            # Dashed extension for forecast months
            for m in sorted(forecasts):
                p, n, se = forecasts[m]
                pred = p + n
                bridge_x.append(m)
                bridge_y.append(pred)
                ax1.fill_between([m - 0.4, m + 0.4], [pred - se] * 2, [pred + se] * 2,
                                 alpha=0.15, color=color)
            ax1.plot(bridge_x, bridge_y, linestyle="--", marker="^", linewidth=1.5,
                     color=color, markersize=6, alpha=0.85, label=f"{fy} forecast")
        else:
            ax1.plot(x, totals, marker="o", linewidth=2, color=color, markersize=5, label=fy)
    ax1.set_title("Total Circulation by Fiscal Year", fontsize=11)
    ax1.set_xticks(x)
    ax1.set_xticklabels(month_labels, fontsize=9)
    ax1.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ax1.set_ylabel("Checkouts")
    ax1.legend(fontsize=9, framealpha=0.5)

    # ── Plot 2: Annual print vs non-print totals — grouped bar ────────────────────
    ax2 = axes[0, 1]
    annual_print    = [fy_data[fy]["print"].sum()    for fy in fy_labels]
    annual_nonprint = [fy_data[fy]["nonprint"].sum() for fy in fy_labels]
    fy_x = list(range(len(fy_labels)))
    bw = 0.35
    ax2.bar([i - bw / 2 for i in fy_x], annual_print,    width=bw, color="#2563EB", label="Print",     edgecolor="white")
    ax2.bar([i + bw / 2 for i in fy_x], annual_nonprint, width=bw, color="#D97706", label="Non-Print", edgecolor="white")
    if has_forecast:
        fc_print    = sum(forecasts[m][0] for m in forecasts)
        fc_nonprint = sum(forecasts[m][1] for m in forecasts)
        fc_i = len(fy_labels) - 1          # overlay on the latest FY bar
        ax2.bar(fc_i - bw / 2, fc_print,    width=bw, color="#2563EB", edgecolor="#2563EB",
                linewidth=1.5, fill=False, linestyle="--")
        ax2.bar(fc_i + bw / 2, fc_nonprint, width=bw, color="#D97706", edgecolor="#D97706",
                linewidth=1.5, fill=False, linestyle="--")
    ax2.set_title("Annual Print vs Non-Print Totals", fontsize=11)
    ax2.set_xticks(fy_x)
    ax2.set_xticklabels(fy_labels, fontsize=9)
    ax2.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ax2.set_ylabel("Checkouts")
    ax2.legend(fontsize=9, framealpha=0.5)

    # ── Plot 3: Full chronological timeline + forecast extension ──────────────────
    ax3 = axes[1, 0]
    all_totals: list[float] = []
    for fy in fy_labels:
        all_totals.extend(fy_data[fy]["total"].tolist())

    global_last  = (len(fy_labels) - 1) * 12 + last_actual
    actual_slice = all_totals[:global_last + 1]
    ax3.plot(range(global_last + 1), actual_slice, linewidth=1.5, color="#2563EB")
    ax3.fill_between(range(global_last + 1), actual_slice, alpha=0.1, color="#2563EB")

    if has_forecast and last_actual >= 0:
        fc_x = [global_last]
        fc_y = [all_totals[global_last]]
        fc_lo, fc_hi = [fc_y[0]], [fc_y[0]]
        for m in sorted(forecasts):
            p, n, se = forecasts[m]
            pred = p + n
            gx   = (len(fy_labels) - 1) * 12 + m
            fc_x.append(gx); fc_y.append(pred)
            fc_lo.append(pred - se); fc_hi.append(pred + se)
        ax3.plot(fc_x, fc_y, linestyle="--", marker="^", linewidth=1.5,
                 color="#9333EA", markersize=6, label="Forecast")
        ax3.fill_between(fc_x, fc_lo, fc_hi, alpha=0.15, color="#9333EA")
        ax3.legend(fontsize=9, framealpha=0.5)

    for i in range(1, len(fy_labels)):
        ax3.axvline(x=i * 12 - 0.5, color="#9CA3AF", linewidth=1, linestyle="--")
    ax3.set_xticks([i * 12 for i in range(len(fy_labels))])
    ax3.set_xticklabels(fy_labels, fontsize=9)
    ax3.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ax3.set_title("Full Chronological Timeline" + (" + Forecast" if has_forecast else ""), fontsize=11)
    ax3.set_ylabel("Checkouts")

    # ── Plot 4: YoY % change — actual solid, forecast dashed ─────────────────────
    ax4 = axes[1, 1]
    for fy in fy_labels[1:]:
        prior      = fy_labels[fy_labels.index(fy) - 1]
        prior_vals = fy_data[prior]["total"].values.clip(min=1)
        curr_vals  = fy_data[fy]["total"].values
        color      = fy_colors[fy]

        if fy == latest_fy and has_forecast:
            actual_yoy = ((curr_vals[:last_actual + 1] - prior_vals[:last_actual + 1])
                          / prior_vals[:last_actual + 1]) * 100
            ax4.plot(range(last_actual + 1), actual_yoy,
                     marker="o", linewidth=2, color=color, markersize=5, label=f"{fy} vs {prior}")
            fc_x4 = [last_actual] if last_actual >= 0 else []
            fc_y4 = [float(actual_yoy[-1])] if last_actual >= 0 else []
            for m in sorted(forecasts):
                pred = forecasts[m][0] + forecasts[m][1]
                fc_x4.append(m)
                fc_y4.append(((pred - prior_vals[m]) / prior_vals[m]) * 100)
            if fc_x4:
                ax4.plot(fc_x4, fc_y4, linestyle="--", marker="^", linewidth=1.5,
                         color=color, markersize=5, alpha=0.85)
        else:
            yoy = ((curr_vals - prior_vals) / prior_vals) * 100
            ax4.plot(x, yoy, marker="o", linewidth=2, color=color, markersize=5,
                     label=f"{fy} vs {prior}")

    ax4.axhline(0, color="#6B7280", linewidth=1)
    ax4.set_title("Year-over-Year % Change by Month", fontsize=11)
    ax4.set_xticks(x)
    ax4.set_xticklabels(month_labels, fontsize=9)
    ax4.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:+.0f}%"))
    ax4.set_ylabel("% change vs same month prior FY")
    ax4.legend(fontsize=8, framealpha=0.5)

    plt.tight_layout()

    out_path = f"multi_year_{department.replace(' ', '_')}_time_series.png"
    plt.savefig(out_path, bbox_inches="tight", dpi=150)
    logger.info(f"Saved → {out_path}")
    print(f"Saved → {out_path}")

    return {
        "statusCode": 200,
        "body": json.dumps({"output": out_path}),
    }
