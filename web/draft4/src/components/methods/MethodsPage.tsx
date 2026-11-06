import { int, pct1, pts } from "../../lib/format";
import type { DiagnosisResponse, ForecastResponse, MethodsResponse } from "../../lib/types";
import { ChartSkeleton, ListSkeleton, TilesSkeleton } from "../Skeletons";
import { CARD, CardHead, StatTile } from "../StatTile";
import { Assumptions, Calibration, Checks, Cliff, Documents, EngineSteps, Limits } from "./MethodsParts";

/**
 * Methods (T-99, DRAFT4.md section 17). The one question: how does it work, and can we trust it? Hero: four trust
 * figures and the service cliff that the whole plan is built around; the slot: the engine's seven steps; below: the
 * calibration of its chances, the utilization each block can carry, the independent checks, the assumptions (ours
 * apart from the case's) and the documents. Methods doesn't change with the scenario or warehouse filters.
 */
export function MethodsPage({ methods, diagnosis, forecast }: { methods?: MethodsResponse; diagnosis?: DiagnosisResponse; forecast?: ForecastResponse }) {
  const all = methods?.forecast.backtest_daily.find((r) => r.group === "All");
  const problems = methods?.plan.validator_problems.length ?? 0;
  return (
    <div className="grid grid-cols-1 gap-4 compact:gap-3 md:grid-cols-2 min-[80rem]:grid-cols-12" data-page="methods">
      <section data-card="trust" aria-label="Can we trust it" className={`${CARD} min-w-0 md:col-span-2 min-[80rem]:col-span-8`}>
        {methods && all ? (
          <div className="grid grid-cols-2 border-b border-line sm:grid-cols-4" data-strip="methods">
            <StatTile
              id="forecast"
              label="Forecast error"
              short="Error"
              value={pct1(all.model)}
              delta={pts(all.model - all.benchmark)}
              tone={all.model < all.benchmark ? "good" : "bad"}
              sub={`Benchmark ${pct1(all.benchmark)}`}
              tip={`Mean daily error on held-out normal weeks, all departments (${int(all.rows)} days) · lower is better${forecast ? `\n${forecast.accuracy.limit}` : ""}`}
            />
            <StatTile
              id="brier"
              label="Brier score"
              value={methods.service.brier.model.toFixed(3)}
              sub={`Average rate ${methods.service.brier.base_rate.toFixed(3)}`}
              tip="How far the risk model's chances sit from what happened, on held-out weeks · lower is better · always guessing the average rate scores the second figure"
            />
            <StatTile
              id="submission"
              label="Submission check"
              short="Submission"
              value={problems === 0 ? "Passes" : int(problems)}
              valueCls={problems === 0 ? "" : "text-bad-strong"}
              sub={problems === 0 ? "567 rows · 0 problems" : "problems found"}
              tip={problems === 0 ? "The filled template passes the case's checks: every row, joined on keys, whole numbers, closed blocks at 0" : methods.plan.validator_problems.join("\n")}
            />
            <StatTile id="tests" label="Automated tests" short="Tests" value={int(methods.tests.count)} sub={`In ${int(methods.tests.files)} files`} tip={methods.tests.how} />
          </div>
        ) : (
          <TilesSkeleton />
        )}
        <div className="px-5 pt-4 pb-5 max-sm:px-3">
          <CardHead title="Service falls off a cliff" sub="Six past weeks · share of blocks that met their wait target, by how busy staff were" subTip={diagnosis?.notes.service_bands} />
          <div className="mt-3">{diagnosis ? <Cliff rows={diagnosis.service_bands} notes={diagnosis.notes.service_bands} /> : <ChartSkeleton />}</div>
        </div>
      </section>

      <section data-card="engine" aria-label="How the engine works" className={`${CARD} relative min-w-0 overflow-hidden p-5 md:col-span-2 min-[80rem]:col-span-4 max-sm:p-3`}>
        {methods ? <EngineSteps steps={methods.engine} /> : <ListSkeleton />}
      </section>

      <section data-card="calibration" aria-label="Calibration" className={`${CARD} min-w-0 p-5 md:col-span-1 min-[80rem]:col-span-6 max-sm:p-3`}>
        {methods ? <Calibration cal={methods.service.calibration} brier={methods.service.brier} /> : <ChartSkeleton />}
      </section>
      <section data-card="limits" aria-label="Utilization limits" className={`${CARD} min-w-0 p-5 md:col-span-1 min-[80rem]:col-span-6 max-sm:p-3`}>
        {methods ? <Limits limits={methods.service.limits} /> : <ChartSkeleton rows />}
      </section>

      <div className="flex min-w-0 flex-col gap-4 compact:gap-3 md:col-span-1 min-[80rem]:col-span-5">
        <section data-card="checks" aria-label="Independent checks" className={`${CARD} min-w-0 p-5 max-sm:p-3`}>
          <Checks />
        </section>
        <section data-card="documents" aria-label="Documents" className={`${CARD} min-w-0 flex-1 p-5 max-sm:p-3`}>
          {methods ? <Documents docs={methods.documents} notice={methods.notice} /> : null}
        </section>
      </div>
      <section data-card="assumptions" aria-label="Assumptions" className={`${CARD} min-w-0 p-5 md:col-span-1 min-[80rem]:col-span-7 max-sm:p-3`}>
        {methods ? <Assumptions items={methods.assumptions} /> : <ListSkeleton />}
      </section>
    </div>
  );
}
