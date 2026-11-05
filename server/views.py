"""Payloads for /api/meta, /api/compare, /api/tradeoff, /api/playbook, /api/diagnosis and /api/methods."""
from __future__ import annotations

import ast
from pathlib import Path

import pandas as pd

from server import content
from server.content import DEPARTMENTS, HOLIDAYS, SCENARIOS, SHIFTS, WAREHOUSES, day_label, short_day_label, warehouse_label
from server.payloads import GROUPS
from server.serialize import records
from src.data import ROOT


def _named(rows: list[dict], key: str = "dept_id") -> list[dict]:
    """Add department and warehouse names to summary rows that carry ids."""
    out = []
    for row in rows:
        row = dict(row)
        dept = row.get(key)
        if isinstance(dept, (int, float)) and int(dept) in DEPARTMENTS:
            row["department"] = DEPARTMENTS[int(dept)]["name"]
        if isinstance(row.get("group"), (int, float)) and int(row["group"]) in DEPARTMENTS:
            row["department"] = DEPARTMENTS[int(row["group"])]["name"]
        elif row.get("group") == "All":
            row["department"] = "All departments"
        if isinstance(row.get("store_id"), (int, float)) and int(row["store_id"]) in WAREHOUSES:
            row["warehouse"] = warehouse_label(row["store_id"])
        if isinstance(row.get("day_date"), str):
            row["day"] = day_label(pd.Timestamp(row["day_date"]))
        out.append(row)
    return out


def meta(grid: pd.DataFrame, assumptions: list[dict], defaults: dict) -> dict:
    days = []
    for day in sorted(grid["day_date"].unique()):
        day = pd.Timestamp(day)
        iso = f"{day:%Y-%m-%d}"
        row = grid[grid["day_date"] == day].iloc[0]
        days.append(
            {
                "date": iso, "label": day_label(day), "short": short_day_label(day), "weekday": row["day_name"],
                "holiday": HOLIDAYS.get(iso), "holiday_window": iso in HOLIDAYS, "day_type": row["day_type"],
            }
        )
    return {
        "product": content.PRODUCT,
        "notice": content.NOTICE,
        "week": {"start": days[0]["date"], "end": days[-1]["date"], "label": content.WEEK_LABEL},
        "scenarios": [{"code": code, **info} for code, info in SCENARIOS.items()],
        "warehouses": [{"id": store, "label": label, "size": size, "name": f"{label} ({size})"} for store, (label, size) in WAREHOUSES.items()],
        "departments": [
            {
                "id": dept, "name": info["name"], "service_target": content.service_target(dept), "metric": info["metric"],
                "target_value": info["target_value"], "target_unit": info["unit"], "demand_unit": info["demand_unit"],
            }
            for dept, info in DEPARTMENTS.items()
        ],
        "shifts": [{"code": code, "name": name} for code, name in SHIFTS.items()],
        "days": days,
        "defaults": defaults,
        "what_if_limits": content.LIMITS,
        "glossary": [{"term": term, "definition": text} for term, text in content.GLOSSARY],
        "assumptions": assumptions,
    }


def compare(plans: dict[str, dict]) -> dict:
    """All three scenarios side by side, plan against draft, overall and by department and warehouse."""
    base = plans["BASE"]["totals"]["all"]["plan"]
    rows = []
    for code, payload in plans.items():
        totals = payload["totals"]
        overall = totals["all"]
        rows.append(
            {
                "code": code, **SCENARIOS[code],
                "plan": overall["plan"], "draft": overall["draft"], "change": overall["change"], "verdict": overall["verdict"],
                "vs_base": {key: overall["plan"][key] - base[key] for key in ("employees", "hours", "cost", "overtime_hours", "expected_met", "below_goal")},
                "by_department": overall["by_department"],
                "by_warehouse": [
                    {"store_id": int(group), "warehouse": warehouse_label(int(group)), **{k: totals[group][k] for k in ("plan", "draft", "change", "verdict")}}
                    for group in GROUPS if group != "all"
                ],
                "alerts": overall["alerts"],
            }
        )
    return {"goal": plans["BASE"]["goal"], "scenarios": rows}


def tradeoff(summary: dict, goal_table: pd.DataFrame, goal: float) -> dict:
    curves = {}
    for code, part in goal_table.groupby("scenario_code", sort=False):
        part = part.sort_values("goal").reset_index(drop=True)
        points = []
        for i, row in part.iterrows():
            point = {**row.to_dict(), "selected": abs(row["goal"] - goal) < 1e-9, "cost_per_point": None}
            if i:
                gain = (row["expected_met"] - part.loc[i - 1, "expected_met"]) * 100
                point["cost_per_point"] = (row["cost"] - part.loc[i - 1, "cost"]) / gain if gain > 0 else None
            points.append(point)
        curves[code] = points
    worlds = [
        {"id": "both_risks", "label": "Callouts and forecast error", "text": "Callouts at historical rates, about half backfilled, and demand off forecast by its held-out error."},
        {"id": "forecast_error_only", "label": "Forecast error only", "text": "Demand off forecast, but nobody calls out."},
        {"id": "neither", "label": "Neither", "text": "Demand lands exactly on forecast and nobody calls out."},
    ]
    return {
        "goal": goal,
        "goals": curves,
        "callout_allowance": {"plans": summary["buffer_test"], "worlds": worlds, "note": "Each plan is scored three ways, because the case doesn't publish how judges score service."},
        "history_tradeoff": summary["history_tradeoff"],
    }


