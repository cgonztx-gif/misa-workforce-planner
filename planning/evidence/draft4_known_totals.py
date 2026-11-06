"""Known totals for draft 4 (dashboard-design skill, qa.md "Known totals"; planning/DRAFT4.md sections 1, 5.12 and 9).

Works out the answers the draft 4 page must show OUTSIDE the dashboard's code, so the browser QA can compare the
rendered page with them. It reads only files in outputs/ with pandas: plan_vs_draft.csv (one row per block, plan and
draft), TEAM_SUBMISSION_TEMPLATE_filled.csv (the hand-in), analysis_summary.json (the goal and a cross-check), plus
explanations.csv for each below-goal block's need ("It needs N people ...") and capacity_gaps.csv to cross-check
those needs. It imports nothing from src/, server/ or web/ and never calls the API.

All data is simulated for the Texas MISA case competition. It is not Costco data.

Run from anywhere:
    python planning/evidence/draft4_known_totals.py
It writes planning/evidence/draft4_known_totals.output.json and prints a short summary.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "outputs"
RESULT = Path(__file__).with_name("draft4_known_totals.output.json")

SCENARIOS = ["BASE", "PEAK", "DISRUPT"]
VIEWS = ["all", "1", "2", "4"]
DEPTS = {38: "Front End", 92: "Merchandising", 95: "Pharmacy"}
SHIFTS = ["OPEN", "MID", "EVE"]  # board row order inside a department
SHIFT_SHORT = {"OPEN": "Open", "MID": "Mid", "EVE": "Eve"}
SHIFT_NAME = {"OPEN": "Opening", "MID": "Midday", "EVE": "Evening"}
API_DECIMALS = 6  # server/serialize.py rounds every float in a JSON answer to 6 places
TOLERANCE = 0.0005  # DRAFT4.md P1: the server flags chance < goal - 0.0005
MINUS = "−"
KEYS = ["scenario_code", "store_id", "dept_id", "day_date", "shift_code"]


# ---------------------------------------------------------------- formats (DRAFT4.md 5.12, with JS rounding)

def js_round(x: float) -> int:
    """JavaScript Math.round: halves go up (toward +infinity), unlike Python's round()."""
    return math.floor(x + 0.5)


def signed(n: int | float, suffix: str = "") -> str:
    """+5 / -1 (U+2212) / ±0. Zero (including a rounded -0) prints ±0."""
    if n == 0:
        return f"±0{suffix}"
    body = f"{abs(n):,}" if isinstance(n, int) else f"{abs(n)}"
    return f"{'+' if n > 0 else MINUS}{body}{suffix}"


def int_text(n: int) -> str:
    return f"{int(n):,}"


def chance_text(c: float | None, below: bool, goal: float) -> str:
    """chanceText: one decimal via Math.round(c*1000 + 1e-6)/10; null -> '—'; 0<c<0.001 -> '<0.1%'; 0 -> '0%'.
    Guard: a below-goal chance whose text would reach the goal's percent is floored to one decimal instead."""
    if c is None or (isinstance(c, float) and math.isnan(c)):
        return "—"
    if c == 0:
        return "0%"
    if 0 < c < 0.001:
        return "<0.1%"
    tenths = js_round(c * 1000 + 1e-6)
    if below and tenths / 10 >= goal * 100:
        tenths = math.floor(c * 1000)
    return f"{tenths / 10:.1f}%"


def pct2_text(c: float) -> str:
    """Two decimals, as the Service tooltip prints the exact value (95.56%)."""
    return f"{js_round(c * 10000) / 100:.2f}%"


def pts_text(change: float) -> str:
    """change.expected_met x 100 in points, one decimal, always signed."""
    tenths = js_round(change * 1000)
    if tenths == 0:
        return "±0.0 pts"
    return f"{'+' if tenths > 0 else MINUS}{abs(tenths) / 10:.1f} pts"


def usd_exact(x: float) -> str:
    v = js_round(x)
    return f"{MINUS if v < 0 else ''}${abs(v):,}"


def usd_signed(x: float) -> str:
    v = js_round(x)
    if v == 0:
        return "±$0"
    return f"{'+' if v > 0 else MINUS}${abs(v):,}"


def usd_compact(x: float) -> str:
    """Tiles: $377.5k (one decimal of thousands). Spec examples always keep the decimal on tiles."""
    tenths = js_round(x / 100)
    if abs(tenths) >= 10000:  # a million or more
        return f"${js_round(x / 100000) / 10:.1f}M"
    return f"${tenths / 10:.1f}k"


def hours_text(h: float) -> str:
    return f"{js_round(h):,} h"


