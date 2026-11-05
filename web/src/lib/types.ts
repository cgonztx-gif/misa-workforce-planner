// Response shapes for the FastAPI layer (server/). The fixed contract is health and meta;
// plan follows server/payloads.py. Endpoints not typed in detail yet use loose types that
// page builders refine once server/API.md is written.

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
