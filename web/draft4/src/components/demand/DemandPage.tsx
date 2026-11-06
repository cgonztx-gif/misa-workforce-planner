import { useMemo } from "react";
import { DEPTS, findSeries, summarize } from "../../lib/demand";
import type { ForecastResponse, Meta, ScenarioCode, WarehouseKey } from "../../lib/types";
import type { DeptId } from "../../lib/url";
import { Segmented, type SegItem } from "../Segmented";
import { ChartSkeleton, ListSkeleton, TilesSkeleton } from "../Skeletons";
import { AccuracyCard, DemandTiles, DriversCard } from "./DemandCards";
import { DayBuild } from "./DayBuild";
import { ForecastChart } from "./ForecastChart";

const CARD = "rounded-[18px] border border-line bg-card shadow-[var(--shadow-card)]";

/**
 * Demand (DRAFT4.md, "Demand page"). The one question: when does demand rise this week, and what does the benchmark
 * miss? Layout follows the Overview: a hero card (warehouse and department controls, 4 tiles, the chart) with the
 * day's build in the slot beside it; the backtest and the drivers below the fold.
 */
export function DemandPage({ data, meta, scenario, scenarioName, wk, wkSeg, dept, day, dim, onWk, onDept, onDay }: {
  data?: ForecastResponse;
  meta?: Meta;
  scenario: ScenarioCode;
  scenarioName: string;
  wk: WarehouseKey;
  wkSeg: SegItem<WarehouseKey>[];
  dept: DeptId;
  day: string;
  dim: string;
  onWk: (w: WarehouseKey) => void;
  onDept: (d: DeptId) => void;
  onDay: (d: string) => void;
}) {
  const series = useMemo(() => findSeries(data, wk, dept), [data, wk, dept]);
  const sum = useMemo(() => (series ? summarize(series, scenario) : null), [series, scenario]);
  const err = data?.backtest.daily.find((r) => r.group === dept);
  const deptSeg: SegItem<string>[] = DEPTS.map((d) => ({
    value: String(d.id),
    title: d.name,
    tip: findSeries(data, wk, d.id)?.unit,
    label: (
      <>
        <span className="@max-[44rem]:hidden">{d.name}</span>
        <span className="hidden @max-[44rem]:inline">{d.short}</span>
      </>
    ),
  }));
  const loaded = !!(data && meta && series && sum);

  return (
    <div className="grid grid-cols-1 gap-4 compact:gap-3 md:grid-cols-2 min-[80rem]:grid-cols-12" data-page="demand">
      <section data-card="forecast" aria-label="Forecast" className={`${CARD} min-w-0 md:col-span-2 min-[80rem]:col-span-8`}>
        <div className={`transition-opacity duration-150 ${dim}`}>
          <div className="@container flex h-[52px] items-center gap-3 border-b border-line px-5 compact:h-11 max-sm:px-3">
            <Segmented label="Warehouse" value={wk} onChange={onWk} items={wkSeg} className="min-w-0" />
            <span className="flex-1" />
            <Segmented label="Department" value={String(dept)} onChange={(v) => onDept(Number(v) as DeptId)} items={deptSeg} className="min-w-0" />
          </div>
          {loaded ? <DemandTiles series={series!} sum={sum!} scenario={scenario} err={err} /> : <TilesSkeleton />}
          <div className="px-5 pt-4 pb-5 max-sm:px-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15.5px] font-semibold tracking-[-.01em]">Forecast vs benchmark</h2>
              <span className="truncate text-[12.5px] text-muted" data-tip={data?.notes.units}>
                {series?.unit ?? ""}
              </span>
            </div>
            <div className="mt-2">
              {loaded ? <ForecastChart series={series!} scenario={scenario} scenarioName={scenarioName} meta={meta!} day={day} onDay={onDay} /> : <ChartSkeleton />}
            </div>
          </div>
        </div>
      </section>

      <section data-card="daybuild" aria-label="Day build" className={`${CARD} relative min-w-0 overflow-hidden md:col-span-2 min-[80rem]:col-span-4`}>
        <div className={`h-full transition-opacity duration-150 ${dim}`}>
          {loaded ? (
            <DayBuild data={data!} series={series!} wk={wk} dept={dept} scenario={scenario} scenarioName={scenarioName} date={day} onDay={onDay} onDept={onDept} />
          ) : (
            <ListSkeleton />
          )}
        </div>
      </section>

      <section data-card="accuracy" aria-label="Forecast error" className={`${CARD} min-w-0 p-5 md:col-span-1 min-[80rem]:col-span-7 max-sm:p-3`}>
        {data ? <AccuracyCard data={data} dept={dept} /> : <ChartSkeleton rows />}
      </section>
      <section data-card="drivers" aria-label="Drivers tested" className={`${CARD} min-w-0 p-5 md:col-span-1 min-[80rem]:col-span-5 max-sm:p-3`}>
        {data ? <DriversCard data={data} /> : <ChartSkeleton rows />}
      </section>
    </div>
  );
}
