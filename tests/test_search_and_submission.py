"""The staffing search and the submission file (T-32, T-33, T-35, T-62, R-03, R-26)."""
import pytest

from src.data import PLAN_KEY, load_template, open_history
from src.search import SERVICE_GOAL, build_plan, evaluate, needed_employees, planning_inputs, summarize
from src.service import fit_all
from src.submission import fill_template, validate


@pytest.fixture(scope="module")
def setup():
    curves = fit_all(open_history())
    inputs = planning_inputs()
    plan = build_plan(inputs, curves)
    return curves, inputs, plan, evaluate(plan, "recommended", curves)


def test_every_block_gets_a_value_and_closed_blocks_are_zero(setup):
    _, _, plan, _ = setup
    assert len(plan) == 567
    assert plan["recommended"].notna().all()
    assert (plan.loc[plan["is_open"] == 0, "recommended"] == 0).all()
    assert (plan.loc[plan["is_open"] == 1, "recommended"] > 0).all()


def test_plan_is_feasible_in_every_scenario(setup):
    _, _, _, result = setup
    assert result["over_capacity"].sum() == 0
    assert result["below_min_staff"].sum() == 0


def test_blocks_below_goal_have_used_all_their_own_staff(setup):
    _, _, _, result = setup
    short = result[(result["is_open"] == 1) & (result["chance_met"] < SERVICE_GOAL - 0.0005)]
    own_capacity = short["available_regular_employees"] + short["max_overtime_employees"]
    assert (short["recommended"] >= own_capacity).all()


def test_no_department_is_cut_below_its_need_to_lend_staff(setup):
    curves, _, _, result = setup
    open_rows = result[result["is_open"] == 1]
    for row in open_rows.itertuples():
        need = needed_employees(row, curves, SERVICE_GOAL)
        floor = min(need, row.available_regular_employees + row.max_overtime_employees)
        assert row.recommended >= floor, (row.scenario_code, row.store_id, row.dept_id, row.day_date, row.shift_code)


def test_scenarios_behave_sensibly(setup):
    _, _, _, result = setup
    summary = summarize(result).set_index("scenario_code")
    assert summary.loc["PEAK", "hours"] > summary.loc["BASE", "hours"]
    assert summary.loc["DISRUPT", "hours"] < summary.loc["BASE", "hours"]


def test_plan_improves_expected_service_over_the_draft_in_all_scenarios(setup):
    curves, inputs, _, result = setup
    plan = summarize(result).set_index("scenario_code")
    draft = summarize(evaluate(inputs, "draft_scheduled_employees", curves)).set_index("scenario_code")
    assert (plan["expected_met"] > draft["expected_met"]).all()


def test_filled_template_passes_validation_and_keeps_row_order(setup):
    _, _, plan, _ = setup
    filled = fill_template(plan)
    assert validate(filled) == []
    template = load_template()
    assert filled[PLAN_KEY].astype(str).equals(template[PLAN_KEY].astype(str))


def test_validator_catches_each_kind_of_problem(setup):
    _, _, plan, _ = setup
    good = fill_template(plan)

    closed = good.copy()
    closed.loc[closed["is_open"] == 0, "submitted_employees"] = 3
    assert any("closed" in problem for problem in validate(closed))

    below = good.copy()
    below.loc[below["is_open"] == 1, "submitted_employees"] = 1
    assert any("min_staff" in problem for problem in validate(below))

    above = good.copy()
    above.loc[above["is_open"] == 1, "submitted_employees"] = 500
    assert any("capacity" in problem for problem in validate(above))

    missing = good.copy()
    missing.loc[0, "submitted_employees"] = None
    assert any("no submitted_employees" in problem for problem in validate(missing))

    assert any("Expected 567" in problem for problem in validate(good.iloc[:-1]))


def test_final_check_rejects_the_placeholder_team_name(setup):
    _, _, plan, _ = setup
    placeholder = fill_template(plan)
    assert any("placeholder" in problem for problem in validate(placeholder, final=True))
    assert validate(fill_template(plan, team_id="A Real Team"), final=True) == []
