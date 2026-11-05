# Code appendix for the Costco workforce planning case (T-91), in percent format.
# scripts/build_notebook.py turns this into deliverables/Costco_Analysis_Appendix.ipynb, runs it and exports HTML.
# Rule for editing: prose never types a calculated figure. Figures are printed by the code cells.

# %% [markdown]
# # Costco workforce planning: code appendix
#
# **Texas MISA Fall 2026 case competition.** <span style="color:#B42A30">**Simulated data:**</span> every number in this
# notebook comes from the case's data pack, which the organizers simulated. None of it is real Costco data.
#
# This is the code behind our staffing plan for the week of Feb 12-18, 2026. Read top to bottom, it shows each step's
# code, what the code produced, and what we concluded. It reruns the whole analysis from the data pack, and the last
# section checks every result against the files we submitted.
#
# **How to run it.** From the repository root, `python scripts/build_notebook.py` rebuilds this notebook, runs it and
# exports the HTML, which takes a few minutes. Or open `deliverables/Costco_Analysis_Appendix.ipynb` in Jupyter with
# the repository root as the working directory and run all cells. `README.md` has the setup steps.
#
# **How to read it.** Each section opens with what it shows and ends with a takeaway. Numbers are printed by the code
# cells, never typed into the prose. The real functions from `src/` are shown with `inspect.getsource`, so the code you
# read here is the code that made the plan. IDs point to the planning notes: F for findings (`planning/FINDINGS.md`),
# A for assumptions (`ASSUMPTIONS.md`), D for decisions (`DECISIONS.md`).
#
# | § | Section | What it answers |
# |---|---|---|
# | 1 | [The data](#1.-The-data) | Can we trust the data, and what is its grain? |
# | 2 | [Diagnosis](#2.-Diagnosis) | What went wrong in history, and how would the draft schedule fare? |
# | 3 | [Forecast](#3.-Forecast) | How much demand should the planning week expect, block by block? |
# | 4 | [Service curves](#4.-Service-curves) | How busy can a block run before it misses its service target? |
# | 5 | [Risk model](#5.-Risk-model) | What chance does a block have of meeting target at a given headcount? |
# | 6 | [Allocation and cost](#6.-Allocation-and-cost) | How is a headcount filled and costed? |
# | 7 | [Staffing search](#7.-Staffing-search) | What headcount should each block get? |
# | 8 | [Trade-offs](#8.-Trade-offs) | What do the service goal, the callout allowance and holiday PTO cost? |
# | 9 | [Scenarios](#9.-Scenarios) | How do BASE, PEAK and DISRUPT differ? |
# | 10 | [Submission](#10.-Submission) | Is the submitted file complete and valid? |
# | 11 | [Reproducibility](#11.-Reproducibility) | Does this notebook reproduce the submitted results? |

# %% [markdown]
# ## 0. Setup
#
# **What this shows:** the libraries, the shared chart style (the same look as the app and the report), small display
# helpers, and the exact code version this run used.

# %%
import inspect
import json
import os
import platform
import re
import subprocess
import sys
import tempfile
import time
import warnings
from pathlib import Path

ROOT = Path.cwd() if (Path.cwd() / "src").is_dir() else Path.cwd().parent
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))
STARTED = time.time()

# Known, harmless library warnings, silenced by exact message so nothing else is hidden:
# kpis() takes a correlation inside groups whose scheduled hours never change, which NumPy reports as 0/0.
# Those groups come out as NaN and the median skips them.
warnings.filterwarnings("ignore", message="invalid value encountered in divide", category=RuntimeWarning)

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import scipy
import statsmodels
from IPython.display import Markdown, display
from matplotlib.lines import Line2D
from matplotlib.transforms import offset_copy
from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import PythonLexer

from src import viz_style as vs

vs.apply(dpi=110)
pd.set_option("display.html.use_mathjax", False)  # dollar signs in tables stay dollar signs
pd.set_option("styler.html.mathjax", False)
pd.set_option("display.width", 140)
DEPT = {38: "Front End", 92: "Merchandising", 95: "Pharmacy"}
SCENARIOS = ["BASE", "PEAK", "DISRUPT"]

# %%
_CODE_STYLE = HtmlFormatter(noclasses=True, style="friendly", nobackground=True,
                            prestyles="font-family:Consolas,'Cascadia Mono',Menlo,monospace;font-size:12px;line-height:1.45;"
                                      "white-space:pre-wrap;margin:8px 0")


def show_code(*objects):
    """Display the real source of functions or classes from src/, with where each one lives."""
    parts, places = [], []
    for obj in objects:
        lines, start = inspect.getsourcelines(obj)
        path = Path(inspect.getsourcefile(inspect.unwrap(obj))).resolve().relative_to(ROOT).as_posix()
        places.append(f"<code>{path}</code> line {start}: <b>{obj.__qualname__}</b>")
        parts.append("".join(lines).rstrip())
    source = "\n\n\n".join(parts)
    html = (
        f'<div style="font:12px Segoe UI,sans-serif;color:{vs.INK_SUBTLE};margin:0 0 4px">{" &middot; ".join(places)}</div>'
        f'<div style="background:{vs.RAISED};border:1px solid {vs.BORDER};border-radius:8px;padding:2px 12px;'
        f'overflow-x:auto;font-size:12px">{highlight(source, PythonLexer(), _CODE_STYLE)}</div>'
    )
    display({"text/html": html, "text/plain": source}, raw=True)


def table(frame, formats=None, caption=None, index=False):
    """Display a table with readable number formats, text and dates aligned left, and no row numbers."""
    formats = dict(formats or {})
    for column in frame.columns:
        if pd.api.types.is_datetime64_any_dtype(frame[column]):
            formats.setdefault(column, lambda d: f"{d:%a %b} {d.day}")
    styler = frame.style.format(formats, na_rep="", precision=3, thousands=",")
    text = [i for i, c in enumerate(frame.columns) if not pd.api.types.is_numeric_dtype(frame[c])]
    styler = styler.set_table_styles(
        [{"selector": f"td.col{i}, th.col_heading.col{i}", "props": "text-align:left"} for i in text], overwrite=False)
    if not index:
        styler = styler.hide(axis="index")
    if caption:
        styler = styler.set_caption(caption).set_table_styles(
            [{"selector": "caption", "props": f"caption-side:top;text-align:left;font-weight:600;color:{vs.INK};padding:4px 0"}],
            overwrite=False,
        )
    display(styler)


def multi_header(fig, axes, title, handles=(), labels=(), panel_titles=()):
    """Title and key above a grid of panels, plus a small title on each panel (a multi-panel vs.header)."""
    axes = list(np.ravel(axes))
    for ax, name in zip(axes, panel_titles):
        ax.set_title(name, loc="left", fontsize=vs.LABEL_SIZE, fontweight="semibold", color=vs.INK_MUTED, pad=6)
    first = axes[0]
    left = first.yaxis.get_tightbbox(fig.canvas.get_renderer()).x0
    x = first.transAxes.inverted().transform((left, 0))[0]
    lift = (vs.LABEL_SIZE * 1.4 + 10) if panel_titles else 4
    if handles:
        first.legend([vs._key(h) for h in handles], labels, loc="lower left", ncol=len(handles), bbox_to_anchor=(x, 1.0),
                     bbox_transform=offset_copy(first.transAxes, fig, y=lift, units="points"))
        lift += vs.LABEL_SIZE * 1.4 + 6
    first.text(x, 1.0, title, transform=offset_copy(first.transAxes, fig, y=lift, units="points"),
               fontsize=vs.TITLE_SIZE, fontweight="semibold", color=vs.INK, ha="left", va="bottom")


def money(x):
    return f"${x:,.0f}"


# %%
def git(*args):
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=30).stdout.rstrip()
    except (OSError, subprocess.SubprocessError):
        return "(git not available)"


changed = git("status", "--porcelain", "--", "src/*.py", "outputs", ":(exclude)outputs/charts")
table(pd.DataFrame(
    [
        ("Python", platform.python_version()),
        ("pandas / NumPy / SciPy", f"{pd.__version__} / {np.__version__} / {scipy.__version__}"),
        ("statsmodels / matplotlib", f"{statsmodels.__version__} / {matplotlib.__version__}"),
        ("Git commit", git("log", "-1", "--format=%h %ad %s", "--date=short")),
        ("Code in src/ and results in outputs/ (not charts) match that commit",
         "yes" if not changed else "no, changed: " + ", ".join(line[3:] for line in changed.splitlines())),
        ("Chart font", vs.FONT),
    ],
    columns=["Item", "Value"],
))

# %% [markdown]
# ## 1. The data
#
# **What this shows:** the views we use from the data pack, their row counts, the checks that let us trust them, the
# grain every table shares, and the blocks that are closed. (F-02, F-05 to F-07, F-14)

# %%
from src.data import CSV_DIR, HOLIDAY_WINDOWS, PLAN_KEY, load_benchmark, load_history, load_planning_grid, load_template, open_history

history, grid, template, benchmark = load_history(), load_planning_grid(), load_template(), load_benchmark()
availability = pd.read_csv(CSV_DIR / "comp_FactShiftAvailability.csv")
schedules = pd.read_csv(CSV_DIR / "comp_FactShiftSchedule.csv")
span = lambda f: f"{f['day_date'].min():%b %d} to {f['day_date'].max():%b %d, %Y}"
table(pd.DataFrame(
    [
        ("v_ShiftHistory", "Demand, schedule, callouts, cost and service for each past block", len(history), span(history)),
        ("v_PlanningWeekGrid", "The planning week: 3 scenarios x every block, with no demand", len(grid), span(grid)),
        ("TEAM_SUBMISSION_TEMPLATE", "The file to fill in", len(template), span(template)),
        ("PlanningWeek_BenchmarkForecast", "The naive daily forecast to beat", len(benchmark), span(benchmark)),
        ("comp_FactShiftAvailability", "Availability by scenario", len(availability), ""),
        ("comp_FactShiftSchedule", "Schedules, history and draft", len(schedules), ""),
    ],
    columns=["View", "Holds", "Rows", "Dates"],
))

# %% [markdown]
# **The grain.** Every fact table has one row per warehouse x department x day x shift. The planning grid adds a
# scenario. Three warehouses (1 is medium, 2 and 4 are large; there is no 3), three departments and three shifts.

# %%
grain = ["store_id", "dept_id", "day_date", "shift_code"]
print("History rows:", len(history), "=",
      " x ".join(str(history[c].nunique()) for c in grain), "(warehouses x departments x days x shifts)")
print("Planning rows:", len(grid), "=",
      " x ".join(str(grid[c].nunique()) for c in ["scenario_id", *grain]), "(scenarios x warehouses x departments x days x shifts)")
print("Duplicate keys: history", int(history.duplicated(grain).sum()), "| planning", int(grid.duplicated(PLAN_KEY).sum()))
table(history[history["is_open"] == 1][["store_id", "department_group", "day_date", "shift_code", "paid_hours", "shift_demand_units",
                                        "scheduled_employees", "worked_employees", "metric_code", "metric_value", "target_value", "met_target"]].head(3),
      {"shift_demand_units": "{:.1f}", "metric_value": "{:.2f}", "paid_hours": "{:.1f}", "target_value": "{:.0f}"},
      caption="The first open day in history, Warehouse 1 Front End")

# %% [markdown]
# **Checks.** Each line below recomputes something the data pack's documents claim. If any failed, we couldn't build on it.

# %%
rates = pd.read_csv(CSV_DIR / "comp_LaborCostAssumption.csv")
costed = history.merge(rates[["store_id", "dept_id", "loaded_regular_hourly_cost", "loaded_overtime_hourly_cost"]],
                       on=["store_id", "dept_id"], validate="many_to_one")
cost_error = (costed["labor_cost"] - costed["worked_regular_hours"] * costed["loaded_regular_hourly_cost"]
              - costed["worked_overtime_hours"] * costed["loaded_overtime_hourly_cost"]).abs().max()
