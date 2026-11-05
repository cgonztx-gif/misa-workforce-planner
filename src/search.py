"""Per-shift staffing search (T-32, T-33, D-06).

Rule (T-33, judging order R-27), applied in this order within each shift:

1. Reach the service goal in every department if capacity allows, or get as close as it allows.
2. Where capacity falls short, staff as near the need as possible and flag the block. A saturated block
   barely gains in chance of meeting target from one more person, but its waits still shrink, so it must
   not fall back to minimum staff.
3. Among what's left, take the lowest cost.

A department only lends staff it doesn't need itself. Without this guard, the search cuts a hopelessly
overloaded department to lend its people to the other one, because the first can't meet target either
way. That scores well on blocks meeting target, but no warehouse leader would accept it (D-17).

Front End and Merchandising are searched as pairs because they share cross-trained staff (D-06).
Pharmacy is searched alone.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from src.allocation import allocate, apply_rule, block_cost, usable_flex
from src.data import load_labor_standard, load_planning_grid
from src.diagnosis import callout_context, callout_rates
from src.forecast import HOLIDAY_FACTOR_SD, HOLIDAY_DATES, forecast_blocks, forecast_sd
from src.risk import chance_met
from src.service import Curve

SERVICE_GOAL = 0.95  # T-33, A-13: the trade-off behind this choice is in planning/FINDINGS.md (F-49).
SCORE_DECIMALS = 3  # Service gains smaller than this don't justify extra staff.
DAY_AFTER_PRESIDENTS_DAY = pd.Timestamp("2026-02-17")
ILLNESS_NOTE = "Illness cluster"


def planning_inputs(valentine: dict[int, float] | None = None) -> pd.DataFrame:
    """The planning grid with everything the search needs per open block: demand, uncertainty and callout rate."""
    grid = load_planning_grid()
    forecast = forecast_blocks(valentine)[["store_id", "dept_id", "day_date", "shift_code", "base_demand", "daily_forecast", "share"]]
    grid = grid.merge(forecast, on=["store_id", "dept_id", "day_date", "shift_code"], how="left", validate="many_to_one")
    grid["demand"] = grid["base_demand"] * grid["demand_multiplier"]
    grid["standard"] = grid["dept_id"].map(load_labor_standard())

    sd = forecast_sd().set_index("dept_id")["sd"]
    holiday_sd = grid["dept_id"].map(HOLIDAY_FACTOR_SD).where(grid["day_date"].isin(HOLIDAY_DATES), 0.0)
    grid["demand_sd"] = np.sqrt(grid["dept_id"].map(sd) ** 2 + holiday_sd**2)

    rates = callout_rates().set_index(["dept_id", "context"])["rate"]
    context = callout_context(grid)
    context = context.where(grid["day_date"] != DAY_AFTER_PRESIDENTS_DAY, "day_after_holiday")
    illness = grid["availability_note"].fillna("").str.contains(ILLNESS_NOTE)
    context = context.where(~illness, "flu_cluster")  # A-12: the DISRUPT illness cluster behaves like January's flu week.
    grid["callout_context"] = context
    grid["callout_rate"] = [rates[(dept, ctx)] for dept, ctx in zip(grid["dept_id"], context)]
    return grid


def _block_chance(row, employees: int, curves: dict[int, Curve]) -> float:
    # Assume no flex when working out overtime room, which errs slightly on the side of less backfill.
    room = int(row.max_overtime_employees) - max(0, employees - int(row.available_regular_employees))
    return chance_met(
        curves[row.dept_id], row.store_id, row.demand, row.demand_sd, employees,
        row.paid_hours, row.standard, row.callout_rate, room,
    )


def _chances(row, curves: dict[int, Curve]) -> tuple[np.ndarray, np.ndarray]:
    """Headcounts from min_staff to raw capacity, and the chance of meeting target at each."""
    top = int(row.available_regular_employees + row.max_overtime_employees + row.cross_trained_flex_employees)
    top = max(top, int(row.min_staff))
    headcounts = np.arange(int(row.min_staff), top + 1)
    return headcounts, np.array([_block_chance(row, int(n), curves) for n in headcounts])


def needed_employees(row, curves: dict[int, Curve], goal: float) -> int:
    """Smallest headcount reaching the goal, ignoring capacity."""
    limit = 3 * int(row.available_regular_employees + row.max_overtime_employees + row.cross_trained_flex_employees) + 20
    employees = int(row.min_staff)
    while employees < limit and _block_chance(row, employees, curves) < goal:
        employees += 1
    return employees


def _cost(headcount, row, usable) -> np.ndarray:
    regular, flex, overtime, _ = allocate(headcount, row.available_regular_employees, row.max_overtime_employees, usable)
    return block_cost(regular, flex, overtime, row.paid_hours, row.loaded_regular_hourly_cost, row.loaded_overtime_hourly_cost)


def solve_pair(front, merch, curves: dict[int, Curve], goal: float) -> tuple[int, int]:
    """Best feasible Front End and Merchandising headcounts for one shift."""
    front_n, front_p = _chances(front, curves)
    merch_n, merch_p = _chances(merch, curves)
    front_need = needed_employees(front, curves, goal)
    merch_need = needed_employees(merch, curves, goal)
    keep_front = front_n >= min(front_need, int(front.available_regular_employees + front.max_overtime_employees))
    keep_merch = merch_n >= min(merch_need, int(merch.available_regular_employees + merch.max_overtime_employees))
    front_n, front_p = front_n[keep_front], front_p[keep_front]
    merch_n, merch_p = merch_n[keep_merch], merch_p[keep_merch]
    f, m = np.meshgrid(front_n, merch_n, indexing="ij")
    front_usable = usable_flex(front.cross_trained_flex_employees, merch.available_regular_employees, m)
    merch_usable = usable_flex(merch.cross_trained_flex_employees, front.available_regular_employees, f)
    feasible = (f <= front.available_regular_employees + front.max_overtime_employees + front_usable) & (
        m <= merch.available_regular_employees + merch.max_overtime_employees + merch_usable
    )
    score = np.minimum(front_p, goal)[:, None] + np.minimum(merch_p, goal)[None, :]
    score = np.where(feasible, np.round(score, SCORE_DECIMALS), -np.inf)
    shortfall = np.maximum(0, front_need - f) * front.paid_hours + np.maximum(0, merch_need - m) * merch.paid_hours
    cost = _cost(f, front, front_usable) + _cost(m, merch, merch_usable)
    order = np.lexsort((cost.ravel(), shortfall.ravel(), -score.ravel()))
    i, j = np.unravel_index(order[0], f.shape)
    return int(f[i, j]), int(m[i, j])


def solve_single(row, curves: dict[int, Curve], goal: float) -> int:
    """Best feasible headcount for a department that doesn't share staff."""
    top = max(int(row.available_regular_employees + row.max_overtime_employees), int(row.min_staff))
    return min(needed_employees(row, curves, goal), top)


