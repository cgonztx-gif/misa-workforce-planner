"""What the app shows, kept apart from Streamlit so it can be tested directly."""
from __future__ import annotations

import pandas as pd

from src.explain import explain_plan
from src.forecast import forecast_daily
from src.search import SERVICE_GOAL, build_plan, evaluate, summarize
from src.service import Curve

DEFAULTS = {"goal": SERVICE_GOAL, "callouts": 1.0, "demand": 0.0}
# The ends and middle of the staffing board's color scale, also used to pick readable numbers.
BOARD_COLORS = {"cut": "#eb6834", "none": "#eef1f4", "add": "#2a78d6"}


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


def verdict_text(plan: dict, draft: dict, goal: float) -> str:
    """The answer in a sentence or two, shown before any detail."""
    hours = plan["hours"] - draft["hours"]
    cost = plan["cost"] - draft["cost"]
    hours_clause = f"adds {hours:,.0f} hours" if hours >= 0 else f"removes {-hours:,.0f} hours"
    text = (
        f"Against the draft, the plan {hours_clause} for ${abs(cost):,.0f} {'more' if cost >= 0 else 'less'}, "
        f"taking expected service from {draft['expected_met']:.1%} to {plan['expected_met']:.1%}."
    )
    below = int(plan["below_goal"])
    if below:
        text += f" {below} {'block' if below == 1 else 'blocks'} still can't reach a {goal * 100:g}% chance of meeting target, even with all their own staff."
    else:
        text += f" Every block reaches a {goal * 100:g}% chance of meeting target."
    unfilled = int(draft["unfilled"])
    if unfilled:
        text += f" The draft also schedules {unfilled} {'person' if unfilled == 1 else 'people'} more than can be fielded."
    return text


def _channels(color: str) -> tuple[int, ...]:
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))


def contrast_ratio(first: str, second: str) -> float:
    """WCAG contrast ratio between two colors, from 1 to 21."""

    def luminance(color: str) -> float:
        linear = [c / 3294.6 if c <= 10 else ((c / 255 + 0.055) / 1.055) ** 2.4 for c in _channels(color)]
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]

    lighter, darker = sorted((luminance(first), luminance(second)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def board_fill(change: float, limit: float) -> str:
    """A cell's fill for a change from the draft. Matches the chart's linear color scale."""
    share = min(abs(change) / max(limit, 1), 1.0)
    end = BOARD_COLORS["add"] if change >= 0 else BOARD_COLORS["cut"]
    mixed = [round(a + (b - a) * share) for a, b in zip(_channels(BOARD_COLORS["none"]), _channels(end))]
    return "#{:02x}{:02x}{:02x}".format(*mixed)


def board_cells(blocks: pd.DataFrame, goal: float, selected: str | None = None) -> pd.DataFrame:
    """One row per cell of the staffing board, with a readable number color and a ! for blocks below the goal."""
    cells = blocks.copy()
    limit = max(int(cells["change"].abs().max()), 1)
    below = cells["chance_met"] < goal - 0.0005
    cells["row"] = cells["department"] + ", " + cells["shift"]
    cells["text"] = cells["recommended"].astype(str) + below.map({True: " !", False: ""})
    cells["chance"] = (cells["chance_met"] * 100).round(0)
    cells["status"] = below.map({True: "Below the goal", False: "Reaches the goal"})
    fills = [board_fill(change, limit) for change in cells["change"]]
    cells["number_color"] = [max(("#000000", "#ffffff"), key=lambda ink: contrast_ratio(ink, fill)) for fill in fills]
    cells["selected"] = cells["label"] == selected
    cells["limit"] = limit
    return cells


def block_options(blocks: pd.DataFrame) -> list[str]:
    """Block labels, largest change first."""
    ordered = blocks.assign(size=blocks["change"].abs()).sort_values(["size", "day_date", "dept_id"], ascending=[False, True, True])
    return ordered["label"].tolist()
