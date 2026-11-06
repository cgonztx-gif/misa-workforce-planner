import * as Dialog from "@radix-ui/react-dialog";
import { Download, LayoutGrid, Warehouse, X } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useReturnFocus } from "../lib/focus";
import type { Theme } from "../lib/theme";
import type { ScenarioCode, WarehouseKey } from "../lib/types";
import type { Page } from "../lib/url";
import { PAGE_NAV, PAGE_TITLE, SCEN, ThemeIcon } from "./Sidebar";

function Item({ icon, label, active, onClick, href, small = false }: { icon: ReactNode; label: string; active?: boolean; onClick?: (e?: MouseEvent) => void; href?: string; small?: boolean }) {
  const cls = `flex ${small ? "h-[68px] text-[12.5px]" : "h-[76px] text-[14px]"} min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl ${active ? "bg-card text-ink shadow-[var(--shadow-pill)]" : "text-ink-2"}`;
  const inner = (
    <>
      <span className={active ? "text-accent" : "text-muted"}>{icon}</span>
      {label}
    </>
  );
  return href ? (
    <a href={href} download className={cls} onClick={onClick}>
      {inner}
    </a>
  ) : (
    <button type="button" className={cls} aria-pressed={active} onClick={onClick}>
      {inner}
    </button>
  );
}

const PAGE_SHORT: Record<Page, string> = { overview: "Overview", demand: "Demand", cost: "Cost", playbook: "Playbook", methods: "Methods" };

/**
 * The menu grid (phone-menu.jpg): a sheet from the top, icon over label, closing on any choice. It is the navigation
 * wherever the sidebar is hidden (below 80rem): pages 5 across, scenarios 3, warehouses 4, then CSV and Theme.
 */
export function PhoneMenu({ open, onOpenChange, scenario, wk, theme, onScenario, onWk, onTheme, onCsv, page, onPage }: {
  page: Page;
  onPage: (p: Page) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scenario: ScenarioCode;
  wk: WarehouseKey;
  theme: Theme;
  onScenario: (s: ScenarioCode) => void;
  onWk: (w: WarehouseKey) => void;
  onTheme: () => void;
  onCsv: () => void;
}) {
  const close = () => onOpenChange(false);
  const returnFocus = useReturnFocus(open, "[data-menu-button]");
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20" />
        <Dialog.Content className="drop-in fixed inset-x-0 top-0 z-50 rounded-b-[20px] bg-side px-4 pt-4 pb-5 shadow-[var(--shadow-pop)] focus:outline-none" aria-describedby={undefined} onCloseAutoFocus={returnFocus}>
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <div className="flex h-11 items-center gap-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-card text-ink-2 shadow-[var(--shadow-pill)]">
              <LayoutGrid size={14} strokeWidth={2} />
            </span>
            <span className="flex-1 text-[18px] font-semibold tracking-[-.015em]">{PAGE_TITLE[page]}</span>
            <Dialog.Close className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-card px-3.5 text-[14px] text-ink">
              <X size={16} strokeWidth={1.75} />
              Menu
            </Dialog.Close>
          </div>
          {/* One row per group (phone-menu.jpg): pages 5 across, scenarios 3, warehouses 4, then CSV and Theme. */}
          <div className="mt-3 grid grid-cols-5 gap-1" data-menu="pages">
            {PAGE_NAV.map(({ page: pg, Icon }) => (
              <Item key={pg} small icon={<Icon size={19} strokeWidth={1.6} />} label={PAGE_SHORT[pg]} active={pg === page} onClick={() => (onPage(pg), close())} />
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {SCEN.map(({ code, label, Icon }) => (
              <Item key={code} icon={<Icon size={20} strokeWidth={1.6} />} label={label} active={code === scenario} onClick={() => (onScenario(code), close())} />
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {(["all", "1", "2", "4"] as WarehouseKey[]).map((w) => (
              <Item
                key={w}
                icon={w === "all" ? <LayoutGrid size={20} strokeWidth={1.6} /> : <Warehouse size={20} strokeWidth={1.6} />}
                label={w === "all" ? "All" : `W${w}`}
                active={w === wk}
                onClick={() => (onWk(w), close())}
              />
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <Item icon={<Download size={20} strokeWidth={1.6} />} label="CSV" href="/api/submission.csv" onClick={(e) => (e?.preventDefault(), onCsv(), close())} />
            <Item icon={<ThemeIcon theme={theme} size={20} />} label="Theme" onClick={() => (onTheme(), close())} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
