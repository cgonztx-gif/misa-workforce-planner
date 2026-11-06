import { demandOf, gapOf, MISS, surgeOf } from "../../lib/demand";
import { int, intCompact, signedPct1, units1 } from "../../lib/format";
import { niceTicks } from "../../lib/ticks";
import type { ForecastSeries, Meta, ScenarioCode } from "../../lib/types";

/**
 * Forecast vs benchmark by day (components.md main chart, as paired columns: 7 days, two values each, a common zero).
 * The forecast is the heavy ink column; the scenario's surge (Peak) stacks on it, striped; the benchmark is a light
 * dashed column beside it. Over each day, the gap: red when the benchmark sits 2% or more under the forecast (it would
 * staff too few), grey otherwise. Each day is a button that opens its build in the slot.
 */
export function ForecastChart({ series, scenario, scenarioName, meta, day, onDay }: {
  series: ForecastSeries;
  scenario: ScenarioCode;
  scenarioName: string;
  meta: Meta;
  day: string;
  onDay: (date: string) => void;
}) {
  const max = Math.max(...series.days.map((d) => Math.max(demandOf(d, scenario), d.benchmark)));
  const ticks = niceTicks(max * 1.04, 4);
  const top = ticks[ticks.length - 1];
  const h = (v: number) => `${(v / top) * 100}%`;
  const hw = new Set(meta.days.filter((d) => d.holiday_window).map((d) => d.date));
  const hwIdx = series.days.map((d, i) => (hw.has(d.date) ? i : -1)).filter((i) => i >= 0);
  const hwSpan = hwIdx.length ? [hwIdx[0], hwIdx[hwIdx.length - 1]] : null;
  const hasSurge = series.days.some((d) => surgeOf(d, scenario) > 0);

  return (
    <div data-chart="forecast">
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-3 rounded-[3px] bg-ink/75" />
          Forecast
        </span>
        {hasSurge && (
          <span className="inline-flex items-center gap-1.5" data-tip={`The ${scenarioName} scenario's extra demand, from the case's multipliers`}>
            <span aria-hidden className="stripes h-3 w-3 rounded-[3px] bg-ink/30" />
            {scenarioName} surge
          </span>
        )}
        <span className="inline-flex items-center gap-1.5" data-tip="The case's naive forecast: the same weekday's average over weeks 3-6. It ignores holidays.">
          <span aria-hidden className="h-3 w-3 rounded-[3px] border-[1.5px] border-dashed border-series-grey bg-series-grey/15" />
          Benchmark
        </span>
        <span className="inline-flex items-center gap-1.5" data-tip="The benchmark is 2% or more under the forecast: it would staff too few">
          <span aria-hidden className="text-[12px] font-semibold text-bad-strong">+%</span>
          Benchmark low
        </span>
      </div>

      <div className="mt-3 flex">
        {/* y axis */}
        <div className={`relative w-10 shrink-0 ${hwSpan ? "pt-5" : ""}`} aria-hidden>
          <div className="relative h-[300px] compact:h-[240px]">
            {ticks.map((t) => (
              <span key={t} className="absolute right-2 translate-y-1/2 text-[11.5px] text-muted tnum" style={{ bottom: h(t) }}>
                {intCompact(t)}
              </span>
            ))}
          </div>
        </div>

        <div className="relative min-w-0 flex-1">
          {/* gridlines behind the columns */}
          <div className={`pointer-events-none absolute inset-x-0 h-[300px] compact:h-[240px] ${hwSpan ? "top-5" : "top-0"}`} aria-hidden>
            {ticks.map((t) => (
              <span key={t} className={`absolute inset-x-0 h-px ${t === 0 ? "bg-line-strong" : "bg-line"}`} style={{ bottom: h(t) }} />
            ))}
          </div>

          {/* The holiday window, named once over its columns (as the Overview's range band). */}
          {hwSpan && (
            <div className="relative mb-1 grid h-4 grid-cols-7 gap-1.5" aria-hidden>
              <span className="text-center text-[11px] leading-4 text-muted" style={{ gridColumn: `${hwSpan[0] + 1} / ${hwSpan[1] + 2}` }}>
                Holiday window
              </span>
            </div>
          )}
          <div className="relative grid grid-cols-7 gap-1.5" role="group" aria-label={`${series.department} demand by day, forecast and benchmark`}>
            {series.days.map((d) => {
              const dem = demandOf(d, scenario);
              const surge = surgeOf(d, scenario);
              const gap = gapOf(d, scenario);
              const low = gap >= MISS;
              const on = d.date === day;
              const inHw = hw.has(d.date);
              const named = d.holiday && !/weekend$/i.test(d.holiday);
              return (
                <button
                  key={d.date}
                  type="button"
                  data-day={d.date}
                  aria-pressed={on}
                  aria-label={`${d.day}: forecast ${units1(dem)}, benchmark ${units1(d.benchmark)}, ${signedPct1(gap)}`}
                  data-tip-title={`${units1(dem)} units`}
                  data-tip={[`${d.day}${d.holiday ? ` · ${d.holiday}` : ""}`, `Benchmark ${units1(d.benchmark)} · ${signedPct1(gap)}`, surge > 0 ? `${scenarioName} surge +${units1(surge)}` : ""].filter(Boolean).join("\n")}
                  onClick={() => onDay(d.date)}
                  className={`group relative flex flex-col rounded-[12px] pb-2 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    on ? "bg-accent/[.07] ring-1 ring-accent/25 ring-inset" : inHw ? "bg-soft/50 hover:bg-soft" : "hover:bg-soft/60"
                  }`}
                >
                  <div className="relative h-[300px] compact:h-[240px]">
                    {/* the gap label rides on the taller column */}
                    <span
                      className={`absolute inset-x-0 text-center text-[12.5px] font-semibold tnum ${low ? "text-bad-strong" : "text-muted"}`}
                      style={{ bottom: `calc(${h(Math.max(dem, d.benchmark))} + 6px)` }}
                    >
                      {signedPct1(gap)}
                    </span>
                    <div className="absolute inset-x-[14%] bottom-0 flex h-full items-end gap-[6%]">
                      <div className="flex h-full flex-1 flex-col justify-end">
                        {surge > 0 && <span className="stripes block rounded-t-[5px] bg-ink/30" style={{ height: h(surge) }} />}
                        <span className={`block bg-ink/75 ${surge > 0 ? "" : "rounded-t-[5px]"} group-hover:bg-ink/85`} style={{ height: h(dem - surge) }} />
                      </div>
                      <span className="block flex-1 rounded-t-[5px] border-[1.5px] border-b-0 border-dashed border-series-grey bg-series-grey/15" style={{ height: h(d.benchmark) }} />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-col items-center leading-tight">
                    <span className={`text-[12px] ${on ? "font-medium text-accent" : "text-muted"}`}>{d.day_short.split(" ")[0]}</span>
                    <span className={`text-[13.5px] font-semibold tnum ${on ? "text-ink" : "text-ink-2"}`}>{d.day_short.split(" ")[1]}</span>
                    <span aria-hidden className={`mt-0.5 size-1 rounded-full ${named ? "bg-ink-2" : "bg-transparent"}`} />
                    <span className="mt-1 text-[12px] font-medium text-ink-2 tnum">{int(dem)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
