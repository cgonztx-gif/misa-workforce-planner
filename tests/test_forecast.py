"""The forecast (T-20 to T-24, R-28, R-29)."""
import numpy as np
import pandas as pd
import pytest

from src.diagnosis import daily_demand, holiday_factors
from src.forecast import VALENTINE_UPLIFT, backtest, error_table, forecast_blocks, forecast_daily


def test_training_table_excludes_closed_days():
    assert len(daily_demand()) == 369


@pytest.mark.parametrize(
    "dept, window, factor",
    [
        (38, "pre_holiday_weekend", 1.12),
        (92, "pre_holiday_weekend", 1.08),
        (95, "pre_holiday_weekend", 0.95),
        (38, "holiday_monday", 1.05),
        (92, "holiday_monday", 1.05),
        (95, "holiday_monday", 0.70),
    ],
)
def test_holiday_effects_match_the_generating_script(dept, window, factor):
    table = holiday_factors(daily_demand()).set_index(["dept_id", "window"])["factor"]
    assert table[(dept, window)] == pytest.approx(factor, abs=0.002)


def test_forecast_beats_the_benchmark_method_on_held_out_weeks():
    overall = error_table(backtest()).iloc[0]
    assert overall["model"] < overall["benchmark"]


def test_every_planning_day_has_a_positive_forecast():
    daily = forecast_daily()
    assert len(daily) == 63
    assert (daily["daily_forecast"] > 0).all()


def test_shifts_sum_to_the_day():
    blocks = forecast_blocks()
    assert len(blocks) == 180  # 189 blocks less 9 closed Pharmacy blocks
    totals = blocks.groupby(["store_id", "dept_id", "day_date"]).agg(
        total=("base_demand", "sum"), daily=("daily_forecast", "first")
    )
    assert np.allclose(totals["total"], totals["daily"])


def test_valentine_adjustment_only_touches_that_day_and_is_shown_separately():
    daily = forecast_daily()
    other_days = daily[daily["day_date"] != pd.Timestamp("2026-02-14")]
    assert (other_days["daily_forecast"] == other_days["model_forecast"]).all()
    valentine = daily[daily["day_date"] == pd.Timestamp("2026-02-14")]
    ratio = (valentine["daily_forecast"] / valentine["model_forecast"] - 1).round(6)
    assert (ratio == valentine["dept_id"].map(VALENTINE_UPLIFT)).all()
