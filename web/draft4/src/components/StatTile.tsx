import type { ReactNode } from "react";
import { Delta } from "./Delta";

/**
 * A read-only KPI tile in the Overview's tile style (label + delta, big value, one-line baseline), for the pages
 * whose tiles don't drive a lens. Explanations live in the tooltip.
 */
export function StatTile({ label, short, value, delta, tone = "grey", sub, tip, tipTitle, valueCls = "", id }: {
  label: string;
  /** A shorter label below 90rem, so the delta never truncates it. */
  short?: string;
  value: ReactNode;
  delta?: string;
  tone?: "good" | "bad" | "grey";
  sub: ReactNode;
  tip?: string;
  tipTitle?: string;
  valueCls?: string;
  id?: string;
}) {
  return (
    <div
      className="min-w-0 border-line p-2 max-sm:border-b max-sm:[&:nth-child(odd)]:border-r sm:border-r sm:last:border-r-0"
      data-tile={id ?? label}
      data-tip={tip}
      data-tip-title={tipTitle}
    >
      <div className="h-full px-4 py-3 compact:py-2.5 max-sm:px-3">
        <div className="flex h-5 items-center justify-between gap-2 text-[14px] text-ink-2">
          {short ? (
            <span className="truncate">
              <span className="max-[89.99rem]:hidden">{label}</span>
              <span className="min-[90rem]:hidden">{short}</span>
            </span>
          ) : (
            <span className="truncate">{label}</span>
          )}
          {delta && <Delta text={delta} tone={tone} />}
        </div>
        <div className={`mt-0.5 truncate text-[32px] leading-[1.15] font-semibold tracking-[-.03em] tnum compact:text-[28px] max-sm:text-[28px] ${valueCls}`}>{value}</div>
        <div className="mt-0.5 h-[18px] truncate text-[12.5px] text-muted tnum">{sub}</div>
      </div>
    </div>
  );
}

/** A card's title row: 15.5 semibold title, an optional muted line under it, and a right-hand slot (legend, chip). */
export function CardHead({ title, sub, subTip, right, id }: { title: string; sub?: ReactNode; subTip?: string; right?: ReactNode; id?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[15.5px] font-semibold tracking-[-.01em]">
          {title}
        </h2>
        {sub && (
          <div className="mt-0.5 truncate text-[12.5px] text-muted" data-tip={subTip}>
            {sub}
          </div>
        )}
      </div>
      {right && <div className="flex shrink-0 items-center gap-3 pt-1 text-[12px] text-muted">{right}</div>}
    </div>
  );
}

/** One legend key: a swatch and a label. */
export function Key({ swatch, label, tip }: { swatch: string; label: ReactNode; tip?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" data-tip={tip}>
      <span aria-hidden className={`inline-block shrink-0 ${swatch}`} />
      {label}
    </span>
  );
}

/** A small "scope" chip for a card whose data covers less than the page's filters (e.g. "Base · all warehouses"). */
export function ScopeChip({ text, tip }: { text: string; tip?: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-ink/[.06] px-2.5 text-[12px] whitespace-nowrap text-ink-2" data-tip={tip} data-scope>
      {text}
    </span>
  );
}

export const CARD = "rounded-[18px] border border-line bg-card shadow-[var(--shadow-card)]";
