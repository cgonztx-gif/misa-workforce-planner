"""Turns run_scenario() results into the API's plan shape (/api/plan and /api/what-if)."""
from __future__ import annotations

import pandas as pd

from server.content import DEPARTMENTS, HOLIDAYS, SHIFTS, WAREHOUSES, day_label, short_day_label, warehouse_label
from server.serialize import text_or_none
from src.allocation import apply_rule
from src.app_data import verdict_text

GROUPS = ["all", *[str(store) for store in WAREHOUSES]]
TOLERANCE = 0.0005  # The same margin src/ uses when it flags a block below the goal.


def block_key(scenario: str, store: int, dept: int, day: pd.Timestamp, shift: str) -> str:
    return f"{scenario}|{int(store)}|{int(dept)}|{day:%Y-%m-%d}|{shift}"


def draft_frame(explained: pd.DataFrame) -> pd.DataFrame:
    """The draft under the same rule, row for row with `explained`, so its fills and costs can be summed by group."""
    draft = apply_rule(explained, "draft_scheduled_employees")
    draft["chance_met"] = explained["chance_met_draft"].to_numpy()
    draft["planned_utilization"] = explained["planned_utilization_draft"].to_numpy()
    draft["hours"] = draft["fielded"] * draft["paid_hours"]
    return draft


def summary(rows: pd.DataFrame, goal: float, employees: str) -> dict:
    """The figures src.search.summarize() gives, plus counts, for any set of blocks."""
    open_rows = rows[rows["is_open"] == 1]
    chance = open_rows["chance_met"]
    hours = lambda column: float((open_rows[column] * open_rows["paid_hours"]).sum())
    return {
        "blocks": int(len(open_rows)),
        "employees": int(open_rows[employees].sum()),
        "fielded": int(open_rows["fielded"].sum()),
        "hours": float(open_rows["hours"].sum()),
        "regular_hours": hours("fill_regular"),
        "flex_hours": hours("fill_flex"),
        "overtime_hours": hours("fill_overtime"),
        "cost": float(open_rows["cost"].sum()),
        "expected_met": float(chance.mean()) if len(open_rows) else None,
        "lowest_chance": float(chance.min()) if len(open_rows) else None,
        "below_goal": int((chance < goal - TOLERANCE).sum()),
        "over_capacity": int(open_rows["over_capacity"].sum()),
        "unfilled": int(open_rows["unfilled"].sum()),
        "below_min_staff": int(open_rows["below_min_staff"].sum()),
        "avg_utilization": float(open_rows["planned_utilization"].mean()) if len(open_rows) else None,
    }


def difference(plan: dict, other: dict) -> dict:
    keys = ["employees", "hours", "overtime_hours", "flex_hours", "cost", "expected_met", "below_goal", "over_capacity", "unfilled"]
    return {key: (plan[key] - other[key]) if plan[key] is not None and other[key] is not None else None for key in keys}


def compare(plan_rows: pd.DataFrame, draft_rows: pd.DataFrame, goal: float) -> dict:
    plan, draft = summary(plan_rows, goal, "recommended"), summary(draft_rows, goal, "draft_scheduled_employees")
    return {"plan": plan, "draft": draft, "change": difference(plan, draft)}


