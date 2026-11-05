"""Historical diagnosis (T-11, T-12, T-13) and the figures first shown on the Nov 2 EDA dashboard.

kpis() recomputes the dashboard's headline figures from the case CSVs using the same ids,
so planning/evidence/reconcile_dashboard.py can compare the two.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

from src.allocation import apply_rule
from src.data import (
    HOLIDAY_WINDOWS,
    capacity,
    load_benchmark,
    load_history,
    load_labor_standard,
    load_planning_grid,
    open_history,
)

DEPT_NAMES = {38: "Front End", 92: "Merchandising", 95: "Pharmacy"}
FLU_DATES = (pd.Timestamp("2026-01-22"), pd.Timestamp("2026-01-28"))
FLU_DEPTS = (38, 95)  # F-34: the availability note names only these two departments at Warehouse 2.
DAY_AFTER_HOLIDAY = pd.to_datetime(["2026-01-02", "2026-01-20"])


def with_requirement(blocks: pd.DataFrame, target_utilization: float = 0.85) -> pd.DataFrame:
    """Add the employees each block needed at a target utilization, floored at min_staff."""
    result = blocks.copy()
    needed_hours = result["workload_hours"] / target_utilization
    result["required_employees"] = np.maximum(np.ceil(needed_hours / result["paid_hours"] - 1e-9), result["min_staff"])
    result["required_hours"] = result["required_employees"] * result["paid_hours"]
    gap = result["worked_employees"] - result["required_employees"]
    result["over_hours"] = gap.clip(lower=0) * result["paid_hours"]
    result["short_hours"] = (-gap).clip(lower=0) * result["paid_hours"]
    # The same gap before callouts, which separates schedule habits from bad luck on the day.
    result["scheduled_net_hours"] = (result["scheduled_employees"] - result["required_employees"]) * result["paid_hours"]
    return result


def staffing_gaps(blocks: pd.DataFrame | None = None, target_utilization: float = 0.85) -> pd.DataFrame:
    """T-11: over- and under-staffing by warehouse, department, day type and shift, largest gap first."""
    blocks = with_requirement(open_history() if blocks is None else blocks, target_utilization)
    table = (
        blocks.groupby(["store_id", "dept_id", "day_type", "shift_code"])
        .agg(
            blocks=("met_target", "size"),
            avg_utilization=("utilization", "mean"),
            met_target=("met_target", "mean"),
            missed_blocks=("met_target", lambda met: int((met == 0).sum())),
            over_hours=("over_hours", "sum"),
            short_hours=("short_hours", "sum"),
            scheduled_net_hours=("scheduled_net_hours", "sum"),
        )
        .reset_index()
    )
    table["department"] = table["dept_id"].map(DEPT_NAMES)
    table["net_hours"] = table["over_hours"] - table["short_hours"]
    return table.sort_values("net_hours", key=np.abs, ascending=False).reset_index(drop=True)


def gap_value(blocks: pd.DataFrame | None = None, target_utilization: float = 0.85) -> pd.DataFrame:
    """T-12: hours, dollars and missed-target blocks by department."""
    blocks = with_requirement(open_history() if blocks is None else blocks, target_utilization)
    rates = load_planning_grid().drop_duplicates(["store_id", "dept_id"])[
        ["store_id", "dept_id", "loaded_regular_hourly_cost"]
    ]
    blocks = blocks.merge(rates, on=["store_id", "dept_id"], validate="many_to_one")
    blocks["over_value"] = blocks["over_hours"] * blocks["loaded_regular_hourly_cost"]
    table = (
        blocks.groupby("dept_id")
        .agg(
            blocks=("met_target", "size"),
            worked_hours=("worked_labor_hours", "sum"),
            required_hours=("required_hours", "sum"),
            over_hours=("over_hours", "sum"),
            short_hours=("short_hours", "sum"),
            over_value=("over_value", "sum"),
            missed_blocks=("met_target", lambda met: int((met == 0).sum())),
            labor_cost=("labor_cost", "sum"),
        )
        .reset_index()
    )
    table["department"] = table["dept_id"].map(DEPT_NAMES)
    return table


def is_flu_block(blocks: pd.DataFrame) -> pd.Series:
    """Warehouse 2 Front End and Pharmacy blocks in the Jan 22-28 flu cluster."""
    return (
        (blocks["store_id"] == 2)
        & blocks["dept_id"].isin(FLU_DEPTS)
        & blocks["day_date"].between(*FLU_DATES)
    )


def callout_context(blocks: pd.DataFrame) -> pd.Series:
    """Weekday, weekend or day after a holiday. Day after a holiday takes priority."""
    context = np.where(blocks["is_weekend"] == 1, "weekend", "weekday")
    context = np.where(blocks["day_date"].isin(DAY_AFTER_HOLIDAY), "day_after_holiday", context)
    return pd.Series(context, index=blocks.index)


def callout_rates(blocks: pd.DataFrame | None = None) -> pd.DataFrame:
    """T-13: callouts per scheduled employee by department and situation, with the flu cluster separated."""
    blocks = open_history() if blocks is None else blocks
    blocks = blocks.assign(flu=is_flu_block(blocks), context=callout_context(blocks))
    regular = blocks[~blocks["flu"]]
    rows = []
    for (dept, context), group in regular.groupby(["dept_id", "context"]):
        rows.append(_rate_row(dept, context, group))
    for dept, group in blocks[blocks["flu"]].groupby("dept_id"):
        rows.append(_rate_row(dept, "flu_cluster", group))
    return pd.DataFrame(rows)


def _rate_row(dept: int, context: str, group: pd.DataFrame) -> dict:
    callouts, scheduled, backfill = group[["callout_employees", "scheduled_employees", "backfill_employees"]].sum()
    return {
        "dept_id": dept,
        "department": DEPT_NAMES[dept],
        "context": context,
        "callouts": int(callouts),
        "scheduled": int(scheduled),
        "backfilled": int(backfill),
        "rate": callouts / scheduled,
        "backfill_share": backfill / callouts if callouts else np.nan,
    }


def service_bands(blocks: pd.DataFrame | None = None) -> pd.DataFrame:
    """Share of blocks meeting target in five-point utilization bands."""
    blocks = open_history() if blocks is None else blocks
    band = np.floor(blocks["utilization"] / 0.05 + 1e-9) * 0.05
    table = (
        blocks.assign(band=band.round(2))
        .groupby(["dept_id", "band"])
        .agg(blocks=("met_target", "size"), met_target=("met_target", "mean"), median_ratio=("service_ratio", "median"))
        .reset_index()
    )
    table["department"] = table["dept_id"].map(DEPT_NAMES)
    return table


def daily_demand(blocks: pd.DataFrame | None = None) -> pd.DataFrame:
    """One row per open warehouse, department and day."""
    blocks = open_history() if blocks is None else blocks
    daily = (
        blocks.groupby(["store_id", "dept_id", "day_date", "day_of_week", "week", "window"], as_index=False)
        .agg(demand=("daily_demand_units", "first"), temperature=("temperature", "first"), promo=("has_promotion", "first"))
    )
    daily["log_demand"] = np.log(daily["demand"])
    return daily


LEVEL = "C(store_id):C(dept_id) + C(dept_id):C(day_of_week)"
LEVEL_HOLIDAY = LEVEL + " + C(dept_id):C(window)"
LEVEL_HOLIDAY_WEEK = LEVEL_HOLIDAY + " + C(dept_id):C(week)"


def holiday_factors(daily: pd.DataFrame) -> pd.DataFrame:
    """Demand factor for each window, holding warehouse level, weekday and weekly level fixed."""
    fit = smf.ols("log_demand ~ " + LEVEL_HOLIDAY_WEEK, daily).fit()
    design_rows = []
    for dept in DEPT_NAMES:
        reference = daily[daily["dept_id"] == dept].iloc[[0]].copy()
        reference["window"] = "normal"
        base = fit.predict(reference).iloc[0]
        for window in sorted(daily["window"].unique()):
            reference["window"] = window
            design_rows.append(
                {
                    "dept_id": dept,
                    "department": DEPT_NAMES[dept],
                    "window": window,
                    "factor": float(np.exp(fit.predict(reference).iloc[0] - base)),
                }
            )
    return pd.DataFrame(design_rows)


def average_shift_shares(blocks: pd.DataFrame) -> pd.DataFrame:
    """Average share of the day by department, day type, holiday-window flag and shift."""
    table = (
        blocks.assign(window_day=blocks["window"] != "normal")
        .groupby(["dept_id", "day_type", "window_day", "shift_code"], as_index=False)["shift_share_of_day"]
        .mean()
    )
    totals = table.groupby(["dept_id", "day_type", "window_day"])["shift_share_of_day"].transform("sum")
    table["share"] = table["shift_share_of_day"] / totals
    return table


def mlk_analog(blocks: pd.DataFrame | None = None) -> pd.DataFrame:
    """The stress-test demand: weeks 3-6 holiday-adjusted level x MLK-window factors, by day.

    This reproduces the dashboard's test of the draft. It is not our forecast (see src/forecast.py).
    """
    blocks = open_history() if blocks is None else blocks
    daily = daily_demand(blocks)
    factors = holiday_factors(daily).set_index(["dept_id", "window"])["factor"]
    daily["factor"] = [factors[(d, w)] for d, w in zip(daily["dept_id"], daily["window"])]
    daily["adjusted"] = daily["demand"] / daily["factor"]
    level = (
        daily[daily["week"].between(3, 6)]
        .groupby(["store_id", "dept_id", "day_of_week"], as_index=False)["adjusted"]
        .mean()
    )
    grid = load_planning_grid()
    plan = grid[grid["scenario_code"] == "BASE"].drop_duplicates(["store_id", "dept_id", "day_date"])[
        ["store_id", "dept_id", "day_date", "day_of_week", "holiday_window_role"]
    ]
    plan = plan.merge(level, on=["store_id", "dept_id", "day_of_week"], validate="many_to_one")
    plan["window"] = plan["holiday_window_role"].map(HOLIDAY_WINDOWS)
    plan["factor"] = [factors[(d, w)] for d, w in zip(plan["dept_id"], plan["window"])]
    plan["analog"] = plan["adjusted"] * plan["factor"]
    return plan


def draft_stress_test(blocks: pd.DataFrame | None = None) -> pd.DataFrame:
    """Utilization the draft would run at if demand follows the MLK analog, per scenario and block."""
    blocks = open_history() if blocks is None else blocks
    analog = mlk_analog(blocks)
    shares = average_shift_shares(blocks)
    grid = apply_rule(load_planning_grid(), "draft_scheduled_employees")
    grid = grid[grid["is_open"] == 1].copy()
    grid["window_day"] = grid["holiday_window_role"].map(HOLIDAY_WINDOWS) != "normal"
    grid = grid.merge(
        analog[["store_id", "dept_id", "day_date", "analog"]],
        on=["store_id", "dept_id", "day_date"],
        validate="many_to_one",
    ).merge(
        shares[["dept_id", "day_type", "window_day", "shift_code", "share"]],
        on=["dept_id", "day_type", "window_day", "shift_code"],
        validate="many_to_one",
    )
    standard = grid["dept_id"].map(load_labor_standard())
    grid["demand"] = grid["analog"] * grid["share"] * grid["demand_multiplier"]
    grid["utilization"] = grid["demand"] * standard / (grid["fielded"] * grid["paid_hours"])
    return grid


def _pto_change(grid: pd.DataFrame) -> float:
    """Front End regular staff per block on Feb 14-15, against the last three normal weekends (F-32)."""
    keys = ["store_id", "day_type", "shift_code"]
    history = load_history()
    recent = history[
        (history["dept_id"] == 38)
        & (history["is_open"] == 1)
        & (history["is_weekend"] == 1)
        & (history["holiday_window_role"] == "Normal")
        & (history["day_date"] >= "2026-01-22")
    ]
    usual = recent.groupby(keys, as_index=False)["available_regular_employees"].mean()
    weekend = grid[
        (grid["scenario_code"] == "BASE") & (grid["dept_id"] == 38) & grid["day_date"].isin(pd.to_datetime(["2026-02-14", "2026-02-15"]))
    ]
    joined = weekend.merge(usual, on=keys, suffixes=("", "_usual"), validate="one_to_one")
    return float((joined["available_regular_employees"] - joined["available_regular_employees_usual"]).mean())


def kpis() -> dict[str, float]:
    """The dashboard's headline figures, recomputed from the case CSVs."""
    history = load_history()
    blocks = open_history()
    grid = load_planning_grid()
    benchmark = load_benchmark()
    daily = daily_demand(blocks)
    k: dict[str, float] = {}

    k["hist_blocks"] = len(history)
    k["plan_blocks"] = len(grid)
    k["open_blocks"] = len(blocks)
    k["closed_blocks"] = len(history) - len(blocks)

    # Demand structure.
    fit_level = smf.ols("log_demand ~ " + LEVEL, daily).fit()
    fit_holiday = smf.ols("log_demand ~ " + LEVEL_HOLIDAY, daily).fit()
    fit_week = smf.ols("log_demand ~ " + LEVEL_HOLIDAY_WEEK, daily).fit()
    k["r2_dow"] = fit_level.rsquared
    k["r2_dow_hol"] = fit_holiday.rsquared
    k["r2_full"] = fit_week.rsquared
    k["err_dow_hol"] = float(np.exp(np.sqrt((fit_holiday.resid**2).mean())) - 1)
    k["corr_temp_resid"] = float(np.corrcoef(daily["temperature"], fit_level.resid)[0, 1])
    k["corr_promo_resid"] = float(np.corrcoef(daily["promo"], fit_level.resid)[0, 1])
    front = daily[daily["dept_id"] == 38]
    k["corr_temp_raw_fe"] = float(np.corrcoef(front["temperature"], front["demand"])[0, 1])

    # Weekday shape and weekly level.
    normal = daily[daily["window"] == "normal"].copy()
    normal["index"] = normal["demand"] / normal.groupby(["store_id", "dept_id"])["demand"].transform("mean")
    by_store = normal.groupby(["store_id", "dept_id", "day_of_week"])["index"].mean().unstack(0)
    k["dow_spread_store"] = float((by_store.max(axis=1) - by_store.min(axis=1)).max())
    factors = holiday_factors(daily).set_index(["dept_id", "window"])["factor"]
    daily["adjusted"] = daily["demand"] / [factors[(d, w)] for d, w in zip(daily["dept_id"], daily["window"])]
    daily["level"] = daily["adjusted"] / daily.groupby(["store_id", "dept_id", "day_of_week"])["adjusted"].transform("mean")
    week_level = daily.groupby(["dept_id", "week"])["level"].mean()
    k["week_level_min"] = float(week_level.min())
    k["week_level_max"] = float(week_level.max())
    dept_week = daily.groupby(["dept_id", "week"])["level"].transform("mean")
    k["rebound_extra"] = float((daily["level"] / dept_week)[daily["day_date"] == "2026-01-20"].mean() - 1)

    # Within-day split.
    fe_mid = blocks[(blocks["dept_id"] == 38) & (blocks["shift_code"] == "MID")]
    k["fe_mid_shift_pts"] = float(
        fe_mid.loc[fe_mid["window"] != "normal", "shift_share_of_day"].mean()
        - fe_mid.loc[fe_mid["window"] == "normal", "shift_share_of_day"].mean()
    )
    average = blocks.groupby(["store_id", "dept_id", "day_type", "window", "shift_code"])["shift_share_of_day"].transform("mean")
    k["shift_noise"] = float(((blocks["shift_share_of_day"] / average - 1).abs()).mean())

    # Benchmark against the MLK analog.
    analog = mlk_analog(blocks)
    joined = analog.merge(
        benchmark[["store_id", "dept_id", "day_date", "predicted_transaction_count_proxy"]],
        on=["store_id", "dept_id", "day_date"],
    )
    for dept in DEPT_NAMES:
        part = joined[joined["dept_id"] == dept]
        k[f"bench_week_gap_{dept}"] = float(part["predicted_transaction_count_proxy"].sum() / part["analog"].sum() - 1)

    # Service.
    u = blocks["utilization"]
    k["met_below_84"] = float(blocks.loc[u < 0.84, "met_target"].mean())
    k["met_85_90"] = float(blocks.loc[(u >= 0.85) & (u < 0.90), "met_target"].mean())
    k["met_above_90"] = float(blocks.loc[u >= 0.90, "met_target"].mean())
    k["blocks_above_90"] = int((u >= 0.90).sum())
    k["pct_met_all"] = float(blocks["met_target"].mean())
    labels = {38: "fe", 92: "ms", 95: "rx"}
    for dept in DEPT_NAMES:
        part = blocks[blocks["dept_id"] == dept]
        k[f"pct_met_{dept}"] = float(part["met_target"].mean())
        k[f"sat_ratio_{dept}"] = float(part.loc[part["utilization"] >= 0.97, "service_ratio"].mean())

    # Allocation.
    needed85 = with_requirement(blocks, 0.85)
    needed80 = with_requirement(blocks, 0.80)
    k["worked_hours"] = float(blocks["worked_labor_hours"].sum())
    k["sched_hours"] = float(blocks["scheduled_labor_hours"].sum())
    k["req85_hours"] = float(needed85["required_hours"].sum())
    k["req80_hours"] = float(needed80["required_hours"].sum())
    k["worked_vs_req85"] = k["worked_hours"] / k["req85_hours"] - 1
    # Need before rounding up to whole people and applying minimum staff.
    k["raw_need85_hours"] = float((blocks["workload_hours"] / 0.85).sum())
    k["worked_vs_raw_need85"] = k["worked_hours"] / k["raw_need85_hours"] - 1
    k["over_hours"] = float(needed85["over_hours"].sum())
    k["short_hours"] = float(needed85["short_hours"].sum())
    k["over_value"] = float(gap_value(blocks)["over_value"].sum())
    block_type = ["store_id", "dept_id", "day_type", "shift_code"]
    correlations = blocks.groupby(block_type).apply(
        lambda part: part["scheduled_labor_hours"].corr(part["workload_hours"]), include_groups=False
    )
    medians = correlations.groupby(level="dept_id").median()
    k["sched_corr_fr"], k["sched_corr_me"], k["sched_corr_ph"] = (float(medians[d]) for d in DEPT_NAMES)
    full_weeks = blocks[blocks["week"].between(2, 6)]
    weekly = full_weeks.groupby(["dept_id", "week"])[["scheduled_labor_hours", "shift_demand_units"]].sum()
    indexed = weekly / weekly.groupby(level="dept_id").transform("mean")
    k["hours_index_spread"] = float((indexed["scheduled_labor_hours"] - 1).abs().max())
    k["demand_index_spread"] = float((indexed["shift_demand_units"] - 1).abs().max())

    # Callouts and cost.
    k["callout_rate_all"] = float(blocks["callout_employees"].sum() / blocks["scheduled_employees"].sum())
    k["backfill_share"] = float(blocks["backfill_employees"].sum() / blocks["callout_employees"].sum())
    scheduled_overtime = blocks["worked_overtime_employees"] - blocks["backfill_employees"]
    no_room = scheduled_overtime >= blocks["max_overtime_employees"]
    k["backfill_when_no_ot"] = float(
        blocks.loc[no_room, "backfill_employees"].sum() / max(blocks.loc[no_room, "callout_employees"].sum(), 1)
    )
    for dept, label in labels.items():
        part = blocks[blocks["dept_id"] == dept]
        lost = part["callout_employees"] - part["backfill_employees"]
        k[f"netloss_{label}"] = float(lost.sum() / part["scheduled_employees"].sum())
        k[f"callout_{label}"] = float(part["callout_employees"].sum() / part["scheduled_employees"].sum())
        k[f"met_loss_{label}"] = float(part.loc[lost > 0, "met_target"].mean())
        k[f"met_noloss_{label}"] = float(part.loc[lost == 0, "met_target"].mean())
    k["labor_cost_6wk"] = float(blocks["labor_cost"].sum())
    k["ot_hours_share"] = float(blocks["worked_overtime_hours"].sum() / blocks["worked_labor_hours"].sum())
    rates = grid.drop_duplicates(["store_id", "dept_id"])[
        ["store_id", "dept_id", "loaded_regular_hourly_cost", "loaded_overtime_hourly_cost"]
    ]
    with_rates = blocks.merge(rates, on=["store_id", "dept_id"], validate="many_to_one")
    premium = (with_rates["loaded_overtime_hourly_cost"] - with_rates["loaded_regular_hourly_cost"]) * with_rates["worked_overtime_hours"]
    k["ot_premium_6wk"] = float(premium.sum())
    k["ot_premium_share"] = k["ot_premium_6wk"] / k["labor_cost_6wk"]
    k["cost_per_week"] = float(full_weeks["labor_cost"].sum() / 5)

    # The draft schedule.
    base = grid[(grid["scenario_code"] == "BASE") & (grid["is_open"] == 1)]
    past = blocks[blocks["week"].between(3, 6)]
    average_schedule = past.groupby(["store_id", "dept_id", "day_of_week", "shift_code"], as_index=False)["scheduled_employees"].mean()
    compared = base.merge(average_schedule, on=["store_id", "dept_id", "day_of_week", "shift_code"], validate="one_to_one")
    k["draft_within1"] = float(((compared["draft_scheduled_employees"] - compared["scheduled_employees"]).abs() <= 1).mean())
    week6 = blocks[blocks["week"] == 6][["store_id", "dept_id", "day_of_week", "shift_code", "scheduled_employees"]]
    compared = base.merge(week6, on=["store_id", "dept_id", "day_of_week", "shift_code"], validate="one_to_one")
    k["draft_eq_wk6"] = float((compared["draft_scheduled_employees"] == compared["scheduled_employees"]).mean())

    stress = draft_stress_test(blocks)
    holiday = stress["day_date"].between("2026-02-13", "2026-02-16") & stress["dept_id"].isin([38, 92])
    for scenario in ("BASE", "PEAK", "DISRUPT"):
        mask = stress["scenario_code"] == scenario
        k[f"draft_over85_{scenario.lower()}"] = float((stress.loc[mask & holiday, "utilization"] > 0.85).mean())
        k[f"draft_over85_all_{scenario.lower()}"] = float((stress.loc[mask, "utilization"] > 0.85).mean())

    # Against the naive benchmark instead of the analog.
    bench_stress = stress[stress["scenario_code"] == "BASE"].merge(
        benchmark[["store_id", "dept_id", "day_date", "predicted_transaction_count_proxy"]],
        on=["store_id", "dept_id", "day_date"],
    )
    # The benchmark ignores holidays, so it is split with the normal-day shares.
    normal_shares = average_shift_shares(blocks).query("not window_day")[["dept_id", "day_type", "shift_code", "share"]]
    bench_stress = bench_stress.drop(columns="share").merge(normal_shares, on=["dept_id", "day_type", "shift_code"])
    standard = bench_stress["dept_id"].map(load_labor_standard())
    bench_util = (
        bench_stress["predicted_transaction_count_proxy"] * bench_stress["share"] * standard
        / (bench_stress["fielded"] * bench_stress["paid_hours"])
    )
    k["draft_over85_bench"] = float((bench_util > 0.85).mean())

    beyond = (base["draft_scheduled_employees"] - base["available_regular_employees"]).clip(lower=0)
    for dept, label in {38: "fr", 92: "me", 95: "ph"}.items():
        k[f"beyond_{label}"] = int(beyond[base["dept_id"] == dept].sum())

    # Draft capacity and cost under the rule.
    open_grid = grid[grid["is_open"] == 1]
    over = open_grid[open_grid["draft_scheduled_employees"] > capacity(open_grid)]
    k["disrupt_blocks"] = int(len(over))
    k["disrupt_shortfall"] = int((over["draft_scheduled_employees"] - capacity(over)).sum())
    ruled = apply_rule(grid, "draft_scheduled_employees")
    # Limiting flex to what the partner can spare (A-01) raises the shortfall above the raw-capacity figure.
    k["disrupt_shortfall_usable_flex"] = int(ruled["unfilled"].sum())
    k["disrupt_blocks_usable_flex"] = int(ruled["over_capacity"].sum())
    costed = ruled.groupby("scenario_code")["cost"].sum()
    k["draft_cost_base"] = float(costed["BASE"])
    k["draft_cost_peak"] = float(costed["PEAK"])
    k["draft_cost_disrupt"] = float(costed["DISRUPT"])
    k["pto_fe_satsun"] = _pto_change(grid)
    pharmacy = blocks[blocks["dept_id"] == 95]
    k["rx_block_median"] = float(pharmacy["scheduled_employees"].median())
    k["rx_one_person"] = 1 / k["rx_block_median"]
    k["minstaff_binds"] = int((needed80["min_staff"] > np.ceil(needed80["workload_hours"] / 0.80 / needed80["paid_hours"] - 1e-9)).sum())
    return k
