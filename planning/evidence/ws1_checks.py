"""WS1 accuracy checks (T-74, T-76, T-77): V-01, V-02 and V-05 to V-09 in planning/DELIVERABLES_PLAN.md section 5.3.

Run from the project root:
    python planning/evidence/ws1_checks.py          # about 1 minute: outputs against git, verify_findings, every other check
    python planning/evidence/ws1_checks.py --full   # also runs pytest and the pipeline, and confirms outputs are byte-identical
The saved output, planning/evidence/ws1_checks.output.txt, comes from --full.

The independent checks (V-02's own rebuild, V-05's data checks, V-08, V-09) run before anything in src/ is
imported, and the script asserts that. V-07 then loads only the service curves and risk model, never the search
or the allocation code. Helpers live in planning/evidence/ws1/. Nothing here writes to src/ or planning/*.md.
A run with --full rewrites outputs/ through the pipeline; if any file then differs from before, it is restored
from git and reported. outputs/charts/ is left alone.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

sys.dont_write_bytecode = True  # keep planning/evidence/ws1/ free of __pycache__
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "planning" / "evidence" / "ws1"))
sys.stdout.reconfigure(encoding="utf-8")

FULL = "--full" in sys.argv
results: list[tuple[str, bool]] = []


def run(cmd: list[str], timeout: int = 900) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)


def report(check: str, title: str, ok: bool, summary: str, details: list[str] | None = None) -> None:
    results.append((check, ok))
    print(f"{'PASS' if ok else 'FAIL'} {check} {title}: {summary}")
    for line in details or []:
        print(f"     {line}")


def output_files() -> list[Path]:
    return sorted(p for p in (ROOT / "outputs").rglob("*") if p.is_file() and "charts" not in p.relative_to(ROOT / "outputs").parts)


def hashes() -> dict[str, str]:
    return {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in output_files()}


def git_dirty(paths: list[str]) -> list[str]:
    return [line for line in run(["git", "status", "--porcelain", "--", *paths]).stdout.splitlines() if line.strip()]


def no_src_loaded(*names: str) -> bool:
    loaded = [m for m in sys.modules if m == "src" or m.startswith("src.")]
    return not loaded if not names else not any(n in sys.modules for n in names)


print(f"WS1 checks, {datetime.now():%Y-%m-%d %H:%M}, mode {'--full' if FULL else 'fast'}")
print(f"git HEAD {run(['git', 'rev-parse', '--short', 'HEAD']).stdout.strip()}; "
      f"uncommitted changes in src/: {git_dirty(['src']) or 'none'}")
print()

# ---------------------------------------------------------------- V-01
started = time.time()
tracked = [p.relative_to(ROOT).as_posix() for p in output_files()]
details = []
before = hashes()
dirty_before = git_dirty(tracked)
details.append(f"{len(before)} files in outputs/ outside charts/; differ from the last commit before this run: {dirty_before or 'none'}")
ok = not dirty_before
if FULL:
    tests = run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider"], timeout=1200)
    last = [l for l in tests.stdout.splitlines() if " passed" in l or " failed" in l or " error" in l]
    details.append(f"pytest: {last[-1] if last else tests.stdout[-300:]}")
    ok &= tests.returncode == 0
    pipe = run([sys.executable, "-m", "src.pipeline"], timeout=1200)
    details.append(f"pipeline exit {pipe.returncode}; {next((l for l in pipe.stdout.splitlines() if l.startswith('Validator')), '')}")
    ok &= pipe.returncode == 0
    after = hashes()
    changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
    details.append(f"byte-identical after the pipeline: {'yes' if not changed else 'NO, changed: ' + ', '.join(changed)}")
    if changed:
        ok = False
        restore = [c for c in changed if c in tracked]
        run(["git", "checkout", "--", *restore])
        details.append(f"restored from git: {restore}")
    details.append(f"git status outputs/ (outside charts/) after the run: {git_dirty(tracked) or 'clean'}")
verify = run([sys.executable, "-I", "planning/evidence/verify_findings.py"])
saved = (ROOT / "planning" / "evidence" / "verify_findings.output.txt").read_text(encoding="utf-8")
same = verify.stdout.replace("\r\n", "\n") == saved.replace("\r\n", "\n")
details.append(f"verify_findings.py exit {verify.returncode}, {len(verify.stdout.splitlines())} lines, identical to the saved output: {same}")
ok &= verify.returncode == 0 and same
report("V-01", "Everything reproduces", ok, "tests, pipeline and findings reproduce, outputs identical" if FULL else
       "outputs match the commit and verify_findings matches (run --full for pytest and the pipeline)", details)
print(f"     ({time.time() - started:.0f} s)")

# ---------------------------------------------------------------- independent checks, before any src import
import ws1_indep  # noqa: E402

assert no_src_loaded(), "src/ was imported before the independent checks"
ok, problems, info = ws1_indep.v02_independent()
report("V-02a", "Submission valid (own rebuild, no src/)", ok,
       f"{info['rows']} rows, {info['closed_blocks']} closed all 0, {info['open_blocks']} open, problems: {problems}",
       [f"keys joined on keys; row order also matches the template: {info['row_order_matches_template']}",
        f"open blocks at capacity: {info['at_capacity']}; total employees {info['total_employees']}; "
        f"rows differing from plan_vs_draft.csv: {info['differs_from_plan_vs_draft']}; team_id {info['team_ids']}"])

ok, info = ws1_indep.v08_costs()
lines = [f"{name}: " + ", ".join(f"{sc} ${v[0]:,.3f} vs ${v[1]:,.3f}" for sc, v in pairs.items())
         for name, pairs in info["by_scenario (independent, json)"].items()]
lines += [f"largest per-block gaps: {info['max_abs_gap']}", f"plan_by_dept largest gap ${info['plan_by_dept_max_gap']:.6f}",
          f"grid rates vs comp_LaborCostAssumption gap {info['grid_vs_comp_rate_gap']}", f"F-48 rounded (doc, ours): {info['F-48 (doc, independent)']}",
          f"note: the draft's {info['draft_unfilled']['people']} unfieldable people in {info['draft_unfilled']['blocks']} DISRUPT blocks are not costed; "
          f"paying them at overtime would add ${info['draft_unfilled']['cost_if_paid_at_overtime']:,.2f} (the README doesn't say)"]
report("V-08", "Cost rule matches the README", ok, "plan and draft costs equal plan_vs_draft.csv and analysis_summary.json to the half cent", lines)

tests = run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "tests/test_explanations_match.py"])
last = [l for l in tests.stdout.splitlines() if " passed" in l or " failed" in l]
report("V-09", "Every explanation matches its numbers", tests.returncode == 0,
       f"tests/test_explanations_match.py: {last[-1] if last else tests.stdout[-300:]} (567 rows, 540 open)")

sub = {}
for name, fn in (("multipliers", ws1_indep.v05_multipliers), ("feb17", ws1_indep.v05_feb17),
                 ("promotions", ws1_indep.v05_promotions), ("valentine", ws1_indep.v05_valentine)):
    sub[name] = fn()
m, f17, pr, va = (sub[k][1] for k in ("multipliers", "feb17", "promotions", "valentine"))
report("V-05", "Forecast inputs hold up", all(v[0] for v in sub.values()), "multipliers, Feb 17, promotions and Valentine's all hold", [
    f"[{'ok' if sub['multipliers'][0] else 'FAIL'}] scenario / BASE demand = grid multiplier: "
    + ", ".join(f"{k} {v['blocks']} blocks, largest gap {v['max_abs_gap']:.1e}" for k, v in m.items()),
    f"[{'ok' if sub['feb17'][0] else 'FAIL'}] Feb 17: grid role {f17['grid_role']}, rebound flag {f17['grid_rebound_flag']}, forecast window {f17['forecast_window']}, "
    f"no Valentine uplift, same demand_sd as Feb 18: {f17['demand_sd_same_as_feb18']}; the data pack's history generator ignores the rebound flag "
    f"(Jan 20 flagged, role {f17['jan20_history_role']}), and Jan 20 ran {f17['jan20_vs_own_week']:+.2%} against its own week",
    f"[{'ok' if sub['promotions'][0] else 'FAIL'}] F-61: {pr['history_days_matching_rule']}/{pr['history_days']} history days follow Fri-Sun + MLK Monday + New Year's Day, "
    f"planning promotions on {pr['planning_promo_days']}",
    f"[{'ok' if sub['valentine'][0] else 'FAIL'}] F-52 vs analysis_summary.json: expected service {va['json our plan']} / replanned {va['json replanned']}, "
    f"replanned cost {va['json cost']}, at capacity {va['at capacity'][0]} of {va['at capacity'][1]}",
])
assert no_src_loaded(), "an independent check imported src/"

# ---------------------------------------------------------------- V-07: the curves and risk model only
import ws1_engine  # noqa: E402

started = time.time()
ok_rules, rules = ws1_engine.v07_rules()
ok, info = ws1_engine.v07_search()
assert no_src_loaded("src.search", "src.allocation"), "V-07 must not import the search or the allocation code"
report("V-07", "Search is optimal", ok and ok_rules,
       f"{info['sample_agree']} seeded shifts (seed {info['sample_seed']}), {info['all_shifts_agree']} of all open shifts, "
       f"Pharmacy {info['pharmacy_agree']}", [
           f"ties at the top: {info['shifts_with_tied_best']}; plan meets the D-17 floors in {info['plan_meets_D17_floors']} shifts; "
           f"the guard changes the pick in {info['shifts_where_D17_guard_changes_pick']}",
           f"closed not 0: {rules['closed_not_zero']} of {rules['closed_blocks']}; below min_staff: {rules['below_min_staff']}; "
           f"over capacity: {rules['over_capacity']}; largest gap between plan_vs_draft chance and the scorer: {info['max_gap_plan_chance_vs_scorer']:.1e}",
           f"disagreements: {info['disagreements'] or 'none'}",
           *[f"sampled {row}" for row in info["sample"]],
           *[f"D-17 binds {row}" for row in info["guard_shifts"]],
       ])
print(f"     ({time.time() - started:.0f} s)")

# ---------------------------------------------------------------- V-02 with the project's own validator
import pandas as pd  # noqa: E402

from src.submission import validate  # noqa: E402

filled = pd.read_csv(ROOT / "outputs" / "TEAM_SUBMISSION_TEMPLATE_filled.csv", parse_dates=["day_date"])
normal, final = validate(filled), validate(filled, final=True)
report("V-02b", "Submission valid (src.submission.validate)", normal == [] and final == ["team_id still holds the placeholder TEAM_NAME (Q-07)"],
       f"validate(): {normal or 'no problems'}; validate(final=True): {final}")

# ---------------------------------------------------------------- V-06: the full engine
started = time.time()
history = ws1_engine.v06_history()
jan, cut = history["january_flu_week"], history["disrupt_illness_cut"]
fell = jan["W2 38"]["regular_vs_normal_weeks"] < -0.10 and jan["W2 95"]["regular_vs_normal_weeks"] < -0.10
others = max(abs(v["regular_vs_normal_weeks"]) for k, v in jan.items() if k not in ("W2 38", "W2 95"))
measured = ws1_engine.v06_measure()
own = measured["own_world"]
fmt = lambda s: f"{s['hours']:,.1f} h, ${s['cost']:,.2f}, expected service {s['expected_met']:.1%}, {int(s['below_goal'])} blocks below goal"
report("V-06", "DISRUPT doesn't count the illness twice", fell and others < 0.05,
       "A-12 kept with evidence: January's flu week cut Warehouse 2's availability and raised callouts together" if fell else
       "availability did not fall in January, so the callout bump may double-count: decision for the user", [
           f"January flu week vs normal weeks, same weekday and shift: W2 Front End regular {jan['W2 38']['regular_vs_normal_weeks']:+.1%}, "
           f"Pharmacy {jan['W2 95']['regular_vs_normal_weeks']:+.1%}, overtime pool unchanged; callouts {jan['W2 38']['callout_rate']:.1%} and "
           f"{jan['W2 95']['callout_rate']:.1%}; every other warehouse-department within {others:.1%}; flu-note blocks {history['flu_note_blocks']}",
           f"DISRUPT vs BASE on the illness blocks: Front End regular {cut[38]['regular_vs_base']:+.1%}, overtime {cut[38]['overtime_vs_base']:+.1%} "
           f"({cut[38]['blocks']} blocks); Pharmacy regular {cut[95]['regular_vs_base']:+.1%}, overtime {cut[95]['overtime_vs_base']:+.1%} ({cut[95]['blocks']} blocks)",
           f"rates replaced when dropping A-12 (flu, normal, blocks): {measured['rates_replaced']}",
           f"plan with A-12:    {fmt(own['with A-12'])}",
           f"plan without A-12: {fmt(own['without A-12'])}",
           f"staffing changes from dropping A-12: {measured['blocks_changed']['count']} blocks, {measured['blocks_changed']['people']} people",
           f"draft scored with / without A-12: {measured['draft_own_world']['with A-12']['expected_met']:.1%} / "
           f"{measured['draft_own_world']['without A-12']['expected_met']:.1%}",
       ])
print(f"     ({time.time() - started:.0f} s)")

print()
passed = sum(ok for _, ok in results)
print(f"{passed} of {len(results)} checks passed: " + ", ".join(f"{c} {'PASS' if ok else 'FAIL'}" for c, ok in results))
sys.exit(0 if passed == len(results) else 1)
