import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Card, chartColors, deptColor, gridProps, SegmentedControl, SwatchLabel, barTooltipProps, xAxisProps, yAxisProps } from "../../components";
import { cn } from "../../lib/cn";
import { fmtInt, signedPct } from "../../lib/format";
import type { ScenarioCode } from "../../lib/types";
import { tokens } from "../../styles/tokens";
import { fmtUnits, type ForecastSeries } from "./types";

const UP = tokens.scale.change.stops[5];
const DOWN = tokens.scale.change.stops[1];
const NONE = tokens.color.draft_soft;

interface Step {
  key: string;
  label: string;
  /** Short name and second line for the chart axis. */
  short: string;
  axisSub: string;
  sub: string;
  value: number; // the step's effect, or the level for a total
  range: [number, number];
  total: boolean;
  why: string;
}

const weekdayName = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long" });
};
const signedUnits = (n: number) => (Math.abs(n) < 0.05 ? "0.0" : `${n > 0 ? "+" : "−"}${fmtUnits(Math.abs(n))}`);
const factor = (f: number, digits = 2) => `x${f.toFixed(digits)}`;

function buildSteps(s: ForecastSeries, date: string, scenario: ScenarioCode): { steps: Step[]; benchmark: number; final: number; top: number } | null {
  const d = s.days.find((x) => x.date === date);
  if (!d) return null;
  const sc = d.scenarios[scenario];
  const steps: Step[] = [];
  const normal = d.normal_day;
  steps.push({ key: "normal", label: `Normal ${weekdayName(d.date)}`, short: "Normal", axisSub: weekdayName(d.date), sub: "weekday level", value: normal, range: [0, normal], total: true, why: `What a normal ${weekdayName(d.date)} brings for ${s.department}, at the recent weekly level.` });
  const afterHoliday = normal + d.holiday_effect;
  steps.push({
    key: "holiday",
    label: d.window === "normal" ? "Holiday window" : (d.window_label ?? "Holiday window"),
    short: "Holiday",
    axisSub: d.window === "normal" ? "none" : factor(d.holiday_factor),
    sub: d.window === "normal" ? "not in the window" : factor(d.holiday_factor),
    value: d.holiday_effect,
    range: [Math.min(normal, afterHoliday), Math.max(normal, afterHoliday)],
    total: false,
    why: d.window === "normal" ? "Outside the Presidents' Day window, so no holiday effect." : `${d.window_label}: ${factor(d.holiday_factor)} for ${s.department}, measured on the MLK weekend (A-05).`,
  });
  const afterVal = afterHoliday + d.valentine_effect;
  steps.push({
    key: "valentine",
    label: "Valentine's Day",
    short: "Valentine's",
    axisSub: d.valentine_uplift > 0 ? `+${(d.valentine_uplift * 100).toFixed(0)}%` : "none",
    sub: d.valentine_uplift > 0 ? `+${(d.valentine_uplift * 100).toFixed(0)}%` : d.holiday === "Valentine's Day" ? "no uplift" : "not this day",
    value: d.valentine_effect,
    range: [Math.min(afterHoliday, afterVal), Math.max(afterHoliday, afterVal)],
    total: false,
    why: d.valentine_uplift > 0 ? `A judgment call with no history to measure it: +${(d.valentine_uplift * 100).toFixed(0)}% (A-06).` : d.holiday === "Valentine's Day" ? `No Valentine's uplift for ${s.department} (A-06).` : "Only Feb 14 carries the Valentine's adjustment.",
  });
  steps.push({ key: "forecast", label: "Our forecast", short: "Forecast", axisSub: "BASE", sub: "BASE", value: d.forecast, range: [0, d.forecast], total: true, why: "The BASE forecast: what the plan staffs for in BASE and DISRUPT." });
  let final = d.forecast;
  if (scenario !== "BASE" && sc) {
    const end = sc.demand;
    steps.push({
      key: "scenario",
      label: `${scenario} multiplier`,
      short: scenario,
      axisSub: Math.abs(sc.multiplier - 1) > 1e-9 ? factor(sc.multiplier, 3) : "none",
      sub: Math.abs(sc.multiplier - 1) > 1e-9 ? factor(sc.multiplier, 3) : "no change",
      value: sc.effect,
      range: [Math.min(d.forecast, end), Math.max(d.forecast, end)],
      total: false,
      why:
        Math.abs(sc.multiplier - 1) > 1e-9
          ? `${scenario} raises this day's demand ${((sc.multiplier - 1) * 100).toFixed(1)}%: ${sc.reason ?? "the case's multipliers"}. Its multipliers differ by shift, so the day's figure blends them.`
          : `${scenario} doesn't change demand on this day.`,
    });
    steps.push({ key: "final", label: `${scenario} demand`, short: "Demand", axisSub: scenario, sub: "staffed for", value: end, range: [0, end], total: true, why: `The demand the ${scenario} plan staffs for.` });
    final = end;
  }
  // A step that adds nothing still gets a hairline marker at its level (about 1.5px), so every step has a
  // mark: Recharts skips zero-height bars, which would also shift its label indexes.
  const top = Math.max(d.benchmark, ...steps.map((st) => st.range[1]));
  for (const st of steps) if (!st.total && st.range[1] - st.range[0] < top * 0.006) st.range = [st.range[0] - top * 0.003, st.range[0] + top * 0.003];
  return { steps, benchmark: d.benchmark, final, top };
}

