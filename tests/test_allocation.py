"""The allocation rule (T-30, D-10, A-01, A-02, A-10)."""
import pandas as pd
import pytest

from src.allocation import allocate, apply_rule, block_cost, usable_flex
from src.data import load_planning_grid


def split(*args, **kwargs):
    return [part.item() for part in allocate(*args, **kwargs)]


def test_regular_staff_fill_first():
    assert split(8, regular=10, overtime=3, usable=2) == [8, 0, 0, 0]


def test_flex_fills_before_overtime():
    assert split(11, regular=10, overtime=3, usable=2) == [10, 1, 0, 0]


def test_overtime_comes_last():
    assert split(14, regular=10, overtime=3, usable=2) == [10, 2, 2, 0]


def test_anything_above_capacity_is_unfilled():
    assert split(17, regular=10, overtime=3, usable=2) == [10, 2, 3, 2]


@pytest.mark.parametrize(
    "flex, partner_regular, partner_submitted, expected",
    [
        (2, 10, 5, 2),  # the row's flex limits it
        (4, 10, 8, 2),  # what the partner can spare limits it
        (4, 10, 10, 0),  # the partner uses all its regular staff
        (4, 10, 12, 0),  # the partner is short itself, so it can't lend
    ],
)
def test_usable_flex_is_limited_by_the_partner(flex, partner_regular, partner_submitted, expected):
    assert usable_flex(flex, partner_regular, partner_submitted).item() == expected


def test_cost_uses_the_regular_rate_for_flex_and_the_overtime_rate_for_overtime():
    cost = block_cost(10, 2, 1, paid_hours=4.0, regular_rate=30.0, overtime_rate=40.0)
    assert cost.item() == 12 * 4 * 30 + 1 * 4 * 40


def small_grid(front_end_total, merch_total, pharmacy_total=2):
    rows = [
        (38, 10, 2, 1, front_end_total),
        (92, 10, 1, 3, merch_total),
        (95, 3, 1, 0, pharmacy_total),
    ]
    return pd.DataFrame(
        [
            {
                "scenario_id": 1,
                "store_id": 1,
                "day_date": pd.Timestamp("2026-02-12"),
                "shift_code": "OPEN",
                "dept_id": dept,
                "available_regular_employees": regular,
                "max_overtime_employees": overtime,
                "cross_trained_flex_employees": flex,
                "plan": total,
                "paid_hours": 4.0,
                "is_open": 1,
                "min_staff": 2,
                "loaded_regular_hourly_cost": 30.0,
                "loaded_overtime_hourly_cost": 40.0,
            }
            for dept, regular, overtime, flex, total in rows
        ]
    )


def test_partner_shift_links_front_end_and_merchandising():
    result = apply_rule(small_grid(front_end_total=12, merch_total=9), "plan").set_index("dept_id")
    # Merchandising can spare 1 and Front End's own flex limit is 1, so the second extra person is overtime.
    assert result.loc[38, ["fill_regular", "fill_flex", "fill_overtime", "unfilled"]].tolist() == [10, 1, 1, 0]
    assert result.loc[38, "capacity"] == 13


def test_both_departments_short_means_no_flex_for_either():
    result = apply_rule(small_grid(front_end_total=13, merch_total=12), "plan").set_index("dept_id")
    assert result.loc[38, "usable_flex"] == 0
    assert result.loc[92, "usable_flex"] == 0
    assert result.loc[38, "unfilled"] == 1
    assert bool(result.loc[38, "over_capacity"]) is True


def test_pharmacy_never_borrows():
    result = apply_rule(small_grid(front_end_total=5, merch_total=5, pharmacy_total=5), "plan").set_index("dept_id")
    assert result.loc[95, "usable_flex"] == 0
    assert result.loc[95, ["fill_regular", "fill_overtime", "unfilled"]].tolist() == [3, 1, 1]


def test_below_min_staff_is_flagged():
    result = apply_rule(small_grid(front_end_total=1, merch_total=5), "plan").set_index("dept_id")
    assert bool(result.loc[38, "below_min_staff"]) is True
    assert bool(result.loc[92, "below_min_staff"]) is False


def test_draft_on_the_real_grid_keeps_every_row_and_stays_consistent():
    grid = load_planning_grid()
    result = apply_rule(grid, "draft_scheduled_employees")
    assert len(result) == len(grid)
    assert (result["fielded"] + result["unfilled"] == result["draft_scheduled_employees"]).all()
    assert (result.loc[result["dept_id"] == 95, "usable_flex"] == 0).all()
    assert (result["usable_flex"] <= result["cross_trained_flex_employees"]).all()
    assert (result.loc[result["is_open"] == 0, "cost"] == 0).all()
