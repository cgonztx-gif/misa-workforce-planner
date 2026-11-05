"""Export and validate the submission template (T-35, T-62, R-03, R-26)."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from src.allocation import apply_rule
from src.data import CSV_DIR, PLAN_KEY, load_planning_grid

# Q-07: the real team name isn't known yet. Change it here, and T-62 checks that it was changed.
TEAM_ID = "TEAM_NAME"
PLACEHOLDER_TEAM_ID = "TEAM_NAME"
TEMPLATE_PATH = CSV_DIR / "TEAM_SUBMISSION_TEMPLATE.csv"
TEMPLATE_COLUMNS = list(pd.read_csv(TEMPLATE_PATH, nrows=0).columns)


def fill_template(plan: pd.DataFrame, column: str = "recommended", team_id: str = TEAM_ID) -> pd.DataFrame:
    """Fill the template by joining on keys, keeping its row order and columns (F-15)."""
    template = pd.read_csv(TEMPLATE_PATH, parse_dates=["day_date"])
    values = plan[[*PLAN_KEY, column]].rename(columns={column: "_value"})
    filled = template.merge(values, on=PLAN_KEY, how="left", validate="one_to_one")
    filled["submitted_employees"] = filled["_value"]
    filled["team_id"] = team_id
    return filled[TEMPLATE_COLUMNS]


def write_submission(filled: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame = filled.copy()
    frame["submitted_employees"] = frame["submitted_employees"].astype("Int64")
    frame.to_csv(path, index=False, date_format="%Y-%m-%d")


def validate(filled: pd.DataFrame, final: bool = False) -> list[str]:
    """Every problem with a filled template. An empty list means it passes.

    `final` adds the check that the placeholder team name has been replaced (T-62).
    """
    problems: list[str] = []
    template = pd.read_csv(TEMPLATE_PATH, parse_dates=["day_date"])
    if list(filled.columns) != TEMPLATE_COLUMNS:
        problems.append("Columns differ from the template")
    if len(filled) != 567:
        problems.append(f"Expected 567 rows, found {len(filled)}")
    keys = lambda frame: set(map(tuple, frame[PLAN_KEY].values.tolist()))
    if keys(filled) != keys(template) or filled.duplicated(PLAN_KEY).any():
        problems.append("Keys don't match the template exactly")

    submitted = pd.to_numeric(filled["submitted_employees"], errors="coerce")
    if submitted.isna().any():
        problems.append(f"{int(submitted.isna().sum())} rows have no submitted_employees")
    elif (submitted % 1 != 0).any() or (submitted < 0).any():
        problems.append("submitted_employees must be whole numbers of 0 or more")
    if filled["team_id"].nunique() != 1:
        problems.append("team_id must be the same on every row")
    if final and (filled["team_id"] == PLACEHOLDER_TEAM_ID).any():
        problems.append("team_id still holds the placeholder TEAM_NAME (Q-07)")

    if problems:
        return problems

    grid = load_planning_grid().merge(filled[[*PLAN_KEY, "submitted_employees"]], on=PLAN_KEY, validate="one_to_one")
    grid["submitted_employees"] = grid["submitted_employees"].astype(int)
    ruled = apply_rule(grid, "submitted_employees")
    closed_staffed = ruled[(ruled["is_open"] == 0) & (ruled["submitted_employees"] != 0)]
    if len(closed_staffed):
        problems.append(f"{len(closed_staffed)} closed blocks are not 0")
    below = ruled[ruled["below_min_staff"]]
    if len(below):
        problems.append(f"{len(below)} open blocks are below min_staff")
    over = ruled[ruled["over_capacity"]]
    if len(over):
        problems.append(f"{len(over)} open blocks are above capacity under the allocation rule")
    return problems
