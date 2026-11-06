import { chanceText, goalText, hoursExact, int, num1, pctChange, plural, pts, signed, signedUsd, usd, usdCompact, wasN } from "../lib/format";
import type { GroupTotals } from "../lib/types";
import type { Lens } from "../lib/url";
import { KpiTile, type TileData } from "./KpiTile";

/** The tile values come straight from totals[wk] (DRAFT4.md 5.4). */
export function tilesFor(T: GroupTotals, goal: number): TileData[] {
  const p = T.plan;
  const d = T.draft;
  const c = T.change;
  const days = T.by_day;
  const pct = (x: number | null) => (x == null ? "—" : chanceText(x));
  const exact = (x: number | null) => (x == null ? "—" : `${(Math.round(x * 10000) / 100).toFixed(2)}%`);
  const g = goalText(goal);

  const dService = c.expected_met ?? 0;
  const dBelow = c.below_goal ?? 0;
  const belowTiny = d.below_goal < 5;
  // Spoken deltas: "up 27.1 points", "down 110", "up 13%"; context first, then the value, then the baseline.
  const said = (d: string, unit = "") => (d.startsWith("was ") ? d : d.startsWith("±") ? "no change" : `${d.startsWith("+") ? "up" : "down"} ${d.slice(1)}${unit}`);
  const costDelta = d.cost < 5 ? wasN(d.cost, usd) : pctChange(c.cost ?? 0, d.cost);
  const dCost = c.cost ?? 0;
  const costTone: TileData["tone"] = d.cost < 5 || dCost === 0 || costDelta.startsWith("±") ? "grey" : dCost > 0 ? "bad" : "good";
  const unfilledLine = d.unfilled > 0 ? `\nDraft can't field ${plural(d.unfilled, "person").replace("persons", "people")} in ${plural(d.over_capacity, "block")}` : "";

  return [
    {
      kind: "service",
      aria: `Service ${pct(p.expected_met)}, ${said(pts(dService).replace(" pts", ""), " points")} from draft ${pct(d.expected_met)}`,
      label: "Service",
      value: pct(p.expected_met),
      raw: p.expected_met,
      delta: pts(dService),
      tone: dService > 0 ? "good" : dService < 0 ? "bad" : "grey",
      sub: `Draft ${pct(d.expected_met)}`,
      spark: days.map((x) => x.plan.expected_met ?? 0),
      tipTitle: exact(p.expected_met),
      tip: `Expected service · average chance an open block meets its wait target\nDraft ${exact(d.expected_met)} · Goal ${g} per block\nLowest block ${pct(p.lowest_chance)}`,
    },
    {
      kind: "below",
      aria: `Below goal ${int(p.below_goal)} blocks, ${said(belowTiny ? wasN(d.below_goal) : signed(dBelow))} from draft ${int(d.below_goal)}`,
      label: "Below goal",
      value: int(p.below_goal),
      raw: p.below_goal,
      delta: belowTiny ? wasN(d.below_goal) : signed(dBelow),
      tone: belowTiny || dBelow === 0 ? "grey" : dBelow < 0 ? "good" : "bad",
      sub: `Draft ${int(d.below_goal)}`,
      spark: days.map((x) => x.plan.below_goal),
      tipTitle: `${int(p.below_goal)} of ${int(p.blocks)}`,
      tip: `Open blocks under a ${g} chance even with all their own staff and overtime\nDraft ${int(d.below_goal)}${unfilledLine}`,
    },
    {
      kind: "people",
      aria: `People ${int(p.employees)}, ${said(d.employees < 5 ? wasN(d.employees) : pctChange(c.employees ?? 0, d.employees))} from draft ${int(d.employees)}`,
      label: "People",
      value: int(p.employees),
      raw: p.employees,
      delta: d.employees < 5 ? wasN(d.employees) : pctChange(c.employees ?? 0, d.employees),
      tone: "grey",
      sub: `Draft ${int(d.employees)}`,
      spark: days.map((x) => x.plan.employees),
      tipTitle: `${int(p.employees)} people`,
      tip: `Employees summed over the ${int(p.blocks)} open blocks, as submitted\nOne person in two blocks counts twice\n${hoursExact(p.hours)} paid · ${num1(p.overtime_hours)} overtime · ${int(p.over_capacity)} over capacity\nDraft ${int(d.employees)}`,
    },
    {
      kind: "cost",
      aria: `Labor cost ${usd(p.cost)}, ${said(d.cost < 5 ? wasN(d.cost, usd) : pctChange(c.cost ?? 0, d.cost))} from draft ${usd(d.cost)}`,
      label: "Labor cost",
      value: usdCompact(p.cost),
      raw: p.cost,
      delta: costDelta,
      // Labor cost is lower-is-better (components.md "Delta badge"): a rise is red, a fall green, a tiny base grey.
      tone: costTone,
      sub: `Draft ${usdCompact(d.cost)}`,
      spark: days.map((x) => x.plan.cost),
      tipTitle: usd(p.cost),
      tip: `Draft ${usd(d.cost)} · ${signedUsd(c.cost ?? 0)}\nLower is better, so a rise shows red and a fall green\nThe extra cost buys ${Math.abs(Math.round(dService * 1000) / 10).toFixed(1)} points of expected service`,
    },
  ];
}

export function KpiStrip({ T, goal, lens, onLens }: { T: GroupTotals; goal: number; lens: Lens; onLens: (l: Lens) => void }) {
  const tiles = tilesFor(T, goal);
  return (
    <div className="grid grid-cols-2 border-b border-line sm:grid-cols-4" role="group" aria-label="Headline numbers">
      {tiles.map((t) => (
        <KpiTile key={t.kind} t={t} selected={lens === t.kind} onSelect={() => onLens(t.kind)} />
      ))}
    </div>
  );
}
