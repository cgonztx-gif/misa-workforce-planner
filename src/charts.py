"""Charts for the analysis document, drawn from outputs/analysis_summary.json.

Start it with: python -m src.charts
Static images for Word, so every chart also has a table beside it in the document.
Colors are the first three categorical slots of the reference palette, checked with its validator.
"""
from __future__ import annotations

import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from src.pipeline import OUTPUTS  # noqa: E402

CHARTS = OUTPUTS / "charts"
DEPT_COLORS = {"Front End": "#2a78d6", "Merchandising": "#eb6834", "Pharmacy": "#1baf7a"}
DEPT_IDS = {38: "Front End", 92: "Merchandising", 95: "Pharmacy"}
PLAN_COLOR = "#2a78d6"
DRAFT_COLOR = "#a3a29c"
INK = "#0b0b0b"
MUTED = "#52514e"
GRID = "#e6e5e0"
DAYS = ["Thu 12", "Fri 13", "Sat 14", "Sun 15", "Mon 16", "Tue 17", "Wed 18"]


def _style() -> None:
    plt.rcParams.update(
        {
            "font.family": "Arial",
            "font.size": 10,
            "axes.edgecolor": GRID,
            "axes.labelcolor": MUTED,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "axes.grid": True,
            "axes.axisbelow": True,
            "grid.color": GRID,
            "grid.linewidth": 0.8,
            "xtick.color": MUTED,
            "ytick.color": MUTED,
            "xtick.major.size": 0,
            "ytick.major.size": 0,
            "figure.dpi": 200,
            "savefig.bbox": "tight",
            "savefig.facecolor": "white",
        }
    )


def service_cliff(summary: dict) -> None:
    bands = pd.DataFrame(summary["service_bands"])
    bands = bands[(bands["blocks"] >= 3) & bands["band"].between(0.6, 1.05)]
    fig, ax = plt.subplots(figsize=(6.5, 3.2))
    ax.axvspan(0.85, 0.90, color="#f3f2ee", zorder=0)
    ax.text(0.875, 104, "The cliff", ha="center", va="bottom", color=MUTED, fontsize=9)
    for name, color in DEPT_COLORS.items():
        part = bands[bands["department"] == name].sort_values("band")
        ax.plot(part["band"] + 0.025, part["met_target"] * 100, color=color, linewidth=2, marker="o", markersize=4.5, label=name)
    ax.set_xlabel("Utilization (workload hours / worked hours), five-point bands")
    ax.set_ylabel("Blocks meeting target (%)")
    ax.set_ylim(-3, 103)
    ax.set_xticks(np.arange(0.6, 1.11, 0.05))
    ax.set_xticklabels([f"{x:.2f}" for x in np.arange(0.6, 1.11, 0.05)], fontsize=8.5)
    ax.grid(axis="x", visible=False)
    ax.legend(frameon=False, loc="lower left")
    fig.savefig(CHARTS / "service_cliff.png")
    plt.close(fig)


def benchmark_gap(summary: dict) -> None:
    table = pd.DataFrame(summary["forecast_by_day"])
    table["gap"] = (table["benchmark"] / table["model_forecast"] - 1) * 100
    fig, ax = plt.subplots(figsize=(6.5, 3.0))
    ax.axhline(0, color=MUTED, linewidth=1)
    for dept, name in DEPT_IDS.items():
        part = table[table["dept_id"] == dept].sort_values("day_date")
        ax.plot(DAYS, part["gap"], color=DEPT_COLORS[name], linewidth=2, marker="o", markersize=4.5, label=name)
    ax.set_ylabel("Benchmark vs our model (%)")
    ax.grid(axis="x", visible=False)
    ax.legend(frameon=False, loc="upper left")
    fig.savefig(CHARTS / "benchmark_gap.png")
    plt.close(fig)


def plan_vs_draft(summary: dict) -> None:
    plan = pd.DataFrame(summary["plan_summary"]).set_index("scenario_code")
    draft = pd.DataFrame(summary["draft_summary"]).set_index("scenario_code")
    scenarios = ["BASE", "PEAK", "DISRUPT"]
    x = np.arange(3)
    width = 0.3
    fig, ax = plt.subplots(figsize=(6.5, 2.9))
    draft_bars = ax.bar(x - width / 2 - 0.01, draft.loc[scenarios, "expected_met"] * 100, width, color=DRAFT_COLOR, label="Current draft")
    plan_bars = ax.bar(x + width / 2 + 0.01, plan.loc[scenarios, "expected_met"] * 100, width, color=PLAN_COLOR, label="Our first plan")
    for bars in (draft_bars, plan_bars):
        ax.bar_label(bars, fmt="%.1f%%", padding=2, color=INK, fontsize=9)
    ax.set_xticks(x)
    ax.set_xticklabels(scenarios)
    ax.set_ylabel("Expected blocks meeting target (%)")
    ax.set_ylim(0, 112)
    ax.grid(axis="x", visible=False)
    ax.legend(frameon=False, loc="upper center", ncol=2, bbox_to_anchor=(0.5, 1.14))
    fig.savefig(CHARTS / "plan_vs_draft.png")
    plt.close(fig)


def goal_tradeoff(summary: dict) -> None:
    table = pd.DataFrame(summary["goal_tradeoff"])
    table = table[table["scenario_code"] == "BASE"].sort_values("goal")
    draft = pd.DataFrame(summary["draft_summary"]).set_index("scenario_code").loc["BASE"]
    fig, ax = plt.subplots(figsize=(6.5, 3.0))
    ax.plot(table["cost"] / 1000, table["expected_met"] * 100, color=PLAN_COLOR, linewidth=2, marker="o", markersize=4.5, label="Our plan at each service goal")
    # Labels alternate above and below the line so neighbors don't collide.
    offsets = {0.85: (-6, 7), 0.90: (2, -14), 0.925: (-8, 8), 0.95: (4, -14), 0.975: (0, 8), 0.99: (0, 8)}
    for row in table.itertuples():
        chosen = abs(row.goal - summary["service_goal"]) < 1e-9
        label = f"{row.goal * 100:g}%" + (" goal (chosen)" if chosen else "")
        ax.annotate(label, (row.cost / 1000, row.expected_met * 100), textcoords="offset points", xytext=offsets[round(row.goal, 3)], ha="center", fontsize=8.5, color=INK if chosen else MUTED, fontweight="bold" if chosen else "normal")
    ax.plot([draft["cost"] / 1000], [draft["expected_met"] * 100], color=DRAFT_COLOR, marker="o", markersize=7, linestyle="none", label="Current draft")
    ax.annotate("Current draft", (draft["cost"] / 1000, draft["expected_met"] * 100), textcoords="offset points", xytext=(8, 0), va="center", fontsize=9, color=MUTED)
    ax.set_xlabel("BASE scenario labor cost for the week ($ thousands)")
    ax.set_ylabel("Expected blocks meeting target (%)")
    ax.set_ylim(65, 102)
    ax.legend(frameon=False, loc="lower right")
    fig.savefig(CHARTS / "goal_tradeoff.png")
    plt.close(fig)


def run() -> None:
    CHARTS.mkdir(parents=True, exist_ok=True)
    _style()
    summary = json.loads((OUTPUTS / "analysis_summary.json").read_text(encoding="utf-8"))
    service_cliff(summary)
    benchmark_gap(summary)
    plan_vs_draft(summary)
    goal_tradeoff(summary)


if __name__ == "__main__":
    run()
    print("Wrote charts to", CHARTS)