def hours_exact(h: float) -> str:
    return f"{h:,.1f} h".replace(".0 h", " h")


def share_pct(part: float, whole: float) -> str:
    return f"{js_round(part / whole * 100)}%" if whole else "—"


def ratio_delta(change: float, draft: float, is_count: bool = True) -> tuple[str, str]:
    """Tile delta for People and Labor cost: whole % of the draft, or grey 'was N' under a draft base of 5."""
    if draft < 5:
        return f"was {int_text(js_round(draft))}", "grey"
    pct = js_round(change / draft * 100)
    return signed(pct, "%"), "grey"


# ---------------------------------------------------------------- data

def load() -> tuple[pd.DataFrame, pd.DataFrame, dict, pd.DataFrame, pd.DataFrame]:
    plan = pd.read_csv(OUT / "plan_vs_draft.csv")
    sub = pd.read_csv(OUT / "TEAM_SUBMISSION_TEMPLATE_filled.csv")
    summary = json.loads((OUT / "analysis_summary.json").read_text(encoding="utf-8"))
    expl = pd.read_csv(OUT / "explanations.csv")
    gaps = pd.read_csv(OUT / "capacity_gaps.csv")
    return plan, sub, summary, expl, gaps


def day_short(iso: str) -> str:
    d = pd.Timestamp(iso)
    return f"{d:%a} {d.day}"


def day_long(iso: str) -> str:
    d = pd.Timestamp(iso)
    return f"{d:%a %b} {d.day}"


def key_of(r) -> str:
    return f"{r.scenario_code}|{int(r.store_id)}|{int(r.dept_id)}|{r.day_date}|{r.shift_code}"


def prepare(plan: pd.DataFrame, expl: pd.DataFrame, goal: float) -> tuple[pd.DataFrame, list[str]]:
    notes = []
    df = plan.copy()
    df["key"] = [key_of(r) for r in df.itertuples()]
    df["open"] = df["is_open"] == 1
    df["change"] = df["recommended"] - df["draft_scheduled_employees"]
    df["cost_change"] = df["cost"] - df["cost_draft"]
    # The plan's below-goal flag is in the CSV; check it against the server's rule as DRAFT4.md states it.
    rule = df["open"] & (df["chance_met"] < goal - TOLERANCE)
    mismatch = int((rule != df["below_service_goal"].astype(bool)).sum())
    notes.append(
        f"Plan below goal: taken from plan_vs_draft.csv below_service_goal; it agrees with the rule "
        f"chance_met < goal - {TOLERANCE} on {len(df) - mismatch} of {len(df)} rows ({mismatch} mismatches)."
    )
    df["below"] = df["below_service_goal"].astype(bool)
    # The API rounds every float to API_DECIMALS places when it serializes (server/serialize.py DECIMALS = 6), and the
    # page reads the API. So the page sees e.g. 3.3e-10 as exactly 0. Chance text, tiers, the list order and the P2 pick
    # use that rounded chance; below_goal stays the server's full-precision flag.
    df["chance"] = [round(float(c), API_DECIMALS) if pd.notna(c) else float("nan") for c in df["chance_met"]]
    notes.append(
        f"Per-block chance for text, tiers, list order and the P2 pick is chance_met rounded to {API_DECIMALS} places, "
        "as the API serializes it (the page reads the API). below_goal stays the full-precision flag."
    )
    # The draft has no flag in the CSV, so reproduce the server's rule (DRAFT4.md P1: chance < goal - 0.0005).
    df["below_draft"] = df["open"] & (df["chance_met_draft"] < goal - TOLERANCE)
    notes.append(
        "Draft below goal: the CSV has no flag, so it is reproduced with the server's rule as DRAFT4.md states it: "
        f"open and chance_met_draft < goal - {TOLERANCE}."
    )
    # plan_vs_draft.csv 'unfilled' comes from the draft frame (merged without a suffix), so it is the draft's unfilled.
    df["draft_unfilled"] = df["unfilled"]
    df["plan_unfilled"] = (df["recommended"] - df["capacity"]).clip(lower=0)
    df["plan_fielded"] = df["recommended"] - df["plan_unfilled"]
    df["draft_fielded"] = df["draft_scheduled_employees"] - df["draft_unfilled"]
    df["hours"] = df["plan_fielded"] * df["paid_hours"]
    df["hours_draft"] = df["draft_fielded"] * df["paid_hours"]
    df["ot_hours"] = df["fill_overtime"] * df["paid_hours"]
    df["at_capacity"] = df["open"] & (df["recommended"] >= df["capacity"])
    # need: only below-goal blocks need it (short = need - plan, the P2 tie-break). explanations.csv states it.
    ex = expl.copy()
    ex["need_text"] = ex["why"].str.extract(r"It needs (\d+) people", expand=False)
    df = df.merge(ex[KEYS + ["need_text"]], on=KEYS, how="left", validate="one_to_one")
    df["need"] = pd.to_numeric(df["need_text"], errors="coerce")
    missing = int((df["below"] & df["need"].isna()).sum())
    notes.append(
        "need (for Short and the P2 tie-break) is parsed from outputs/explanations.csv 'why' ('It needs N people ...'), "
        f"which the pipeline writes for every below-goal block; missing for {missing} below-goal blocks."
    )
    df["short"] = (df["need"] - df["recommended"]).where(df["below"])
    return df, notes


