import type { DayChance } from "../lib/board";
import { chanceText, goalText } from "../lib/format";
import type { Meta } from "../lib/types";

/**
 * The selected block's row of the week in small multiples: its chance on each of the 7 days (0-100%, the goal as a
 * tick), so the detail beside the tall board carries data down to its actions instead of a blank band. The current
 * day sits in the selection fill; a click opens that day. It grows with the slot (between 48 and 140 px of bars).
 */
export function DayStrip({ days, meta, goal, label, onPick, roomy = true }: { days: DayChance[]; meta: Meta; goal: number; label: string; onPick: (id: string) => void; roomy?: boolean }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, v * 100))}%`;
  return (
    <div className={`mt-5 flex min-h-[112px] flex-1 flex-col compact:mt-3 compact:min-h-[96px] ${roomy ? "" : "compact:hidden"}`} data-strip="days">
      <div className="mb-1.5 flex items-center justify-between text-[12px] text-muted">
        <span className="font-medium text-ink-2">{label}</span>
        <span className="tnum">Goal {goalText(goal)}</span>
      </div>
      <div className="grid max-h-[180px] min-h-0 flex-1 grid-cols-7 gap-1">
        {days.map((d) => {
          const day = meta.days.find((x) => x.date === d.date);
          const text = d.open ? chanceText(d.chance, d.below, goal) : "—";
          const bar = d.below ? "bg-bad" : "bg-good";
          return (
            <button
              key={d.id}
              type="button"
              disabled={d.current}
              aria-current={d.current || undefined}
              aria-label={`${day?.weekday ?? day?.label ?? d.date}: ${d.open ? `${text} chance${d.below ? ", below goal" : ""}` : "closed"}`}
              data-tip={day ? [day.label, day.holiday, d.open ? `Chance ${text}` : "Closed"].filter(Boolean).join(" · ") : undefined}
              onClick={() => onPick(d.id)}
              className={`flex min-h-0 flex-col items-center rounded-[8px] px-0.5 pt-1 pb-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                d.current ? "bg-accent/[.06] ring-1 ring-inset ring-accent/20" : "hover:bg-soft/60"
              }`}
            >
              <span className="relative min-h-[40px] w-2 flex-1 overflow-hidden rounded-[3px] bg-line/70">
                {d.open ? (
                  <span className={`absolute inset-x-0 bottom-0 rounded-[3px] ${bar}`} style={{ height: d.chance == null ? 0 : `max(2px, ${pct(d.chance)})` }} />
                ) : (
                  <span className="absolute inset-0 rounded-[3px] border border-dashed border-line-strong bg-card" />
                )}
                <span aria-hidden className="absolute -inset-x-1 h-[2px] bg-ink/70" style={{ bottom: `calc(${pct(goal)} - 1px)` }} />
              </span>
              <span className={`mt-1 text-[11px] leading-[14px] ${d.current ? "font-medium text-ink" : "text-muted"}`}>{day?.label.slice(0, 3)}</span>
              <span className={`text-[11px] leading-[14px] tnum ${d.current ? "font-semibold text-ink" : d.below ? "text-ink" : "text-ink-2"}`}>{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
