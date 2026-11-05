// How the weekly board colors its cells. Three modes, each a single job:
//   change  headcount vs the draft: gray cuts, iris adds, pale for small changes
//   chance  chance of meeting target: pale when safe, amber and red below the goal
//   util    utilization of worked hours: pale with slack, amber and red at the service cliff
// Every cell also prints the number its color encodes, so color is never the only signal.
import { tokens } from "../../styles/tokens";
import { fmtPct, signedInt } from "../../lib/format";
import type { Block } from "../../lib/types";

export type ColorMode = "change" | "chance" | "util";

export const COLOR_MODES: { value: ColorMode; label: string; description: string }[] = [
  { value: "change", label: "Change", description: "People added (iris) or cut (gray) against the managers' draft. Deeper means a bigger change." },
  { value: "chance", label: "Chance", description: "The plan's predicted chance of meeting the service target. Pale is safe; amber and red are below the 95% goal." },
  { value: "util", label: "Utilization", description: "Demand hours over worked hours. Service falls off a cliff at 85 to 90%, so amber and red are near or past it." },
];

/**
 * Draft 3 board tiers (dashboard-design, heatmaps): classed tiers as token + alpha over the card, with intensity
 * growing toward the problem. Healthy cells are pale, so the warm tiers and the below-goal marker are the most
 * salient marks on the board instead of a wall of saturated purple. Text is always ink, never the accent.
 */
const mix = (token: string, pct: number) => `color-mix(in srgb, var(--wp-color-${token}) ${pct}%, var(--wp-color-surface))`;
const INK = tokens.color.ink;

interface Tier {
  fill: string;
  label: string;
  sample: string;
}

/** Headcount change, -3 or fewer to +3 or more. Cuts are gray (fewer isn't a problem), adds are iris. */
const CHANGE_TIERS: Tier[] = [
  { fill: mix("ink-subtle", 30), label: "3 or more fewer", sample: "−3" },
  { fill: mix("ink-subtle", 19), label: "2 fewer", sample: "−2" },
  { fill: mix("ink-subtle", 10), label: "1 fewer", sample: "−1" },
  { fill: "var(--wp-color-surface)", label: "No change", sample: "0" },
  { fill: mix("accent", 11), label: "1 more", sample: "+1" },
  { fill: mix("accent", 21), label: "2 more", sample: "+2" },
  { fill: mix("accent", 34), label: "3 or more more", sample: "+3" },
];

/** Chance of meeting target. Breaks at 80, 95 (the goal) and 98%. */
const CHANCE_BREAKS = [0.8, 0.95, 0.98];
const CHANCE_TIERS: Tier[] = [
  { fill: mix("risk", 24), label: "under 80%", sample: "<80%" },
  { fill: mix("warning", 34), label: "80 to 95%, below the goal", sample: "80–95" },
  { fill: mix("accent", 14), label: "95 to 98%", sample: "95–98" },
  { fill: mix("accent", 5), label: "98% or more", sample: "98%+" },
];

/**
 * Utilization. Breaks follow the service cliff: blocks meet target more than 99% of the time below 0.85 and
 * almost never at 0.90 or above.
 */
export const UTIL_SCALE = { breaks: [0.8, 0.85, 0.9] } as const;
const UTIL_TIERS: Tier[] = [
  { fill: mix("accent", 5), label: "under 80%", sample: "<80%" },
  { fill: mix("accent", 14), label: "80 to 85%", sample: "80–85" },
  { fill: mix("warning", 34), label: "85 to 90%, the cliff", sample: "85–90" },
  { fill: mix("risk", 24), label: "90% or more", sample: "90%+" },
];

const tierAt = (breaks: readonly number[], v: number) => {
  const i = breaks.findIndex((b) => v < b);
  return i === -1 ? breaks.length : i;
};

export function utilFill(u: number | null | undefined): { fill: string; ink: string } {
  if (u == null) return { fill: tokens.color.raised, ink: tokens.color.ink_subtle };
  return { fill: UTIL_TIERS[tierAt(UTIL_SCALE.breaks, u)].fill, ink: INK };
}

export function chanceTierFill(c: number | null | undefined): { fill: string; ink: string } {
  if (c == null) return { fill: tokens.color.raised, ink: tokens.color.ink_subtle };
  return { fill: CHANCE_TIERS[tierAt(CHANCE_BREAKS, c)].fill, ink: INK };
}

export function changeTierFill(change: number | null | undefined): { fill: string; ink: string } {
  if (change == null) return { fill: tokens.color.raised, ink: tokens.color.ink_subtle };
  return { fill: CHANGE_TIERS[Math.max(-3, Math.min(3, Math.round(change))) + 3].fill, ink: INK };
}

/**
 * A chance of meeting target as a whole percent, except that a block below the goal never reads as
 * reaching it: 0.947 against a 95% goal prints "94.7%", as the API's explanations do.
 */
export function fmtChance(chance: number | null | undefined, belowGoal: boolean, goal: number): string {
  if (chance == null) return fmtPct(chance, 0);
  if (belowGoal && Math.round(chance * 100) >= Math.round(goal * 100)) return `${(Math.floor(chance * 1000) / 10).toFixed(1)}%`;
  return fmtPct(chance, 0);
}

/** The fill and label ink for one open block in a mode. */
export function cellFill(block: Block, mode: ColorMode) {
  if (mode === "chance") return chanceTierFill(block.chance);
  if (mode === "util") return utilFill(block.utilization);
  return changeTierFill(block.change);
}

/** The figure that the mode's color encodes, printed beside the headcount. */
export function cellMetric(block: Block, mode: ColorMode, goal: number): string {
  if (mode === "chance") return fmtChance(block.chance, block.below_goal, goal);
  if (mode === "util") return fmtPct(block.utilization, 0);
  return block.change === 0 ? "0" : signedInt(block.change);
}

export interface LegendStop {
  fill: string;
  ink: string;
  label: string;
  sample: string;
}

/** Legend stops for a mode, low to high (fewer to more for change). `sample` is printed on the chip. */
export function legendStops(mode: ColorMode): LegendStop[] {
  const tiers = mode === "chance" ? CHANCE_TIERS : mode === "util" ? UTIL_TIERS : CHANGE_TIERS;
  return tiers.map((t) => ({ fill: t.fill, ink: INK, label: t.label, sample: t.sample }));
}

/** Order of departments and shifts down the board. */
export const DEPT_ORDER = [38, 92, 95];
export const SHIFT_ORDER = ["OPEN", "MID", "EVE"];
export const shiftIndex = (code: string) => {
  const i = SHIFT_ORDER.indexOf(code);
  return i === -1 ? 99 : i;
};
