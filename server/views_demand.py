"""Payload for /api/forecast: the daily forecast, the parts it's built from, shift shares and accuracy."""
from __future__ import annotations

import pandas as pd

from server.content import DEPARTMENTS, HOLIDAYS, SHIFTS, WAREHOUSES, day_label, short_day_label, warehouse_label
from server.views import _named
from src.data import open_history
from src.diagnosis import daily_demand
from src.forecast import LEVEL_WEEKS, fit_daily, forecast_daily, planning_days, predict_daily

WINDOW_LABELS = {
    "normal": "Normal day",
    "pre_holiday_weekend": "Presidents' Day weekend",
    "holiday_monday": "Presidents' Day",
}


def _days(inputs: pd.DataFrame, results: dict[str, dict]) -> pd.DataFrame:
    """One row per warehouse, department and day: each step from a normal day to each scenario's demand."""
    history = daily_demand(open_history())
    model = fit_daily(history)
    weeks = sorted(history["week"].unique())[-LEVEL_WEEKS:]
    days = planning_days()
    days["normal_day"] = predict_daily(model, days.assign(window="normal"), weeks)
    frame = forecast_daily().merge(days[["store_id", "dept_id", "day_date", "normal_day"]], on=["store_id", "dept_id", "day_date"], validate="one_to_one")
    for code, result in results.items():
        daily = result["demand"][["store_id", "dept_id", "day_date", "forecast", "driver"]]
        daily = daily.rename(columns={"forecast": f"demand_{code}", "driver": f"driver_{code}"})
        frame = frame.merge(daily, on=["store_id", "dept_id", "day_date"], how="left", validate="one_to_one")
        open_rows = inputs[(inputs["scenario_code"] == code) & (inputs["is_open"] == 1) & (inputs["demand_multiplier"] != 1)]
        reasons = open_rows.groupby(["store_id", "dept_id", "day_date"])["adjustment_reason"].agg(lambda r: "; ".join(sorted(set(r))))
        frame = frame.merge(reasons.rename(f"reason_{code}").reset_index(), on=["store_id", "dept_id", "day_date"], how="left")
    return frame


def _day_record(row: dict, scenarios: list[str]) -> dict:
    day = pd.Timestamp(row["day_date"])
    iso = f"{day:%Y-%m-%d}"
    forecast = row["daily_forecast"]
    record = {
        "date": iso, "day": day_label(day), "day_short": short_day_label(day), "holiday": HOLIDAYS.get(iso),
        "window": row["window"], "window_label": WINDOW_LABELS.get(row["window"], row["window"]),
        "normal_day": row["normal_day"],
        "holiday_factor": row["model_forecast"] / row["normal_day"],
        "holiday_effect": row["model_forecast"] - row["normal_day"],
        "model_forecast": row["model_forecast"],
        "valentine_uplift": row["valentine_uplift"],
        "valentine_effect": forecast - row["model_forecast"],
        "forecast": forecast,
        "benchmark": row["benchmark"],
        "vs_benchmark": forecast / row["benchmark"] - 1,
        "driver": row.get("driver_BASE"),
        "scenarios": {},
    }
    for code in scenarios:
        demand = row.get(f"demand_{code}")
        reason = row.get(f"reason_{code}")
        record["scenarios"][code] = {
            "demand": demand,
            "multiplier": demand / forecast if demand is not None and forecast else None,
            "effect": demand - forecast if demand is not None else None,
            "reason": reason if isinstance(reason, str) else None,
            "driver": row.get(f"driver_{code}"),
        }
    return record


def _series(frame: pd.DataFrame, scenarios: list[str]) -> list[dict]:
    series = []
    for (store, dept), part in frame.groupby(["store_id", "dept_id"], sort=True):
        series.append(
            {
                "store_id": int(store), "warehouse": warehouse_label(store), "dept_id": int(dept), "department": DEPARTMENTS[int(dept)]["name"],
                "unit": DEPARTMENTS[int(dept)]["demand_unit"],
                "days": [_day_record(row, scenarios) for row in part.sort_values("day_date").to_dict(orient="records")],
            }
        )
    sums = ["normal_day", "model_forecast", "daily_forecast", "benchmark", *[f"demand_{code}" for code in scenarios]]
    for dept, part in frame.groupby("dept_id", sort=True):
        daily = part.groupby("day_date", as_index=False).agg({**{c: "sum" for c in sums}, "window": "first", "valentine_uplift": "first", "driver_BASE": "first"})
        for code in scenarios:
            reasons = part.groupby("day_date")[f"reason_{code}"].agg(lambda r: "; ".join(sorted({x for x in r if isinstance(x, str)})) or None)
            daily[f"reason_{code}"] = daily["day_date"].map(reasons)
            daily[f"driver_{code}"] = None
        daily["driver_BASE"] = None  # Drivers name one warehouse's holiday factor, so they're left off the total.
        series.append(
            {
                "store_id": None, "warehouse": "All warehouses", "dept_id": int(dept), "department": DEPARTMENTS[int(dept)]["name"],
                "unit": DEPARTMENTS[int(dept)]["demand_unit"],
                "days": [_day_record(row, scenarios) for row in daily.to_dict(orient="records")],
            }
        )
    return series


def _shift_shares(inputs: pd.DataFrame) -> list[dict]:
    base = inputs[(inputs["scenario_code"] == "BASE") & (inputs["is_open"] == 1)]
    table = base.groupby(["dept_id", "day_date", "shift_code"])["share"].mean().unstack("shift_code")
    rows = []
    for (dept, day), shares in table.iterrows():
        iso = f"{day:%Y-%m-%d}"
        rows.append(
            {
                "dept_id": int(dept), "department": DEPARTMENTS[int(dept)]["name"], "date": iso, "day": day_label(day), "holiday": HOLIDAYS.get(iso),
                "shares": {code: (float(shares[code]) if code in shares and pd.notna(shares[code]) else None) for code in SHIFTS},
            }
        )
    return rows


