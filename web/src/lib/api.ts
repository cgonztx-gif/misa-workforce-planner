// Typed client for the FastAPI layer, with TanStack Query hooks.
// Every request goes to the same origin (/api/...): in dev Vite proxies it to 127.0.0.1:8501,
// in the build FastAPI serves both. Nothing ever leaves localhost.
import { QueryClient, useQuery, keepPreviousData, type UseQueryOptions } from "@tanstack/react-query";
import type { Health, Json, Meta, PlanResponse, ScenarioCode, WhatIfParams } from "./types";

export type ApiErrorKind = "offline" | "not_ready" | "http" | "bad_response";

/** An error the UI can explain. `kind` picks the message and the fix shown in ErrorPanel. */
export class ApiError extends Error {
  kind: ApiErrorKind;
  status: number | null;
  path: string;
  detail: string | null;
  constructor(kind: ApiErrorKind, path: string, message: string, status: number | null = null, detail: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.path = path;
    this.status = status;
    this.detail = detail;
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

export function apiUrl(path: string, params?: Params): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return `/api/${path.replace(/^\/+/, "")}${qs ? `?${qs}` : ""}`;
}

/** GET a JSON endpoint. Throws ApiError with a kind the UI can act on. */
export async function getJson<T>(path: string, params?: Params, signal?: AbortSignal): Promise<T> {
  const url = apiUrl(path, params);
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError("offline", url, "The planner's server isn't responding.");
  }
  const type = response.headers.get("content-type") ?? "";
  const isJson = type.includes("application/json");
  if (!response.ok) {
    // The dev proxy answers 500/502/504 with a non-JSON body when the server is down.
    if (!isJson && response.status >= 500) throw new ApiError("offline", url, "The planner's server isn't responding.", response.status);
    let detail: string | null = null;
    try {
      const body = isJson ? await response.json() : await response.text();
      const inner = typeof body === "string" ? body : ((body as Json)?.detail ?? body);
      detail = (typeof inner === "string" ? inner : JSON.stringify(inner)).slice(0, 400);
    } catch {
      /* keep detail null */
    }
    if (response.status === 503) throw new ApiError("not_ready", url, "The server is still preparing the scenarios.", 503, detail);
    throw new ApiError("http", url, `The server answered ${response.status} for ${url}.`, response.status, detail);
  }
  if (!isJson) throw new ApiError("bad_response", url, `Expected JSON from ${url}, got ${type || "nothing"}.`, response.status);
  return (await response.json()) as T;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // results are prepared once at server start
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (count, error) => error instanceof ApiError && error.kind === "not_ready" && count < 10,
      retryDelay: 1000,
    },
  },
});

type Opts<T> = Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, "queryKey" | "queryFn">;

/** Generic hook for any GET endpoint: useApi<MyShape>("tradeoff"). */
export function useApi<T = Json>(path: string, params?: Params, options?: Opts<T>) {
  return useQuery<T, Error, T, readonly unknown[]>({
    queryKey: ["api", path, params ?? {}],
    queryFn: ({ signal }) => getJson<T>(path, params, signal),
    ...options,
  });
}

/** Polls /api/health every second until the server is ready; keeps polling every 2s while it's unreachable. */
export function useHealth() {
  return useQuery<Health, Error>({
    queryKey: ["api", "health"],
    queryFn: ({ signal }) => getJson<Health>("health", undefined, signal),
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (query.state.error) return 2000;
      if (!data || !data.ready) return data?.error ? 5000 : 1000;
      return false;
    },
  });
}

export const useMeta = () => useApi<Meta>("meta");

/** Every block for one scenario, as submitted (default settings). Switching back is instant. */
export const usePlan = (scenario: ScenarioCode) =>
  useApi<PlanResponse>("plan", { scenario }, { placeholderData: keepPreviousData });

export const useCompare = <T = Json>() => useApi<T>("compare");
export const useForecast = <T = Json>(store: number | string, dept: number | string) =>
  useApi<T>("forecast", { store, dept }, { placeholderData: keepPreviousData });
export const useTradeoff = <T = Json>() => useApi<T>("tradeoff");
export const usePlaybook = <T = Json>() => useApi<T>("playbook");
export const useDiagnosis = <T = Json>() => useApi<T>("diagnosis");
export const useMethods = <T = Json>() => useApi<T>("methods");

/** A what-if run. Pass enabled=false until the user presses Run; results are cached by settings. */
export const useWhatIf = <T = PlanResponse & Json>(params: WhatIfParams, enabled: boolean) =>
  useApi<T>("what-if", { ...params }, { enabled, staleTime: Infinity, placeholderData: keepPreviousData });

/** The filled submission template, as a download link. */
export const submissionCsvUrl = apiUrl("submission.csv");
