// Hours and expected service by day, plan against draft, as two small multiples on one shared day axis.
// Never two y-axes: each measure gets its own chart. The holiday window is shaded and named.
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import {
  bandProps,
  barGap,
  barProps,
  barTooltipProps,
  Card,
  ChartLegend,
  chartColors,
  chartMargin,
  gridProps,
  legendItems,
  lineProps,
  tooltipContent,
  tooltipProps,
  xAxisProps,
  yAxisProps,
} from "../../components";
import { fmtHours, fmtInt, fmtPct, signedHours, signedPts } from "../../lib/format";
import type { GroupTotals } from "../../lib/types";

type Row = GroupTotals["by_day"][number] & { planHours: number; draftHours: number; planMet: number | null; draftMet: number | null };

const H = 196;

/** Round ticks from zero: at most 5, on a 1-2-2.5-5 step. */
function niceTicks(max: number): number[] {
  const raw = Math.max(max, 1) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** Day tick: "Sat 14", with a named holiday under it in the accent ink. */
function DayTick(props: { x?: number; y?: number; payload?: { value: string }; rows: Row[] }) {
  const { x = 0, y = 0, payload, rows } = props;
  const row = rows.find((r) => r.day_short === payload?.value);
  const named = row?.holiday && !/weekend/i.test(row.holiday) ? row.holiday : null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={14} textAnchor="middle" fill={chartColors.tick} fontSize={14}>
        {payload?.value}
      </text>
      {named && (
        <text dy={32} textAnchor="middle" fill="var(--wp-color-accent-strong)" fontSize={14} fontWeight={500}>
          {named}
        </text>
      )}
    </g>
  );
}

function windowSpan(rows: Row[], holidayWindow: (date: string) => boolean) {
  const inWin = rows.filter((r) => holidayWindow(r.date));
  return inWin.length ? { x1: inWin[0].day_short, x2: inWin[inWin.length - 1].day_short } : null;
}

export function ByDayCharts({ totals, goal, holidayWindow, windowName }: { totals: GroupTotals; goal: number; holidayWindow: (date: string) => boolean; windowName: { short: string; long: string } }) {
  const rows: Row[] = totals.by_day.map((d) => ({
    ...d,
    planHours: d.plan.hours,
    draftHours: d.draft.hours,
    planMet: d.plan.expected_met,
    draftMet: d.draft.expected_met,
  }));
  const span = windowSpan(rows, holidayWindow);
  const hourTicks = niceTicks(Math.max(...rows.map((r) => Math.max(r.planHours, r.draftHours))));
  const footer = (row?: Record<string, unknown>) => (row?.holiday ? String(row.holiday) : null);
  const heading = (_l: unknown, row?: Record<string, unknown>) => String(row?.day ?? _l);

  return (
    <Card
      title="By day, plan against draft"
      description={`Hours and expected service for each day. The shaded days are the ${windowName.long}.`}
      actions={
        <ChartLegend
          items={[legendItems.plan, legendItems.draft]}
        />
      }
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h4 className="text-sm font-semibold text-ink">Paid hours</h4>
        <span className="tnum text-sm text-ink-subtle">
          Week: {fmtHours(totals.plan.hours)} plan, {signedHours(totals.change.hours)} vs draft
        </span>
      </div>
      <ResponsiveContainer width="100%" height={H}>
        <ComposedChart data={rows} margin={{ ...chartMargin, top: 22 }} barGap={barGap} barCategoryGap="28%">
          <CartesianGrid {...gridProps} />
          {span && (
            <ReferenceArea
              {...bandProps}
              x1={span.x1}
              x2={span.x2}
              label={{ value: windowName.short, position: "insideTop", offset: -18, fill: "var(--wp-color-accent-strong)", fontSize: 14, fontWeight: 500 }}
            />
          )}
          <XAxis dataKey="day_short" {...xAxisProps} />
          <YAxis {...yAxisProps} domain={[0, hourTicks[hourTicks.length - 1]]} ticks={hourTicks} tickFormatter={(v: number) => fmtInt(v)} />
          <RTooltip
            {...barTooltipProps}
            content={tooltipContent({
              format: (v) => fmtHours(v),
              labelFormat: heading,
              footer: (row) => {
                const ch = (row?.change as { hours?: number } | undefined)?.hours;
                const hol = footer(row);
                return [hol, ch != null ? `${signedHours(ch)} vs draft` : null].filter(Boolean).join(". ") || null;
              },
            })}
          />
          <Bar dataKey="draftHours" name="Draft" {...barProps.draft} />
          <Bar dataKey="planHours" name="Plan" {...barProps.plan} />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-4 mb-1 flex items-baseline justify-between border-t border-border pt-4">
        <h4 className="flex items-center gap-3 text-sm font-semibold text-ink">
          Expected service
          <span className="inline-flex items-center gap-1.5 font-normal text-ink-subtle">
            <svg width="18" height="4" aria-hidden>
              <line x1="0" y1="2" x2="18" y2="2" stroke={chartColors.label} strokeWidth="1.5" strokeDasharray="2 3" />
            </svg>
            {fmtPct(goal, 0)} goal
          </span>
        </h4>
        <span className="tnum text-sm text-ink-subtle">
          Week: {fmtPct(totals.plan.expected_met)} plan, {signedPts(totals.change.expected_met)} vs draft
        </span>
      </div>
      <ResponsiveContainer width="100%" height={H + 18}>
        <ComposedChart data={rows} margin={{ ...chartMargin, top: 10 }}>
          <CartesianGrid {...gridProps} />
          {span && <ReferenceArea {...bandProps} x1={span.x1} x2={span.x2} />}
          <XAxis dataKey="day_short" {...xAxisProps} scale="band" height={44} tick={(p: object) => <DayTick {...(p as object)} rows={rows} />} />
          <YAxis {...yAxisProps} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => fmtPct(v, 0)} />
          <ReferenceLine
            y={goal}
            stroke={chartColors.label}
            strokeDasharray="2 3"
            strokeWidth={1.5}
            ifOverflow="extendDomain"
          />
          <RTooltip
            {...tooltipProps}
            content={tooltipContent({
              format: (v) => fmtPct(v),
              labelFormat: heading,
              footer: (row) => {
                const below = (row?.plan as { below_goal?: number } | undefined)?.below_goal;
                const hol = footer(row);
                return [hol, below ? `${below} ${below === 1 ? "block" : "blocks"} below the goal` : null].filter(Boolean).join(". ") || null;
              },
            })}
          />
          <Line dataKey="draftMet" name="Draft" {...lineProps.draft} dot={{ r: 3.5, fill: chartColors.draft, stroke: chartColors.surface, strokeWidth: 2 }} />
          <Line dataKey="planMet" name="Plan" {...lineProps.plan} dot={{ r: 4, fill: chartColors.plan, stroke: chartColors.surface, strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
