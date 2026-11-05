"""WS1 checks that must not touch the engine: V-02 (independent part), V-05 (data part) and V-08.

Nothing here imports anything from src/. The labor rule is rebuilt from the data pack README:
"Each block is filled with regular available staff first. Next come cross-trained staff from the
partner department (Front End and Merchandising only), limited to people that department is not
already using in the same shift. Overtime comes last. Use the rates in comp.LaborCostAssumption."
and docs/ASSUMPTIONS.md section 5: "Block cost = (regular + flex employees) x paid hours x loaded
regular rate + overtime employees x paid hours x loaded overtime rate."

"Not already using" is read as A-01: spare = max(0, partner regular - partner submitted).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
CSV = ROOT / "data" / "team_distribution" / "csv"
OUT = ROOT / "outputs"
KEY = ["scenario_id", "store_id", "dept_id", "day_date", "shift_code"]
SHIFT = ["scenario_id", "store_id", "day_date", "shift_code"]
PARTNER = {38: 92, 92: 38}


def read(path: Path, **kw) -> pd.DataFrame:
    return pd.read_csv(path, **kw)


def grid() -> pd.DataFrame:
    return read(CSV / "v_PlanningWeekGrid.csv", dtype={"day_date": str})


def plan_vs_draft() -> pd.DataFrame:
    return read(OUT / "plan_vs_draft.csv", dtype={"day_date": str})


def summary() -> dict:
    return json.loads((OUT / "analysis_summary.json").read_text(encoding="utf-8"))


def rates() -> pd.DataFrame:
    table = read(CSV / "comp_LaborCostAssumption.csv")
    return table[["store_id", "dept_id", "loaded_regular_hourly_cost", "loaded_overtime_hourly_cost"]]


# ---------------------------------------------------------------- the README's labor rule, rebuilt


def apply_readme_rule(frame: pd.DataFrame, column: str) -> pd.DataFrame:
    """Per block: usable flex, capacity, regular / flex / overtime fill, unfilled and cost.

    `frame` needs KEY, available_regular_employees, max_overtime_employees,
    cross_trained_flex_employees, paid_hours and `column`. Rates come from comp_LaborCostAssumption.
    Written row by row on purpose, so it shares no vectorised code with src/allocation.py.
    """
    lookup = {
        (int(r.scenario_id), int(r.store_id), int(r.dept_id), r.day_date, r.shift_code): r
        for r in frame.itertuples(index=False)
    }
    rate = {(int(r.store_id), int(r.dept_id)): (r.loaded_regular_hourly_cost, r.loaded_overtime_hourly_cost) for r in rates().itertuples()}
    out = []
    for r in frame.itertuples(index=False):
        submitted = int(getattr(r, column))
        regular, overtime_room = int(r.available_regular_employees), int(r.max_overtime_employees)
        usable = 0
        if int(r.dept_id) in PARTNER:
            partner = lookup.get((int(r.scenario_id), int(r.store_id), PARTNER[int(r.dept_id)], r.day_date, r.shift_code))
            if partner is not None:
                partner_using = min(int(getattr(partner, column)), int(partner.available_regular_employees))
                spare = int(partner.available_regular_employees) - partner_using
                usable = min(int(r.cross_trained_flex_employees), spare)
        fill_regular = min(submitted, regular)
        left = submitted - fill_regular
        fill_flex = min(left, usable)
        left -= fill_flex
        fill_overtime = min(left, overtime_room)
        unfilled = left - fill_overtime
        reg_rate, ot_rate = rate[(int(r.store_id), int(r.dept_id))]
        cost = (fill_regular + fill_flex) * r.paid_hours * reg_rate + fill_overtime * r.paid_hours * ot_rate
        out.append((usable, regular + usable + overtime_room, fill_regular, fill_flex, fill_overtime, unfilled, cost))
    cols = ["i_usable_flex", "i_capacity", "i_fill_regular", "i_fill_flex", "i_fill_overtime", "i_unfilled", "i_cost"]
    return frame.reset_index(drop=True).join(pd.DataFrame(out, columns=cols))


# ---------------------------------------------------------------- V-02, independent part


def v02_independent() -> tuple[bool, list[str], dict]:
    """567 rows, columns, keys joined on keys, closed 0, whole numbers, capacity, min_staff, team name."""
    problems, info = [], {}
    filled = read(OUT / "TEAM_SUBMISSION_TEMPLATE_filled.csv", dtype=str, keep_default_na=False)
    template = read(CSV / "TEAM_SUBMISSION_TEMPLATE.csv", dtype=str, keep_default_na=False)
    g = grid()
    info["rows"] = len(filled)
    if list(filled.columns) != list(template.columns):
        problems.append("columns differ from the template")
    if len(filled) != 567:
        problems.append(f"{len(filled)} rows, expected 567")
    fk = filled[KEY].apply(tuple, axis=1)
    tk = template[KEY].apply(tuple, axis=1)
    if fk.duplicated().any():
        problems.append("duplicate keys in the filled file")
    if set(fk) != set(tk):
        problems.append("key set differs from the template")
    info["row_order_matches_template"] = bool((fk.values == tk.values).all())
    # Every template column except the two we fill must survive the key join unchanged.
    fixed = [c for c in template.columns if c not in ("team_id", "submitted_employees")]
    joined = template.merge(filled, on=KEY, how="left", suffixes=("_t", ""), validate="one_to_one")
    for c in fixed:
        if c in KEY:
            continue
        if not (joined[c] == joined[c + "_t"]).all():
            problems.append(f"column {c} changed against the template")
    values = joined["submitted_employees"]
    if not values.str.fullmatch(r"\d+").all():
        problems.append("submitted_employees has blanks, signs, decimals or text")
        return False, problems, info
    joined["n"] = values.astype(int)
    teams = set(joined["team_id"])
    info["team_ids"] = sorted(teams)
    if len(teams) != 1:
        problems.append("team_id differs between rows")
    if "TEAM_NAME" in teams:
        problems.append("team_id is still the placeholder TEAM_NAME")
    # Bring in the grid's facts by key, never by row position.
    g = g.copy()
    for c in ("scenario_id", "store_id", "dept_id"):
        g[c] = g[c].astype(str)
    facts = ["is_open", "min_staff", "available_regular_employees", "max_overtime_employees", "cross_trained_flex_employees", "paid_hours"]
    m = joined[KEY + ["n"]].merge(g[KEY + facts], on=KEY, how="left", validate="one_to_one")
    for c in ("scenario_id", "store_id", "dept_id"):
        m[c] = m[c].astype(int)
    closed = m[m["is_open"] == 0]
    info["closed_blocks"] = len(closed)
    if (closed["n"] != 0).any():
        problems.append(f"{int((closed['n'] != 0).sum())} closed blocks are not 0")
    opened = m[m["is_open"] == 1]
    below = opened[opened["n"] < opened["min_staff"]]
    if len(below):
        problems.append(f"{len(below)} open blocks below min_staff")
    ruled = apply_readme_rule(m, "n")
    over = ruled[ruled["n"] > ruled["i_capacity"]]
    if len(over):
        problems.append(f"{len(over)} blocks above capacity under the README rule")
    info["open_blocks"] = len(opened)
    info["at_capacity"] = int(((ruled["n"] == ruled["i_capacity"]) & (ruled["is_open"] == 1)).sum())
    info["total_employees"] = int(m["n"].sum())
    # The submission must be the plan in plan_vs_draft.csv.
    p = plan_vs_draft()
    p_key = p[KEY].astype(str).apply(tuple, axis=1)
    rec = dict(zip(p_key, p["recommended"]))
    mismatch = sum(int(rec[k]) != v for k, v in zip(joined[KEY].apply(tuple, axis=1), joined["n"]))
    info["differs_from_plan_vs_draft"] = mismatch
    if mismatch:
        problems.append(f"{mismatch} rows differ from plan_vs_draft.csv recommended")
    only_placeholder = problems == ["team_id is still the placeholder TEAM_NAME"]
    return only_placeholder, problems, info


# ---------------------------------------------------------------- V-05, data part


def v05_multipliers() -> tuple[bool, dict]:
    """Scenario demand / BASE demand equals the grid's demand_multiplier in every open block."""
    p = plan_vs_draft()
    g = grid()
    block = ["store_id", "dept_id", "day_date", "shift_code"]
    open_p = p[p["is_open"] == 1]
    base = open_p[open_p["scenario_code"] == "BASE"].set_index(block)["demand"]
    info, ok = {}, True
    for scen in ("BASE", "PEAK", "DISRUPT"):
        part = open_p[open_p["scenario_code"] == scen].set_index(block)
        mult = g[(g["scenario_code"] == scen)].set_index(block)["demand_multiplier"].reindex(part.index)
        ratio = part["demand"] / base.reindex(part.index)
        worst = float((ratio - mult).abs().max())
        info[scen] = {"blocks": int(len(part)), "max_abs_gap": worst, "multipliers": sorted(set(mult.round(4)))}
        ok &= worst < 1e-9 and len(part) == len(base)
    return ok, info


