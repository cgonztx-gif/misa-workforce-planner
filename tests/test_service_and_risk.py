"""Service curves and the risk model (T-31, T-40, D-07)."""
import numpy as np
import pytest

from src.risk import chance_met, monte_carlo_chance, net_loss_distribution
from src.service import fit_all, limits_table


@pytest.fixture(scope="module")
def curves():
    return fit_all()


def test_chance_falls_as_utilization_rises(curves):
    grid = np.linspace(0.6, 1.1, 51)
    for dept, curve in curves.items():
        for store in (1, 2, 4):
            chances = curve.p_met(store, grid)
            assert (np.diff(chances) <= 1e-12).all(), (dept, store)


def test_curves_sit_at_the_cliff_seen_in_the_data(curves):
    limits = limits_table(curves)
    assert limits["u95"].between(0.80, 0.90).all()
    assert (limits["u50"] > limits["u95"]).all()
    assert limits["u50"].between(0.85, 0.92).all()


def test_net_loss_distribution_sums_to_one_and_respects_overtime_room():
    no_room = net_loss_distribution(20, 0.06, 0)
    room = net_loss_distribution(20, 0.06, 5)
    assert no_room.sum() == pytest.approx(1)
    assert room.sum() == pytest.approx(1)
    mean = lambda pmf: float(np.arange(len(pmf)) @ pmf)
    assert mean(no_room) == pytest.approx(20 * 0.06, abs=0.01)  # no backfill possible
    assert mean(room) == pytest.approx(20 * 0.06 * 0.51, abs=0.01)  # about half are backfilled


@pytest.mark.parametrize(
    "dept, store, demand, employees, paid, standard, callout, room",
    [
        (38, 2, 60.0, 26, 4.0, 1.5, 0.05, 5),
        (92, 1, 70.0, 21, 5.0, 1.2, 0.04, 3),
        (95, 4, 70.0, 4, 3.5, 0.165, 0.06, 1),
        (38, 4, 90.0, 40, 3.5, 1.5, 0.12, 0),
    ],
)
def test_the_exact_calculation_agrees_with_simulation(curves, dept, store, demand, employees, paid, standard, callout, room):
    args = (curves[dept], store, demand, 0.055, employees, paid, standard, callout, room)
    assert chance_met(*args) == pytest.approx(monte_carlo_chance(*args), abs=0.005)


def test_more_staff_never_hurts_much(curves):
    chances = [chance_met(curves[38], 2, 60.0, 0.055, n, 4.0, 1.5, 0.05, 5) for n in range(18, 40)]
    assert (np.diff(chances) > -1e-3).all()
    assert chances[-1] > 0.99
