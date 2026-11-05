// Shapes for /api/what-if (server/API.md). The response is /api/plan's shape plus these fields.
import type { PlanResponse, ScenarioCode, Summary, SummaryChange, WarehouseKey } from "../../lib/types";

/** The four conditions a what-if can change. */
export interface Conditions {
  goal: number;
  callouts: number;
  demand: number;
  availability: number;
}

export type ConditionKey = keyof Conditions;

export interface RangeLimit {
  min: number;
  max: number;
  step: number;
  label: string;
  help: string;
}

/** meta.what_if_limits. `availability` is optional: the stretch goal, present when the API supports it. */
export interface WhatIfLimits {
  goal: { allowed: number[]; label: string; help: string };
  callouts: RangeLimit;
  demand: RangeLimit;
  availability?: RangeLimit;
}

/** One block whose headcount differs from the submitted plan. */
export interface WhatIfChange {
  key: string;
  label: string;
  store_id: number;
  warehouse: string;
  dept_id: number;
  department: string;
  date: string;
  day: string;
  shift_code: string;
  shift: string;
  submitted: number;
  what_if: number;
  change: number;
  chance_submitted: number | null;
  chance_what_if: number | null;
  cost_submitted: number;
  cost_what_if: number;
  cost_change: number;
  below_goal_what_if: boolean;
}

export interface VsSubmitted {
  /** The submitted plan as submitted (normal conditions). */
  submitted: Summary;
  /** The re-planned week under the changed conditions. */
  what_if: Summary;
  /** what_if minus submitted. */
  change: SummaryChange;
  /** The submitted headcounts kept as they are, scored under the changed conditions. */
  submitted_rescored: Summary;
}

export interface WhatIfResponse extends PlanResponse {
  what_if: boolean;
  is_submitted_plan: boolean;
  label: string;
  settings: Conditions & { scenario: ScenarioCode };
  defaults: Conditions;
  seconds: number;
  changes: WhatIfChange[];
  changes_summary: { blocks: number; people_added: number; people_cut: number; net: number };
  vs_submitted: Record<WarehouseKey, VsSubmitted>;
}
