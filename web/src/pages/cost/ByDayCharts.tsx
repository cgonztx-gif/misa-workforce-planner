import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import {
  bandProps,
  barGap,
  barProps,
  barTooltipProps,
  Card,
  CHART_HEIGHT,
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
  zeroDomain,
} from "../../components";
import { fmtMoney, fmtPct, signedMoney, signedPts } from "../../lib/format";
import type { GroupTotals } from "../../lib/types";
import { tokens } from "../../styles/tokens";

type Day = GroupTotals["by_day"][number];

const holidaySpan = (days: Day[]) => {
  const hol = days.filter((d) => d.holiday);
  return hol.length ? { x1: hol[0].day_short, x2: hol[hol.length - 1].day_short } : null;
};

/** Cost by day and expected service by day, plan against draft: two charts, never two y-axes. */
export function ByDayCharts({ totals, goal, place }: { totals: GroupTotals; goal: number; place: string }) {
  const rows = totals.by_day.map((d) => ({
    ...d,
    planCost: d.plan.cost,
    draftCost: d.draft.cost,
    planMet: d.plan.expected_met,
    draftMet: d.draft.expected_met,
  }));
  const span = holidaySpan(totals.by_day);
  const lowest = Math.min(...rows.flatMap((r) => [r.planMet ?? 1, r.draftMet ?? 1]));
  const floor = Math.max(0, Math.floor(lowest * 10) / 10);
  const ticks = Array.from({ length: Math.round((1 - floor) / 0.1) + 1 }, (_, i) => Math.round((floor + i * 0.1) * 100) / 100);
  const dayLabel = (_l: string | number | undefined, row?: Record<string, unknown>) => String(row?.day ?? _l);

  return (
    <div className="grid gap-6 min-[1280px]:grid-cols-2">
      <Card
        title="Labor cost by day"
        description={`${place}. The shaded days are the Presidents' Day window, with Valentine's Day on Sat Feb 14.`}
        actions={<ChartLegend items={[legendItems.plan, legendItems.draft]} />}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={rows} margin={chartMargin} barGap={barGap}>
            <CartesianGrid {...gridProps} />
            {span && <ReferenceArea {...bandProps} x1={span.x1} x2={span.x2} />}
            <XAxis dataKey="day_short" {...xAxisProps} />
            <YAxis {...yAxisProps} domain={zeroDomain} tickFormatter={(v: number) => (v === 0 ? "$0" : `$${Number((v / 1000).toFixed(1))}K`)} />
            <RTooltip
              {...barTooltipProps}
              content={tooltipContent({
                format: (v) => fmtMoney(v),
                labelFormat: dayLabel,
                footer: (row) => {
                  const r = row as unknown as Day | undefined;
                  if (!r) return null;
                  return `${signedMoney(r.change.cost)} against the draft${r.holiday ? `. ${r.holiday}` : ""}`;
                },
              })}
            />
            <Bar dataKey="draftCost" name="Draft" {...barProps.draft} />
            <Bar dataKey="planCost" name="Plan" {...barProps.plan} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card
        title="Expected service by day"
        description={`Average chance of meeting target over the day's open blocks. The line marks the ${fmtPct(goal, 0)} goal each block aims for.`}
        actions={<ChartLegend items={[legendItems.plan, legendItems.draft]} />}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={rows} margin={{ ...chartMargin, right: 28 }}>
            <CartesianGrid {...gridProps} />
            {span && <ReferenceArea {...bandProps} x1={span.x1} x2={span.x2} />}
            <XAxis dataKey="day_short" {...xAxisProps} padding={{ left: 24, right: 24 }} />
            <YAxis {...yAxisProps} domain={[floor, 1]} ticks={ticks} tickFormatter={(v: number) => fmtPct(v, 0)} />
            <ReferenceLine
              y={goal}
              stroke={tokens.color.ink_subtle}
              strokeWidth={1}
              label={{ value: `${fmtPct(goal, 0)} goal`, position: "insideTopRight", fill: tokens.color.ink_subtle, fontSize: 14 }}
            />
            <RTooltip
              {...tooltipProps}
              content={tooltipContent({
                format: (v) => fmtPct(v),
                labelFormat: dayLabel,
                footer: (row) => {
                  const r = row as unknown as Day | undefined;
                  if (!r) return null;
                  const below = r.plan.below_goal;
                  return `${signedPts(r.change.expected_met)} against the draft. ${below} block${below === 1 ? "" : "s"} below the goal${r.holiday ? `. ${r.holiday}` : ""}`;
                },
              })}
            />
            <Line dataKey="draftMet" name="Draft" {...lineProps.draft} type="linear" dot={{ r: 3.5, fill: chartColors.draft, stroke: chartColors.surface, strokeWidth: 2 }} />
            <Line dataKey="planMet" name="Plan" {...lineProps.plan} type="linear" dot={{ r: 4, fill: chartColors.plan, stroke: chartColors.surface, strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
