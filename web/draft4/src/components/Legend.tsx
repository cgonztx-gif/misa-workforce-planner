import type { Lens } from "../lib/url";

type Sw = { label: string; cls: string; tip?: string };

// Literal class strings (Tailwind must see them whole).
const SERVICE: Sw[] = [
  { label: "99%+", cls: "bg-accent/6", tip: "Chance of meeting the wait target 99% or more" },
  { label: "97%+", cls: "bg-accent/11", tip: "97% to 99%" },
  { label: "95%+", cls: "bg-accent/18", tip: "At the 95% goal, under 97%" },
];
const WARM: Sw[] = [
  { label: "Below goal", cls: "bg-warn/38", tip: "Under the 95% goal even with all its own staff and overtime" },
  { label: "Under 80%", cls: "bg-warn/52", tip: "Below goal, with a chance under 80%" },
];
const CLOSED: Sw = { label: "Closed", cls: "border border-dashed border-line-strong", tip: "Department closed this block" };
// Compare on: the dashed warm underline under a draft figure the draft schedules but the block can't field.
const UNFILLED: Sw = {
  label: "Unfilled",
  cls: "border-b-[1.5px] border-dashed border-warn-mark !rounded-none !h-[6px]",
  tip: "The draft schedules more people than this block can field (dashed warm underline). The plan fields everyone, so its change can be negative.",
};
const PEOPLE: Sw[] = [
  { label: "Cut", cls: "bg-ink/10", tip: "Fewer people than the draft" },
  { label: "Same", cls: "ring-1 ring-inset ring-line", tip: "Same as the draft" },
  { label: "+1", cls: "bg-accent/10", tip: "1 to 2 more than the draft" },
  { label: "+3", cls: "bg-accent/17", tip: "3 to 5 more" },
  { label: "+6", cls: "bg-accent/24", tip: "6 or more" },
];
const COST: Sw[] = [
  { label: "Same", cls: "ring-1 ring-inset ring-line", tip: "No more labor cost than the draft" },
  { label: "+$1", cls: "bg-money/10", tip: "Up to $300 more than the draft" },
  { label: "+$300", cls: "bg-money/17", tip: "$300 to $800 more" },
  { label: "+$800", cls: "bg-money/24", tip: "$800 or more" },
];

/** The heatmap legend in the board toolbar: swatches 14 × 10, radius 4, labels 12 muted. Hidden on phones. */
export function Legend({ lens, all, unfilled = false }: { lens: Lens; all: boolean; unfilled?: boolean }) {
  const base =
    lens === "service" ? [...SERVICE, ...WARM, CLOSED] : lens === "below" ? [...WARM, CLOSED] : lens === "people" ? [...PEOPLE, ...WARM, CLOSED] : [...COST, ...WARM, CLOSED];
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
          <span className={s.label === "Below goal" ? "underline decoration-1 underline-offset-2" : s.label === "Under 80%" ? "font-semibold underline decoration-1 underline-offset-2" : ""}>
            {s.label}
          </span>
        </span>
      ))}
    </div>
  );
}