day_sums = history.groupby(["store_id", "dept_id", "day_date"]).agg(shifts=("shift_demand_units", "sum"), day=("daily_demand_units", "first"))
history_daily = history.drop_duplicates(["store_id", "dept_id", "day_date"]).assign(
    week=lambda f: (f["day_date"] - pd.Timestamp("2026-01-01")).dt.days // 7 + 1)
same_weekday = (history_daily[history_daily["week"].between(3, 6)]
                .groupby(["store_id", "dept_id", "day_name"])["daily_demand_units"].mean())
bench_gap = (benchmark.set_index(["store_id", "dept_id", "day_name"])["predicted_transaction_count_proxy"]
             - same_weekday.reindex(benchmark.set_index(["store_id", "dept_id", "day_name"]).index)).abs().max()
template_keys, grid_keys = set(map(tuple, template[PLAN_KEY].values.tolist())), set(map(tuple, grid[PLAN_KEY].values.tolist()))
draft_match = template.merge(grid[[*PLAN_KEY, "draft_scheduled_employees"]], on=PLAN_KEY, suffixes=("", "_grid"))
closed_history = history[history["is_open"] == 0]
checks = pd.DataFrame(
    [
        ("Template keys equal the grid's keys", f"{len(template_keys & grid_keys)} shared, {len(template_keys ^ grid_keys)} unmatched",
         template_keys == grid_keys),
        ("Template draft values equal the grid's", f"{int((draft_match['draft_scheduled_employees'] != draft_match['draft_scheduled_employees_grid']).sum())} differ",
         bool((draft_match["draft_scheduled_employees"] == draft_match["draft_scheduled_employees_grid"]).all())),
        ("labor_cost = regular hours x regular rate + overtime hours x overtime rate", f"largest error {cost_error:.6f}", cost_error < 1e-6),
        ("Shift demand sums to the day's demand", f"largest gap {(day_sums['shifts'] - day_sums['day']).abs().max():.6f}",
         (day_sums["shifts"] - day_sums["day"]).abs().max() < 1e-6),
        ("Benchmark = mean of the same weekday in weeks 3-6", f"largest gap {bench_gap:.6f} over {len(benchmark)} rows", bench_gap < 1e-3),
        ("Closed history blocks have zero demand and no metric", f"{len(closed_history)} closed, "
         f"{int((closed_history['shift_demand_units'] != 0).sum())} with demand, {int(closed_history['metric_value'].notna().sum())} with a metric",
         bool((closed_history["shift_demand_units"] == 0).all() and closed_history["metric_value"].isna().all())),
    ],
    columns=["Check", "Result", "Pass"],
)
table(checks)
assert checks["Pass"].all(), "A data check failed"

# %% [markdown]
# **Closed blocks.** History is closed on New Year's Day, and Pharmacy is closed on Saturday and Sunday evenings and
# Sunday mornings. The same Pharmacy blocks are closed in the planning week, so the template needs a 0 there. Closed
# blocks are left out of every fit (F-14, F-35).

# %%
new_year = closed_history["day_date"].eq("2026-01-01")
reason = np.where(new_year, "New Year's Day, every department and shift",
                  closed_history["dept_id"].map(DEPT) + ", " + closed_history["day_name"] + " " + closed_history["shift_code"])
closed_table = (closed_history.assign(reason=reason).groupby("reason", sort=False)
                .agg(blocks=("day_date", "size"), days=("day_date", "nunique")).reset_index())
table(closed_table, caption=f"Closed history blocks: {len(closed_history)} in all")
closed_template = template[template["is_open"] == 0]
print(f"Template rows that are closed: {len(closed_template)} of {len(template)}, all Pharmacy:",
      sorted(closed_template["dept_id"].map(DEPT).unique()), "|", closed_template.groupby(["day_name", "shift_code"]).size().to_dict())

# %% [markdown]
# **Takeaway:** the data is consistent with its own documents. Keys line up across the views, costs and demand add up
# exactly, and the benchmark is the simple average the docs describe. Everything below works at the block grain, and
# closed blocks get 0 and stay out of every model.

# %% [markdown]
# ## 2. Diagnosis
#
# **What this shows:** how service responds to how busy a block is, why worked staff matter more than scheduled staff,
# where history was over- and under-staffed, how often people call out, and how the current draft schedule would hold
# up in the planning week. (F-03, F-04, F-39, F-43, F-09, F-42)
#
# *Utilization* is workload hours (demand x the department's labor standard) over hours actually worked. Each department
# has its own service metric and target (checkout wait, replenishment time, prescription wait), so we always compare the
# metric with its own target.

# %%
from src.allocation import apply_rule
from src.diagnosis import callout_rates, draft_stress_test, gap_value, kpis, service_bands, staffing_gaps

blocks = open_history()
k = kpis()
bands = service_bands(blocks)
named = blocks.assign(department=blocks["dept_id"].map(DEPT), band=pd.cut(
    blocks["utilization"], [0, 0.85, 0.90, np.inf], right=False, labels=["Below 0.85", "0.85 to 0.90", "0.90 and above"]))
cliff = named.pivot_table(index="band", columns="department", values="met_target", aggfunc="mean", observed=True)[list(DEPT.values())]
cliff["Blocks"] = named.groupby("band", observed=True).size()
cliff.loc["All blocks"] = [*named.groupby("department")["met_target"].mean()[list(DEPT.values())], len(named)]
table(cliff.reset_index().rename(columns={"band": "Utilization"}),
      {name: "{:.1%}" for name in DEPT.values()} | {"Blocks": "{:,.0f}"}, caption="Share of history blocks meeting target")

# %%
fig, ax = plt.subplots(figsize=(6.6, 3.1))
vs.band(ax, 0.85, 0.90, "0.85 to 0.90", color=vs.WARNING_SOFT, ink=vs.WARNING_INK)
shown = bands[(bands["blocks"] >= 3) & bands["band"].between(0.6, 1.05)]
for dept, name in DEPT.items():
    part = shown[shown["dept_id"] == dept].sort_values("band")
    ax.plot(part["band"] + 0.025, part["met_target"] * 100, color=vs.DEPT[name], label=name, clip_on=False, **vs.MARKERS)
ax.set(xlim=(0.6, 1.1), ylim=(0, 108), xlabel="Utilization (middle of each five-point band with at least 3 blocks)",
       ylabel="Blocks meeting target")
ax.set_yticks(range(0, 101, 20))
ax.yaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
vs.header(ax, "Share of blocks meeting target, by utilization")
plt.show()

# %% [markdown]
# **Worked, not scheduled.** People call out, about half are replaced with overtime, and service follows the staff who
# actually worked. A block that lost someone met target less often than one that didn't.

# %%
labels = {38: "fe", 92: "ms", 95: "rx"}
table(pd.DataFrame({
    "Department": list(DEPT.values()),
    "Callout rate": [k[f"callout_{labels[d]}"] for d in DEPT],
    "Lost after backfill": [k[f"netloss_{labels[d]}"] for d in DEPT],
    "Met target when no one was lost": [k[f"met_noloss_{labels[d]}"] for d in DEPT],
    "Met target when someone was lost": [k[f"met_loss_{labels[d]}"] for d in DEPT],
}), {c: "{:.1%}" for c in ["Callout rate", "Lost after backfill", "Met target when no one was lost", "Met target when someone was lost"]})
print(f"All departments: {k['callout_rate_all']:.2%} of scheduled staff called out and {k['backfill_share']:.1%} of callouts were "
      f"backfilled. Where overtime was already used up, {k['backfill_when_no_ot']:.1%} were.")

# %% [markdown]
# **Over and under.** To locate the gaps, each block's need is the whole number of people that would have run it at 0.85
# utilization, never below minimum staff (the starter queries' level, F-17). Hours above that are over, hours below are short.

# %%
gap_table = gap_value(blocks)
table(gap_table[["department", "worked_hours", "required_hours", "over_hours", "short_hours", "over_value", "missed_blocks"]].rename(columns={
    "department": "Department", "worked_hours": "Worked hours", "required_hours": "Hours needed", "over_hours": "Hours over need",
    "short_hours": "Hours short", "over_value": "Cost of hours over need", "missed_blocks": "Blocks missing target"}),
    {"Worked hours": "{:,.0f}", "Hours needed": "{:,.0f}", "Hours over need": "{:,.0f}", "Hours short": "{:,.0f}", "Cost of hours over need": money})
print(f"Worked {k['worked_hours']:,.0f} hours against {k['req85_hours']:,.0f} needed ({k['worked_vs_req85']:+.1%}), "
      f"but {k['over_hours']:,.0f} hours sat above need and {k['short_hours']:,.0f} were missing elsewhere.")
gaps = staffing_gaps(blocks)
table(gaps.head(6)[["store_id", "department", "day_type", "shift_code", "blocks", "avg_utilization", "met_target", "net_hours", "scheduled_net_hours"]]
      .rename(columns={"store_id": "Warehouse", "department": "Department", "day_type": "Days", "shift_code": "Shift", "blocks": "Blocks",
                       "avg_utilization": "Mean utilization", "met_target": "Met target", "net_hours": "Net hours, as worked",
                       "scheduled_net_hours": "Net hours, as scheduled"}),
      {"Mean utilization": "{:.2f}", "Met target": "{:.0%}", "Net hours, as worked": "{:+,.0f}", "Net hours, as scheduled": "{:+,.0f}"},
      caption="The six largest gaps (positive = over need)")

# %%
full_weeks = blocks[blocks["week"].between(2, 6)]
weekly = full_weeks.groupby(["dept_id", "week"])[["shift_demand_units", "scheduled_labor_hours"]].sum()
indexed = weekly / weekly.groupby(level="dept_id").transform("mean") * 100
day_label = lambda d: f"{d:%b} {d.day}"
week_start = {w: day_label(pd.Timestamp("2026-01-01") + pd.Timedelta(weeks=w - 1)) for w in range(2, 7)}
fig, axes = plt.subplots(1, 3, figsize=(7.8, 2.6), sharey=True)
for ax, (dept, name) in zip(axes, DEPT.items()):
    part = indexed.loc[dept]
    ax.plot(part.index, part["shift_demand_units"], color=vs.INK, label="Demand", **vs.MARKERS)
    ax.plot(part.index, part["scheduled_labor_hours"], color=vs.DRAFT, label="Scheduled hours", **vs.MARKERS)
    ax.set_xticks([2, 4, 6], [week_start[w] for w in (2, 4, 6)])
    ax.set_xlim(1.6, 6.4)
axes[0].set_ylabel("Index, mean of weeks = 100")
fig.subplots_adjust(wspace=0.2)
multi_header(fig, axes, "Weekly demand and scheduled hours, by week starting", *axes[0].get_legend_handles_labels(),
             panel_titles=list(DEPT.values()))
plt.show()
print(f"Largest weekly swing from the mean, by department: demand {k['demand_index_spread']:.1%}, scheduled hours {k['hours_index_spread']:.1%}.")

# %% [markdown]
# **Callouts by situation.** Rates differ by department, by weekday or weekend, after a holiday, and in Warehouse 2's
# late-January flu cluster, which is kept separate (F-34). Each cell shows callouts over scheduled staff, because some
# rest on few people (A-15).

# %%
rates_table = callout_rates(blocks)
rates_table["cell"] = [f"{r:.1%}  ({c}/{s})" for r, c, s in zip(rates_table["rate"], rates_table["callouts"], rates_table["scheduled"])]
contexts = {"weekday": "Weekday", "weekend": "Weekend", "day_after_holiday": "Day after a holiday", "flu_cluster": "Flu cluster"}
table(rates_table.pivot(index="department", columns="context", values="cell")[list(contexts)].rename(columns=contexts)
      .reset_index().rename(columns={"department": "Department"}).fillna(""))

# %% [markdown]
# **The draft under stress.** Two tests of the draft schedule the case hands us. First, the labor rule (section 6):
# can every person it schedules actually be fielded? Second, if the planning week follows the MLK weekend's pattern at
# recent demand levels (the test from our first dashboard, kept in `src/diagnosis.py`; it is not our forecast), how
# many blocks would run past 0.85 utilization?

# %%
draft_ruled = apply_rule(grid, "draft_scheduled_employees")
stress = draft_stress_test(blocks)
rows = []
for scenario in SCENARIOS:
    ruled = draft_ruled[(draft_ruled["scenario_code"] == scenario) & (draft_ruled["is_open"] == 1)]
    tested = stress[stress["scenario_code"] == scenario]
    holiday = tested["day_date"].between("2026-02-13", "2026-02-16") & tested["dept_id"].isin([38, 92])
    rows.append((scenario, int(ruled["over_capacity"].sum()), int(ruled["unfilled"].sum()), ruled["cost"].sum(),
                 (tested.loc[holiday, "utilization"] > 0.85).mean(), (tested["utilization"] > 0.85).mean()))
table(pd.DataFrame(rows, columns=["Scenario", "Blocks above capacity", "People who can't be fielded", "Cost of fielded staff",
                                  "Holiday-weekend Front End and Merch. blocks above 0.85", "All blocks above 0.85"]),
      {"Cost of fielded staff": money, "Holiday-weekend Front End and Merch. blocks above 0.85": "{:.0%}", "All blocks above 0.85": "{:.0%}"})

# %% [markdown]
# **Takeaway:** service has a cliff, not a slope. Blocks are safe below 0.85 utilization, a coin flip from 0.85 to 0.90
# and almost always miss above that, in every department. History had about the right number of hours in total, but in
# the wrong places: schedules follow habit while demand moves, and callouts take out people the schedule counted on. The
# draft rolls those habits forward, so many of its holiday-weekend blocks would run past the cliff, and in DISRUPT it
# schedules people who aren't available.

# %% [markdown]
# ## 3. Forecast
#
# **What this shows:** how the BASE demand forecast for each planning block is built and tested. The daily table, how
# holiday labels are matched across periods, the demand drivers we tested, the regression itself, its holiday effects
# against the data pack's own build script, a backtest against the benchmark, tests of borrowing a holiday effect and of
# splitting days into shifts, and the planning-week forecast. (F-41, F-44, F-45, F-61)
#
# The planning grid has no demand, so it has to be forecast. We forecast each warehouse and department's daily demand,
# then split the day into shifts.

# %%
import matplotlib.dates as mdates
import statsmodels.formula.api as smf

from src import forecast as fc
from src import pipeline as P
from src.diagnosis import LEVEL, LEVEL_HOLIDAY, LEVEL_HOLIDAY_WEEK, daily_demand, holiday_factors

daily = daily_demand(blocks)
print(f"{len(daily)} open warehouse-department days, weeks {daily['week'].min()} to {daily['week'].max()}.")
table(daily.head(3), {"demand": "{:.1f}", "temperature": "{:.1f}", "log_demand": "{:.4f}"})

# %% [markdown]
# **Holiday labels.** History and the planning week name the same kinds of holiday window differently (F-13), so both
# map to shared categories. MLK weekend is the only guide to Presidents' Day weekend (A-05).

# %%
days_all = pd.concat([history.drop_duplicates("day_date").assign(period="History"),
                      grid.drop_duplicates("day_date").assign(period="Planning week")])
days_all = days_all[days_all["holiday_window_role"].isin(HOLIDAY_WINDOWS) & days_all["holiday_window_role"].ne("Normal")]
mapping = (days_all.groupby(["period", "holiday_window_role"], sort=False)["day_date"]
           .agg(lambda d: ", ".join(f"{x:%a} {day_label(x)}" for x in sorted(d))).reset_index())
mapping["Shared window"] = mapping["holiday_window_role"].map(HOLIDAY_WINDOWS)
table(mapping.rename(columns={"period": "Period", "holiday_window_role": "Label in the data", "day_date": "Days"}))

# %% [markdown]
# **Drivers we tested.** The case names traffic, promotions and weather as demand drivers. We tested each, along with
# holidays and the weekly level, by how much it explains of log daily demand.

# %%
fits = {name: smf.ols("log_demand ~ " + formula, daily).fit() for name, formula in
        [("Warehouse level + weekday shape", LEVEL), ("+ holiday windows", LEVEL_HOLIDAY), ("+ weekly level", LEVEL_HOLIDAY_WEEK)]}
table(pd.DataFrame([(name, fit.rsquared, int(fit.df_model) + 1) for name, fit in fits.items()],
                   columns=["Model of log daily demand", "R-squared", "Coefficients"]), {"R-squared": "{:.6f}"})

day_kind = history.drop_duplicates("day_date")
kind = np.select([day_kind["holiday_window_role"].eq("MLK_Holiday"), day_kind["is_costco_closed"].eq(1),
                  day_kind["day_name"].isin(["Friday", "Saturday", "Sunday"])], ["MLK Monday", "New Year's Day (closed)", "Friday to Sunday"], "Other days")
promo = pd.crosstab(kind, day_kind["has_promotion"]).rename(columns={0: "Days without a promotion", 1: "Days with a promotion"})
table(promo.reset_index().rename(columns={"row_0": "History days"}), caption="Promotions fall exactly on weekends and holidays")
planning_promo = grid.drop_duplicates("day_date").query("has_promotion == 1")["day_date"]
print("Planning-week promotion days:", ", ".join(f"{d:%a} {day_label(d)}" for d in planning_promo))

sql = (ROOT / "data" / "team_distribution" / "sql" / "02_Load_Core_Data.sql").read_text(encoding="utf-8", errors="replace")
registry = re.findall(r"N'([^']*)'", next(line for line in sql.splitlines() if "(N'traffic_index'" in line))
in_csv = [p.name for p in CSV_DIR.glob("*.csv") if "traffic_index" in pd.read_csv(p, nrows=0).columns]
drivers = pd.DataFrame([
    ("Temperature", f"Correlation with what warehouse and weekday leave unexplained: {k['corr_temp_resid']:+.3f}. "
                    f"Front End's raw correlation of {k['corr_temp_raw_fe']:+.2f} comes from the calendar, not the weather.", "Left out"),
    ("Promotions", f"Correlation with the unexplained part: {k['corr_promo_resid']:+.3f}. Promotions run on exactly the weekends and "
                   "holidays (table above), so their effect can't be separated from those days.", "Carried by the weekday and holiday terms; PEAK's surge by its multipliers"),
    ("Traffic", f"In no CSV ({len(in_csv)} files have a traffic_index column). The data pack's feature registry says: "
                + "; ".join(f for f in registry if any(w in f.lower() for w in ("never", "leak", "scoring"))), "Not used"),
    ("Holidays", f"R-squared rises from {fits['Warehouse level + weekday shape'].rsquared:.3f} to {fits['+ holiday windows'].rsquared:.3f}",
                 "Holiday-window terms, borrowed from MLK for Presidents' Day (A-05)"),
    ("Weekly level", f"R-squared rises to {fits['+ weekly level'].rsquared:.6f}", "Forecast at the last four weeks' average level (A-14)"),
], columns=["Driver", "What the data shows", "How the forecast handles it"])
table(drivers)

# %% [markdown]
# **The regression.** Log daily demand on warehouse level, each department's weekday shape, holiday windows and weekly
# level. The planning week's level isn't known, so the forecast averages the last four weeks' levels (D-19, A-14).

# %%
print("Formula:", fc.FORMULA)
show_code(fc.fit_daily, fc.predict_daily)
model = fc.fit_daily(daily)
print(f"Fitted on {int(model.nobs)} open days with {int(model.df_model) + 1} coefficients: R-squared {model.rsquared:.6f}, "
      f"residual standard deviation {np.sqrt(model.scale):.4f} in log units.")
print("Weeks averaged for the planning-week level:", [int(w) for w in sorted(daily["week"].unique())[-fc.LEVEL_WEEKS:]])

# %% [markdown]
# **Holiday effects against the build script.** The data pack's SQL script that generated the history multiplies demand
# by a factor for each holiday window. Holding warehouse, weekday and weekly level fixed, the regression should recover
# those factors. The script's factors below are parsed from the SQL, not typed in.

# %%
case = sql[sql.index("AS bw(base_daily_weight)"): sql.index("AS hf(holiday_adjustment_factor)")]
script = []
for role, body in re.findall(r"holiday_window_role = N'(\w+)' THEN (CASE .*? END)", case):
    named_factors = {int(d): float(v) for d, v in re.findall(r"dept_id = (\d+) THEN ([\d.]+)", body)}
    other = float(re.search(r"ELSE ([\d.]+)", body).group(1))
    script += [(HOLIDAY_WINDOWS[role], dept, named_factors.get(dept, other)) for dept in DEPT]
factors = holiday_factors(daily).merge(pd.DataFrame(script, columns=["window", "dept_id", "script"]), on=["window", "dept_id"])
factors["gap"] = (factors["factor"] - factors["script"]).round(6) + 0.0  # + 0.0 turns -0.0 into 0.0
table(factors[["window", "department", "factor", "script", "gap"]].rename(columns={
    "window": "Window", "department": "Department", "factor": "Regression", "script": "Build script", "gap": "Gap"}),
    {"Regression": "{:.4f}", "Build script": "{:.4f}", "Gap": "{:+.4f}"})
print(f"Largest gap: {factors['gap'].abs().max():.4f}")

# %% [markdown]
# **Backtest.** Forecast each of weeks 4, 5 and 6 from the weeks before it only, and compare with the benchmark's method
# (the same weekday's mean over the last four weeks). Error is the mean absolute percentage error.

# %%
group_name = lambda g: DEPT.get(g, g)
backtested = fc.backtest()
daily_errors = fc.error_table(backtested, ("model", "model_all_weeks", "benchmark"))
table(daily_errors.assign(group=daily_errors["group"].map(group_name)).rename(columns={
    "group": "Daily", "rows": "Days", "model": "Our model", "model_all_weeks": "Our model, all-weeks level", "benchmark": "Benchmark"}),
    {"Our model": "{:.2%}", "Our model, all-weeks level": "{:.2%}", "Benchmark": "{:.2%}"})
by_week = pd.concat([fc.error_table(backtested[backtested["week"] == w]).iloc[[0]].assign(week=w) for w in (4, 5, 6)])
by_days = P.backtest_by_day_group(backtested)
block_err = fc.block_errors()
by_block = fc.error_table(block_err, ("model", "benchmark"), "shift_demand_units")
pieces = pd.concat([by_week.assign(group="Week " + by_week["week"].astype(str)), by_days, by_block.iloc[[0]].assign(group="By block, all")])
table(pieces[["group", "rows", "model", "benchmark"]].rename(columns={"group": "Slice", "rows": "Rows", "model": "Our model", "benchmark": "Benchmark"}),
      {"Our model": "{:.2%}", "Benchmark": "{:.2%}"}, caption="Where the edge comes from")

# %% [markdown]
# The edge comes from Friday to Monday, where the benchmark's four-week averages still held holiday days. These weeks hold
# no holidays and three folds is few, so the backtest supports the method, not a claim that we beat the benchmark in the
# planning week (F-44).
#
# **Borrowing a holiday effect, and splitting days into shifts.** The only test of borrowing the data allows: train on
# weeks 1-2, whose one holiday window is the New Year rebound, and forecast the MLK Friday to Sunday with that effect.
# Then, leaving one week out at a time, compare three ways to split a day into shifts.

# %%
analog = fc.error_table(fc.analog_test(), ("model", "model_no_holiday", "benchmark"))
table(analog.assign(group=analog["group"].map(group_name)).rename(columns={
    "group": "MLK Fri-Sun", "rows": "Days", "model": "Model with the borrowed effect", "model_no_holiday": "Model without it", "benchmark": "Benchmark"}),
    {"Model with the borrowed effect": "{:.1%}", "Model without it": "{:.1%}", "Benchmark": "{:.1%}"})
table(fc.split_test().rename(columns={"option": "Shift split", "all_days": "All days", "holiday_window_days": "Holiday-window days",
                                      "front_end_holiday_window_days": "Front End, holiday-window days"}),
      {"All days": "{:.2%}", "Holiday-window days": "{:.2%}", "Front End, holiday-window days": "{:.2%}"})

# %% [markdown]
# **The planning-week forecast.** Daily model forecast, times a Valentine's Day uplift for Front End and Merchandising
# (a stated judgment, because history has no Valentine's Day, A-06; section 8 tests it), times the average shift share.
# Only Front End gets separate shares on holiday-window days, the split that won above (F-45).

# %%
show_code(fc.forecast_blocks)
daily_forecast = fc.forecast_daily()
block_forecast = fc.forecast_blocks()
week = daily_forecast.groupby("dept_id")[["model_forecast", "daily_forecast", "benchmark"]].sum()
week["vs_benchmark"] = week["daily_forecast"] / week["benchmark"] - 1
table(week.reset_index().assign(dept_id=lambda f: f["dept_id"].map(DEPT)).rename(columns={
    "dept_id": "Department", "model_forecast": "Model", "daily_forecast": "With Valentine's uplift", "benchmark": "Benchmark",
    "vs_benchmark": "Forecast vs benchmark"}), {"Model": "{:,.0f}", "With Valentine's uplift": "{:,.0f}", "Benchmark": "{:,.0f}",
                                                 "Forecast vs benchmark": "{:+.1%}"}, caption="Demand units for the week, all warehouses")
normal = daily_forecast[daily_forecast["window"] == "normal"]
print(f"On the {normal['day_date'].nunique()} normal planning days, forecast and benchmark differ by "
      f"{(normal['daily_forecast'] / normal['benchmark'] - 1).abs().mean():.2%} on average; the difference is the holiday window.")
print(f"{len(block_forecast)} open BASE blocks forecast; shifts sum to each day's forecast within "
      f"{(block_forecast.groupby(['store_id', 'dept_id', 'day_date'])['base_demand'].sum() - block_forecast.groupby(['store_id', 'dept_id', 'day_date'])['daily_forecast'].first()).abs().max():.1e}.")

# %%
hist_days = daily[daily["day_date"] >= "2026-01-15"].groupby(["dept_id", "day_date"])["demand"].sum()
plan_days = daily_forecast.groupby(["dept_id", "day_date"])[["daily_forecast", "benchmark"]].sum()
fig, axes = plt.subplots(3, 1, figsize=(7.4, 6.2), sharex=True)
for ax, (dept, name) in zip(axes, DEPT.items()):
    for start, end, text, color in [("2026-01-16", "2026-01-19", "MLK weekend", vs.BAND_NEUTRAL),
                                    ("2026-02-13", "2026-02-16", "Presidents' Day weekend", vs.BAND)]:
        x0, x1 = mdates.date2num(pd.Timestamp(start) - pd.Timedelta(hours=12)), mdates.date2num(pd.Timestamp(end) + pd.Timedelta(hours=12))
        vs.band(ax, x0, x1, text if dept == 38 else None, color=color)
    ax.plot(hist_days.loc[dept].index, hist_days.loc[dept].values, color=vs.DRAFT, label="History")
    ax.plot(plan_days.loc[dept].index, plan_days.loc[dept]["daily_forecast"], label="Our forecast", **vs.PLAN_LINE)
    ax.plot(plan_days.loc[dept].index, plan_days.loc[dept]["benchmark"], label="Benchmark", **vs.BENCHMARK_LINE)
    ax.set_ylim(0, ax.get_ylim()[1] * (1.3 if dept == 38 else 1.08))
    ax.yaxis.set_major_formatter(vs.formatter("{x:,.0f}"))
ticks = pd.date_range("2026-01-15", "2026-02-18", freq="7D")
axes[-1].set_xticks(ticks, [day_label(t) for t in ticks])
axes[1].set_ylabel("Demand units per day, all warehouses")
fig.subplots_adjust(hspace=0.42)
multi_header(fig, axes, "Daily demand: history, our forecast and the benchmark", *axes[0].get_legend_handles_labels(),
             panel_titles=list(DEPT.values()))
plt.show()

# %% [markdown]
# **Forecast uncertainty.** The held-out error per block from the backtest folds is the demand uncertainty the risk model
# uses (section 5). Feb 13-16 add more, for borrowing the holiday effect (A-11).

# %%
sd = fc.forecast_sd()
table(sd.assign(dept_id=sd["dept_id"].map(DEPT), holiday=sd["dept_id"].map(fc.HOLIDAY_FACTOR_SD)).rename(columns={
    "dept_id": "Department", "sd": "Held-out log error per block", "holiday": "Added on Feb 13-16 (A-11)"}),
    {"Held-out log error per block": "{:.2%}", "Added on Feb 13-16 (A-11)": "{:.0%}"})

# %% [markdown]
# **Takeaway:** demand is almost entirely warehouse, weekday, holiday window and weekly level. Temperature and promotions
# add nothing once those are known, and traffic would leak the answer, so none of them is in the model. The regression
# recovers the build script's holiday effects and beats the benchmark on held-out weeks, but that edge comes from days the
# benchmark's averages distorted with holidays. In the planning week the two differ mainly on the holiday weekend, whose
# effect is borrowed from MLK, so the risk model carries extra uncertainty there.

# %% [markdown]
# ## 4. Service curves
#
# **What this shows:** the fitted link between utilization and each department's service metric, the data behind it, the
# utilization limits it implies, and how well its predicted chances match what happened out of sample. (F-46, F-62 to
# F-64, V-04, D-29)
#
# The curve is fitted on log(metric / target), so 0 is exactly on target and every block's measured wait counts, not only
# whether it passed. That matters because few blocks sit near the cliff. Per department, the curve rises gently, bends
# smoothly upward and flattens at a cap, and each warehouse has its own level. The normal scatter around the curve turns a
# utilization into a chance of meeting target.

# %%
from src import service as sv

show_code(sv._bend, sv._curve, sv.Curve, sv.fit_curve)

# %%
curves = sv.fit_all(blocks)
params = pd.DataFrame([{"Department": DEPT[d], **{f"Level, W{s}": c.levels[s] for s in sv.STORES}, "Slope": c.slope,
                        "Extra slope": c.extra_slope, "Knot": c.knot, "Bend width": c.width, "Cap": c.cap, "Scatter": c.scatter}
                       for d, c in curves.items()])
table(params, {c: "{:.3f}" for c in params.columns if c != "Department"}, caption="Fitted parameters (log scale)")

# %%
u_grid = np.linspace(0.45, 1.15, 300)
fig, axes = plt.subplots(1, 3, figsize=(7.8, 3.0), sharey=True)
for ax, (dept, name) in zip(axes, DEPT.items()):
    part = blocks[blocks["dept_id"] == dept]
    ax.scatter(part["utilization"], part["service_ratio"], s=10, color=vs.DEPT[name], alpha=0.35, linewidths=0, zorder=2)
    for store in sv.STORES:
        ax.plot(u_grid, np.exp(curves[dept].log_ratio(store, u_grid)), color=vs.INK, linewidth=vs.LINE_WIDTH * 0.6, zorder=3)
    ax.axhline(1, color=vs.INK_SUBTLE, linewidth=vs.HAIRLINE, zorder=1)
    ax.set_yscale("log")
    ax.set(xlim=(0.45, 1.15), ylim=(0.12, 6))
    ax.set_yticks([0.25, 0.5, 1, 2, 4], ["0.25", "0.5", "1", "2", "4"])
    ax.minorticks_off()
    ax.set_xticks([0.5, 0.7, 0.9, 1.1])
vs.label_point(axes[0], 0.47, 1, "Target", dx=0, dy=3, ha="left")
axes[0].set_ylabel("Metric / target (log scale)")
axes[1].set_xlabel("Utilization")
fig.subplots_adjust(wspace=0.1)
proxies = [Line2D([], [], marker="o", linestyle="none", color=vs.INK_SUBTLE, markersize=4), Line2D([], [], color=vs.INK)]
multi_header(fig, axes, "History blocks and the fitted curves", proxies,
             ["Past blocks (department color)", "Fitted curve, one per warehouse"], panel_titles=list(DEPT.values()))
plt.show()

# %% [markdown]
# **Service limits.** The utilization at which a block has a 95%, 90% and 50% chance of meeting target, before any
# allowance for forecast error or callouts. The 95% limit is where the plan aims; the 50% line is where a miss becomes the
# likelier outcome, which the app calls a block's cushion.

# %%
limits = sv.limits_table(curves)
table(limits.assign(dept_id=limits["dept_id"].map(DEPT)).rename(columns={
    "dept_id": "Department", "store_id": "Warehouse", "u95": "95% chance", "u90": "90% chance", "u50": "50% chance"}),
    {"95% chance": "{:.3f}", "90% chance": "{:.3f}", "50% chance": "{:.3f}"})

# %%
u_zoom = np.linspace(0.70, 0.97, 300)
fig, ax = plt.subplots(figsize=(6.6, 3.0))
vs.band(ax, 0.85, 0.90, None, color=vs.WARNING_SOFT)
for dept, name in DEPT.items():
    for i, store in enumerate(sv.STORES):
        ax.plot(u_zoom, curves[dept].p_met(store, u_zoom) * 100, color=vs.DEPT[name], linewidth=vs.LINE_WIDTH * 0.75,
                label=name if i == 0 else None)
ax.axhline(95, color=vs.INK_SUBTLE, linewidth=vs.HAIRLINE)
vs.label_point(ax, 0.705, 95, "95% goal", dy=-4, ha="left", va="top")
ax.set(xlim=(0.70, 0.97), ylim=(0, 102), xlabel="Utilization (worked staff)", ylabel="Chance of meeting target")
ax.yaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
vs.header(ax, "Chance of meeting target, one line per warehouse")
plt.show()

# %% [markdown]
# **Out of sample.** Refit leaving one week out at a time, predict that week's blocks, and score the predicted chances
# against what happened. The Brier score is the mean squared gap between chance and outcome (lower is better). The
# reference is a flat rate: every block gets the training weeks' share meeting target.

# %%
holdout = sv.holdout_scores(blocks)
brier = ((holdout["p_met"] - holdout["met_target"]) ** 2).mean()
brier_base = ((holdout["base_rate"] - holdout["met_target"]) ** 2).mean()
print(f"Brier score over {len(holdout)} held-out blocks: curve {brier:.4f}, flat rate {brier_base:.4f}.")
cal = sv.calibration(holdout)
table(cal.rename(columns={"bin": "Predicted chance", "blocks": "Blocks", "predicted": "Mean predicted", "observed": "Share that met target"}),
      {"Mean predicted": "{:.1%}", "Share that met target": "{:.1%}"})

near = holdout[(holdout["p_met"] >= 0.70) & (holdout["p_met"] < 0.99)]
rows = []
for label, part in [("All departments", near)] + [(DEPT[d], g) for d, g in near.groupby("dept_id")]:
    gap = part["met_target"].sum() - part["p_met"].sum()
    rows.append((label, len(part), part["p_met"].mean(), part["met_target"].mean(), gap / np.sqrt((part["p_met"] * (1 - part["p_met"])).sum())))
table(pd.DataFrame(rows, columns=["Blocks predicted 70-99%", "Blocks", "Mean predicted", "Share that met target", "z (observed - predicted)"]),
      {"Mean predicted": "{:.1%}", "Share that met target": "{:.1%}", "z (observed - predicted)": "{:+.2f}"},
      caption="Near the goal, where staffing decisions are made (V-04)")

# %%
fig, ax = plt.subplots(figsize=(4.6, 3.6))
ax.plot([0, 100], [0, 100], color=vs.AXIS, linewidth=vs.HAIRLINE, zorder=1)
ax.plot(cal["predicted"] * 100, cal["observed"] * 100, color=vs.PLAN, linewidth=vs.LINE_WIDTH, label="Smooth curve, held out", **vs.MARKERS)
vs.label_point(ax, 55, 30, "Gray diagonal:\nperfect calibration", dy=0, ha="left", va="top")
ax.set(xlim=(0, 102), ylim=(0, 102), xlabel="Predicted chance (mean of each group)", ylabel="Share that met target")
ax.xaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
ax.yaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
vs.header(ax, "Predicted against observed, out of sample", legend=False)
plt.show()

# %% [markdown]
# **Takeaway:** one smooth curve per department reproduces the cliff, and the utilization that keeps a 95% chance sits
# just below it, with small differences between warehouses. Out of sample the curve's chances are far better than a flat
# rate, and they track observed rates near the goal. The first version, with a sharp kink, ran optimistic there, mostly
# in Front End, which is why we moved to the smooth bend (F-62 to F-64, D-29). The remaining assumption is that history's
# curve holds in the planning week (A-09).

# %% [markdown]
# ## 5. Risk model
#
# **What this shows:** how a block's chance of meeting target is calculated at any headcount. Three things can push a
# block over the cliff: demand above forecast, callouts that aren't backfilled, and the scatter around the service curve.
# The exact calculation is checked against a direct simulation of the same model. (F-47, D-07, D-18)
#
# First, the inputs every planning block needs: demand (BASE forecast x the scenario's multiplier), its uncertainty, and a
# callout rate for its situation.

# %%
from src import risk as rk
from src import search as sr

show_code(sr.planning_inputs)
inputs = sr.planning_inputs()
open_inputs = inputs[inputs["is_open"] == 1]
used = (open_inputs.groupby(["dept_id", "callout_context"])
        .agg(rate=("callout_rate", "first"), blocks=("callout_rate", "size")).reset_index())
used["cell"] = [f"{r:.1%}  ({b} blocks)" for r, b in zip(used["rate"], used["blocks"])]
table(used.pivot(index="dept_id", columns="callout_context", values="cell").reindex(columns=list(contexts)).rename(columns=contexts)
      .rename(index=DEPT).reset_index().rename(columns={"dept_id": "Department"}).fillna(""),
      caption="Callout rates applied in the planning week, all scenarios")
print(f"Backfill: {rk.BACKFILL_SHARE:.0%} of callouts are replaced, never more than the overtime still free in the block.")

# %%
show_code(rk.net_loss_distribution, rk.chance_met)

# %% [markdown]
# **One block, three levels of risk.** BASE, Warehouse 2 Front End, Saturday Feb 14, midday: a busy holiday-weekend
# block. The chance of meeting target at each headcount, with only the curve's scatter, then adding forecast error, then
# adding callouts (the full model). Dots are a 200,000-draw simulation of the full model at each headcount.

# %%
example = open_inputs[(open_inputs["scenario_code"] == "BASE") & (open_inputs["store_id"] == 2) & (open_inputs["dept_id"] == 38)
                      & (open_inputs["day_date"] == "2026-02-14") & (open_inputs["shift_code"] == "MID")].iloc[0]
print(f"Demand {example['demand']:.1f} units, uncertainty {example['demand_sd']:.1%}, callout rate {example['callout_rate']:.1%}, "
      f"{example['paid_hours']:g} paid hours. Available: {example['available_regular_employees']} regular, "
      f"{example['max_overtime_employees']} overtime, {example['cross_trained_flex_employees']} cross-trained.")
variants = {"Curve scatter only": example.copy(), "+ forecast error": example.copy(), "+ callouts (full model)": example}
variants["Curve scatter only"]["demand_sd"], variants["Curve scatter only"]["callout_rate"] = 1e-6, 0.0
variants["+ forecast error"]["callout_rate"] = 0.0
own_capacity = int(example["available_regular_employees"] + example["max_overtime_employees"])
heads = np.arange(max(int(example["min_staff"]), own_capacity - 14), own_capacity + 8)
chance = {name: [sr._block_chance(row, int(n), curves) for n in heads] for name, row in variants.items()}
simulated = []
for n in heads:
    room = int(example["max_overtime_employees"]) - max(0, int(n) - int(example["available_regular_employees"]))
    simulated.append(rk.monte_carlo_chance(curves[38], 2, example["demand"], example["demand_sd"], int(n), example["paid_hours"],
                                           example["standard"], example["callout_rate"], room))
print(f"Largest gap between the exact calculation and the simulation: {np.max(np.abs(np.array(chance['+ callouts (full model)']) - simulated)) * 100:.2f} points")
need = {name: next((int(n) for n, p in zip(heads, values) if p >= 0.95), None) for name, values in chance.items()}
print("People needed for a 95% chance:", need)

# %%
fig, ax = plt.subplots(figsize=(6.6, 3.2))
styles = {"Curve scatter only": {"color": vs.DRAFT}, "+ forecast error": {"color": vs.INK_SUBTLE}, "+ callouts (full model)": vs.PLAN_LINE}
for name, values in chance.items():
    line, = ax.plot(heads, np.array(values) * 100, label=name, **styles[name])
ax.plot(heads, np.array(simulated) * 100, linestyle="none", marker="o", markersize=vs.MARKER_SIZE * 0.6, color=vs.INK,
        markeredgewidth=0, label="Simulation", zorder=5)
ax.axvline(own_capacity + 0.5, color=vs.INK_SUBTLE, linewidth=vs.HAIRLINE)
vs.label_point(ax, own_capacity + 0.5, 8, "Own regular + overtime", dx=4, dy=0, ha="left", va="center")
ax.axhline(95, color=vs.AXIS, linewidth=vs.HAIRLINE)
ax.set(ylim=(0, 102), xlabel="People scheduled", ylabel="Chance of meeting target")
ax.yaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
vs.header(ax, "One block's chance of meeting target, by headcount")
plt.show()

# %% [markdown]
# **The check across many blocks.** The same comparison for 24 randomly chosen open planning blocks, at the draft's
# headcount, across all three scenarios.

# %%
sample = open_inputs.sample(24, random_state=7)
gaps_mc = []
for row in sample.itertuples():
    n = int(row.draft_scheduled_employees)
    room = int(row.max_overtime_employees) - max(0, n - int(row.available_regular_employees))
    exact = sr._block_chance(row, n, curves)
    sim = rk.monte_carlo_chance(curves[row.dept_id], row.store_id, row.demand, row.demand_sd, n, row.paid_hours, row.standard,
                                row.callout_rate, room)
    gaps_mc.append(abs(exact - sim))
print(f"Exact against simulation over {len(sample)} blocks: largest gap {max(gaps_mc) * 100:.2f} points, mean {np.mean(gaps_mc) * 100:.2f} points.")

# %% [markdown]
# **Takeaway:** allowing for forecast error and callouts moves the headcount a block needs up by a few people, and that
# allowance is what keeps the plan off the cliff on an ordinary bad day. The exact calculation agrees with the simulation
# to within simulation noise, so the search can use the fast, repeatable exact version.

# %% [markdown]
# ## 6. Allocation and cost
#
# **What this shows:** how a block's total headcount is filled and costed, a worked example, and an independent
# recomputation of the costs straight from the README's wording. (V-08, R-25, A-01, A-10)
#
# The README's rule: fill each block with available regular staff first, then with cross-trained staff from the partner
# department (Front End and Merchandising only), "limited to people that department is not already using in the same
# shift", then with overtime. How many are "not already used" isn't defined, so our reading is an assumption (A-01): the
# partner's regular staff left over after it fills its own total. Borrowed staff cost the regular rate of the block they
# cover (A-10). `apply_rule()` joins each block to its partner in the same shift and applies these three functions.

# %%
from src import allocation as al

show_code(al.usable_flex, al.allocate, al.block_cost)

# %% [markdown]
# **A worked example:** the BASE shift whose draft borrows the most cross-trained staff.

# %%
shift_key = ["scenario_code", "store_id", "day_date", "shift_code"]
base_draft = draft_ruled[(draft_ruled["scenario_code"] == "BASE") & (draft_ruled["is_open"] == 1)]
top_shift = base_draft.groupby(shift_key)["fill_flex"].sum().idxmax()
pair = base_draft[np.logical_and.reduce([base_draft[c] == v for c, v in zip(shift_key, top_shift)])].set_index("dept_id")
print(f"BASE, Warehouse {top_shift[1]}, {top_shift[2]:%a %b} {top_shift[2].day}, {top_shift[3]} shift")
steps = {}
for dept, partner in ((38, 92), (92, 38)):
    me, other = pair.loc[dept], pair.loc[partner]
    left_over = max(0, int(other["available_regular_employees"]) - int(other["draft_scheduled_employees"]))
    steps[DEPT[dept]] = [
        int(me["draft_scheduled_employees"]), int(me["available_regular_employees"]), int(other["available_regular_employees"]),
        int(other["draft_scheduled_employees"]), left_over, int(me["cross_trained_flex_employees"]), int(me["usable_flex"]),
        int(me["max_overtime_employees"]), int(me["fill_regular"]), int(me["fill_flex"]), int(me["fill_overtime"]), int(me["unfilled"]),
        f"{me['paid_hours']:g}", f"${me['loaded_regular_hourly_cost']:.2f} / ${me['loaded_overtime_hourly_cost']:.2f}", f"${me['cost']:,.2f}",
    ]
step_names = ["Total scheduled", "Own regular staff available", "Partner's regular staff available", "Partner's total", "Partner's regular staff left over",
              "Cross-trained pool", "Usable cross-trained (smaller of the two above)", "Overtime available", "Filled: regular", "Filled: cross-trained",
              "Filled: overtime", "Can't be fielded", "Paid hours", "Rate, regular / overtime", "Cost"]
table(pd.DataFrame(steps, index=step_names).reset_index().rename(columns={"index": "Step"}).astype(str))
borrower = int(pair["fill_flex"].idxmax())
me = pair.loc[borrower]
print(f"{DEPT[borrower]} cost = ({me['fill_regular']} regular + {me['fill_flex']} cross-trained) x {me['paid_hours']:g} h x ${me['loaded_regular_hourly_cost']:.2f}"
      f" + {me['fill_overtime']} overtime x {me['paid_hours']:g} h x ${me['loaded_overtime_hourly_cost']:.2f} = ${me['cost']:,.2f}")

# %% [markdown]
# **Independent recomputation.** The rule rebuilt row by row from the README, sharing no code with `src/allocation.py`,
# with rates read from `comp_LaborCostAssumption.csv`. It's applied to the draft here, and to our plan in section 7.

# %%
def readme_rule(frame, column):
    """The README's fill order and docs/ASSUMPTIONS.md section 5's cost formula, one row at a time."""
    rate = {(r.store_id, r.dept_id): (r.loaded_regular_hourly_cost, r.loaded_overtime_hourly_cost) for r in rates.itertuples()}
    rows = {(r.scenario_id, r.store_id, r.dept_id, r.day_date, r.shift_code): r for r in frame.itertuples()}
    partner_of = {38: 92, 92: 38}
    out = []
    for r in frame.itertuples():
        total, regular, overtime = int(getattr(r, column)), int(r.available_regular_employees), int(r.max_overtime_employees)
        usable = 0
        partner = rows.get((r.scenario_id, r.store_id, partner_of.get(r.dept_id), r.day_date, r.shift_code))
        if partner is not None:
            partner_using = min(int(getattr(partner, column)), int(partner.available_regular_employees))
            usable = min(int(r.cross_trained_flex_employees), int(partner.available_regular_employees) - partner_using)
        fill_regular = min(total, regular)
        fill_flex = min(total - fill_regular, usable)
        fill_overtime = min(total - fill_regular - fill_flex, overtime)
        regular_rate, overtime_rate = rate[(r.store_id, r.dept_id)]
        out.append({"i_capacity": regular + usable + overtime, "i_usable_flex": usable, "i_fill_regular": fill_regular, "i_fill_flex": fill_flex,
                    "i_fill_overtime": fill_overtime, "i_unfilled": total - fill_regular - fill_flex - fill_overtime,
                    "i_cost": (fill_regular + fill_flex) * r.paid_hours * regular_rate + fill_overtime * r.paid_hours * overtime_rate})
    return pd.concat([frame[[*PLAN_KEY, "scenario_code", "is_open", "paid_hours", column]].reset_index(drop=True), pd.DataFrame(out)], axis=1)


def check_costs(engine, column):
    """Compare the engine's allocation and cost with the independent rebuild, block by block and by scenario."""
    both = readme_rule(engine, column).merge(engine[[*PLAN_KEY, "capacity", "usable_flex", "fill_regular", "fill_flex", "fill_overtime", "unfilled", "cost"]],
                                             on=PLAN_KEY, validate="one_to_one")
    worst = {name: float((both["i_" + name] - both[name]).abs().max())
             for name in ["capacity", "usable_flex", "fill_regular", "fill_flex", "fill_overtime", "unfilled", "cost"]}
    opened = both[both["is_open"] == 1]
    totals = opened.groupby("scenario_code", sort=False)[["cost", "i_cost"]].sum().reindex(SCENARIOS)
    totals["gap"] = totals["i_cost"] - totals["cost"]
    return both, worst, totals


draft_check, worst, totals = check_costs(draft_ruled, "draft_scheduled_employees")
print("Largest per-block gap between the engine and the rebuild:", {k: round(v, 9) for k, v in worst.items()})
table(totals.reset_index().rename(columns={"scenario_code": "Scenario", "cost": "Draft cost, engine", "i_cost": "Draft cost, rebuilt", "gap": "Gap"}),
      {"Draft cost, engine": "${:,.2f}", "Draft cost, rebuilt": "${:,.2f}", "Gap": "{:+.6f}"})
unfieldable = draft_check[draft_check["i_unfilled"] > 0].merge(rates, on=["store_id", "dept_id"])
extra = (unfieldable["i_unfilled"] * unfieldable["paid_hours"] * unfieldable["loaded_overtime_hourly_cost"]).sum()
print(f"The draft schedules {int(unfieldable['i_unfilled'].sum())} people who can't be fielded, in {len(unfieldable)} DISRUPT blocks. Costs cover only "
      f"staff who can be fielded; paying those people at overtime would add {money(extra)} (the README doesn't say how to cost them).")
assert all(v < 1e-6 for v in worst.values()), "The engine and the README rebuild disagree"

# %% [markdown]
# **Takeaway:** the cost rule is simple and fully traceable, and two independent implementations agree on every block of
# the draft. The one open question is a matter of reading: what "not already using" means for cross-trained staff (A-01).
# The draft's DISRUPT cost covers only the people who can actually be fielded.

# %% [markdown]
# ## 7. Staffing search
#
# **What this shows:** the search that sets every block's headcount, one shift's search laid out as a grid, the plans for
# all three scenarios against the draft, where capacity runs out, an independent check that the search finds the best
# answer under its rule, and the reason attached to every block. (F-48, F-50, V-07, D-06, D-17)
#
# Front End and Merchandising are searched together in each shift because they share cross-trained staff; Pharmacy is
# searched alone. No solver is needed: each shift has at most a few hundred feasible pairs, so the search tries them all
# and keeps the best by, in order, (1) the sum of the departments' chances of meeting target, each capped at the service
# goal (A-13); (2) the fewest hours short of need; (3) the lowest cost. A department only lends people it doesn't need
# itself (D-17).

# %%
show_code(sr.needed_employees, sr.solve_pair, sr.solve_single, sr.build_plan)
print(f"Service goal: {sr.SERVICE_GOAL:.0%}. Scores are compared to {sr.SCORE_DECIMALS} decimals.")

# %% [markdown]
# **One shift's search.** The same busy shift as in section 5: BASE, Warehouse 2, Saturday Feb 14, midday. Every
# combination of Front End and Merchandising headcounts, using the search's own helper functions. Gray cells are
# infeasible under the allocation rule; the lines mark each department's floor (D-17); the ring is the search's pick.

# %%
goal = sr.SERVICE_GOAL
shift_rows = open_inputs[(open_inputs["scenario_code"] == "BASE") & (open_inputs["store_id"] == 2) & (open_inputs["day_date"] == "2026-02-14")
                         & (open_inputs["shift_code"] == "MID")]
front, merch = (next(shift_rows[shift_rows["dept_id"] == d].itertuples()) for d in (38, 92))
f_n, f_p = sr._chances(front, curves)
m_n, m_p = sr._chances(merch, curves)
f_need, m_need = sr.needed_employees(front, curves, goal), sr.needed_employees(merch, curves, goal)
f_floor = min(f_need, int(front.available_regular_employees + front.max_overtime_employees))
m_floor = min(m_need, int(merch.available_regular_employees + merch.max_overtime_employees))
F, M = np.meshgrid(f_n, m_n, indexing="ij")
f_usable = al.usable_flex(front.cross_trained_flex_employees, merch.available_regular_employees, M)
m_usable = al.usable_flex(merch.cross_trained_flex_employees, front.available_regular_employees, F)
feasible = ((F <= front.available_regular_employees + front.max_overtime_employees + f_usable)
            & (M <= merch.available_regular_employees + merch.max_overtime_employees + m_usable))
score = np.minimum(f_p, goal)[:, None] + np.minimum(m_p, goal)[None, :]
pair_cost = sr._cost(F, front, f_usable) + sr._cost(M, merch, m_usable)
pick = sr.solve_pair(front, merch, curves, goal)
i, j = list(f_n).index(pick[0]), list(m_n).index(pick[1])
print(f"Need for a {goal:.0%} chance: Front End {f_need}, Merchandising {m_need}. Floors (need, capped at own regular + overtime): {f_floor}, {m_floor}.")
print(f"{int(feasible.sum())} feasible pairs of {feasible.size}. The search picks Front End {pick[0]} and Merchandising {pick[1]}: chances "
      f"{f_p[i]:.1%} and {m_p[j]:.1%}, score {score[i, j]:.3f}, cost {money(pair_cost[i, j])}.")
print(f"Best score among all feasible pairs: {np.nanmax(np.where(feasible, np.round(score, sr.SCORE_DECIMALS), np.nan)):.3f}")

# %%
shown_f, shown_m = f_n >= f_floor - 12, m_n >= m_floor - 9
fig, axes = plt.subplots(1, 2, figsize=(8.2, 3.9), sharey=True)
panels = [(np.where(feasible, score, np.nan), [vs.ACCENT_SOFT, vs.COLORS["accent_line"], vs.ACCENT, vs.COLORS["accent_strong"]], "Score: sum of capped chances"),
          (np.where(feasible, pair_cost / 1000, np.nan), [vs.RAISED, vs.DRAFT_SOFT, vs.DRAFT, vs.INK_MUTED], "Cost of the pair, $K")]
for ax, (values, stops, name) in zip(axes, panels):
    mesh = ax.pcolormesh(m_n[shown_m], f_n[shown_f], values[np.ix_(shown_f, shown_m)], shading="nearest", edgecolors=vs.SURFACE,
                         linewidth=0.4, cmap=matplotlib.colors.LinearSegmentedColormap.from_list(name, stops))
    ax.set_facecolor(vs.BAND_NEUTRAL)
    ax.axhline(f_floor - 0.5, color=vs.INK, linewidth=vs.HAIRLINE * 1.5)
    ax.axvline(m_floor - 0.5, color=vs.INK, linewidth=vs.HAIRLINE * 1.5)
    for size, color in ((14, vs.SURFACE), (11, vs.INK)):
        ax.plot([pick[1]], [pick[0]], marker="o", markersize=size, markerfacecolor="none", markeredgecolor=color, markeredgewidth=2.2, zorder=5)
    ax.grid(False)
    ax.xaxis.set_major_locator(matplotlib.ticker.MaxNLocator(integer=True))
    ax.yaxis.set_major_locator(matplotlib.ticker.MaxNLocator(integer=True))
    ax.set_xlabel("Merchandising headcount")
    bar = fig.colorbar(mesh, ax=ax, fraction=0.06, pad=0.03)
    bar.outline.set_visible(False)
    bar.ax.tick_params(labelsize=vs.TICK_SIZE * 0.9)
axes[0].set_ylabel("Front End headcount")
multi_header(fig, axes, "One shift's search: every feasible pair, scored and costed", panel_titles=[p[2] for p in panels])
plt.show()

# %% [markdown]
# **The plans.** The search run on every shift of all three scenarios, then every plan and the draft scored by the same
# allocation rule and risk model. Expected service is the average chance of meeting target across open blocks, a
# prediction from the model, not a measured result.

# %%
plan = sr.build_plan(inputs, curves)
evaluated = sr.evaluate(plan, "recommended", curves)
draft = sr.evaluate(plan, "draft_scheduled_employees", curves)
summary, draft_summary = sr.summarize(evaluated).set_index("scenario_code"), sr.summarize(draft).set_index("scenario_code")
rows_out = {
    "Labor cost, draft": [money(draft_summary.loc[s, "cost"]) for s in SCENARIOS],
    "Labor cost, plan": [money(summary.loc[s, "cost"]) for s in SCENARIOS],
    "Change in cost": [f"{summary.loc[s, 'cost'] / draft_summary.loc[s, 'cost'] - 1:+.1%}" for s in SCENARIOS],
    "Hours, draft": [f"{draft_summary.loc[s, 'hours']:,.1f}" for s in SCENARIOS],
    "Hours, plan": [f"{summary.loc[s, 'hours']:,.1f}" for s in SCENARIOS],
    "Expected service, draft": [f"{draft_summary.loc[s, 'expected_met']:.1%}" for s in SCENARIOS],
    "Expected service, plan": [f"{summary.loc[s, 'expected_met']:.1%}" for s in SCENARIOS],
    "Blocks above capacity, draft": [int(draft_summary.loc[s, "over_capacity"]) for s in SCENARIOS],
    "Blocks above capacity, plan": [int(summary.loc[s, "over_capacity"]) for s in SCENARIOS],
    "Blocks below the 95% goal, plan": [int(summary.loc[s, "below_goal"]) for s in SCENARIOS],
    "Overtime hours, plan": [f"{summary.loc[s, 'overtime_hours']:,.1f}" for s in SCENARIOS],
}
table(pd.DataFrame(rows_out, index=SCENARIOS).T.reset_index().rename(columns={"index": "All warehouses"}).astype(str))

# %%
fig, axes = plt.subplots(1, 2, figsize=(8.0, 2.7), sharey=True)
y = np.arange(len(SCENARIOS))
for ax, (column, scale, fmt, label) in zip(axes, [("expected_met", 100, "{:.1f}%", "Expected service"), ("cost", 1e-3, "${:,.0f}K", "Labor cost")]):
    ax.set_ylim(len(SCENARIOS) - 0.5, -0.5)
    ax.grid(axis="y", visible=False)
    ax.grid(axis="x", visible=True)
    ax.spines["bottom"].set_visible(False)
    ax.spines["left"].set_visible(True)
    offsets = vs.group_offsets(ax, 2, axis="y")
    for offset, (name, frame, color, ink) in zip(offsets, [("Current draft", draft_summary, vs.DRAFT, vs.LABEL), ("Our plan", summary, vs.PLAN, vs.INK)]):
        values = frame.loc[SCENARIOS, column] * scale
        bars = vs.bars(ax, y, values, color=color, offset=offset, horizontal=True, label=name)
        ax.bar_label(bars, labels=[fmt.format(v) for v in values], padding=4, color=ink, fontsize=vs.TICK_SIZE)
    vs.zero_based(ax, top=(125 if column == "expected_met" else values.max() * 1.3), axis="x")
    ax.xaxis.set_major_formatter(vs.formatter("{x:.0f}%" if column == "expected_met" else "${x:,.0f}K"))
    ax.set_xlabel(label)
axes[0].set_yticks(y, SCENARIOS)
axes[0].set_xticks([0, 25, 50, 75, 100])
fig.subplots_adjust(wspace=0.12)
multi_header(fig, axes, "Plan against the draft, all warehouses", *axes[0].get_legend_handles_labels())
plt.show()

# %% [markdown]
# **The plan's costs, rebuilt independently** with the section 6 function.

# %%
plan_check, worst, totals = check_costs(evaluated, "recommended")
print("Largest per-block gap between the engine and the rebuild:", {k: round(v, 9) for k, v in worst.items()})
table(totals.reset_index().rename(columns={"scenario_code": "Scenario", "cost": "Plan cost, engine", "i_cost": "Plan cost, rebuilt", "gap": "Gap"}),
      {"Plan cost, engine": "${:,.2f}", "Plan cost, rebuilt": "${:,.2f}", "Gap": "{:+.6f}"})
assert all(v < 1e-6 for v in worst.values()), "The engine and the README rebuild disagree on the plan"

# %% [markdown]
# **Where capacity runs out.** A block's need is the smallest headcount reaching the goal, ignoring capacity. Blocks
# still below the goal are short of need, and the people short are counted by day.

# %%
capacity_short = P.capacity_gaps(evaluated, curves)
by_day = capacity_short.pivot_table(index="scenario_code", columns="day_date", values="gap_people", aggfunc="sum", fill_value=0).reindex(SCENARIOS)
by_day.columns = [f"{d:%a} {day_label(d)}" for d in by_day.columns]
by_day["Total"] = by_day.sum(axis=1)
table(by_day.reset_index().rename(columns={"scenario_code": "People short of need"}))
open_plan = evaluated[evaluated["is_open"] == 1]
below = open_plan[open_plan["chance_met"] < goal - 0.0005]
maxed = below["recommended"] >= below["available_regular_employees"] + below["max_overtime_employees"]
print(f"Blocks below the goal: {len(below)}. Of these, {int(maxed.sum())} already use all their own regular staff and overtime; "
      f"their average chance of meeting target is {below['chance_met'].mean():.1%}.")
below_by_day = below.pivot_table(index="scenario_code", columns="day_date", values="chance_met", aggfunc="size", fill_value=0).reindex(SCENARIOS)
below_by_day.columns = [f"{d:%a} {day_label(d)}" for d in below_by_day.columns]
table(below_by_day.reset_index().rename(columns={"scenario_code": "Blocks below the goal"}))

# %% [markdown]
# **Is each pick the best one?** An independent brute force over every pair in every open shift, written from the rule as
# stated at the top of this section. It scores headcounts with the fitted curves and `chance_met()` only, and doesn't
# call the search or the allocation code. (V-07)

# %%
def b_chance(b, n):
    room = int(b.max_overtime_employees) - max(0, n - int(b.available_regular_employees))
    return rk.chance_met(curves[b.dept_id], b.store_id, b.demand, b.demand_sd, n, b.paid_hours, b.standard, b.callout_rate, room)


def b_need(b):
    limit, n = 3 * int(b.available_regular_employees + b.max_overtime_employees + b.cross_trained_flex_employees) + 20, int(b.min_staff)
    while n < limit and b_chance(b, n) < goal:
        n += 1
    return n


def b_cost(b, n, usable):
    regular = min(n, int(b.available_regular_employees))
    flex = min(n - regular, usable)
    overtime = min(n - regular - flex, int(b.max_overtime_employees))
    return (regular + flex) * b.paid_hours * b.loaded_regular_hourly_cost + overtime * b.paid_hours * b.loaded_overtime_hourly_cost


def brute_pair(fe, me):
    """Every (Front End, Merchandising) pair; returns the best with and without the D-17 floors, ties and pair count."""
    own = lambda b: int(b.available_regular_employees + b.max_overtime_employees)
    span = lambda b: range(int(b.min_staff), max(own(b) + int(b.cross_trained_flex_employees), int(b.min_staff)) + 1)
    pf, pm = {n: b_chance(fe, n) for n in span(fe)}, {n: b_chance(me, n) for n in span(me)}
    need_f, need_m = b_need(fe), b_need(me)
    rows = []
    for f, p_f in pf.items():
        for m, p_m in pm.items():
            usable_f = min(int(fe.cross_trained_flex_employees), max(0, int(me.available_regular_employees) - m))
            usable_m = min(int(me.cross_trained_flex_employees), max(0, int(fe.available_regular_employees) - f))
            if f > own(fe) + usable_f or m > own(me) + usable_m:
                continue
            rows.append((-round(min(p_f, goal) + min(p_m, goal), 3), max(0, need_f - f) * fe.paid_hours + max(0, need_m - m) * me.paid_hours,
                         b_cost(fe, f, usable_f) + b_cost(me, m, usable_m), f, m, f >= min(need_f, own(fe)) and m >= min(need_m, own(me))))
    guarded = [r for r in rows if r[5]]
    best, unguarded = min(guarded, key=lambda r: r[:3]), min(rows, key=lambda r: r[:3])
    ties = sum(r[:2] == best[:2] and abs(r[2] - best[2]) < 1e-9 for r in guarded)
    return (best[3], best[4]), (unguarded[3], unguarded[4]), ties, len(rows)


def brute_single(b):
    need, top = b_need(b), max(int(b.available_regular_employees + b.max_overtime_employees), int(b.min_staff))
    return min((-round(min(b_chance(b, n), goal), 3), max(0, need - n) * b.paid_hours, b_cost(b, n, 0), n) for n in range(int(b.min_staff), top + 1))[3]


tally = {"shifts": 0, "pairs agree": 0, "pharmacy blocks": 0, "pharmacy agree": 0, "D-17 guard changes the pick": 0, "tied best pairs": 0, "pairs tried": 0}
disagree = []
for key, shift in open_plan.groupby(["scenario_code", "store_id", "day_date", "shift_code"], sort=False):
    depts = {r.dept_id: r for r in shift.itertuples()}
    best, unguarded, ties, tried = brute_pair(depts[38], depts[92])
    planned = (int(depts[38].recommended), int(depts[92].recommended))
    tally["shifts"] += 1
    tally["pairs agree"] += best == planned
    tally["D-17 guard changes the pick"] += unguarded != best
    tally["tied best pairs"] += ties > 1
    tally["pairs tried"] += tried
    if best != planned:
        disagree.append((key, planned, best))
    if 95 in depts:
        tally["pharmacy blocks"] += 1
        tally["pharmacy agree"] += brute_single(depts[95]) == int(depts[95].recommended)
print(tally)
print("Disagreements:", disagree or "none")
assert tally["pairs agree"] == tally["shifts"] and tally["pharmacy agree"] == tally["pharmacy blocks"], "The brute force found a better pick"

# %% [markdown]
# **A reason for every block.** Each block's explanation is a template filled with that block's own numbers, so it can't
# invent a reason and reads the same in every demo (D-08). The main sentence comes from `why_text()`.

# %%
from src import explain as ex

show_code(ex.why_text)
explained = ex.explain_plan(evaluated, draft, curves)
base_open = explained[(explained["scenario_code"] == "BASE") & (explained["is_open"] == 1)]
examples = {"Largest addition": base_open.sort_values("change", ascending=False).iloc[0],
            "Largest cut": base_open.sort_values("change").iloc[0], "Lowest chance": base_open.sort_values("chance_met").iloc[0]}
table(pd.DataFrame([(name, f"Warehouse {r['store_id']}, {ex.block_label(r)}", r["headline"], r["why"]) for name, r in examples.items()],
                   columns=["BASE example", "Block", "Headline", "Why"]))

# %% [markdown]
# **Takeaway:** moving and adding hours lifts expected service sharply in every scenario for a moderate rise in cost, and
# no block is above capacity. What no schedule can fix is capacity itself: the blocks still below the goal already use
# all their own regular staff and overtime, and they cluster on the holiday weekend. Two independent rebuilds confirm the
# costs and that every pick is the best one under the stated rule.

# %% [markdown]
# ## 8. Trade-offs
#
# **What this shows:** what the plan's main choices cost and what they buy: the 95% service goal, the allowance for
# forecast error and callouts, limiting holiday-weekend PTO, and the Valentine's Day uplift. Each one reruns the search
# with a single input changed, using the functions in `src/pipeline.py` and `src/playbook.py`. (F-49, F-51, F-55, F-52)
#
# **The service goal.** The plan aims each block at a 95% chance of meeting target (A-13). Here is BASE at other goals.

# %%
tradeoff = P.goal_tradeoff(inputs, curves)
base_trade = tradeoff[tradeoff["scenario_code"] == "BASE"].copy()
base_trade["per_point"] = base_trade["cost"].diff() / (base_trade["expected_met"].diff() * 100)
table(base_trade[["goal", "cost", "hours", "expected_met", "below_goal", "overtime_hours", "per_point"]].rename(columns={
    "goal": "Service goal", "cost": "Cost", "hours": "Hours", "expected_met": "Expected service", "below_goal": "Blocks below goal",
    "overtime_hours": "Overtime hours", "per_point": "Extra cost per point of service"}),
    {"Service goal": "{:.1%}", "Cost": money, "Hours": "{:,.1f}", "Expected service": "{:.1%}", "Overtime hours": "{:,.1f}",
     "Extra cost per point of service": lambda v: "" if pd.isna(v) else money(v)}, caption="BASE")

# %%
draft_base = draft_summary.loc["BASE"]
fig, ax = plt.subplots(figsize=(6.6, 3.1))
ax.plot(base_trade["cost"] / 1000, base_trade["expected_met"] * 100, label="Our plan at each service goal", **vs.PLAN_LINE, **vs.MARKERS)
places = {0.85: (0, 8, "center", "bottom"), 0.90: (2, -9, "center", "top"), 0.925: (-4, 8, "center", "bottom"),
          0.95: (6, -8, "left", "top"), 0.975: (0, 8, "center", "bottom"), 0.99: (0, 8, "center", "bottom")}
for row in base_trade.itertuples():
    chosen = abs(row.goal - sr.SERVICE_GOAL) < 1e-9
    dx, dy, ha, va = places[round(row.goal, 3)]
    vs.label_point(ax, row.cost / 1000, row.expected_met * 100, f"{row.goal * 100:g}% goal (chosen)" if chosen else f"{row.goal * 100:g}%",
                   dx=dx, dy=dy, ha=ha, va=va, color=vs.INK if chosen else vs.LABEL, fontweight="semibold" if chosen else "normal")
ax.plot([draft_base["cost"] / 1000], [draft_base["expected_met"] * 100], color=vs.DRAFT, linestyle="none", label="Current draft", **vs.MARKERS)
vs.label_point(ax, draft_base["cost"] / 1000, draft_base["expected_met"] * 100, "Current draft", dx=9, dy=0, ha="left", va="center")
ax.set(xlabel="BASE labor cost for the week", ylabel="Expected service", ylim=(65, 102))
ax.xaxis.set_major_formatter(vs.formatter("${x:.0f}K"))
ax.yaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
vs.header(ax, "Cost against expected service, BASE")
plt.show()

# %% [markdown]
# **The allowance for risk.** The case doesn't say whether judging applies callouts to submitted totals (Q-02), so three
# plans are each scored three ways: with both risks, with forecast error only, and with neither (A-03).

# %%
buffer = P.buffer_test(inputs, curves)
base_buffer = buffer[buffer["scenario_code"] == "BASE"]
table(base_buffer[["plan", "cost", "hours", "met_both_risks", "met_forecast_error_only", "met_neither"]].rename(columns={
    "plan": "Plan (BASE)", "cost": "Cost", "hours": "Hours", "met_both_risks": "Expected service: both risks",
    "met_forecast_error_only": "Forecast error only", "met_neither": "Neither"}),
    {"Cost": money, "Hours": "{:,.1f}", "Expected service: both risks": "{:.1%}", "Forecast error only": "{:.1%}", "Neither": "{:.1%}"})
costs = base_buffer.set_index("plan")["cost"]
print(f"The callout allowance costs {money(costs.iloc[0] - costs.iloc[1])}; the forecast-error allowance {money(costs.iloc[1] - costs.iloc[2])}.")

# %% [markdown]
# **Limiting holiday PTO.** Holiday-weekend PTO takes people out of Feb 14-16 (F-32). If some approvals can still be
# limited (A-16), how much does keeping up to N of those people per block help? Never more than the block lost.

# %%
from src.playbook import PTO_NOTE, pto_drop, pto_what_if

show_code(pto_what_if)
base_inputs = inputs[inputs["scenario_code"] == "BASE"]
weekend = base_inputs["availability_note"].eq(PTO_NOTE) & base_inputs["day_date"].isin(pd.to_datetime(["2026-02-14", "2026-02-15"]))
print("Regular staff lost to PTO per block on Feb 14-15, against the last three normal weeks:",
      {DEPT[d]: round(v, 1) for d, v in pto_drop(base_inputs)[weekend].groupby(base_inputs.loc[weekend, "dept_id"]).mean().items()})
pto = pto_what_if(inputs, curves)
table(pto.rename(columns={"kept_per_block": "Kept per block", "people_kept": "Employee shifts kept", "blocks_below_goal": "Blocks below goal",
                          "below_goal_with_holiday_pto": "Of those, with holiday PTO", "expected_met": "Expected service", "cost": "Cost",
                          "overtime_hours": "Overtime hours"}), {"Expected service": "{:.1%}", "Cost": money, "Overtime hours": "{:,.1f}"},
      caption="BASE")

# %% [markdown]
# **The Valentine's Day uplift.** History has no Valentine's Day, so the 3% uplift for Front End and Merchandising on
# Feb 14 is a judgment (A-06). The plan is held fixed and scored against other true uplifts, next to what planning for
# each would have given.

# %%
show_code(P.valentine_sensitivity)
valentine = P.valentine_sensitivity(curves, plan)
table(valentine.rename(columns={"true_uplift": "True uplift", "our_plan_expected_met": "Our plan's expected service",
                                "replanned_expected_met": "If planned for it", "replanned_feb14_cost": "Feb 14 cost if planned for it",
                                "our_plan_feb14_cost": "Our plan's Feb 14 cost"}),
      {"True uplift": "{:.0%}", "Our plan's expected service": "{:.1%}", "If planned for it": "{:.1%}",
       "Feb 14 cost if planned for it": money, "Our plan's Feb 14 cost": money}, caption="BASE, Front End and Merchandising on Feb 14")

# %% [markdown]
# **Takeaway:** each extra point of expected service costs more than the last, and the 95% goal sits before the steepest
# part of the curve. The extra cost over the draft is the price of allowing for forecast error and callouts; moving hours
# alone, at about the draft's cost, already beats the draft under every assumption about how judging treats callouts.
# Limiting holiday PTO is the strongest single lever: fewer blocks miss the goal, and cost falls as regular staff replace
# overtime. The Valentine's uplift barely matters, because most of those blocks are at capacity either way.

# %% [markdown]
# ## 9. Scenarios
#
# **What this shows:** how BASE, PEAK and DISRUPT differ in what they change, and how the plans compare by day and by
# department. Every scenario's availability is read from the grid, never from the documents' descriptions, because
# DISRUPT changes more than they say (F-08). (R-08, F-08, F-10, F-19)

# %%
block_key = ["store_id", "dept_id", "day_date", "shift_code"]
fields = ["available_regular_employees", "max_overtime_employees", "cross_trained_flex_employees"]
base_grid = grid[grid["scenario_code"] == "BASE"].set_index(block_key)
workload = open_inputs.assign(workload=open_inputs["demand"] * open_inputs["standard"])
base_workload = workload[workload["scenario_code"] == "BASE"]["workload"].sum()
scenario_rows = []
for scenario in SCENARIOS:
    g = grid[grid["scenario_code"] == scenario].set_index(block_key)
    w = workload[workload["scenario_code"] == scenario]
    scenario_rows.append((scenario, f"{g['demand_multiplier'].min():.2f} to {g['demand_multiplier'].max():.2f}", int((g["demand_multiplier"] != 1).sum()),
                          w["workload"].sum() / base_workload - 1, int((g[fields] != base_grid.loc[g.index, fields]).any(axis=1).sum()),
                          int(g["available_regular_employees"].sum()), int(g["max_overtime_employees"].sum()),
                          int(grid[grid["scenario_code"] == scenario]["draft_scheduled_employees"].sum())))
table(pd.DataFrame(scenario_rows, columns=["Scenario", "Demand multipliers", "Blocks with demand changed", "Workload hours vs BASE",
                                           "Blocks with availability changed", "Regular staff available", "Overtime available", "Draft total"]),
      {"Workload hours vs BASE": "{:+.1%}"})
notes = grid[grid["scenario_code"] == "DISRUPT"]["availability_note"].fillna("")
print("DISRUPT's availability notes:", sorted(n for n in notes.unique() if n.startswith(("Illness", "Receiving"))))

# %%
pair_keys = [*PLAN_KEY]
merged = open_plan.merge(draft[[*pair_keys, "chance_met", "cost", "hours"]], on=pair_keys, suffixes=("", "_draft"))
daily_plan = (merged.groupby(["scenario_code", "day_date"], as_index=False, sort=False)
              .agg(hours=("hours", "sum"), hours_draft=("hours_draft", "sum"), expected_met=("chance_met", "mean"),
                   expected_met_draft=("chance_met_draft", "mean")))
by_dept = (merged.groupby(["scenario_code", "dept_id"], as_index=False, sort=False)
           .agg(hours=("hours", "sum"), hours_draft=("hours_draft", "sum"), cost=("cost", "sum"), cost_draft=("cost_draft", "sum"),
                expected_met=("chance_met", "mean"), expected_met_draft=("chance_met_draft", "mean")))
by_dept["department"] = by_dept["dept_id"].map(DEPT)
days = sorted(daily_plan["day_date"].unique())
fig, axes = plt.subplots(2, 3, figsize=(8.4, 4.9), sharex=True, sharey="row")
for col, scenario in enumerate(SCENARIOS):
    part = daily_plan[daily_plan["scenario_code"] == scenario].sort_values("day_date")
    x = np.arange(len(part))
    for row, (plan_col, draft_col, scale) in enumerate([("hours", "hours_draft", 1), ("expected_met", "expected_met_draft", 100)]):
        ax = axes[row, col]
        vs.band(ax, 0.5, 4.5, None)
        ax.plot(x, part[draft_col] * scale, label="Current draft", **vs.DRAFT_LINE, **vs.MARKERS)
        ax.plot(x, part[plan_col] * scale, label="Our plan", **vs.PLAN_LINE, **vs.MARKERS)
        ax.set_xticks(x, [str(pd.Timestamp(d).day) for d in part["day_date"]])
        ax.set_xlim(-0.4, len(part) - 0.6)
axes[1, 1].set_xlabel("Day of February 2026")
axes[0, 0].set_ylabel("Hours")
axes[1, 0].set_ylabel("Expected service")
axes[0, 0].yaxis.set_major_formatter(vs.formatter("{x:,.0f}"))
axes[1, 0].yaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
axes[1, 0].set_ylim(0, 105)
fig.subplots_adjust(wspace=0.08, hspace=0.38)
multi_header(fig, axes, "Hours and expected service by day (holiday weekend shaded)", *axes[0, 0].get_legend_handles_labels(),
             panel_titles=SCENARIOS + [""] * 3)
plt.show()

# %%
dept_table = by_dept.assign(change=by_dept["cost"] / by_dept["cost_draft"] - 1)[
    ["scenario_code", "department", "hours_draft", "hours", "cost_draft", "cost", "change", "expected_met_draft", "expected_met"]]
table(dept_table.rename(columns={"scenario_code": "Scenario", "department": "Department", "hours_draft": "Hours, draft", "hours": "Hours, plan",
                                 "cost_draft": "Cost, draft", "cost": "Cost, plan", "change": "Cost change",
                                 "expected_met_draft": "Expected service, draft", "expected_met": "Expected service, plan"}),
      {"Hours, draft": "{:,.1f}", "Hours, plan": "{:,.1f}", "Cost, draft": money, "Cost, plan": money, "Cost change": "{:+.1%}",
       "Expected service, draft": "{:.1%}", "Expected service, plan": "{:.1%}"})

# %% [markdown]
# **Takeaway:** the draft is the same schedule in all three scenarios, while the plans respond to each. PEAK changes only
# demand, concentrated on the holiday weekend, so its plan adds hours there, and it ends with the lowest expected service
# because the surge lands on days that are already at capacity. DISRUPT cuts availability, so its plan has fewer hours than
# BASE, yet it still improves on the draft, which schedules people who aren't there. In every scenario the plan gains most
# on the holiday weekend, where the draft is weakest.

# %% [markdown]
# ## 10. Submission
#
# **What this shows:** the template filled by joining on keys (never by row position, because the template is sorted by
# shift name), our validator's result, and an independent check of the file we submit. (R-03, F-15, F-35, F-67)

# %%
from src import submission as sb


def read_output(name, tries=12):
    """Read a file from outputs/, retrying briefly in case the pipeline is rewriting it."""
    for attempt in range(tries):
        try:
            return (ROOT / "outputs" / name).read_bytes()
        except OSError:
            if attempt == tries - 1:
                raise
            time.sleep(10)


show_code(sb.fill_template)
filled = sb.fill_template(plan)
problems = sb.validate(filled)
print("Validator:", problems or "no problems")
print("Final check, which also requires the real team name:", sb.validate(filled, final=True))
with tempfile.TemporaryDirectory() as folder:
    sb.write_submission(filled, Path(folder) / "filled.csv")
    rebuilt_bytes = (Path(folder) / "filled.csv").read_bytes()
table(filled[["team_id", "scenario_code", "store_id", "dept_id", "day_date", "shift_code", "is_open", "min_staff",
              "draft_scheduled_employees", "submitted_employees"]].head(4), caption="The first rows, in the template's own order")

# %%
import io

submitted_bytes = read_output("TEAM_SUBMISSION_TEMPLATE_filled.csv")
sub = pd.read_csv(io.BytesIO(submitted_bytes), dtype=str, keep_default_na=False)
blank = pd.read_csv(CSV_DIR / "TEAM_SUBMISSION_TEMPLATE.csv", dtype=str, keep_default_na=False)
whole = sub["submitted_employees"].str.fullmatch(r"\d+").all()
as_int = sub.assign(**{c: sub[c].astype(int) for c in ["scenario_id", "store_id", "dept_id"]}, day_date=pd.to_datetime(sub["day_date"]),
                    submitted=pd.to_numeric(sub["submitted_employees"], errors="coerce"))
facts = grid.merge(as_int[[*PLAN_KEY, "submitted"]], on=PLAN_KEY, how="left", validate="one_to_one")
ruled_sub = readme_rule(facts, "submitted")
opened = facts["is_open"] == 1
plan_values = plan.set_index(PLAN_KEY)["recommended"]
v02 = [
    ("Same columns as the template", list(sub.columns) == list(blank.columns)),
    ("567 rows, one per key, no duplicates", len(sub) == 567 and not sub.duplicated(PLAN_KEY).any()),
    ("Key set equals the template's", set(map(tuple, sub[PLAN_KEY].values.tolist())) == set(map(tuple, blank[PLAN_KEY].values.tolist()))),
    ("Every other template column unchanged", all((sub[c] == blank.set_index(PLAN_KEY).loc[list(map(tuple, sub[PLAN_KEY].values.tolist())), c].to_numpy()).all()
                                                  for c in blank.columns if c not in PLAN_KEY + ["team_id", "submitted_employees"])),
    ("Every value a whole number of 0 or more", bool(whole)),
    (f"All {int((~opened).sum())} closed blocks are 0", bool((facts.loc[~opened, "submitted"] == 0).all())),
    ("Every open block at or above min_staff", bool((facts.loc[opened, "submitted"] >= facts.loc[opened, "min_staff"]).all())),
    ("Every block within capacity under the README rule", bool((ruled_sub["i_unfilled"] == 0).all())),
    ("Equals this notebook's plan", bool((as_int.set_index(PLAN_KEY)["submitted"] == plan_values.reindex(as_int.set_index(PLAN_KEY).index)).all())),
    ("Byte-identical to this notebook's rebuild of the file", submitted_bytes == rebuilt_bytes),
]
table(pd.DataFrame(v02, columns=["Check of outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv", "Pass"]))
at_capacity = int(((ruled_sub["submitted"] == ruled_sub["i_capacity"]) & (ruled_sub["is_open"] == 1)).sum())
print(f"Open blocks exactly at capacity: {at_capacity}. Row order matches the template: {sub[PLAN_KEY].equals(blank[PLAN_KEY])}. "
      f"team_id: {sorted(sub['team_id'].unique())}")
assert all(ok for _, ok in v02), "The submitted file failed an independent check"

# %% [markdown]
# **Takeaway:** the submission file is complete and valid: every key once, whole numbers, zeros on closed blocks, and
# every block within minimum staff and capacity. It is exactly the plan this notebook rebuilt. The one thing left is the
# team name, still the placeholder until the team's ID is set in `src/submission.py`.

# %% [markdown]
# ## 11. Reproducibility
#
# **What this shows:** whether this notebook's own recalculation reproduces the results we submitted. Every entry of
# `outputs/analysis_summary.json`, the file the report reads its figures from, is rebuilt from the objects computed above,
# with the same rounding the pipeline uses, and compared value by value. Then the main result files in `outputs/` are
# compared block by block. Any difference stops the notebook with an error. (V-01, D-28)

# %%
from src.playbook import on_the_day, scenario_actions

R = P._records
saved = json.loads(read_output("analysis_summary.json").decode("utf-8"))
shortfall = P.base_shortfall_detail(evaluated, plan, inputs, curves)
open_eval = evaluated[evaluated["is_open"] == 1]
below_goal_table = (open_eval[open_eval["chance_met"] < goal - 0.0005].groupby(["scenario_code", "day_date"], as_index=False, sort=False)
                    .agg(blocks=("chance_met", "size"), average_chance=("chance_met", "mean")))
example_rows = {"added": examples["Largest addition"], "cut": examples["Largest cut"], "short": examples["Lowest chance"]}
recomputed = {
    "service_goal": sr.SERVICE_GOAL,
    "level_weeks": fc.LEVEL_WEEKS,
    "valentine_uplift": {DEPT[d]: v for d, v in fc.VALENTINE_UPLIFT.items()},
    "team_id": sb.TEAM_ID,
    "kpi": {name: float(v) for name, v in k.items()},
    "gap_value": R(gap_table, 2),
    "worst_short": R(gaps.sort_values("net_hours").head(8)),
    "worst_over": R(gaps.sort_values("net_hours", ascending=False).head(8)),
    "callout_rates": R(callout_rates(blocks)),
    "service_bands": R(bands),
    "holiday_factors": R(holiday_factors(daily)),
    "backtest_daily": R(daily_errors),
    "backtest_by_week": R(by_week),
    "backtest_block": R(by_block),
    "backtest_by_day_group": R(by_days),
    "base_shortfall": shortfall,
    "analog_test": R(analog),
    "split_test": R(fc.split_test()),
    "forecast_sd": R(sd),
    "forecast_by_day": R(daily_forecast.groupby(["dept_id", "day_date"], as_index=False)[["model_forecast", "daily_forecast", "benchmark"]].sum(), 1),
    "forecast_week": R(daily_forecast.groupby("dept_id", as_index=False)[["model_forecast", "daily_forecast", "benchmark"]].sum(), 1),
    "service_limits": R(limits, 3),
    "service_brier": {"model": float(brier), "base_rate": float(brier_base)},
    "service_calibration": R(cal, 3),
    "curves": {DEPT[d]: {"levels": {str(s): float(v) for s, v in c.levels.items()}, "slope": float(c.slope), "extra_slope": float(c.extra_slope),
                         "knot": float(c.knot), "width": float(c.width), "cap": float(c.cap), "scatter": float(c.scatter)} for d, c in curves.items()},
    "plan_summary": R(sr.summarize(evaluated), 3),
    "draft_summary": R(sr.summarize(draft), 3),
    "plan_by_dept": R(by_dept[["scenario_code", "dept_id", "hours", "hours_draft", "cost", "cost_draft", "expected_met", "expected_met_draft", "department"]], 3),
    "plan_by_day": R(daily_plan, 3),
    "below_goal_by_day": R(below_goal_table, 3),
    "goal_tradeoff": R(tradeoff, 3),
    "history_tradeoff": R(P.history_tradeoff(curves), 4),
    "valentine_sensitivity": R(valentine, 3),
    "buffer_test": R(buffer, 3),
    "capacity_gaps": R(capacity_short, 1),
    "pto_what_if": R(pto, 3),
    "playbook": {"scenarios": scenario_actions(explained), "on_the_day": on_the_day(explained)},
    "explanation_examples": {
        name: {"store_id": int(r["store_id"]), "department": DEPT[r["dept_id"]], "day": f"{r['day_date']:%a %b} {r['day_date'].day}",
               "shift": r["shift_code"], "headline": r["headline"], "why": r["why"], "demand_driver": r["demand_driver"], "cushion_text": r["cushion_text"]}
        for name, r in example_rows.items()},
    "stress_share_over85": R(stress.assign(over=stress["utilization"] > 0.85)
                             .groupby(["scenario_code", "day_date", "dept_id"], as_index=False, sort=False)["over"].mean(), 3),
    "validator_problems": problems,
}


def differences(mine, theirs, path=""):
    """Every (path, ours, saved) that differs; numbers within a relative 1e-9 count as equal."""
    if isinstance(theirs, dict) and isinstance(mine, dict):
        if set(mine) != set(theirs):
            yield path + " (keys)", sorted(set(mine) - set(theirs)), sorted(set(theirs) - set(mine))
        for key in set(mine) & set(theirs):
            yield from differences(mine[key], theirs[key], f"{path}.{key}")
    elif isinstance(theirs, list) and isinstance(mine, list):
        if len(mine) != len(theirs):
            yield path + " (length)", len(mine), len(theirs)
        for i, (a, b) in enumerate(zip(mine, theirs)):
            yield from differences(a, b, f"{path}[{i}]")
    elif isinstance(theirs, (int, float)) and isinstance(mine, (int, float, np.number)) and not isinstance(theirs, bool):
        if not (abs(float(mine) - theirs) <= 1e-9 * max(1.0, abs(theirs)) or (np.isnan(float(mine)) and np.isnan(theirs))):
            yield path, mine, theirs
    elif mine != theirs:
        yield path, mine, theirs


def count_values(value):
    if isinstance(value, dict):
        return sum(count_values(v) for v in value.values())
    if isinstance(value, list):
        return sum(count_values(v) for v in value)
    return 1


report, mismatches = [], []
for key in saved:
    found = list(differences(recomputed.get(key, "(not recomputed)"), saved[key], key))
    mismatches += found
    report.append((key, count_values(saved[key]), len(found), "match" if not found else "DIFFERS"))
report_table = pd.DataFrame(report, columns=["Entry in analysis_summary.json", "Values", "Differences", "Result"])
table(report_table)
print(f"{len(saved)} entries, {report_table['Values'].sum():,} values compared, {len(mismatches)} differences. "
      f"Entries recomputed but not in the file: {sorted(set(recomputed) - set(saved)) or 'none'}.")
for path, ours, theirs in mismatches[:10]:
    print(f"  {path}: notebook {ours!r}, saved {theirs!r}")
assert not mismatches, "The notebook does not reproduce analysis_summary.json"

# %% [markdown]
# **The result files, block by block.** The submitted file was compared byte for byte in section 10. The other main
# outputs are compared here: numbers to a relative 1e-9, text exactly.

# %%
def read_csv_output(name, **kw):
    return pd.read_csv(io.BytesIO(read_output(name)), **kw)


def frame_gap(ours, theirs, keys, numbers=(), texts=()):
    """Largest relative gap in numbers and count of text mismatches, after joining on keys."""
    ours, theirs = ours.copy(), theirs.copy()
    for frame in (ours, theirs):
        for key in keys:
            if "date" in key:
                frame[key] = pd.to_datetime(frame[key])
    joined = ours.merge(theirs, on=keys, suffixes=("", "_saved"), how="outer", indicator=True, validate="one_to_one")
    unmatched = int((joined["_merge"] != "both").sum())
    gap = max([float(((joined[c] - joined[c + "_saved"]).abs() / joined[c + "_saved"].abs().clip(lower=1)).max()) for c in numbers] or [0.0])
    text_gap = sum(int((joined[c].fillna("") != joined[c + "_saved"].fillna("")).sum()) for c in texts)
    return len(joined), unmatched, gap, text_gap


explain_saved = read_csv_output("explanations.csv")
explain_ours = explained.assign(assumptions=explained["assumption_ids"].map("; ".join))
file_checks = [
    ("plan_vs_draft.csv", *frame_gap(evaluated.merge(draft[[*PLAN_KEY, "cost", "chance_met"]], on=PLAN_KEY, suffixes=("", "_draft")),
                                     read_csv_output("plan_vs_draft.csv"), PLAN_KEY,
                                     ["recommended", "cost", "chance_met", "cost_draft", "chance_met_draft", "demand", "demand_sd", "callout_rate"])),
    ("explanations.csv", *frame_gap(explain_ours, explain_saved, ["scenario_code", *block_key], ["recommended", "cushion_people", "cushion_demand"],
                                    ["why", "demand_driver", "staffing", "cost_effect", "service_effect", "cushion_text", "assumptions"])),
    ("forecast_blocks.csv", *frame_gap(block_forecast, read_csv_output("forecast_blocks.csv"), block_key, ["base_demand", "daily_forecast", "share"])),
    ("forecast_daily.csv", *frame_gap(daily_forecast, read_csv_output("forecast_daily.csv"), ["store_id", "dept_id", "day_date"],
                                      ["model_forecast", "daily_forecast", "benchmark"])),
    ("service_limits.csv", *frame_gap(limits, read_csv_output("service_limits.csv"), ["dept_id", "store_id"], ["u95", "u90", "u50"])),
    ("goal_tradeoff.csv", *frame_gap(tradeoff, read_csv_output("goal_tradeoff.csv"), ["goal", "scenario_code"], ["cost", "hours", "expected_met"])),
    ("capacity_gaps.csv", *frame_gap(capacity_short, read_csv_output("capacity_gaps.csv"), ["scenario_code", "day_date", "dept_id"],
                                     ["gap_people", "gap_hours", "blocks_short"])),
    ("pto_what_if.csv", *frame_gap(pto, read_csv_output("pto_what_if.csv"), ["kept_per_block"], ["people_kept", "blocks_below_goal", "expected_met", "cost"])),
]
files = pd.DataFrame(file_checks, columns=["File in outputs/", "Rows", "Rows that don't match on keys", "Largest relative gap", "Text differences"])
files["Result"] = np.where((files["Rows that don't match on keys"] == 0) & (files["Largest relative gap"] < 1e-9) & (files["Text differences"] == 0),
                           "match", "DIFFERS")
table(files, {"Largest relative gap": "{:.1e}"})
assert (files["Result"] == "match").all(), "A result file differs from this notebook's recalculation"

# %%
print(f"All checks passed. The notebook reproduces analysis_summary.json and the result files in outputs/. "
      f"Total run time {(time.time() - STARTED) / 60:.1f} minutes.")

# %% [markdown]
# **Takeaway:** the analysis reproduces exactly from the data pack. The report reads its calculated figures from
# `analysis_summary.json`, and this notebook rebuilt every entry of it, along with the submitted file and the block-level
# results, from the code shown above. *All data is simulated; none of it is real Costco data.*