def check_needs(df: pd.DataFrame, gaps: pd.DataFrame) -> dict:
    """capacity_gaps.csv sums (need - plan) over below-goal blocks per scenario, day and department."""
    b = df[df["below"]]
    mine = b.groupby(["scenario_code", "day_date", "dept_id"])["short"].sum().astype(int)
    theirs = gaps.set_index(["scenario_code", "day_date", "dept_id"])["gap_people"]
    joined = pd.concat([mine.rename("mine"), theirs.rename("capacity_gaps")], axis=1).fillna(0)
    bad = joined[joined["mine"] != joined["capacity_gaps"]]
    return {"groups": int(len(joined)), "mismatches": int(len(bad)), "detail": bad.reset_index().to_dict("records")}


# ---------------------------------------------------------------- per view

def summarize(rows: pd.DataFrame) -> dict:
    o = rows[rows["open"]]
    n = len(o)
    plan = {
        "blocks": n,
        "employees": int(o["recommended"].sum()),
        "hours": float(o["hours"].sum()),
        "overtime_hours": float(o["ot_hours"].sum()),
        "cost": float(o["cost"].sum()),
        "expected_met": float(o["chance_met"].mean()) if n else None,
        "lowest_chance": float(o["chance_met"].min()) if n else None,
        "below_goal": int(o["below"].sum()),
        "over_capacity": int((o["plan_unfilled"] > 0).sum()),
        "unfilled": int(o["plan_unfilled"].sum()),
    }
    draft = {
        "blocks": n,
        "employees": int(o["draft_scheduled_employees"].sum()),
        "hours": float(o["hours_draft"].sum()),
        "cost": float(o["cost_draft"].sum()),
        "expected_met": float(o["chance_met_draft"].mean()) if n else None,
        "lowest_chance": float(o["chance_met_draft"].min()) if n else None,
        "below_goal": int(o["below_draft"].sum()),
        "over_capacity": int((o["draft_unfilled"] > 0).sum()),
        "unfilled": int(o["draft_unfilled"].sum()),
    }
    change = {k: (plan[k] - draft[k]) if plan.get(k) is not None and draft.get(k) is not None else None
              for k in ["employees", "hours", "cost", "expected_met", "below_goal", "over_capacity", "unfilled"]}
    return {"plan": plan, "draft": draft, "change": change}


def tiles(t: dict, goal: float) -> dict:
    p, d, c = t["plan"], t["draft"], t["change"]
    service_colour = "up" if c["expected_met"] > 0 else ("down" if c["expected_met"] < 0 else "grey")
    if d["below_goal"] < 5:
        below_delta, below_colour = f"was {d['below_goal']}", "grey"
    else:
        below_delta = signed(int(c["below_goal"]))
        below_colour = "up" if c["below_goal"] < 0 else ("grey" if c["below_goal"] == 0 else "down")
    people_delta, people_colour = ratio_delta(c["employees"], d["employees"])
    cost_delta, cost_colour = ratio_delta(c["cost"], d["cost"])
    return {
        "service": {
            "value": p["expected_met"], "draft": d["expected_met"], "delta": c["expected_met"] * 100,
            "value_text": chance_text(p["expected_met"], False, goal), "draft_text": f"Draft {chance_text(d['expected_met'], False, goal)}",
            "delta_text": pts_text(c["expected_met"]), "delta_colour": service_colour,
            "tooltip_exact": f"{pct2_text(p['expected_met'])} · Draft {pct2_text(d['expected_met'])}",
            "lowest_block_text": chance_text(p["lowest_chance"], p["lowest_chance"] < goal - TOLERANCE, goal),
        },
        "below": {
            "value": p["below_goal"], "draft": d["below_goal"], "delta": c["below_goal"],
            "value_text": int_text(p["below_goal"]), "draft_text": f"Draft {int_text(d['below_goal'])}",
            "delta_text": below_delta, "delta_colour": below_colour,
            "tooltip_exact": f"{p['below_goal']} of {p['blocks']} · Draft {d['below_goal']}",
        },
        "people": {
            "value": p["employees"], "draft": d["employees"], "delta": c["employees"],
            "delta_ratio": c["employees"] / d["employees"] if d["employees"] else None,
            "value_text": int_text(p["employees"]), "draft_text": f"Draft {int_text(d['employees'])}",
            "delta_text": people_delta, "delta_colour": people_colour,
            "tooltip_hours": hours_exact(p["hours"]), "tooltip_overtime": hours_exact(p["overtime_hours"]),
            "over_capacity": p["over_capacity"], "unfilled": p["unfilled"],
        },
        "cost": {
            "value": p["cost"], "draft": d["cost"], "delta": c["cost"],
            "delta_ratio": c["cost"] / d["cost"] if d["cost"] else None,
            "value_text": usd_compact(p["cost"]), "value_exact": usd_exact(p["cost"]),
            "draft_text": f"Draft {usd_compact(d['cost'])}", "draft_exact": usd_exact(d["cost"]),
            "delta_text": cost_delta, "delta_colour": cost_colour, "delta_exact": usd_signed(c["cost"]),
        },
    }


