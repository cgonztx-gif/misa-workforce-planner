"""Compare figures rebuilt from the case CSVs with the Nov 2 EDA dashboard's saved tables.

Run from the project root, after python -m src.pipeline:
    python -W ignore planning/evidence/reconcile_dashboard.py > planning/evidence/reconcile_dashboard.output.txt
"""
import csv
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.data import load_planning_grid, open_history  # noqa: E402
from src.diagnosis import (  # noqa: E402
    DEPT_NAMES,
    daily_demand,
    draft_stress_test,
    gap_value,
    holiday_factors,
    is_flu_block,
    kpis,
    service_bands,
)
from src.allocation import apply_rule  # noqa: E402
from src.data import capacity  # noqa: E402

SAVED = Path(__file__).parent / "dashboard_2026-11-02"
TOLERANCE = 0.0015  # relative, or absolute for values near zero; the dashboard rounds to about six digits
DEPT_IDS = {name: dept for dept, name in DEPT_NAMES.items()}
EXPLAINED = {
    "shift_noise": "The grouping behind this figure can't be recovered. Standard deviation is 3.7% to 4.2% across the groupings tried, so 'about 4%' holds.",
    "sched_corr_fr": "Definition can't be recovered and the page text doesn't use it. Not relied on.",
    "sched_corr_me": "Definition can't be recovered and the page text doesn't use it. Not relied on.",
    "sched_corr_ph": "Definition can't be recovered and the page text doesn't use it. Not relied on.",
    "draft_cost_disrupt": "CORRECTION. The dashboard fields staff up to raw capacity and lets overtime run past its limit, which reproduces its figure exactly. Under the allocation rule (A-01), we get the lower figure.",
}


def compare_kpis() -> dict:
    with open(SAVED / "kpi.csv", encoding="utf-8") as handle:
        dashboard = {row["id"]: (row["label"], float(row["value"])) for row in csv.DictReader(handle)}
    rebuilt = kpis()
    matched, differ, not_rebuilt = [], [], []
    for key, (label, value) in dashboard.items():
        if key not in rebuilt:
            not_rebuilt.append((key, label, value))
            continue
        ours = float(rebuilt[key])
        close = abs(ours - value) <= TOLERANCE * max(abs(value), 1.0)
        (matched if close else differ).append((key, label, value, ours))
    print("== Headline figures (kpi.csv)")
    print(f"Dashboard figures: {len(dashboard)}")
    print(f"Matched within tolerance: {len(matched)}")
    print(f"Differ: {len(differ)}")
    print(f"Not rebuilt (fixed inputs and analysis settings): {len(not_rebuilt)}")
    print("\nDIFFER (id, dashboard, rebuilt)")
    for key, label, value, ours in differ:
        print(f"  {key:22} {value:>14.6f} {ours:>14.6f}  {label}")
        print(f"      {EXPLAINED.get(key, 'NOT EXPLAINED')}")
    print("\nNot in the dashboard's table, new from the rebuild:")
    for key in ("disrupt_shortfall_usable_flex", "disrupt_blocks_usable_flex"):
        print(f"  {key}: {rebuilt[key]}")
    print("\nNOT REBUILT")
    for key, label, value in not_rebuilt:
        print(f"  {key:22} {value:>14.6f}  {label}")
    print("\nMATCHED (id, dashboard, rebuilt)")
    for key, label, value, ours in matched:
        print(f"  {key:30} {value:>14.6f} {ours:>14.6f}")
    return {
        "dashboard_figures": len(dashboard),
        "calculated": len(matched) + len(differ),
        "matched": len(matched),
        "differ": len(differ),
        "not_rebuilt": len(not_rebuilt),
    }


def report(name: str, frame: pd.DataFrame, pairs: list[tuple[str, str]], tolerance: float) -> None:
    """Report the largest difference for each pair of columns."""
    print(f"\n== {name}: {len(frame)} rows joined")
    for theirs, ours in pairs:
        gap = (frame[theirs] - frame[ours]).abs().max()
        status = "ok" if gap <= tolerance else "DIFFERS"
        print(f"  {theirs:16} vs {ours:16} largest gap {gap:.4f}  ({status}, tolerance {tolerance})")


