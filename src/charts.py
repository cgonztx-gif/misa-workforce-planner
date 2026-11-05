"""Charts for the written report (T-92), drawn from outputs/ and the planning grid.

Start it with: python -m src.charts
It writes one PNG per figure in DELIVERABLES_PLAN.md section 9.2 to outputs/charts/ at 200 dpi, plus
figure_data.json: the few figures the charts compute themselves (the timeline's dates, the risk and
allocation examples, hours by day), which the report's builder reads instead of retyping. The look
(colors, Segoe UI, sizes, marks) comes from design/tokens.json through src/viz_style.py, so these
match the app and the deck (D-26): plan in the accent, draft in gray, departments in fixed hues.
"""
from __future__ import annotations

import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from matplotlib.lines import Line2D  # noqa: E402
from matplotlib.patches import FancyBboxPatch  # noqa: E402

from src import viz_style as vs  # noqa: E402
from src.pipeline import OUTPUTS  # noqa: E402

CHARTS = OUTPUTS / "charts"
DEPT_IDS = {38: "Front End", 92: "Merchandising", 95: "Pharmacy"}
DAYS = ["Thu 12", "Fri 13", "Sat 14", "Sun 15", "Mon 16", "Tue 17", "Wed 18"]
DATES = ["2026-02-12", "2026-02-13", "2026-02-14", "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18"]
SCENARIOS = ["BASE", "PEAK", "DISRUPT"]
WINDOW = (1, 4)  # Fri 13 to Mon 16, the Presidents' Day window, as indexes into DATES
SHORT_DEPT = {"Front End": "Front End", "Merchandising": "Merch.", "Pharmacy": "Pharmacy"}
SHIFT_NAMES = {"OPEN": "opening", "MID": "midday", "EVE": "evening"}
# Plan fill sources, light to dark in the accent, like the app's block drawer.
BORDER_STRONG = vs.COLORS["border_strong"]
SOURCE_COLORS = {"regular": vs.CHANCE_STOPS[5], "flex": vs.CHANCE_STOPS[3], "overtime": vs.CHANCE_STOPS[1]}


def _save(fig, name: str) -> None:
    fig.savefig(CHARTS / f"{name}.png")
    plt.close(fig)


def _window_band(ax, text: str | None = "Presidents' Day window") -> None:
    """Shade Fri 13 to Mon 16 on a day-index x axis."""
    vs.band(ax, WINDOW[0] - 0.5, WINDOW[1] + 0.5, text)


def _panel_title(ax, text: str, y: float = 1.03) -> None:
    """A small semibold title above one panel of a multi-panel figure, flush left."""
    ax.text(0, y, text, transform=ax.transAxes, fontsize=vs.LABEL_SIZE, fontweight="semibold", color=vs.INK,
            ha="left", va="bottom")


def _curve(params: dict):
    """A service curve rebuilt from analysis_summary.json, so charts use the frozen fit without refitting."""
    from src.service import Curve
    return Curve({int(k): v for k, v in params["levels"].items()}, params["slope"], params["extra_slope"],
                 params["knot"], params["cap"], params["scatter"], params["width"])


def forecast_vs_benchmark(summary: dict) -> None:
    """Our daily forecast against the case's benchmark, one panel per department (units differ)."""
    table = pd.DataFrame(summary["forecast_by_day"])
    fig, axes = plt.subplots(3, 1, figsize=(6.5, 6.4), sharex=True)
    x = np.arange(len(DATES))
    for ax, (dept, name) in zip(axes, DEPT_IDS.items()):
        part = table[table["dept_id"] == dept].sort_values("day_date")
        _window_band(ax, None)
        ax.plot(x, part["benchmark"], label="Benchmark (same-weekday average)", **vs.BENCHMARK_LINE)
        ax.plot(x, part["daily_forecast"], label="Our forecast", **vs.PLAN_LINE, **vs.MARKERS)
        lo, hi = min(part["benchmark"].min(), part["daily_forecast"].min()), max(part["benchmark"].max(), part["daily_forecast"].max())
        pad = (hi - lo) * 0.2
        ax.set_ylim(lo - pad, hi + pad * 2.0)
        ax.yaxis.set_major_formatter(vs.formatter("{x:,.0f}"))
        ax.yaxis.set_major_locator(plt.MaxNLocator(4))
        widest = (part["daily_forecast"] / part["benchmark"] - 1).abs().idxmax()
        row = part.loc[widest]
        gap = (row["daily_forecast"] / row["benchmark"] - 1) * 100
        above = gap > 0
        vs.label_point(ax, DATES.index(row["day_date"]), row["daily_forecast"], f"{gap:+.0f}% vs benchmark".replace("-", "−"),
                       dx=0 if above else 7, dy=9 if above else -7, ha="center" if above else "left", va="bottom" if above else "top",
                       color=vs.INK)
        _panel_title(ax, f"{name}, daily workload units, all warehouses", y=1.05)
    axes[-1].set_xticks(x, DAYS)
    axes[1].text((WINDOW[0] + WINDOW[1]) / 2, 0.04, "Presidents' Day window", transform=axes[1].get_xaxis_transform(),
                 ha="center", va="bottom", fontsize=vs.TICK_SIZE * 0.85, color=vs.LABEL)
    handles, labels = axes[0].get_legend_handles_labels()
    vs.legend_top(axes[0], handles[::-1], labels[::-1], x=0)
    axes[0].get_legend().set_bbox_to_anchor((0, 1.2), transform=axes[0].transAxes)
    fig.subplots_adjust(hspace=0.42)
    _save(fig, "forecast_vs_benchmark")