def v05_feb17() -> tuple[bool, dict]:
    """Feb 17 carries the rebound flag but is forecast as a normal Tuesday (F-41)."""
    g = grid()
    day = g[g["day_date"] == "2026-02-17"].iloc[0]
    sql = (ROOT / "data" / "team_distribution" / "sql" / "02_Load_Core_Data.sql").read_text(encoding="utf-8", errors="replace")
    factor_case = sql[sql.index("AS bw(base_daily_weight)"): sql.index("AS hf(holiday_adjustment_factor)")]
    jan20_flagged = "c.day_date = '2026-01-20' THEN 1 ELSE 0 END AS is_post_holiday_rebound" in sql
    hist = read(CSV / "v_ShiftHistory.csv", dtype={"day_date": str})
    jan20_role = hist.loc[hist["day_date"] == "2026-01-20", "holiday_window_role"].unique().tolist()
    fd = read(OUT / "forecast_daily.csv", dtype={"day_date": str})
    f17 = fd[fd["day_date"] == "2026-02-17"]
    p = plan_vs_draft()
    sd17 = p[p["day_date"] == "2026-02-17"].groupby("dept_id")["demand_sd"].unique()
    sd18 = p[p["day_date"] == "2026-02-18"].groupby("dept_id")["demand_sd"].unique()
    rebound_extra = summary()["kpi"]["rebound_extra"]
    info = {
        "grid_role": day["holiday_window_role"],
        "grid_rebound_flag": int(day["is_post_holiday_rebound"]),
        "history_generator_uses_rebound_flag_for_demand": "is_post_holiday_rebound" in factor_case,
        "jan20_flagged_in_sql": jan20_flagged,
        "jan20_history_role": jan20_role,
        "forecast_window": sorted(f17["window"].unique()),
        "valentine_uplift": float(f17["valentine_uplift"].abs().max()),
        "demand_sd_same_as_feb18": all(set(sd17[d]) == set(sd18[d]) for d in sd17.index),
        "jan20_vs_own_week": rebound_extra,
    }
    ok = (
        info["grid_role"] == "Normal" and info["grid_rebound_flag"] == 1 and not info["history_generator_uses_rebound_flag_for_demand"]
        and jan20_flagged and jan20_role == ["Normal"] and info["forecast_window"] == ["normal"]
        and info["valentine_uplift"] == 0 and info["demand_sd_same_as_feb18"] and round(rebound_extra * 100, 1) == 0.1
    )
    return ok, info