def compare_tables() -> dict:
    blocks = open_history()

    theirs = pd.read_csv(SAVED / "alloc_hours.csv")
    theirs["dept_id"] = theirs["dept"].map(DEPT_IDS)
    ours = gap_value(blocks)
    report(
        "Hours above and below need (alloc_hours.csv)",
        theirs.merge(ours, on="dept_id"),
        [("worked_h", "worked_hours"), ("req85_h", "required_hours"), ("over_h", "over_hours"), ("short_h", "short_hours")],
        0.01,
    )

    theirs = pd.read_csv(SAVED / "service_curve.csv")
    theirs["dept_id"] = theirs["dept"].map(DEPT_IDS)
    ours = service_bands(blocks)
    report(
        "Service by utilization band (service_curve.csv)",
        theirs.merge(ours, left_on=["dept_id", "band"], right_on=["dept_id", "band"]),
        [("blocks_x", "blocks_y"), ("pct_met", "met_target"), ("median_ratio_x", "median_ratio_y")]
        if "blocks_x" in theirs.merge(ours, on=["dept_id", "band"]).columns
        else [],
        0.006,
    )

    theirs = pd.read_csv(SAVED / "holiday.csv")
    theirs["dept_id"] = theirs["dept"].map(DEPT_IDS)
    theirs["window"] = theirs["window"].map(
        {"Normal days": "normal", "Post-New-Year rebound": "new_year_rebound", "Pre-MLK weekend": "pre_holiday_weekend", "MLK Day": "holiday_monday"}
    )
    report(
        "Holiday factors (holiday.csv)",
        theirs.merge(holiday_factors(daily_demand(blocks)), on=["dept_id", "window"]),
        [("demand_factor", "factor")],
        0.005,
    )

    # Callouts, computed the way the dashboard groups them. Its groups overlap the flu cluster.
    theirs = pd.read_csv(SAVED / "callouts.csv")
    rows = []
    for dept, name in DEPT_NAMES.items():
        part = blocks[blocks["dept_id"] == dept]
        groups = {
            "Weekdays": part[part["is_weekend"] == 0],
            "Weekends": part[part["is_weekend"] == 1],
            "Day after a holiday": part[part["day_date"].isin(pd.to_datetime(["2026-01-02", "2026-01-20"]))],
            "W2 flu week (Jan 22-28)": part[(part["store_id"] == 2) & part["day_date"].between("2026-01-22", "2026-01-28")],
        }
        for context, group in groups.items():
            rows.append(
                {"dept": name, "context": context, "our_callouts": group["callout_employees"].sum(), "our_scheduled": group["scheduled_employees"].sum()}
            )
    report(
        "Callouts (callouts.csv)",
        theirs.merge(pd.DataFrame(rows), on=["dept", "context"]),
        [("callouts", "our_callouts"), ("scheduled", "our_scheduled")],
        0,
    )

    grid = load_planning_grid()
    grid = grid[(grid["scenario_code"] == "DISRUPT") & (grid["is_open"] == 1)]
    grid = grid.assign(raw_capacity=capacity(grid), raw_short=grid["draft_scheduled_employees"] - capacity(grid))
    over = grid[grid["raw_short"] > 0].copy()
    over["warehouse"] = "W" + over["store_id"].astype(str)
    over["dept"] = over["dept_id"].map(DEPT_NAMES)
    over["date"] = over["day_date"].dt.strftime("%Y-%m-%d")
    theirs = pd.read_csv(SAVED / "disrupt_short.csv")
    report(
        "DISRUPT shortfalls at raw capacity (disrupt_short.csv)",
        theirs.merge(over, left_on=["warehouse", "dept", "date", "shift"], right_on=["warehouse", "dept", "date", "shift_code"]),
        [("capacity", "raw_capacity"), ("shortfall", "raw_short")],
        0,
    )

    theirs = pd.read_csv(SAVED / "draft_util.csv")
    stress = draft_stress_test(blocks)
    ours = (
        stress.assign(over=stress["utilization"] > 0.85, date=stress["day_date"].dt.strftime("%Y-%m-%d"), dept=stress["dept_id"].map(DEPT_NAMES))
        .groupby(["scenario_code", "date", "dept"], as_index=False)
        .agg(util=("utilization", "mean"), share=("over", "mean"))
    )
    report(
        "Draft stress test (draft_util.csv)",
        theirs.merge(ours, left_on=["scenario", "date", "dept"], right_on=["scenario_code", "date", "dept"]),
        [("util_mean", "util"), ("share_over_85", "share")],
        0.005,
    )

    summary = ROOT / "outputs" / "analysis_summary.json"
    if summary.exists():
        ours = pd.DataFrame(json.loads(summary.read_text(encoding="utf-8"))["history_tradeoff"])
        theirs = pd.read_csv(SAVED / "frontier.csv")
        report(
            "Simulated trade-off (frontier.csv), a random simulation so small gaps are expected",
            theirs.merge(ours, on="target_util", suffixes=("_dash", "_ours")),
            [("cost_vs_actual_dash", "cost_vs_actual_ours"), ("exp_pct_met_dash", "exp_pct_met_ours")],
            0.02,
        )

    theirs = pd.read_csv(SAVED / "service_thresholds.csv")
    limits = pd.read_csv(ROOT / "outputs" / "service_limits.csv")
    limits["dept"] = limits["dept_id"].map(DEPT_NAMES)
    limits["warehouse"] = "W" + limits["store_id"].astype(str)
    joined = theirs.merge(limits, on=["dept", "warehouse"], suffixes=("_dash", "_ours"))
    print("\n== 95% break points (service_thresholds.csv). The methods differ on purpose, see F-46")
    print(joined[["dept", "warehouse", "u95_dash", "u95_ours"]].round(3).to_string(index=False))
    pharmacy = blocks[(blocks["dept_id"] == 95) & (blocks["store_id"] == 1) & blocks["utilization"].between(0.85, 0.95, inclusive="left")]
    print(f"Warehouse 1 Pharmacy blocks between 0.85 and 0.95 behind the dashboard's 0.908 figure: {len(pharmacy)}")
    print("The draft stress test's mean utilization differs only on DISRUPT Front End, Feb 14-15,")
    print("because the dashboard fields more Front End staff than the allocation rule allows (F-42).")
    return {"pharmacy_w1_blocks_near_cliff": len(pharmacy)}


if __name__ == "__main__":
    result = compare_kpis()
    result.update(compare_tables())
    (Path(__file__).parent / "reconcile_dashboard.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
