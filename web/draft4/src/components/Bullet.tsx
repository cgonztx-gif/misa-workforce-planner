import { chanceText, goalText } from "../lib/format";

const FAR = 0.8;

/**
 * Few's bullet graph on 0–100%: grey ranges darker for poor (0–80, 80–95, 95–100), the chance as a bar a third
 * of the track's height (red below goal, green when it meets it), the goal as a 2 px ink line, the draft as a grey dot.
 * The ranges are light (ink 10 / 6 / 3) so the value bar is always the heaviest mark. Below goal, the missing part
 * from the chance to the goal is outlined in red, so a 0% block still reads as a long red gap, never as a grey bar.
 */
export function Bullet({ chance, below, goal, draft, label }: { chance: number | null; below: boolean; goal: number; draft?: number | null; label: string }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, v * 100))}%`;
  const c = chance ?? 0;
  return (
    <div className="relative">
      <div className="relative isolate h-6 overflow-hidden rounded-[5px]" role="img" aria-label={`${label}: ${chanceText(chance, below, goal)}, goal ${goalText(goal)}${draft != null ? `, draft ${chanceText(draft)}` : ""}`}>
        <span className="absolute inset-y-0 left-0 bg-ink/[.10]" style={{ width: pct(FAR) }} />
        <span className="absolute inset-y-0 bg-ink/[.06]" style={{ left: pct(FAR), width: `calc(${pct(goal)} - ${pct(FAR)})` }} />
        <span className="absolute inset-y-0 right-0 bg-ink/[.03]" style={{ left: pct(goal) }} />
        {chance != null && below && (
          <span
            data-mark="gap"
            className="absolute top-1/3 h-1/3 rounded-r-[2px] border-[1.5px] border-l-0 border-dashed border-bad bg-bad/[.14]"
            style={{ left: pct(c), width: `calc(${pct(goal)} - ${pct(c)})` }}
          />
        )}
        <span className={`absolute top-1/3 left-0 h-1/3 rounded-r-[2px] ${below ? "bg-bad" : "bg-good"}`} style={{ width: chance == null ? 0 : `max(${below ? 5 : 2}px, ${pct(c)})` }} />
        {draft != null && <span className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-series-grey ring-1 ring-card" style={{ left: `max(3px, ${pct(draft)})` }} />}
        <span className="absolute inset-y-1 w-[2px] -translate-x-1/2 bg-ink" style={{ left: pct(goal) }} />
      </div>
      <div className="relative mt-1 h-3.5 text-[11px] leading-none text-muted tnum">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(FAR) }}>
          {goalText(FAR)}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(goal) }}>
          {goalText(goal)}
        </span>
      </div>
    </div>
  );
}
