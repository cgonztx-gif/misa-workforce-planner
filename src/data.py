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
