import { ChevronDown, LayoutGrid, Menu } from "lucide-react";
import type { Meta, ScenarioCode, WarehouseKey } from "../lib/types";
import { SimPill } from "./HeaderBar";
import { SCEN } from "./Sidebar";

export const wkShort = (wk: WarehouseKey) => (wk === "all" ? "All" : `W${wk}`);

/** Phones (< 40rem): mark, Overview, a Menu pill; under it a summary pill that also opens the menu. */
export function PhoneBar({ meta, scenario, wk, menuOpen, onMenu, title = "Overview" }: { meta?: Meta; scenario: ScenarioCode; wk: WarehouseKey; menuOpen: boolean; onMenu: () => void; title?: string }) {
  const label = SCEN.find((s) => s.code === scenario)?.label ?? "";
  return (
    <div className="sm:hidden">
      <div className="flex h-11 items-center gap-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-card text-ink-2 shadow-[var(--shadow-pill)]">
          <LayoutGrid size={14} strokeWidth={2} />
        </span>
        <h1 className="flex-1 truncate text-[18px] font-semibold tracking-[-.015em]">{title}</h1>
        <button type="button" onClick={onMenu} aria-haspopup="dialog" aria-expanded={menuOpen} data-menu-button className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-card px-3.5 text-[14px] text-ink">
          <Menu size={16} strokeWidth={1.75} />
          Menu
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={onMenu} aria-haspopup="dialog" aria-expanded={menuOpen} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[13px] text-ink" data-tip={meta?.scenarios.find((s) => s.code === scenario)?.name}>
          {label} · {wkShort(wk)}
          <ChevronDown size={14} strokeWidth={1.75} className="text-muted" />
        </button>
        <SimPill meta={meta} />
      </div>
    </div>
  );
}
