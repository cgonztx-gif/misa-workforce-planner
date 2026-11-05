"""The matplotlib half of the shared-look check (T-79, D-26): plan vs draft hours by day for BASE.

    python -m planning.evidence.look_samples.sample_chart     (from the repo root)

Writes plan_vs_draft_by_day.png next to this file. The deck half is scripts/deck/sample_theme.js,
which draws the same chart natively in PowerPoint; the two should read as one product.
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from src import viz_style as vs  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent


def main() -> Path:
    vs.apply()
    summary = json.loads((ROOT / "outputs" / "analysis_summary.json").read_text(encoding="utf-8"))
    days = pd.DataFrame(summary["plan_by_day"]).query("scenario_code == 'BASE'").sort_values("day_date")
    labels = [f"{d:%a} {d.day}" for d in pd.to_datetime(days["day_date"])]
    x = np.arange(len(days))

    fig, ax = plt.subplots(figsize=(6.5, 3.4))
    ax.set_xlim(-0.6, len(days) - 0.4)
    offsets = vs.group_offsets(ax, 2)
    vs.bars(ax, x, days["hours_draft"], color=vs.DRAFT, offset=offsets[0], label="Draft")
    vs.bars(ax, x, days["hours"], color=vs.PLAN, offset=offsets[1], label="Plan")
    vs.zero_based(ax, top=2000)
    ax.set_xticks(x, labels)
    ax.set_yticks(range(0, 2001, 500))
    ax.yaxis.set_major_formatter(vs.formatter("{x:,.0f}"))
    vs.header(ax, "Hours by day, BASE")
    ax.text(0, -0.2, "Simulated data, not real Costco data.", transform=ax.transAxes, fontsize=vs.pt(12), color=vs.INK_SUBTLE)
    out = HERE / "plan_vs_draft_by_day.png"
    fig.savefig(out)
    plt.close(fig)
    return out


if __name__ == "__main__":
    print("Wrote", main())
