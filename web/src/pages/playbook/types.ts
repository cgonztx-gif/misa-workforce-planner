// Shapes for /api/playbook (server/API.md). Everything here is for the submitted plan.
import type { ScenarioCode, WarehouseKey } from "../../lib/types";

export interface ScenarioPlay {
  trigger: string;
  actions: string[];
  name: string;
  description: string;
}

export interface DayRule {
  trigger: string;
  action: string;
}

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
  day: string;
  dept_id: number;
  department: string;
  gap_people: number;
  gap_hours: number;
  blocks_short: number;
}

export interface PlaybookResponse {
  scenarios: Record<ScenarioCode, ScenarioPlay>;
  on_the_day: DayRule[];
  pto: { intro: string; headline: string; assumption: string; rows: PtoRow[] };
  tightest: Record<ScenarioCode, Record<WarehouseKey, TightBlock[]>>;
  capacity_gaps: CapacityGap[];
}
