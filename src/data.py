"""Loads the case data pack from data/team_distribution/csv/."""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CSV_DIR = ROOT / "data" / "team_distribution" / "csv"

SCENARIOS = ("BASE", "PEAK", "DISRUPT")
DEPARTMENTS = {38: "Front End", 92: "Merchandising", 95: "Pharmacy"}
WAREHOUSES = {1: "Warehouse 1 (Medium)", 2: "Warehouse 2 (Large)", 4: "Warehouse 4 (Large)"}

BLOCK_KEY = ["store_id", "dept_id", "day_date", "shift_code"]
PLAN_KEY = ["scenario_id", *BLOCK_KEY]


def _read(name: str) -> pd.DataFrame:
    return pd.read_csv(CSV_DIR / f"{name}.csv", parse_dates=["day_date"])


def load_history() -> pd.DataFrame:
    """One row per historical block, Jan 1 - Feb 11, 2026."""
    return _read("v_ShiftHistory")


def load_planning_grid() -> pd.DataFrame:
    """One row per scenario x planning-week block, Feb 12 - 18, 2026. Has no demand."""
    return _read("v_PlanningWeekGrid")


def load_template() -> pd.DataFrame:
    """The blank submission template. Join on PLAN_KEY, never by row position."""
    return _read("TEAM_SUBMISSION_TEMPLATE")


def load_benchmark() -> pd.DataFrame:
    """The naive daily forecast, the floor to beat."""
    return _read("PlanningWeek_BenchmarkForecast")


def capacity(grid: pd.DataFrame) -> pd.Series:
    """Most employees a block can hold, before limiting flex to what the partner department can spare."""
    return (
        grid["available_regular_employees"]
        + grid["max_overtime_employees"]
        + grid["cross_trained_flex_employees"]
    )


# History and planning label the same holiday windows differently (F-13), so both map to shared categories.
HOLIDAY_WINDOWS = {
    "Normal": "normal",
    "Post_New_Year_Rebound": "new_year_rebound",
    "Pre_MLK_Weekend": "pre_holiday_weekend",
    "Pre_Presidents_Day_Weekend": "pre_holiday_weekend",
    "MLK_Holiday": "holiday_monday",
    "Presidents_Day_Holiday": "holiday_monday",
}


def load_labor_standard() -> dict[int, float]:
    """Labor hours per workload unit at 100% productive time, by department."""
    table = pd.read_csv(CSV_DIR / "comp_LaborStandard.csv")
    return dict(zip(table["dept_id"], table["labor_hours_per_workload_unit"]))


def open_history() -> pd.DataFrame:
    """Open historical blocks, with utilization and the service ratio added.

    Utilization is workload hours over worked hours. A ratio above 1 misses target.
    Week 1 starts on Thu Jan 1, matching week_start_date.
    """
    history = load_history()
    blocks = history[history["is_open"] == 1].copy()
    standard = blocks["dept_id"].map(load_labor_standard())
    blocks["workload_hours"] = blocks["shift_demand_units"] * standard
    blocks["utilization"] = blocks["workload_hours"] / blocks["worked_labor_hours"]
    blocks["service_ratio"] = blocks["metric_value"] / blocks["target_value"]
    blocks["met_target"] = blocks["met_target"].astype(int)
    blocks["week"] = ((blocks["day_date"] - pd.Timestamp("2026-01-01")).dt.days // 7) + 1
    blocks["window"] = blocks["holiday_window_role"].map(HOLIDAY_WINDOWS)
    return blocks
