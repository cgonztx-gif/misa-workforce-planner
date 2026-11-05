import { FlaskConical } from "lucide-react";
import { useMeta } from "../../lib/api";
import { useView } from "../../lib/view";
import { SCENARIOS, type ScenarioCode, type WarehouseKey } from "../../lib/types";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Tooltip } from "../ui/Tooltip";
import { Wordmark } from "./Logo";

const FALLBACK_NOTICE = "All data is simulated for the Texas MISA case competition. It is not Costco data.";

/** Navy top bar: product name, the simulated-data badge, and the scenario and warehouse switches. */
export function TopBar() {
  const { scenario, warehouse, setScenario, setWarehouse } = useView();
  const meta = useMeta().data;

  const scenarioOptions = SCENARIOS.map((code) => {
    const s = meta?.scenarios.find((x) => x.code === code);
    return {
      value: code,
      label: code,
      description: s ? (
        <span>
          <span className="font-semibold">{s.name}.</span> {s.description}
        </span>
      ) : undefined,
    };
  });

  const warehouses = meta?.warehouses.filter((w) => String(w.id).toLowerCase() !== "all") ?? [
    { id: 1, label: "Warehouse 1", size: "Medium" },
    { id: 2, label: "Warehouse 2", size: "Large" },
    { id: 4, label: "Warehouse 4", size: "Large" },
  ];
  const ids = warehouses.map((w) => w.id).join(", ").replace(/, (?=[^,]*$)/, " and ");
  const warehouseOptions = [
    { value: "all" as WarehouseKey, label: "All", description: `All three warehouses together: ${ids}, the ones the case covers` },
    ...warehouses.map((w) => ({
      value: String(w.id) as WarehouseKey,
      // "WH2 Large", so the number reads as a warehouse ID rather than a count; the size is lighter.
      label: (
        <>
          <span>WH{w.id}</span>
          <span className="font-normal">{w.size}</span>
        </>
      ),
      ariaLabel: `${w.id} ${w.size}`,
      description: `${w.label}, a ${w.size.toLowerCase()} warehouse. The case covers warehouses ${ids}.`,
    })),
  ];

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-4 bg-navy pr-5 text-navy-ink">
      <div className="flex w-[236px] shrink-0 items-center pl-5">
        <Wordmark product={meta?.product ?? "Workforce Planner"} />
      </div>

      <Tooltip content={meta?.notice ?? FALLBACK_NOTICE} side="bottom" align="start" width={340}>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-full border border-navy-border bg-navy-raised px-3 text-sm font-medium text-navy-ink hover:border-navy-accent/60"
        >
          <FlaskConical className="size-4 text-navy-accent" aria-hidden />
          Simulated data
        </button>
      </Tooltip>
      <span className="tnum hidden text-sm whitespace-nowrap text-navy-ink-muted min-[1280px]:inline" title="Week of Thu Feb 12 to Wed Feb 18, 2026">
        Feb 12–18, 2026
      </span>

      <div className="ml-auto flex items-center gap-5">
        <div className="flex items-center gap-2.5">
          <span id="scenario-label" className="hidden text-sm text-navy-ink-muted lg:inline">
            Scenario
          </span>
          <SegmentedControl<ScenarioCode> label="Scenario" tone="navy" value={scenario} onChange={setScenario} options={scenarioOptions} />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="hidden text-sm text-navy-ink-muted lg:inline">Warehouse</span>
          <SegmentedControl<WarehouseKey> label="Warehouse" tone="navy" value={warehouse} onChange={setWarehouse} options={warehouseOptions} />
        </div>
      </div>
    </header>
  );
}