def service_tier(chance: float, below: bool, open_: bool) -> str:
    """Board fill order (DRAFT4.md 5.6): closed, W2 (below and < 0.80), W1 (below), then >=0.99 / >=0.97 / rest."""
    if not open_:
        return "closed"
    if below and chance < 0.80:
        return "w2"
    if below:
        return "w1"
    if chance >= 0.99:
        return "t99"
    if chance >= 0.97:
        return "t97"
    return "t95"


def people_tier(change: float) -> str:
    if change < 0:
        return "cut"
    if change == 0:
        return "same"
    if change <= 2:
        return "+1"
    if change <= 5:
        return "+3"
    return "+6"


def cost_tier(cost_change: float) -> str:
    if cost_change <= 0:
        return "same"
    if cost_change < 300:
        return "+$1"
    if cost_change < 800:
        return "+$300"
    return "+$800"


def worst(rows: pd.DataFrame) -> pd.Series | None:
    """P2: lowest chance among P1, then largest need - plan, then key ascending."""
    b = rows[rows["open"] & rows["below"]]
    if b.empty:
        return None
    return b.sort_values(["chance", "short", "key"], ascending=[True, False, True], kind="mergesort").iloc[0]


def list_order(rows: pd.DataFrame) -> pd.DataFrame:
    b = rows[rows["open"] & rows["below"]]
    return b.sort_values(["chance", "short", "key"], ascending=[True, False, True], kind="mergesort")


def block_name(r, with_chip: bool) -> str:
    name = f"{day_short(r.day_date)} · {DEPTS[int(r.dept_id)]} · {SHIFT_SHORT[r.shift_code]}"
    return name + (f" · W{int(r.store_id)}" if with_chip else "")


def block_cell(r, goal: float) -> dict:
    open_ = bool(r.open)
    chance = float(r.chance) if open_ else None
    return {
        "key": r.key, "store_id": int(r.store_id), "dept_id": int(r.dept_id), "department": DEPTS[int(r.dept_id)],
        "date": r.day_date, "shift_code": r.shift_code, "is_open": open_,
        "plan": int(r.recommended), "draft": int(r.draft_scheduled_employees), "change": int(r.change),
        "change_text": "" if r.change == 0 else signed(int(r.change)),
        "chance": chance, "chance_text": chance_text(chance, bool(r.below), goal) if open_ else "—",
        "below": bool(r.below), "need": None if pd.isna(r.need) else int(r.need),
        "short": None if pd.isna(r.short) else int(r.short),
        "tier_service": service_tier(chance, bool(r.below), open_),
        "tier_people": None if not open_ else people_tier(int(r.change)),
        "tier_cost": None if not open_ else cost_tier(float(r.cost_change)),
        "p3_draft_unfilled": int(r.draft_unfilled) if open_ else 0,
        "cost": float(r.cost), "cost_text": usd_exact(r.cost), "cost_change_text": usd_signed(r.cost_change),
        "display_number": str(int(r.recommended)) if open_ else "—",
    }