def backtest_error(summary: dict) -> None:
    """Held-out daily error, ours against the benchmark's method, by department and by day group."""
    daily = {str(r["group"]): r for r in summary["backtest_daily"]}
    groups = {r["group"]: r for r in summary["backtest_by_day_group"]}
    rows = [("All days", daily["All"]), ("Front End", daily["38"]), ("Merchandising", daily["92"]), ("Pharmacy", daily["95"]),
            ("Fri to Mon only", groups["Fri-Mon"]), ("Tue to Thu only", groups["Tue-Thu"])]
    y = np.arange(len(rows))
    fig, ax = plt.subplots(figsize=(6.5, 3.3))
    ax.set_ylim(len(rows) - 0.5, -0.5)
    ax.grid(axis="y", visible=False)
    ax.grid(axis="x", visible=True)
    offsets = vs.group_offsets(ax, 2, px=15, axis="y")
    series = [("Our forecast", "model", vs.PLAN, vs.INK), ("Benchmark method", "benchmark", vs.BENCHMARK, vs.LABEL)]
    for offset, (label, key, color, ink) in zip(offsets, series):
        values = [r[key] * 100 for _, r in rows]
        bars = vs.bars(ax, y, values, color=color, offset=offset, thickness=vs.bar_width(ax, 15, axis="y"), horizontal=True, label=label)
        ax.bar_label(bars, fmt="{:.1f}%", padding=4, color=ink, fontsize=vs.TICK_SIZE * 0.85)
    ax.axhline(3.5, color=BORDER_STRONG, linewidth=vs.HAIRLINE)
    ax.set_yticks(y, [label for label, _ in rows])
    ax.tick_params(axis="y", labelcolor=vs.INK_MUTED)
    vs.zero_based(ax, top=6.5, axis="x")
    ax.xaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
    ax.set_xlabel("Mean absolute error of daily demand, weeks 4 to 6 held out")
    vs.header(ax)
    _save(fig, "backtest_error")


def holiday_factors(summary: dict) -> None:
    """Measured holiday effects by department, as a change against a normal day."""
    table = pd.DataFrame(summary["holiday_factors"])
    windows = {"pre_holiday_weekend": "Fri to Sun before the holiday", "holiday_monday": "Holiday Monday", "new_year_rebound": "New Year rebound (Jan 2 to 4)"}
    y = np.arange(len(windows))
    fig, ax = plt.subplots(figsize=(6.5, 2.9))
    ax.set_ylim(len(windows) - 0.5, -0.5)
    ax.grid(axis="y", visible=False)
    ax.grid(axis="x", visible=True)
    thickness = vs.bar_width(ax, 14, axis="y")
    offsets = vs.group_offsets(ax, 3, px=14, axis="y")
    for offset, (dept, name) in zip(offsets, DEPT_IDS.items()):
        part = table[table["dept_id"] == dept].set_index("window")
        values = np.array([(part.loc[w, "factor"] - 1) * 100 for w in windows])
        vs.bars(ax, y, values, color=vs.DEPT[name], offset=offset, thickness=thickness, horizontal=True, label=name)
        for yi, v in zip(y + offset, values):
            vs.label_point(ax, v, yi, f"{v:+.0f}%".replace("-", "−"), dx=4 if v >= 0 else -4, dy=0, ha="left" if v >= 0 else "right",
                           va="center", fontsize=vs.TICK_SIZE * 0.85)
    ax.axvline(0, color=vs.AXIS, linewidth=vs.HAIRLINE)
    ax.set_yticks(y, list(windows.values()))
    ax.tick_params(axis="y", labelcolor=vs.INK_MUTED)
    ax.set_xlim(-38, 20)
    ax.xaxis.set_major_formatter(vs.formatter("{x:+.0f}%"))
    ax.set_xlabel("Demand against a normal day, measured in history")
    vs.header(ax)
    _save(fig, "holiday_factors")


def service_curves(summary: dict) -> None:
    """Chance of meeting target against utilization: the fitted curve per warehouse, and history's observed share."""
    bands = pd.DataFrame(summary["service_bands"])
    fig, axes = plt.subplots(1, 3, figsize=(6.5, 2.9), sharey=True)
    u = np.linspace(0.6, 1.08, 300)
    styles = {1: "-", 2: (0, (5, 2)), 4: (0, (1.5, 1.5))}
    for ax, (dept, name) in zip(axes, DEPT_IDS.items()):
        curve = _curve(summary["curves"][name])
        vs.band(ax, 0.85, 0.90, None, color=vs.WARNING_SOFT)
        ax.axhline(summary["service_goal"] * 100, color=vs.INK_SUBTLE, linewidth=vs.HAIRLINE, linestyle=(0, (3, 3)), zorder=1)
        for store, style in styles.items():
            ax.plot(u, curve.p_met(store, u) * 100, color=vs.DEPT[name], linewidth=vs.LINE_WIDTH, linestyle=style,
                    label=f"Warehouse {store}", zorder=3)
        seen = bands[(bands["department"] == name) & (bands["blocks"] >= 3) & bands["band"].between(0.6, 1.05)]
        ax.plot(seen["band"] + 0.025, seen["met_target"] * 100, linestyle="none", marker="o", markersize=vs.MARKER_SIZE * 0.75,
                markerfacecolor=vs.SURFACE, markeredgecolor=vs.INK_SUBTLE, markeredgewidth=1.1, label="History, 5-point bands", zorder=4)
        ax.set_xlim(0.6, 1.08)
        ax.set_xticks([0.6, 0.7, 0.8, 0.9, 1.0], ["0.6", "0.7", "0.8", "0.9", "1.0"])
        ax.set_ylim(-3, 106)
        _panel_title(ax, name)
    axes[0].yaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
    axes[0].set_yticks(range(0, 101, 25))
    axes[0].set_ylabel("Chance of meeting target")
    axes[1].set_xlabel("Utilization (workload hours / worked hours)")
    handles, labels = axes[0].get_legend_handles_labels()
    keys = [Line2D([], [], color=vs.INK_MUTED, linewidth=vs.LINE_WIDTH, linestyle=styles[s]) for s in styles] + [handles[-1]]
    fig.legend(keys, labels, loc="lower left", bbox_to_anchor=(0.06, 0.99), ncol=4, frameon=False, fontsize=vs.TICK_SIZE * 0.85,
               handlelength=2.2, labelcolor=vs.INK_MUTED)
    fig.subplots_adjust(wspace=0.12)
    _save(fig, "service_curves")


