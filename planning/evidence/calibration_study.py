"""Calibration study for the service model (T-75: checks V-04 and V-11).

V-04. Is the chance of meeting target well calibrated out of sample, and do scatter fixes help?
Scored on the same leave-one-week-out folds as src.service.holdout_scores() (6 folds, weeks 1-6).

  baseline  the current model (src.service.fit_all)
  a_bin     (a) each department's scatter times a factor k, fitted by maximum likelihood on met_target
  a_rms     (a) the same factor, set to the RMS of standardized residuals in the scatter range
  b_norm    (b) log(scatter) linear in utilization, fitted by normal likelihood on residuals in the range
  b_bin     (b) the same form, fitted by maximum likelihood on met_target
  c_smooth  (c) diagnostic beyond the brief: a smooth knot instead of the hinge, scatter as now

The (a) and (b) fixes are fitted only inside each training fold, on nested leave-one-week-out
predictions within that fold (4-week fits predicting the 5th week). In-sample residuals can't be used,
because they understate out-of-sample error by construction.

V-11. Model-free check: for each planned open block, the historical rate of meeting target among
history blocks of the same department within +/-0.02 of the block's expected worked utilization.

Run from the project root (about three minutes):
    python -W ignore planning/evidence/calibration_study.py > planning/evidence/calibration_study.output.txt
Reads the data pack CSVs and outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv. Writes nothing.
"""
from __future__ import annotations

import sys
import time
from dataclasses import dataclass, fields, replace
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import curve_fit, minimize, minimize_scalar
from scipy.stats import norm

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

# The study compares fixes against the model as it was before D-29 (the sharp knot). src/service.py now fits
# the smooth bend, so install the frozen pre-D-29 copy as src.service before anything else imports it.
import importlib.util  # noqa: E402

import src  # noqa: E402,F401

_spec = importlib.util.spec_from_file_location("src.service", Path(__file__).parent / "calibration" / "service_hinge.py")
sys.modules["src.service"] = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sys.modules["src.service"])

from src.data import PLAN_KEY, open_history  # noqa: E402
from src.risk import net_loss_distribution  # noqa: E402
from src.search import SERVICE_GOAL, build_plan, evaluate, planning_inputs, summarize  # noqa: E402
from src.service import DEPARTMENTS, SCATTER_RANGE, STORES, Curve, calibration, fit_all, holdout_scores  # noqa: E402

pd.set_option("display.width", 200)
pd.set_option("display.max_columns", 30)
DEPT = {38: "Front End", 92: "Merchandising", 95: "Pharmacy"}
PIVOT = 0.85  # centre of the utilization term in fix (b)
DECISION_ZONE = (0.80, 0.95)  # realized utilization where staffing decisions are made
NEAR_GOAL = (0.70, 0.99)  # predicted chance range the brief flags
EPS = 1e-6  # log-loss clip
BOOT = 2000
WINDOW = 0.02  # V-11 neighbourhood
MIN_NEIGHBOURS = 5
FALLBACK_NEAREST = 10
T0 = time.time()


sys.stdout.reconfigure(line_buffering=True)  # so a long run shows its progress in the output file


def section(title: str) -> None:
    print("\n" + "=" * 100 + f"\n{title}   [{time.time() - T0:.0f}s]\n" + "=" * 100)


# ----------------------------------------------------------------------------------------------------
# Curve variants. Each is a Curve subclass, so src.risk.chance_met and src.search use it unchanged.
# ----------------------------------------------------------------------------------------------------
@dataclass(frozen=True)
class VarScatterCurve(Curve):
    """Fix (b): scatter * exp(c0 + c1 * (u - PIVOT)), with u held inside the scatter range so it can't run away."""

    c0: float = 0.0
    c1: float = 0.0

    def sigma(self, u):
        u = np.clip(np.asarray(u, dtype=float), *SCATTER_RANGE)
        return self.scatter * np.exp(self.c0 + self.c1 * (u - PIVOT))

    def p_met(self, store: int, u):
        return norm.cdf(-self.log_ratio(store, u) / self.sigma(u))


@dataclass(frozen=True)
class SmoothCurve(Curve):
    """Diagnostic (c): the hinge max(0, u - knot) replaced by a softplus of the given width."""

    width: float = 0.02

    def log_ratio(self, store: int, u):
        u = np.asarray(u, dtype=float)
        bend = self.width * np.logaddexp(0.0, (u - self.knot) / self.width)
        return np.minimum(self.cap, self.levels[store] + self.slope * u + self.extra_slope * bend)


def _smooth(x, level1, level2, level4, slope, extra_slope, knot, cap, width):
    u, store_index = x
    levels = np.array([level1, level2, level4])[store_index.astype(int)]
    return np.minimum(cap, levels + slope * u + extra_slope * width * np.logaddexp(0.0, (u - knot) / width))


