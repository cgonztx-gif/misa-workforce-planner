// Shapes for /api/methods (server/API.md), plus the accuracy wording from /api/forecast.

export interface BacktestRow {
  group: string | number;
  department: string;
  rows: number;
  model: number;
  benchmark: number;
  model_all_weeks?: number;
}

export interface ServiceLimit {
  dept_id: number;
  department: string;
  store_id: number;
  warehouse: string;
  u95: number;
  u90: number;
  u50: number;
}

export interface CalibrationBin {
  bin: string;
  blocks: number;
  predicted: number;
  observed: number;
}

export interface MethodsAssumption {
  id: string;
  text: string;
  source: "ours" | "case" | string;
  detail?: string | null;
  basis?: string | null;
  status?: string | null;
}

export interface MethodsResponse {
  notice: string;
  engine: { step: string; text: string }[];
  forecast: {
    backtest_daily: BacktestRow[];
    backtest_block: BacktestRow[];
    backtest_by_week: (BacktestRow & { week: number })[];
    backtest_by_day_group: { group: string; rows: number; model: number; benchmark: number }[];
    forecast_sd: { dept_id: number; sd: number; department: string }[];
    level_weeks: number;
  };
  service: {
    limits: ServiceLimit[];
    brier: { model: number; base_rate: number };
    calibration: CalibrationBin[];
    curves: Record<string, unknown>;
  };
  plan: { service_goal: number; validator_problems: string[]; team_id: string };
  tests: { count: number; files: number; how: string };
  assumptions: MethodsAssumption[];
  documents: { name: string; path: string }[];
}

/** The part of /api/forecast this page uses: the benchmark claim, worded as F-44 allows. */
export interface ForecastAccuracy {
  accuracy?: { daily_model: number; daily_benchmark: number; block_model: number; block_benchmark: number; text: string; limit: string };
}