def planning_timeline(grid: pd.DataFrame, facts: dict) -> None:
    """What happens on each day of the planning week, read from the grid (holidays, PTO, PEAK, DISRUPT)."""
    base = grid[grid["scenario_code"] == "BASE"]
    first = base.drop_duplicates("day_date").set_index("day_date")
    index = {d: i for i, d in enumerate(DATES)}
    window = [index[d] for d in DATES if first.loc[d, "holiday_window_role"] != "Normal"]
    holidays = first["holiday_name"].dropna()
    pto = sorted(index[d] for d in base.loc[base["availability_note"].fillna("").str.contains("Holiday-weekend PTO"), "day_date"].unique())
    peak = grid[(grid["scenario_code"] == "PEAK") & (grid["demand_multiplier"] > 1)]
    peak_days = sorted(index[d] for d in peak["day_date"].unique())
    keys = ["store_id", "dept_id", "day_date", "shift_code"]
    cols = ["available_regular_employees", "max_overtime_employees", "cross_trained_flex_employees"]
    other = grid[grid["scenario_code"] == "DISRUPT"].set_index(keys)[cols]
    changed = (other - base.set_index(keys)[cols]).ne(0).any(axis=1)
    changed = changed[changed].reset_index()
    stores = {s: sorted(index[d] for d in part["day_date"].unique()) for s, part in changed.groupby("store_id")}
    lanes = [
        ("Holidays", [(index[d], index[d], name.replace(" ", "\n", 1)) for d, name in holidays.items()]),
        ("Holiday window", [(min(window), max(window), "Presidents' Day window\nFri to Mon")]),
        ("All scenarios", [(min(pto), max(pto), "Holiday-weekend PTO\ncuts available staff")]),
        ("PEAK", [(min(peak_days), max(peak_days),
                   f"Promotion and storm\ndemand x{peak['demand_multiplier'].min():.2f} to x{peak['demand_multiplier'].max():.2f}")]),
        ("DISRUPT, Warehouse 2", [(min(stores[2]), max(stores[2]), "Illness: fewer Front End\nand Pharmacy staff")]),
        ("DISRUPT, Warehouse 4", [(min(stores[4]), max(stores[4]), "Stocking crew\nshort")]),
    ]
    fig, ax = plt.subplots(figsize=(6.5, 3.6))
    ax.grid(False)
    ax.set_xlim(-0.5, len(DATES) - 0.5)
    ax.set_ylim(len(lanes) - 0.4, -0.6)
    for x in range(len(DATES) + 1):
        ax.axvline(x - 0.5, color=vs.GRID, linewidth=vs.HAIRLINE, zorder=0)
    ax.axvspan(min(window) - 0.5, max(window) + 0.5, color=vs.BAND, linewidth=0, zorder=0)
    for row, (_, spans) in enumerate(lanes):
        for start, end, text in spans:
            box = FancyBboxPatch((start - 0.45, row - 0.36), end - start + 0.9, 0.72, boxstyle="round,pad=0,rounding_size=0.1",
                                 facecolor=vs.SURFACE, edgecolor=vs.ACCENT if row < 2 else BORDER_STRONG,
                                 linewidth=vs.HAIRLINE * 1.5, zorder=2, mutation_aspect=0.25)
            ax.add_patch(box)
            ax.text((start + end) / 2, row, text, ha="center", va="center", fontsize=vs.TICK_SIZE * 0.78, color=vs.INK, zorder=3,
                    linespacing=1.15)
    ax.set_yticks(range(len(lanes)), [lane for lane, _ in lanes])
    ax.tick_params(axis="y", labelcolor=vs.INK_MUTED, labelsize=vs.TICK_SIZE * 0.9)
    ax.xaxis.tick_top()
    ax.set_xticks(range(len(DATES)), DAYS)
    ax.spines["bottom"].set_visible(False)
    _save(fig, "planning_timeline")
    facts["timeline"] = {
        "window": [DATES[min(window)], DATES[max(window)]],
        "holidays": {d: name for d, name in holidays.items()},
        "pto_days": [DATES[min(pto)], DATES[max(pto)]],
        "peak_days": [DATES[min(peak_days)], DATES[max(peak_days)]],
        "peak_multiplier_min": float(peak["demand_multiplier"].min()),
        "peak_multiplier_max": float(peak["demand_multiplier"].max()),
        "disrupt_days": {str(s): [DATES[min(d)], DATES[max(d)]] for s, d in stores.items()},
        "disrupt_changed_blocks": int(len(changed)),
    }


def _block(plan: pd.DataFrame, scenario: str, store: int, dept: int, date: str, shift: str) -> pd.Series:
    row = plan[(plan["scenario_code"] == scenario) & (plan["store_id"] == store) & (plan["dept_id"] == dept)
               & (plan["day_date"] == date) & (plan["shift_code"] == shift)]
    if len(row) != 1:
        raise ValueError(f"No single block for {scenario} {store} {dept} {date} {shift}")
    return row.iloc[0]


