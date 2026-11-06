import { useBase } from "../lib/base";
import { goalText } from "../lib/format";
import type { Lens } from "../lib/url";

type Sw = { label: string; cls: string; tip?: string };

// Literal class strings (Tailwind must see them whole). Each lens names what its colours measure (the heading), then
// its swatches. Swatches are 16 × 12 with a faint edge, so the pale tiers still read on the dark card.
// The red tiers follow the goal (a what-if can set 90%, 92.5%, 95% or 97.5%): the first runs from 90% to the goal, and
// disappears when the goal is 90%. The 80% and 90% steps stay put, as tierOf draws them.
const meetsFor = (g: string): Sw => ({ label: "Meets goal", cls: "ring-1 ring-inset ring-line-strong", tip: `A ${g} chance or more of meeting the wait target` });
function redFor(goal: number): Sw[] {
  const g = goalText(goal);
  return [
    ...(goal > 0.9 + 1e-9 ? [{ label: `90–${g}`, cls: "bg-tier-low", tip: `Below the ${g} goal even with all its own staff and overtime: chance 90% to ${g}` }] : []),
    { label: "80–90%", cls: "bg-tier-mid", tip: "Below goal: chance 80% to 90%" },
    { label: "Under 80%", cls: "bg-tier-far", tip: "Below goal, with a chance under 80% (bold number)" },
  ];
}
const CLOSED: Sw = { label: "Closed", cls: "border border-dashed border-line-strong", tip: "Department closed this block" };
// People / Labor cost: a below-goal cell keeps its change colour and gets a red outline.
const alertFor = (g: string): Sw => ({ label: "Below goal", cls: "ring-[1.5px] ring-inset ring-bad", tip: `Below the ${g} goal: red outline, underlined number` });
// Compare on: the dashed red underline under a draft figure the draft schedules but the block can't field.
const UNFILLED: Sw = {
  label: "Unfilled",
  cls: "border-b-[1.5px] border-dashed border-bad !rounded-none !h-[6px]",
  tip: "The draft schedules more people than this block can field (dashed red underline). The plan fields everyone, so its change can be negative.",
};
const peopleFor = (w: string): Sw[] => [
  { label: "Fewer", cls: "bg-tier-cut ring-1 ring-inset ring-ink/30", tip: `Fewer people than the ${w} (outlined)` },
  { label: "Same", cls: "ring-1 ring-inset ring-line-strong", tip: `Same as the ${w}` },
  { label: "+1–2", cls: "bg-tier-m1", tip: `1 to 2 more than the ${w}` },
  { label: "+3–5", cls: "bg-tier-m2", tip: "3 to 5 more" },
  { label: "+6", cls: "bg-tier-m3", tip: "6 or more" },
];
const costFor = (w: string): Sw[] => [
  { label: "Same", cls: "ring-1 ring-inset ring-line-strong", tip: `No more labor cost than the ${w}` },
  { label: "<$300", cls: "bg-tier-m1", tip: `Up to $300 more than the ${w}` },
  { label: "$300–800", cls: "bg-tier-m2", tip: "$300 to $800 more" },
  { label: "$800+", cls: "bg-tier-m3", tip: "$800 or more" },
];

const headFor = (g: string, w: string): Record<Lens, { label: string; tip: string }> => ({
  service: { label: "Chance", tip: `Colour: the chance of meeting the ${g} wait goal · number: people scheduled` },
  below: { label: "Below goal", tip: `Only the blocks below the ${g} goal are coloured · beside the number: people short of need` },
  people: { label: `People vs ${w}`, tip: `Colour and the figure beside the number: people added or cut against the ${w}` },
  cost: { label: `Cost vs ${w}`, tip: `Colour and the figure beside the number: labor cost added against the ${w}` },
});

/** What the board's colours measure, for the lens: a short title and, for People / Labor cost, the baseline. */
export function lensHead(lens: Lens, all: boolean, goal: number, word: string) {
  const head = headFor(goalText(goal), word)[lens];
  const title = lens === "service" ? (all ? "Lowest chance" : "Chance") : lens === "below" ? "Below goal" : lens === "people" ? "People" : "Labor cost";
  const sub = lens === "people" || lens === "cost" ? `vs ${word}` : lens === "below" ? "short of need" : null;
  const tip = lens === "service" && all ? `${head.tip} · in All, the lowest of the 3 warehouses; the number is their sum` : head.tip;
  return { title, sub, tip, label: head.label };
}

/**
 * The board's caption sits in its empty top-left corner, above the row labels, like a table caption: it names what
 * the colours measure without costing the toolbar any width (at 1366 the toolbar has no room for it).
 */
export function LensCaption({ lens, all, goal = 0.95 }: { lens: Lens; all: boolean; goal?: number }) {
  const B = useBase();
  const h = lensHead(lens, all, goal, B.word);
  return (
    <div className="flex h-full flex-col justify-end pb-1 leading-tight" data-legend-head data-tip={h.tip}>
      <span className="text-[12px] font-semibold text-ink-2">{h.title}</span>
      {h.sub && <span className="text-[11.5px] text-muted">{h.sub}</span>}
    </div>
  );
}

/** The heatmap legend in the board toolbar: swatches with 12 muted labels (the caption names the measure). Hidden on phones. */
export function Legend({ lens, all, unfilled = false, goal = 0.95 }: { lens: Lens; all: boolean; unfilled?: boolean; goal?: number }) {
  const B = useBase();
  const g = goalText(goal);
  const MEETS = meetsFor(g);
  const RED = redFor(goal);
  const ALERT = alertFor(g);
  const PEOPLE = peopleFor(B.word);
  const COST = costFor(B.word);
  const base =
    lens === "service"
      ? [MEETS, ...RED, CLOSED]
      : lens === "below"
        ? [...RED, CLOSED]
        : lens === "people"
          ? [...PEOPLE, ALERT, CLOSED]
          : [...COST, ALERT, CLOSED];
  // Unfilled marks the draft change, which only the Service lens shows (People shows it as its own figure).
  const items = unfilled && (lens === "service" || lens === "people") ? [...base, UNFILLED] : base;
  return (
    <div className="hidden min-w-0 items-center justify-end text-[12px] text-muted sm:flex">
      <span className="sr-only">{lensHead(lens, all, goal, B.word).label}</span>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 min-[84rem]:gap-x-2.5" aria-label="Legend">
        {items.map((s) => (
          <span key={s.label} data-tip={s.tip} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden className={`inline-block h-3 w-4 rounded-[4px] forced-colors:border forced-colors:border-[CanvasText] ${s.cls}`} />
            <span>{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
