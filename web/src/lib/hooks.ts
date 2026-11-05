import { useMemo } from "react";
import { useMeta, usePlan } from "./api";
import { useView } from "./view";
import type { Block, GroupTotals } from "./types";

/**
 * The submitted plan for the current scenario and warehouse.
 *   const { totals, blocks, blockByKey, query } = useCurrentPlan();
 * `totals` is that warehouse's (or all warehouses') figures; `blocks` are filtered to the warehouse.
 * `query.isPlaceholderData` is true for a moment after a scenario switch (wrap content in <Refreshing>).
 */
export function useCurrentPlan() {
  const { scenario, warehouse } = useView();
  const query = usePlan(scenario);
  const data = query.data;
  const totals: GroupTotals | undefined = data?.totals[warehouse];
  const blocks: Block[] = useMemo(
    () => (data ? (warehouse === "all" ? data.blocks : data.blocks.filter((b) => String(b.store_id) === warehouse)) : []),
    [data, warehouse],
  );
  const blockByKey = useMemo(() => new Map((data?.blocks ?? []).map((b) => [b.key, b])), [data]);
  return { scenario, warehouse, query, data, totals, blocks, blockByKey };
}

/** Human names for the current view: "BASE, all warehouses" / "PEAK, Warehouse 2". */
export function useViewNames() {
  const { scenario, warehouse } = useView();
  const meta = useMeta().data;
  const scenarioInfo = meta?.scenarios.find((s) => s.code === scenario);
  const wh = meta?.warehouses.find((w) => String(w.id) === warehouse);
  const warehouseName = warehouse === "all" ? "all warehouses" : (wh?.label ?? `Warehouse ${warehouse}`);
  return { scenario, scenarioName: scenarioInfo?.name ?? scenario, scenarioDescription: scenarioInfo?.description, warehouse, warehouseName };
}
