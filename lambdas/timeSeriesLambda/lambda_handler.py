import json
import logging
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from typing import Dict, Any

logger = logging.getLogger()
logger.setLevel(logging.INFO)

FILE_PATH = "C:\\Users\\Garrison\\Downloads\\FY2025 Circulation Statistics.xlsm"

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


def _load_month(sheet_name: str, department: str) -> tuple[float, float]:
    df = pd.read_excel(FILE_PATH, sheet_name=sheet_name, header=None)
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

    logger.info(f"Building time series for department: {department}")

    records = []
    for sheet, short in MONTHS:
        print_total, nonprint_total = _load_month(sheet, department)
        records.append({
            "month":    short,
            "print":    print_total,
            "nonprint": nonprint_total,
            "total":    print_total + nonprint_total,
        })

    monthly = pd.DataFrame(records)
    x = list(range(12))
    month_labels = [r["month"] for r in records]

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
        f"FY2025 Circulation Time Series — {department}\nCharlotte Mecklenburg Library",
        fontsize=13, fontweight="bold", y=1.02,
    )

    # Plot 1: Print vs Non-Print line chart
    ax1 = axes[0, 0]
    ax1.plot(x, monthly["print"].values,    marker="o", linewidth=2, color="#2563EB", markersize=6, label="Print")
    ax1.plot(x, monthly["nonprint"].values, marker="s", linewidth=2, color="#D97706", markersize=6, label="Non-Print")
    ax1.fill_between(x, monthly["print"].values,    alpha=0.08, color="#2563EB")
    ax1.fill_between(x, monthly["nonprint"].values, alpha=0.08, color="#D97706")
    ax1.set_title("Print vs Non-Print Circulation", fontsize=11)
    ax1.set_xticks(x)
    ax1.set_xticklabels(month_labels, fontsize=9)
    ax1.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ax1.set_ylabel("Checkouts")
    ax1.legend(fontsize=9, framealpha=0.5)

    # Plot 2: Total circulation with value labels
    ax2 = axes[0, 1]
    vals = monthly["total"].values
    ax2.plot(x, vals, marker="o", linewidth=2, color="#16A34A", markersize=6)
    ax2.fill_between(x, vals, alpha=0.1, color="#16A34A")
    for i, v in enumerate(vals):
        ax2.annotate(
            f"{v:,.0f}", (i, v),
            textcoords="offset points", xytext=(0, 7),
            ha="center", fontsize=8, color="#16A34A",
        )
    ax2.set_title("Total Circulation", fontsize=11)
    ax2.set_xticks(x)
    ax2.set_xticklabels(month_labels, fontsize=9)
    ax2.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ax2.set_ylabel("Checkouts")

    # Plot 3: Stacked bar — print vs non-print composition
    ax3 = axes[1, 0]
    ax3.bar(x, monthly["print"].values,    width=0.6, color="#2563EB", label="Print",     edgecolor="white")
    ax3.bar(x, monthly["nonprint"].values, width=0.6, color="#D97706", label="Non-Print", edgecolor="white",
            bottom=monthly["print"].values)
    ax3.set_title("Print / Non-Print Composition", fontsize=11)
    ax3.set_xticks(x)
    ax3.set_xticklabels(month_labels, fontsize=9)
    ax3.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ax3.set_ylabel("Checkouts")
    ax3.legend(fontsize=9, framealpha=0.5)

    # Plot 4: Month-over-month % change in total
    ax4 = axes[1, 1]
    mom = monthly["total"].pct_change() * 100
    bar_colors = ["#16A34A" if v >= 0 else "#DC2626" for v in mom.fillna(0)]
    ax4.bar(x, mom.fillna(0), color=bar_colors, edgecolor="white", linewidth=0.5)
    ax4.axhline(0, color="#6B7280", linewidth=1)
    for i, v in enumerate(mom):
        if pd.notna(v):
            ax4.annotate(
                f"{v:+.1f}%", (i, v),
                textcoords="offset points",
                xytext=(0, 4 if v >= 0 else -12),
                ha="center", fontsize=7.5,
                color="#16A34A" if v >= 0 else "#DC2626",
            )
    ax4.set_title("Month-over-month % change (Total)", fontsize=11)
    ax4.set_xticks(x)
    ax4.set_xticklabels(month_labels, fontsize=9)
    ax4.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:+.0f}%"))
    ax4.set_ylabel("% change vs prior month")

    plt.tight_layout()

    out_path = f"FY2025_{department.replace(' ', '_')}_time_series.png"
    plt.savefig(out_path, bbox_inches="tight", dpi=150)
    logger.info(f"Saved → {out_path}")
    print(f"Saved → {out_path}")

    return {
        "statusCode": 200,
        "body": json.dumps({"output": out_path}),
    }