const fillFor = (s: Step) => (s.total ? chartColors.plan : Math.abs(s.value) < 1e-9 ? NONE : s.value > 0 ? UP : DOWN);

function Tick({ x, y, payload, steps }: { x?: number; y?: number; payload?: { index: number }; steps: Step[] }) {
  const s = payload ? steps[payload.index] : undefined;
  if (!s || x == null || y == null) return null;
  return (
    <text x={x} y={y + 6} textAnchor="middle" fontSize={14} fontFamily={tokens.type.family_ui}>
      <tspan x={x} dy="0.71em" fill={s.total ? tokens.color.ink : tokens.color.ink_muted} fontWeight={s.total ? 600 : 400}>
        {s.short}
      </tspan>
      <tspan x={x} dy="1.25em" fill={tokens.color.ink_subtle}>
        {s.axisSub}
      </tspan>
    </text>
  );
}

export interface DayWaterfallProps {
  series: ForecastSeries[];
  scenario: ScenarioCode;
  dept: number;
  date: string;
  onDept: (d: number) => void;
  onDate: (d: string) => void;
  warehouseName: string;
}

/** For a chosen day and department: from a normal weekday, through the holiday window and Valentine's Day, to the scenario. */
export function DayWaterfall({ series, scenario, dept, date, onDept, onDate, warehouseName }: DayWaterfallProps) {
  const s = series.find((x) => x.dept_id === dept) ?? series[0];
  const built = s ? buildSteps(s, date, scenario) : null;
  if (!s || !built) return null;
  const { steps, benchmark, final, top } = built;
  const step = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => (top * 1.06) / s <= 5) ?? 2000;
  const yTicks = Array.from({ length: Math.ceil((top * 1.06) / step) + 1 }, (_, i) => i * step);
  const day = s.days.find((x) => x.date === date)!;

  return (
    <Card title="How one day's demand is built" description={`From a normal weekday to the demand the plan staffs for, for ${warehouseName}. Pick a department and a day; hover the box under the table for the drivers in words.`}>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Department"
          size="sm"
          value={String(s.dept_id)}
          onChange={(v) => onDept(Number(v))}
          options={series.map((x) => ({ value: String(x.dept_id), label: <SwatchLabel color={deptColor(x.dept_id)} className="text-inherit">{x.department}</SwatchLabel> }))}
        />
        <SegmentedControl
          label="Day"
          size="sm"
          value={date}
          onChange={onDate}
          options={s.days.map((d) => ({ value: d.date, label: d.day_short, description: d.holiday ? `${d.day}: ${d.holiday}` : d.day }))}
        />
      </div>

      <div className="mt-4 grid gap-6 min-[1280px]:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <div className="min-w-0">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={steps} margin={{ top: 28, right: 136, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...xAxisProps} height={52} tick={(p: object) => <Tick {...(p as object)} steps={steps} />} />
              <YAxis {...yAxisProps} width={52} domain={[0, yTicks[yTicks.length - 1]]} ticks={yTicks} tickFormatter={(v: number) => fmtInt(v)} />
              <ReferenceLine
                y={benchmark}
                stroke={chartColors.benchmark}
                strokeWidth={2}
                strokeDasharray="6 4"
                ifOverflow="extendDomain"
                label={{ value: `Benchmark ${fmtUnits(benchmark)}`, position: "right", fill: tokens.color.ink_subtle, fontSize: 14 }}
              />
              <RTooltip
                {...barTooltipProps}
                content={(p) => {
                  const st = (p.payload?.[0]?.payload as Step | undefined) ?? undefined;
                  if (!p.active || !st) return null;
                  return (
                    <div className="max-w-[300px] rounded-control bg-navy px-3 py-2.5 text-sm text-navy-ink shadow-raised">
                      <div className="font-semibold">
                        {st.label} <span className="font-normal text-navy-ink-muted">{st.sub}</span>
                      </div>
                      <div className="tnum mt-1 text-base font-semibold">{st.total ? fmtUnits(st.value) : signedUnits(st.value)}</div>
                      <div className="mt-1 text-navy-ink-muted">{st.why}</div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="range"
                maxBarSize={tokens.chart.bar_max_width * 2}
                isAnimationActive={false}
                label={(p: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number; value?: unknown }) => {
                  // Match the label to its step by range, not index (a skipped bar would shift indexes).
                  const v = Array.isArray(p.value) ? (p.value as number[]) : null;
                  const st = (v && steps.find((x) => Math.abs(x.range[0] - v[0]) < 1e-9 && Math.abs(x.range[1] - v[1]) < 1e-9)) || (p.index != null ? steps[p.index] : undefined);
                  if (!st || p.x == null || p.y == null) return <g />;
                  // If the dashed benchmark line crosses where the label would sit, lift the label above the line.
                  let baseline = Number(p.y) - 8;
                  const h = Math.abs(Number(p.height ?? 0));
                  const [r0, r1] = st.range;
                  if (h > 0 && r1 > r0) {
                    const benchY = Number(p.y) + ((r1 - benchmark) * h) / (r1 - r0);
                    if (benchY > baseline - 18 && benchY < baseline + 6) baseline = benchY - 7;
                  }
                  return (
                    <text x={Number(p.x) + Number(p.width ?? 0) / 2} y={baseline} textAnchor="middle" fontSize={14} fontWeight={st.total ? 600 : 500} fill={st.total ? tokens.color.ink : tokens.color.ink_muted} className="tnum">
                      {st.total ? fmtUnits(st.value) : signedUnits(st.value)}
                    </text>
                  );
                }}
              >
                {steps.map((st) => (
                  <Cell key={st.key} fill={fillFor(st)} radius={(st.total ? [4, 4, 0, 0] : [4, 4, 4, 4]) as unknown as number} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="min-w-0">
          <table className="w-full border-separate border-spacing-0 text-base">
            <caption className="sr-only">The steps from a normal weekday to {scenario} demand</caption>
            <tbody>
              {steps.map((st) => (
                <tr key={st.key}>
                  <td className={cn("border-b border-border py-2 pr-3 align-top", st.total ? "font-semibold text-ink" : "text-ink-muted")}>
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: fillFor(st) }} />
                      {st.total && st.key !== "normal" ? "= " : ""}
                      {st.label}
                      {!st.total && <span className="text-sm font-normal text-ink-subtle">{st.sub}</span>}
                    </span>
                  </td>
                  <td className={cn("tnum border-b border-border py-2 text-right align-top", st.total ? "font-semibold text-ink" : "text-ink-muted")}>{st.total ? fmtUnits(st.value) : signedUnits(st.value)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-3 text-ink-muted">
                  <span className="flex items-center gap-2">
                    <svg width="12" height="4" aria-hidden className="shrink-0">
                      <line x1="0" y1="2" x2="12" y2="2" stroke={chartColors.benchmark} strokeWidth="2" strokeDasharray="4 2" />
                    </svg>
                    Benchmark
                  </span>
                </td>
                <td className="tnum py-2 text-right text-ink-muted">{fmtUnits(benchmark)}</td>
              </tr>
            </tbody>
          </table>
          <div
            className="mt-3 rounded-control bg-raised px-3.5 py-3"
            title={[day.driver ?? steps.filter((st) => (st.key === "holiday" || st.key === "valentine") && Math.abs(st.value) > 1e-9).map((st) => st.why).join(" "), scenario !== "BASE" ? steps.find((st) => st.key === "scenario")?.why ?? "" : ""].filter(Boolean).join(" ")}
          >
            <div className="text-sm text-ink-subtle">
              {day.day} · {s.department}
            </div>
            <div className="tnum mt-0.5 flex items-baseline gap-2">
              <span className="font-display text-[22px] font-semibold text-ink">{signedPct(final / benchmark - 1, 1)}</span>
              <span className="text-sm text-ink-subtle">vs benchmark</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
