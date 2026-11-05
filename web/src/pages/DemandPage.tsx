import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { Badge, ErrorPanel, HelpTip, PageHeader, Refreshing, SkeletonCard } from "../components";
import { useApi, useMeta, usePlan } from "../lib/api";
import { fmtDate, fmtPct, signedPct } from "../lib/format";
import { useCurrentPlan, useViewNames } from "../lib/hooks";
import { useView } from "../lib/view";
import { AccuracyCard } from "./demand/AccuracyCard";
import { DayWaterfall } from "./demand/DayWaterfall";
import { DriversTable } from "./demand/DriversTable";
import { ForecastByDay } from "./demand/ForecastByDay";
import { ShiftSplit } from "./demand/ShiftSplit";
import { ValentineCard } from "./demand/ValentineCard";
import { DEPT_IDS, findSeries, surgeDays, type ForecastResponse, type ForecastSeries } from "./demand/types";

const DEFAULT_DAY = "2026-02-14";
const listJoin = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const dayRange = (dates: string[]) =>
  dates.length === 0 ? "" : dates.length === 1 ? fmtDate(dates[0], false) : `${fmtDate(dates[0], false)} to ${fmtDate(dates[dates.length - 1], false).replace(/^\w+ /, "")}`;

/** Demand page (T-84): when demand rises or falls, and why. */
export default function DemandPage() {
  const forecast = useApi<ForecastResponse>("forecast");
  const meta = useMeta().data;
  const { scenario, warehouse, setScenario } = useView();
  const { scenarioName, warehouseName } = useViewNames();
  const { blocks, query: planQuery } = useCurrentPlan();
  const basePlan = usePlan("BASE").data;
  const [params, setParams] = useSearchParams();

  // Merge into the URL as it is now (not the last render's copy), so quick successive clicks all stick.
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(window.location.hash.split("?")[1] ?? params.toString());
    next.set(key, value);
    setParams(next, { replace: true });
  };
  const deptParam = Number(params.get("dept"));
  const dept = (DEPT_IDS as readonly number[]).includes(deptParam) ? deptParam : 38;
  const splitParam = Number(params.get("split"));
  const splitDept = (DEPT_IDS as readonly number[]).includes(splitParam) ? splitParam : 38;
  const dayParam = params.get("day") ?? "";
  const day = meta?.days.some((d) => d.date === dayParam) ? dayParam : DEFAULT_DAY;

  const data = forecast.data;
  const series = useMemo(() => DEPT_IDS.map((id) => findSeries(data, warehouse, id)).filter((s): s is ForecastSeries => !!s), [data, warehouse]);

  // The headline, computed from the series in view.
  const summary = useMemo(() => {
    if (!data || !series.length) return null;
    let best = { dept: "", day: "", gap: 0 };
    let normalGap = 0;
    for (const s of series)
      for (const d of s.days) {
        if (d.vs_benchmark > best.gap) best = { dept: s.department, day: d.day, gap: d.vs_benchmark };
        if (d.window === "normal") normalGap = Math.max(normalGap, Math.abs(d.vs_benchmark));
      }
    const wk = (id: number) => data.holiday_factors.find((h) => h.dept_id === id && h.window === "pre_holiday_weekend")?.factor ?? 1;
    const risers = series.filter((s) => wk(s.dept_id) > 1).map((s) => s.department);
    const fallers = series.filter((s) => wk(s.dept_id) < 1).map((s) => s.department);
    const surge = series.flatMap((s) => surgeDays(s, scenario));
    const surgeMax = Math.max(0, ...surge.map((d) => d.scenarios[scenario].multiplier - 1));
    const surgeDates = [...new Set(surge.map((d) => d.date))].sort();
    return { best, normalGap, risers, fallers, surgeMax, surgeDates };
  }, [data, series, scenario]);

  const valentineCapacity = useMemo(() => {
    if (!basePlan) return null;
    const feb14 = basePlan.blocks.filter((b) => b.date === DEFAULT_DAY && b.is_open && (b.dept_id === 38 || b.dept_id === 92));
    return { blocks: feb14.length, atCapacity: feb14.filter((b) => b.at_capacity).length };
  }, [basePlan]);

  const windowDates = (meta?.days ?? []).filter((d) => (d as { holiday_window?: boolean }).holiday_window).map((d) => d.date);
  const windowLabel = dayRange(windowDates) || "the holiday window";

  if (forecast.error) {
    return (
      <>
        <PageHeader title="Demand" />
        <ErrorPanel error={forecast.error} what="the forecast" onRetry={() => forecast.refetch()} />
      </>
    );
  }

  const answer = summary ? (
    <>
      {listJoin(summary.risers)} demand rises over the Presidents' Day weekend
      {summary.fallers.length ? ` while ${listJoin(summary.fallers)}'s falls` : ""}, and the benchmark misses it: on {summary.best.day}, our {summary.best.dept} forecast is{" "}
      {signedPct(summary.best.gap, 1).replace("+", "")} above it. On normal days the two agree within {fmtPct(summary.normalGap)}.
      {scenario === "PEAK" && summary.surgeMax > 0 && ` PEAK adds up to ${fmtPct(summary.surgeMax)} more on ${dayRange(summary.surgeDates)}.`}
      {scenario === "DISRUPT" && " DISRUPT doesn't change demand, only who can work."}
    </>
  ) : null;

  return (
    <>
      <PageHeader
        title="Demand"
        answer={answer}
        meta={
          <>
            <Badge tone="accent">{scenario}</Badge>
            <span>
              {scenarioName}, {warehouseName}
            </span>
          </>
        }
        actions={data && <HelpTip label="What's the benchmark?">{data.notes.benchmark} {data.notes.units}</HelpTip>}
      />

      {!data || !series.length ? (
        <div className="space-y-6">
          <SkeletonCard chart className="h-[620px]" />
          <SkeletonCard chart />
        </div>
      ) : (
        <Refreshing active={forecast.isPlaceholderData || planQuery.isPlaceholderData}>
          <div className="space-y-6">
            <ForecastByDay series={series} scenario={scenario} warehouseName={warehouseName} onShowPeak={scenario !== "PEAK" ? () => setScenario("PEAK") : undefined} />
            <DayWaterfall series={series} scenario={scenario} dept={dept} date={day} onDept={(d) => setParam("dept", String(d))} onDate={(d) => setParam("day", d)} warehouseName={warehouseName} />
            <div className="grid gap-6 min-[1280px]:grid-cols-2">
              <ShiftSplit
                blocks={blocks}
                departments={series.map((s) => ({ id: s.dept_id, name: s.department }))}
                dept={splitDept}
                onDept={(d) => setParam("split", String(d))}
                note={data.shift_note}
                scenario={scenario}
                warehouseName={warehouseName}
              />
              <ValentineCard valentine={data.valentine} capacity={valentineCapacity} />
            </div>
            <AccuracyCard data={data} normalDayGap={summary?.normalGap ?? 0} warehouseNote={warehouse === "all" ? null : "All warehouses"} />
            <DriversTable data={data} windowLabel={windowLabel} />
          </div>
        </Refreshing>
      )}
    </>
  );
}
