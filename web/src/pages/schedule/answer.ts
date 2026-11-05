// The Schedule page's answer, computed from the blocks on screen: where the added people go, and what stays short.
import { fmtPct, plural, signedInt } from "../../lib/format";
import type { Block } from "../../lib/types";
import type { BoardDay } from "../../components/schedule/WeeklyBoard";

export function scheduleAnswer(blocks: Block[], days: BoardDay[], goal: number): string {
  const open = blocks.filter((b) => b.is_open);
  const adds = open.filter((b) => b.change > 0);
  const cuts = open.filter((b) => b.change < 0);
  const added = adds.reduce((s, b) => s + b.change, 0);
  const net = open.reduce((s, b) => s + b.change, 0);
  const below = open.filter((b) => b.below_goal).length;

  const windowDays = days.filter((d) => d.holiday_window);
  const windowDates = windowDays.map((d) => d.date);
  const inWindow = adds.filter((b) => windowDates.includes(b.date)).reduce((s, b) => s + b.change, 0);

  const parts: string[] = [];
  if (added > 0 && windowDays.length) {
    const first = windowDays[0].label;
    const last = windowDays[windowDays.length - 1].label;
    parts.push(`${fmtPct(inWindow / added, 0)} of the ${added} people the plan adds go to the holiday window, ${first} to ${last}.`);
  } else {
    parts.push(`The plan adds people to ${plural(adds.length, "block")} and trims ${cuts.length}: ${signedInt(net)} against the draft.`);
  }
  if (below > 0) parts.push(`${plural(below, "block")} ${below === 1 ? "stays" : "stay"} below the ${fmtPct(goal, 0)} goal even at capacity.`);
  else parts.push(`Every open block reaches the ${fmtPct(goal, 0)} goal.`);
  return parts.join(" ");
}
