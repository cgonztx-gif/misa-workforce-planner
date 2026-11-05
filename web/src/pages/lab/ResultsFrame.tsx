import { FlaskConical, Loader2, Play } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../../components";
import { cn } from "../../lib/cn";
import { fmtMoney, fmtPct, plural } from "../../lib/format";
import type { Summary } from "../../lib/types";

/** Seconds since `running` turned on, ticking every 100 ms. */
function useElapsed(running: boolean) {
  const start = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) {
      start.current = null;
      return;
    }
    start.current = performance.now();
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((performance.now() - (start.current ?? 0)) / 1000), 100);
    return () => window.clearInterval(id);
  }, [running]);
  return elapsed;
}

/** The progress strip while a what-if runs: an indeterminate bar, what it's doing and a live timer. */
export function RunProgress({ running, scenario }: { running: boolean; scenario: string }) {
  const elapsed = useElapsed(running);
  if (!running) return null;
  return (
    <div role="status" aria-live="polite" className="mb-4 overflow-hidden rounded-card border border-accent-line bg-surface shadow-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <Loader2 className="size-5 shrink-0 animate-spin text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">Re-planning {scenario}</p>
          <p className="text-sm text-ink-subtle">Re-forecasting demand, searching every shift again and scoring service under the new conditions.</p>
        </div>
        <span className="font-display text-title font-semibold text-accent-strong tnum">{elapsed.toFixed(1)} s</span>
      </div>
      <div className="relative h-1 bg-accent-soft">
        <div className="wp-progress-bar absolute inset-y-0 left-0 w-2/5 rounded-full bg-accent" />
      </div>
    </div>
  );
}

/**
 * The dashed frame that holds what-if results, so they never look like the submitted plan.
 * The header carries the API's label, the conditions and the run time.
 */
export function WhatIfFrame({ label, conditions, seconds, children, dimmed }: { label: string; conditions: ReactNode; seconds: number | null; children: ReactNode; dimmed: boolean }) {
  return (
    <section aria-label="What-if results" className="mt-6 rounded-frame border-2 border-dashed border-accent-line bg-accent-soft/30 p-4 min-[1440px]:p-5">
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-chip bg-accent px-2.5 py-1 text-sm font-semibold text-on-accent">
          <FlaskConical className="size-4" aria-hidden />
          {label}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-2">{conditions}</div>
        {seconds != null && <span className="ml-auto text-sm text-ink-subtle tnum">Calculated in {seconds.toFixed(1)} s</span>}
      </header>
      <div className={cn("transition-opacity duration-150", dimmed && "pointer-events-none opacity-50")} aria-busy={dimmed || undefined}>
        {children}
      </div>
    </section>
  );
}

/** Before any run: what the lab does, the submitted plan it starts from, and a one-click demo. */
export function LabIntro({ scenario, where, plan, onDemo, demoLabel, running }: { scenario: string; where: string; plan: Summary | undefined; onDemo: () => void; demoLabel: string; running: boolean }) {
  return (
    <section className="mt-6 flex flex-col items-center rounded-frame border-2 border-dashed border-border-strong px-6 py-10 text-center">
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <FlaskConical className="size-6" aria-hidden />
      </span>
      <h2 className="text-title font-semibold text-ink">Set the conditions, then run a what-if</h2>
      <p className="mt-2 max-w-[62ch] text-body-lg text-ink-muted">
        The planner re-forecasts demand, searches every shift again and scores service under the new conditions, live. The submitted plan never changes, and Reset brings it back.
      </p>
      {plan && (
        <p className="mt-4 rounded-control bg-surface px-4 py-2 text-base text-ink-muted ring-1 ring-border tnum">
          Starting point: the submitted {scenario} plan for {where} costs <span className="font-semibold text-ink">{fmtMoney(plan.cost)}</span>, with{" "}
          <span className="font-semibold text-ink">{fmtPct(plan.expected_met)}</span> expected service and{" "}
          <span className="font-semibold text-ink">{plural(plan.below_goal, "block")}</span> below the goal.
        </p>
      )}
      <Button variant="primary" className="mt-6" icon={running ? <Loader2 className="animate-spin" /> : <Play />} onClick={onDemo} disabled={running}>
        {demoLabel}
      </Button>
    </section>
  );
}
