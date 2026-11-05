"""Plain-language reasons for every block (T-41, D-08).

The text comes from templates filled with the calculated numbers, so it can't invent a reason and
reads the same in every demo.
"""
from __future__ import annotations

import pandas as pd

from src.data import HOLIDAY_WINDOWS, PLAN_KEY, load_labor_standard
from src.diagnosis import DEPT_NAMES, daily_demand, holiday_factors
from src.forecast import HOLIDAY_DATES, VALENTINE_UPLIFT, VALENTINES_DAY
from src.risk import cushion
from src.search import SERVICE_GOAL, needed_employees
from src.service import Curve

SHIFT_NAMES = {"OPEN": "Opening", "MID": "Midday", "EVE": "Evening"}
ASSUMPTIONS = {
    "A-01": "Usable cross-trained staff is limited to what the partner department has left after filling its own total from regular staff.",
    "A-02": "Sharing follows the shift code, even though Opening covers different clock hours by department.",
    "A-03": "The plan allows for callouts at historical rates, with about half backfilled, as if judges apply them.",
    "A-05": "The MLK window is a fair guide to the Presidents' Day window.",
    "A-06": "Valentine's Day adds 3% for Front End and Merchandising, as a stated judgment. History has no Valentine's Day.",
    "A-09": "The historical service curve applies to the planning week.",
    "A-10": "Borrowed staff are costed at the regular rate of the department they cover.",
    "A-11": "Borrowing a holiday effect adds forecast uncertainty on Feb 13-16.",
    "A-12": "DISRUPT's illness cluster has January's flu-week callout rates, on top of the availability cuts.",
    "A-13": "The service goal is a 95% chance of meeting target in each block.",
    "A-14": "A future week's demand level matches the average of the last four weeks.",
    "A-15": "Callout rates by situation are used as measured, even where few people stand behind them.",
}
DRIVER_LABELS = {
    "pre_holiday_weekend": "The weekend before Presidents' Day",
    "holiday_monday": "Presidents' Day",
}


def _money(value: float) -> str:
    return f"${abs(value):,.0f}"


def _percent(value: float) -> str:
    return f"{value * 100:.0f}%"


def demand_driver(row, factors: dict, valentine: dict[int, float]) -> str:
    """Why demand is what it is in this block."""
    parts = []
    window = HOLIDAY_WINDOWS[row.holiday_window_role]
    if window in DRIVER_LABELS:
        factor = factors[(row.dept_id, window)]
        change = "more" if factor >= 1 else "less"
        parts.append(
            f"{DRIVER_LABELS[window]}: {abs(factor - 1) * 100:.0f}% {change} {DEPT_NAMES[row.dept_id]} demand than a normal day, going by the MLK weekend."
        )
    else:
        parts.append(f"A normal {row.day_name} for {DEPT_NAMES[row.dept_id]}.")
    uplift = valentine.get(row.dept_id, 0.0)
    if row.day_date == VALENTINES_DAY and uplift > 0:
        parts.append(f"Valentine's Day adds {uplift * 100:.0f}%, as a judgment call.")
    if row.demand_multiplier != 1:
        parts.append(f"This scenario raises demand {(row.demand_multiplier - 1) * 100:.0f}%: {row.adjustment_reason}.")
    return " ".join(parts)


def why_text(row, need: int, goal: float) -> str:
    """The main reason for the recommendation."""
    change = row.recommended - row.draft_scheduled_employees
    draft_clause = f"The draft's {row.draft_scheduled_employees} people would run at {_percent(row.planned_utilization_draft)} utilization, with a {_percent(row.chance_met_draft)} chance of meeting target."
    if row.unfilled_draft > 0:
        draft_clause = (
            f"The draft schedules {row.draft_scheduled_employees} people, but only {row.fielded_draft} can be fielded. They would run at "
            f"{_percent(row.planned_utilization_draft)} utilization, with a {_percent(row.chance_met_draft)} chance of meeting target."
        )
    if row.chance_met < goal - 0.0005:
        return (
            f"This block can't reach the goal. It needs {need} people for a {_percent(goal)} chance of meeting target, but the plan can only field "
            f"{row.recommended}, using all of its own regular staff and overtime. {draft_clause} The plan's chance is {_percent(row.chance_met)}."
        )
    if change > 0:
        return f"{draft_clause} Adding {change} brings it to {_percent(row.planned_utilization)} utilization and a {_percent(row.chance_met)} chance."
    if change < 0:
        return f"{draft_clause} That is more than this block needs. With {row.recommended}, it runs at {_percent(row.planned_utilization)} utilization and still has a {_percent(row.chance_met)} chance."
    return f"{draft_clause} That already reaches the {_percent(goal)} goal, so there is no change."


