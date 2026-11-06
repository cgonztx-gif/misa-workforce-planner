import { int } from "../lib/format";
import type { Block } from "../lib/types";

/**
 * The staffing against capacity as a segmented share bar (regular / cross-trained / overtime) on a track of
 * max(capacity, need, draft), with a need tick. "It's full, and need sits past it" in one glance.
 */
export function StaffBar({ b, compare }: { b: Block; compare: boolean }) {
  const cap = b.availability.capacity;
  const need = b.need ?? 0;
  const max = Math.max(cap, need, b.draft, b.plan, 1);
  const parts = [
    // Headcount by source is a magnitude, so ink (as the People lens), never green: a short block's bar must not say
    // "fine". Each step stays >= 3:1 on the card; the red need tick and dashed unfilled part carry the meaning.
    { label: "Regular", v: b.sources.regular, cls: "bg-ink/80" },
    { label: "Cross-trained", v: b.sources.flex, cls: "bg-ink/[.62]" },
    { label: "Overtime", v: b.sources.overtime, cls: "bg-ink/[.48]" },
  ].filter((p) => p.v > 0);
  const d = b.draft_sources;
  const dParts = [
    { label: "Regular", v: d.regular },
    { label: "Cross-trained", v: d.flex },
    { label: "Overtime", v: d.overtime },
  ];
  const pct = (v: number) => `${(v / max) * 100}%`;
  const needWarn = need > cap;

  return (
    <div>
      <div className="relative h-2.5">
        <div className="absolute inset-y-0 left-0 flex gap-[3px]" style={{ width: pct(b.plan) }} role="img" aria-label={parts.map((p) => `${p.label} ${p.v}`).join(", ")}>
          {parts.map((p) => (
            <span key={p.label} data-tip={`${p.label} ${int(p.v)}`} className={`h-2.5 min-w-1 rounded-full ${p.cls}`} style={{ flex: p.v }} />
          ))}
        </div>
        {cap > b.plan && <span className="absolute inset-y-0 rounded-full border border-dashed border-line-strong" style={{ left: `calc(${pct(b.plan)} + 3px)`, right: `calc(${100 - (cap / max) * 100}% )` }} data-tip={`Can field ${int(cap)}`} />}
        {need > 0 && (
          <span
            className={`absolute -top-1 -bottom-1 w-[2px] -translate-x-1/2 rounded-full ${needWarn ? "bg-bad" : "bg-ink/60"}`}
            style={{ left: `min(calc(100% - 1px), ${pct(need)})` }}
            data-tip={`Need ${int(need)} for a 95% chance`}
          />
        )}
      </div>
      <div className="relative mt-1.5 flex h-4 items-center justify-between gap-2 text-[11px] text-muted tnum">
        {/* The key: each part's swatch, so the three greys read without a hover. */}
        <span className="flex min-w-0 items-center gap-2.5 truncate">
          {parts.map((p) => (
            <span key={p.label} className="inline-flex items-center gap-1 whitespace-nowrap">
              <span aria-hidden className={`inline-block h-2 w-2.5 rounded-full ${p.cls}`} />
              {p.label} <span className="text-ink-2">{int(p.v)}</span>
            </span>
          ))}
        </span>
        {need > 0 && (
          <span className={`inline-flex shrink-0 items-center gap-1 ${needWarn ? "text-ink-2" : ""}`}>
            <span aria-hidden className={`inline-block h-2.5 w-[2px] rounded-full ${needWarn ? "bg-bad" : "bg-ink/60"}`} />
            need {int(need)}
          </span>
        )}
      </div>
      {compare && (
        <div className="mt-2.5" data-draft-staff>
          {/* The draft as a grey bar on the same track; what it can't field runs past capacity, dashed red. */}
          <div className="relative h-1.5" role="img" aria-label={`Draft ${int(b.draft)}: ${dParts.filter((p) => p.v > 0).map((p) => `${p.label} ${p.v}`).join(", ")}${d.unfilled > 0 ? `, ${d.unfilled} unfilled` : ""}`}>
            <span className="absolute inset-y-0 left-0 rounded-full bg-series-grey" style={{ width: pct(b.draft - d.unfilled) }} />
            {d.unfilled > 0 && (
              <span
                className="absolute inset-y-0 rounded-full border border-dashed border-bad bg-bad/12"
                style={{ left: `calc(${pct(b.draft - d.unfilled)} + 3px)`, width: `calc(${pct(d.unfilled)} - 3px)` }}
              />
            )}
          </div>
          <div className="mt-1.5 min-h-4 text-[11px] leading-4 text-muted tnum" data-tip={`Draft ${int(b.draft)}${d.unfilled > 0 ? ` · ${int(d.unfilled)} of them can't be fielded` : ""}`}>
            <span>
              Draft · {dParts.filter((p) => p.v > 0).map((p) => `${p.label} ${int(p.v)}`).join(" · ") || "0"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