def risk_example(summary: dict, plan: pd.DataFrame, facts: dict) -> None:
    """One block's chance of meeting target at each headcount, adding one risk at a time (the search's view)."""
    from src.data import load_labor_standard
    from src.risk import chance_met
    example = summary["explanation_examples"]["added"]
    dept = {v: k for k, v in DEPT_IDS.items()}[example["department"]]
    weekday, _, day_number = example["day"].split()
    date = DATES[DAYS.index(f"{weekday} {day_number}")]
    row = _block(plan, "BASE", example["store_id"], dept, date, example["shift"])
    curve, standard = _curve(summary["curves"][example["department"]]), load_labor_standard()[dept]
    store, demand, sd, hours = int(row["store_id"]), float(row["demand"]), float(row["demand_sd"]), float(row["paid_hours"])

    def room(n: int) -> int:
        return int(row["max_overtime_employees"]) - max(0, n - int(row["available_regular_employees"]))

    draft, planned = int(row["draft_scheduled_employees"]), int(row["recommended"])
    counts = np.arange(max(int(row["min_staff"]), draft - 4), planned + 8)
    layers = {
        "curve": [float(curve.p_met(store, demand * standard / (n * hours))) for n in counts],
        "forecast": [chance_met(curve, store, demand, sd, int(n), hours, standard, 0.0, room(int(n))) for n in counts],
        "both": [chance_met(curve, store, demand, sd, int(n), hours, standard, float(row["callout_rate"]), room(int(n))) for n in counts],
    }
    assert abs(layers["both"][list(counts).index(planned)] - row["chance_met"]) < 1e-9, "risk example drifted from the plan"
    need = {key: int(next(n for n, c in zip(counts, values) if c >= summary["service_goal"])) for key, values in layers.items()}
    fig, ax = plt.subplots(figsize=(6.5, 3.1))
    ax.axhline(summary["service_goal"] * 100, color=vs.INK_SUBTLE, linewidth=vs.HAIRLINE, linestyle=(0, (3, 3)), zorder=1)
    vs.label_point(ax, counts[0], summary["service_goal"] * 100, f"{summary['service_goal']:.0%} goal", dx=0, dy=4, ha="left")
    styles = [("curve", "Service curve and its scatter only", vs.CHANCE_STOPS[2], 1.6),
              ("forecast", "Plus forecast error", vs.CHANCE_STOPS[3], 1.8),
              ("both", "Plus callouts, after backfill (what the plan uses)", vs.PLAN, vs.LINE_WIDTH_PLAN)]
    for key, label, color, width in styles:
        ax.plot(counts, np.array(layers[key]) * 100, color=color, linewidth=width, label=label, zorder=3)
    both = dict(zip(counts, layers["both"]))
    ax.plot([draft], [both[draft] * 100], color=vs.DRAFT, linestyle="none", **vs.MARKERS, zorder=5)
    vs.label_point(ax, draft, both[draft] * 100, f"Draft: {draft} people\n{both[draft]:.0%} chance", dx=0, dy=9, ha="center")
    ax.plot([planned], [both[planned] * 100], color=vs.PLAN, linestyle="none", **vs.MARKERS, zorder=5)
    vs.label_point(ax, planned, both[planned] * 100, f"Plan: {planned} people, {both[planned]:.0%}", dx=6, dy=-10, ha="left", va="top",
                   color=vs.INK, fontweight="semibold")
    ax.set_xlim(counts[0] - 0.5, counts[-1] + 0.5)
    ax.set_ylim(-3, 106)
    ax.yaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
    ax.set_ylabel("Chance of meeting target")
    ax.set_xlabel("People scheduled in the block")
    vs.header(ax)
    ax.get_legend().set_ncols(1)
    _save(fig, "risk_example")
    at = list(counts).index(planned)
    facts["risk_example"] = {
        "store_id": store, "dept_id": dept, "department": example["department"], "day_date": date, "day": example["day"],
        "shift_code": example["shift"], "draft": draft, "plan": planned, "need": need, "paid_hours": hours,
        "demand": demand, "demand_sd": sd, "callout_rate": float(row["callout_rate"]),
        "chance_plan": {k: v[at] for k, v in layers.items()},
        "chance_draft": {k: v[list(counts).index(draft)] for k, v in layers.items()},
        "utilization_plan": demand * standard / (planned * hours), "utilization_draft": demand * standard / (draft * hours),
    }


def allocation_example(grid: pd.DataFrame, plan: pd.DataFrame, facts: dict) -> None:
    """How one block is filled and costed: regular staff, then cross-trained staff the partner can spare, then overtime."""
    from src.allocation import allocate
    base = plan[(plan["scenario_code"] == "BASE") & (plan["fill_flex"] > 0) & (plan["fill_overtime"] > 0) & ~plan["below_service_goal"]]
    row = base.sort_values(["fill_flex", "fill_overtime", "store_id", "dept_id", "day_date", "shift_code"],
                           ascending=[False, False, True, True, True, True]).iloc[0]
    keys = ["scenario_code", "store_id", "dept_id", "day_date", "shift_code"]
    rates = grid.set_index(keys).loc[tuple(row[k] for k in keys)]
    draft = allocate(int(row["draft_scheduled_employees"]), int(row["available_regular_employees"]), int(row["max_overtime_employees"]), int(row["usable_flex"]))
    rows = [("Can field", int(row["available_regular_employees"]), int(row["usable_flex"]), int(row["max_overtime_employees"])),
            ("Plan", int(row["fill_regular"]), int(row["fill_flex"]), int(row["fill_overtime"])),
            ("Draft", int(draft[0]), int(draft[1]), int(draft[2]))]
    y = np.arange(len(rows))
    fig, ax = plt.subplots(figsize=(6.5, 1.9))
    ax.set_ylim(len(rows) - 0.5, -0.5)
    ax.grid(axis="y", visible=False)
    ax.grid(axis="x", visible=True)
    thickness = vs.bar_width(ax, 22, axis="y")
    for yi, (_, *parts) in zip(y, rows):
        left = 0
        for (source, color), count in zip(SOURCE_COLORS.items(), parts):
            if count:
                ax.barh(yi, count - 0.06, left=left + 0.03, height=thickness, color=color, linewidth=0,
                        label={"regular": "Regular", "flex": "Cross-trained", "overtime": "Overtime"}[source] if yi == 0 else None)
                ink = vs.SURFACE if source != "overtime" else vs.INK
                ax.text(left + count / 2, yi, str(count), ha="center", va="center", fontsize=vs.TICK_SIZE * 0.9, color=ink)
            left += count
        vs.label_point(ax, left, yi, f"{left} in all", dx=6, dy=0, ha="left", va="center")
    ax.set_yticks(y, [r[0] for r in rows])
    ax.tick_params(axis="y", labelcolor=vs.INK_MUTED)
    vs.zero_based(ax, top=sum(rows[0][1:]) * 1.22, axis="x")
    ax.set_xlabel("People in the block")
    vs.header(ax)
    _save(fig, "allocation_example")
    partner = 92 if row["dept_id"] == 38 else 38
    pair = {d: _block(plan, "BASE", int(row["store_id"]), d, row["day_date"], row["shift_code"]) for d in (int(row["dept_id"]), partner)}
    facts["allocation_example"] = {
        "store_id": int(row["store_id"]), "dept_id": int(row["dept_id"]), "department": DEPT_IDS[int(row["dept_id"])],
        "day_date": row["day_date"], "shift_code": row["shift_code"], "paid_hours": float(row["paid_hours"]),
        "regular_rate": float(rates["loaded_regular_hourly_cost"]), "overtime_rate": float(rates["loaded_overtime_hourly_cost"]),
        "available_regular": int(row["available_regular_employees"]), "usable_flex": int(row["usable_flex"]),
        "max_overtime": int(row["max_overtime_employees"]), "capacity": int(row["capacity"]),
        "plan": int(row["recommended"]), "fill_regular": int(row["fill_regular"]), "fill_flex": int(row["fill_flex"]),
        "fill_overtime": int(row["fill_overtime"]), "cost": float(row["cost"]), "chance": float(row["chance_met"]),
        "draft": int(row["draft_scheduled_employees"]), "draft_fill": [int(v) for v in draft[:3]], "cost_draft": float(row["cost_draft"]),
        "shift": [{k: (v.item() if hasattr(v, "item") else v) for k, v in pair[d][[
            "dept_id", "department_group", "draft_scheduled_employees", "recommended", "available_regular_employees",
            "usable_flex", "max_overtime_employees", "capacity", "fill_regular", "fill_flex", "fill_overtime", "chance_met",
            "planned_utilization", "cost"]].items()} for d in pair],
    }


