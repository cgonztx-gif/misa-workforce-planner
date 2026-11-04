"""Runs the app without a browser and switches between scenarios."""
from pathlib import Path

import pytest
from streamlit.testing.v1 import AppTest

APP = str(Path(__file__).resolve().parents[1] / "app.py")


@pytest.mark.parametrize(
    "scenario, over_capacity",
    [("BASE", 0), ("PEAK", 0), ("DISRUPT", 12)],
)
def test_scenario_switch(scenario, over_capacity):
    app = AppTest.from_file(APP, default_timeout=60).run()
    app.selectbox(key="scenario").select(scenario).run()
    assert not app.exception
    assert app.metric[0].value == "10,344"
    assert app.metric[1].value == str(over_capacity)
