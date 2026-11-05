"""The web app's API (T-80): defaults are the submitted plan, and every response is strict JSON."""
import io
import json
import math
import time
import warnings

import pandas as pd
import pytest

with warnings.catch_warnings():
    warnings.simplefilter("ignore")  # Starlette suggests httpx2. httpx 0.28.1 is pinned and works.
    from fastapi.testclient import TestClient

from server.api import create_app
from server.engine import Engine, read_output
from src.submission import validate

SCENARIOS = ("BASE", "PEAK", "DISRUPT")
KEYS = ["scenario_code", "store_id", "dept_id", "day_date", "shift_code"]
JSON_ENDPOINTS = [
    "/api/health", "/api/meta", "/api/plan?scenario=BASE", "/api/plan?scenario=PEAK", "/api/plan?scenario=DISRUPT",
    "/api/compare", "/api/forecast", "/api/forecast?store=2&dept=38", "/api/forecast?store=all", "/api/tradeoff",
    "/api/playbook", "/api/diagnosis", "/api/methods", "/api/what-if?scenario=DISRUPT", "/api/what-if?scenario=BASE&demand=0.1",
]


def strict(response) -> dict:
    """Parse JSON the way a strict parser would: NaN and Infinity are errors."""
    def refuse(token):
        raise ValueError(f"Non-standard JSON constant {token}")

    return json.loads(response.text, parse_constant=refuse)


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        assert app.state.engine.wait(180), app.state.engine.error
        yield test_client


@pytest.fixture(scope="module")
def plans(client):
    return {code: strict(client.get(f"/api/plan?scenario={code}")) for code in SCENARIOS}


def blocks_frame(plans: dict) -> pd.DataFrame:
    rows = [block for payload in plans.values() for block in payload["blocks"]]
    frame = pd.DataFrame(rows).rename(columns={"scenario": "scenario_code", "date": "day_date"})
    frame["day_date"] = pd.to_datetime(frame["day_date"])
    return frame


def test_health_is_ready_within_the_budget(client):
    health = strict(client.get("/api/health"))
    assert health["ready"] is True and health["error"] is None
    assert 0 < health["seconds"] < 30


def test_meta_keeps_the_contract(client):
    meta = strict(client.get("/api/meta"))
    assert meta["product"] == "Workforce Planner"
    assert [s["code"] for s in meta["scenarios"]] == list(SCENARIOS)
    assert all(set(s) >= {"code", "name", "description"} for s in meta["scenarios"])
    assert [(w["id"], w["size"]) for w in meta["warehouses"]] == [(1, "Medium"), (2, "Large"), (4, "Large")]
    assert all(set(w) >= {"id", "label", "size"} for w in meta["warehouses"])
    assert [d["id"] for d in meta["departments"]] == [38, 92, 95]
    assert all(set(d) >= {"id", "name", "service_target"} for d in meta["departments"])
    assert [s["code"] for s in meta["shifts"]] == ["OPEN", "MID", "EVE"]
    assert [d["label"] for d in meta["days"]][2] == "Sat Feb 14" and len(meta["days"]) == 7
    assert meta["days"][2]["holiday"] == "Valentine's Day" and meta["days"][0]["holiday"] is None
    assert {k: meta["defaults"][k] for k in ("goal", "callouts", "demand")} == {"goal": 0.95, "callouts": 1, "demand": 0}
    assert all(set(g) == {"term", "definition"} for g in meta["glossary"])
    assert {a["source"] for a in meta["assumptions"]} == {"ours", "case"}
    assert "A-13" in {a["id"] for a in meta["assumptions"]}


def test_simulated_data_notice_is_present(client):
    for path in ("/api/meta", "/api/methods"):
        notice = strict(client.get(path))["notice"]
        assert "simulated" in notice and "not Costco data" in notice


def test_default_plan_equals_the_submission_file(plans):
    submitted = read_output("TEAM_SUBMISSION_TEMPLATE_filled.csv", parse_dates=["day_date"])
    joined = submitted.merge(blocks_frame(plans), on=KEYS, how="inner", validate="one_to_one")
    assert len(joined) == 567
    assert (joined["submitted_employees"] == joined["plan"]).all()
    assert (joined["draft_scheduled_employees"] == joined["draft"]).all()
    assert ((joined["is_open_x"] == 1) == joined["is_open_y"]).all()