def hours_by_day(plan: pd.DataFrame, facts: dict) -> None:
    """BASE paid hours per day: draft, plan and the most the warehouses could field."""
    base = plan[(plan["scenario_code"] == "BASE") & (plan["is_open"] == 1)].assign(
        plan_hours=lambda t: t["recommended"] * t["paid_hours"], draft_hours=lambda t: t["draft_scheduled_employees"] * t["paid_hours"],
        capacity_hours=lambda t: t["capacity"] * t["paid_hours"])
    by_day = base.groupby("day_date")[["draft_hours", "plan_hours", "capacity_hours"]].sum().reindex(DATES)
    x = np.arange(len(DATES))
    fig, ax = plt.subplots(figsize=(6.5, 3.0))
    ax.set_xlim(-0.6, len(DATES) - 0.4)
    _window_band(ax)
    offsets = vs.group_offsets(ax, 2)
    vs.bars(ax, x, by_day["draft_hours"], color=vs.DRAFT, offset=offsets[0], label="Draft")
    vs.bars(ax, x, by_day["plan_hours"], color=vs.PLAN, offset=offsets[1], label="Plan")
    half = vs.bar_width(ax) * 1.25
    for xi, cap in zip(x, by_day["capacity_hours"]):
        ax.plot([xi - half, xi + half], [cap, cap], color=vs.INK, linewidth=1.4, solid_capstyle="butt", zorder=4,
                label="Most the warehouses can field" if xi == 0 else None)
    vs.zero_based(ax, top=by_day["capacity_hours"].max() * 1.18)
    ax.set_xticks(x, DAYS)
    ax.yaxis.set_major_formatter(vs.formatter("{x:,.0f}"))
    ax.set_ylabel("Paid hours, all warehouses")
    handles, labels = ax.get_legend_handles_labels()
    order = [labels.index(name) for name in ("Draft", "Plan", "Most the warehouses can field")]
    left = ax.transAxes.inverted().transform((ax.yaxis.get_tightbbox(fig.canvas.get_renderer()).x0, 0))[0]
    vs.legend_top(ax, [handles[i] for i in order], [labels[i] for i in order], x=left)
    _save(fig, "hours_by_day")
    facts["hours_by_day"] = {d: {k: float(v) for k, v in r.items()} for d, r in by_day.iterrows()}


def staffing_gaps() -> None:
    """History's largest over- and under-staffed block types, as hours against need at 85% utilization."""
    gaps = pd.read_csv(OUTPUTS / "diagnosis_staffing_gaps.csv")
    over = gaps[gaps["net_hours"] > 0].nlargest(5, "net_hours")
    short = gaps[gaps["net_hours"] < 0].nsmallest(5, "net_hours")
    rows = pd.concat([over, short.iloc[::-1]])
    labels = [f"W{r.store_id} {SHORT_DEPT[r.department]}, {r.day_type.replace('Weekday', 'weekday')} {SHIFT_NAMES[r.shift_code]}"
              for r in rows.itertuples()]
    y = np.arange(len(rows))
    fig, ax = plt.subplots(figsize=(6.5, 3.4))
    ax.set_ylim(len(rows) - 0.5, -0.5)
    ax.grid(axis="y", visible=False)
    ax.grid(axis="x", visible=True)
    over_color, short_color = vs.CHANGE_STOPS[-1], vs.CHANGE_STOPS[0]
    values = rows["net_hours"].to_numpy()
    vs.bars(ax, y[values > 0], values[values > 0], color=over_color, horizontal=True, label="Hours above need")
    vs.bars(ax, y[values < 0], values[values < 0], color=short_color, horizontal=True, label="Hours short of need")
    for yi, v in zip(y, values):
        vs.label_point(ax, v, yi, f"{abs(v):,.0f}", dx=5 if v > 0 else -5, dy=0, ha="left" if v > 0 else "right", va="center")
    ax.axvline(0, color=vs.AXIS, linewidth=vs.HAIRLINE)
    ax.set_yticks(y, labels)
    ax.tick_params(axis="y", labelcolor=vs.INK_MUTED)
    ax.set_xlim(values.min() * 1.45, values.max() * 1.15)
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"{abs(v):,.0f}"))
    ax.set_xlabel("Hours over six weeks: short of need (left) or above it (right), at 85% utilization")
    vs.header(ax)
    _save(fig, "staffing_gaps")


