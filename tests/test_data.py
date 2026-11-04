"""Expected values come from planning/FINDINGS.md (F-02, F-09, F-14, F-15)."""
from src.data import (
    PLAN_KEY,
    capacity,
    load_benchmark,
    load_history,
    load_planning_grid,
    load_template,
)


def test_row_counts():
    assert len(load_history()) == 1134
    assert len(load_planning_grid()) == 567
    assert len(load_template()) == 567
    assert len(load_benchmark()) == 63


def test_template_keys_match_the_planning_grid():
    keys = lambda df: set(map(tuple, df[PLAN_KEY].values.tolist()))
    assert keys(load_template()) == keys(load_planning_grid())


def test_template_has_27_closed_rows():
    assert (load_template()["is_open"] == 0).sum() == 27


def test_draft_over_capacity_only_in_disrupt():
    grid = load_planning_grid()
    grid = grid[grid["is_open"] == 1]
    over = grid[grid["draft_scheduled_employees"] > capacity(grid)]
    assert over["scenario_code"].value_counts().to_dict() == {"DISRUPT": 12}