def _drivers(kpi: dict, uplift: dict) -> list[dict]:
    return [
        {"driver": "Weekday pattern", "tested": "Warehouse level and each department's weekday shape", "found": f"Explain {kpi['r2_dow']:.1%} of the variation in log daily demand.", "use": "In the model."},
        {"driver": "Holiday windows", "tested": "New Year rebound, MLK weekend and MLK Day, by department", "found": f"Raise the fit to {kpi['r2_dow_hol']:.1%}. The MLK window is the guide for Presidents' Day (A-05).", "use": "In the model."},
        {"driver": "Weekly level", "tested": "A level per week", "found": f"Weeks ran from {kpi['week_level_min']:.2f} to {kpi['week_level_max']:.2f} of average with no trend. The fit reaches {kpi['r2_full']:.4%}.", "use": f"In the model, at the average of the last {LEVEL_WEEKS} weeks (A-14)."},
        {"driver": "Temperature (weather)", "tested": "Correlation with what the model leaves unexplained", "found": f"{kpi['corr_temp_resid']:+.3f}. Front End's raw {kpi['corr_temp_raw_fe']:+.2f} is a calendar artifact.", "use": "Left out. PEAK's storm effect enters through the case's multipliers."},
        {"driver": "Promotions", "tested": "Correlation with what the model leaves unexplained", "found": f"{kpi['corr_promo_resid']:+.3f}, no effect once the weekday is known.", "use": "Left out. PEAK's promotion enters through the case's multipliers."},
        {"driver": "Customer traffic", "tested": "The data pack's traffic index", "found": "It's an output of the simulation, labeled never to use as a model input, so using it would leak the answer.", "use": "Not used. The model forecasts the workload proxy directly."},
        {"driver": "Valentine's Day", "tested": "No history: it fell outside the six weeks", "found": "A stated judgment, tested for sensitivity.", "use": f"Adds {uplift.get('Front End', 0):.0%} to Front End and Merchandising on Feb 14 (A-06)."},
        {"driver": "Post-holiday rebound", "tested": "Jan 20, flagged like Feb 17", "found": f"Ran {kpi['rebound_extra']:.1%} above its own week.", "use": "Left out."},
    ]


def _accuracy(summary: dict) -> dict:
    daily = {row["group"]: row for row in summary["backtest_daily"]}["All"]
    block = {row["group"]: row for row in summary["backtest_block"]}["All"]
    groups = {row["group"]: row for row in summary["backtest_by_day_group"]}
    fri_mon, tue_thu = groups["Fri-Mon"], groups["Tue-Thu"]
    return {
        "daily_model": daily["model"], "daily_benchmark": daily["benchmark"],
        "block_model": block["model"], "block_benchmark": block["benchmark"],
        "text": (
            f"On held-out normal weeks, daily error was {daily['model']:.1%} against the benchmark method's {daily['benchmark']:.1%}, "
            f"and {block['model']:.1%} against {block['benchmark']:.1%} by block. The edge comes from Fri-Mon ({fri_mon['model']:.1%} vs {fri_mon['benchmark']:.1%}), "
            f"where the benchmark's average held earlier holiday days. On Tue-Thu the two are close ({tue_thu['model']:.1%} vs {tue_thu['benchmark']:.1%})."
        ),
        "limit": "These weeks hold no holidays and there are only three folds, so the claim is that the forecast removes holiday distortion, not that it beats the benchmark in the planning week.",
    }


def forecast(inputs: pd.DataFrame, results: dict[str, dict], summary: dict) -> dict:
    scenarios = list(results)
    frame = _days(inputs, results)
    return {
        "series": _series(frame, scenarios),
        "shift_shares": _shift_shares(inputs),
        "shift_note": f"On holiday-window days, Front End demand shifts about {summary['kpi']['fe_mid_shift_pts'] * 100:.0f} points toward midday.",
        "holiday_factors": _named(summary["holiday_factors"]),
        "valentine": {"uplift": summary["valentine_uplift"], "sensitivity": summary["valentine_sensitivity"], "assumption": "A-06"},
        "accuracy": _accuracy(summary),
        "backtest": {
            "daily": _named(summary["backtest_daily"]), "block": _named(summary["backtest_block"]),
            "by_week": _named(summary["backtest_by_week"]), "by_day_group": summary["backtest_by_day_group"],
            "analog": _named(summary["analog_test"]), "split": summary["split_test"], "forecast_sd": _named(summary["forecast_sd"]),
        },
        "drivers_tested": _drivers(summary["kpi"], summary["valentine_uplift"]),
        "notes": {
            "units": "Demand units differ by department, so compare them only within a department.",
            "benchmark": "The case's naive forecast: the same weekday's average over weeks 3-6. It ignores holidays.",
            "steps": "normal_day x holiday_factor = model_forecast; x (1 + valentine_uplift) = forecast (BASE); x scenarios[code].multiplier = scenarios[code].demand.",
        },
    }


def filter_forecast(payload: dict, store: int | str | None, dept: int | None) -> dict:
    """Narrow the series to one warehouse ('all' for the totals) and/or one department."""
    series = payload["series"]
    if store is not None:
        wanted = None if store == "all" else int(store)
        series = [item for item in series if item["store_id"] == wanted]
    if dept is not None:
        series = [item for item in series if item["dept_id"] == int(dept)]
        return {**payload, "series": series, "shift_shares": [row for row in payload["shift_shares"] if row["dept_id"] == int(dept)]}
    return {**payload, "series": series}
