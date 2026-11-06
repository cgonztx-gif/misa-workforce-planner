// Response shapes for the FastAPI layer (server/). A COPY of web/src/lib/types.ts (draft 4 imports
// nothing from web/src), plus the /api/compare and /api/playbook shapes draft 4 reads.

export type ScenarioCode = "BASE" | "PEAK" | "DISRUPT";
export const SCENARIOS: ScenarioCode[] = ["BASE", "PEAK", "DISRUPT"];

/** "all" or a store id as a string ("1", "2", "4"). The keys of PlanResponse.totals. */
export type WarehouseKey = "all" | "1" | "2" | "4";
export const WAREHOUSE_KEYS: WarehouseKey[] = ["all", "1", "2", "4"];

export interface Health {
  ready: boolean;
  seconds: number | null;
  error: string | null;
  /** Extra fields the server sends: what it's doing now ("Ready", a step name) and seconds so far. */
  status?: string;
  step?: string | null;
  elapsed?: number | null;
}

export interface Meta {
  product: string;
  notice: string;
  scenarios: { code: ScenarioCode; name: string; description: string }[];
  warehouses: { id: number | string; label: string; size: string }[];
  departments: { id: number; name: string; service_target: string | number | Record<string, unknown> }[];
  shifts: { code: string; name: string }[];
  days: {
    date: string;
    label: string;
    holiday: string | null;
    /** Fri Feb 13 to Mon Feb 16, the Presidents' Day window. */
    holiday_window?: boolean;
    short?: string;
    weekday?: string;
    day_type?: string;
  }[];
  defaults: { goal: number; callouts: number; demand: number; [key: string]: unknown };
  glossary: { term: string; definition: string }[];
  assumptions: { id: string; text: string; source: string }[];
  [key: string]: unknown;
}

/** Totals for a set of blocks (server/payloads.py: summary). */
export interface Summary {
  blocks: number;
  employees: number;
  fielded: number;
  hours: number;
  regular_hours: number;
  flex_hours: number;
  overtime_hours: number;
  cost: number;
  expected_met: number | null;
  lowest_chance: number | null;
  below_goal: number;
  over_capacity: number;
  unfilled: number;
  below_min_staff: number;
  avg_utilization: number | null;
}

/** plan minus draft (server/payloads.py: difference). */
export interface SummaryChange {
  employees: number | null;
  hours: number | null;
  overtime_hours: number | null;
  flex_hours: number | null;
  cost: number | null;
  expected_met: number | null;
  below_goal: number | null;
  over_capacity: number | null;
  unfilled: number | null;
}

export interface Comparison {
  plan: Summary;
  draft: Summary;
  change: SummaryChange;
}

export interface Alert {
  level: "info" | "warning" | "risk" | string;
  kind: string;
  date: string | null;
  count: number;
  page: string;
  text: string;
}

export interface GroupTotals extends Comparison {
  /** What-if only: the submitted headcounts scored under the what-if's conditions (no re-planning). */
  rescored?: Summary;
  verdict: string;
  by_day: (Comparison & { date: string; day: string; day_short: string; holiday: string | null })[];
  by_department: (Comparison & { dept_id: number; department: string })[];
  alerts: Alert[];
  /** Block keys, largest change first. */
  largest_changes: string[];
}

export interface Block {
  key: string;
  scenario: ScenarioCode;
  store_id: number;
  warehouse: string;
  dept_id: number;
  department: string;
  date: string;
  day: string;
  day_short: string;
  weekday: string;
  holiday: string | null;
  shift_code: string;
  shift: string;
  start: string | null;
  end: string | null;
  paid_hours: number;
  label: string;
  is_open: boolean;
  min_staff: number;
  plan: number;
  draft: number;
  change: number;
  action: string;
  sources: { regular: number; flex: number; overtime: number };
  draft_sources: { regular: number; flex: number; overtime: number; unfilled: number };
  cost: number;
  cost_draft: number;
  cost_change: number;
  hours: number;
  hours_draft: number;
  utilization: number | null;
  utilization_draft: number | null;
  chance: number | null;
  chance_draft: number | null;
  need: number | null;
  below_goal: boolean;
  below_goal_draft: boolean;
  at_capacity: boolean;
  cushion_people: number | null;
  cushion_demand: number | null;
  demand: number | null;
  demand_sd: number | null;
  demand_multiplier: number;
  adjustment_reason: string | null;
  callout_rate: number | null;
  callout_context: string | null;
  availability: { regular: number; overtime: number; cross_trained: number; usable_flex: number; capacity: number; note: string | null };
  explanation: {
    headline: string;
    why: string;
    demand_driver: string | null;
    staffing: string | null;
    cost_effect: string | null;
    service_effect: string | null;
    cushion: string | null;
    availability: string | null;
  };
  assumptions: { id: string; text: string }[];
}

