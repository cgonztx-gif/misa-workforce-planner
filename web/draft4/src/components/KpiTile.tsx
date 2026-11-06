import { Delta } from "./Delta";
import { Spark } from "./Spark";

export type TileKind = "service" | "below" | "people" | "cost";

export interface TileData {
  kind: TileKind;
  /** Read aloud, context first: "Service 95.6%, up 27.1 points from draft 68.5%". */
  aria: string;
  label: string;
  value: string;
  raw: number | null;
  delta: string;
  tone: "good" | "bad" | "grey";
  sub: string;
  spark: number[];
  tipTitle: string;
  tip: string;
}

// The selected tile (DRAFT4.md 4, components.md "Selected"): the showcase image's pale green fill and faint green ring,
// whichever tile it is, as the user asked (App.tsx D10). The sparkline takes the metric's colour,
// as its board lens and By day do: Service green (good), Below goal red micro-bars (it counts problems), People and
// Labor cost ink (magnitudes, never green or red). Unselected tiles draw their sparkline in grey.
const SELECTED = "bg-good/[.07] ring-1 ring-inset ring-good/25";
const LINE: Record<TileKind, string> = {
  service: "var(--color-good)",
  people: "var(--color-ink)",
  cost: "var(--color-ink)",
  below: "var(--color-bad)",
};

/** components.md KPI strip: label + delta, big value, a numeric baseline, a sparkline. The explanation is the tooltip. */
export function KpiTile({ t, selected, onSelect }: { t: TileData; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={t.aria}
      data-tile={t.kind}
      data-value={t.raw ?? ""}
      data-tip-title={t.tipTitle}
      data-tip={t.tip}
      onClick={onSelect}
      className="group relative min-w-0 border-line p-2 text-left focus-visible:outline-none max-sm:border-b max-sm:[&:nth-child(odd)]:border-r sm:border-r sm:last:border-r-0"
    >
      <div
        className={`h-full rounded-xl px-4 py-3 transition-colors group-focus-visible:ring-2 group-focus-visible:ring-accent compact:py-2.5 max-sm:px-3 ${
          selected ? `${SELECTED} forced-colors:outline-2 forced-colors:outline-[Highlight]` : "group-hover:bg-soft/70"
        }`}
      >
        <div className={`flex h-5 items-center justify-between gap-2 text-[14px] ${selected ? "font-medium text-ink" : "text-ink-2"}`}>
          <span className="truncate">{t.label}</span>
          <Delta text={t.delta} tone={t.tone} />
        </div>
        <div
          className={`mt-0.5 text-[32px] leading-[1.15] font-semibold tracking-[-.03em] tnum compact:text-[28px] max-sm:text-[28px] ${selected ? "text-ink" : "text-ink-2"}`}
        >
          {t.value}
        </div>
        <div className="mt-0.5 h-[18px] truncate text-[12.5px] text-muted tnum">{t.sub}</div>
        <div className="compact:hidden max-sm:hidden">
          <Spark
            values={t.spark}
            bars={t.kind === "below"}
            color={selected ? LINE[t.kind] : "var(--color-series-grey)"}
            fill={selected ? LINE[t.kind] : "var(--color-soft)"}
            from={selected ? (t.kind === "people" || t.kind === "cost" ? 0.08 : 0.15) : 1}
            to={selected ? 0 : 1}
            quiet={!selected}
          />
        </div>
      </div>
    </button>
  );
}
