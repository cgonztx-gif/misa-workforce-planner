"""Run the whole analysis and write outputs/. Start it with: python -m src.pipeline

Everything quoted in the analysis document comes from outputs/analysis_summary.json, so a figure in
the document can always be traced to this run.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from src.data import ROOT, load_labor_standard, load_planning_grid, open_history
from src.diagnosis import (
    DEPT_NAMES,
    callout_rates,
    daily_demand,
    draft_stress_test,
    gap_value,
    holiday_factors,
    kpis,
    service_bands,
    staffing_gaps,
)
from src.forecast import (
    LEVEL_WEEKS,
    VALENTINE_UPLIFT,
    analog_test,
    backtest,
    block_errors,
    error_table,
    forecast_blocks,
    forecast_daily,
    forecast_sd,
    split_test,
)
from src.search import SERVICE_GOAL, build_plan, evaluate, needed_employees, planning_inputs, summarize
from src.service import calibration, fit_all, holdout_scores, limits_table
from src.submission import TEAM_ID, fill_template, validate, write_submission

OUTPUTS = ROOT / "outputs"
GOALS = (0.85, 0.90, 0.925, 0.95, 0.975, 0.99)
VALENTINE_CASES = (0.0, 0.03, 0.05, 0.10)


def _records(frame: pd.DataFrame, digits: int = 4) -> list[dict]:
    clean = frame.copy()
    for column in clean.columns:
        if pd.api.types.is_datetime64_any_dtype(clean[column]):
            clean[column] = clean[column].dt.strftime("%Y-%m-%d")
    return json.loads(clean.round(digits).to_json(orient="records"))


def goal_tradeoff(inputs: pd.DataFrame, curves: dict) -> pd.DataFrame:
    """T-33: cost and expected service at each service goal."""
    rows = []
    for goal in GOALS:
        summary = summarize(evaluate(build_plan(inputs, curves, goal), "recommended", curves), goal)
        summary.insert(0, "goal", goal)
        rows.append(summary)
    return pd.concat(rows, ignore_index=True)


def valentine_sensitivity(curves: dict, plan_row: pd.DataFrame) -> pd.DataFrame:
    """T-22: what if the true Valentine's uplift differs from the one the plan assumes?

    The BASE plan stays fixed, and only Feb 14 blocks are scored against each possible uplift.
    Also shows what planning for that uplift would have cost.
    """
    rows = []
    for uplift in VALENTINE_CASES:
        values = {38: uplift, 92: uplift, 95: 0.0}
        inputs = planning_inputs(values)
        fixed = inputs.copy()
        fixed["recommended"] = plan_row["recommended"].to_numpy()
        scored = evaluate(fixed, "recommended", curves)
        replanned = evaluate(build_plan(inputs, curves), "recommended", curves)
        pick = lambda frame: frame[
            (frame["scenario_code"] == "BASE") & (frame["is_open"] == 1) & (frame["day_date"] == "2026-02-14") & (frame["dept_id"] != 95)
        ]
        rows.append(
            {
                "true_uplift": uplift,
                "our_plan_expected_met": pick(scored)["chance_met"].mean(),
                "replanned_expected_met": pick(replanned)["chance_met"].mean(),
                "replanned_feb14_cost": pick(replanned)["cost"].sum(),
                "our_plan_feb14_cost": pick(scored)["cost"].sum(),
            }
        )
    return pd.DataFrame(rows)


def buffer_test(inputs: pd.DataFrame, curves: dict) -> pd.DataFrame:
    """Q-02: what the allowance for callouts and forecast error costs, and what it buys.

    Builds three plans and scores each one three ways, because the scorer isn't published: with both
    risks, with forecast error but no callouts, and with neither.
    """
    no_callouts = inputs.assign(callout_rate=0.0)
    no_risk = no_callouts.assign(demand_sd=1e-6)
    plans = {
        "Allows for both risks (recommended)": build_plan(inputs, curves)["recommended"],
        "Allows for forecast error only": build_plan(no_callouts, curves)["recommended"],
        "Allows for neither": build_plan(no_risk, curves)["recommended"],
        "Current draft": inputs["draft_scheduled_employees"],
    }
    worlds = {"both_risks": inputs, "forecast_error_only": no_callouts, "neither": no_risk}
    rows = []
    for name, plan in plans.items():
        scored = {
            world: summarize(evaluate(frame.assign(candidate=plan.to_numpy()), "candidate", curves)).set_index("scenario_code")
            for world, frame in worlds.items()
        }
        for scenario in scored["both_risks"].index:
            rows.append(
                {
                    "plan": name,
                    "scenario_code": scenario,
                    "cost": scored["both_risks"].loc[scenario, "cost"],
                    "hours": scored["both_risks"].loc[scenario, "hours"],
                    **{f"met_{world}": scored[world].loc[scenario, "expected_met"] for world in worlds},
                }
            )
    return pd.DataFrame(rows)


def backtest_by_day_group(backtested: pd.DataFrame) -> pd.DataFrame:
    """Where the backtest edge comes from. Fri-Mon are the days whose benchmark average held holiday days."""
    groups = {"Fri-Mon": [5, 6, 7, 1], "Tue-Thu": [2, 3, 4], "Tue-Wed": [2, 3]}
    rows = []
    for name, days in groups.items():
        part = backtested[backtested["day_of_week"].isin(days)]
        rows.append(
            {
                "group": name,
                "rows": len(part),
                "model": float((part["model"] / part["demand"] - 1).abs().mean()),
                "benchmark": float((part["benchmark"] / part["demand"] - 1).abs().mean()),
            }
        )
    return pd.DataFrame(rows)


def base_shortfall_detail(evaluated: pd.DataFrame, plan: pd.DataFrame, inputs: pd.DataFrame, curves: dict) -> dict:
    """Details behind the capacity wording in BASE, including how far Feb 17 rests on a thin callout rate."""
    base = evaluated[(evaluated["scenario_code"] == "BASE") & (evaluated["is_open"] == 1)]
    short = base[base["chance_met"] < SERVICE_GOAL - 0.0005]
    feb14 = base[(base["day_date"] == "2026-02-14") & (base["dept_id"] != 95)]

    weekday_rate = callout_rates().set_index(["dept_id", "context"])["rate"][(95, "weekday")]
    is_feb17_pharmacy = (inputs["day_date"] == "2026-02-17") & (inputs["dept_id"] == 95)
    what_if = plan.assign(callout_rate=plan["callout_rate"].where(~is_feb17_pharmacy, weekday_rate))
    rescored = evaluate(what_if, "recommended", curves)
    feb17 = rescored[(rescored["scenario_code"] == "BASE") & (rescored["is_open"] == 1) & (rescored["day_date"] == "2026-02-17") & (rescored["dept_id"] == 95)]
    original = base[(base["day_date"] == "2026-02-17") & (base["dept_id"] == 95)]
    below_before = original["chance_met"] < SERVICE_GOAL - 0.0005
    return {
        "blocks": int(len(short)),
        "average_chance": float(short["chance_met"].mean()),
        "near_goal_blocks": int((short["chance_met"] >= 0.90).sum()),
        "holiday_blocks": int(short["day_date"].between("2026-02-13", "2026-02-16").sum()),
        "feb14_front_merch_blocks": int(len(feb14)),
        "feb14_front_merch_at_capacity": int((feb14["recommended"] >= feb14["capacity"]).sum()),
        "feb17_pharmacy_short": int(below_before.sum()),
        "feb17_pharmacy_short_at_weekday_rate": int((feb17["chance_met"] < SERVICE_GOAL - 0.0005).sum()),
        "feb17_weekday_rate": float(weekday_rate),
    }


def capacity_gaps(evaluated: pd.DataFrame, curves: dict) -> pd.DataFrame:
    """People each scenario would need beyond what capacity allows, by day and department."""
    open_rows = evaluated[evaluated["is_open"] == 1].copy()
    open_rows["need"] = [needed_employees(row, curves, SERVICE_GOAL) for row in open_rows.itertuples()]
    open_rows["gap"] = (open_rows["need"] - open_rows["recommended"]).clip(lower=0)
    open_rows["gap_hours"] = open_rows["gap"] * open_rows["paid_hours"]
    table = (
        open_rows.groupby(["scenario_code", "day_date", "dept_id"], as_index=False, sort=False)
        .agg(gap_people=("gap", "sum"), gap_hours=("gap_hours", "sum"), blocks_short=("gap", lambda g: int((g > 0).sum())))
    )
    table["department"] = table["dept_id"].map(DEPT_NAMES)
    return table[table["gap_people"] > 0]


def history_tradeoff(curves: dict, seed: int = 11, runs: int = 40) -> pd.DataFrame:
    """Rebuild the dashboard's simulated trade-off: staff history to a planned utilization and score it."""
    blocks = open_history()
    rng = np.random.default_rng(seed)
    standard = blocks["dept_id"].map(load_labor_standard()).to_numpy()
    rates = load_planning_grid().drop_duplicates(["store_id", "dept_id"]).set_index(["store_id", "dept_id"])["loaded_regular_hourly_cost"]
    rate = np.array([rates[(s, d)] for s, d in zip(blocks["store_id"], blocks["dept_id"])])
    lost_rate = (
        (blocks["callout_employees"] - blocks["backfill_employees"]).groupby(blocks["dept_id"]).sum()
        / blocks["scheduled_employees"].groupby(blocks["dept_id"]).sum()
    )
    loss = blocks["dept_id"].map(lost_rate).to_numpy()
    demand = blocks["shift_demand_units"].to_numpy()
    paid = blocks["paid_hours"].to_numpy()
    floor = blocks["min_staff"].to_numpy()
    actual_cost = blocks["labor_cost"].sum()
    rows = []
    groups = list(blocks.groupby(["dept_id", "store_id"]).indices.items())
    for target in (0.72, 0.74, 0.76, 0.78, 0.80, 0.82, 0.84, 0.86, 0.88):
        hours, cost, met = [], [], []
        for _ in range(runs):
            estimate = demand * np.exp(0.05 * rng.standard_normal(len(demand)))
            staff = np.maximum(np.ceil(estimate * standard / target / paid), floor).astype(int)
            worked = np.maximum(staff - rng.binomial(staff, loss), 1)
            u = demand * standard / (worked * paid)
            chance = np.empty(len(u))
            for (dept, store), rows_in_group in groups:
                chance[rows_in_group] = curves[dept].p_met(store, u[rows_in_group])
            hours.append((staff * paid).sum())
            cost.append((staff * paid * rate).sum())
            met.append(chance.mean())
        rows.append(
            {
                "target_util": target,
                "hours": float(np.mean(hours)),
                "cost": float(np.mean(cost)),
                "cost_vs_actual": float(np.mean(cost) / actual_cost - 1),
                "exp_pct_met": float(np.mean(met)),
            }
        )
    return pd.DataFrame(rows)


