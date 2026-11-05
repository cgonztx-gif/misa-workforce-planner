// The view lives in the URL so a refresh (or a link) reopens the same thing:
//   #/schedule?scenario=PEAK&wh=2&block=PEAK|2|38|2026-02-14|MID
// The page is the hash path; scenario, warehouse and selected block are search params.
import { useCallback, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router";
import { SCENARIOS, WAREHOUSE_KEYS, type ScenarioCode, type WarehouseKey } from "./types";

export interface PageDef {
  path: string;
  label: string;
  group: "plan" | "respond" | "reference";
}

/** Navigation order. One file per page in src/pages/. */
export const PAGES: PageDef[] = [
  { path: "overview", label: "Overview", group: "plan" },
  { path: "schedule", label: "Schedule", group: "plan" },
  { path: "demand", label: "Demand", group: "plan" },
  { path: "cost-service", label: "Cost and service", group: "plan" },
  { path: "scenario-lab", label: "Scenario lab", group: "respond" },
  { path: "playbook", label: "Playbook", group: "respond" },
  { path: "methods", label: "Methods", group: "reference" },
];

const DEFAULT_SCENARIO: ScenarioCode = "BASE";
const DEFAULT_WAREHOUSE: WarehouseKey = "all";

export interface View {
  scenario: ScenarioCode;
  warehouse: WarehouseKey;
  /** Selected block key ("scenario|store|dept|date|shift") or null. */
  block: string | null;
  /** Current page path, e.g. "schedule". */
  page: string;
  setScenario: (s: ScenarioCode) => void;
  setWarehouse: (w: WarehouseKey) => void;
  setBlock: (key: string | null) => void;
  /** Search string to carry the view to another page: `to={`/demand${carry}`}`. Drops the block. */
  carry: string;
}

/** Read and change the shared view. Changing scenario or warehouse keeps the page and the block. */
export function useView(): View {
  const [params, setParams] = useSearchParams();
  const location = useLocation();

  const scenarioParam = (params.get("scenario") ?? "").toUpperCase() as ScenarioCode;
  const scenario = SCENARIOS.includes(scenarioParam) ? scenarioParam : DEFAULT_SCENARIO;
  const whParam = (params.get("wh") ?? "").toLowerCase() as WarehouseKey;
  const warehouse = WAREHOUSE_KEYS.includes(whParam) ? whParam : DEFAULT_WAREHOUSE;
  const block = params.get("block");
  const page = location.pathname.replace(/^\/+/, "").split("/")[0] || "overview";

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null) next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setScenario = useCallback(
    (s: ScenarioCode) => {
      // A selected block keeps its place (store|dept|date|shift) in the new scenario.
      const changes: Record<string, string | null> = { scenario: s };
      if (block) changes.block = [s, ...block.split("|").slice(1)].join("|");
      update(changes);
    },
    [block, update],
  );
  const setWarehouse = useCallback((w: WarehouseKey) => update({ wh: w }), [update]);
  const setBlock = useCallback((key: string | null) => update({ block: key }), [update]);

  const carry = useMemo(() => {
    const next = new URLSearchParams();
    next.set("scenario", scenario);
    next.set("wh", warehouse);
    return `?${next.toString()}`;
  }, [scenario, warehouse]);

  return { scenario, warehouse, block, page, setScenario, setWarehouse, setBlock, carry };
}

/** Parse a block key into its parts. */
export function parseBlockKey(key: string) {
  const [scenario, store, dept, date, shift] = key.split("|");
  return { scenario: scenario as ScenarioCode, store: Number(store), dept: Number(dept), date, shift };
}