def board_grid(rows: pd.DataFrame, goal: float, aggregate: bool) -> list[dict]:
    """63 cells in board order: departments, then shifts Open/Mid/Eve, then days Thu..Wed."""
    cells = []
    for dept in DEPTS:
        for shift in SHIFTS:
            for day in sorted(rows["day_date"].unique()):
                part = rows[(rows["dept_id"] == dept) & (rows["shift_code"] == shift) & (rows["day_date"] == day)]
                if not aggregate:
                    assert len(part) == 1
                    cells.append(block_cell(part.iloc[0], goal))
                    continue
                o = part[part["open"]]
                open_ = len(o) > 0
                below = o[o["below"]]
                lowest = float(o["chance"].min()) if open_ else None
                any_w2 = bool((below["chance"] < 0.80).any())
                if not open_:
                    tier = "closed"
                elif len(below) and any_w2:
                    tier = "w2"
                elif len(below):
                    tier = "w1"
                else:
                    tier = service_tier(lowest, False, True)
                n_open = len(o)
                mean_change = float(o["change"].mean()) if open_ else None
                mean_cost_change = float(o["cost_change"].mean()) if open_ else None
                cells.append({
                    "key": f"all|{dept}|{day}|{shift}", "dept_id": dept, "department": DEPTS[dept], "date": day,
                    "shift_code": shift, "is_open": open_,
                    "plan": int(part["recommended"].sum()), "draft": int(part["draft_scheduled_employees"].sum()),
                    "change": int(part["change"].sum()), "cost_change": float(part["cost_change"].sum()),
                    "change_text": "" if part["change"].sum() == 0 else signed(int(part["change"].sum())),
                    "display_number": str(int(part["recommended"].sum())) if open_ else "—",
                    "lowest_chance": lowest,
                    "lowest_chance_text": chance_text(lowest, bool(len(below)), goal) if open_ else "—",
                    "below_count_pips": int(len(below)), "warm": bool(len(below)), "tier_service": tier,
                    "mean_change": mean_change, "mean_cost_change": mean_cost_change,
                    # Sweep (2026-11-05): an All cell's People / Labor cost colour follows the figure it shows, the
                    # 3 warehouses' sum, on the same steps as one block; below goal is a red outline, not a fill.
                    "tier_people": None if not open_ else people_tier(int(part["change"].sum())),
                    "tier_cost": None if not open_ else cost_tier(float(part["cost_change"].sum())),
                    "p3_draft_unfilled": int(o["draft_unfilled"].sum()),
                    "warehouses": [
                        {"store_id": int(r.store_id), "plan": int(r.recommended), "draft": int(r.draft_scheduled_employees),
                         "change": int(r.change), "chance_text": chance_text(float(r.chance), bool(r.below), goal),
                         "below": bool(r.below)}
                        for r in o.sort_values("store_id").itertuples()
                    ],
                    "open_blocks": n_open,
                })
    return cells


def people_tier_mean(mean_change: float) -> str:
    """People lens in All: the mean change per open block on the single-warehouse thresholds (DRAFT4.md 3).
    The thresholds are written for integers; a fractional mean is placed with < 0 cut, == 0 same, (0,2] +1, (2,5] +3, > 5 +6."""
    return people_tier(mean_change)


def by_day(rows: pd.DataFrame) -> list[dict]:
    out = []
    for day in sorted(rows["day_date"].unique()):
        t = summarize(rows[rows["day_date"] == day])
        out.append({
            "date": day, "day_short": day_short(day),
            "plan": {k: t["plan"][k] for k in ("employees", "below_goal", "expected_met", "cost")},
            "draft": {k: t["draft"][k] for k in ("employees", "below_goal", "expected_met", "cost")},
            "board_day_total": int(rows[rows["day_date"] == day]["recommended"].sum()),
        })
    return out


def day_titles(days: list[dict], goal: float) -> dict:
    lo = min(days, key=lambda d: d["plan"]["expected_met"])
    hi = max(days, key=lambda d: d["plan"]["expected_met"])
    wb = max(days, key=lambda d: d["plan"]["below_goal"])
    bp = max(days, key=lambda d: d["plan"]["employees"])
    bc = max(days, key=lambda d: d["plan"]["cost"])
    return {
        "service": f"Lowest day / {lo['day_short']} · {chance_text(lo['plan']['expected_met'], False, goal)}",
        "service_highest": f"{hi['day_short']} {chance_text(hi['plan']['expected_met'], False, goal)}",
        "below": f"Worst day / {wb['day_short']} · {wb['plan']['below_goal']}",
        "people": f"Busiest day / {bp['day_short']} · {int_text(bp['plan']['employees'])}",
        "cost": f"Costliest day / {bc['day_short']} · {usd_compact(bc['plan']['cost'])}",
        "ties": {
            "service_lowest": [d["day_short"] for d in days if d["plan"]["expected_met"] == lo["plan"]["expected_met"]],
            "below_worst": [d["day_short"] for d in days if d["plan"]["below_goal"] == wb["plan"]["below_goal"]],
            "people_busiest": [d["day_short"] for d in days if d["plan"]["employees"] == bp["plan"]["employees"]],
        },
    }


