// All three scenarios side by side (from /api/compare). Clicking one switches the scenario.
import { TriangleAlert } from "lucide-react";
import { Card, ChartLegend, ErrorPanel, legendItems, Skeleton, Tooltip } from "../../components";
import { useCompare } from "../../lib/api";
import { cn } from "../../lib/cn";
import { fmtMoney, fmtPct, signedMoney } from "../../lib/format";
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
 * Draft and plan expected service as a static dumbbell on a 0-100% hairline axis, with the goal as a short
 * dotted tick labeled by its number only (draft 3: wordless). A hairline, not a rounded track, so it can't be
 * mistaken for a slider.
 */
function ServiceTrack({ draft, plan, goal, active }: { draft: number | null; plan: number | null; goal: number; active: boolean }) {
  const pct = (v: number | null) => Math.max(0, Math.min(1, v ?? 0)) * 100;
  const lo = Math.min(pct(draft), pct(plan));
  const hi = Math.max(pct(draft), pct(plan));
  return (
    <div className="relative mt-2 h-4" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-px bg-border-strong" />
      <div className="absolute -top-1 h-6 w-0 border-l-2 border-dotted border-ink-subtle" style={{ left: `${pct(goal)}%` }} />
      <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-accent-line" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
      <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-draft ring-2 ring-surface" style={{ left: `${pct(draft)}%` }} />
      <span className={cn("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface", active ? "bg-plan" : "bg-plan/80")} style={{ left: `${pct(plan)}%` }} />
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
      title="Expected service, every scenario"
      description={`Draft (gray) to plan (iris) on a 0 to 100% line, with the ${fmtPct(goal, 0)} per-block goal dotted, for ${warehouseName}. Click a scenario to switch to it.`}
      actions={
        <div className="flex items-center gap-4">
          <ChartLegend items={[legendItems.plan, legendItems.draft]} />
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-subtle">
            <span aria-hidden className="h-3.5 w-0 border-l-2 border-dotted border-ink-subtle" />
            {fmtPct(goal, 0)} goal
          </span>
        </div>
      }
      padding="sm"
    >
      <div className="grid gap-3 lg:grid-cols-3" role="radiogroup" aria-label="Scenario">
        {(data?.scenarios ?? [null, null, null]).map((s, i) => {
          if (!s) return <Skeleton key={i} className="h-[96px] rounded-control" />;
          const g = groupFor(s, warehouse);
          const active = s.code === scenario;
          return (
            <Tooltip key={s.code} content={<><span className="font-semibold">{s.name}.</span> {s.description}{g ? ` Labor cost ${fmtMoney(g.plan.cost, true)}, ${signedMoney(g.change.cost, true)} vs draft.` : ""}</>}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onPick(s.code)}
                className={cn(
                  "group relative min-w-0 rounded-xl px-4 pt-3 pb-3.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active ? "bg-accent-soft/60 ring-1 ring-accent/25" : "bg-surface ring-1 ring-border hover:bg-raised",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={cn("text-sm font-semibold tracking-wide", active ? "text-accent-strong" : "text-ink-muted")}>{s.code}</span>
                  {g && (
                    <span className={cn("tnum inline-flex items-center gap-1 text-sm", g.plan.below_goal > 0 ? "text-warning-ink" : "text-ink-subtle")}>
                      {g.plan.below_goal > 0 && <TriangleAlert className="size-3.5" aria-hidden />}
                      {g.plan.below_goal} below goal
                    </span>
                  )}
                </div>
                {g ? (
                  <>
                    <div className="tnum mt-1.5 flex items-baseline gap-2">
                      <span className="text-sm text-ink-subtle">{fmtPct(g.draft.expected_met)}</span>
                      <span className="text-sm text-ink-subtle" aria-label="to">→</span>
                      <span className="font-display text-[22px] font-semibold leading-none text-ink">{fmtPct(g.plan.expected_met)}</span>
                    </div>
                    <ServiceTrack draft={g.draft.expected_met} plan={g.plan.expected_met} goal={goal} active={active} />
                  </>
                ) : (
                  <p className="mt-3 text-sm text-ink-subtle">No figures</p>
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </Card>
  );
}
