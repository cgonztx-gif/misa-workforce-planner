// All three scenarios side by side (from /api/compare). Clicking one switches the scenario.
import { Check } from "lucide-react";
import { Card, ErrorPanel, Skeleton } from "../../components";
import { useCompare } from "../../lib/api";
import { cn } from "../../lib/cn";
import { fmtMoney, fmtPct, plural, signedMoney } from "../../lib/format";
import type { Alert, ScenarioCode, Summary, SummaryChange, WarehouseKey } from "../../lib/types";

export interface CompareGroup {
  plan: Summary;
  draft: Summary;
  change: SummaryChange;
  verdict?: string;
}
export interface CompareScenario extends CompareGroup {
  code: ScenarioCode;
  name: string;
  description: string;
  vs_base: Record<string, number | null>;
  by_warehouse: (CompareGroup & { store_id: number; warehouse: string })[];
  alerts: Alert[];
}
export interface CompareResponse {
  goal: number;
  scenarios: CompareScenario[];
}

/** The figures for one scenario at the current warehouse filter. */
export function groupFor(s: CompareScenario, warehouse: WarehouseKey): CompareGroup | undefined {
  return warehouse === "all" ? s : s.by_warehouse.find((w) => String(w.store_id) === warehouse);
}

/**
 * Draft and plan expected service as a static dumbbell on a 0-100% axis with quarter ticks, and the
 * per-block goal as a labeled dotted line. A hairline axis rather than a rounded track, so it can't be
 * mistaken for a slider.
 */
function ServiceTrack({ draft, plan, goal, active }: { draft: number | null; plan: number | null; goal: number; active: boolean }) {
  const pct = (v: number | null) => Math.max(0, Math.min(1, v ?? 0)) * 100;
  const lo = Math.min(pct(draft), pct(plan));
  const hi = Math.max(pct(draft), pct(plan));
  return (
    <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2" aria-hidden>
      <span className="tnum text-sm leading-4 text-ink-subtle">0%</span>
      <div>
        <div className="relative h-4">
          <div className="absolute inset-x-0 top-1/2 h-px bg-border-strong" />
          {[0, 25, 50, 75, 100].map((t) => (
            <span key={t} className="absolute top-1/2 h-[5px] w-px bg-border-strong" style={{ left: `${t}%` }} />
          ))}
          <div className="absolute -top-0.5 h-[38px] w-0 border-l-2 border-dotted border-ink-subtle" style={{ left: `${pct(goal)}%` }} />
          <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-accent-line" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
          <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-draft ring-2 ring-surface" style={{ left: `${pct(draft)}%` }} />
          <span className={cn("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface", active ? "bg-plan" : "bg-plan/80")} style={{ left: `${pct(plan)}%` }} />
        </div>
        <div className="relative h-5">
          <span className="absolute top-1 -translate-x-full pr-1.5 text-sm leading-4 whitespace-nowrap text-ink-subtle" style={{ left: `${pct(goal)}%` }}>
            {fmtPct(goal, 0)} per-block goal
          </span>
        </div>
      </div>
      <span className="tnum text-sm leading-4 text-ink-subtle">100%</span>
    </div>
  );
}

export function ScenarioStrip({
  scenario,
  warehouse,
  warehouseName,
  onPick,
}: {
  scenario: ScenarioCode;
  warehouse: WarehouseKey;
  warehouseName: string;
  onPick: (s: ScenarioCode) => void;
}) {
  const q = useCompare<CompareResponse>();
  if (q.error) return <ErrorPanel error={q.error} what="the scenario comparison" onRetry={() => q.refetch()} />;
  const data = q.data;
  const goal = data?.goal ?? 0.95;

  return (
    <Card
      title="All three scenarios"
      description={`Expected service from draft (gray) to plan (iris), with the ${fmtPct(goal, 0)} per-block goal dotted, and cost and blocks below the goal, for ${warehouseName}. Click one to switch.`}
      padding="sm"
    >
      <div className="grid gap-3 lg:grid-cols-3" role="radiogroup" aria-label="Scenario">
        {(data?.scenarios ?? [null, null, null]).map((s, i) => {
          if (!s) return <Skeleton key={i} className="h-[132px] rounded-control" />;
          const g = groupFor(s, warehouse);
          const active = s.code === scenario;
          return (
            <button
              key={s.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick(s.code)}
              title={s.description}
              className={cn(
                "group relative min-w-0 rounded-control border px-4 pt-3 pb-3.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent",
                active ? "border-accent bg-accent-soft/50 shadow-[inset_0_0_0_1px_var(--wp-color-accent)]" : "border-border bg-surface hover:border-accent-line hover:bg-raised",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={cn("rounded-chip px-1.5 text-sm font-semibold tracking-wide", active ? "bg-accent text-on-accent" : "bg-raised text-ink-muted ring-1 ring-border")}>{s.code}</span>
                {active ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent-strong">
                    <Check className="size-4" aria-hidden /> Showing
                  </span>
                ) : (
                  <span className="text-sm font-medium text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Switch to {s.code}</span>
                )}
              </div>
              <div className="mt-1.5 text-base leading-snug font-semibold text-ink">{s.name}</div>
              {g ? (
                <>
                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <span className="text-sm text-ink-subtle">Expected service</span>
                    <span className="tnum text-sm text-ink-subtle">
                      {fmtPct(g.draft.expected_met)} <span aria-hidden>to</span>{" "}
                      <span className="font-display text-[20px] font-semibold text-ink">{fmtPct(g.plan.expected_met)}</span>
                    </span>
                  </div>
                  <ServiceTrack draft={g.draft.expected_met} plan={g.plan.expected_met} goal={goal} active={active} />
                  <div className="tnum mt-2 flex items-baseline justify-between gap-3 text-sm text-ink-muted">
                    <span>
                      <span className="font-semibold text-ink">{fmtMoney(g.plan.cost, true)}</span> {signedMoney(g.change.cost, true)} vs draft
                    </span>
                    <span className={cn(g.plan.below_goal > 0 && "text-risk-ink")}>{plural(g.plan.below_goal, "block")} below goal</span>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-ink-subtle">No figures for this warehouse.</p>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
