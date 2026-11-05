import { CartesianGrid, ComposedChart, Area, Line, ReferenceArea, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Card, ChartLegend, chartColors, DeltaChip, deptColor, gridProps, legendItems, lineProps, SwatchLabel, tooltipProps, xAxisProps, yAxisProps, type LegendItem } from "../../components";
import { fmtInt, signedPct } from "../../lib/format";
import type { ScenarioCode } from "../../lib/types";
import { tokens } from "../../styles/tokens";
import { scenarioDemand, surgeDays, weekTotals, fmtUnits, type ForecastDay, type ForecastSeries } from "./types";

const VALENTINE = "Valentine's Day";
const BASE_LINE = tokens.scale.chance.stops[2]; // a lighter iris for BASE beside PEAK
// Valentine's Day sits inside the holiday window, so it takes a clearly deeper shade than the window's band.
const VALENTINE_FILL = tokens.color.accent_line;
const SURGE_FILL = tokens.color.accent;

/** A square swatch for a shaded span, so bands are named in the legend and never color-only. */
export function BandSwatch({ color, opacity = 1, label }: { color: string; opacity?: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
      <span aria-hidden className="size-3 rounded-[3px] ring-1 ring-border" style={{ background: color, opacity }} />
      {label}
    </span>
  );
}

interface Row {
  i: number;
  day: ForecastDay;
  forecast: number;
  base: number;
  benchmark: number;
  surge: [number, number] | null;
  gap: number;
}

const rowsFor = (s: ForecastSeries, scenario: ScenarioCode): Row[] =>
  s.days.map((d, i) => {
    const forecast = scenarioDemand(d, scenario);
    return { i, day: d, forecast, base: d.forecast, benchmark: d.benchmark, surge: scenario === "PEAK" ? [d.forecast, forecast] : null, gap: forecast / d.benchmark - 1 };
  });

/**
 * One rule for every department's y-axis: round ticks (at most six), the floor a round number at least
 * 12% of the range below the lowest point so nothing sits on the axis, and the top the next round number.
 */
function niceAxis(values: number[]): { domain: [number, number]; ticks: number[] } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.12, hi * 0.02);
  for (const step of [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]) {
    const floor = Math.max(0, Math.floor((lo - pad) / step) * step);
    const top = Math.ceil(hi / step) * step;
    if ((top - floor) / step <= 5) return { domain: [floor, top], ticks: Array.from({ length: (top - floor) / step + 1 }, (_, i) => floor + i * step) };
  }
  return { domain: [0, hi], ticks: [0, hi] };
}

/** Index of the day where our forecast sits furthest from the benchmark. */
const widestGap = (rows: Row[]) => rows.reduce((best, r) => (Math.abs(r.gap) > Math.abs(rows[best].gap) ? r.i : best), 0);

