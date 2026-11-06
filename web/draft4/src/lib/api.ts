// Data fetching (DRAFT4.md 5.13). Every number comes from /api/plan, /api/meta, /api/compare or /api/playbook.
// Never /api/what-if. The numbers are frozen, so every query is staleTime: Infinity.

import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { CompareResponse, ForecastResponse, Health, Meta, PlanResponse, PlaybookResponse, ScenarioCode, WhatIfResponse, WhatIfSettings } from "./types";
import { whatIfUrl } from "./whatif";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
  /** The server answered 503: still preparing, or restarted mid-session. */
  get notReady() {
    return this.status === 503;
  }
  /** The fetch itself failed: nothing is listening. */
  get offline() {
    return this.status === 0;
  }
}

async function getJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError("Can't reach the planner", 0);
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

const retry = (count: number, error: unknown) => (error instanceof ApiError && error.notReady ? count < 60 : false);
const retryDelay = () => 1000;

/**
 * Polls every 500 ms until ready or failed; every 2 s while unreachable. Once ready it keeps a slow heartbeat
 * (every 10 s, and when the window regains focus), so a server stopped mid-demo shows Offline and the page note
 * instead of a green pill over numbers nothing can refresh.
 */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => getJson<Health>("/api/health"),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (q) => {
      if (q.state.error) return 2000;
      const h = q.state.data;
      if (h?.status === "error") return false;
      return h?.ready ? 10_000 : 500;
    },
  });
}

export function useMeta(enabled: boolean) {
  return useQuery({ queryKey: ["meta"], queryFn: () => getJson<Meta>("/api/meta"), enabled, retry, retryDelay });
}

const planQuery = (scenario: ScenarioCode) => ({
  queryKey: ["plan", scenario] as const,
  queryFn: () => getJson<PlanResponse>(`/api/plan?scenario=${scenario}`),
  retry,
  retryDelay,
});

export function usePlan(scenario: ScenarioCode, enabled: boolean) {
  return useQuery({ ...planQuery(scenario), enabled, placeholderData: keepPreviousData });
}

/**
 * A what-if plan (D-33). Only ever called with settings that differ from the submitted plan's; the previous result stays
 * on screen (dimmed) while a new one computes. The server caches the last 48, so going back to a setting is instant.
 */
export function useWhatIf(scenario: ScenarioCode, s: WhatIfSettings, enabled: boolean) {
  return useQuery({
    queryKey: ["whatif", scenario, s.goal, s.callouts, s.demand, s.availability] as const,
    queryFn: () => getJson<WhatIfResponse>(whatIfUrl(scenario, s)),
    enabled,
    retry,
    retryDelay,
    placeholderData: keepPreviousData,
  });
}

const forecastQuery = { queryKey: ["forecast"] as const, queryFn: () => getJson<ForecastResponse>("/api/forecast"), retry, retryDelay };

export function useForecast(enabled: boolean) {
  return useQuery({ ...forecastQuery, enabled });
}

const compareQuery = { queryKey: ["compare"] as const, queryFn: () => getJson<CompareResponse>("/api/compare"), retry, retryDelay };
const playbookQuery = { queryKey: ["playbook"] as const, queryFn: () => getJson<PlaybookResponse>("/api/playbook"), retry, retryDelay };

export function useCompare(enabled: boolean) {
  return useQuery({ ...compareQuery, enabled });
}

export function usePlaybook(enabled: boolean) {
  return useQuery({ ...playbookQuery, enabled });
}

/** After BASE lands, fetch the rest in the background, so a scenario switch in the demo is instant. */
export function usePrefetch(ready: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!ready) return;
    for (const s of ["PEAK", "DISRUPT", "BASE"] as ScenarioCode[]) void qc.prefetchQuery(planQuery(s));
    void qc.prefetchQuery(compareQuery);
    void qc.prefetchQuery(playbookQuery);
    void qc.prefetchQuery(forecastQuery);
  }, [ready, qc]);
}

/** A 503 mid-session means the server restarted: go back to polling health. */
export function backToPreparing(qc: QueryClient) {
  void qc.resetQueries({ queryKey: ["health"] });
}

export function isPlanCached(qc: QueryClient, scenario: ScenarioCode) {
  return !!qc.getQueryData(["plan", scenario]);
}
