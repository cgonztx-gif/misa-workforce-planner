// What-if on the Overview (D-33, DRAFT4.md section 14). The adjustments the Scenario lab held, applied live: the server
// re-plans under the new conditions (/api/what-if, 2-6 s new, ~20 ms cached), and the page shows that plan in place of
// the submitted one. The comparison baseline switches from the draft to the submitted plan exactly as the default view
// shows it, so every "+N" reads as "what these conditions change". The CSV is always the submitted file.

import { MINUS } from "./format";
import type { Block, GroupTotals, PlanResponse, Summary, SummaryChange, WarehouseKey, WhatIfResponse, WhatIfSettings } from "./types";

export const WI_DEFAULTS: WhatIfSettings = { goal: 0.95, callouts: 1, demand: 0, availability: 0 };

/** The server's limits (server/API.md; /api/meta what_if_limits carries the same). Steps match the server's rounding. */
export const WI_LIMITS = {
  goal: [0.9, 0.925, 0.95, 0.975],
  callouts: { min: 0, max: 2, step: 0.25 },
  demand: { min: -0.1, max: 0.15, step: 0.01 },
  availability: { min: -0.3, max: 0, step: 0.05 },
} as const;

export type WiKey = keyof WhatIfSettings;
export type RangeKey = Exclude<WiKey, "goal">;

/** Round to the slider's step, so 0.1 never travels as 0.09999999. */
export const snap = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(4));

export const isDefault = (s: WhatIfSettings) =>
  Math.abs(s.goal - WI_DEFAULTS.goal) < 1e-9 &&
  Math.abs(s.callouts - WI_DEFAULTS.callouts) < 1e-9 &&
  Math.abs(s.demand - WI_DEFAULTS.demand) < 1e-9 &&
  Math.abs(s.availability - WI_DEFAULTS.availability) < 1e-9;

export const sameSettings = (a: WhatIfSettings, b: WhatIfSettings) =>
  (["goal", "callouts", "demand", "availability"] as WiKey[]).every((k) => Math.abs(a[k] - b[k]) < 1e-9);

/** Draft 3's quick starts. "Busier week" is the one the server warms at startup for every scenario. */
export const PRESETS: { id: string; label: string; settings: WhatIfSettings; tip: string }[] = [
  { id: "busier", label: "Busier week", settings: { ...WI_DEFAULTS, demand: 0.1, callouts: 1.5 }, tip: "Demand +10% · callouts 1.5×" },
  { id: "illness", label: "Illness wave", settings: { ...WI_DEFAULTS, callouts: 2, availability: -0.2 }, tip: "Callouts 2× · regular staff −20%" },
  { id: "quieter", label: "Quieter week", settings: { ...WI_DEFAULTS, demand: -0.05 }, tip: "Demand −5%" },
  { id: "goal", label: "Higher goal", settings: { ...WI_DEFAULTS, goal: 0.975 }, tip: "Service goal 97.5%" },
];

const pctSigned = (x: number) => {
  const v = Math.round(x * 100);
  return v > 0 ? `+${v}%` : v < 0 ? `${MINUS}${-v}%` : "±0%";
};

/** How each setting reads on screen: "95%", "1.5×", "+10%", "−20%". */
export const valueText: Record<WiKey, (v: number) => string> = {
  goal: (v) => `${+(v * 100).toFixed(1)}%`,
  callouts: (v) => `${v.toFixed(2).replace(/0$/, "")}×`,
  demand: pctSigned,
  availability: pctSigned,
};

export const LABEL: Record<WiKey, string> = { goal: "Service goal", callouts: "Callouts", demand: "Demand", availability: "Regular staff" };
export const TIP: Record<WiKey, string> = {
  goal: "The chance of meeting the wait target each block aims for · submitted at 95%",
  callouts: "A multiple of the historical callout rate · 1× is history, 2× doubles it",
  demand: "A change to every open block's forecast",
  availability: "A change to each block's available regular staff, rounded to whole people · overtime and cross-trained pools stay as they are",
};

/** The settings that differ from the submitted plan's, as short chips: ["Demand +10%", "Callouts 1.5×"]. */
export function changedChips(s: WhatIfSettings): { key: WiKey; text: string }[] {
  return (["demand", "callouts", "availability", "goal"] as WiKey[])
    .filter((k) => Math.abs(s[k] - WI_DEFAULTS[k]) > 1e-9)
    .map((k) => ({ key: k, text: `${k === "goal" ? "Goal" : LABEL[k]} ${valueText[k](s[k])}` }));
}

export const whatIfUrl = (scenario: string, s: WhatIfSettings) =>
  `/api/what-if?scenario=${scenario}&goal=${s.goal}&callouts=${s.callouts}&demand=${s.demand}&availability=${s.availability}`;

const NUM_KEYS: (keyof SummaryChange)[] = ["employees", "hours", "overtime_hours", "flex_hours", "cost", "expected_met", "below_goal", "over_capacity", "unfilled"];
const diff = (a: Summary, b: Summary): SummaryChange =>
  Object.fromEntries(NUM_KEYS.map((k) => [k, a[k] == null || b[k] == null ? null : (a[k] as number) - (b[k] as number)])) as unknown as SummaryChange;

/**
 * The what-if, re-based on the submitted plan: every "draft" field of a block and of the totals becomes the submitted
 * plan's value (as the default view shows it), and every change becomes what-if minus submitted. The totals' change is
 * the server's own vs_submitted change; per block it is the same subtraction the server's `changes` list makes (they
 * agree on every block, F-77). Nothing is re-planned here.
 */
export function rebase(w: WhatIfResponse, sub: PlanResponse): PlanResponse {
  const subBy = new Map(sub.blocks.map((b) => [b.key, b]));
  const blocks: Block[] = w.blocks.map((b) => {
    const s = subBy.get(b.key);
    if (!s) return b;
    return {
      ...b,
      draft: s.plan,
      change: b.plan - s.plan,
      draft_sources: { ...s.sources, unfilled: 0 },
      cost_draft: s.cost,
      cost_change: b.cost - s.cost,
      hours_draft: s.hours,
      utilization_draft: s.utilization,
      chance_draft: s.chance,
      below_goal_draft: s.below_goal,
    };
  });
  const totals = Object.fromEntries(
    (Object.keys(w.totals) as WarehouseKey[]).map((wk) => {
      const t = w.totals[wk];
      const st = sub.totals[wk];
      const vs = w.vs_submitted?.[wk];
      const subDays = new Map(st.by_day.map((d) => [d.date, d]));
      const out: GroupTotals = {
        ...t,
        draft: st.plan,
        change: vs?.change ?? diff(t.plan, st.plan),
        rescored: vs?.submitted_rescored,
        by_day: t.by_day.map((d) => {
          const sd = subDays.get(d.date);
          return sd ? { ...d, draft: sd.plan, change: diff(d.plan, sd.plan) } : d;
        }),
        // Departments too, so "Where the cost goes" compares the what-if with the submitted plan, not the draft.
        by_department: t.by_department.map((d) => {
          const sd = st.by_department.find((x) => x.dept_id === d.dept_id);
          return sd ? { ...d, draft: sd.plan, change: diff(d.plan, sd.plan) } : d;
        }),
      };
      return [wk, out];
    }),
  ) as Record<WarehouseKey, GroupTotals>;
  return { scenario: w.scenario, goal: w.goal, blocks, totals };
}
