"""Demand forecast (T-20 to T-24, D-05): a daily log-linear regression, then a split into shifts.

The model holds warehouse level, each department's weekday shape, holiday windows and weekly level.
Weekly level is included so that a high-volume week isn't mistaken for a holiday effect: MLK week was
the highest of the six. A future week's level isn't known, so forecasts use the average of the last
four training weeks, which did slightly better in the backtest than using every week (F-44). There are no temperature or promotion terms, because neither explains demand once the
weekday is known (F-41). History and planning label holidays differently, so both use the shared
window categories in src/data.py (F-13).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

from src.data import BLOCK_KEY, HOLIDAY_WINDOWS, load_benchmark, load_planning_grid, open_history
from src.diagnosis import daily_demand

FORMULA = (
    "log_demand ~ C(store_id):C(dept_id) + C(dept_id):C(day_of_week)"
    " + C(dept_id):C(window) + C(dept_id):C(week)"
)
VALENTINES_DAY = pd.Timestamp("2026-02-14")
HOLIDAY_DATES = pd.to_datetime(["2026-02-13", "2026-02-14", "2026-02-15", "2026-02-16"])
LEVEL_WEEKS = 4

# A-06: no history exists for Valentine's Day, so this is a judgment shown separately from the model.
VALENTINE_UPLIFT = {38: 0.03, 92: 0.03, 95: 0.0}
# A-11: uncertainty from borrowing one holiday's effect for another, sized by the gap between
# the only two windows we can compare: Front End 1.10 vs 1.12, Merchandising 1.06 vs 1.08, Pharmacy 0.90 vs 0.95.
HOLIDAY_FACTOR_SD = {38: 0.02, 92: 0.02, 95: 0.05}


def fit_daily(train: pd.DataFrame):
    """Fit the regression on open days only (F-14)."""
    return smf.ols(FORMULA, train).fit()


def predict_daily(model, frame: pd.DataFrame, weeks) -> np.ndarray:
    """Forecast at the average weekly level of `weeks`, since the level of a future week isn't known."""
    return np.exp(np.mean([model.predict(frame.assign(week=week)) for week in weeks], axis=0))


def planning_days() -> pd.DataFrame:
    """One row per warehouse, department and planning day, using the shared window categories."""
    grid = load_planning_grid()
    days = grid[grid["scenario_code"] == "BASE"].drop_duplicates(["store_id", "dept_id", "day_date"])
    days = days[["store_id", "dept_id", "day_date", "day_of_week", "day_type", "holiday_window_role"]].copy()
    days["window"] = days["holiday_window_role"].map(HOLIDAY_WINDOWS)
    return days.reset_index(drop=True)


def forecast_daily(valentine: dict[int, float] | None = None, blocks: pd.DataFrame | None = None) -> pd.DataFrame:
    """Daily BASE forecast. Keeps the model figure and the Valentine's adjustment apart."""
    valentine = VALENTINE_UPLIFT if valentine is None else valentine
    blocks = open_history() if blocks is None else blocks
    daily = daily_demand(blocks)
    model = fit_daily(daily)
    days = planning_days()
    days["model_forecast"] = predict_daily(model, days, sorted(daily["week"].unique())[-LEVEL_WEEKS:])
    uplift = days["dept_id"].map(valentine).where(days["day_date"] == VALENTINES_DAY, 0.0)
    days["valentine_uplift"] = uplift
    days["daily_forecast"] = days["model_forecast"] * (1 + uplift)
    benchmark = load_benchmark()[["store_id", "dept_id", "day_date", "predicted_transaction_count_proxy"]]
    days = days.merge(benchmark, on=["store_id", "dept_id", "day_date"], validate="one_to_one")
    return days.rename(columns={"predicted_transaction_count_proxy": "benchmark"})


def shift_shares(blocks: pd.DataFrame, by_window: tuple[int, ...] = (38,)) -> pd.DataFrame:
    """Average share of the day per shift. Only departments in by_window get separate holiday shares (F-31)."""
    frame = blocks.assign(window_day=blocks["window"].ne("normal") & blocks["dept_id"].isin(by_window))
    table = frame.groupby(["dept_id", "day_type", "window_day", "shift_code"], as_index=False)["shift_share_of_day"].mean()
    totals = table.groupby(["dept_id", "day_type", "window_day"])["shift_share_of_day"].transform("sum")
    table["share"] = table["shift_share_of_day"] / totals
    return table.drop(columns="shift_share_of_day")


def attach_shares(frame: pd.DataFrame, shares: pd.DataFrame, by_window: tuple[int, ...] = (38,)) -> pd.DataFrame:
    """Add the share for each block. Expects dept_id, day_type, window and shift_code."""
    result = frame.assign(window_day=frame["window"].ne("normal") & frame["dept_id"].isin(by_window))
    return result.merge(shares, on=["dept_id", "day_type", "window_day", "shift_code"], how="left", validate="many_to_one")


def forecast_blocks(valentine: dict[int, float] | None = None) -> pd.DataFrame:
    """BASE demand for every open planning block: daily forecast x shift share."""
    blocks = open_history()
    daily = forecast_daily(valentine, blocks)
    grid = load_planning_grid()
    open_grid = grid[(grid["scenario_code"] == "BASE") & (grid["is_open"] == 1)][BLOCK_KEY]
    frame = open_grid.merge(daily, on=["store_id", "dept_id", "day_date"], validate="many_to_one")
    frame = attach_shares(frame, shift_shares(blocks))
    totals = frame.groupby(["store_id", "dept_id", "day_date"])["share"].transform("sum")
    frame["share"] = frame["share"] / totals  # Keeps shifts summing to the day where a department closes some blocks.
    frame["base_demand"] = frame["daily_forecast"] * frame["share"]
    return frame


