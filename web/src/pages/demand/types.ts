// Response shape of GET /api/forecast (server/API.md). Only the fields the Demand page reads.
import type { ScenarioCode } from "../../lib/types";

export interface ScenarioDemand {
  demand: number;
  multiplier: number;
  effect: number;
  reason: string | null;
  driver: string | null;
}

export interface ForecastDay {
  date: string;
  day: string;
  day_short: string;
  holiday: string | null;
  window: string;
  window_label: string | null;
  normal_day: number;
  holiday_factor: number;
  holiday_effect: number;
  model_forecast: number;
  valentine_uplift: number;
  valentine_effect: number;
  forecast: number;
  benchmark: number;
  vs_benchmark: number;
  driver: string | null;
  scenarios: Record<ScenarioCode, ScenarioDemand>;
}

export interface ForecastSeries {
  store_id: number | null;
  warehouse: string | null;
  dept_id: number;
  department: string;
  unit: string;
  days: ForecastDay[];
}

export interface ErrorRow {
  group: string | number;
  rows: number;
  model: number;
  benchmark: number;
  department?: string;
  model_all_weeks?: number;
  week?: number;
}

export interface DriverRow {
  driver: string;
  tested: string;
  found: string;
  use: string;
}

export interface ForecastResponse {
  series: ForecastSeries[];
  shift_note: string;
  holiday_factors: { dept_id: number; department: string; window: string; factor: number }[];
  valentine: {
    uplift: Record<string, number>;
    sensitivity: { true_uplift: number; our_plan_expected_met: number; replanned_expected_met: number; replanned_feb14_cost: number; our_plan_feb14_cost: number }[];
    assumption: string;
  };
  accuracy: { daily_model: number; daily_benchmark: number; block_model: number; block_benchmark: number; text: string; limit: string };
  backtest: {
    daily: ErrorRow[];
    block: ErrorRow[];
    by_week: ErrorRow[];
    by_day_group: ErrorRow[];
  };
  drivers_tested: DriverRow[];
  notes: { units: string; benchmark: string; steps: string };
}

export const DEPT_IDS = [38, 92, 95] as const;
export type DeptId = (typeof DEPT_IDS)[number];

/** The series for one warehouse key ("all" = the all-warehouse totals, store_id null) and department. */
export function findSeries(data: ForecastResponse | undefined, warehouse: string, dept: number): ForecastSeries | undefined {
  return data?.series.find((s) => s.dept_id === dept && (warehouse === "all" ? s.store_id == null : String(s.store_id) === warehouse));
}

/** Demand for a day under a scenario: BASE is `forecast`, others carry their own figure. */
export const scenarioDemand = (d: ForecastDay, scenario: ScenarioCode) => d.scenarios[scenario]?.demand ?? d.forecast;

/** Week totals within one department (units only add up inside a department). */
export function weekTotals(series: ForecastSeries, scenario: ScenarioCode) {
  let forecast = 0;
  let benchmark = 0;
  let base = 0;
  for (const d of series.days) {
    forecast += scenarioDemand(d, scenario);
    base += d.forecast;
    benchmark += d.benchmark;
  }
  return { forecast, base, benchmark, vsBenchmark: forecast / benchmark - 1 };
}

/** Days where the scenario changes demand (PEAK's surge). */
export const surgeDays = (series: ForecastSeries, scenario: ScenarioCode) =>
  series.days.filter((d) => Math.abs((d.scenarios[scenario]?.multiplier ?? 1) - 1) > 1e-9);

/** Demand figures print with one decimal: units are workload units, not people. */
export const fmtUnits = (n: number | null | undefined) =>
  n == null ? "–" : n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
