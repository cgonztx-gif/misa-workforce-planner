import { chanceText, goalText, int, intCompact, pctChange, pts, signedUsd, signedUsdCompact, usd, usdCompact } from "../../lib/format";
import { niceTicks } from "../../lib/ticks";
import type { AllowancePlan, CompareResponse, DiagnosisResponse, GoalPoint, GroupTotals, ScenarioCode, TradeoffResponse, WarehouseKey } from "../../lib/types";
import { CardHead, Key, ScopeChip } from "../StatTile";

const kUsd = (n: number) => usdCompact(n);

// ---- Main chart: what each extra point of service costs ------------------------------------------------------------

/**
 * Cost per point of expected service for each step up in the service goal (components.md main chart, as columns: five
 * ordered steps, one value each, a common zero). The submitted step is the solid ink column with a "Submitted" tag;
 * the steps it didn't take are pale, so "each point costs more than the last, and we stopped before it doubles"
 * reads at a glance. Under each step: the plan at that goal (cost · service), so the trade is on the screen too.
 */
export function GoalSteps({ points, scenarioName }: { points: GoalPoint[]; scenarioName: string }) {
  const steps = points
    .map((p, i) => ({ p, prev: points[i - 1] }))
    .filter((x): x is { p: GoalPoint; prev: GoalPoint } => x.p.cost_per_point != null && !!x.prev);
  const selIdx = steps.findIndex((s) => s.p.selected);
  const max = Math.max(...steps.map((s) => s.p.cost_per_point ?? 0));
  const ticks = niceTicks(max * 1.08, 4);
  const top = ticks[ticks.length - 1];
  const h = (v: number) => `${(v / top) * 100}%`;
  const base = points[0];

  return (
    <div data-chart="goalsteps">
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[12px] text-muted">
        <Key swatch="h-3 w-3 rounded-[3px] bg-ink/80" label="Submitted step" />
        <Key swatch="h-3 w-3 rounded-[3px] bg-ink/35" label="Steps to it" />
        <Key swatch="h-3 w-3 rounded-[3px] border-[1.5px] border-dashed border-series-grey bg-series-grey/10" label="Steps past it" />
      </div>
      <div className="mt-3 flex">
        <div className="relative w-12 shrink-0" aria-hidden>
          <div className="relative h-[260px] compact:h-[210px]">
            {ticks.map((t) => (
              <span key={t} className="absolute right-2 translate-y-1/2 text-[11.5px] text-muted tnum" style={{ bottom: h(t) }}>
                {t === 0 ? "$0" : `$${intCompact(t)}`}
              </span>
            ))}
          </div>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[260px] compact:h-[210px]" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className={`absolute inset-x-0 h-px ${t === 0 ? "bg-line-strong" : "bg-line"}`} style={{ bottom: h(t) }} />
            ))}
          </div>
          <div className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} role="list" aria-label={`${scenarioName}: cost per point of expected service at each step up in the goal`}>
            {steps.map((s, i) => {
              const cpp = s.p.cost_per_point ?? 0;
              const sel = i === selIdx;
              const past = selIdx >= 0 && i > selIdx;
              const bar = sel ? "bg-ink/80" : past ? "border-[1.5px] border-b-0 border-dashed border-series-grey bg-series-grey/10" : "bg-ink/35";
              return (
                <div
                  key={s.p.goal}
                  role="listitem"
                  data-step={s.p.goal}
                  data-selected={sel ? "1" : undefined}
                  data-tip-title={`${usd(cpp)} per point`}
                  data-tip={[
                    `${goalText(s.prev.goal)} → ${goalText(s.p.goal)} goal`,
                    `Cost ${usd(s.prev.cost)} → ${usd(s.p.cost)} · ${signedUsd(s.p.cost - s.prev.cost)}`,
                    `Service ${chanceText(s.prev.expected_met)} → ${chanceText(s.p.expected_met)}`,
                    `Below this goal ${int(s.p.below_goal)} blocks`,
                  ].join("\n")}
                  tabIndex={0}
                  className={`group flex flex-col rounded-[12px] pb-2 outline-none focus-visible:ring-2 focus-visible:ring-accent ${sel ? "bg-soft/70" : "hover:bg-soft/50"}`}
                >
                  <div className="relative h-[260px] compact:h-[210px]">
                    <span className={`absolute inset-x-0 text-center text-[13px] font-semibold tnum ${sel ? "text-ink" : "text-ink-2"}`} style={{ bottom: `calc(${h(cpp)} + 6px)` }}>
                      {kUsd(cpp)}
                      {sel && <span className="block text-[11px] font-medium text-muted">Submitted</span>}
                    </span>
                    <span className={`absolute inset-x-[22%] bottom-0 rounded-t-[6px] ${bar}`} style={{ height: h(cpp) }} />
                  </div>
                  <div className="mt-2 flex flex-col items-center leading-tight">
                    <span className={`text-[13px] tnum ${sel ? "font-semibold text-ink" : "text-ink-2"}`}>
                      {+(s.prev.goal * 100).toFixed(1)} → {goalText(s.p.goal)}
                    </span>
                    <span className="mt-1 text-[11.5px] text-muted tnum">
                      {kUsd(s.p.cost)} · {chanceText(s.p.expected_met)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {base && (
        <div className="mt-2 pl-12 text-[11.5px] text-muted tnum" data-tip="The cheapest goal the trade-off was run at">
          From {goalText(base.goal)}: {kUsd(base.cost)} · {chanceText(base.expected_met)}
        </div>
      )}
    </div>
  );
}

// ---- Slot: scenarios and departments -------------------------------------------------------------------------------

const SC_LABEL: Record<ScenarioCode, string> = { BASE: "Base", PEAK: "Peak", DISRUPT: "Disrupt" };

/** Draft → plan on one 0-100% service axis (a dumbbell): grey draft dot, ink plan dot, the goal tick. */
function Dumbbell({ from, to, goal }: { from: number; to: number; goal: number }) {
  const x = (v: number) => `${Math.max(0, Math.min(100, v * 100))}%`;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return (
    <div className="relative h-4" aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-line/70" />
      <span className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink/30" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
      <span className="absolute top-0 bottom-0 w-px bg-ink/45" style={{ left: x(goal) }} />
      <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-series-grey ring-2 ring-card" style={{ left: x(from) }} />
      <span className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card ${to >= goal - 0.0005 ? "bg-good" : "bg-ink"}`} style={{ left: x(to) }} />
    </div>
  );
}

export function ScenarioRows({ compare, wk, scenario, goal, onScenario }: { compare: CompareResponse; wk: WarehouseKey; scenario: ScenarioCode; goal: number; onScenario: (s: ScenarioCode) => void }) {
  return (
    <div data-list="scenarios">
      <div className="mb-1 flex items-center justify-between text-[12px] text-muted">
        <span className="font-medium text-ink-2">Scenarios</span>
        <span className="inline-flex items-center gap-3">
          <Key swatch="size-2.5 rounded-full bg-series-grey" label="Draft" />
          <Key swatch="size-2.5 rounded-full bg-ink" label="Plan" />
        </span>
      </div>
      {compare.scenarios.map((s) => {
        const src = wk === "all" ? s : (s.by_warehouse.find((w) => String(w.store_id) === wk) ?? s);
        const on = s.code === scenario;
        return (
          <button
            key={s.code}
            type="button"
            aria-pressed={on}
            data-scenario={s.code}
            onClick={() => onScenario(s.code)}
            data-tip-title={s.name}
            data-tip={`Service ${chanceText(src.draft.expected_met)} → ${chanceText(src.plan.expected_met)} · ${pts(src.change.expected_met ?? 0)}\nCost ${usd(src.draft.cost)} → ${usd(src.plan.cost)} · ${signedUsd(src.change.cost ?? 0)}\nBelow goal ${int(src.draft.below_goal)} → ${int(src.plan.below_goal)}`}
            className={`mb-1 block w-full rounded-[12px] px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              on ? "bg-accent/[.07] ring-1 ring-accent/25 ring-inset" : "hover:bg-soft/60"
            }`}
          >
            <div className="flex items-baseline gap-2 text-[13.5px]">
              <span className={`w-16 shrink-0 ${on ? "font-semibold text-ink" : "text-ink-2"}`}>{SC_LABEL[s.code]}</span>
              <span className="flex-1 text-[12.5px] text-muted tnum">
                {chanceText(src.draft.expected_met)} → <span className="font-semibold text-ink">{chanceText(src.plan.expected_met)}</span>
              </span>
              <span className="shrink-0 text-[12.5px] text-ink-2 tnum">{signedUsdCompact(src.change.cost ?? 0)}</span>
            </div>
            <div className="mt-2">
              <Dumbbell from={src.draft.expected_met ?? 0} to={src.plan.expected_met ?? 0} goal={goal} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Where the hours come from: regular, cross-trained, overtime (the case's order, cheapest first), plan against draft. */
export function SourceRows({ T }: { T: GroupTotals }) {
  const rows = [
    { label: "Regular", cls: "bg-ink/80", plan: T.plan.regular_hours, draft: T.draft.regular_hours },
    { label: "Cross-trained", cls: "bg-ink/55", plan: T.plan.flex_hours, draft: T.draft.flex_hours },
    { label: "Overtime", cls: "bg-ink/35", plan: T.plan.overtime_hours, draft: T.draft.overtime_hours },
  ];
  const max = Math.max(T.plan.hours, T.draft.hours) || 1;
  const bar = (key: "plan" | "draft") => (
    <div className="flex h-2.5 gap-[2px]" style={{ width: `${(100 * (key === "plan" ? T.plan.hours : T.draft.hours)) / max}%` }}>
      {rows.map((r) => (r[key] > 0 ? <span key={r.label} className={`h-full min-w-[3px] rounded-full ${key === "plan" ? r.cls : "bg-series-grey/70"}`} style={{ flex: r[key] }} /> : null))}
    </div>
  );
  return (
    <div data-list="sources">
      <div className="mb-2 flex items-center justify-between text-[12px] text-muted">
        <span className="font-medium text-ink-2">Hours by source</span>
        <span className="tnum" data-tip={`Plan ${int(T.plan.hours)} h · draft ${int(T.draft.hours)} h`}>
          {int(T.draft.hours)} → <span className="font-semibold text-ink">{int(T.plan.hours)} h</span>
        </span>
      </div>
      <div className="flex flex-col gap-1.5" data-tip={rows.map((r) => `${r.label} ${int(r.draft)} → ${int(r.plan)} h`).join("\n")}>
        <div className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-[11.5px] text-muted">Plan</span>
          <div className="min-w-0 flex-1">{bar("plan")}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-[11.5px] text-muted">Draft</span>
          <div className="min-w-0 flex-1">{bar("draft")}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted tnum">
        {rows.map((r) => (
          <Key key={r.label} swatch={`h-2 w-2.5 rounded-full ${r.cls}`} label={<>{r.label} <span className="text-ink-2">{int(r.plan)}</span></>} />
        ))}
      </div>
    </div>
  );
}

export function DeptRows({ T }: { T: GroupTotals }) {
  const total = T.plan.cost || 1;
  return (
    <div data-list="departments">
      <div className="mb-1 flex text-[12px] text-muted">
        <span className="flex-1 font-medium text-ink-2">Departments</span>
        <span className="w-16 text-right">Cost</span>
        <span className="w-14 text-right">vs draft</span>
        <span className="w-14 text-right">Service</span>
      </div>
      {T.by_department.map((d) => (
        <div
          key={d.dept_id}
          className="relative flex h-11 items-center px-1 pb-1.5 text-[13.5px]"
          data-dept={d.dept_id}
          data-tip-title={d.department}
          data-tip={`Cost ${usd(d.draft.cost)} → ${usd(d.plan.cost)} · ${signedUsd(d.change.cost ?? 0)}\nService ${chanceText(d.draft.expected_met)} → ${chanceText(d.plan.expected_met)}\nBelow goal ${int(d.plan.below_goal)} · ${(100 * d.plan.cost / total).toFixed(0)}% of the cost`}
        >
          <span aria-hidden className="absolute inset-x-1 bottom-[5px] h-[3px] overflow-hidden rounded-full bg-line/70">
            <span className="absolute inset-y-0 left-0 rounded-full bg-ink/45" style={{ width: `${(100 * d.plan.cost) / total}%` }} />
          </span>
          <span className="relative flex-1 truncate text-ink-2">{d.department}</span>
          <span className="relative w-16 text-right font-semibold tnum">{kUsd(d.plan.cost)}</span>
          <span className="relative w-14 text-right text-[12.5px] text-muted tnum">{pctChange(d.change.cost ?? 0, d.draft.cost)}</span>
          <span className="relative w-14 text-right tnum">{chanceText(d.plan.expected_met)}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Callout allowance --------------------------------------------------------------------------------------------

const metFor = (p: AllowancePlan, world: string) => (world === "both_risks" ? p.met_both_risks : world === "forecast_error_only" ? p.met_forecast_error_only : p.met_neither);
// Rows: what each plan allows for. Columns: what happens. Short names so the two never read alike.
const planName = (name: string) =>
  /both/i.test(name) ? "Both risks" : /forecast error only/i.test(name) ? "Forecast error" : /neither/i.test(name) ? "Neither risk" : /draft/i.test(name) ? "The draft" : name;
const WORLD_SHORT: Record<string, string> = { both_risks: "Callouts + error", forecast_error_only: "Error only", neither: "Neither" };

/**
 * Each plan scored in three worlds (A-03, F-51): rows are plans, columns are the conditions. A cell under the goal
 * takes the board's red tiers, so "only the submitted plan holds the goal when callouts happen" is the one red-free row
 * in the first column. The submitted plan's row is the selected (control-blue) row.
 */
export function AllowanceTable({ tradeoff, scenario, goal }: { tradeoff: TradeoffResponse; scenario: ScenarioCode; goal: number }) {
  const ca = tradeoff.callout_allowance;
  const plans = ca.plans.filter((p) => p.scenario_code === scenario);
  const tier = (v: number) => (v >= goal - 0.0005 ? "" : v >= 0.9 ? "bg-tier-low" : v >= 0.8 ? "bg-tier-mid" : "bg-tier-far font-semibold");
  return (
    <div data-table="allowance">
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,.9fr)_repeat(3,minmax(0,1fr))] items-end gap-1.5 px-2 text-[12px] text-muted">
        <span />
        <span />
        <span className="col-span-3 border-b border-line pb-1 text-center font-medium text-ink-2">What happens</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,.9fr)_repeat(3,minmax(0,1fr))] items-end gap-1.5 px-2 pt-1 pb-1.5 text-[12px] text-muted">
        <span className="font-medium text-ink-2">Plan allows for</span>
        <span className="text-right">Cost</span>
        {ca.worlds.map((w) => (
          <span key={w.id} className="text-center leading-tight" data-tip={`${w.label}: ${w.text ?? ""}`}>
            {WORLD_SHORT[w.id] ?? w.label}
          </span>
        ))}
      </div>
      {plans.map((p) => {
        const rec = /recommended/i.test(p.plan);
        return (
          <div
            key={p.plan}
            data-plan={p.plan}
            className={`grid h-12 grid-cols-[minmax(0,1.3fr)_minmax(0,.9fr)_repeat(3,minmax(0,1fr))] items-center gap-1.5 rounded-[10px] px-2 text-[13.5px] ${rec ? "bg-accent/[.07] ring-1 ring-accent/25 ring-inset" : ""}`}
          >
            <span className="min-w-0 leading-tight" data-tip={p.plan}>
              <span className={`block truncate ${rec ? "font-semibold text-ink" : "text-ink-2"}`}>{planName(p.plan)}</span>
              {rec && <span className="block text-[11px] text-muted">Submitted</span>}
            </span>
            <span className="text-right tnum text-ink-2" data-tip={`${usd(p.cost)} · ${int(p.hours)} h`}>
              {kUsd(p.cost)}
            </span>
            {ca.worlds.map((w) => {
              const v = metFor(p, w.id);
              return (
                <span key={w.id} className={`grid h-8 place-items-center rounded-[8px] tnum ${tier(v) || "ring-1 ring-inset ring-line"}`} data-tip={`${planName(p.plan)} · ${w.label}: expected service ${chanceText(v)}`}>
                  {chanceText(v)}
                </span>
              );
            })}
          </div>
        );
      })}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-[12px] text-muted">
        <Key swatch="h-3 w-4 rounded-[4px] ring-1 ring-inset ring-line-strong" label={`${goalText(goal)}+`} />
        <Key swatch="h-3 w-4 rounded-[4px] bg-tier-low" label={`90–${goalText(goal)}`} />
        <Key swatch="h-3 w-4 rounded-[4px] bg-tier-mid" label="80–90%" />
        <Key swatch="h-3 w-4 rounded-[4px] bg-tier-far" label="Under 80%" />
      </div>
    </div>
  );
}

export function AllowanceCard({ tradeoff, scenario, scenarioName, goal, wk }: { tradeoff: TradeoffResponse; scenario: ScenarioCode; scenarioName: string; goal: number; wk: WarehouseKey }) {
  return (
    <div className="flex h-full flex-col" data-card-body="allowance">
      <CardHead
        title="Callout allowance"
        sub={`${scenarioName} · expected service of each plan, three ways`}
        subTip={tradeoff.callout_allowance.note}
        right={wk !== "all" ? <ScopeChip text="All warehouses" tip="The allowance was scored for all warehouses together" /> : undefined}
      />
      <div className="mt-4">
        <AllowanceTable tradeoff={tradeoff} scenario={scenario} goal={goal} />
      </div>
    </div>
  );
}

// ---- History: hours in the wrong places --------------------------------------------------------------------------

/**
 * Six weeks of past schedules against the hours an 85% utilization ceiling needs (F-39): a diverging bar per
 * department, short of need to the left in red (it costs service), above need to the right in grey (it costs money).
 */
export function HistoryCard({ diagnosis }: { diagnosis: DiagnosisResponse }) {
  const rows = diagnosis.gap_value;
  const k = diagnosis.kpi;
  const max = Math.max(...rows.flatMap((r) => [r.over_hours, r.short_hours])) * 1.05;
  const w = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="flex h-full flex-col" data-card-body="history">
      <CardHead title="History: hours in the wrong places" sub="Six past weeks · against the hours an 85% ceiling needs" subTip={diagnosis.notes.staffing_gaps} />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div data-tip="Hours scheduled below what the block needed, over six weeks">
          <div className="text-[12px] text-muted">Short</div>
          <div className="text-[22px] leading-tight font-semibold tracking-[-.02em] tnum">{int(k.short_hours)} h</div>
        </div>
        <div data-tip="Hours scheduled above what the block needed, over six weeks">
          <div className="text-[12px] text-muted">Above need</div>
          <div className="text-[22px] leading-tight font-semibold tracking-[-.02em] tnum">{int(k.over_hours)} h</div>
        </div>
        <div data-tip="The hours above need, at loaded regular rates">
          <div className="text-[12px] text-muted">Worth</div>
          <div className="text-[22px] leading-tight font-semibold tracking-[-.02em] tnum">{usdCompact(k.over_value)}</div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-[12px] text-muted">
        <Key swatch="h-3 w-3 rounded-[3px] bg-bad/80" label="Short of need" />
        <Key swatch="h-3 w-3 rounded-[3px] bg-series-grey" label="Above need" />
      </div>
      <div className="mt-2 flex flex-col gap-3" role="table" aria-label="Hours short of and above need, by department">
        {rows.map((r) => (
          <div key={r.dept_id} role="row" data-dept={r.dept_id}>
            <div className="mb-1 flex items-baseline justify-between text-[13px]">
              <span className="font-medium text-ink-2">{r.department}</span>
              <span className="text-[12px] text-muted tnum" data-tip="Blocks that missed their service target">
                {int(r.missed_blocks)} of {int(r.blocks)} missed
              </span>
            </div>
            <div className="grid grid-cols-2 items-center">
              <div className="flex items-center justify-end gap-2 border-r border-line-strong pr-[2px]" role="cell">
                <span className="text-[12px] text-ink-2 tnum">{int(r.short_hours)}</span>
                <span className="h-4 rounded-l-[4px] bg-bad/80" style={{ width: w(r.short_hours) }} data-tip={`${r.department}: ${int(r.short_hours)} h short of need`} />
              </div>
              <div className="flex items-center gap-2 pl-[2px]" role="cell">
                <span className="h-4 rounded-r-[4px] bg-series-grey" style={{ width: w(r.over_hours) }} data-tip={`${r.department}: ${int(r.over_hours)} h above need, worth ${usd(r.over_value)}`} />
                <span className="text-[12px] text-ink-2 tnum">{int(r.over_hours)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-3 text-[12px] text-muted tnum" data-tip="Share of historical blocks that met their service target">
        Met target {chanceText(k.pct_met_all)} of the time
      </div>
    </div>
  );
}

