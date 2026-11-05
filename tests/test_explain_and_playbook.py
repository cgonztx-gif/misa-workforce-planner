"""Explanations and the playbook (T-41, T-42, R-14, R-20, R-22, R-23)."""
import pandas as pd
import pytest

from src.data import open_history
from src.explain import ASSUMPTIONS, explain_plan
from src.playbook import on_the_day, pto_drop, pto_what_if, scenario_actions
from src.risk import cushion
from src.search import build_plan, evaluate, planning_inputs
from src.service import fit_all


@pytest.fixture(scope="module")
def setup():
    curves = fit_all(open_history())
    inputs = planning_inputs()
    plan = build_plan(inputs, curves)
    explained = explain_plan(evaluate(plan, "recommended", curves), evaluate(plan, "draft_scheduled_employees", curves), curves)
    return curves, inputs, explained


def test_every_block_is_explained(setup):
    _, _, explained = setup
    assert len(explained) == 567
    assert explained["why"].str.len().gt(20).all()
    assert explained["headline"].str.len().gt(0).all()


def test_every_open_block_has_all_its_reasons(setup):
    _, _, explained = setup
    open_rows = explained[explained["is_open"] == 1]
    for column in ("demand_driver", "staffing", "cost_effect", "service_effect", "cushion_text"):
        assert open_rows[column].str.len().gt(0).all(), column


def test_headline_matches_the_numbers(setup):
    _, _, explained = setup
    added = explained[explained["change"] > 0].iloc[0]
    assert added["headline"].startswith(f"Add {added['change']}:")
    cut = explained[explained["change"] < 0].iloc[0]
    assert cut["headline"].startswith(f"Cut {-cut['change']}:")
    assert (explained["change"] == explained["recommended"] - explained["draft_scheduled_employees"]).all()


def test_below_goal_blocks_say_they_cant_reach_it(setup):
    _, _, explained = setup
    short = explained[(explained["is_open"] == 1) & (explained["chance_met"] < 0.9495)]
    assert short["why"].str.startswith("This block can't reach the goal").all()


def test_draft_above_capacity_says_so(setup):
    _, _, explained = setup
    over = explained[explained["unfilled_draft"] > 0]
    assert len(over) == 12
    assert over["why"].str.contains("can be fielded").all()


def test_holiday_and_scenario_drivers_appear(setup):
    _, _, explained = setup
    feb14 = explained[(explained["scenario_code"] == "BASE") & (explained["day_date"] == "2026-02-14") & (explained["dept_id"] == 38)].iloc[0]
    assert "12% more" in feb14["demand_driver"]
    assert "Valentine's Day adds 3%" in feb14["demand_driver"]
    pharmacy = explained[(explained["scenario_code"] == "BASE") & (explained["day_date"] == "2026-02-16") & (explained["dept_id"] == 95)].iloc[0]
    assert "30% less" in pharmacy["demand_driver"]
    peak = explained[(explained["scenario_code"] == "PEAK") & (explained["demand_multiplier"] > 1) & (explained["is_open"] == 1)].iloc[0]
    assert "This scenario raises demand" in peak["demand_driver"]


def test_assumptions_listed_exist_and_fit_the_block(setup):
    _, _, explained = setup
    for ids in explained["assumption_ids"]:
        assert set(ids) <= set(ASSUMPTIONS)
    illness = explained[explained["callout_context"] == "flu_cluster"]
    assert len(illness) > 0
    assert all("A-12" in ids for ids in illness["assumption_ids"])
    pharmacy = explained[(explained["dept_id"] == 95) & (explained["is_open"] == 1)]
    assert not any("A-01" in ids for ids in pharmacy["assumption_ids"])


def test_cushion_matches_the_trouble_line(setup):
    curves, _, _ = setup
    curve = curves[38]
    line = curve.utilization_for(1, 0.5)
    people, demand = cushion(curve, 1, workload_hours=60.0, employees=25, paid_hours=4.0)
    assert 60.0 / ((25 - people) * 4.0) <= line + 1e-9
    assert 60.0 / ((25 - people - 1) * 4.0) > line
    assert 60.0 * (1 + demand) / (25 * 4.0) == pytest.approx(line)


def test_every_scenario_has_a_trigger_and_actions(setup):
    _, _, explained = setup
    actions = scenario_actions(explained)
    assert set(actions) == {"BASE", "PEAK", "DISRUPT"}
    for entry in actions.values():
        assert len(entry["trigger"]) > 20
        assert len(entry["actions"]) >= 3
    assert len(on_the_day(explained)) >= 3


def test_pto_drop_only_counts_blocks_marked_with_holiday_pto(setup):
    _, inputs, _ = setup
    base = inputs[inputs["scenario_code"] == "BASE"]
    drop = pto_drop(base)
    assert (drop >= 0).all()
    assert (drop[base["availability_note"] != "Holiday-weekend PTO requests"] == 0).all()
    assert drop.sum() > 0


def test_keeping_more_people_never_makes_the_plan_worse(setup):
    curves, inputs, _ = setup
    table = pto_what_if(inputs, curves, limits=(0, 2, 5))
    assert table["people_kept"].is_monotonic_increasing
    assert table["blocks_below_goal"].is_monotonic_decreasing
    assert table["expected_met"].is_monotonic_increasing
    assert table.loc[0, "people_kept"] == 0
    assert isinstance(table, pd.DataFrame)


def test_keeping_enough_people_clears_every_block_holiday_pto_touches(setup):
    curves, inputs, _ = setup
    table = pto_what_if(inputs, curves, limits=(0, 5))
    assert table.loc[0, "below_goal_with_holiday_pto"] > 0
    assert table.loc[1, "below_goal_with_holiday_pto"] == 0