def test_costs_and_chances_equal_plan_vs_draft(plans):
    saved = read_output("plan_vs_draft.csv", parse_dates=["day_date"])
    joined = saved.merge(blocks_frame(plans), on=KEYS, how="inner", validate="one_to_one")
    assert len(joined) == 567
    assert (joined["cost_x"] - joined["cost_y"]).abs().max() < 0.01
    assert (joined["cost_draft_x"] - joined["cost_draft_y"]).abs().max() < 0.01
    open_rows = joined[joined["is_open_x"] == 1]
    assert (open_rows["chance_met"] - open_rows["chance"]).abs().max() < 1e-5
    assert (open_rows["chance_met_draft"] - open_rows["chance_draft"]).abs().max() < 1e-5
    assert (joined["below_service_goal"] == joined["below_goal"]).all()
    for source, column in (("regular", "fill_regular"), ("flex", "fill_flex"), ("overtime", "fill_overtime")):
        assert (joined["sources"].map(lambda s: s[source]) == joined[column]).all()
    for code, payload in plans.items():
        part = saved[(saved["scenario_code"] == code) & (saved["is_open"] == 1)]
        totals = payload["totals"]["all"]
        assert totals["plan"]["cost"] == pytest.approx(part["cost"].sum(), abs=0.01)
        assert totals["draft"]["cost"] == pytest.approx(part["cost_draft"].sum(), abs=0.01)


def test_totals_match_the_pipeline_summary(plans):
    summary = read_output("analysis_summary.json")
    for kind in ("plan", "draft"):
        for row in summary[f"{kind}_summary"]:
            totals = plans[row["scenario_code"]]["totals"]["all"][kind]
            for field in ("hours", "cost", "overtime_hours", "flex_hours"):
                assert totals[field] == pytest.approx(row[field], abs=0.01), (kind, row["scenario_code"], field)
            assert totals["expected_met"] == pytest.approx(row["expected_met"], abs=0.0005)
            assert (totals["below_goal"], totals["over_capacity"]) == (row["below_goal"], row["over_capacity"])
    warehouses = sum(plans["BASE"]["totals"][group]["plan"]["cost"] for group in ("1", "2", "4"))
    assert warehouses == pytest.approx(plans["BASE"]["totals"]["all"]["plan"]["cost"], abs=0.01)


def test_blocks_have_keys_and_labels(plans):
    for code, payload in plans.items():
        keys = [block["key"] for block in payload["blocks"]]
        assert len(keys) == len(set(keys)) == 189
        block = payload["blocks"][0]
        assert block["key"] == f"{code}|{block['store_id']}|{block['dept_id']}|{block['date']}|{block['shift_code']}"
        assert block["label"].startswith(block["day"]) and block["shift"] in block["label"]
        assert all(b["explanation"]["why"] for b in payload["blocks"])


def test_playbook_and_compare_match_the_plan(client, plans):
    summary = read_output("analysis_summary.json")
    playbook = strict(client.get("/api/playbook"))
    for code in SCENARIOS:
        assert playbook["scenarios"][code]["actions"] == summary["playbook"]["scenarios"][code]["actions"]
    compare = strict(client.get("/api/compare"))
    for row in compare["scenarios"]:
        assert row["plan"] == plans[row["code"]]["totals"]["all"]["plan"]


def test_forecast_parts_multiply_up(client):
    saved = read_output("forecast_daily.csv", parse_dates=["day_date"])
    payload = strict(client.get("/api/forecast?store=2&dept=38"))
    assert len(payload["series"]) == 1
    expected = saved[(saved["store_id"] == 2) & (saved["dept_id"] == 38)].sort_values("day_date")["daily_forecast"].tolist()
    days = payload["series"][0]["days"]
    assert [d["forecast"] for d in days] == pytest.approx(expected, rel=1e-6)
    for day in days:
        assert day["normal_day"] * day["holiday_factor"] == pytest.approx(day["model_forecast"], rel=1e-5)
        assert day["model_forecast"] * (1 + day["valentine_uplift"]) == pytest.approx(day["forecast"], rel=1e-5)
        assert day["scenarios"]["BASE"]["demand"] == pytest.approx(day["forecast"], rel=1e-5)