def callout_rates(summary: dict) -> None:
    """Callouts as a share of scheduled staff, by situation and department."""
    rates = pd.DataFrame(summary["callout_rates"])
    contexts = {"weekday": "Weekdays", "weekend": "Weekends", "day_after_holiday": "Day after a holiday", "flu_cluster": "Warehouse 2 flu week"}
    y = np.arange(len(contexts))
    fig, ax = plt.subplots(figsize=(6.5, 3.2))
    ax.set_ylim(len(contexts) - 0.5, -0.5)
    ax.grid(axis="y", visible=False)
    ax.grid(axis="x", visible=True)
    offsets = vs.group_offsets(ax, 3, px=13, axis="y")
    for offset, (dept, name) in zip(offsets, DEPT_IDS.items()):
        part = rates[rates["dept_id"] == dept].set_index("context")
        present = [i for i, c in enumerate(contexts) if c in part.index]
        values = [part.loc[c, "rate"] * 100 for c in contexts if c in part.index]
        bars = vs.bars(ax, y[present], values, color=vs.DEPT[name], offset=offset, thickness=vs.bar_width(ax, 13, axis="y"),
                       horizontal=True, label=name)
        ax.bar_label(bars, fmt="{:.1f}%", padding=4, color=vs.LABEL, fontsize=vs.TICK_SIZE * 0.85)
    flu = list(contexts).index("flu_cluster")
    vs.label_point(ax, 0.15, flu + offsets[1], "Merchandising not affected", dx=0, dy=0, ha="left", va="center",
                   color=vs.INK_SUBTLE, fontsize=vs.TICK_SIZE * 0.8)
    ax.set_yticks(y, list(contexts.values()))
    ax.tick_params(axis="y", labelcolor=vs.INK_MUTED)
    vs.zero_based(ax, top=15, axis="x")
    ax.xaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
    ax.set_xlabel("Callouts as a share of scheduled employees")
    vs.header(ax)
    _save(fig, "callout_rates")


def service_cliff(summary: dict) -> None:
    bands = pd.DataFrame(summary["service_bands"])
    bands = bands[(bands["blocks"] >= 3) & bands["band"].between(0.6, 1.05)]
    fig, ax = plt.subplots(figsize=(6.5, 3.2))
    vs.band(ax, 0.85, 0.90, "The cliff", color=vs.WARNING_SOFT, ink=vs.WARNING_INK)
    for name, color in vs.DEPT.items():
        part = bands[bands["department"] == name].sort_values("band")
        ax.plot(part["band"] + 0.025, part["met_target"] * 100, color=color, label=name, clip_on=False, **vs.MARKERS)
    ax.set_xlabel("Utilization (workload hours / worked hours), five-point bands")
    ax.set_ylabel("Blocks meeting target")
    ax.set_ylim(0, 106)
    ax.set_yticks(range(0, 101, 20))
    ax.yaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
    ticks = np.arange(0.6, 1.11, 0.05)
    ax.set_xticks(ticks, [f"{x:.2f}" for x in ticks])
    ax.set_xlim(0.6, 1.1)
    vs.header(ax)
    fig.savefig(CHARTS / "service_cliff.png")
    plt.close(fig)


def benchmark_gap(summary: dict) -> None:
    table = pd.DataFrame(summary["forecast_by_day"])
    table["gap"] = (table["benchmark"] / table["model_forecast"] - 1) * 100
    fig, ax = plt.subplots(figsize=(6.5, 3.0))
    ax.axhline(0, color=vs.AXIS, linewidth=vs.HAIRLINE, zorder=1)
    x = np.arange(len(DAYS))
    for dept, name in DEPT_IDS.items():
        part = table[table["dept_id"] == dept].sort_values("day_date")
        ax.plot(x, part["gap"], color=vs.DEPT[name], label=name, **vs.MARKERS)
    # Label the two extremes the text talks about, not every point.
    gaps = table.set_index(["dept_id", "day_date"])["gap"]
    peak = gaps.loc[95].idxmax()
    trough = gaps.loc[38].idxmin()
    days = sorted(table["day_date"].unique())
    vs.label_point(ax, days.index(peak), gaps.loc[(95, peak)], f"Pharmacy {gaps.loc[(95, peak)]:+.0f}%".replace("-", "−"), dx=8, ha="left", va="center", dy=0)
    vs.label_point(ax, days.index(trough), gaps.loc[(38, trough)], f"Front End {gaps.loc[(38, trough)]:+.0f}%".replace("-", "−"), dy=-9, va="top")
    ax.set_xticks(x, DAYS)
    ax.set_xlim(-0.35, len(DAYS) - 0.65)
    ax.set_ylabel("Benchmark vs our model")
    ax.yaxis.set_major_formatter(vs.formatter("{x:+.0f}%"))
    ax.set_ylim(min(-14, ax.get_ylim()[0]), ax.get_ylim()[1])
    vs.header(ax)
    fig.savefig(CHARTS / "benchmark_gap.png")
    plt.close(fig)


def plan_vs_draft(summary: dict) -> None:
    plan = pd.DataFrame(summary["plan_summary"]).set_index("scenario_code")
    draft = pd.DataFrame(summary["draft_summary"]).set_index("scenario_code")
    scenarios = ["BASE", "PEAK", "DISRUPT"]
    y = np.arange(len(scenarios))
    fig, ax = plt.subplots(figsize=(6.5, 2.9))
    # Horizontal bars, so each value sits at its bar's tip without colliding with its neighbor.
    ax.set_ylim(len(scenarios) - 0.5, -0.5)  # first scenario on top
    ax.grid(axis="y", visible=False)
    ax.grid(axis="x", visible=True)
    ax.spines["bottom"].set_visible(False)
    ax.spines["left"].set_visible(True)
    offsets = vs.group_offsets(ax, 2, axis="y")
    series = [("Current draft", draft, vs.DRAFT, vs.LABEL, "normal"), ("Our first plan", plan, vs.PLAN, vs.INK, "semibold")]
    for offset, (label, table, color, ink, weight) in zip(offsets, series):
        values = table.loc[scenarios, "expected_met"] * 100
        bars = vs.bars(ax, y, values, color=color, offset=offset, horizontal=True, label=label)
        ax.bar_label(bars, fmt="{:.1f}%", padding=5, color=ink, fontsize=vs.LABEL_SIZE, fontweight=weight)
    ax.set_yticks(y, scenarios)
    ax.tick_params(axis="y", labelcolor=vs.INK_MUTED)
    vs.zero_based(ax, top=112, axis="x")
    ax.set_xticks(range(0, 101, 25))
    ax.xaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
    ax.set_xlabel("Expected blocks meeting target")
    vs.header(ax)
    fig.savefig(CHARTS / "plan_vs_draft.png")
    plt.close(fig)