def v05_promotions() -> tuple[bool, dict]:
    """F-61: promotions sit exactly on Fri-Sun, MLK Monday and New Year's Day in history, and on Feb 13-16 in planning."""
    hist = read(CSV / "v_ShiftHistory.csv", dtype={"day_date": str}).drop_duplicates("day_date")
    expected = hist["day_name"].isin(["Friday", "Saturday", "Sunday"]) | hist["holiday_window_role"].isin(["MLK_Holiday", "Closed_Holiday"])
    g = grid().drop_duplicates("day_date")
    planning_promo = sorted(g.loc[g["has_promotion"] == 1, "day_date"])
    info = {
        "history_days": int(len(hist)),
        "history_days_matching_rule": int((expected.astype(int) == hist["has_promotion"]).sum()),
        "history_promo_days": int(hist["has_promotion"].sum()),
        "planning_promo_days": planning_promo,
    }
    ok = info["history_days_matching_rule"] == info["history_days"] and planning_promo == ["2026-02-13", "2026-02-14", "2026-02-15", "2026-02-16"]
    return ok, info


def v05_valentine() -> tuple[bool, dict]:
    """F-52's quoted figures equal analysis_summary.json's valentine_sensitivity."""
    text = (ROOT / "planning" / "FINDINGS.md").read_text(encoding="utf-8")
    line = next(l for l in text.splitlines() if l.startswith("- **F-52"))
    pcts = [float(x) for x in re.findall(r"(\d+\.\d)%", line)]
    dollars = [float(x.replace(",", "")) for x in re.findall(r"\$([\d,]+)", line)]
    rows = summary()["valentine_sensitivity"]
    ours = [round(r["our_plan_expected_met"] * 100, 1) for r in rows]
    replanned = [round(r["replanned_expected_met"] * 100, 1) for r in rows]
    cost = [round(r["replanned_feb14_cost"]) for r in rows]
    shortfall = summary()["base_shortfall"]
    at_cap = (shortfall["feb14_front_merch_at_capacity"], shortfall["feb14_front_merch_blocks"])
    info = {"F-52 %": pcts, "json our plan": ours, "json replanned": replanned, "F-52 $": dollars, "json cost": cost, "at capacity": at_cap}
    ok = pcts == ours + replanned and dollars == cost and f"{at_cap[0]} of those {at_cap[1]}" in line
    return ok, info