def build_plan(inputs: pd.DataFrame, curves: dict[int, Curve], goal: float = SERVICE_GOAL) -> pd.DataFrame:
    """Recommended total employees for all 567 rows. Closed blocks are 0."""
    plan = inputs.copy()
    plan["recommended"] = 0
    open_rows = plan[plan["is_open"] == 1]
    for _, shift in open_rows.groupby(["scenario_id", "store_id", "day_date", "shift_code"], sort=False):
        by_dept = {row.dept_id: row for row in shift.itertuples()}
        if 95 in by_dept:
            plan.loc[by_dept[95].Index, "recommended"] = solve_single(by_dept[95], curves, goal)
        if 38 in by_dept and 92 in by_dept:
            front, merch = solve_pair(by_dept[38], by_dept[92], curves, goal)
            plan.loc[by_dept[38].Index, "recommended"] = front
            plan.loc[by_dept[92].Index, "recommended"] = merch
        else:
            for dept in (38, 92):
                if dept in by_dept:
                    plan.loc[by_dept[dept].Index, "recommended"] = solve_single(by_dept[dept], curves, goal)
    return plan


def evaluate(plan: pd.DataFrame, column: str, curves: dict[int, Curve]) -> pd.DataFrame:
    """Apply the labor rule and the risk model to any set of block totals."""
    result = apply_rule(plan, column)
    chances = np.full(len(result), np.nan)
    for i, row in enumerate(result.itertuples()):
        if row.is_open == 1:
            chances[i] = _block_chance(row, int(row.fielded), curves)
    result["chance_met"] = chances
    result["planned_utilization"] = (
        (result["demand"] * result["standard"] / (result["fielded"] * result["paid_hours"])).where(result["is_open"] == 1)
    )
    result["hours"] = result["fielded"] * result["paid_hours"]
    return result


def summarize(evaluated: pd.DataFrame, goal: float = SERVICE_GOAL) -> pd.DataFrame:
    """One row per scenario: cost, hours, expected service and feasibility."""
    open_rows = evaluated[evaluated["is_open"] == 1]
    return (
        open_rows.groupby("scenario_code", sort=False)
        .agg(
            hours=("hours", "sum"),
            cost=("cost", "sum"),
            expected_met=("chance_met", "mean"),
            lowest_chance=("chance_met", "min"),
            below_goal=("chance_met", lambda p: int((p < goal - 0.0005).sum())),
            over_capacity=("over_capacity", "sum"),
            unfilled=("unfilled", "sum"),
            below_min_staff=("below_min_staff", "sum"),
            overtime_hours=("fill_overtime", lambda s: float((s * open_rows.loc[s.index, "paid_hours"]).sum())),
            flex_hours=("fill_flex", lambda s: float((s * open_rows.loc[s.index, "paid_hours"]).sum())),
            avg_utilization=("planned_utilization", "mean"),
        )
        .reset_index()
    )