def _tightest(explained: pd.DataFrame, limit: int = 8) -> list[dict]:
    open_rows = explained[explained["is_open"] == 1].sort_values(["cushion_people", "cushion_demand", "day_date", "dept_id"])
    return [
        {
            "key": f"{r.scenario_code}|{r.store_id}|{r.dept_id}|{r.day_date:%Y-%m-%d}|{r.shift_code}",
            "label": f"{day_label(r.day_date)}, {DEPARTMENTS[r.dept_id]['name']}, {SHIFTS[r.shift_code]}",
            "store_id": int(r.store_id), "warehouse": warehouse_label(r.store_id), "plan": int(r.recommended),
            "cushion_people": int(r.cushion_people), "cushion_demand": float(r.cushion_demand), "cushion_text": r.cushion_text,
            "chance": float(r.chance_met),
        }
        for r in open_rows.head(limit).itertuples()
    ]


def playbook(results: dict[str, dict], actions: dict, rules: list[dict], pto: pd.DataFrame, gaps: pd.DataFrame) -> dict:
    tightest = {}
    for code, result in results.items():
        explained = result["explained"]
        tightest[code] = {group: _tightest(explained if group == "all" else explained[explained["store_id"] == int(group)]) for group in GROUPS}
    pto = pto.sort_values("kept_per_block").reset_index(drop=True)
    start, best = pto.iloc[0], pto.loc[pto["blocks_below_goal"].idxmin()]
    intro = (
        f"Holiday PTO is a main cause of the Feb 14-16 shortage. In BASE, {int(start['blocks_below_goal'])} blocks can't reach the goal as things stand. "
        "This shows what happens if the warehouses keep some of those people working, never more than each block lost against recent weeks. "
        "Cost falls because regular staff replace overtime. The data doesn't show how much PTO is already approved, so this assumes some of it can still be limited."
    )
    headline = (
        f"Keeping up to {int(best['kept_per_block'])} people per block from holiday PTO cuts blocks below the goal from "
        f"{int(start['blocks_below_goal'])} to {int(best['blocks_below_goal'])}, raises expected service from {start['expected_met']:.1%} to "
        f"{best['expected_met']:.1%}, and lowers cost by ${start['cost'] - best['cost']:,.0f}."
    )
    return {
        "scenarios": {code: {**actions[code], **SCENARIOS[code]} for code in results},
        "on_the_day": rules,
        "pto": {"intro": intro, "headline": headline, "assumption": "A-16", "rows": records(pto)},
        "tightest": tightest,
        "capacity_gaps": _named(records(gaps)),
    }


def diagnosis(summary: dict, bands: pd.DataFrame, gaps: pd.DataFrame, rates: pd.DataFrame) -> dict:
    kpi = summary["kpi"]
    keep = [
        "pct_met_all", "pct_met_38", "pct_met_92", "pct_met_95", "met_below_84", "met_85_90", "met_above_90", "blocks_above_90",
        "over_hours", "short_hours", "over_value", "callout_rate_all", "backfill_share", "labor_cost_6wk", "cost_per_week",
        "sched_corr_fr", "sched_corr_me", "sched_corr_ph", "worked_hours", "sched_hours",
    ]
    return {
        "service_bands": _named(records(bands)),
        "staffing_gaps": _named(records(gaps)),
        "worst_short": _named(summary["worst_short"]),
        "worst_over": _named(summary["worst_over"]),
        "gap_value": _named(summary["gap_value"]),
        "callout_rates": _named(records(rates)),
        "draft_stress": _named(summary["stress_share_over85"]),
        "kpi": {key: kpi[key] for key in keep if key in kpi},
        "notes": {
            "service_bands": "Share of historical blocks meeting target, by worked utilization in five-point bands.",
            "staffing_gaps": "Hours over or under what an 85% utilization ceiling needs, by warehouse, department, day type and shift, over six weeks.",
            "callout_rates": "Callouts per scheduled employee, by department and situation, and the share backfilled.",
        },
    }


def count_tests(folder: Path | None = None) -> dict:
    """Test cases in tests/, counting each parametrized case, read from the source with no test run."""
    folder = folder or ROOT / "tests"
    total, files = 0, 0
    for path in sorted(folder.glob("test_*.py")):
        files += 1
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test_"):
                cases = 1
                for decorator in node.decorator_list:
                    if isinstance(decorator, ast.Call) and ast.unparse(decorator.func).endswith("parametrize") and len(decorator.args) > 1:
                        values = decorator.args[1]
                        cases *= len(values.elts) if isinstance(values, (ast.List, ast.Tuple)) else 1
                total += cases
    return {"count": total, "files": files, "how": "Test cases in tests/, with each parametrized case counted once."}


def methods(summary: dict, limits: pd.DataFrame, assumptions: list[dict]) -> dict:
    return {
        "notice": content.NOTICE,
        "engine": [{"step": step, "text": text} for step, text in content.ENGINE_STEPS],
        "forecast": {
            "backtest_daily": _named(summary["backtest_daily"]),
            "backtest_block": _named(summary["backtest_block"]),
            "backtest_by_week": _named(summary["backtest_by_week"]),
            "backtest_by_day_group": summary["backtest_by_day_group"],
            "forecast_sd": _named(summary["forecast_sd"]),
            "level_weeks": summary["level_weeks"],
        },
        "service": {
            "limits": _named(records(limits)),
            "brier": summary["service_brier"],
            "calibration": summary["service_calibration"],
            "curves": summary["curves"],
        },
        "plan": {"service_goal": summary["service_goal"], "validator_problems": summary["validator_problems"], "team_id": summary["team_id"]},
        "tests": count_tests(),
        "assumptions": assumptions,
        "documents": content.DOCUMENTS,
    }