def test_demand_what_if_changes_blocks_and_says_so(client, plans):
    # Time it after the startup warm-up of the demo what-ifs, which would otherwise share the CPU with this run.
    assert client.app.state.engine.warmed.wait(120)
    began = time.perf_counter()
    response = client.get("/api/what-if?scenario=BASE&demand=0.07&callouts=1.25")
    seconds = time.perf_counter() - began
    assert response.status_code == 200 and response.headers["x-cache"] == "miss"
    assert seconds < 8
    result = strict(response)
    assert result["what_if"] is True and result["is_submitted_plan"] is False
    assert "not the submitted plan" in result["label"]
    assert result["changes"], "A 7% rise in demand should change at least one block"
    submitted = {block["key"]: block["plan"] for block in plans["BASE"]["blocks"]}
    for change in result["changes"]:
        assert change["submitted"] == submitted[change["key"]] != change["what_if"]
    assert result["totals"]["all"]["plan"]["cost"] > plans["BASE"]["totals"]["all"]["plan"]["cost"]
    again = client.get("/api/what-if?scenario=BASE&demand=0.07&callouts=1.25")
    assert again.headers["x-cache"] == "hit" and again.content == response.content


def test_default_what_if_is_the_submitted_plan(client, plans):
    result = strict(client.get("/api/what-if?scenario=PEAK&goal=0.95&callouts=1&demand=0"))
    assert result["is_submitted_plan"] is True and result["changes"] == []
    assert result["blocks"] == plans["PEAK"]["blocks"]


def test_availability_what_if_cuts_staff(client):
    result = strict(client.get("/api/what-if?scenario=BASE&availability=-0.2"))
    assert result["changes_summary"]["people_cut"] > 0
    assert result["vs_submitted"]["all"]["change"]["expected_met"] < 0


@pytest.mark.parametrize(
    "query",
    [
        "/api/what-if?goal=0.93", "/api/what-if?goal=abc", "/api/what-if?callouts=2.5", "/api/what-if?callouts=-0.1",
        "/api/what-if?demand=0.2", "/api/what-if?demand=-0.11", "/api/what-if?demand=nan", "/api/what-if?callouts=inf",
        "/api/what-if?availability=-0.5", "/api/what-if?availability=0.1", "/api/what-if?scenario=FOO",
        "/api/plan?scenario=FOO", "/api/forecast?store=3", "/api/forecast?dept=10",
    ],
)
def test_bad_settings_return_422(client, query):
    response = client.get(query)
    assert response.status_code == 422
    assert strict(response)["error"]


@pytest.mark.parametrize("path", JSON_ENDPOINTS)
def test_every_response_is_strict_json(client, path):
    response = client.get(path)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    payload = strict(response)

    def walk(value):
        if isinstance(value, float):
            assert math.isfinite(value)
        elif isinstance(value, dict):
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(payload)


def test_submission_csv_passes_the_validator(client):
    response = client.get("/api/submission.csv")
    assert response.status_code == 200 and "attachment" in response.headers["content-disposition"]
    filled = pd.read_csv(io.StringIO(response.text), parse_dates=["day_date"])
    assert validate(filled) == []
    assert all("placeholder" in problem for problem in validate(filled, final=True))


def test_unknown_api_path_is_a_json_404(client):
    response = client.get("/api/nothing-here")
    assert response.status_code == 404 and strict(response)["error"]


def test_data_endpoints_wait_until_ready():
    app = create_app(engine=Engine(), autostart=False)
    client = TestClient(app)
    health = strict(client.get("/api/health"))
    assert (health["ready"], health["seconds"], health["error"]) == (False, None, None)
    for path in ("/api/plan", "/api/what-if", "/api/compare", "/api/meta"):
        response = client.get(path)
        assert response.status_code == 503 and strict(response)["error"]


def test_front_end_is_served_or_explained(tmp_path):
    missing = TestClient(create_app(engine=Engine(), dist=tmp_path / "missing", autostart=False))
    page = missing.get("/")
    assert page.status_code == 200 and "npm run build" in page.text and "simulated" in page.text

    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>Built</title>", encoding="utf-8")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)", encoding="utf-8")
    built = TestClient(create_app(engine=Engine(), dist=tmp_path, autostart=False))
    assert "Built" in built.get("/").text
    script = built.get("/assets/app.js")
    assert script.status_code == 200 and "javascript" in script.headers["content-type"]
    assert built.get("/assets/missing.js").status_code == 404
    assert "create_app" not in built.get("/..%2F..%2Fserver%2Fapi.py").text  # No way out of web/dist.


def test_demo_what_if_is_warmed_at_startup(client):
    """Demo step 3:10 (demand +10%, callouts 150%) answers from the cache, so it's instant in front of judges."""
    assert client.app.state.engine.warmed.wait(120)
    for scenario in ("BASE", "PEAK", "DISRUPT"):
        response = client.get(f"/api/what-if?scenario={scenario}&demand=0.1&callouts=1.5")
        assert response.status_code == 200 and response.headers["x-cache"] == "hit", scenario
