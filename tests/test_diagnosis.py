"""The diagnosis (T-11 to T-13), checked against the Nov 2 dashboard's saved figures (F-40)."""
import csv
from pathlib import Path

import pytest

from src.diagnosis import callout_rates, gap_value, is_flu_block, kpis, staffing_gaps
from src.data import open_history

SAVED = Path(__file__).resolve().parents[1] / "planning" / "evidence" / "dashboard_2026-11-02" / "kpi.csv"
# Each difference is explained in planning/evidence/reconcile_dashboard.py and F-40 to F-42.
KNOWN_DIFFERENCES = {"shift_noise", "sched_corr_fr", "sched_corr_me", "sched_corr_ph", "draft_cost_disrupt"}


@pytest.fixture(scope="module")
def rebuilt():
    return kpis()


def test_rebuilt_figures_match_the_dashboard(rebuilt):
    with open(SAVED, encoding="utf-8") as handle:
        saved = {row["id"]: float(row["value"]) for row in csv.DictReader(handle)}
    compared = [key for key in saved if key in rebuilt and key not in KNOWN_DIFFERENCES]
    assert len(compared) >= 75
    for key in compared:
        assert rebuilt[key] == pytest.approx(saved[key], abs=0.0015 * max(abs(saved[key]), 1.0)), key


def test_draft_shortfall_in_disrupt_is_higher_under_the_allocation_rule(rebuilt):
    assert rebuilt["disrupt_blocks"] == 12
    assert rebuilt["disrupt_shortfall"] == 29  # raw capacity, as the dashboard reports it
    assert rebuilt["disrupt_blocks_usable_flex"] == 12
    assert rebuilt["disrupt_shortfall_usable_flex"] == 36  # flex limited to what the partner can spare


def test_gap_hours_reconcile_with_total_hours():
    table = gap_value()
    net = table["worked_hours"].sum() - table["required_hours"].sum()
    assert net == pytest.approx(table["over_hours"].sum() - table["short_hours"].sum())


def test_staffing_gaps_cover_every_open_block():
    assert staffing_gaps()["blocks"].sum() == 1053


def test_flu_cluster_is_only_warehouse_2_front_end_and_pharmacy():
    blocks = open_history()
    flu = blocks[is_flu_block(blocks)]
    assert set(flu["store_id"]) == {2}
    assert set(flu["dept_id"]) == {38, 95}
    assert flu["availability_note"].str.contains("Flu").all()


def test_callout_rows_add_up_to_all_callouts_without_double_counting():
    table = callout_rates()
    blocks = open_history()
    assert table["callouts"].sum() == blocks["callout_employees"].sum()
    assert table["scheduled"].sum() == blocks["scheduled_employees"].sum()
