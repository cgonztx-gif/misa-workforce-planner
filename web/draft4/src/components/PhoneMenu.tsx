import * as Dialog from "@radix-ui/react-dialog";
import { Download, LayoutGrid, Warehouse, X } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useReturnFocus } from "../lib/focus";
import type { Theme } from "../lib/theme";
import type { ScenarioCode, WarehouseKey } from "../lib/types";
import { SCEN, ThemeIcon } from "./Sidebar";

function Item({ icon, label, active, onClick, href }: { icon: ReactNode; label: string; active?: boolean; onClick?: (e?: MouseEvent) => void; href?: string }) {
  const cls = `flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl text-[14px] ${active ? "bg-card text-ink shadow-[var(--shadow-pill)]" : "text-ink-2"}`;
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

/** The phone menu grid (phone-menu.jpg): a sheet from the top, 3 columns, icon over label. Closes on any choice. */
export function PhoneMenu({ open, onOpenChange, scenario, wk, theme, onScenario, onWk, onTheme, onCsv }: {
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
            <span className="flex-1 text-[18px] font-semibold tracking-[-.015em]">Overview</span>
            <Dialog.Close className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-card px-3.5 text-[14px] text-ink">
              <X size={16} strokeWidth={1.75} />
              Menu
            </Dialog.Close>
          </div>
          {/* One row per group (phone-menu.jpg): scenarios 3 across, warehouses 4 across, then CSV and Theme. */}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
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