function DayTooltip({ active, payload, scenario, unit }: { active?: boolean; payload?: readonly { payload?: Row }[]; scenario: ScenarioCode; unit: string }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const d = row.day;
  const sc = d.scenarios[scenario];
  const lines: [string, string, string][] = [
    [scenario === "BASE" ? "Our forecast" : `Our forecast, ${scenario}`, fmtUnits(row.forecast), chartColors.plan],
    ...(scenario === "PEAK" ? ([["Our forecast, BASE", fmtUnits(row.base), BASE_LINE]] as [string, string, string][]) : []),
    ["Benchmark", fmtUnits(row.benchmark), chartColors.benchmark],
  ];
  return (
    <div className="min-w-[220px] rounded-control bg-navy px-3 py-2.5 text-sm text-navy-ink shadow-raised">
      <div className="mb-1.5 font-semibold">{d.day}</div>
      <div className="space-y-1">
        {lines.map(([name, value, color]) => (
          <div key={name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-navy-ink-muted">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />
              {name}
            </span>
            <span className="tnum font-medium">{value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-6">
          <span className="text-navy-ink-muted">Against the benchmark</span>
          <span className="tnum font-medium">{signedPct(row.gap, 1)}</span>
        </div>
      </div>
      <div className="mt-2 space-y-0.5 border-t border-navy-border pt-1.5 text-navy-ink-muted">
        {d.holiday && <div>{d.holiday}</div>}
        {scenario !== "BASE" && sc && Math.abs(sc.multiplier - 1) > 1e-9 && (
          <div>
            {scenario} x{sc.multiplier.toFixed(3)}: {sc.reason}
          </div>
        )}
        <div>{unit}</div>
      </div>
    </div>
  );
}

function DeptChart({ series, scenario, labelLines }: { series: ForecastSeries; scenario: ScenarioCode; labelLines: boolean }) {
  const rows = rowsFor(series, scenario);
  const win = rows.filter((r) => r.day.window !== "normal");
  const val = rows.find((r) => r.day.holiday === VALENTINE);
  const peak = widestGap(rows);
  const showSurge = scenario === "PEAK" && surgeDays(series, scenario).length > 0;
  const axis = niceAxis(rows.flatMap((r) => [r.forecast, r.benchmark, r.base]));

  // Direct labels at the widest gap: the size of the gap, and (top chart) the names of the lines.
  const forecastLabel = (p: { x?: number | string; y?: number | string; index?: number }) => {
    if (p.index !== peak || p.x == null || p.y == null) return <g />;
    const above = rows[peak].forecast >= rows[peak].benchmark;
    const text = `${labelLines ? "Our forecast " : ""}${signedPct(rows[peak].gap, 1)}`;
    // Keep the label off the line: a neighbour on the label's side means a segment runs through that corner.
    const cur = rows[peak].forecast;
    const clear = (n?: Row) => !n || (above ? n.forecast <= cur : n.forecast >= cur);
    const leftClear = clear(rows[peak - 1]);
    const rightClear = clear(rows[peak + 1]);
    const side = leftClear && rightClear ? "middle" : rightClear ? "start" : leftClear ? "end" : "middle";
    const dx = side === "start" ? 9 : side === "end" ? -9 : 0;
    return (
      <text x={Number(p.x) + dx} y={Number(p.y) + (above ? -12 : 22)} textAnchor={side} fontSize={14} fontWeight={600} fill={tokens.color.ink}>
        {text}
      </text>
    );
  };
  const benchLabel = (p: { x?: number | string; y?: number | string; index?: number }) => {
    if (!labelLines || p.index !== peak || p.x == null || p.y == null) return <g />;
    const below = rows[peak].forecast >= rows[peak].benchmark;
    return (
      <text x={Number(p.x)} y={Number(p.y) + (below ? 22 : -12)} textAnchor="middle" fontSize={14} fill={tokens.color.ink_subtle}>
        Benchmark
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={184}>
      <ComposedChart data={rows} margin={{ top: 26, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        {win.length > 0 && <ReferenceArea x1={win[0].i - 0.5} x2={win[win.length - 1].i + 0.5} fill={chartColors.band} fillOpacity={1} strokeOpacity={0} ifOverflow="hidden" />}
        {val && <ReferenceArea x1={val.i - 0.5} x2={val.i + 0.5} fill={VALENTINE_FILL} fillOpacity={1} strokeOpacity={0} ifOverflow="hidden" />}
        <XAxis
          type="number"
          dataKey="i"
          domain={[-0.5, rows.length - 0.5]}
          ticks={rows.map((r) => r.i)}
          tickFormatter={(i: number) => rows[i]?.day.day_short ?? ""}
          {...xAxisProps}
          allowDecimals={false}
        />
        <YAxis {...yAxisProps} width={52} domain={axis.domain} ticks={axis.ticks} allowDataOverflow tickFormatter={(v: number) => fmtInt(v)} />
        <RTooltip {...tooltipProps} content={(p) => <DayTooltip active={p.active} payload={p.payload as never} scenario={scenario} unit={series.unit} />} />
        {showSurge && <Area dataKey="surge" name="PEAK surge" stroke="none" fill={SURGE_FILL} fillOpacity={0.16} isAnimationActive={false} activeDot={false} type="linear" />}
        {showSurge && <Line dataKey="base" name="Our forecast, BASE" {...lineProps.plan} type="linear" stroke={BASE_LINE} strokeWidth={1.5} activeDot={false} />}
        <Line dataKey="benchmark" name="Benchmark" {...lineProps.benchmark} type="linear" dot={{ r: 3, fill: chartColors.surface, stroke: chartColors.benchmark, strokeWidth: 1.5 }} label={benchLabel} />
        <Line dataKey="forecast" name="Our forecast" {...lineProps.plan} type="linear" dot={{ r: 4, fill: chartColors.plan, stroke: chartColors.surface, strokeWidth: 2 }} label={forecastLabel} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export interface ForecastByDayProps {
  series: ForecastSeries[];
  scenario: ScenarioCode;
  warehouseName: string;
  onShowPeak?: () => void;
}

/** Forecast against the benchmark by day: one small multiple per department (units differ, so never one axis). */
export function ForecastByDay({ series, scenario, warehouseName, onShowPeak }: ForecastByDayProps) {
  const legend: LegendItem[] = [
    { ...legendItems.forecast, label: scenario === "BASE" ? "Our forecast" : `Our forecast, ${scenario}` },
    ...(scenario === "PEAK" ? [{ label: "Our forecast, BASE", color: BASE_LINE }] : []),
    legendItems.benchmark,
  ];
  return (
    <Card
      title="Forecast against the benchmark, by day"
      description={`Daily demand for ${warehouseName}, in each department's own workload units. The benchmark is the case's same-weekday average, which ignores holidays.`}
      padding="none"
      footer={
        scenario === "PEAK" ? (
          "The shaded area between the two iris lines is PEAK's surge: the promotion launch and storm stock-up trips, from the case's multipliers."
        ) : (
          <span>
            {scenario === "DISRUPT" ? "DISRUPT leaves demand as in BASE: it changes who can work, not how much work there is. " : "PEAK adds a promotion and storm surge on top of this forecast. "}
            {onShowPeak && (
              <button type="button" onClick={onShowPeak} className="font-medium text-accent underline-offset-4 hover:underline">
                Show PEAK's surge
              </button>
            )}
          </span>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-5 pb-3">
        <ChartLegend items={legend} />
        <BandSwatch color={chartColors.band} label="Presidents' Day window, Feb 13-16" />
        <BandSwatch color={VALENTINE_FILL} label="Valentine's Day" />
        {scenario === "PEAK" && <BandSwatch color={SURGE_FILL} opacity={0.16} label="PEAK surge" />}
      </div>
      {series.map((s, idx) => {
        const week = weekTotals(s, scenario);
        const rows = rowsFor(s, scenario);
        const peak = rows[widestGap(rows)];
        return (
          <div key={s.dept_id} className="grid grid-cols-[228px_minmax(0,1fr)] items-center border-b border-border last:border-b-0 min-[1440px]:grid-cols-[244px_minmax(0,1fr)]">
            <div className="self-stretch border-r border-border px-5 py-4">
              <SwatchLabel color={deptColor(s.dept_id)} className="text-base font-semibold text-ink">
                {s.department}
              </SwatchLabel>
              <p className="mt-0.5 text-sm text-ink-subtle">{s.unit}</p>
              <p className="mt-3 text-sm font-medium text-ink-subtle">Against the benchmark</p>
              <div className="mt-1.5 space-y-1.5 text-sm text-ink-muted">
                <div className="flex items-center justify-between gap-2">
                  <span>Week</span>
                  <DeltaChip size="sm" value={week.vsBenchmark} format={(n) => signedPct(n, 1)} tooltip={`Our ${scenario} forecast for the week is ${fmtUnits(week.forecast)} units against the benchmark's ${fmtUnits(week.benchmark)}.`} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="whitespace-nowrap">Widest, {peak.day.day_short}</span>
                  <DeltaChip size="sm" value={peak.gap} format={(n) => signedPct(n, 1)} tooltip={`The widest gap of the week. ${peak.day.day}: ${fmtUnits(peak.forecast)} against the benchmark's ${fmtUnits(peak.benchmark)}.`} />
                </div>
              </div>
            </div>
            <div className="min-w-0 py-2 pr-2">
              <DeptChart series={s} scenario={scenario} labelLines={idx === 0} />
            </div>
          </div>
        );
      })}
    </Card>
  );
}