def goal_tradeoff(summary: dict) -> None:
    table = pd.DataFrame(summary["goal_tradeoff"])
    table = table[table["scenario_code"] == "BASE"].sort_values("goal")
    draft = pd.DataFrame(summary["draft_summary"]).set_index("scenario_code").loc["BASE"]
    fig, ax = plt.subplots(figsize=(6.5, 3.0))
    ax.plot(table["cost"] / 1000, table["expected_met"] * 100, label="Our plan at each service goal", **vs.PLAN_LINE, **vs.MARKERS)
    # Labels alternate above and below the line so neighbors don't collide: (dx, dy, ha, va) in points.
    places = {0.85: (0, 8, "center", "bottom"), 0.90: (2, -9, "center", "top"), 0.925: (-4, 8, "center", "bottom"),
              0.95: (6, -8, "left", "top"), 0.975: (0, 8, "center", "bottom"), 0.99: (0, 8, "center", "bottom")}
    for row in table.itertuples():
        chosen = abs(row.goal - summary["service_goal"]) < 1e-9
        label = f"{row.goal * 100:g}% goal" + (" (chosen)" if chosen else "")
        dx, dy, ha, va = places[round(row.goal, 3)]
        vs.label_point(ax, row.cost / 1000, row.expected_met * 100, label if chosen else f"{row.goal * 100:g}%", dx=dx, dy=dy,
                       ha=ha, va=va, color=vs.INK if chosen else vs.LABEL, fontweight="semibold" if chosen else "normal")
    ax.plot([draft["cost"] / 1000], [draft["expected_met"] * 100], color=vs.DRAFT, linestyle="none", label="Current draft", **vs.MARKERS)
    vs.label_point(ax, draft["cost"] / 1000, draft["expected_met"] * 100, "Current draft", dx=9, dy=0, ha="left", va="center")
    ax.set_xlabel("BASE labor cost for the week")
    ax.xaxis.set_major_formatter(vs.formatter("${x:.0f}K"))
    ax.set_ylabel("Expected blocks meeting target")
    ax.yaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
    ax.set_ylim(65, 102)
    vs.header(ax)
    fig.savefig(CHARTS / "goal_tradeoff.png")
    plt.close(fig)


def service_by_day(summary: dict) -> None:
    """Expected service by day, plan against draft, one panel per scenario."""
    table = pd.DataFrame(summary["plan_by_day"])
    fig, axes = plt.subplots(1, 3, figsize=(6.5, 2.7), sharey=True)
    x = np.arange(len(DATES))
    for ax, scenario in zip(axes, SCENARIOS):
        part = table[table["scenario_code"] == scenario].set_index("day_date").reindex(DATES)
        _window_band(ax, None)
        ax.axhline(summary["service_goal"] * 100, color=vs.INK_SUBTLE, linewidth=vs.HAIRLINE, linestyle=(0, (3, 3)), zorder=1)
        ax.plot(x, part["expected_met_draft"] * 100, label="Draft", **vs.DRAFT_LINE, **vs.MARKERS)
        ax.plot(x, part["expected_met"] * 100, label="Plan", **vs.PLAN_LINE, **vs.MARKERS)
        low = part["expected_met"].idxmin()
        vs.label_point(ax, DATES.index(low), part.loc[low, "expected_met"] * 100, f"{part.loc[low, 'expected_met']:.0%}", dx=0, dy=-9,
                       va="top", color=vs.INK, fontsize=vs.TICK_SIZE * 0.85)
        ax.set_xticks(x, [d.split()[0][0] for d in DAYS])
        ax.set_xlim(-0.5, len(DATES) - 0.5)
        _panel_title(ax, scenario)
    axes[0].set_ylim(0, 105)
    axes[0].set_yticks(range(0, 101, 25))
    axes[0].yaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
    axes[0].set_ylabel("Expected service")
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend([vs._key(h) for h in handles[::-1]], labels[::-1], loc="lower left", bbox_to_anchor=(0.06, 1.0), ncol=2, frameon=False,
               fontsize=vs.LABEL_SIZE, labelcolor=vs.INK_MUTED)
    fig.subplots_adjust(wspace=0.1)
    _save(fig, "service_by_day")


def pto_what_if(summary: dict) -> None:
    """The holiday-PTO test: blocks below the goal and cost as more people per block are kept from PTO."""
    table = pd.DataFrame(summary["pto_what_if"]).sort_values("kept_per_block")
    x = table["kept_per_block"].to_numpy()
    fig, (left, right) = plt.subplots(1, 2, figsize=(6.5, 2.7))
    left.set_xlim(-0.6, x.max() + 0.6)
    bars = vs.bars(left, x, table["blocks_below_goal"], color=vs.PLAN, label="Blocks below the goal")
    left.bar_label(bars, fmt="{:.0f}", padding=3, color=vs.INK, fontsize=vs.TICK_SIZE * 0.9)
    vs.zero_based(left, top=table["blocks_below_goal"].max() * 1.2)
    left.set_xticks(x)
    left.set_xlabel("People kept from PTO per block")
    _panel_title(left, "BASE blocks below the goal", y=1.05)
    right.plot(x, table["cost"] / 1000, **vs.PLAN_LINE, **vs.MARKERS)
    first, last = table["cost"].iloc[0] / 1000, table["cost"].iloc[-1] / 1000
    vs.label_point(right, x[0], first, f"${first:,.1f}K", dx=7, dy=4, ha="left", va="bottom")
    vs.label_point(right, x[-1], last, f"${last:,.1f}K", dx=0, dy=8, ha="center")
    right.set_xticks(x)
    right.set_xlim(-0.4, x.max() + 0.4)
    lo, hi = table["cost"].min() / 1000, table["cost"].max() / 1000
    right.set_ylim(lo - (hi - lo) * 0.4, hi + (hi - lo) * 0.5)
    right.yaxis.set_major_formatter(vs.formatter("${x:,.0f}K"))
    right.set_xlabel("People kept from PTO per block")
    _panel_title(right, "BASE labor cost for the week", y=1.05)
    fig.subplots_adjust(wspace=0.32)
    _save(fig, "pto_what_if")


