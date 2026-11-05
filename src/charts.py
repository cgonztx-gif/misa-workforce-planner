"""Charts for the analysis document, drawn from outputs/analysis_summary.json.

Start it with: python -m src.charts
Static images for Word, so every chart also has a table beside it in the document. The look
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

from src import viz_style as vs  # noqa: E402
from src.pipeline import OUTPUTS  # noqa: E402

CHARTS = OUTPUTS / "charts"
DEPT_IDS = {38: "Front End", 92: "Merchandising", 95: "Pharmacy"}
DAYS = ["Thu 12", "Fri 13", "Sat 14", "Sun 15", "Mon 16", "Tue 17", "Wed 18"]


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


def run() -> None:
    CHARTS.mkdir(parents=True, exist_ok=True)
    vs.apply()
    summary = json.loads((OUTPUTS / "analysis_summary.json").read_text(encoding="utf-8"))
    service_cliff(summary)
    benchmark_gap(summary)
    plan_vs_draft(summary)
    goal_tradeoff(summary)


if __name__ == "__main__":
    run()
    print("Wrote charts to", CHARTS)