def run() -> dict:
    OUTPUTS.mkdir(exist_ok=True)
    blocks = open_history()
    curves = fit_all(blocks)
    inputs = planning_inputs()

    # Diagnosis.
    gaps = staffing_gaps(blocks)
    gaps.to_csv(OUTPUTS / "diagnosis_staffing_gaps.csv", index=False)
    values = gap_value(blocks)
    rates = callout_rates(blocks)
    rates.to_csv(OUTPUTS / "diagnosis_callout_rates.csv", index=False)
    bands = service_bands(blocks)
    bands.to_csv(OUTPUTS / "diagnosis_service_bands.csv", index=False)

    # Forecast.
    backtested = backtest()
    daily_forecast = forecast_daily()
    daily_forecast.to_csv(OUTPUTS / "forecast_daily.csv", index=False, date_format="%Y-%m-%d")
    block_forecast = forecast_blocks()
    block_forecast.to_csv(OUTPUTS / "forecast_blocks.csv", index=False, date_format="%Y-%m-%d")
    block_error = block_errors()
    analog = analog_test()

    # Service.
    limits = limits_table(curves)
    limits.to_csv(OUTPUTS / "service_limits.csv", index=False)
    holdout = holdout_scores(blocks)

    # Plans.
    plan = build_plan(inputs, curves)
    evaluated = evaluate(plan, "recommended", curves)
    draft = evaluate(plan, "draft_scheduled_employees", curves)
    summary = summarize(evaluated)
    draft_summary = summarize(draft)
    columns = [
        "scenario_id", "scenario_code", "store_id", "dept_id", "department_group", "day_date", "day_name", "shift_code",
        "is_open", "min_staff", "paid_hours", "demand", "demand_sd", "callout_rate", "draft_scheduled_employees",
        "recommended", "available_regular_employees", "usable_flex", "max_overtime_employees", "capacity",
        "fill_regular", "fill_flex", "fill_overtime", "cost", "planned_utilization", "chance_met", "availability_note",
    ]
    comparison = evaluated[columns].merge(
        draft[["scenario_id", "store_id", "dept_id", "day_date", "shift_code", "cost", "chance_met", "planned_utilization", "unfilled"]],
        on=["scenario_id", "store_id", "dept_id", "day_date", "shift_code"],
        suffixes=("", "_draft"),
        validate="one_to_one",
    )
    comparison["below_service_goal"] = (comparison["is_open"] == 1) & (comparison["chance_met"] < SERVICE_GOAL - 0.0005)
    comparison.to_csv(OUTPUTS / "plan_vs_draft.csv", index=False, date_format="%Y-%m-%d")

    filled = fill_template(plan)
    problems = validate(filled)
    write_submission(filled, OUTPUTS / "TEAM_SUBMISSION_TEMPLATE_filled.csv")

    open_plan = evaluated[evaluated["is_open"] == 1]
    below_goal = open_plan[open_plan["chance_met"] < SERVICE_GOAL - 0.0005]
    below_goal_table = (
        below_goal.groupby(["scenario_code", "day_date"], as_index=False, sort=False)
        .agg(blocks=("chance_met", "size"), average_chance=("chance_met", "mean"))
    )
    by_dept = (
        open_plan.merge(
            draft[["scenario_id", "store_id", "dept_id", "day_date", "shift_code", "chance_met", "cost", "hours"]],
            on=["scenario_id", "store_id", "dept_id", "day_date", "shift_code"],
            suffixes=("", "_draft"),
        )
        .groupby(["scenario_code", "dept_id"], as_index=False, sort=False)
        .agg(
            hours=("hours", "sum"),
            hours_draft=("hours_draft", "sum"),
            cost=("cost", "sum"),
            cost_draft=("cost_draft", "sum"),
            expected_met=("chance_met", "mean"),
            expected_met_draft=("chance_met_draft", "mean"),
        )
    )
    by_dept["department"] = by_dept["dept_id"].map(DEPT_NAMES)

    daily_plan = (
        open_plan.merge(
            draft[["scenario_id", "store_id", "dept_id", "day_date", "shift_code", "chance_met", "hours"]],
            on=["scenario_id", "store_id", "dept_id", "day_date", "shift_code"],
            suffixes=("", "_draft"),
        )
        .groupby(["scenario_code", "day_date"], as_index=False, sort=False)
        .agg(
            hours=("hours", "sum"),
            hours_draft=("hours_draft", "sum"),
            expected_met=("chance_met", "mean"),
            expected_met_draft=("chance_met_draft", "mean"),
        )
    )

    stress = draft_stress_test(blocks)
    tradeoff = goal_tradeoff(inputs, curves)
    tradeoff.to_csv(OUTPUTS / "goal_tradeoff.csv", index=False)
    history = history_tradeoff(curves)
    valentine = valentine_sensitivity(curves, plan)
    buffer = buffer_test(inputs, curves)
    gaps_after_plan = capacity_gaps(evaluated, curves)
    gaps_after_plan.to_csv(OUTPUTS / "capacity_gaps.csv", index=False, date_format="%Y-%m-%d")

    summary_json = {
        "service_goal": SERVICE_GOAL,
        "level_weeks": LEVEL_WEEKS,
        "valentine_uplift": {DEPT_NAMES[k]: v for k, v in VALENTINE_UPLIFT.items()},
        "team_id": TEAM_ID,
        "kpi": {k: float(v) for k, v in kpis().items()},
        "gap_value": _records(values, 2),
        "worst_short": _records(gaps.sort_values("net_hours").head(8)),
        "worst_over": _records(gaps.sort_values("net_hours", ascending=False).head(8)),
        "callout_rates": _records(rates),
        "service_bands": _records(bands),
        "holiday_factors": _records(holiday_factors(daily_demand(blocks))),
        "backtest_daily": _records(error_table(backtested, ("model", "model_all_weeks", "benchmark"))),
        "backtest_by_week": _records(
            pd.concat(
                [error_table(backtested[backtested["week"] == week]).iloc[[0]].assign(week=week) for week in (4, 5, 6)]
            )
        ),
        "backtest_block": _records(error_table(block_error, ("model", "benchmark"), "shift_demand_units")),
        "backtest_by_day_group": _records(backtest_by_day_group(backtested)),
        "base_shortfall": base_shortfall_detail(evaluated, plan, inputs, curves),
        "analog_test": _records(error_table(analog, ("model", "model_no_holiday", "benchmark"))),
        "split_test": _records(split_test()),
        "forecast_sd": _records(forecast_sd()),
        "forecast_by_day": _records(
            daily_forecast.groupby(["dept_id", "day_date"], as_index=False)[["model_forecast", "daily_forecast", "benchmark"]].sum(), 1
        ),
        "forecast_week": _records(
            daily_forecast.groupby("dept_id", as_index=False)[["model_forecast", "daily_forecast", "benchmark"]].sum(), 1
        ),
        "service_limits": _records(limits, 3),
        "service_brier": {
            "model": float(((holdout["p_met"] - holdout["met_target"]) ** 2).mean()),
            "base_rate": float(((holdout["base_rate"] - holdout["met_target"]) ** 2).mean()),
        },
        "service_calibration": _records(calibration(holdout), 3),
        "curves": {
            DEPT_NAMES[dept]: {
                "levels": {str(store): float(level) for store, level in curve.levels.items()},
                "slope": float(curve.slope),
                "extra_slope": float(curve.extra_slope),
                "knot": float(curve.knot),
                "cap": float(curve.cap),
                "scatter": float(curve.scatter),
            }
            for dept, curve in curves.items()
        },
        "plan_summary": _records(summary, 3),
        "draft_summary": _records(draft_summary, 3),
        "plan_by_dept": _records(by_dept, 3),
        "plan_by_day": _records(daily_plan, 3),
        "below_goal_by_day": _records(below_goal_table, 3),
        "goal_tradeoff": _records(tradeoff, 3),
        "history_tradeoff": _records(history, 4),
        "valentine_sensitivity": _records(valentine, 3),
        "buffer_test": _records(buffer, 3),
        "capacity_gaps": _records(gaps_after_plan, 1),
        "stress_share_over85": _records(
            stress.assign(over=stress["utilization"] > 0.85)
            .groupby(["scenario_code", "day_date", "dept_id"], as_index=False, sort=False)["over"].mean(), 3
        ),
        "validator_problems": problems,
    }
    (OUTPUTS / "analysis_summary.json").write_text(json.dumps(summary_json, indent=1), encoding="utf-8")
    return summary_json


if __name__ == "__main__":
    result = run()
    print("Validator problems:", result["validator_problems"] or "none")
    for row in result["plan_summary"]:
        print(row)
    print("Wrote", Path(OUTPUTS))
