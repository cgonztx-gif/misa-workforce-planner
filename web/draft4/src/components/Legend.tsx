import type { Lens } from "../lib/url";

type Sw = { label: string; cls: string; tip?: string };

// Literal class strings (Tailwind must see them whole). Each lens names what its colours measure (the heading), then
// its swatches. Swatches are 16 × 12 with a faint edge, so the pale tiers still read on the dark card.
const MEETS: Sw = { label: "Meets goal", cls: "ring-1 ring-inset ring-line-strong", tip: "A 95% chance or more of meeting the wait target" };
const RED: Sw[] = [
  { label: "90–95%", cls: "bg-tier-low", tip: "Below the 95% goal even with all its own staff and overtime: chance 90% to 95%" },
  { label: "80–90%", cls: "bg-tier-mid", tip: "Below goal: chance 80% to 90%" },
  { label: "Under 80%", cls: "bg-tier-far", tip: "Below goal, with a chance under 80% (bold number)" },
];
const CLOSED: Sw = { label: "Closed", cls: "border border-dashed border-line-strong", tip: "Department closed this block" };
// People / Labor cost: a below-goal cell keeps its change colour and gets a red outline.
const ALERT: Sw = { label: "Below goal", cls: "ring-[1.5px] ring-inset ring-bad", tip: "Below the 95% goal: red outline, underlined number" };
// Compare on: the dashed red underline under a draft figure the draft schedules but the block can't field.
const UNFILLED: Sw = {
  label: "Unfilled",
  cls: "border-b-[1.5px] border-dashed border-bad !rounded-none !h-[6px]",
  tip: "The draft schedules more people than this block can field (dashed red underline). The plan fields everyone, so its change can be negative.",
};
const PEOPLE: Sw[] = [
  { label: "Fewer", cls: "bg-tier-cut ring-1 ring-inset ring-ink/30", tip: "Fewer people than the draft (outlined)" },
  { label: "Same", cls: "ring-1 ring-inset ring-line-strong", tip: "Same as the draft" },
  { label: "+1–2", cls: "bg-tier-m1", tip: "1 to 2 more than the draft" },
  { label: "+3–5", cls: "bg-tier-m2", tip: "3 to 5 more" },
  { label: "+6", cls: "bg-tier-m3", tip: "6 or more" },
];
const COST: Sw[] = [
  { label: "Same", cls: "ring-1 ring-inset ring-line-strong", tip: "No more labor cost than the draft" },
  { label: "<$300", cls: "bg-tier-m1", tip: "Up to $300 more than the draft" },
  { label: "$300–800", cls: "bg-tier-m2", tip: "$300 to $800 more" },
  { label: "$800+", cls: "bg-tier-m3", tip: "$800 or more" },
];

const HEAD: Record<Lens, { label: string; tip: string }> = {
  service: { label: "Chance", tip: "Colour: the chance of meeting the 95% wait goal · number: people scheduled" },
  below: { label: "Below goal", tip: "Only the blocks below the 95% goal are coloured · beside the number: people short of need" },
  people: { label: "People vs draft", tip: "Colour and the figure beside the number: people added or cut against the draft" },
  cost: { label: "Cost vs draft", tip: "Colour and the figure beside the number: labor cost added against the draft" },
};

/** The heatmap legend in the board toolbar: a heading for the lens, then swatches with 12 muted labels. Hidden on phones. */
export function Legend({ lens, all, unfilled = false }: { lens: Lens; all: boolean; unfilled?: boolean }) {
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
  const head = HEAD[lens];
  const headLabel = lens === "service" && all ? "Lowest chance" : head.label;
  const headTip = lens === "service" && all ? `${head.tip} · in All, the lowest of the 3 warehouses; the number is their sum` : head.tip;
  return (
    <div className="hidden min-w-0 items-center justify-end gap-2.5 text-[12px] text-muted sm:flex">
      <span data-legend-head data-tip={headTip} className="shrink-0 font-medium whitespace-nowrap text-ink-2">
        {headLabel}
      </span>
      <span aria-hidden className="h-4 w-px shrink-0 bg-line-strong" />
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
