// Response shapes for GET /api/tradeoff and GET /api/diagnosis (server/API.md), as the Cost and service page reads them.
import type { ScenarioCode } from "../../lib/types";

export interface GoalPoint {
  goal: number;
  scenario_code: ScenarioCode;
  hours: number;
  cost: number;
  expected_met: number;
  lowest_chance: number;
  below_goal: number;
  overtime_hours: number;
  flex_hours: number;
  avg_utilization: number;
  selected: boolean;
  /** Extra cost per point of expected service against the previous goal; null for the first. */
  cost_per_point: number | null;
}

export interface AllowancePlan {
  plan: string;
  scenario_code: ScenarioCode;
  cost: number;
  hours: number;
  met_both_risks: number;
  met_forecast_error_only: number;
  met_neither: number;
}

export interface TradeoffResponse {
  goal: number;
  goals: Record<ScenarioCode, GoalPoint[]>;
  callout_allowance: {
    plans: AllowancePlan[];
    worlds: { id: "both_risks" | "forecast_error_only" | "neither"; label: string; text?: string }[];
    note: string;
  };
}

export interface GapValueRow {
  dept_id: number;
  department: string;
  blocks: number;
  worked_hours: number;
  required_hours: number;
  over_hours: number;
  short_hours: number;
  over_value: number;
  missed_blocks: number;
  labor_cost: number;
}

export interface DiagnosisResponse {
  gap_value: GapValueRow[];
  kpi: { pct_met_all: number; over_hours: number; short_hours: number; over_value: number; worked_hours: number; [k: string]: number };
  notes: Record<string, string>;
}

export const metFor = (p: AllowancePlan, world: string) =>
  world === "both_risks" ? p.met_both_risks : world === "forecast_error_only" ? p.met_forecast_error_only : p.met_neither;