def staffing_text(row) -> str:
    parts = [f"{row.fill_regular} regular"]
    if row.fill_flex:
        parts.append(f"{row.fill_flex} cross-trained")
    if row.fill_overtime:
        parts.append(f"{row.fill_overtime} overtime")
    return "Filled with " + ", ".join(parts) + "."


def cost_text(row) -> str:
    difference = row.cost - row.cost_draft
    if abs(difference) < 0.5:
        return f"{_money(row.cost)}, the same as the draft."
    direction = "more" if difference > 0 else "less"
    return f"{_money(row.cost)}, which is {_money(difference)} {direction} than the draft."


def assumptions_for(row) -> list[str]:
    """The assumptions this block's recommendation rests on."""
    ids = ["A-03", "A-09", "A-13", "A-14"]
    window = HOLIDAY_WINDOWS[row.holiday_window_role]
    if window != "normal":
        ids.append("A-05")
    if row.day_date in HOLIDAY_DATES:
        ids.append("A-11")
    if row.day_date == VALENTINES_DAY and row.dept_id != 95:
        ids.append("A-06")
    if row.callout_context == "flu_cluster":
        ids.append("A-12")
    if row.dept_id == 95 or row.callout_context == "day_after_holiday":
        ids.append("A-15")
    if row.dept_id != 95:
        ids.append("A-01")
    if row.dept_id != 95 and row.shift_code == "OPEN":
        ids.append("A-02")
    if row.fill_flex:
        ids.append("A-10")
    return sorted(ids)


def explain_plan(
    plan: pd.DataFrame,
    draft: pd.DataFrame,
    curves: dict[int, Curve],
    goal: float = SERVICE_GOAL,
    valentine: dict[int, float] | None = None,
) -> pd.DataFrame:
    """One row per block, with the recommendation and its reasons. Takes evaluate()'s results for the plan and the draft."""
    valentine = VALENTINE_UPLIFT if valentine is None else valentine
    factors = holiday_factors(daily_demand()).set_index(["dept_id", "window"])["factor"].to_dict()
    standard = load_labor_standard()
    keep = [*PLAN_KEY, "cost", "chance_met", "planned_utilization", "unfilled", "fielded"]
    frame = plan.merge(draft[keep], on=PLAN_KEY, suffixes=("", "_draft"), validate="one_to_one")

    rows = []
    for row in frame.itertuples():
        if row.is_open == 0:
            rows.append(
                {
                    "change": 0, "action": "Closed", "headline": "Closed", "why": "This department is closed in this block, so no staff are needed.",
                    "demand_driver": "", "staffing": "", "cost_effect": "", "service_effect": "", "cushion_people": 0, "cushion_demand": 0.0,
                    "cushion_text": "", "need": 0, "assumption_ids": [],
                }
            )
            continue
        change = int(row.recommended - row.draft_scheduled_employees)
        action = f"Add {change}" if change > 0 else f"Cut {-change}" if change < 0 else "No change"
        headline = (
            f"{action}: {row.draft_scheduled_employees} in the draft to {row.recommended} in the plan" if change else f"No change: {row.recommended} people"
        )
        need = needed_employees(row, curves, goal)
        workload = row.demand * standard[row.dept_id]
        people, demand_room = cushion(curves[row.dept_id], row.store_id, workload, int(row.fielded), row.paid_hours)
        rows.append(
            {
                "change": change,
                "action": action,
                "headline": headline,
                "why": why_text(row, need, goal),
                "demand_driver": demand_driver(row, factors, valentine),
                "staffing": staffing_text(row),
                "cost_effect": cost_text(row),
                "service_effect": f"Chance of meeting target goes from {_percent(row.chance_met_draft)} in the draft to {_percent(row.chance_met)} in the plan.",
                "cushion_people": people,
                "cushion_demand": demand_room,
                "cushion_text": (
                    f"Before a miss becomes the likelier outcome, this block can lose {people} {'person' if people == 1 else 'people'}, or take {demand_room * 100:.0f}% more demand."
                    if people or demand_room
                    else "This block has no cushion: a miss is already the likelier outcome."
                ),
                "need": need,
                "assumption_ids": assumptions_for(row),
            }
        )
    return pd.concat([frame.reset_index(drop=True), pd.DataFrame(rows)], axis=1)


def block_label(row) -> str:
    """A short name for a block, used in menus and tables."""
    return f"{row.day_date:%a %b} {row.day_date.day}, {DEPT_NAMES[row.dept_id]}, {SHIFT_NAMES[row.shift_code]}"
