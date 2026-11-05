"""Check that planning/evidence/calibration/service_smooth.py reproduces the study's c_smooth plan (T-75, D-29).

Installs that file as src.service before anything imports it, so the rest of src/ runs unchanged on the
smooth curve. Writes nothing. Run from the project root:
    python -W ignore planning/evidence/calibration/check_smooth_plan.py
"""
import importlib.util
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

import src  # noqa: E402,F401

spec = importlib.util.spec_from_file_location("src.service", Path(__file__).with_name("service_smooth.py"))
smooth = importlib.util.module_from_spec(spec)
sys.modules["src.service"] = smooth
spec.loader.exec_module(smooth)

from src.data import PLAN_KEY, open_history  # noqa: E402
from src.search import build_plan, evaluate, planning_inputs, summarize  # noqa: E402
from src.service import fit_all, limits_table  # noqa: E402

assert fit_all is smooth.fit_all
curves = fit_all(open_history())
inputs = planning_inputs()
plan = build_plan(inputs, curves)
old = pd.read_csv(ROOT / "outputs" / "TEAM_SUBMISSION_TEMPLATE_filled.csv", parse_dates=["day_date"])
merged = plan.merge(old[[*PLAN_KEY, "submitted_employees"]], on=PLAN_KEY, validate="one_to_one")
change = merged["recommended"] - merged["submitted_employees"]
print(f"rows changed {int((change != 0).sum())}, people added {int(change.clip(lower=0).sum())}, cut {int((-change).clip(lower=0).sum())}")
summary = summarize(evaluate(plan, "recommended", curves)).set_index("scenario_code")
print(summary[["hours", "cost", "expected_met", "below_goal"]].round(4).to_string())
base = summary.loc["BASE"]
ok = (change != 0).sum() == 24 and change.clip(lower=0).sum() == 24 and (change < 0).sum() == 0
ok &= base["hours"] == 11657.5 and round(base["cost"], 2) == 377504.48
print("width:", {d: round(c.width, 4) for d, c in curves.items()}, "knot:", {d: round(c.knot, 3) for d, c in curves.items()})
print(limits_table(curves).round(3).to_string(index=False))
print("REPRODUCES the study's c_smooth plan" if ok else "DOES NOT REPRODUCE the study's c_smooth plan")
sys.exit(0 if ok else 1)
