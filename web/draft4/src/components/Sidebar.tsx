import { CalendarDays, ChartColumn, LayoutDashboard, LayoutGrid, Monitor, Moon, Sun, TrendingUp, UserMinus } from "lucide-react";
import type { Page } from "../lib/url";
import { chanceText, int } from "../lib/format";
import { themeName, type Theme } from "../lib/theme";
import type { CompareResponse, Meta, ScenarioCode, WarehouseKey } from "../lib/types";
import { Spinner } from "./StatusPill";

export const PAGE_NAV: { page: Page; label: string; Icon: typeof CalendarDays }[] = [
  { page: "overview", label: "Overview", Icon: LayoutDashboard },
  { page: "demand", label: "Demand", Icon: ChartColumn },
];

export const SCEN: { code: ScenarioCode; label: string; key: string; Icon: typeof CalendarDays }[] = [
  { code: "BASE", label: "Base", key: "B", Icon: CalendarDays },
  { code: "PEAK", label: "Peak", key: "P", Icon: TrendingUp },
  { code: "DISRUPT", label: "Disrupt", key: "D", Icon: UserMinus },
];

/** "Feb 12 – 18, 2026" from meta.days. */
export function weekText(meta?: Meta) {
  if (!meta?.days?.length) return "";
  const a = new Date(`${meta.days[0].date}T12:00:00`);
  const b = new Date(`${meta.days[meta.days.length - 1].date}T12:00:00`);
  const mon = a.toLocaleDateString("en", { month: "short" });
  return a.getMonth() === b.getMonth() ? `${mon} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}` : `${mon} ${a.getDate()} – ${b.toLocaleDateString("en", { month: "short" })} ${b.getDate()}, ${b.getFullYear()}`;
}

export function weekTip(meta?: Meta) {
  if (!meta) return "";
  return [meta.week && typeof meta.week === "object" ? String((meta.week as { label?: string }).label ?? "") : "", ...meta.days.filter((d) => d.holiday).map((d) => `${d.short} · ${d.holiday}`)].filter(Boolean).join("\n");
}

export function scenarioTip(code: ScenarioCode, meta?: Meta, compare?: CompareResponse, wk: WarehouseKey = "all") {
  const m = meta?.scenarios.find((s) => s.code === code);
  const c = compare?.scenarios.find((s) => s.code === code);
  const src = c ? (wk === "all" ? c : c.by_warehouse.find((x) => String(x.store_id) === wk) ?? c) : null;
  return [m?.name, m?.description, src ? `Service ${chanceText(src.plan.expected_met)} · Below goal ${int(src.plan.below_goal)}` : null].filter(Boolean).join("\n");
}

export const ThemeIcon = ({ theme, size = 16 }: { theme: Theme; size?: number }) =>
  theme === "light" ? <Sun size={size} strokeWidth={1.75} /> : theme === "dark" ? <Moon size={size} strokeWidth={1.75} /> : <Monitor size={size} strokeWidth={1.75} />;

export function Sidebar({ meta, scenario, loading, onScenario, compare, wk, theme, onTheme, page, onPage }: {
  meta?: Meta;
  scenario: ScenarioCode;
  loading: ScenarioCode | null;
  onScenario: (s: ScenarioCode) => void;
  compare?: CompareResponse;
  wk: WarehouseKey;
  theme: Theme;
  onTheme: () => void;
  page: Page;
  onPage: (p: Page) => void;
}) {
  const week = weekText(meta);
  return (
    <aside className="hidden w-[216px] shrink-0 border-r border-line bg-side min-[80rem]:block min-[90rem]:w-[232px] min-[112.5rem]:w-[248px]">
      <div className="sticky top-0 flex h-dvh flex-col p-3">
      <div className="flex items-center gap-2.5 px-2 pt-1.5" data-tip={weekTip(meta)}>
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-card text-ink-2 shadow-[var(--shadow-pill)]">
          <LayoutGrid size={14} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[14px] leading-tight font-semibold">Workforce Planner</div>
          <div className="h-4 text-[12.5px] leading-4 text-muted tnum">{week || <span className="skel inline-block h-3 w-24 rounded" />}</div>
        </div>
      </div>

      <div className="mt-6 px-2 text-[12px] text-muted">Pages</div>
      <nav className="mt-1.5 flex flex-col gap-0.5" aria-label="Pages">
        {PAGE_NAV.map(({ page: pg, label, Icon }) => {
          const on = pg === page;
          return (
            <button
              key={pg}
              type="button"
              aria-current={on ? "page" : undefined}
              data-page={pg}
              onClick={() => onPage(pg)}
              className={`flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-left text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                on ? "bg-card font-medium text-ink shadow-[var(--shadow-pill)]" : "text-ink-2 hover:bg-card/60"
              }`}
            >
              <span className={on ? "text-accent" : "text-muted"}>
                <Icon size={16} strokeWidth={1.75} />
              </span>
              <span className="flex-1">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-6 px-2 text-[12px] text-muted">Scenario</div>
      <nav className="mt-1.5 flex flex-col gap-0.5" aria-label="Scenario">
        {SCEN.map(({ code, label, key, Icon }) => {
          const on = code === scenario;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={on}
              onClick={() => onScenario(code)}
              data-tip={scenarioTip(code, meta, compare, wk)}
              className={`flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-left text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                on ? "bg-card font-medium text-ink shadow-[var(--shadow-pill)]" : "text-ink-2 hover:bg-card/60"
              }`}
            >
              <span className={on ? "text-accent" : "text-muted"}>
                <Icon size={16} strokeWidth={1.75} />
              </span>
              <span className="flex-1">{label}</span>
              {loading === code ? <Spinner /> : <span className="rounded border border-line px-1.5 text-[11px] leading-[16px] font-normal text-muted">{key}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2 px-2 pb-1">
        <div className="min-w-0 flex-1" data-tip={meta?.notice}>
          <div className="text-[13px] leading-tight text-ink-2">Simulated data</div>
          <div className="text-[12px] text-muted">Not Costco data</div>
        </div>
        <button
          type="button"
          onClick={onTheme}
          aria-label={`Theme · ${themeName(theme)}`}
          data-tip={`Theme · ${themeName(theme)}`}
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ThemeIcon theme={theme} />
        </button>
      </div>
      </div>
    </aside>
  );
}
