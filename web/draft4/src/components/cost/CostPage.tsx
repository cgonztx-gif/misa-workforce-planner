import { chanceText, goalText, hoursExact, int, pctChange, pts, signedUsd, usd, usdCompact } from "../../lib/format";
import type { CompareResponse, DiagnosisResponse, PlanResponse, ScenarioCode, TradeoffResponse, WarehouseKey } from "../../lib/types";
import { Segmented, type SegItem } from "../Segmented";
import { ChartSkeleton, ListSkeleton, TilesSkeleton } from "../Skeletons";
import { CARD, CardHead, ScopeChip, StatTile } from "../StatTile";
import { AllowanceCard, DeptRows, GoalSteps, HistoryCard, ScenarioRows, SourceRows } from "./CostParts";

/**
 * Cost and service (T-99, DRAFT4.md section 15). The one question: what does the service gain cost, and where did we
 * stop? Hero: the tiles and the cost of each extra point of service by goal step; the slot: each scenario's draft →
 * plan and each department's cost; below: the callout allowance scored three ways and the history of misplaced hours.
 * Always the submitted plan (the what-if lives on the Overview).
 */
export function CostPage({ plan, compare, tradeoff, diagnosis, scenario, scenarioName, wk, wkSeg, dim, onWk, onScenario }: {
  plan?: PlanResponse;
  compare?: CompareResponse;
  tradeoff?: TradeoffResponse;
  diagnosis?: DiagnosisResponse;
  scenario: ScenarioCode;
  scenarioName: string;
  wk: WarehouseKey;
  wkSeg: SegItem<WarehouseKey>[];
  dim: string;
  onWk: (w: WarehouseKey) => void;
  onScenario: (s: ScenarioCode) => void;
}) {
  const T = plan?.totals[wk];
  const goal = plan?.goal ?? 0.95;
  const points = tradeoff?.goals[scenario] ?? [];
  const selIdx = points.findIndex((p) => p.selected);
  const sel = points[selIdx];
  const next = points[selIdx + 1];
  const allWk = wk === "all";

  return (
    <div className="grid grid-cols-1 gap-4 compact:gap-3 md:grid-cols-2 min-[80rem]:grid-cols-12" data-page="cost">
      <section data-card="cost" aria-label="Cost and service" className={`${CARD} min-w-0 md:col-span-2 min-[80rem]:col-span-8`}>
        <div className={`transition-opacity duration-150 ${dim}`}>
          <div className="@container flex h-[52px] items-center gap-3 border-b border-line px-5 compact:h-11 max-sm:px-3">
            <Segmented label="Warehouse" value={wk} onChange={onWk} items={wkSeg} className="min-w-0" />
          </div>
          {T ? (
            <div className="grid grid-cols-2 border-b border-line sm:grid-cols-4" data-strip="cost">
              <StatTile
                id="cost"
                label="Labor cost"
                value={usdCompact(T.plan.cost)}
                delta={pctChange(T.change.cost ?? 0, T.draft.cost)}
                tone={(T.change.cost ?? 0) > 0 ? "bad" : (T.change.cost ?? 0) < 0 ? "good" : "grey"}
                sub={`Draft ${usdCompact(T.draft.cost)}`}
                tipTitle={usd(T.plan.cost)}
                tip={`Draft ${usd(T.draft.cost)} · ${signedUsd(T.change.cost ?? 0)}\nLower is better, so a rise shows red\nRegular staff first, then cross-trained, then overtime, at the case's rates`}
              />
              <StatTile
                id="service"
                label="Service"
                value={chanceText(T.plan.expected_met)}
                delta={pts(T.change.expected_met ?? 0)}
                tone={(T.change.expected_met ?? 0) > 0 ? "good" : (T.change.expected_met ?? 0) < 0 ? "bad" : "grey"}
                sub={`Draft ${chanceText(T.draft.expected_met)}`}
                tip={`Expected service · average chance an open block meets its wait target\nGoal ${goalText(goal)} per block`}
              />
              <StatTile
                id="perpoint"
                label="Cost per point"
                short="Per point"
                value={sel?.cost_per_point != null ? usdCompact(sel.cost_per_point) : "—"}
                sub={next?.cost_per_point != null ? `Next point ${usdCompact(next.cost_per_point)}${allWk ? "" : " · all"}` : ""}
                tipTitle={sel?.cost_per_point != null ? `${usd(sel.cost_per_point)} per point` : undefined}
                tip={
                  sel && points[selIdx - 1]
                    ? `Extra labor cost per point of expected service, from the ${goalText(points[selIdx - 1].goal)} goal to ${goalText(sel.goal)}${next?.cost_per_point != null ? `\nThe next step, to ${goalText(next.goal)}, costs ${usd(next.cost_per_point)} a point` : ""}\nAll warehouses · from /api/tradeoff (F-49)`
                    : undefined
                }
              />
              <StatTile
                id="overtime"
                label="Overtime"
                value={`${int(T.plan.overtime_hours)} h`}
                delta={pctChange(T.change.overtime_hours ?? 0, T.draft.overtime_hours)}
                sub={`Draft ${int(T.draft.overtime_hours)} h`}
                tip={`The last source the plan uses, after regular and cross-trained staff, because it costs the most\n${hoursExact(T.plan.hours)} in all · ${hoursExact(T.plan.flex_hours)} cross-trained`}
              />
            </div>
          ) : (
            <TilesSkeleton />
          )}
          <div className="px-5 pt-4 pb-5 max-sm:px-3">
            <CardHead
              title="What each point of service costs"
              sub={`${scenarioName} · each step up in the service goal`}
              right={!allWk ? <ScopeChip text="All warehouses" tip="The goal trade-off was run for all warehouses together" /> : undefined}
            />
            <div className="mt-3">{points.length ? <GoalSteps points={points} scenarioName={scenarioName} /> : <ChartSkeleton />}</div>
          </div>
        </div>
      </section>

      <section data-card="costslot" aria-label="Scenarios and departments" className={`${CARD} relative min-w-0 overflow-hidden md:col-span-2 min-[80rem]:col-span-4`}>
        <div className={`flex h-full flex-col gap-5 p-5 transition-opacity duration-150 max-sm:p-3 ${dim}`}>
          {compare && T ? (
            <>
              <ScenarioRows compare={compare} wk={wk} scenario={scenario} goal={goal} onScenario={onScenario} />
              <DeptRows T={T} />
              <div className="mt-auto">
                <SourceRows T={T} />
              </div>
            </>
          ) : (
            <ListSkeleton />
          )}
        </div>
      </section>

      <section data-card="allowance" aria-label="Callout allowance" className={`${CARD} min-w-0 p-5 md:col-span-1 min-[80rem]:col-span-7 max-sm:p-3`}>
        {tradeoff ? <AllowanceCard tradeoff={tradeoff} scenario={scenario} scenarioName={scenarioName} goal={goal} wk={wk} /> : <ChartSkeleton rows />}
      </section>
      <section data-card="history" aria-label="History" className={`${CARD} min-w-0 p-5 md:col-span-1 min-[80rem]:col-span-5 max-sm:p-3`}>
        {diagnosis ? <HistoryCard diagnosis={diagnosis} /> : <ChartSkeleton rows />}
      </section>
    </div>
  );
}