# ---------------------------------------------------------------- V-08


def v08_costs() -> tuple[bool, dict]:
    """Plan and draft costs from the README's rule, against plan_vs_draft.csv and analysis_summary.json."""
    g = grid()
    p = plan_vs_draft()
    info, ok = {}, True
    # The grid's loaded rates must be the ones in comp_LaborCostAssumption.
    r = rates()
    gr = g.merge(r, on=["store_id", "dept_id"], suffixes=("", "_comp"), validate="many_to_one")
    rate_gap = float(max((gr["loaded_regular_hourly_cost"] - gr["loaded_regular_hourly_cost_comp"]).abs().max(),
                         (gr["loaded_overtime_hourly_cost"] - gr["loaded_overtime_hourly_cost_comp"]).abs().max()))
    info["grid_vs_comp_rate_gap"] = rate_gap
    ok &= rate_gap == 0
    facts = ["available_regular_employees", "max_overtime_employees", "cross_trained_flex_employees", "paid_hours", "is_open", "scenario_code"]
    frame = g[KEY + facts + ["draft_scheduled_employees"]].merge(p[KEY + ["recommended"]], on=KEY, validate="one_to_one")
    plan = apply_readme_rule(frame, "recommended")
    draft = apply_readme_rule(frame, "draft_scheduled_employees")
    pk = p.set_index(KEY)
    plan = plan.set_index(KEY).loc[pk.index]
    draft = draft.set_index(KEY).loc[pk.index]
    checks = {
        "plan cost per block": (plan["i_cost"] - pk["cost"]).abs().max(),
        "draft cost per block": (draft["i_cost"] - pk["cost_draft"]).abs().max(),
        "plan usable flex": (plan["i_usable_flex"] - pk["usable_flex"]).abs().max(),
        "plan capacity": (plan["i_capacity"] - pk["capacity"]).abs().max(),
        "plan fills": max((plan["i_fill_regular"] - pk["fill_regular"]).abs().max(), (plan["i_fill_flex"] - pk["fill_flex"]).abs().max(),
                          (plan["i_fill_overtime"] - pk["fill_overtime"]).abs().max()),
        "draft unfilled": (draft["i_unfilled"] - pk["unfilled"]).abs().max(),
    }
    info["max_abs_gap"] = {k: float(v) for k, v in checks.items()}
    ok &= checks["plan cost per block"] < 0.005 and checks["draft cost per block"] < 0.005
    ok &= all(checks[k] == 0 for k in ("plan usable flex", "plan capacity", "plan fills", "draft unfilled"))
    s = summary()
    per_scenario = {}
    for name, frame_, key in (("plan", plan, "plan_summary"), ("draft", draft, "draft_summary")):
        # Every block cost is a multiple of $0.005, and the JSON keeps 3 decimals, so compare exactly to the half cent.
        mine = frame_[frame_["is_open"] == 1].groupby("scenario_code")["i_cost"].sum().round(3)
        theirs = {row["scenario_code"]: row["cost"] for row in s[key]}
        per_scenario[name] = {sc: (float(mine[sc]), theirs[sc]) for sc in ("BASE", "PEAK", "DISRUPT")}
        ok &= all(abs(a - b) < 0.0005 for a, b in per_scenario[name].values())
    info["by_scenario (independent, json)"] = per_scenario
    by_dept_gap = 0.0
    for row in s["plan_by_dept"]:
        sel_p = plan[(plan["scenario_code"] == row["scenario_code"]) & (plan.index.get_level_values("dept_id") == row["dept_id"])]
        sel_d = draft[(draft["scenario_code"] == row["scenario_code"]) & (draft.index.get_level_values("dept_id") == row["dept_id"])]
        by_dept_gap = max(by_dept_gap, abs(sel_p["i_cost"].sum() - row["cost"]), abs(sel_d["i_cost"].sum() - row["cost_draft"]))
    info["plan_by_dept_max_gap"] = float(by_dept_gap)
    ok &= by_dept_gap < 0.0005
    # F-48's rounded table.
    text = (ROOT / "planning" / "FINDINGS.md").read_text(encoding="utf-8")
    f48 = {}
    for label in ("Draft cost", "Plan cost"):
        line = next(l for l in text.splitlines() if l.strip().startswith(f"| {label} |"))
        f48[label] = [float(x.replace(",", "")) for x in re.findall(r"\$([\d,]+)", line)]
    mine48 = {"Draft cost": [round(per_scenario["draft"][sc][0]) for sc in ("BASE", "PEAK", "DISRUPT")],
              "Plan cost": [round(per_scenario["plan"][sc][0]) for sc in ("BASE", "PEAK", "DISRUPT")]}
    info["F-48 (doc, independent)"] = {k: (f48[k], mine48[k]) for k in f48}
    ok &= all(f48[k] == mine48[k] for k in f48)
    # The README doesn't say how staff above capacity are costed. The engine leaves them out.
    rr = {(int(a.store_id), int(a.dept_id)): a.loaded_overtime_hourly_cost for a in r.itertuples()}
    unfilled = draft[draft["i_unfilled"] > 0]
    extra = sum(u * h * rr[(int(st), int(d))] for u, h, st, d in zip(
        unfilled["i_unfilled"], unfilled["paid_hours"], unfilled.index.get_level_values("store_id"), unfilled.index.get_level_values("dept_id")))
    info["draft_unfilled"] = {"blocks": int(len(unfilled)), "people": int(unfilled["i_unfilled"].sum()), "cost_if_paid_at_overtime": round(float(extra), 2)}
    return bool(ok), info
