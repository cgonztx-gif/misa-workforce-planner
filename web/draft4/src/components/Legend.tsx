import type { Lens } from "../lib/url";

type Sw = { label: string; cls: string; tip?: string };

// Literal class strings (Tailwind must see them whole).
const SERVICE: Sw[] = [{ label: "Meets goal", cls: "ring-1 ring-inset ring-line", tip: "A 95% chance or more of meeting the wait target" }];
const RED: Sw[] = [
  { label: "90–95%", cls: "bg-tier-low", tip: "Below the 95% goal even with all its own staff and overtime: chance 90% to 95%" },
  { label: "80–90%", cls: "bg-tier-mid", tip: "Below goal: chance 80% to 90%" },
  { label: "Under 80%", cls: "bg-tier-far", tip: "Below goal, with a chance under 80%" },
];
const CLOSED: Sw = { label: "Closed", cls: "border border-dashed border-line-strong", tip: "Department closed this block" };
// Compare on: the dashed red underline under a draft figure the draft schedules but the block can't field.
const UNFILLED: Sw = {
  label: "Unfilled",
  cls: "border-b-[1.5px] border-dashed border-bad !rounded-none !h-[6px]",
  tip: "The draft schedules more people than this block can field (dashed red underline). The plan fields everyone, so its change can be negative.",
};
const PEOPLE: Sw[] = [
  { label: "Cut", cls: "bg-tier-cut ring-1 ring-inset ring-ink/30", tip: "Fewer people than the draft (outlined)" },
  { label: "Same", cls: "ring-1 ring-inset ring-line", tip: "Same as the draft" },
  { label: "+1", cls: "bg-tier-m1", tip: "1 to 2 more than the draft" },
  { label: "+3", cls: "bg-tier-m2", tip: "3 to 5 more" },
  { label: "+6", cls: "bg-tier-m3", tip: "6 or more" },
];
const COST: Sw[] = [
  { label: "Same", cls: "ring-1 ring-inset ring-line", tip: "No more labor cost than the draft" },
  { label: "+$1", cls: "bg-tier-m1", tip: "Up to $300 more than the draft" },
  { label: "+$300", cls: "bg-tier-m2", tip: "$300 to $800 more" },
  { label: "+$800", cls: "bg-tier-m3", tip: "$800 or more" },
];

/** The heatmap legend in the board toolbar: swatches 14 × 10, radius 4, labels 12 muted. Hidden on phones. */
export function Legend({ lens, all, unfilled = false }: { lens: Lens; all: boolean; unfilled?: boolean }) {
  const base =
    lens === "service" ? [...SERVICE, ...RED, CLOSED] : lens === "below" ? [...RED, CLOSED] : lens === "people" ? [...PEOPLE, ...RED, CLOSED] : [...COST, ...RED, CLOSED];
  const items = unfilled ? [...base, UNFILLED] : base;
  return (
    <div
      className={`hidden min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[12px] text-muted sm:flex ${unfilled ? "min-[90rem]:gap-x-3" : "min-[84rem]:gap-x-3"}`}
      aria-label="Legend"
    >
      {all && lens === "service" && (
        <span data-tip="In All, a cell's colour is its lowest warehouse chance; its number is the sum of the 3 warehouses" className="-mr-1">
          lowest
        </span>
      )}
      {items.map((s) => (
        <span key={s.label} data-tip={s.tip} className={`inline-flex items-center whitespace-nowrap ${unfilled ? "gap-1 min-[90rem]:gap-1.5" : "gap-1.5"}`}>
          <span aria-hidden className={`inline-block h-[10px] w-[14px] rounded-[4px] forced-colors:border forced-colors:border-[CanvasText] ${s.cls}`} />
          <span className={s.label === "90–95%" || s.label === "80–90%" ? "underline decoration-1 underline-offset-2" : s.label === "Under 80%" ? "font-semibold underline decoration-1 underline-offset-2" : ""}>
            {s.label}
          </span>
        </span>
      ))}
    </div>
  );
}
