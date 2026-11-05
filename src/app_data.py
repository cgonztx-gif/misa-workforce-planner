"""What the app shows, kept apart from Streamlit so it can be tested directly."""
from __future__ import annotations

import pandas as pd

from src.explain import explain_plan
from src.forecast import forecast_daily
from src.search import SERVICE_GOAL, build_plan, evaluate, summarize
from src.service import Curve

DEFAULTS = {"goal": SERVICE_GOAL, "callouts": 1.0, "demand": 0.0}


def adjust_inputs(inputs: pd.DataFrame, callouts: float = 1.0, demand: float = 0.0) -> pd.DataFrame:
    """Apply the what-if settings: callouts as a multiple of history, demand as a change from forecast."""
    return inputs.assign(callout_rate=inputs["callout_rate"] * callouts, demand=inputs["demand"] * (1 + demand))


def run_scenario(
    inputs: pd.DataFrame,
    curves: dict[int, Curve],
    scenario: str,
    goal: float = SERVICE_GOAL,
    callouts: float = 1.0,
    demand: float = 0.0,
) -> dict:
    """Plan one scenario under the what-if settings. The draft is scored under the same conditions."""
    part = adjust_inputs(inputs[inputs["scenario_code"] == scenario].reset_index(drop=True), callouts, demand)
    plan = build_plan(part, curves, goal)
    evaluated = evaluate(plan, "recommended", curves)
    draft = evaluate(plan, "draft_scheduled_employees", curves)
    explained = explain_plan(evaluated, draft, curves, goal)
    return {
        "explained": explained,
        "demand": demand_view(explained),
        "plan_summary": summarize(evaluated, goal).iloc[0].to_dict(),
        "draft_summary": summarize(draft, goal).iloc[0].to_dict(),
    }


def demand_view(explained: pd.DataFrame) -> pd.DataFrame:
    """Daily demand under this scenario against the benchmark, per warehouse and department."""
    open_rows = explained[explained["is_open"] == 1]
    daily = open_rows.groupby(["store_id", "dept_id", "day_date", "day_name"], as_index=False).agg(
        forecast=("demand", "sum"),
        driver=("demand_driver", "first"),
        multiplier=("demand_multiplier", "max"),
    )
    daily["multiplier"] = daily["multiplier"].astype(float)
    benchmark = forecast_daily()[["store_id", "dept_id", "day_date", "benchmark"]]
    daily = daily.merge(benchmark, on=["store_id", "dept_id", "day_date"], validate="one_to_one")
    daily["vs_benchmark"] = daily["forecast"] / daily["benchmark"] - 1
    return daily
