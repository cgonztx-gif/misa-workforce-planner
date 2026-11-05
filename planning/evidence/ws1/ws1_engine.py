"""WS1 checks that need the engine's models: V-07 (search optimality) and V-06 (DISRUPT double count).

V-07 uses only the fitted service curves (src.service.fit_all) and the risk model (src.risk.chance_met)
as the scoring function. The search itself (src/search.py) and the allocation code (src/allocation.py)
are not imported for V-07. The brute force tries every headcount pair and applies the rule stated in
planning/DESIGN.md and the src/search.py docstrings:

    need  = smallest headcount at or above min_staff with a chance of meeting target >= goal
    floor = min(need, regular + overtime)                         (D-17: lend only what you don't need)
    pairs = every (Front End, Merchandising) from min_staff to regular + overtime + flex,
            kept when both are within capacity under the allocation rule (A-01) and at or above the floors
    rank  = 1. highest round(min(p_front, goal) + min(p_merch, goal), 3)
            2. fewest hours short of need, 3. lowest cost
    Pharmacy: same ranking over its own headcounts, no flex.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ws1_indep import CSV, KEY, OUT, grid, plan_vs_draft, rates, read

GOAL = 0.95  # A-13 / SERVICE_GOAL, restated rather than imported.
SEED = 20261107
SAMPLE = 20


def block_table() -> pd.DataFrame:
    """One row per block: the plan's inputs from plan_vs_draft.csv plus flex and rates from the raw data."""
    p = plan_vs_draft()
    g = grid()[KEY + ["cross_trained_flex_employees"]]
    std = read(CSV / "comp_LaborStandard.csv")[["dept_id", "labor_hours_per_workload_unit"]]
    frame = p.merge(g, on=KEY, validate="one_to_one").merge(rates(), on=["store_id", "dept_id"], validate="many_to_one")
    return frame.merge(std, on="dept_id", validate="many_to_one")


class Scorer:
    def __init__(self):
        from src.risk import chance_met
        from src.service import fit_all

        self.curves = fit_all()
        self.chance_met = chance_met

    def chance(self, b, n: int) -> float:
        room = int(b.max_overtime_employees) - max(0, n - int(b.available_regular_employees))
        return self.chance_met(self.curves[int(b.dept_id)], int(b.store_id), b.demand, b.demand_sd, n, b.paid_hours,
                               b.labor_hours_per_workload_unit, b.callout_rate, room)

    def need(self, b) -> int:
        limit = 3 * int(b.available_regular_employees + b.max_overtime_employees + b.cross_trained_flex_employees) + 20
        n = int(b.min_staff)
        while n < limit and self.chance(b, n) < GOAL:
            n += 1
        return n


def cost(b, n: int, usable: int) -> float:
    regular = min(n, int(b.available_regular_employees))
    flex = min(n - regular, usable)
    overtime = min(n - regular - flex, int(b.max_overtime_employees))
    return (regular + flex) * b.paid_hours * b.loaded_regular_hourly_cost + overtime * b.paid_hours * b.loaded_overtime_hourly_cost


def brute_pair(scorer: Scorer, fe, me) -> dict:
    span = lambda b: range(int(b.min_staff), max(int(b.available_regular_employees + b.max_overtime_employees + b.cross_trained_flex_employees), int(b.min_staff)) + 1)
    pf = {n: scorer.chance(fe, n) for n in span(fe)}
    pm = {n: scorer.chance(me, n) for n in span(me)}
    need_f, need_m = scorer.need(fe), scorer.need(me)
    floor_f = min(need_f, int(fe.available_regular_employees + fe.max_overtime_employees))
    floor_m = min(need_m, int(me.available_regular_employees + me.max_overtime_employees))
    rows = []
    for f, p_f in pf.items():
        for m, p_m in pm.items():
            usable_f = min(int(fe.cross_trained_flex_employees), max(0, int(me.available_regular_employees) - m))
            usable_m = min(int(me.cross_trained_flex_employees), max(0, int(fe.available_regular_employees) - f))
            if f > fe.available_regular_employees + fe.max_overtime_employees + usable_f:
                continue
            if m > me.available_regular_employees + me.max_overtime_employees + usable_m:
                continue
            score = round(min(p_f, GOAL) + min(p_m, GOAL), 3)
            short = max(0, need_f - f) * fe.paid_hours + max(0, need_m - m) * me.paid_hours
            rows.append((-score, short, cost(fe, f, usable_f) + cost(me, m, usable_m), f, m, f >= floor_f and m >= floor_m))
    guarded = [r for r in rows if r[5]]
    best = min(guarded, key=lambda r: r[:3])
    ties = [r for r in guarded if r[0] == best[0] and r[1] == best[1] and abs(r[2] - best[2]) < 1e-9]
    unguarded = min(rows, key=lambda r: r[:3])
    return {"pick": (best[3], best[4]), "ties": len(ties), "unguarded": (unguarded[3], unguarded[4]), "pairs": len(rows),
            "floors": (floor_f, floor_m), "p_front": pf, "p_merch": pm}