def block_record(row, draft_row, scenario: str, goal: float, assumption_text: dict[str, str]) -> dict:
    is_open = int(row.is_open) == 1
    day = row.day_date
    store, dept, shift = int(row.store_id), int(row.dept_id), row.shift_code
    chance = float(row.chance_met) if is_open else None
    chance_draft = float(row.chance_met_draft) if is_open else None
    return {
        "key": block_key(scenario, store, dept, day, shift),
        "scenario": scenario,
        "store_id": store,
        "warehouse": warehouse_label(store),
        "dept_id": dept,
        "department": DEPARTMENTS[dept]["name"],
        "date": f"{day:%Y-%m-%d}",
        "day": day_label(day),
        "day_short": short_day_label(day),
        "weekday": row.day_name,
        "holiday": HOLIDAYS.get(f"{day:%Y-%m-%d}"),
        "shift_code": shift,
        "shift": SHIFTS[shift],
        "start": text_or_none(row.shift_start_time),
        "end": text_or_none(row.shift_end_time),
        "paid_hours": float(row.paid_hours),
        "label": f"{day_label(day)}, {DEPARTMENTS[dept]['name']}, {SHIFTS[shift]}",
        "is_open": is_open,
        "min_staff": int(row.min_staff),
        "plan": int(row.recommended),
        "draft": int(row.draft_scheduled_employees),
        "change": int(row.change),
        "action": row.action,
        "sources": {"regular": int(row.fill_regular), "flex": int(row.fill_flex), "overtime": int(row.fill_overtime)},
        "draft_sources": {
            "regular": int(draft_row.fill_regular), "flex": int(draft_row.fill_flex),
            "overtime": int(draft_row.fill_overtime), "unfilled": int(draft_row.unfilled),
        },
        "cost": float(row.cost),
        "cost_draft": float(row.cost_draft),
        "cost_change": float(row.cost - row.cost_draft),
        "hours": float(row.hours),
        "hours_draft": float(draft_row.hours),
        "utilization": float(row.planned_utilization) if is_open else None,
        "utilization_draft": float(row.planned_utilization_draft) if is_open else None,
        "chance": chance,
        "chance_draft": chance_draft,
        "need": int(row.need) if is_open else None,
        "below_goal": bool(is_open and chance < goal - TOLERANCE),
        "below_goal_draft": bool(is_open and chance_draft < goal - TOLERANCE),
        "at_capacity": bool(is_open and row.recommended >= row.capacity),
        "cushion_people": int(row.cushion_people) if is_open else None,
        "cushion_demand": float(row.cushion_demand) if is_open else None,
        "demand": float(row.demand) if is_open else None,
        "demand_sd": float(row.demand_sd) if is_open else None,
        "demand_multiplier": float(row.demand_multiplier),
        "adjustment_reason": text_or_none(row.adjustment_reason),
        "callout_rate": float(row.callout_rate) if is_open else None,
        "callout_context": text_or_none(row.callout_context) if is_open else None,
        "availability": {
            "regular": int(row.available_regular_employees),
            "overtime": int(row.max_overtime_employees),
            "cross_trained": int(row.cross_trained_flex_employees),
            "usable_flex": int(row.usable_flex),
            "capacity": int(row.capacity),
            "note": text_or_none(row.availability_note),
        },
        "explanation": {
            "headline": row.headline,
            "why": row.why,
            "demand_driver": text_or_none(row.demand_driver),
            "staffing": text_or_none(row.staffing),
            "cost_effect": text_or_none(row.cost_effect),
            "service_effect": text_or_none(row.service_effect),
            "cushion": text_or_none(row.cushion_text),
            "availability": text_or_none(row.availability_note),
        },
        "assumptions": [{"id": item, "text": assumption_text.get(item, "")} for item in row.assumption_ids],
    }


def _alerts(plan_rows: pd.DataFrame, draft_rows: pd.DataFrame, goal: float) -> list[dict]:
    alerts = []
    open_rows = plan_rows[plan_rows["is_open"] == 1]
    short = open_rows[open_rows["chance_met"] < goal - TOLERANCE]
    for day, part in short.groupby("day_date", sort=True):
        count = len(part)
        at_capacity = int((part["recommended"] >= part["capacity"]).sum())
        alerts.append(
            {
                "level": "warning",
                "kind": "below_goal",
                "date": f"{day:%Y-%m-%d}",
                "count": count,
                "at_capacity": at_capacity,
                "page": "playbook",
                "text": (
                    f"{day_label(day)}: {count} {'block' if count == 1 else 'blocks'} can't reach the {goal * 100:g}% goal, "
                    f"even with all {'its' if count == 1 else 'their'} own staff and overtime. See the Playbook."
                ),
            }
        )
    over = draft_rows[(draft_rows["is_open"] == 1) & (draft_rows["unfilled"] > 0)]
    if len(over):
        people = int(over["unfilled"].sum())
        alerts.append(
            {
                "level": "warning",
                "kind": "draft_over_capacity",
                "date": None,
                "count": int(len(over)),
                "page": "schedule",
                "text": f"The draft schedules {people} more {'person' if people == 1 else 'people'} than can be fielded, across {len(over)} {'block' if len(over) == 1 else 'blocks'}.",
            }
        )
    return alerts


