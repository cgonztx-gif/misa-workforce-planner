// Draft 3: the Overview's main view is one chart, expected service by day, plan against draft, with the goal
// dotted and the holiday window shaded. Hours by day moved to Cost and service (the Hours tile gives the total).
// Fixed 0-100% axis: it's a rate with known bounds, so full and empty read at a glance (dashboard-design).
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { bandProps, Card, ChartLegend, chartColors, chartMargin, gridProps, legendItems, lineProps, tooltipContent, tooltipProps, xAxisProps, yAxisProps } from "../../components";
import { fmtPct } from "../../lib/format";
import type { GroupTotals } from "../../lib/types";

type Row = GroupTotals["by_day"][number] & { planMet: number | null; draftMet: number | null };

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

const GoalKey = ({ goal }: { goal: number }) => (
  <span className="inline-flex items-center gap-1.5 text-sm text-ink-subtle">
    <svg width="18" height="4" aria-hidden>
      <line x1="0" y1="2" x2="18" y2="2" stroke={chartColors.label} strokeWidth="1.5" strokeDasharray="2 3" />
    </svg>
    {fmtPct(goal, 0)} goal
  </span>
);

export function ServiceByDay({ totals, goal, holidayWindow, windowName }: { totals: GroupTotals; goal: number; holidayWindow: (date: string) => boolean; windowName: { short: string; long: string } }) {
  const rows: Row[] = totals.by_day.map((d) => ({ ...d, planMet: d.plan.expected_met, draftMet: d.draft.expected_met }));
  const inWin = rows.filter((r) => holidayWindow(r.date));
  const span = inWin.length ? { x1: inWin[0].day_short, x2: inWin[inWin.length - 1].day_short } : null;
  const low = rows.reduce<Row | null>((m, r) => (r.draftMet != null && (m?.draftMet == null || r.draftMet < m.draftMet) ? r : m), null);
  const heading = (_l: unknown, row?: Record<string, unknown>) => String(row?.day ?? _l);
  const summary = `Expected service by day. Plan ${fmtPct(totals.plan.expected_met)} for the week against the draft's ${fmtPct(totals.draft.expected_met)}${
    low ? `; the draft is lowest on ${low.day} at ${fmtPct(low.draftMet)}` : ""
  }. Shaded: the ${windowName.long}.`;

  return (
    <Card
      title="Expected service by day"
      description={`The average modeled chance that a block meets its wait target, each day. Shaded: the ${windowName.long}.`}
      actions={
        <div className="flex items-center gap-4">
          <ChartLegend items={[legendItems.plan, legendItems.draft]} />
          <GoalKey goal={goal} />
        </div>
      }
      className="h-full"
    >
      <div role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={292}>
          <ComposedChart data={rows} margin={{ ...chartMargin, top: 22 }}>
            <CartesianGrid {...gridProps} />
            {span && (
              <ReferenceArea
                {...bandProps}
                x1={span.x1}
                x2={span.x2}
                label={{ value: "Holiday window", position: "insideTop", offset: -18, fill: "var(--wp-color-accent-strong)", fontSize: 14, fontWeight: 500 }}
              />
            )}
            <XAxis dataKey="day_short" {...xAxisProps} scale="band" height={44} tick={(p: object) => <DayTick {...(p as object)} rows={rows} />} />
            <YAxis {...yAxisProps} width={52} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => fmtPct(v, 0)} />
            <ReferenceLine y={goal} stroke={chartColors.label} strokeDasharray="2 3" strokeWidth={1.5} ifOverflow="extendDomain" />
            <RTooltip
              {...tooltipProps}
              content={tooltipContent({
                format: (v) => fmtPct(v),
                labelFormat: heading,
                footer: (row) => {
                  const below = (row?.plan as { below_goal?: number } | undefined)?.below_goal;
                  const hol = row?.holiday ? String(row.holiday) : null;
                  return [hol, below ? `${below} ${below === 1 ? "block" : "blocks"} below the goal` : null].filter(Boolean).join(" · ") || null;
                },
              })}
            />
            <Line dataKey="draftMet" name="Draft" {...lineProps.draft} dot={{ r: 3.5, fill: chartColors.draft, stroke: chartColors.surface, strokeWidth: 2 }} />
            <Line dataKey="planMet" name="Plan" {...lineProps.plan} dot={{ r: 4, fill: chartColors.plan, stroke: chartColors.surface, strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