def view_result(rows: pd.DataFrame, goal: float, wk: str) -> dict:
    t = summarize(rows)
    aggregate = wk == "all"
    open_rows = rows[rows["open"]]
    lst = list_order(rows)
    w = worst(rows)
    p3 = open_rows[open_rows["draft_unfilled"] > 0]
    days = by_day(rows)
    grid = board_grid(rows, goal, aggregate)
    single = [block_cell(r, goal) for r in rows.itertuples()]
    tier_counts = {
        "service": pd.Series([c["tier_service"] for c in single if c["is_open"]]).value_counts().to_dict(),
        "people": pd.Series([c["tier_people"] for c in single if c["is_open"]]).value_counts().to_dict(),
        "cost": pd.Series([c["tier_cost"] for c in single if c["is_open"]]).value_counts().to_dict(),
    }
    depts = []
    for dept, name in DEPTS.items():
        s = summarize(rows[rows["dept_id"] == dept])
        depts.append({"department": name, "employees": s["plan"]["employees"], "employees_text": int_text(s["plan"]["employees"]),
                      "share_text": share_pct(s["plan"]["employees"], t["plan"]["employees"]),
                      "cost": s["plan"]["cost"], "cost_text": usd_compact(s["plan"]["cost"]), "below_goal": s["plan"]["below_goal"]})
    largest = open_rows.assign(size=open_rows["change"].abs()).sort_values(
        ["size", "day_date", "dept_id"], ascending=[False, True, True], kind="mergesort")
    top = largest.iloc[0]
    tied_top = largest[(largest["size"] == top["size"]) & (largest["day_date"] == top["day_date"]) & (largest["dept_id"] == top["dept_id"])]
    res = {
        "tiles": tiles(t, goal),
        "totals": t,
        "board_sum": int(rows["recommended"].sum()),
        "board_cells": 63,
        "board_day_totals": [d["board_day_total"] for d in days],
        "board_day_totals_text": " · ".join(int_text(d["board_day_total"]) for d in days),
        "by_day": days,
        "by_day_titles": day_titles(days, goal),
        "service_tier_counts_single_blocks": tier_counts["service"],
        "people_tier_counts_single_blocks": tier_counts["people"],
        "cost_tier_counts_single_blocks": tier_counts["cost"],
        "warm_cells": sum(1 for c in grid if c["tier_service"] in ("w1", "w2")),
        "below_goal_list": [
            {"rank": i + 1, "key": r.key, "name": block_name(r, aggregate), "chance": float(r.chance),
             "chance_text": chance_text(float(r.chance), True, goal), "short": int(r.short),
             "is_worst": bool(w is not None and r.key == w["key"])}
            for i, r in enumerate(lst.itertuples())
        ],
        "below_goal_footnote": f"{min(8, len(lst))} of {len(lst)}" if len(lst) else None,
        "worst_block": None if w is None else {
            "key": w["key"], "name": block_name(w, True), "chance": float(w["chance"]),
            "chance_text": chance_text(float(w["chance"]), True, goal), "plan": int(w["recommended"]),
            "need": int(w["need"]), "short": int(w["short"]),
            "all_cell_key": f"all|{int(w['dept_id'])}|{w['day_date']}|{w['shift_code']}",
            "tied_on_chance": [r.key for r in lst[lst["chance"] == w["chance"]].itertuples()],
            "tied_on_chance_and_short": [r.key for r in lst[(lst["chance"] == w["chance"]) & (lst["short"] == w["short"])].itertuples()],
        },
        "worst_block_at_csv_precision": None if w is None else (lambda b: {
            "key": b.iloc[0]["key"], "chance_met": float(b.iloc[0]["chance_met"]), "short": int(b.iloc[0]["short"]),
            "same_as_api_precision": bool(b.iloc[0]["key"] == w["key"]),
        })(rows[rows["open"] & rows["below"]].sort_values(["chance_met", "short", "key"], ascending=[True, False, True], kind="mergesort")),
        "total_short_p1": int(lst["short"].sum()) if len(lst) else 0,
        "p1_all_at_capacity": bool(lst["at_capacity"].all()) if len(lst) else None,
        "p1b_far_below": int((lst["chance"] < 0.80).sum()),
        "p3_draft_over_capacity": {
            "blocks": int(len(p3)), "people": int(p3["draft_unfilled"].sum()),
            "keys": p3["key"].tolist(),
            "draft_gt_capacity_blocks_wrong_rule": int((open_rows["draft_scheduled_employees"] > open_rows["capacity"]).sum()),
        },
        "closed_blocks": rows[~rows["open"]]["key"].tolist(),
        "closed_cells": [c["key"] for c in grid if not c["is_open"]],
        "departments": depts,
        "largest_change_top": {
            "key": top["key"], "name": block_name(top, aggregate), "change_text": signed(int(top["change"])),
            "draft_to_plan": f"{int(top['draft_scheduled_employees'])} → {int(top['recommended'])}",
            "rows_tied_on_server_sort_keys": tied_top["key"].tolist(),
        },
        "largest_changes_first10": largest.head(10)["key"].tolist(),
        "change_range": [int(open_rows["change"].min()), int(open_rows["change"].max())],
        "cells": grid,
    }
    if aggregate:
        pips = pd.Series([c["below_count_pips"] for c in grid if c["is_open"]]).value_counts().to_dict()
        res["all_board"] = {
            "warm_cells": res["warm_cells"],
            "pip_histogram": {str(k): int(pips.get(k, 0)) for k in (0, 1, 2, 3)},
            "clean_cells": int(pips.get(0, 0)),
            "worst_cell_key": res["worst_block"]["all_cell_key"] if w is not None else None,
            "range_plan_sum": [min(c["plan"] for c in grid if c["is_open"]), max(c["plan"] for c in grid if c["is_open"])],
        }
    return res


