import { AlertTriangle } from "lucide-react";
import { HATCH, UnfilledIcon } from "../../components/schedule/BoardCell";
import { legendStops, type ColorMode } from "../../components/schedule/boardScales";

const TITLES: Record<ColorMode, [string, string]> = {
  change: ["Fewer", "More"],
  chance: ["Chance", ""],
  util: ["Utilization", ""],
};

/** The color key for the current mode, plus the markers: below the goal, over capacity, closed. One or two words each. */
export function BoardLegend({ mode, unfilled = false }: { mode: ColorMode; goal?: number; unfilled?: boolean }) {
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
              className="tnum inline-flex h-6 min-w-[34px] items-center justify-center rounded-[5px] px-1.5 text-sm font-medium ring-1 ring-black/[0.06] ring-inset"
              style={{ background: s.fill, color: s.ink }}
            >
              {s.sample}
            </span>
          ))}
        </div>
        {hi && <span className="text-ink-subtle">{hi}</span>}
      </div>
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-risk text-white" aria-hidden>
          <AlertTriangle className="size-[11px]" strokeWidth={2.75} />
        </span>
        Below goal
      </span>
      {unfilled && (
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-surface text-warning-ink ring-[1.5px] ring-warning" aria-hidden>
            <UnfilledIcon />
          </span>
          Over capacity
        </span>
      )}
      <span className="inline-flex items-center gap-2">
        <span className="h-5 w-8 rounded-[5px] border border-border" style={{ background: HATCH }} aria-hidden />
        Closed
      </span>
    </div>
  );
}