def fit_smooth(blocks: pd.DataFrame) -> SmoothCurve:
    u = blocks["utilization"].to_numpy()
    y = np.log(blocks["service_ratio"].to_numpy())
    store_index = blocks["store_id"].map({s: i for i, s in enumerate(STORES)}).to_numpy()
    best, best_sse = None, np.inf
    for start_knot in (0.82, 0.85, 0.88, 0.90):
        for start_width in (0.01, 0.03):
            try:
                params, _ = curve_fit(
                    _smooth, (u, store_index), y,
                    p0=[-4.0, -4.0, -4.0, 4.0, 10.0, start_knot, 1.45, start_width],
                    bounds=([-12, -12, -12, 0, 0, 0.70, 0.8, 0.003], [2, 2, 2, 12, 40, 0.97, 2.5, 0.15]),
                    maxfev=20000,
                )
            except RuntimeError:
                continue
            sse = float(((y - _smooth((u, store_index), *params)) ** 2).sum())
            if sse < best_sse:
                best, best_sse = params, sse
    l1, l2, l4, slope, extra, knot, cap, width = best
    resid = y - _smooth((u, store_index), *best)
    in_range = (u >= SCATTER_RANGE[0]) & (u <= SCATTER_RANGE[1])
    return SmoothCurve({1: l1, 2: l2, 4: l4}, slope, extra, knot, cap, float(resid[in_range].std()), width)


def base_fields(curve: Curve) -> dict:
    return {f.name: getattr(curve, f.name) for f in fields(Curve)}