def submission_check(df: pd.DataFrame, sub: pd.DataFrame) -> dict:
    j = df.merge(sub, on=KEYS, how="outer", suffixes=("", "_sub"), indicator=True, validate="one_to_one")
    both = j[j["_merge"] == "both"]
    mism = both[both["recommended"] != both["submitted_employees"]]
    closed_nonzero = both[(both["is_open"] == 0) & (both["submitted_employees"] != 0)]
    return {
        "rows": int(len(sub)), "joined_on": KEYS, "joined_rows": int(len(both)),
        "unmatched_rows": int((j["_merge"] != "both").sum()), "plan_vs_submitted_mismatches": int(len(mism)),
        "closed_nonzero": int(len(closed_nonzero)), "team_id": sorted(sub["team_id"].astype(str).unique().tolist()),
        "submitted_sum_by_scenario": {s: int(sub[sub["scenario_code"] == s]["submitted_employees"].sum()) for s in SCENARIOS},
    }


def summary_check(df: pd.DataFrame, summary: dict, goal: float) -> list[dict]:
    """analysis_summary.json plan_summary / draft_summary (rounded to 3 places) against this script's All totals."""
    out = []
    for kind, src in (("plan", "plan_summary"), ("draft", "draft_summary")):
        for row in summary[src]:
            s = row["scenario_code"]
            t = summarize(df[df["scenario_code"] == s])[kind]
            for k in ("hours", "cost", "expected_met", "below_goal", "over_capacity", "unfilled", "overtime_hours", "lowest_chance"):
                if k not in row or k not in t:
                    continue
                mine = t[k]
                ok = abs(mine - row[k]) <= (0.0005 if k in ("expected_met", "lowest_chance") else 0.01)
                out.append({"scenario": s, "kind": kind, "field": k, "summary_json": row[k], "computed": mine, "agree": bool(ok)})
    return out


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # the summary prints U+2212 and the middle dot on Windows consoles
    except (AttributeError, ValueError):
        pass
    plan, sub, summary, expl, gaps = load()
    goal = float(summary["service_goal"])
    df, notes = prepare(plan, expl, goal)
    result: dict = {
        "about": {
            "what": "Expected answers for the draft 4 page (DRAFT4.md sections 1, 5.12, 9), computed outside the app's code.",
            "data_note": "All data is simulated for the Texas MISA case competition. It is not Costco data.",
            "sources": ["outputs/plan_vs_draft.csv", "outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv", "outputs/analysis_summary.json",
                        "outputs/explanations.csv (need of below-goal blocks)", "outputs/capacity_gaps.csv (cross-check of need)"],
            "goal": goal, "tolerance": TOLERANCE,
            "rules": {
                "service": "mean chance_met over open blocks (plan), mean chance_met_draft (draft); delta (plan - draft) x 100 in points",
                "below_goal": "plan: CSV below_service_goal; draft: reproduced as open and chance_met_draft < goal - 0.0005",
                "people": "sum of recommended (plan) / draft_scheduled_employees (draft) over open blocks; delta % = change / draft, Math.round",
                "cost": "sum of cost / cost_draft over open blocks; delta % = change / draft, Math.round",
                "p2_worst": "lowest chance among P1, then largest need - plan, then key ascending",
                "list_order": "P1 by chance ascending, need - plan descending, key ascending",
                "p3": "open and draft unfilled > 0 (plan_vs_draft.csv 'unfilled' is the draft's)",
                "all_cell": "number = sum plan over 3 warehouses; tier from lowest chance; warm if any below goal; w2 if any below-goal chance < 0.80; pips = warehouses below goal",
                "formats": "DRAFT4.md 5.12 with JavaScript Math.round semantics; U+2212 for minus; compact money = one decimal of thousands",
            },
            "notes": notes,
        },
        "need_cross_check_vs_capacity_gaps": check_needs(df, gaps),
        "submission_check": submission_check(df, sub),
        "analysis_summary_cross_check": summary_check(df, summary, goal),
        "scenarios": {},
    }
    for s in SCENARIOS:
        rows_s = df[df["scenario_code"] == s]
        views = {}
        for wk in VIEWS:
            rows = rows_s if wk == "all" else rows_s[rows_s["store_id"] == int(wk)]
            views[wk] = view_result(rows, goal, wk)
        result["scenarios"][s] = {"views": views}
    # Edge cases DRAFT4.md section 9 names.
    edges = []
    for key, expect_below, expect_text in (
        ("BASE|1|38|2026-02-14|OPEN", False, "95.0%"),
        ("DISRUPT|1|38|2026-02-14|OPEN", False, "95.0%"),
        ("PEAK|4|38|2026-02-13|OPEN", True, "94.6%"),
    ):
        r = df[df["key"] == key].iloc[0]
        text = chance_text(float(r["chance"]), bool(r["below"]), goal)
        edges.append({
            "key": key, "chance": float(r["chance"]), "below_goal": bool(r["below"]),
            "tier_service": service_tier(float(r["chance"]), bool(r["below"]), True),
            "chance_text": text, "short": None if pd.isna(r["short"]) else int(r["short"]),
            "expected_below": expect_below, "expected_text": expect_text,
            "agree": bool(r["below"]) == expect_below and text == expect_text,
        })
    # Chances within 0.001 of the goal: where rounding or the tolerance could bite.
    near = df[df["open"] & ((df["chance"] - goal).abs() < 0.001)]
    result["edges"] = edges
    result["near_goal_blocks"] = [
        {"key": r.key, "chance": float(r.chance), "below_goal": bool(r.below),
         "chance_text": chance_text(float(r.chance), bool(r.below), goal),
         "guard_fired": bool(r.below and js_round(r.chance * 1000 + 1e-6) / 10 >= goal * 100)}
        for r in near.itertuples()
    ]
    result["format_self_test"] = {
        "0.949875": chance_text(0.949875, False, goal), "0.94595 below": chance_text(0.94595, True, goal),
        "0": chance_text(0.0, True, goal), "0.0004": chance_text(0.0004, True, goal), "0.003": chance_text(0.003, True, goal),
        "None": chance_text(None, False, goal), "guard 0.9496 forced below": chance_text(0.9496, True, goal),
        "pts 0.27098": pts_text(0.27098), "usd_compact 377504.48": usd_compact(377504.48), "signed -110": signed(-110),
        "signed 0": signed(0), "ratio +13%": ratio_delta(320, 2390)[0], "tiny base": ratio_delta(3, 2)[0],
    }
    RESULT.write_text(json.dumps(result, indent=1, ensure_ascii=False), encoding="utf-8")

    # A short summary on stdout.
    for s in SCENARIOS:
        for wk in VIEWS:
            v = result["scenarios"][s]["views"][wk]
            t = v["tiles"]
            wb = v["worst_block"]
            print(f"{s:8} {wk:3} service {t['service']['value_text']} ({t['service']['draft_text']}) {t['service']['delta_text']} | "
                  f"below {t['below']['value_text']} ({t['below']['draft_text']}) {t['below']['delta_text']} | "
                  f"people {t['people']['value_text']} ({t['people']['draft_text']}) {t['people']['delta_text']} | "
                  f"cost {t['cost']['value_text']}={t['cost']['value_exact']} ({t['cost']['draft_text']}) {t['cost']['delta_text']} | "
                  f"warm {v['warm_cells']} | worst {wb['key'] if wb else None} {wb['chance_text'] if wb else ''} short {wb['short'] if wb else ''} | "
                  f"P3 {v['p3_draft_over_capacity']['blocks']}/{v['p3_draft_over_capacity']['people']}")
    print("edges:", [(e["key"], e["chance_text"], e["below_goal"], e["agree"]) for e in edges])
    print("need vs capacity_gaps:", result["need_cross_check_vs_capacity_gaps"]["mismatches"], "mismatches")
    print("submission:", result["submission_check"])
    print("analysis_summary disagreements:", [c for c in result["analysis_summary_cross_check"] if not c["agree"]])
    print("wrote", RESULT)


if __name__ == "__main__":
    main()