def _benchmark_like(train: pd.DataFrame, test: pd.DataFrame) -> pd.Series:
    """The benchmark's method on a past week: mean of the same weekday in the last four available weeks."""
    last_week = train["week"].max()
    recent = train[train["week"] > last_week - 4]
    means = recent.groupby(["store_id", "dept_id", "day_of_week"])["demand"].mean()
    keys = list(zip(test["store_id"], test["dept_id"], test["day_of_week"]))
    return pd.Series([means[key] for key in keys], index=test.index)


def backtest(test_weeks: tuple[int, ...] = (4, 5, 6)) -> pd.DataFrame:
    """T-21: forecast each held-out week from earlier weeks only, against the benchmark's method.

    Returns one row per open day with the model and benchmark forecasts. These weeks hold normal
    days only, so this tests the level and weekday shape, not the holiday effect (see analog_test).
    """
    daily = daily_demand()
    rows = []
    for week in test_weeks:
        train = daily[daily["week"] < week]
        test = daily[daily["week"] == week].copy()
        model = fit_daily(train)
        test["model"] = predict_daily(model, test, sorted(train["week"].unique())[-LEVEL_WEEKS:])
        test["model_all_weeks"] = predict_daily(model, test, sorted(train["week"].unique()))
        test["benchmark"] = _benchmark_like(train, test)
        rows.append(test)
    return pd.concat(rows, ignore_index=True)


def error_table(frame: pd.DataFrame, forecasts: tuple[str, ...] = ("model", "benchmark"), actual: str = "demand") -> pd.DataFrame:
    """Mean absolute percentage error by department and overall."""
    rows = []
    groups = [("All", frame)] + [(dept, part) for dept, part in frame.groupby("dept_id")]
    for label, part in groups:
        row = {"group": label, "rows": len(part)}
        for name in forecasts:
            row[name] = float((part[name] / part[actual] - 1).abs().mean())
        rows.append(row)
    return pd.DataFrame(rows)


def analog_test() -> pd.DataFrame:
    """A-05: borrow one holiday's effect to forecast the next, the only such test the data allows.

    Train on weeks 1-2, whose only holiday window is the New Year rebound. Forecast Fri-Sun Jan 16-18
    using that window's effect, against the benchmark's method. Holiday Monday has no earlier analog.
    """
    daily = daily_demand()
    train = daily[daily["week"] <= 2]
    test = daily[daily["window"] == "pre_holiday_weekend"].copy()
    model = fit_daily(train)
    weeks = sorted(train["week"].unique())
    test["model"] = predict_daily(model, test.assign(window="new_year_rebound"), weeks)
    test["model_no_holiday"] = predict_daily(model, test.assign(window="normal"), weeks)
    test["benchmark"] = _benchmark_like(train, test)
    return test


def split_test() -> pd.DataFrame:
    """T-23: leave one week out and compare ways of splitting a day into shifts."""
    blocks = open_history()
    options = {
        "pooled": (),
        "front_end_holiday_shares": (38,),
        "all_departments_holiday_shares": (38, 92, 95),
    }
    results = []
    for name, by_window in options.items():
        errors = []
        for week in sorted(blocks["week"].unique()):
            train, test = blocks[blocks["week"] != week], blocks[blocks["week"] == week]
            frame = attach_shares(test, shift_shares(train, by_window), by_window)
            errors.append((frame["share"] / frame["shift_share_of_day"] - 1).abs().rename("error").to_frame().assign(
                dept_id=frame["dept_id"].to_numpy(), window_day=frame["window"].ne("normal").to_numpy()
            ))
        table = pd.concat(errors)
        results.append(
            {
                "option": name,
                "all_days": float(table["error"].mean()),
                "holiday_window_days": float(table.loc[table["window_day"], "error"].mean()),
                "front_end_holiday_window_days": float(
                    table.loc[table["window_day"] & (table["dept_id"] == 38), "error"].mean()
                ),
            }
        )
    return pd.DataFrame(results)


def block_errors() -> pd.DataFrame:
    """T-24: held-out block error from the same folds as backtest(), with the chosen split."""
    blocks = open_history()
    frames = []
    for week in (4, 5, 6):
        past = blocks[blocks["week"] < week]
        days = daily_demand(past)
        test = blocks[blocks["week"] == week].copy()
        test["daily_model"] = predict_daily(fit_daily(days), test, sorted(days["week"].unique())[-LEVEL_WEEKS:])
        test["daily_benchmark"] = _benchmark_like(days, test)
        test = attach_shares(test, shift_shares(past))
        test["model"] = test["daily_model"] * test["share"]
        test["benchmark"] = test["daily_benchmark"] * test["share"]
        frames.append(test)
    frame = pd.concat(frames, ignore_index=True)
    frame["log_error"] = np.log(frame["shift_demand_units"] / frame["model"])
    return frame


def forecast_sd() -> pd.DataFrame:
    """Held-out log error per block by department, the demand uncertainty used in the risk model."""
    frame = block_errors()
    sd = frame.groupby("dept_id")["log_error"].agg(lambda e: float(np.sqrt((e**2).mean()))).rename("sd").reset_index()
    return sd