# ----------------------------------------------------------------------------------------------------
# Fitting the fixes inside a training set.
# ----------------------------------------------------------------------------------------------------
def predict(curves: dict, frame: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Mean log ratio, base scatter and chance of meeting target for each row."""
    mu, s, p = (np.empty(len(frame)) for _ in range(3))
    dept, store, u = frame["dept_id"].to_numpy(), frame["store_id"].to_numpy(), frame["utilization"].to_numpy()
    for d in DEPARTMENTS:
        for st in STORES:
            m = (dept == d) & (store == st)
            if m.any():
                mu[m] = curves[d].log_ratio(st, u[m])
                s[m] = curves[d].scatter
                p[m] = curves[d].p_met(st, u[m])
    return mu, s, p


def inner_oos(train: pd.DataFrame) -> pd.DataFrame:
    """Leave-one-week-out predictions inside a training set, with the standardized residual z."""
    parts = []
    for week in sorted(train["week"].unique()):
        fit_on, held = train[train["week"] != week], train[train["week"] == week]
        mu, s, _ = predict(fit_all(fit_on), held)
        parts.append(held.assign(mu=mu, s=s))
    out = pd.concat(parts)
    out["z"] = (np.log(out["service_ratio"]) - out["mu"]) / out["s"]
    out["in_range"] = out["utilization"].between(*SCATTER_RANGE)
    return out


def bernoulli_nll(p: np.ndarray, y: np.ndarray) -> float:
    p = np.clip(p, 1e-12, 1 - 1e-12)
    return float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).sum())


def fit_fix(train: pd.DataFrame, method: str, inner: pd.DataFrame | None = None) -> tuple[dict, dict]:
    """Curves for one method fitted on `train`, and the fitted fix parameters per department."""
    if method == "baseline":
        return fit_all(train), {}
    if method == "c_smooth":
        curves = {d: fit_smooth(train[train["dept_id"] == d]) for d in DEPARTMENTS}
        return curves, {d: {"width": c.width, "knot": c.knot} for d, c in curves.items()}
    base = fit_all(train)
    inner = inner_oos(train) if inner is None else inner
    curves, params = {}, {}
    for d in DEPARTMENTS:
        part = inner[inner["dept_id"] == d]
        rng = part[part["in_range"]]
        mu, s, y, u = part["mu"].to_numpy(), part["s"].to_numpy(), part["met_target"].to_numpy(), part["utilization"].to_numpy()
        if method == "a_bin":
            res = minimize_scalar(lambda lk: bernoulli_nll(norm.cdf(-mu / (np.exp(lk) * s)), y), bounds=(-1.0, 1.5), method="bounded")
            k = float(np.exp(res.x))
            curves[d], params[d] = replace(base[d], scatter=base[d].scatter * k), {"k": k}
        elif method == "a_rms":
            k = float(np.sqrt((rng["z"] ** 2).mean()))
            curves[d], params[d] = replace(base[d], scatter=base[d].scatter * k), {"k": k}
        elif method == "b_norm":
            z, ur = rng["z"].to_numpy(), rng["utilization"].to_numpy() - PIVOT

            def nll(c):
                log_sigma = c[0] + c[1] * ur
                return float((log_sigma + 0.5 * z**2 * np.exp(-2 * log_sigma)).sum())

            c0, c1 = minimize(nll, [0.0, 0.0], method="BFGS").x
            curves[d], params[d] = VarScatterCurve(**base_fields(base[d]), c0=float(c0), c1=float(c1)), {"c0": float(c0), "c1": float(c1)}
        elif method == "b_bin":
            uc = np.clip(u, *SCATTER_RANGE) - PIVOT

            def nll(c):
                return bernoulli_nll(norm.cdf(-mu / (s * np.exp(c[0] + c[1] * uc))), y)

            c0, c1 = minimize(nll, [0.0, 0.0], method="Nelder-Mead", options={"xatol": 1e-4, "fatol": 1e-6}).x
            curves[d], params[d] = VarScatterCurve(**base_fields(base[d]), c0=float(c0), c1=float(c1)), {"c0": float(c0), "c1": float(c1)}
        else:
            raise ValueError(method)
    return curves, params


METHODS = ("baseline", "a_bin", "a_rms", "b_norm", "b_bin", "c_smooth")
LABELS = {
    "baseline": "current model",
    "a_bin": "(a) scale scatter, fit on met_target",
    "a_rms": "(a) scale scatter, fit on residual RMS",
    "b_norm": "(b) scatter linear in u (log), fit on residuals",
    "b_bin": "(b) scatter linear in u (log), fit on met_target",
    "c_smooth": "(c) smooth knot, diagnostic",
}

# ----------------------------------------------------------------------------------------------------
# Scoring.
# ----------------------------------------------------------------------------------------------------
def row_losses(p: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    pc = np.clip(p, EPS, 1 - EPS)
    return (p - y) ** 2, -(y * np.log(pc) + (1 - y) * np.log(1 - pc))


def wilson(k: float, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return np.nan, np.nan
    phat = k / n
    centre = (phat + z * z / (2 * n)) / (1 + z * z / n)
    half = z * np.sqrt(phat * (1 - phat) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return centre - half, centre + half


CAL_BINS = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 0.95, 0.99, 1.0001]  # the same bins as src.service.calibration
CAL_LABELS = ["0-10%", "10-30%", "30-50%", "50-70%", "70-90%", "90-95%", "95-99%", "99-100%"]


def calibration_table(frame: pd.DataFrame, column: str) -> pd.DataFrame:
    """src.service.calibration's table, plus counts, a Wilson 95% interval on the observed rate, and z."""
    p, met = frame[column], frame["met_target"]
    bins = pd.cut(p, bins=CAL_BINS, labels=CAL_LABELS, right=False)
    rows = []
    for label in CAL_LABELS:
        m = bins == label
        if not m.any():
            continue
        n, k, expected, var = int(m.sum()), int(met[m].sum()), float(p[m].sum()), float((p[m] * (1 - p[m])).sum())
        lo, hi = wilson(k, n)
        rows.append({"bin": label, "blocks": n, "predicted": p[m].mean(), "observed": k / n, "obs_lo95": lo, "obs_hi95": hi,
                     "expected_met": expected, "met": k, "z": (k - expected) / np.sqrt(var) if var > 1e-9 else np.nan})
    return pd.DataFrame(rows)


def near_goal_gap(frame: pd.DataFrame, column: str, lo=NEAR_GOAL[0], hi=NEAR_GOAL[1]) -> dict:
    g = frame[(frame[column] >= lo) & (frame[column] < hi)]
    expected, met = g[column].sum(), g["met_target"].sum()
    sd = np.sqrt((g[column] * (1 - g[column])).sum())
    return {"blocks": len(g), "predicted": g[column].mean(), "observed": g["met_target"].mean(),
            "expected_met": expected, "met": met, "z": (met - expected) / sd if sd > 0 else np.nan}


def cluster_bootstrap(diff: np.ndarray, clusters: np.ndarray, mask: np.ndarray | None = None, seed: int = 20261105) -> tuple[float, float, float, float]:
    """Mean of `diff` and its 95% interval, resampling days with replacement. Also P(mean < 0)."""
    mask = np.ones(len(diff), bool) if mask is None else mask
    codes, uniq = pd.factorize(clusters[mask])
    sums = np.bincount(codes, weights=diff[mask])
    counts = np.bincount(codes).astype(float)
    rng = np.random.default_rng(seed)
    draws = rng.integers(0, len(uniq), size=(BOOT, len(uniq)))
    means = sums[draws].sum(1) / counts[draws].sum(1)
    return float(diff[mask].mean()), float(np.quantile(means, 0.025)), float(np.quantile(means, 0.975)), float((means < 0).mean())


# ====================================================================================================
blocks = open_history()
weeks = sorted(blocks["week"].unique())

section("V-04 STEP 1. Reproduce the pipeline's out-of-sample calibration (src.service.holdout_scores)")
reference = holdout_scores(blocks)
print(f"Folds: leave one week out, weeks {weeks}, {len(reference)} open history blocks scored once each.")
print(f"Brier, model {((reference['p_met'] - reference['met_target']) ** 2).mean():.5f} "
      f"(analysis_summary.json service_brier.model 0.02611); base rate "
      f"{((reference['base_rate'] - reference['met_target']) ** 2).mean():.5f} (0.17730)")
print(calibration(reference).round(3).to_string(index=False))

# Out-of-sample predictions for every method, on the same folds.
oos = blocks[["store_id", "dept_id", "day_date", "week", "utilization", "service_ratio", "met_target"]].copy()
fold_params = {m: {} for m in METHODS}
for week in weeks:
    train, test = blocks[blocks["week"] != week], blocks[blocks["week"] == week]
    inner = inner_oos(train)
    for method in METHODS:
        curves, params = fit_fix(train, method, inner)
        oos.loc[test.index, method] = predict(curves, test)[2]
        fold_params[method][week] = params
# Our baseline must equal the pipeline's predictions, matched on keys.
check = oos.assign(shift_code=blocks["shift_code"]).merge(
    reference[["store_id", "dept_id", "day_date", "shift_code", "p_met"]],
    on=["store_id", "dept_id", "day_date", "shift_code"], validate="one_to_one")
assert len(check) == len(blocks) and np.abs(check["baseline"] - check["p_met"]).max() < 1e-12
print(f"\nOur baseline matches holdout_scores() on keys: max |difference| = {np.abs(check['baseline'] - check['p_met']).max():.2e} "
      f"over {len(check)} blocks")

section("V-04 STEP 2. Fitted fix parameters, per training fold (fold = held-out week)")
for method in ("a_bin", "a_rms", "b_norm", "b_bin", "c_smooth"):
    rows = []
    for week, params in fold_params[method].items():
        for d, pr in params.items():
            rows.append({"held_out_week": week, "dept": DEPT[d], **pr})
    table = pd.DataFrame(rows).pivot(index="held_out_week", columns="dept")
    print(f"\n{method}: {LABELS[method]}")
    print(table.round(3).to_string())
print("\nk > 1 widens the scatter. In (b), scatter at u is base * exp(c0 + c1*(u-0.85)), u held in [0.70, 0.97];"
      "\nso c1 > 0 means wider scatter at higher utilization (exp(0.12*c1) is the ratio from 0.85 to 0.97).")

section("V-04 STEP 3. Out-of-sample scores, all 1,053 blocks (lower is better)")
y = oos["met_target"].to_numpy()
u = oos["utilization"].to_numpy()
zone = (u >= DECISION_ZONE[0]) & (u < DECISION_ZONE[1])
days = oos["day_date"].to_numpy()
losses = {m: row_losses(oos[m].to_numpy(), y) for m in METHODS}
rows = []
for m in METHODS:
    brier, ll = losses[m]
    gap = near_goal_gap(oos, m)
    rows.append({
        "method": m, "brier": brier.mean(), "log_loss": ll.mean(),
        "brier_zone": brier[zone].mean(), "log_loss_zone": ll[zone].mean(),
        "near_goal_n": gap["blocks"], "near_goal_pred": gap["predicted"], "near_goal_obs": gap["observed"], "near_goal_z": gap["z"],
    })
scores = pd.DataFrame(rows)
print(f"'zone' = the {zone.sum()} blocks with realized utilization in [{DECISION_ZONE[0]}, {DECISION_ZONE[1]}), "
      f"where staffing decisions bite. Log loss clips chances at {EPS}.")
print(f"'near_goal' = blocks the method itself predicts at {NEAR_GOAL[0]:.0%}-{NEAR_GOAL[1]:.0%}; z = (met - expected) / sd, "
      "negative = overconfident.")
print(scores.round(5).to_string(index=False))

print("\nPer-fold Brier and log loss difference against the current model (negative = fix better):")
fold_rows = []
for m in METHODS[1:]:
    for week in weeks:
        w = oos["week"].to_numpy() == week
        fold_rows.append({"method": m, "week": week,
                          "d_brier": losses[m][0][w].mean() - losses["baseline"][0][w].mean(),
                          "d_log_loss": losses[m][1][w].mean() - losses["baseline"][1][w].mean()})
folds = pd.DataFrame(fold_rows)
print(folds.pivot(index="week", columns="method", values="d_log_loss").round(5).to_string())
print("folds where log loss improves:", folds.assign(better=folds["d_log_loss"] < 0).groupby("method")["better"].sum().to_dict())

print(f"\nPaired cluster bootstrap of (fix - current), resampling the {len(np.unique(days))} history days, {BOOT} draws.")
print("A real improvement needs the whole 95% interval below 0.")
boot_rows = []
for m in METHODS[1:]:
    for metric, idx in (("brier", 0), ("log_loss", 1)):
        for scope, mask in (("all", None), ("zone", zone)):
            diff = losses[m][idx] - losses["baseline"][idx]
            mean, lo, hi, p_better = cluster_bootstrap(diff, days, mask)
            boot_rows.append({"method": m, "metric": metric, "scope": scope, "diff": mean, "lo95": lo, "hi95": hi, "P(better)": p_better})
print(pd.DataFrame(boot_rows).to_string(index=False, float_format=lambda v: f"{v:.5f}"))

section("V-04 STEP 4. Calibration by the pipeline's bins, each method on its own predictions")
for m in METHODS:
    print(f"\n{m}: {LABELS[m]}")
    print(calibration_table(oos, m).round(3).to_string(index=False))

section("V-04 STEP 5. By department (out of sample)")
dept_rows = []
for d in DEPARTMENTS:
    mask = oos["dept_id"].to_numpy() == d
    sub = oos[mask]
    for m in METHODS:
        gap = near_goal_gap(sub, m)
        dept_rows.append({
            "dept": DEPT[d], "method": m, "blocks": int(mask.sum()), "zone_blocks": int((mask & zone).sum()),
            "brier": losses[m][0][mask].mean(), "log_loss": losses[m][1][mask].mean(),
            "log_loss_zone": losses[m][1][mask & zone].mean(),
            "near_goal_n": gap["blocks"], "pred": gap["predicted"], "obs": gap["observed"], "z": gap["z"],
        })
print(pd.DataFrame(dept_rows).round(4).to_string(index=False))

print("\nBootstrap of log-loss difference by department (fix - current), all blocks of that department:")
rows = []
for d in DEPARTMENTS:
    mask = oos["dept_id"].to_numpy() == d
    for m in ("a_bin", "a_rms", "b_norm", "b_bin", "c_smooth"):
        mean, lo, hi, pb = cluster_bootstrap(losses[m][1] - losses["baseline"][1], days, mask)
        rows.append({"dept": DEPT[d], "method": m, "diff": mean, "lo95": lo, "hi95": hi, "P(better)": pb})
print(pd.DataFrame(rows).to_string(index=False, float_format=lambda v: f"{v:.5f}"))

section("V-04 STEP 6. Where the miss comes from: residual bias of the current curve by utilization")
print("Mean of log(metric/target) minus the curve, fitted on all six weeks (in sample) and out of sample.")
print("Bias (not width) near the knot shows the hinge shape is the problem, which scatter fixes can't move.")
curves_all = fit_all(blocks)
mu_in, s_in, p_in = predict(curves_all, blocks)
diag = blocks[["dept_id", "utilization", "met_target"]].assign(
    resid_in=np.log(blocks["service_ratio"]) - mu_in, p_in=p_in, p_oos=oos["baseline"],
)
oos_mu = np.empty(len(blocks))
for week in weeks:
    w = blocks["week"] == week
    oos_mu[w.to_numpy()] = predict(fit_all(blocks[~w]), blocks[w])[0]
diag["resid_oos"] = np.log(blocks["service_ratio"]) - oos_mu
smooth_mu = np.empty(len(blocks))
for week in weeks:
    w = (blocks["week"] == week).to_numpy()
    smooth_curves = {d: fit_smooth(blocks[~w & (blocks["dept_id"] == d).to_numpy()]) for d in DEPARTMENTS}
    smooth_mu[w] = predict(smooth_curves, blocks[w])[0]
diag["resid_oos_smooth"] = np.log(blocks["service_ratio"]) - smooth_mu
diag["band"] = pd.cut(diag["utilization"], [0.75, 0.80, 0.825, 0.85, 0.875, 0.90, 0.925, 0.95])
table = diag.groupby(["dept_id", "band"], observed=True).agg(
    n=("resid_in", "size"), bias_in=("resid_in", "mean"),
    se=("resid_in", lambda r: r.std() / np.sqrt(len(r))), bias_oos=("resid_oos", "mean"),
    sd_oos=("resid_oos", "std"), bias_oos_smooth=("resid_oos_smooth", "mean"), p_oos=("p_oos", "mean"), met=("met_target", "mean"),
).reset_index()
table["dept"] = table["dept_id"].map(DEPT)
print(table.drop(columns="dept_id").round(3).to_string(index=False))
print("\nScatter used now vs out-of-sample residual SD in the scatter range [0.70, 0.97]:")
for d in DEPARTMENTS:
    r = diag[(diag["dept_id"] == d) & diag["utilization"].between(*SCATTER_RANGE)]
    print(f"  {DEPT[d]:<14} scatter {curves_all[d].scatter:.4f}   OOS residual SD {r['resid_oos'].std():.4f}   "
          f"OOS RMS {np.sqrt((r['resid_oos'] ** 2).mean()):.4f}   ratio {np.sqrt((r['resid_oos'] ** 2).mean()) / curves_all[d].scatter:.3f}")
print("\nSum of squared residuals on all six weeks, hinge vs smooth knot (one extra parameter). The smooth fit pins its")
print("knot at the 0.97 bound; letting it go to 1.30 lowers the sum by under 1% more, so the bound doesn't drive the result.")
for d in DEPARTMENTS:
    g = blocks[blocks["dept_id"] == d]
    yy = np.log(g["service_ratio"].to_numpy())
    hinge = float(((yy - predict({d: curves_all[d]}, g)[0]) ** 2).sum())
    smooth = float(((yy - predict({d: fit_smooth(g)}, g)[0]) ** 2).sum())
    print(f"  {DEPT[d]:<14} hinge {hinge:.3f}   smooth {smooth:.3f}   ({smooth / hinge - 1:+.1%})")

# ====================================================================================================
section("V-04 STEP 7. What each fix would do to the plan (fitted on all six weeks, as the pipeline does)")
inputs = planning_inputs()
# "The submitted plan" here is the one submitted before D-29: rebuilt with the frozen sharp-knot model, because
# outputs/ now holds the smooth-bend plan. The CSV in outputs/ is compared with both plans below.
submitted = pd.read_csv(ROOT / "outputs" / "TEAM_SUBMISSION_TEMPLATE_filled.csv", parse_dates=["day_date"])
csv_now = inputs.merge(submitted[[*PLAN_KEY, "submitted_employees"]], on=PLAN_KEY, how="left", validate="one_to_one")["submitted_employees"]
assert csv_now.notna().all() and len(csv_now) == 567
base_plan = build_plan(inputs, curves_all)
inputs_sub = inputs.assign(submitted_employees=base_plan["recommended"].to_numpy())
print("The pre-D-29 submission: 567 rows, rebuilt with the frozen sharp-knot model; "
      f"outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv equals it: {(csv_now.to_numpy() == base_plan['recommended'].to_numpy()).all()}")

all_inner = inner_oos(blocks)
final_curves = {"baseline": curves_all}
for m in ("a_bin", "a_rms", "b_norm", "b_bin", "c_smooth"):
    final_curves[m], params = fit_fix(blocks, m, all_inner)
    print(f"  {m:<9} fitted on all weeks: " + "; ".join(f"{DEPT[d]} " + ", ".join(f"{k}={v:.3f}" for k, v in pr.items()) for d, pr in params.items()))


def scenario_summary(frame: pd.DataFrame, column: str, curves: dict) -> pd.DataFrame:
    s = summarize(evaluate(frame, column, curves))
    return s[["scenario_code", "hours", "cost", "expected_met", "below_goal", "lowest_chance", "overtime_hours"]].set_index("scenario_code")


grid = {}
for m in METHODS:
    t = time.time()
    plan_m = build_plan(inputs, final_curves[m])
    grid[m] = {
        "plan": plan_m,
        "own_plan_own_model": scenario_summary(plan_m, "recommended", final_curves[m]),
        "submitted_this_model": scenario_summary(inputs_sub, "submitted_employees", final_curves[m]),
        "draft_this_model": scenario_summary(inputs_sub, "draft_scheduled_employees", final_curves[m]),
        "own_plan_current_model": scenario_summary(plan_m, "recommended", curves_all),
    }
    changed = (plan_m["recommended"] != inputs_sub["submitted_employees"]).sum()
    added = (plan_m["recommended"] - inputs_sub["submitted_employees"]).clip(lower=0).sum()
    cut = (inputs_sub["submitted_employees"] - plan_m["recommended"]).clip(lower=0).sum()
    grid[m]["changed"] = (int(changed), int(added), int(cut))
    print(f"  built {m} plan in {time.time() - t:.1f}s: {changed} of 567 rows differ from the submission (+{added} / -{cut} people)")
print("outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv (after D-29) equals the c_smooth plan: "
      f"{(csv_now.to_numpy() == grid['c_smooth']['plan']['recommended'].to_numpy()).all()}")

print("\nEach block: plan rebuilt with the fix, scored by the fix; against the submitted plan scored by the fix.")
print("expected_met = mean chance of meeting target over open blocks; below_goal = blocks under 95%.")
for m in METHODS[1:]:
    own, subm = grid[m]["own_plan_own_model"], grid[m]["submitted_this_model"]
    out = pd.DataFrame({
        "sub_hours": subm["hours"], "new_hours": own["hours"], "d_hours": own["hours"] - subm["hours"],
        "sub_cost": subm["cost"], "new_cost": own["cost"], "d_cost": own["cost"] - subm["cost"],
        "sub_met": subm["expected_met"], "new_met": own["expected_met"],
        "sub_below": subm["below_goal"], "new_below": own["below_goal"],
        "cur_model_sub_met": grid["baseline"]["own_plan_own_model"]["expected_met"],
        "cur_model_new_met": grid[m]["own_plan_current_model"]["expected_met"],
    })
    print(f"\n{m}: {LABELS[m]}  (rows changed, people added, people cut: {grid[m]['changed']})")
    print(out.round(4).to_string())

print("\nService limits (utilization for a 95% / 50% chance at the point, no demand or callout risk), current vs (c):")
from src.service import limits_table  # noqa: E402

limits = limits_table(curves_all).merge(limits_table(final_curves["c_smooth"]), on=["dept_id", "store_id"], suffixes=("", "_smooth"))
limits["dept"] = limits["dept_id"].map(DEPT)
print(limits[["dept", "store_id", "u95", "u95_smooth", "u50", "u50_smooth"]].round(3).to_string(index=False))

print("\nThe submitted plan and the draft under every model (expected_met / below_goal):")
rows = []
for m in METHODS:
    for who in ("submitted_this_model", "draft_this_model"):
        s = grid[m][who]
        for sc in s.index:
            rows.append({"model": m, "plan": "submitted" if who.startswith("sub") else "draft", "scenario": sc,
                         "expected_met": s.loc[sc, "expected_met"], "below_goal": s.loc[sc, "below_goal"]})
print(pd.DataFrame(rows).pivot_table(index=["plan", "scenario"], columns="model", values=["expected_met", "below_goal"]).round(4).to_string())

# ====================================================================================================
section("V-11. Model-free check of expected service")
print(f"""Definition. For each open planning block, with the employees the allocation rule can field:
  E[worked] = sum over net loss L of P(L) * (fielded - L), with P(L) from src.risk.net_loss_distribution
              (binomial callouts at the block's callout rate, 49% backfilled, backfill capped by free overtime,
               overtime room = max_overtime - max(0, fielded - available_regular), as in src.search._block_chance)
  u* = forecast demand * labor standard / (E[worked] * paid_hours)
  hist_rate = share meeting target among open history blocks of the same department with |u - u*| <= {WINDOW}
              (history u = workload hours / worked hours, i.e. realized demand on worked staff).
              If fewer than {MIN_NEIGHBOURS} blocks fall in the window, the {FALLBACK_NEAREST} nearest are used.
Compared columns:
  model_chance  the plan's chance of meeting target (src.risk.chance_met: demand error, callouts, scatter)
  curve_at_u*   the current curve's chance at u* alone (no demand or callout uncertainty): the like-for-like
                counterpart of hist_rate, so (hist_rate - curve_at_u*) tests the curve
  hist_rate     the model-free rate at u*
  hist_integr   the model-free rate curve put through the same demand-error and callout integration as
                model_chance, so (hist_integr - model_chance) tests expected service without the curve.
  hist_rate_wh  same as hist_rate but also the same warehouse (thinner)""")

history = blocks[["store_id", "dept_id", "day_date", "utilization", "met_target"]].reset_index(drop=True)


def window_rate(hist_u: np.ndarray, hist_met: np.ndarray, targets: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    order = np.argsort(hist_u)
    hu, hm = hist_u[order], hist_met[order]
    cum = np.concatenate([[0.0], np.cumsum(hm)])
    lo = np.searchsorted(hu, targets - WINDOW, "left")
    hi = np.searchsorted(hu, targets + WINDOW, "right")
    n = hi - lo
    rate = np.where(n > 0, (cum[hi] - cum[lo]) / np.maximum(n, 1), np.nan)
    thin = n < MIN_NEIGHBOURS
    for i in np.flatnonzero(thin):
        nearest = np.argsort(np.abs(hu - targets[i]))[:FALLBACK_NEAREST]
        rate[i] = hm[nearest].mean()
    return rate, n


class EmpiricalRate:
    """A model-free stand-in for Curve.p_met: the window rate, tabulated on a fine utilization grid."""

    GRID = np.arange(0.20, 3.0001, 0.0025)

    def __init__(self, hist_u, hist_met):
        self.rate, _ = window_rate(hist_u, hist_met, self.GRID)

    def p_met(self, store, u):
        return np.interp(u, self.GRID, self.rate)


def v11_frame(frame: pd.DataFrame, column: str, history: pd.DataFrame) -> pd.DataFrame:
    ev = evaluate(frame, column, curves_all)
    ev = ev[ev["is_open"] == 1].copy()
    expected_worked = []
    for row in ev.itertuples():
        n = int(row.fielded)
        room = int(row.max_overtime_employees) - max(0, n - int(row.available_regular_employees))
        pmf = net_loss_distribution(n, float(row.callout_rate), int(max(room, 0)))
        expected_worked.append(float(pmf @ np.maximum(n - np.arange(len(pmf)), 0)))
    ev["expected_worked"] = expected_worked
    ev["u_star"] = ev["demand"] * ev["standard"] / (ev["expected_worked"] * ev["paid_hours"])
    ev["curve_at_u*"] = [float(curves_all[d].p_met(s, x)) for d, s, x in zip(ev["dept_id"], ev["store_id"], ev["u_star"])]
    ev["hist_rate"], ev["hist_n"] = np.nan, 0
    ev["hist_rate_wh"], ev["hist_n_wh"] = np.nan, 0
    for d in DEPARTMENTS:
        m = ev["dept_id"] == d
        h = history[history["dept_id"] == d]
        rate, n = window_rate(h["utilization"].to_numpy(), h["met_target"].to_numpy(float), ev.loc[m, "u_star"].to_numpy())
        ev.loc[m, "hist_rate"], ev.loc[m, "hist_n"] = rate, n
        for st in STORES:
            mw = m & (ev["store_id"] == st)
            hw = h[h["store_id"] == st]
            rate, n = window_rate(hw["utilization"].to_numpy(), hw["met_target"].to_numpy(float), ev.loc[mw, "u_star"].to_numpy())
            ev.loc[mw, "hist_rate_wh"], ev.loc[mw, "hist_n_wh"] = rate, n
    empirical = {d: EmpiricalRate(history.loc[history["dept_id"] == d, "utilization"].to_numpy(),
                                  history.loc[history["dept_id"] == d, "met_target"].to_numpy(float)) for d in DEPARTMENTS}
    integrated = evaluate(frame, column, empirical)
    ev["hist_integr"] = integrated.loc[integrated["is_open"] == 1, "chance_met"].to_numpy()
    smooth = evaluate(frame, column, final_curves["c_smooth"])
    ev["smooth_chance"] = smooth.loc[smooth["is_open"] == 1, "chance_met"].to_numpy()
    return ev.rename(columns={"chance_met": "model_chance"})


v11 = {"plan": v11_frame(inputs_sub, "submitted_employees", history), "draft": v11_frame(inputs_sub, "draft_scheduled_employees", history)}
cols = ["model_chance", "curve_at_u*", "hist_rate", "hist_integr", "hist_rate_wh", "smooth_chance"]
print("""  smooth_chance the same block's chance under the smooth-knot curve (c), as a second model to referee:
                whichever model is closer to hist_integr agrees better with history without assuming a curve.""")


def v11_summary(ev: pd.DataFrame, by: list[str]) -> pd.DataFrame:
    g = ev.groupby(by, sort=False) if by else ev.assign(_all="all").groupby("_all")
    out = g.agg(blocks=("model_chance", "size"), u_star=("u_star", "mean"), **{c: (c, "mean") for c in cols},
                median_n=("hist_n", "median"), thin=("hist_n", lambda n: int((n < MIN_NEIGHBOURS).sum())))
    out["hist-model"] = out["hist_rate"] - out["model_chance"]
    out["hist_integr-model"] = out["hist_integr"] - out["model_chance"]
    out["hist-curve"] = out["hist_rate"] - out["curve_at_u*"]
    out["hist_integr-smooth"] = out["hist_integr"] - out["smooth_chance"]
    return out


for who, ev in v11.items():
    ev["dept"] = ev["dept_id"].map(DEPT)
    print(f"\n--- {who} ({'submitted CSV' if who == 'plan' else 'draft schedule'}), all open blocks of all scenarios ---")
    print(v11_summary(ev, []).round(4).to_string())
    print(v11_summary(ev, ["scenario_code"]).round(4).to_string())
    print(v11_summary(ev, ["dept"]).round(4).to_string())
    print(v11_summary(ev, ["scenario_code", "dept"]).round(4).to_string())
    ev["model_band"] = pd.cut(ev["model_chance"], [-0.001, 0.5, 0.9, 0.95, 0.99, 1.0001], right=False,
                              labels=["<50%", "50-90%", "90-95%", "95-99%", "99-100%"])
    print("By the model's chance:")
    print(v11_summary(ev, ["model_band"]).round(4).to_string())

V11_BOOT = 200
print(f"\nCluster bootstrap of hist_integr minus each model (resampling the history days, {V11_BOOT} draws).")
print("The point version (hist_rate) isn't bootstrapped: at u* nearly every block at >=90% has a window rate of exactly 1.")
rng = np.random.default_rng(11)
day_codes, day_list = pd.factorize(history["day_date"])
by_day = [np.flatnonzero(day_codes == i) for i in range(len(day_list))]
sources = {"plan": (inputs_sub, "submitted_employees"), "draft": (inputs_sub, "draft_scheduled_employees")}
draws = {who: [] for who in v11}
for _ in range(V11_BOOT):
    h = history.iloc[np.concatenate([by_day[i] for i in rng.integers(0, len(by_day), len(by_day))])]
    empirical = {d: EmpiricalRate(h.loc[h["dept_id"] == d, "utilization"].to_numpy(), h.loc[h["dept_id"] == d, "met_target"].to_numpy(float))
                 for d in DEPARTMENTS}
    for who, (frame, column) in sources.items():
        scored = evaluate(frame, column, empirical)
        draws[who].append(scored.loc[scored["is_open"] == 1, "chance_met"].to_numpy())
rows = []
for who, ev in v11.items():
    sample = np.array(draws[who])
    groups = {"all": np.ones(len(ev), bool), "model >=90%": (ev["model_chance"] >= 0.90).to_numpy(),
              **{DEPT[d]: (ev["dept_id"] == d).to_numpy() for d in DEPARTMENTS}}
    for name, m in groups.items():
        for model in ("model_chance", "smooth_chance"):
            gap = sample[:, m].mean(1) - ev[model].to_numpy()[m].mean()
            rows.append({"plan": who, "blocks": name, "n": int(m.sum()), "model": model,
                         "gap": ev["hist_integr"].to_numpy()[m].mean() - ev[model].to_numpy()[m].mean(),
                         "lo95": np.quantile(gap, 0.025), "hi95": np.quantile(gap, 0.975)})
print(pd.DataFrame(rows).round(4).to_string(index=False))

print(f"\nDone in {time.time() - T0:.0f}s.")
