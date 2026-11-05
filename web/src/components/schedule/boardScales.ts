// How the weekly board colors its cells. Three modes, each a single job:
//   change  diverging, headcount vs the draft (tokens.scale.change via changeFill)
//   chance  sequential, chance of meeting target (tokens.scale.chance via chanceFill)
//   util    sequential, utilization of worked hours
// Every cell also prints the number its color encodes, so color is never the only signal.
import { tokens } from "../../styles/tokens";
import { chanceFill, changeFill } from "../charts/chartTheme";
import { fmtPct, signedInt } from "../../lib/format";
import type { Block } from "../../lib/types";

export type ColorMode = "change" | "chance" | "util";

export const COLOR_MODES: { value: ColorMode; label: string; description: string }[] = [
  { value: "change", label: "Change from draft", description: "People added (iris) or cut (bronze) against the manager's draft." },
  { value: "chance", label: "Chance of meeting target", description: "The plan's predicted chance of meeting the service target. Darker is safer; the goal is 95%." },
  { value: "util", label: "Utilization", description: "Demand hours over worked hours. Service falls off a cliff near 85-90%, so darker means closer to the edge." },
];

const ch = tokens.scale.change;

/**
 * Utilization uses the change scale's lean arm (gray, then bronze-orange), because a block running
 * hot is a thinly staffed block. Breaks follow the service cliff: blocks meet target more than 99%
 * of the time below 0.85 and almost never at 0.90 or above.
 */
export const UTIL_SCALE = {
  breaks: [0.8, 0.85, 0.9],
  stops: [ch.stops[3], ch.stops[2], ch.stops[1], ch.stops[0]],
  ink: [ch.label_ink[3], ch.label_ink[2], ch.label_ink[1], ch.label_ink[0]],
  labels: ["under 80%", "80 to 85%", "85 to 90%", "90% or more"],
} as const;

export function utilFill(u: number | null | undefined): { fill: string; ink: string } {
  if (u == null) return { fill: tokens.color.raised, ink: tokens.color.ink_subtle };
  let i = UTIL_SCALE.breaks.findIndex((b) => u < b);
  if (i === -1) i = UTIL_SCALE.stops.length - 1;
  return { fill: UTIL_SCALE.stops[i], ink: UTIL_SCALE.ink[i] };
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
  if (mode === "chance") return chanceFill(block.chance);
  if (mode === "util") return utilFill(block.utilization);
  return changeFill(block.change);
}

/** The figure that the mode's color encodes, printed under the headcount. */
export function cellMetric(block: Block, mode: ColorMode, goal: number): string {
  if (mode === "chance") return fmtChance(block.chance, block.below_goal, goal);
  if (mode === "util") return fmtPct(block.utilization, 0);
  return `from ${block.draft}`;
}

export interface LegendStop {
  fill: string;
  ink: string;
  label: string;
  sample: string;
}

/** Short range labels from a scale's breaks: "<80%", "80-85", ..., "98%+". */
function rangeLabels(breaks: readonly number[]): string[] {
  const p = (x: number) => Math.round(x * 100);
  const out = [`<${p(breaks[0])}%`];
  for (let i = 1; i < breaks.length; i++) out.push(`${p(breaks[i - 1])}-${p(breaks[i])}`);
  out.push(`${p(breaks[breaks.length - 1])}%+`);
  return out;
}

/** Legend stops for a mode, light to dark (or fewer to more for change). `sample` is printed on the chip. */
export function legendStops(mode: ColorMode): LegendStop[] {
  if (mode === "chance") {
    const s = tokens.scale.chance;
    const short = rangeLabels(s.breaks);
    return s.stops.map((fill, i) => ({ fill, ink: s.label_ink[i], label: s.labels[i], sample: short[i] }));
  }
  if (mode === "util") {
    const short = rangeLabels(UTIL_SCALE.breaks);
    return UTIL_SCALE.stops.map((fill, i) => ({ fill, ink: UTIL_SCALE.ink[i], label: UTIL_SCALE.labels[i], sample: short[i] }));
  }
  // The end chips cover everything beyond them (cells reach +14 and -6), so they say so.
  const last = ch.stops.length - 1;
  return ch.stops.map((fill, i) => ({
    fill,
    ink: ch.label_ink[i],
    label: ch.labels[i],
    sample: i === 0 ? `${signedInt(ch.values[i])} or fewer` : i === last ? `${signedInt(ch.values[i])} or more` : signedInt(ch.values[i]),
  }));
}

/** Order of departments and shifts down the board. */
export const DEPT_ORDER = [38, 92, 95];
export const SHIFT_ORDER = ["OPEN", "MID", "EVE"];
export const shiftIndex = (code: string) => {
  const i = SHIFT_ORDER.indexOf(code);
  return i === -1 ? 99 : i;
};
