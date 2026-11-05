"""The leader playbook (T-42, R-20, R-23): what to do before the week and when conditions shift.

The actions are advice, but every number comes from the plan, so the text updates with it.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from src.data import load_history
from src.diagnosis import DEPT_NAMES
from src.search import SERVICE_GOAL, build_plan, evaluate, summarize
from src.service import Curve

WAREHOUSE_NAMES = {1: "Warehouse 1", 2: "Warehouse 2", 4: "Warehouse 4"}
PTO_NOTE = "Holiday-weekend PTO requests"
KEYS = ["store_id", "dept_id", "day_of_week", "shift_code"]


def _whole(value: float) -> int:
    """Round halves away from zero, as the web app's number formatting does. Python's own formatting rounds a
    half to the even number, so 974.5 overtime hours would read 974 here and 975 on every page (F-74)."""
    return int(math.floor(abs(value) + 0.5)) * (1 if value >= 0 else -1)


def pto_drop(inputs: pd.DataFrame) -> pd.Series:
    """Regular staff each PTO block is down, against the same weekday and shift over the last three normal weeks."""
    history = load_history()
    recent = history[(history["is_open"] == 1) & (history["holiday_window_role"] == "Normal") & (history["day_date"] >= "2026-01-22")]
    usual = recent.groupby(KEYS)["available_regular_employees"].mean()
    index = pd.MultiIndex.from_frame(inputs[KEYS])
    typical = pd.Series(usual.reindex(index).to_numpy(), index=inputs.index)
    drop = (typical - inputs["available_regular_employees"]).clip(lower=0).fillna(0)
    return drop.where(inputs["availability_note"].eq(PTO_NOTE), 0.0)


def pto_what_if(inputs: pd.DataFrame, curves: dict[int, Curve], goal: float = SERVICE_GOAL, limits=(0, 1, 2, 3, 4, 5)) -> pd.DataFrame:
    """Keep up to N more people per block by limiting PTO in BASE, never more than the block lost to PTO."""
    base = inputs[inputs["scenario_code"] == "BASE"]
    drop = np.floor(pto_drop(base) + 0.5)
    rows = []
    for limit in limits:
        recovered = drop.clip(upper=limit).astype(int)
        trial = base.copy()
        trial["available_regular_employees"] = trial["available_regular_employees"] + recovered
        result = evaluate(build_plan(trial, curves, goal), "recommended", curves)
        summary = summarize(result, goal).iloc[0]
        short = result[(result["is_open"] == 1) & (result["chance_met"] < goal - 0.0005)]
        rows.append(
            {
                "kept_per_block": limit,
                "people_kept": int(recovered.sum()),
                "blocks_below_goal": int(summary["below_goal"]),
                "below_goal_with_holiday_pto": int(short["availability_note"].eq(PTO_NOTE).sum()),
                "expected_met": float(summary["expected_met"]),
                "cost": float(summary["cost"]),
                "overtime_hours": float(summary["overtime_hours"]),
            }
        )
    return pd.DataFrame(rows)


def _largest_short(evaluated: pd.DataFrame, need: pd.Series, scenario: str) -> tuple[str, int]:
    part = evaluated[evaluated["scenario_code"] == scenario]
    gap = (need[part.index] - part["recommended"]).clip(lower=0)
    table = gap.groupby([part["store_id"], part["dept_id"], part["day_date"]]).sum()
    (store, dept, day), people = table.idxmax(), int(table.max())
    return f"{WAREHOUSE_NAMES[store]} {DEPT_NAMES[dept]} on {day:%a %b} {day.day}", people


def scenario_actions(explained: pd.DataFrame) -> dict[str, dict]:
    """Triggers and actions per scenario. `explained` is explain_plan()'s result for all three scenarios."""
    frame = explained[explained["is_open"] == 1]
    hours = frame.groupby("scenario_code")["hours"].sum()
    overtime = frame.assign(ot_hours=frame["fill_overtime"] * frame["paid_hours"]).groupby("scenario_code")["ot_hours"].sum()
    cost = frame.groupby("scenario_code")["cost"].sum()
    # A block counts as short only when it's below the goal by the shared rule, so a block at 94.99% that every
    # other view shows as reaching the goal isn't counted one person short here (F-50, capacity_gaps).
    below = frame["chance_met"] < SERVICE_GOAL - 0.0005
    need = frame["need"].where(below, frame["recommended"])
    short = (need - frame["recommended"]).clip(lower=0).groupby(frame["scenario_code"]).sum()
    blocks_short = (need > frame["recommended"]).groupby(frame["scenario_code"]).sum()

    pivot = frame.pivot_table(index=["store_id", "dept_id", "day_date", "shift_code"], columns="scenario_code", values="recommended", aggfunc="first")
    peak_move = (pivot["PEAK"] - pivot["BASE"]).groupby(level=["store_id", "dept_id"]).sum()
    peak_store, peak_dept = peak_move.idxmax()
    disrupt_move = (pivot["DISRUPT"] - pivot["BASE"]).groupby(level=["store_id", "dept_id"]).sum()
    disrupt_store, disrupt_dept = disrupt_move.idxmin()

    base_where, base_people = _largest_short(frame, need, "BASE")
    peak_where, peak_people = _largest_short(frame, need, "PEAK")
    disrupt_where, disrupt_people = _largest_short(frame, need, "DISRUPT")

    return {
        "BASE": {
            "trigger": "No promotion surge or illness has been confirmed. This is the default.",
            "actions": [
                f"Schedule the BASE plan: {_whole(hours['BASE']):,} hours, at a cost of ${_whole(cost['BASE']):,}.",
                f"Approve {_whole(overtime['BASE']):,} hours of overtime ahead of time, mostly for the holiday weekend, so it isn't arranged at the last minute.",
                f"Deal with the {int(short['BASE'])}-person gap across {int(blocks_short['BASE'])} blocks before the week starts. The largest is {base_where}, at {base_people} people across its shifts. Limiting holiday PTO is the most direct fix.",
            ],
        },
        "PEAK": {
            "trigger": "The Feb 13 member promotion is confirmed, or a winter-storm advisory covers Feb 13-14.",
            "actions": [
                f"Switch to the PEAK plan: {_whole(hours['PEAK'] - hours['BASE']):+,} hours against BASE, at a cost of ${_whole(cost['PEAK']):,}.",
                f"Put extra staff first into {WAREHOUSE_NAMES[peak_store]} {DEPT_NAMES[peak_dept]}, which gains the most ({int(peak_move.max())} more employee shifts across the week).",
                f"Approve {_whole(overtime['PEAK']):,} hours of overtime, against {_whole(overtime['BASE']):,} in BASE.",
                f"Expect waits even with this plan. It is {int(short['PEAK'])} people short across {int(blocks_short['PEAK'])} blocks, led by {peak_where} ({peak_people} people across its shifts). Arrange outside cover, or tell members and staff what to expect.",
            ],
        },
        "DISRUPT": {
            "trigger": "Warehouse 2 reports the illness cluster for Feb 13-16 (about 30% of Front End unavailable, one Pharmacy team member out per block), or Warehouse 4's opening stocking crew is about 35% short on Feb 12-13.",
            "actions": [
                f"Switch to the DISRUPT plan: {_whole(hours['DISRUPT'] - hours['BASE']):+,} hours against BASE, because fewer people are available, at a cost of ${_whole(cost['DISRUPT']):,}.",
                f"Don't use the current draft here: it schedules 36 more people than can be fielded, across 12 blocks.",
                f"{WAREHOUSE_NAMES[disrupt_store]} {DEPT_NAMES[disrupt_dept]} loses the most ({-int(disrupt_move.min())} fewer employee shifts across the week). Move every available cross-trained person there once Merchandising's own need is met.",
                f"Escalate early. The plan is {int(short['DISRUPT'])} people short across {int(blocks_short['DISRUPT'])} blocks, led by {disrupt_where} ({disrupt_people} people across its shifts), and no schedule can close that gap.",
            ],
        },
    }