def brute_single(scorer: Scorer, b) -> int:
    rows = []
    need = scorer.need(b)
    for n in range(int(b.min_staff), max(int(b.available_regular_employees + b.max_overtime_employees), int(b.min_staff)) + 1):
        rows.append((-round(min(scorer.chance(b, n), GOAL), 3), max(0, need - n) * b.paid_hours, cost(b, n, 0), n))
    return min(rows)[3]


def v07_search() -> tuple[bool, dict]:
    table = block_table()
    scorer = Scorer()
    opened = table[table["is_open"] == 1]
    shifts = sorted(opened.groupby(["scenario_id", "store_id", "day_date", "shift_code"]).groups)
    rng = np.random.default_rng(SEED)
    sample = {shifts[i] for i in rng.choice(len(shifts), size=SAMPLE, replace=False)}
    by_shift = {k: {int(r.dept_id): r for r in grp.itertuples()} for k, grp in opened.groupby(["scenario_id", "store_id", "day_date", "shift_code"])}
    agree_sample, agree_all, ties, guard_changed, guard_ok, pharmacy_agree, pharmacy_n, chance_gap = 0, 0, 0, 0, 0, 0, 0, 0.0
    disagreements, sample_rows, guard_shifts = [], [], []
    for k in shifts:
        depts = by_shift[k]
        fe, me = depts[38], depts[92]
        res = brute_pair(scorer, fe, me)
        planned = (int(fe.recommended), int(me.recommended))
        same = res["pick"] == planned
        agree_all += same
        ties += res["ties"] > 1
        if res["unguarded"] != res["pick"]:
            guard_changed += 1
            guard_shifts.append(f"{k[0]}/{k[1]}/{k[2]}/{k[3]}: guarded {res['pick']}, unguarded {res['unguarded']}")
        guard_ok += planned[0] >= res["floors"][0] and planned[1] >= res["floors"][1]
        chance_gap = max(chance_gap, abs(res["p_front"][planned[0]] - fe.chance_met), abs(res["p_merch"][planned[1]] - me.chance_met))
        if k in sample:
            agree_sample += same
            sample_rows.append(f"{k[0]}/{k[1]}/{k[2]}/{k[3]}: plan {planned}, brute force {res['pick']}, {res['pairs']} feasible pairs")
        if not same:
            disagreements.append((k, planned, res["pick"], res["ties"]))
        if 95 in depts:
            pharmacy_n += 1
            pharmacy_agree += brute_single(scorer, depts[95]) == int(depts[95].recommended)
    info = {
        "sample_seed": SEED, "sample_agree": f"{agree_sample}/{SAMPLE}", "all_shifts_agree": f"{agree_all}/{len(shifts)}",
        "pharmacy_agree": f"{pharmacy_agree}/{pharmacy_n}", "shifts_with_tied_best": ties,
        "shifts_where_D17_guard_changes_pick": guard_changed, "plan_meets_D17_floors": f"{guard_ok}/{len(shifts)}",
        "max_gap_plan_chance_vs_scorer": chance_gap, "disagreements": disagreements, "sample": sample_rows, "guard_shifts": guard_shifts,
    }
    ok = agree_sample == SAMPLE and agree_all == len(shifts) and pharmacy_agree == pharmacy_n and guard_ok == len(shifts) and chance_gap < 1e-12
    return ok, info


def v07_rules() -> tuple[bool, dict]:
    """Closed blocks 0, open blocks at or above min_staff and within capacity, in plan_vs_draft.csv."""
    from ws1_indep import apply_readme_rule

    table = block_table()
    ruled = apply_readme_rule(table, "recommended")
    closed = ruled[ruled["is_open"] == 0]
    opened = ruled[ruled["is_open"] == 1]
    info = {
        "closed_not_zero": int((closed["recommended"] != 0).sum()),
        "below_min_staff": int((opened["recommended"] < opened["min_staff"]).sum()),
        "over_capacity": int((opened["recommended"] > opened["i_capacity"]).sum()),
        "closed_blocks": int(len(closed)),
    }
    return all(v == 0 for k, v in info.items() if k != "closed_blocks"), info


# ---------------------------------------------------------------- V-06


