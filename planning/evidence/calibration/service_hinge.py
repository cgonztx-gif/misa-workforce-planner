# Frozen copy of src/service.py before D-29 (the sharp-knot "hinge" curve), so planning/evidence/calibration_study.py
# keeps reproducing its recorded output after src/service.py moved to the smooth bend. Not imported by src/.
"""Service curves (T-31, D-07, A-09): how the service metric responds to utilization.

Fitted on the log of metric / target, so a value of 0 is exactly on target. That uses every block's
measured wait rather than only whether it passed, which matters because few blocks sit near the cliff.
Per department the curve rises gently, steepens at a knot, then flattens at a cap, and each warehouse
gets its own level:

    log(metric / target) = min(cap, level[warehouse] + slope * u + extra_slope * max(0, u - knot))

The chance of meeting target at utilization u is the chance that scatter around the curve lands below 0.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import brentq, curve_fit
from scipy.stats import norm

from src.data import open_history

STORES = (1, 2, 4)
DEPARTMENTS = (38, 92, 95)
# Only the rising part of the curve decides staffing, so scatter is measured there.
SCATTER_RANGE = (0.70, 0.97)


def _curve(x, level1, level2, level4, slope, extra_slope, knot, cap):
    u, store_index = x
    levels = np.array([level1, level2, level4])[store_index.astype(int)]
    return np.minimum(cap, levels + slope * u + extra_slope * np.maximum(0.0, u - knot))


@dataclass(frozen=True)
class Curve:
    levels: dict[int, float]
    slope: float
    extra_slope: float
    knot: float
    cap: float
    scatter: float

    def log_ratio(self, store: int, u):
        u = np.asarray(u, dtype=float)
        return np.minimum(self.cap, self.levels[store] + self.slope * u + self.extra_slope * np.maximum(0.0, u - self.knot))

    def p_met(self, store: int, u):
        """Chance a block at utilization u meets its target."""
        return norm.cdf(-self.log_ratio(store, u) / self.scatter)

    def utilization_for(self, store: int, chance: float) -> float:
        """Utilization at which the chance of meeting target equals `chance`."""
        return float(brentq(lambda u: float(self.p_met(store, u)) - chance, 0.3, 1.2))


def fit_curve(blocks: pd.DataFrame) -> Curve:
    """Fit one department's curve. Tries several knots because the kink makes the fit sensitive to its start."""
    u = blocks["utilization"].to_numpy()
    y = np.log(blocks["service_ratio"].to_numpy())
    store_index = blocks["store_id"].map({s: i for i, s in enumerate(STORES)}).to_numpy()
    best, best_sse = None, np.inf
    for start_knot in (0.82, 0.85, 0.88, 0.90):
        try:
            params, _ = curve_fit(
                _curve,
                (u, store_index),
                y,
                p0=[-4.0, -4.0, -4.0, 4.0, 10.0, start_knot, 1.45],
                bounds=([-12, -12, -12, 0, 0, 0.70, 0.8], [2, 2, 2, 12, 40, 0.97, 2.5]),
                maxfev=20000,
            )
        except RuntimeError:
            continue
        sse = float(((y - _curve((u, store_index), *params)) ** 2).sum())
        if sse < best_sse:
            best, best_sse = params, sse
    if best is None:
        raise RuntimeError("The service curve did not converge")
    level1, level2, level4, slope, extra_slope, knot, cap = best
    residuals = y - _curve((u, store_index), *best)
    in_range = (u >= SCATTER_RANGE[0]) & (u <= SCATTER_RANGE[1])
    return Curve({1: level1, 2: level2, 4: level4}, slope, extra_slope, knot, cap, float(residuals[in_range].std()))


def fit_all(blocks: pd.DataFrame | None = None) -> dict[int, Curve]:
    blocks = open_history() if blocks is None else blocks
    return {dept: fit_curve(blocks[blocks["dept_id"] == dept]) for dept in DEPARTMENTS}


def limits_table(curves: dict[int, Curve]) -> pd.DataFrame:
    """Utilization at which each department and warehouse has a 95%, 90% and 50% chance of meeting target."""
    rows = []
    for dept, curve in curves.items():
        for store in STORES:
            rows.append(
                {
                    "dept_id": dept,
                    "store_id": store,
                    "u95": curve.utilization_for(store, 0.95),
                    "u90": curve.utilization_for(store, 0.90),
                    "u50": curve.utilization_for(store, 0.50),
                }
            )
    return pd.DataFrame(rows)


def holdout_scores(blocks: pd.DataFrame | None = None) -> pd.DataFrame:
    """Leave one week out and score predicted chances against what happened, using the Brier score (lower is better).

    Also returns the out-of-sample predictions in five-point bands, to check they match observed rates.
    """
    blocks = open_history() if blocks is None else blocks
    predictions = []
    for week in sorted(blocks["week"].unique()):
        train, test = blocks[blocks["week"] != week], blocks[blocks["week"] == week]
        curves = fit_all(train)
        chance = np.empty(len(test))
        for i, (dept, store, u) in enumerate(zip(test["dept_id"], test["store_id"], test["utilization"])):
            chance[i] = curves[dept].p_met(store, u)
        predictions.append(test.assign(p_met=chance, base_rate=train["met_target"].mean()))
    return pd.concat(predictions, ignore_index=True)


def calibration(predictions: pd.DataFrame) -> pd.DataFrame:
    """Predicted and observed rates, grouped by predicted chance."""
    bins = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 0.95, 0.99, 1.0001]
    labels = ["0-10%", "10-30%", "30-50%", "50-70%", "70-90%", "90-95%", "95-99%", "99-100%"]
    frame = predictions.assign(bin=pd.cut(predictions["p_met"], bins=bins, labels=labels, right=False))
    return (
        frame.groupby("bin", observed=True)
        .agg(blocks=("met_target", "size"), predicted=("p_met", "mean"), observed=("met_target", "mean"))
        .reset_index()
    )
