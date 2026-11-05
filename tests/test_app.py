"""Runs the app without a browser, as T-50 to T-54 require."""
from pathlib import Path

import pandas as pd
import pytest
from streamlit.testing.v1 import AppTest

from src.data import PLAN_KEY
from src.submission import TEMPLATE_PATH

APP = str(Path(__file__).resolve().parents[1] / "app.py")


@pytest.fixture(scope="module")
def app():
    return AppTest.from_file(APP, default_timeout=120).run()


def metric(app, label):
    return next(item for item in app.metric if item.label == label)


def test_app_starts_without_errors(app):
    assert not app.exception
    assert not app.warning


@pytest.mark.parametrize(
    "scenario, cost, over_capacity_draft",
    [("BASE", "$376,176", "Draft: 0"), ("PEAK", "$387,092", "Draft: 0"), ("DISRUPT", "$365,321", "Draft: 12")],
)
def test_scenario_switch_updates_the_figures(app, scenario, cost, over_capacity_draft):
    app.button_group(key="scenario").set_value(scenario).run()
    assert not app.exception
    assert metric(app, f"Labor cost, {scenario}").value == cost
    assert metric(app, "Blocks above capacity").value == "0"
    assert metric(app, "Blocks above capacity").delta == over_capacity_draft


def test_every_warehouse_renders(app):
    app.button_group(key="scenario").set_value("BASE").run()
    for warehouse in (1, 2, 4):
        app.button_group(key="warehouse").set_value(warehouse).run()
        assert not app.exception
    app.button_group(key="warehouse").set_value(1).run()


def test_what_if_changes_the_recommendation_and_says_so(app):
    app.button_group(key="scenario").set_value("BASE").run()
    baseline = metric(app, "Labor cost, BASE").value
    app.slider(key="demand").set_value(10).run()
    assert not app.exception
    assert app.warning
    assert metric(app, "Labor cost, BASE").value != baseline
    app.button(key="reset").click().run()
    assert not app.warning
    assert metric(app, "Labor cost, BASE").value == baseline


def test_more_callouts_cost_more(app):
    app.button_group(key="scenario").set_value("BASE").run()
    baseline = float(metric(app, "Labor cost, BASE").value.replace("$", "").replace(",", ""))
    app.slider(key="callouts").set_value(200).run()
    assert not app.exception
    assert float(metric(app, "Labor cost, BASE").value.replace("$", "").replace(",", "")) > baseline
    app.button(key="reset").click().run()


def test_why_panel_gives_a_reason_and_assumptions(app):
    text = " ".join(item.value for item in app.markdown)
    # AppTest files an expander that has an icon under "status".
    assert "Assumptions behind this recommendation" in [item.label for item in app.get("status")]
    assert "**A-13:**" in text
    assert "chance of meeting target" in text
    assert "Filled with" in text


def test_dollar_signs_are_escaped_so_they_dont_render_as_math(app):
    """Found in a real browser: "$3,498, which is $825" rendered as a math formula."""
    for item in app.markdown:
        unescaped = item.value.replace("\\$", "")
        assert "$" not in unescaped, item.value


def test_simulated_data_label_is_always_shown(app):
    assert any("simulated" in item.value for item in app.caption)


def test_numbers_on_the_board_stay_readable():
    from src.app_data import BOARD_COLORS, board_fill, contrast_ratio

    assert board_fill(0, 7) == BOARD_COLORS["none"]
    assert board_fill(7, 7) == BOARD_COLORS["add"]
    assert board_fill(-7, 7) == BOARD_COLORS["cut"]
    for limit in (1, 5, 15):
        for change in range(-limit, limit + 1):
            fill = board_fill(change, limit)
            assert max(contrast_ratio("#000000", fill), contrast_ratio("#ffffff", fill)) >= 4.5, (change, limit)


def test_app_defaults_match_the_submission_file():
    """The plan shown by default is the plan submitted."""
    from src.app_data import run_scenario
    from src.search import planning_inputs
    from src.data import open_history
    from src.service import fit_all

    filled = Path(TEMPLATE_PATH).parents[3] / "outputs" / "TEAM_SUBMISSION_TEMPLATE_filled.csv"
    submitted = pd.read_csv(filled, parse_dates=["day_date"])
    curves, inputs = fit_all(open_history()), planning_inputs()
    shown = pd.concat(
        [run_scenario(inputs, curves, scenario)["explained"][[*PLAN_KEY, "recommended"]] for scenario in ("BASE", "PEAK", "DISRUPT")]
    )
    joined = submitted.merge(shown, on=PLAN_KEY, validate="one_to_one")
    assert len(joined) == 567
    assert (joined["submitted_employees"] == joined["recommended"]).all()
