import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { buildSteps, DEPTS, demandOf, findSeries, gapOf, MISS } from "../../lib/demand";
import { signedPct1, units1 } from "../../lib/format";
import type { DeptId } from "../../lib/url";
import type { ForecastResponse, ForecastSeries, ScenarioCode, WarehouseKey } from "../../lib/types";
import { iconBtn } from "../BlockDetail";

/**
 * The slot beside the chart: how one day's forecast is built (a waterfall on one shared scale, read top to bottom),
 * then the benchmark on the same scale, then the same day in every department. Words are labels; reasons are tooltips.
 */
export function DayBuild({ data, series, wk, dept, scenario, scenarioName, date, onDay, onDept }: {
  data: ForecastResponse;
  series: ForecastSeries;
  wk: WarehouseKey;
  dept: DeptId;
  scenario: ScenarioCode;
  scenarioName: string;
  date: string;
  onDay: (date: string) => void;
  onDept: (d: DeptId) => void;
}) {
  const i = Math.max(0, series.days.findIndex((d) => d.date === date));
  const d = series.days[i];
  const steps = buildSteps(d, scenario, scenarioName);
  const max = Math.max(...steps.map((s) => Math.max(s.from, s.to))) * 1.04;
  const x = (v: number) => `${(v / max) * 100}%`;
  const gap = gapOf(d, scenario);
  const low = gap >= MISS;
  const driver = d.scenarios[scenario]?.driver ?? d.driver;
  const where = wk === "all" ? "All warehouses" : `Warehouse ${wk}`;

  return (
    <div className="flex h-full min-h-0 flex-col p-5 max-sm:p-3" data-detail="day" data-day={d.date}>
      <div className="flex h-8 items-center gap-1">
        <span className="text-[12px] text-muted">Day build</span>
        <span className="flex-1" />
        {driver && (
          <button type="button" aria-label="Why" data-tip={driver} className={iconBtn}>
            <Info size={16} strokeWidth={1.75} />
          </button>
        )}
        <button type="button" aria-label="Previous day" data-tip="Previous day" disabled={i === 0} onClick={() => onDay(series.days[i - 1].date)} className={`${iconBtn} disabled:opacity-30`}>
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <button type="button" aria-label="Next day" data-tip="Next day" disabled={i === series.days.length - 1} onClick={() => onDay(series.days[i + 1].date)} className={`${iconBtn} disabled:opacity-30`}>
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
      <h3 className="mt-1 text-[15.5px] font-semibold tracking-[-.01em]">
        {d.day_short} · {series.department}
      </h3>
      <div className="mt-0.5 truncate text-[12.5px] text-muted">{[d.holiday, where].filter(Boolean).join(" · ")}</div>

      {/* Headline pair: forecast and its gap to the benchmark */}
      <div className="mt-4 flex items-end gap-3">
        <div>
          <div className="text-[12px] text-muted">Forecast</div>
          <div className="text-[32px] leading-[1.1] font-semibold tracking-[-.03em] tnum">{units1(demandOf(d, scenario))}</div>
        </div>
        <span
          className={`mb-1.5 inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium tnum ${low ? "bg-bad/12 text-ink" : "bg-ink/[.06] text-ink-2"}`}
          data-tip={low ? "The benchmark sits this far under the forecast: it would staff too few" : "Forecast against the benchmark"}
        >
          {signedPct1(gap)} vs benchmark
        </span>
      </div>

      {/* The waterfall */}
      <div className="mt-5 flex flex-col gap-3" role="list" aria-label="How the forecast is built">
        {steps.map((s) => {
          const lo = Math.min(s.from, s.to);
          const hi = Math.max(s.from, s.to);
          const delta = s.to - s.from;
          const value = s.kind === "step" ? `${delta >= 0 ? "+" : "−"}${units1(Math.abs(delta))}` : units1(s.to);
          const bar =
            s.kind === "base"
              ? "bg-ink/45"
              : s.kind === "total"
                ? "bg-ink/80"
                : s.kind === "bench"
                  ? "border-[1.5px] border-dashed border-series-grey bg-series-grey/15"
                  : delta >= 0
                    ? "bg-ink/25"
                    : "stripes bg-ink/20";
          return (
            <div key={s.key} role="listitem" data-step={s.key} data-tip={s.tip} className={s.kind === "total" ? "border-t border-line pt-3" : ""}>
              <div className="flex items-baseline gap-2 text-[13px]">
                <span className={`truncate ${s.kind === "total" ? "font-semibold text-ink" : "text-ink-2"}`}>{s.label}</span>
                {s.detail && <span className="shrink-0 text-[12px] text-muted tnum">{s.detail}</span>}
                <span className="flex-1" />
                <span className={`shrink-0 tnum ${s.kind === "total" ? "text-[15px] font-semibold" : s.kind === "step" ? "font-medium text-ink-2" : "font-medium"}`}>{value}</span>
              </div>
              <div className="relative mt-1.5 h-2.5 rounded-full bg-line/60">
                <span className={`absolute inset-y-0 rounded-full ${bar}`} style={{ left: x(lo), width: `max(3px, calc(${x(hi)} - ${x(lo)}))` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* The same day in each department (units differ, so each row is its own forecast vs benchmark) */}
      <div className="mt-auto pt-5">
        <div className="mb-1 flex text-[12px] text-muted">
          <span className="flex-1 font-medium text-ink-2">{d.day_short} by department</span>
          <span>vs benchmark</span>
        </div>
        {DEPTS.map((dp) => {
          const s = findSeries(data, wk, dp.id);
          const dd = s?.days.find((x) => x.date === d.date);
          if (!s || !dd) return null;
          const g = gapOf(dd, scenario);
          const on = dp.id === dept;
          return (
            <button
              key={dp.id}
              type="button"
              aria-pressed={on}
              onClick={() => onDept(dp.id)}
              data-tip={`${s.unit} · forecast ${units1(demandOf(dd, scenario))} · benchmark ${units1(dd.benchmark)}`}
              className={`flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                on ? "bg-accent/[.07] ring-1 ring-accent/25 ring-inset" : "hover:bg-soft/60"
              }`}
            >
              <span className={`flex-1 truncate ${on ? "font-medium text-ink" : "text-ink-2"}`}>{dp.name}</span>
              <span className={`text-[13.5px] font-semibold tnum ${g >= MISS ? "text-bad-strong" : "text-muted"}`}>{signedPct1(g)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