def on_the_day(explained: pd.DataFrame) -> list[dict]:
    """Rules for the day itself, sized from the plan's typical cushions in BASE."""
    base = explained[(explained["scenario_code"] == "BASE") & (explained["is_open"] == 1)]
    median = base.groupby("dept_id")[["cushion_people", "cushion_demand"]].median()
    people = ", ".join(f"{DEPT_NAMES[d]} {median.loc[d, 'cushion_people']:.0f}" for d in DEPT_NAMES)
    demand = ", ".join(f"{DEPT_NAMES[d]} {median.loc[d, 'cushion_demand'] * 100:.0f}%" for d in DEPT_NAMES)
    return [
        {
            "trigger": f"Callouts in a block pass its cushion. The typical cushion in people is: {people}.",
            "action": "Replace them in this order: cross-trained staff if the partner department has people to spare, since they cost the regular rate, then overtime if the block has room. Each block's own cushion shows when you open that block in the planner.",
        },
        {
            "trigger": f"Traffic runs above forecast by more than the cushion. The typical cushion is: {demand}.",
            "action": "Treat the rest of the day as PEAK: bring in the extra staff for later shifts, starting with the blocks closest to their limit.",
        },
        {
            "trigger": "Waits pass target: 5 minutes at checkout, 60 minutes for replenishment, or 20 minutes in Pharmacy.",
            "action": "Don't wait for the next shift. Service falls off a cliff near 85-90% utilization, so one late person can make a block miss. Pull in help now.",
        },
        {
            "trigger": "Traffic runs well below forecast, with no callouts.",
            "action": "Offer voluntary time off in overtime blocks first, because overtime costs about 32% more per hour. Don't cut below minimum staff.",
        },
    ]