export interface PlanResponse {
  scenario: ScenarioCode;
  goal: number;
  blocks: Block[];
  totals: Record<WarehouseKey, GroupTotals>;
}

export interface WhatIfParams {
  scenario: ScenarioCode;
  goal?: number;
  callouts?: number;
  demand?: number;
  availability?: number;
}

/** Loose JSON for endpoints whose shapes page builders will pin down from server/API.md. */
export type Json = Record<string, unknown>;

/** GET /api/compare: the three scenarios side by side, as submitted. */
export interface CompareScenario extends Comparison {
  code: ScenarioCode;
  name: string;
  description: string;
  verdict: string;
  by_department: (Comparison & { dept_id: number; department: string })[];
  by_warehouse: (Comparison & { store_id: number; warehouse: string; verdict: string })[];
}

export interface CompareResponse {
  goal: number;
  scenarios: CompareScenario[];
}

/** GET /api/playbook (server/API.md). */
export interface PtoRow {
  kept_per_block: number;
  people_kept: number;
  blocks_below_goal: number;
  below_goal_with_holiday_pto: number;
  expected_met: number;
  cost: number;
  overtime_hours: number;
}

export interface TightBlock {
  key: string;
  label: string;
  store_id: number;
  warehouse: string;
  plan: number;
  cushion_people: number | null;
  cushion_demand: number | null;
  cushion_text: string;
  chance: number | null;
}

export interface CapacityGap {
  scenario_code: ScenarioCode;
  day_date: string;
  dept_id: number;
  department: string;
  day: string;
  gap_people: number;
  gap_hours: number;
  blocks_short: number;
}

export interface PlaybookResponse {
  scenarios: Record<ScenarioCode, { trigger: string; actions: string[]; name: string; description: string }>;
  on_the_day: { trigger: string; action: string }[];
  pto: { intro: string; headline: string; assumption: string; rows: PtoRow[] };
  tightest: Record<ScenarioCode, Record<WarehouseKey, TightBlock[]>>;
  capacity_gaps: CapacityGap[];
}

/** GET /api/tradeoff: cost and service at each service goal, and the callout allowance scored three ways. */
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

/** GET /api/diagnosis: the six weeks of history. */
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

export interface ServiceBand {
  dept_id: number;
  department: string;
  band: number;
  blocks: number;
  met_target: number;
  median_ratio: number;
}

export interface DiagnosisResponse {
  service_bands: ServiceBand[];
  gap_value: GapValueRow[];
  kpi: { pct_met_all: number; over_hours: number; short_hours: number; over_value: number; worked_hours: number; [k: string]: number };
  notes: Record<string, string>;
}

/** GET /api/methods. */
export interface MethodsResponse {
  notice: string;
  engine: { step: string; text: string }[];
  forecast: { backtest_daily: ErrorRow[]; backtest_block: ErrorRow[] };
  service: {
    limits: { dept_id: number; store_id: number; u95: number; u90: number; u50: number; department: string; warehouse: string }[];
    brier: { model: number; base_rate: number };
    calibration: { bin: string; blocks: number; predicted: number; observed: number }[];
  };
  plan: { service_goal: number; validator_problems: string[]; team_id: string };
  tests: { count: number; files: number; how: string };
  assumptions: { id: string; text: string; source: "ours" | "case" | string; detail?: string; basis?: string; status?: string }[];
  documents: { name: string; path: string }[];
}

/** GET /api/forecast (server/API.md), the fields the Demand page reads. Demand units differ by department. */
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
}

export interface ForecastResponse {
  series: ForecastSeries[];
  shift_note: string;
  accuracy: { daily_model: number; daily_benchmark: number; block_model: number; block_benchmark: number; text: string; limit: string };
  backtest: { daily: ErrorRow[]; block: ErrorRow[]; by_day_group: ErrorRow[] };
  drivers_tested: { driver: string; tested: string; found: string; use: string }[];
  notes: { units: string; benchmark: string; steps: string };
}

/** GET /api/what-if (server/API.md): the plan's shape, re-planned under new conditions, plus how it differs from the submitted plan. */
export interface WhatIfSettings {
  goal: number;
  callouts: number;
  demand: number;
  availability: number;
}

export interface WhatIfResponse extends PlanResponse {
  what_if: true;
  is_submitted_plan: false;
  label: string;
  settings: WhatIfSettings & { scenario: ScenarioCode };
  defaults: WhatIfSettings;
  seconds: number;
  changes: { key: string; submitted: number; what_if: number; change: number }[];
  changes_summary: { blocks: number; people_added: number; people_cut: number; net: number };
  vs_submitted: Record<WarehouseKey, { submitted: Summary; what_if: Summary; change: SummaryChange; submitted_rescored: Summary }>;
}
