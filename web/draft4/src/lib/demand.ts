// The Demand page's model. Every figure comes from /api/forecast; the browser only picks a series, sums a week within
// one department (units differ by department), divides two of its numbers and sorts. No forecasting happens here.

import type { DeptId } from "./url";
import type { ForecastDay, ForecastResponse, ForecastSeries, ScenarioCode, WarehouseKey } from "./types";

export const DEPTS: { id: DeptId; name: string; short: string }[] = [
  { id: 38, name: "Front End", short: "FE" },
  { id: 92, name: "Merchandising", short: "Merch" },
  { id: 95, name: "Pharmacy", short: "Pharm" },
];

/** A day where the benchmark sits this far under the forecast is flagged: it would staff too few. */
export const MISS = 0.02;

export function findSeries(data: ForecastResponse | undefined, wk: WarehouseKey, dept: number): ForecastSeries | undefined {
  return data?.series.find((s) => s.dept_id === dept && (wk === "all" ? s.store_id == null : String(s.store_id) === wk));
}

/** The scenario's demand for a day: BASE is the forecast, PEAK adds its surge, DISRUPT leaves demand alone. */
export const demandOf = (d: ForecastDay, s: ScenarioCode) => d.scenarios[s]?.demand ?? d.forecast;
/** Forecast vs benchmark under the scenario, as a share of the benchmark. */
export const gapOf = (d: ForecastDay, s: ScenarioCode) => demandOf(d, s) / d.benchmark - 1;
/** The scenario's own surge in units (0 for BASE and DISRUPT). */
export const surgeOf = (d: ForecastDay, s: ScenarioCode) => (s === "BASE" ? 0 : d.scenarios[s]?.effect ?? 0);

export interface DemandSummary {
  week: number;
  bench: number;
  peak: ForecastDay;
  miss: ForecastDay;
}

export function summarize(series: ForecastSeries, s: ScenarioCode): DemandSummary {
  let week = 0;
  let bench = 0;
  for (const d of series.days) {
    week += demandOf(d, s);
    bench += d.benchmark;
  }
  const peak = [...series.days].sort((a, b) => demandOf(b, s) - demandOf(a, s))[0];
  const miss = [...series.days].sort((a, b) => Math.abs(gapOf(b, s)) - Math.abs(gapOf(a, s)))[0];
  return { week, bench, peak, miss };
}

export interface BuildStep {
  key: string;
  label: string;
  detail?: string;
  /** Where the bar starts and ends on the shared scale. */
  from: number;
  to: number;
  kind: "base" | "step" | "total" | "bench";
  tip?: string;
}

const pctText = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.round(Math.abs(x) * 100)}%`;

/** The day's forecast as a waterfall: normal day, the holiday factor, Valentine's, the scenario surge, the total. */
export function buildSteps(d: ForecastDay, s: ScenarioCode, scenarioName: string): BuildStep[] {
  const out: BuildStep[] = [{ key: "normal", label: "Normal day", from: 0, to: d.normal_day, kind: "base", tip: "This weekday's level with no holiday, from the regression on weeks 1-6" }];
  let at = d.normal_day;
  if (Math.abs(d.holiday_factor - 1) > 1e-9) {
    out.push({ key: "holiday", label: d.window_label ?? "Holiday", detail: `×${d.holiday_factor.toFixed(2)}`, from: at, to: at + d.holiday_effect, kind: "step", tip: "The holiday factor, from the MLK weekend and MLK Day in the history" });
    at += d.holiday_effect;
  }
  if (Math.abs(d.valentine_uplift) > 1e-9) {
    out.push({ key: "valentine", label: "Valentine's Day", detail: pctText(d.valentine_uplift), from: at, to: at + d.valentine_effect, kind: "step", tip: "A stated judgment (A-06), tested for sensitivity" });
    at += d.valentine_effect;
  }
  const sc = d.scenarios[s];
  if (s !== "BASE" && sc && Math.abs(sc.multiplier - 1) > 1e-9) {
    out.push({ key: "surge", label: `${scenarioName} surge`, detail: pctText(sc.multiplier - 1), from: at, to: at + sc.effect, kind: "step", tip: sc.reason ?? undefined });
    at += sc.effect;
  }
  out.push({ key: "total", label: "Forecast", from: 0, to: demandOf(d, s), kind: "total" });
  out.push({ key: "bench", label: "Benchmark", from: 0, to: d.benchmark, kind: "bench", tip: "The case's naive forecast: the same weekday's average over weeks 3-6. It ignores holidays." });
  return out;
}
