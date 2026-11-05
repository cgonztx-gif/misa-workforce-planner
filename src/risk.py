"""Service risk for one block at a given headcount (D-07, T-40).

Three things can push a block over the cliff: demand above forecast, callouts that aren't backfilled,
and the scatter around the service curve. chance_met() integrates all three exactly enough to be
repeatable, which the staffing search needs. monte_carlo_chance() simulates the same model, so each
method checks the other (tests/test_risk.py).
"""
from __future__ import annotations

from functools import lru_cache

import numpy as np
from scipy.stats import binom, norm

from src.service import Curve

BACKFILL_SHARE = 0.49  # F-04: 49.2% of callouts were backfilled with overtime when room allowed.
# A fine, even grid over demand error. The service curve is steep near the cliff, so a coarser
# rule such as 21-point Gauss-Hermite was off by 0.7 points against simulation.
_NODES = np.linspace(-4.5, 4.5, 181)
_WEIGHTS = norm.pdf(_NODES) / norm.pdf(_NODES).sum()


@lru_cache(maxsize=200_000)
def net_loss_distribution(employees: int, callout_rate: float, overtime_room: int, backfill: float = BACKFILL_SHARE):
    """Distribution of staff lost after backfill. Backfills can't exceed the overtime still free in the block."""
    most_callouts = int(binom.isf(1e-6, employees, callout_rate)) + 1 if employees else 0
    most_callouts = min(most_callouts, employees)
    pmf = np.zeros(most_callouts + 1)
    callout_pmf = binom.pmf(np.arange(most_callouts + 1), employees, callout_rate)
    for callouts in range(most_callouts + 1):
        backfills = np.arange(callouts + 1)
        backfill_pmf = binom.pmf(backfills, callouts, backfill)
        lost = callouts - np.minimum(backfills, overtime_room)
        np.add.at(pmf, lost, callout_pmf[callouts] * backfill_pmf)
    return pmf / pmf.sum()


def chance_met(
    curve: Curve,
    store: int,
    demand: float,
    demand_sd: float,
    employees: int,
    paid_hours: float,
    standard: float,
    callout_rate: float,
    overtime_room: int,
) -> float:
    """Chance this block meets its service target at this headcount."""
    if employees <= 0:
        return 0.0
    pmf = net_loss_distribution(int(employees), float(callout_rate), int(max(overtime_room, 0)))
    lost = np.arange(len(pmf))
    worked = np.maximum(employees - lost, 0)
    usable = worked > 0
    realized_demand = demand * np.exp(demand_sd * _NODES)
    utilization = np.outer(realized_demand * standard, 1.0 / (worked[usable] * paid_hours))
    by_outcome = (_WEIGHTS @ curve.p_met(store, utilization))
    return float(pmf[usable] @ by_outcome)


def cushion(curve: Curve, store: int, workload_hours: float, employees: int, paid_hours: float) -> tuple[int, float]:
    """People a block can lose, or the rise in demand it can take, before missing target becomes the likelier outcome."""
    trouble_line = curve.utilization_for(store, 0.5)
    people = int(np.floor(employees - workload_hours / (trouble_line * paid_hours) + 1e-9))
    demand = trouble_line * employees * paid_hours / workload_hours - 1
    return max(people, 0), max(float(demand), 0.0)


def monte_carlo_chance(
    curve: Curve,
    store: int,
    demand: float,
    demand_sd: float,
    employees: int,
    paid_hours: float,
    standard: float,
    callout_rate: float,
    overtime_room: int,
    draws: int = 200_000,
    seed: int = 7,
) -> float:
    """The same model simulated directly, drawing the curve's scatter too. Used to verify chance_met()."""
    rng = np.random.default_rng(seed)
    realized_demand = demand * np.exp(demand_sd * rng.standard_normal(draws))
    callouts = rng.binomial(employees, callout_rate, draws)
    backfills = np.minimum(rng.binomial(callouts, BACKFILL_SHARE), max(overtime_room, 0))
    worked = employees - callouts + backfills
    usable = worked > 0
    utilization = np.full(draws, np.inf)
    utilization[usable] = realized_demand[usable] * standard / (worked[usable] * paid_hours)
    log_ratio = curve.log_ratio(store, utilization) + curve.scatter * rng.standard_normal(draws)
    return float(np.mean(log_ratio <= 0))