def v06_history() -> dict:
    """Did Warehouse 2's availability fall in January's flu week, and how does DISRUPT's cut compare?"""
    h = read(CSV / "v_ShiftHistory.csv", dtype={"day_date": str})
    h = h[h["is_open"] == 1]
    flu = h["day_date"].between("2026-01-22", "2026-01-28")
    ref = h[(h["holiday_window_role"] == "Normal") & ~flu].groupby(["store_id", "dept_id", "day_of_week", "shift_code"])[
        ["available_regular_employees", "max_overtime_employees"]].mean()
    week = h[flu].join(ref, on=["store_id", "dept_id", "day_of_week", "shift_code"], rsuffix="_normal")
    sums = week.groupby(["store_id", "dept_id"])[["available_regular_employees", "available_regular_employees_normal", "max_overtime_employees",
                                                  "max_overtime_employees_normal", "callout_employees", "scheduled_employees"]].sum()
    january = {}
    for (store, dept), r in sums.iterrows():
        january[f"W{store} {dept}"] = {
            "regular_vs_normal_weeks": round(r.available_regular_employees / r.available_regular_employees_normal - 1, 3),
            "overtime_vs_normal_weeks": round(r.max_overtime_employees / r.max_overtime_employees_normal - 1, 3),
            "callout_rate": round(r.callout_employees / r.scheduled_employees, 3),
        }
    notes = h.loc[h["availability_note"].fillna("").str.contains("Flu"), ["store_id", "dept_id"]].value_counts().to_dict()
    g = grid()
    block = ["store_id", "dept_id", "day_date", "shift_code"]
    base, dis = g[g["scenario_code"] == "BASE"].set_index(block), g[g["scenario_code"] == "DISRUPT"].set_index(block)
    ill = dis.index[dis["availability_note"].fillna("").str.contains("Illness cluster")]
    disrupt = {}
    for dept in (38, 95):
        idx = [i for i in ill if i[1] == dept]
        b, d = base.loc[idx], dis.loc[idx]
        disrupt[dept] = {
            "blocks": len(idx),
            "regular_vs_base": round(d.available_regular_employees.sum() / b.available_regular_employees.sum() - 1, 3),
            "overtime_vs_base": round(d.max_overtime_employees.sum() / b.max_overtime_employees.sum() - 1, 3),
        }
    return {"january_flu_week": january, "flu_note_blocks": {f"W{s} {d}": n for (s, d), n in notes.items()}, "disrupt_illness_cut": disrupt}


def v06_measure() -> dict:
    """Plan DISRUPT with and without A-12's flu-week callout rates, and score each plan both ways."""
    from src.app_data import run_scenario
    from src.search import evaluate, planning_inputs, summarize
    from src.service import fit_all

    curves = fit_all()
    inputs = planning_inputs()
    rates = read(OUT / "diagnosis_callout_rates.csv").set_index(["dept_id", "context"])["rate"]
    flu = inputs["callout_context"] == "flu_cluster"
    assert set(inputs.loc[flu, "scenario_code"]) == {"DISRUPT"} and not (inputs.loc[flu, "day_date"] == "2026-02-17").any()
    plain = np.where(inputs.loc[flu, "is_weekend"] == 1, "weekend", "weekday")
    without = inputs.copy()
    without.loc[flu, "callout_rate"] = [rates[(d, c)] for d, c in zip(inputs.loc[flu, "dept_id"], plain)]
    used = inputs.loc[flu].assign(plain=plain).groupby(["dept_id", "plain"])["callout_rate"].agg(["first", "size"])
    runs = {"with A-12": run_scenario(inputs, curves, "DISRUPT"), "without A-12": run_scenario(without, curves, "DISRUPT")}
    keep = ["hours", "cost", "expected_met", "lowest_chance", "below_goal", "overtime_hours"]
    result = {"rates_replaced": {f"{d} {c}": (round(float(r["first"]), 4), round(float(rates[(d, c)]), 4), int(r["size"])) for (d, c), r in used.iterrows()}}
    result["own_world"] = {name: {k: float(run["plan_summary"][k]) for k in keep} for name, run in runs.items()}
    result["draft_own_world"] = {name: {k: float(run["draft_summary"][k]) for k in keep} for name, run in runs.items()}
    worlds = {"with A-12": inputs, "without A-12": without}
    plans = {name: run["explained"][KEY + ["recommended"]] for name, run in runs.items()}
    cross = {}
    for plan_name, plan in plans.items():
        for world_name, world in worlds.items():
            part = world[world["scenario_code"] == "DISRUPT"].drop(columns=["recommended"], errors="ignore")
            part = part.merge(plan, on=KEY, validate="one_to_one")
            cross[f"plan {plan_name}, scored {world_name}"] = {k: float(v) for k, v in summarize(evaluate(part, "recommended", curves)).iloc[0][keep].items()}
    result["cross_scored"] = cross
    a, b = plans["with A-12"].set_index(KEY)["recommended"], plans["without A-12"].set_index(KEY)["recommended"]
    changed = (a - b.loc[a.index])
    changed = changed[changed != 0]
    result["blocks_changed"] = {
        "count": int(len(changed)),
        "people": int(changed.sum()),
        "by_dept": {int(k): int(v) for k, v in changed.groupby(level="dept_id").sum().items()},
        "dates": sorted({d.strftime("%m-%d") for d in changed.index.get_level_values("day_date")}),
    }
    return result