def _group_totals(plan_rows: pd.DataFrame, draft_rows: pd.DataFrame, goal: float) -> dict:
    overall = compare(plan_rows, draft_rows, goal)
    by_day = []
    for day in sorted(plan_rows["day_date"].unique()):
        day = pd.Timestamp(day)
        mask = (plan_rows["day_date"] == day).to_numpy()
        iso = f"{day:%Y-%m-%d}"
        by_day.append({"date": iso, "day": day_label(day), "day_short": short_day_label(day), "holiday": HOLIDAYS.get(iso), **compare(plan_rows[mask], draft_rows[mask], goal)})
    by_department = []
    for dept, info in DEPARTMENTS.items():
        mask = (plan_rows["dept_id"] == dept).to_numpy()
        by_department.append({"dept_id": dept, "department": info["name"], **compare(plan_rows[mask], draft_rows[mask], goal)})
    open_rows = plan_rows[plan_rows["is_open"] == 1]
    largest = open_rows.assign(size=open_rows["change"].abs()).sort_values(["size", "day_date", "dept_id"], ascending=[False, True, True])
    return {
        **overall,
        "verdict": verdict_text(overall["plan"], overall["draft"], goal),
        "by_day": by_day,
        "by_department": by_department,
        "alerts": _alerts(plan_rows, draft_rows, goal),
        "largest_changes": [block_key(r.scenario_code, r.store_id, r.dept_id, r.day_date, r.shift_code) for r in largest.head(10).itertuples()],
    }


def plan_payload(result: dict, scenario: str, goal: float, assumption_text: dict[str, str]) -> dict:
    """Every block for one scenario, with totals for all warehouses and each one."""
    explained = result["explained"].reset_index(drop=True)
    draft = draft_frame(explained)
    blocks = [
        block_record(row, draft_row, scenario, goal, assumption_text)
        for row, draft_row in zip(explained.itertuples(), draft.itertuples())
    ]
    totals = {}
    for group in GROUPS:
        mask = slice(None) if group == "all" else (explained["store_id"] == int(group)).to_numpy()
        totals[group] = _group_totals(explained[mask], draft[mask], goal)
    return {"scenario": scenario, "goal": goal, "blocks": blocks, "totals": totals}


def changes_against(what_if: dict, submitted: dict) -> list[dict]:
    """Every block whose headcount differs from the submitted plan, largest change first."""
    before = {block["key"]: block for block in submitted["blocks"]}
    rows = []
    for block in what_if["blocks"]:
        old = before[block["key"]]
        if block["plan"] == old["plan"]:
            continue
        rows.append(
            {
                "key": block["key"], "label": block["label"], "store_id": block["store_id"], "warehouse": block["warehouse"],
                "dept_id": block["dept_id"], "department": block["department"], "date": block["date"], "day": block["day"],
                "shift_code": block["shift_code"], "shift": block["shift"],
                "submitted": old["plan"], "what_if": block["plan"], "change": block["plan"] - old["plan"],
                "chance_submitted": old["chance"], "chance_what_if": block["chance"],
                "cost_submitted": old["cost"], "cost_what_if": block["cost"], "cost_change": block["cost"] - old["cost"],
                "below_goal_what_if": block["below_goal"],
            }
        )
    rows.sort(key=lambda row: (-abs(row["change"]), row["date"], row["dept_id"], row["store_id"], row["shift_code"]))
    return rows


def against_submitted(what_if: dict, submitted: dict, rescored: dict) -> dict:
    """KPI changes against the submitted plan, for all warehouses and each one."""
    result = {}
    for group in GROUPS:
        new, old = what_if["totals"][group]["plan"], submitted["totals"][group]["plan"]
        result[group] = {"submitted": old, "what_if": new, "change": difference(new, old), "submitted_rescored": rescored[group]}
    return result
