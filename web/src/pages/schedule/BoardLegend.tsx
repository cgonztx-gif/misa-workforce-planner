import { AlertTriangle } from "lucide-react";
import { HATCH, UnfilledIcon } from "../../components/schedule/BoardCell";
import { legendStops, type ColorMode } from "../../components/schedule/boardScales";
import { fmtPct } from "../../lib/format";

const TITLES: Record<ColorMode, [string, string]> = {
  change: ["Fewer", "More people than the draft"],
  chance: ["Less likely", "More likely to meet target"],
  util: ["More slack", "Nearer the service cliff"],
};

/** The color key for the current mode, plus the markers: below the goal, closed, selected. */
export function BoardLegend({ mode, goal, unfilled = false }: { mode: ColorMode; goal: number; unfilled?: boolean }) {
  const stops = legendStops(mode);
  const [lo, hi] = TITLES[mode];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
      <div className="flex items-center gap-2.5">
        <span className="text-ink-subtle">{lo}</span>
        <div className="flex gap-[2px]" role="list" aria-label="Color key">
          {stops.map((s) => (
            <span
              key={s.label}
              role="listitem"
              title={s.label}
              aria-label={s.label}
              className="tnum inline-flex h-6 min-w-[36px] items-center justify-center rounded-[5px] px-1.5 text-sm font-semibold first:rounded-l-control last:rounded-r-control"
              style={{ background: s.fill, color: s.ink }}
            >
              {s.sample}
            </span>
          ))}
        </div>
        <span className="text-ink-subtle">{hi}</span>
      </div>
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-risk text-white" aria-hidden>
          <AlertTriangle className="size-[11px]" strokeWidth={2.75} />
        </span>
        Below {fmtPct(goal, 0)} goal
      </span>
      {unfilled && (
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-surface text-warning-ink ring-[1.5px] ring-warning" aria-hidden>
            <UnfilledIcon />
          </span>
          Draft over capacity
        </span>
      )}
      <span className="inline-flex items-center gap-2">
        <span className="h-5 w-8 rounded-[5px] border border-border" style={{ background: HATCH }} aria-hidden />
        Closed
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-5 w-8 rounded-[5px] bg-raised shadow-[0_0_0_2px_var(--wp-color-surface),0_0_0_4px_var(--wp-color-navy)]" aria-hidden />
        Selected
      </span>
    </div>
  );
}
