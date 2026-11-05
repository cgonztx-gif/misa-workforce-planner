"""Fixed wording and labels the API hands to the front end, so it never re-derives them.

Calculated figures don't live here. They come from the engine or from outputs/.
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from src.data import ROOT

PRODUCT = "Workforce Planner"
NOTICE = (
    "All data is simulated for the Texas MISA case competition. It is not Costco data and does not represent "
    "Costco wages, staffing levels, schedules or service performance."
)
WEEK_LABEL = "Thu Feb 12 to Wed Feb 18, 2026"

SCENARIOS = {
    "BASE": {
        "name": "Baseline planning week",
        "description": "Expected conditions for the week, including Valentine's Day and Presidents' Day.",
    },
    "PEAK": {
        "name": "Promotion and winter-weather surge",
        "description": "A promotion launch and a winter-storm advisory raise demand on Feb 13-15. Availability is the same as BASE.",
    },
    "DISRUPT": {
        "name": "Callouts and reduced availability",
        "description": "Illness at Warehouse 2 on Feb 13-16 and a crew shortage at Warehouse 4 on Feb 12-13. Demand is the same as BASE.",
    },
}
WAREHOUSES = {1: ("Warehouse 1", "Medium"), 2: ("Warehouse 2", "Large"), 4: ("Warehouse 4", "Large")}
DEPARTMENTS = {
    38: {"name": "Front End", "short": "FE", "metric": "Checkout wait", "target_value": 5, "unit": "minutes", "demand_unit": "Checkout workload units"},
    92: {"name": "Merchandising", "short": "MS", "metric": "Replenishment response", "target_value": 60, "unit": "minutes", "demand_unit": "Replenishment workload units"},
    95: {"name": "Pharmacy", "short": "RX", "metric": "Prescription wait", "target_value": 20, "unit": "minutes", "demand_unit": "Prescription workload units"},
}
SHIFTS = {"OPEN": "Opening", "MID": "Midday", "EVE": "Evening"}
SHIFT_ORDER = list(SHIFTS)
DEPT_ORDER = list(DEPARTMENTS)
# Feb 13-16 is the Presidents' Day window. Feb 14 is also Valentine's Day.
HOLIDAYS = {
    "2026-02-13": "Presidents' Day weekend",
    "2026-02-14": "Valentine's Day",
    "2026-02-15": "Presidents' Day weekend",
    "2026-02-16": "Presidents' Day",
}
GOALS = [0.90, 0.925, 0.95, 0.975]
LIMITS = {
    "goal": {"allowed": GOALS, "label": "Service goal", "help": "The chance of meeting target the plan aims for in each block."},
    "callouts": {"min": 0.0, "max": 2.0, "step": 0.25, "label": "Callouts, as a multiple of history", "help": "1.0 is the historical rate. 2.0 doubles it."},
    "demand": {"min": -0.10, "max": 0.15, "step": 0.01, "label": "Demand against forecast", "help": "A change applied to every open block's forecast."},
    "availability": {
        "min": -0.30, "max": 0.0, "step": 0.05, "label": "Regular staff available",
        "help": "A change to each block's available regular staff, rounded to whole people. Overtime and cross-trained pools are unchanged, but usable cross-trained staff still shrink with the partner department's regular staff.",
    },
}

GLOSSARY = [
    ("Block", "One warehouse, department, day and shift."),
    ("Draft", "Management's current schedule, which rolls last month's pattern forward."),
    ("Plan", "The staffing this tool recommends. With default settings it is exactly the submitted plan."),
    ("Utilization", "The hours a block's demand requires, divided by the hours actually worked. Service falls off a cliff near 85-90%."),
    ("Meeting target", "A wait at or under the limit: 5 minutes at checkout, 60 for replenishment, 20 in Pharmacy."),
    ("Expected service", "The average predicted chance of meeting target across open blocks. It comes from our model, so it isn't a measured result."),
    ("Service goal", "The chance of meeting target the plan aims for in each block. The submitted plan uses 95%."),
    ("Below the goal", "A block whose chance of meeting target stays under the goal even with all its own regular staff and overtime."),
    ("Cushion", "The people a block can lose, or the extra demand it can take, before a miss becomes the likelier outcome."),
    ("Cross-trained staff", "Front End and Merchandising staff who can cover each other in the same shift, at the regular rate."),
    ("Capacity", "The most people a block can field: regular staff, then cross-trained staff the partner department can spare, then overtime."),
    ("What-if", "A re-run of the plan under changed settings. It is never the submitted plan."),
]

# The case's own assumptions, summarized from the data pack's docs/ASSUMPTIONS.md (fixed references, D-20).
CASE_ASSUMPTIONS = [
    ("C-01", "Labor standards at 100% productive time: Front End 1.50, Merchandising 1.20 and Pharmacy 0.165 labor hours per workload unit."),
    ("C-02", "Shifts are fixed, non-overlapping blocks, and headcount means employees working the full block. Each open block has a minimum staff level."),
    ("C-03", "Loaded regular rate is base wage x 1.25. Loaded overtime is base x 1.5 x 1.10, so overtime costs about 32% more per hour."),
    ("C-04", "Submitted totals are filled with regular staff first, then cross-trained staff the partner department isn't using in that shift, then overtime."),
    ("C-05", "About half of historical callouts were backfilled with overtime when overtime capacity allowed."),
    ("C-06", "Overtime capacity is about 20% of the normal pool. Pharmacy has no cross-trained staff because of licensure."),
    ("C-07", "Service is simulated from demand against worked hours: it degrades gradually, then very steeply as utilization nears capacity."),
    ("C-08", "PEAK applies the case's demand multipliers to our BASE forecast. DISRUPT keeps BASE demand but cuts availability at Warehouses 2 and 4."),
    ("C-09", "The benchmark forecast is the average of the same weekday in weeks 3-6. It ignores holidays, promotions and weather."),
]

ENGINE_STEPS = [
    ("Data", "Six weeks of simulated history and the planning grid, read from the case's CSVs."),
    ("Forecast", "A log-linear regression of daily demand on warehouse, weekday, holiday window and weekly level, split into shifts."),
    ("Service curve", "Per department, how the service metric responds to utilization, fitted on every historical block."),
    ("Risk", "The chance of meeting target at a headcount, allowing for forecast error, callouts and backfill. Checked by simulation."),
    ("Allocation and cost", "The case's rule: regular staff, then cross-trained staff the partner can spare, then overtime."),
    ("Search", "Every feasible headcount per shift, Front End and Merchandising together: service first, then the lowest cost."),
    ("Explanations", "Plain-language reasons for every block, filled from the calculated numbers."),
]

DOCUMENTS = [
    {"name": "Written report", "path": "deliverables/Costco_Case_Analysis.docx"},
    {"name": "Code appendix", "path": "deliverables/Costco_Analysis_Appendix.ipynb"},
    {"name": "Presentation", "path": "deliverables/Costco_Workforce_Presentation.pptx"},
    {"name": "Staffing plan", "path": "outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv"},
]


def day_label(day: pd.Timestamp) -> str:
    """'Sat Feb 14'."""
    return f"{day:%a %b} {day.day}"


def short_day_label(day: pd.Timestamp) -> str:
    """'Sat 14'."""
    return f"{day:%a} {day.day}"


def warehouse_label(store: int) -> str:
    return WAREHOUSES[int(store)][0]


def service_target(dept: int) -> str:
    info = DEPARTMENTS[int(dept)]
    return f"{info['metric']} of {info['target_value']} {info['unit']} or less"


def _plain(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("`", "")).strip()


def our_assumptions(short_text: dict[str, str]) -> list[dict]:
    """Our assumptions from planning/ASSUMPTIONS.md, skipping rejected ones.

    Uses the shorter wording from src/explain.py where it exists, and falls back to that list alone if
    the file can't be read.
    """
    path = ROOT / "planning" / "ASSUMPTIONS.md"
    rows = []
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            if len(cells) >= 5 and re.fullmatch(r"A-\d+", cells[0]):
                rows.append({"id": cells[0], "long": _plain(cells[1]), "basis": _plain(cells[2]), "status": _plain(cells[4])})
    except OSError:
        rows = []
    if not rows:
        rows = [{"id": key, "long": text, "basis": None, "status": None} for key, text in short_text.items()]
    result = []
    for row in rows:
        if row["status"] and row["status"].lower().startswith("rejected"):
            continue
        result.append(
            {
                "id": row["id"],
                "text": short_text.get(row["id"], row["long"]),
                "source": "ours",
                "detail": row["long"],
                "basis": row["basis"],
                "status": row["status"],
            }
        )
    return result


def case_assumptions() -> list[dict]:
    return [{"id": key, "text": text, "source": "case", "detail": None, "basis": "Data pack, docs/ASSUMPTIONS.md", "status": "Given by the case"} for key, text in CASE_ASSUMPTIONS]


DATA_MISSING = (
    "The case data isn't extracted yet. From the project folder, run these two commands, then restart the server: "
    "python -m zipfile -e MISA.zip .  and then  "
    'python -m zipfile -e "MISA/Student Teams/Costco_Case_Competition_TEAMS.zip" data'
)