def calibration(summary: dict) -> None:
    """Predicted chance against the observed share, out of sample, grouped by predicted chance."""
    table = pd.DataFrame(summary["service_calibration"])
    fig, ax = plt.subplots(figsize=(6.5, 3.3))
    ax.plot([0, 100], [0, 100], color=vs.AXIS, linewidth=vs.HAIRLINE * 1.4, zorder=1)
    vs.label_point(ax, 50, 50, "Perfect agreement", dx=6, dy=-6, ha="left", va="top", color=vs.INK_SUBTLE)
    ax.plot(table["predicted"] * 100, table["observed"] * 100, color=vs.PLAN, linestyle="none", **vs.MARKERS, zorder=4,
            label="Group of blocks, by predicted chance")
    for row in table.itertuples():
        dx, ha = (8, "left") if row.predicted < 0.9 else (-8, "right")
        vs.label_point(ax, row.predicted * 100, row.observed * 100, f"{row.bin} ({row.blocks})", dx=dx, dy=0, ha=ha, va="center",
                       fontsize=vs.TICK_SIZE * 0.82)
    ax.set_xlim(-3, 104)
    ax.set_ylim(-3, 106)
    ax.grid(axis="x", visible=True)
    ax.xaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
    ax.yaxis.set_major_formatter(vs.formatter("{x:.0f}%"))
    ax.set_xlabel("Predicted chance of meeting target (curve fitted without that week)")
    ax.set_ylabel("Share that met target")
    vs.header(ax)
    _save(fig, "calibration")


def architecture() -> None:
    """How the pieces fit: data pack, Python engine, saved outputs, the API, the React app and the document builders."""
    fig, ax = plt.subplots(figsize=(6.5, 3.0))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 46)
    ax.axis("off")
    # Units are about equal on both axes (100 wide by 46 high on a 6.5 by 3 inch figure).
    boxes = {
        "data": (0, 15, 18, 15, "Case data pack", "CSV files:\nhistory, planning\ngrid, rates"),
        "engine": (23, 11, 25, 23, "Python engine", "src/: forecast,\nservice curves, risk,\nallocation, search,\nexplanations"),
        "outputs": (54, 29, 20, 15, "Saved outputs", "outputs/: submission\nCSV, tables,\nsummary file"),
        "api": (54, 1, 20, 15, "FastAPI server", "server/: on this\ncomputer only,\nno internet"),
        "docs": (80, 29, 20, 15, "Report and deck", "built by Node\nscripts from the\nsaved outputs"),
        "web": (80, 1, 20, 15, "React app", "web/: opens in\nthe browser at\nlocalhost:8501"),
    }
    for key, (x, y, w, h, title, body) in boxes.items():
        accent = key == "engine"
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=1.4",
                                    facecolor=vs.ACCENT_SOFT if accent else vs.SURFACE,
                                    edgecolor=vs.ACCENT if accent else BORDER_STRONG, linewidth=1.1))
        ax.text(x + w / 2, y + h - 2.0, title, ha="center", va="top", fontsize=vs.TICK_SIZE * 0.82, fontweight="semibold", color=vs.INK)
        ax.text(x + w / 2, y + h - 6.0, body, ha="center", va="top", fontsize=vs.TICK_SIZE * 0.7, color=vs.INK_MUTED, linespacing=1.25)
    arrows = [((18, 22.5), (23, 22.5), None), ((48, 28), (54, 36), ("pipeline", (51.6, 37.6))),
              ((48, 16), (54, 9), ("live what-ifs", (51.6, 7.4))),
              ((74, 36.5), (80, 36.5), None), ((74, 8.5), (80, 8.5), ("JSON", "top")), ((64, 29), (64, 16), ("reads", "side"))]
    for (x0, y0), (x1, y1), label in arrows:
        ax.annotate("", (x1, y1), (x0, y0), arrowprops={"arrowstyle": "-|>", "color": vs.INK_SUBTLE, "linewidth": 1.1,
                                                         "shrinkA": 0, "shrinkB": 0, "mutation_scale": 9})
        if label:
            text, where = label
            if where == "top":
                ax.text((x0 + x1) / 2, y0 + 1.2, text, ha="center", va="bottom", fontsize=vs.TICK_SIZE * 0.68, color=vs.INK_SUBTLE)
            elif where == "side":
                ax.text(x0 + 1.2, (y0 + y1) / 2, text, ha="left", va="center", fontsize=vs.TICK_SIZE * 0.68, color=vs.INK_SUBTLE)
            else:
                ax.text(*where, text, ha="right", va="center", fontsize=vs.TICK_SIZE * 0.68, color=vs.INK_SUBTLE)
    _save(fig, "architecture")


def run() -> None:
    CHARTS.mkdir(parents=True, exist_ok=True)
    vs.apply()
    summary = json.loads((OUTPUTS / "analysis_summary.json").read_text(encoding="utf-8"))
    plan = pd.read_csv(OUTPUTS / "plan_vs_draft.csv")
    from src.data import load_planning_grid
    grid = load_planning_grid()
    grid["day_date"] = pd.to_datetime(grid["day_date"]).dt.strftime("%Y-%m-%d")
    facts: dict = {"note": "Figures the report's charts are drawn from, written by python -m src.charts. Not an engine output."}
    service_cliff(summary)
    benchmark_gap(summary)
    plan_vs_draft(summary)
    goal_tradeoff(summary)
    planning_timeline(grid, facts)
    staffing_gaps()
    callout_rates(summary)
    forecast_vs_benchmark(summary)
    backtest_error(summary)
    holiday_factors(summary)
    service_curves(summary)
    risk_example(summary, plan, facts)
    allocation_example(grid, plan, facts)
    hours_by_day(plan, facts)
    service_by_day(summary)
    pto_what_if(summary)
    calibration(summary)
    architecture()
    (CHARTS / "figure_data.json").write_text(json.dumps(facts, indent=1, default=float), encoding="utf-8")


if __name__ == "__main__":
    run()
    print("Wrote charts to", CHARTS)
