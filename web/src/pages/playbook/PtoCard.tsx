import { BookmarkCheck } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Badge, barTooltipProps, Card, chartColors, ChartLegend, DataTable, gridProps, tooltipContent, tooltipProps, Tooltip, xAxisProps, yAxisProps, type Column } from "../../components";
import { fmtInt, fmtMoney, fmtPct } from "../../lib/format";
import { tokens } from "../../styles/tokens";
import type { PtoRow } from "./types";

const OTHER = tokens.scale.chance.stops[2];
const H = 210;
const margin = { top: 22, right: 18, bottom: 0, left: 0 };
const kept = (n: number | string) => (Number(n) === 0 ? "0, as submitted" : `${n} per block`);
const xProps = { ...xAxisProps, dataKey: "kept_per_block", tickFormatter: (v: number) => String(v) };

/**
 * A direct label on the first and last point only: above the higher end, and below the lower one,
 * or beside it ("beside") when a reference line runs under it.
 */
function endLabel(format: (v: number) => string, values: number[], low: "below" | "beside" = "below") {
  const n = values.length;
  const first = values[0];
  const last = values[n - 1];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (props: any) => {
    const { x, y, value, index } = props;
    if (index !== 0 && index !== n - 1) return null;
    const other = index === 0 ? last : first;
    const above = Number(value) >= other;
    const beside = !above && low === "beside";
    const dx = beside ? (index === 0 ? 10 : -10) : 0;
    const dy = above ? -12 : beside ? 5 : 22;
    return (
      <text x={x + dx} y={y + dy} textAnchor={index === 0 ? "start" : "end"} fill={chartColors.label} fontSize={14} fontWeight={600} className="tnum">
        {format(Number(value))}
      </text>
    );
  };
}

/** Whole-number ticks from zero for a count axis: steps of 1, 2, 5, 10, ... */
function countTicks(max: number): number[] {
  const step = [1, 2, 5, 10, 20, 50, 100].find((s) => max / s <= 5) ?? 100;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

function Multiple({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-base font-semibold text-ink">{title}</span>
        {note}
      </figcaption>
      <ResponsiveContainer width="100%" height={H}>
        {children as ReactElement}
      </ResponsiveContainer>
    </figure>
  );
}

const TABLE: Column<PtoRow>[] = [
  { key: "kept", header: "Kept per block", value: (r) => r.kept_per_block, align: "left", render: (r) => <span className="font-medium text-ink">{kept(r.kept_per_block)}</span> },
  { key: "people", header: "Shifts kept", title: "Employee shifts kept from holiday PTO across the week", value: (r) => r.people_kept, align: "right" },
  { key: "below", header: "Below the goal", value: (r) => r.blocks_below_goal, align: "right" },
  { key: "pto", header: "With holiday PTO", title: "Blocks below the goal that have holiday PTO", value: (r) => r.below_goal_with_holiday_pto, align: "right" },
  { key: "met", header: "Expected service", value: (r) => r.expected_met, align: "right", render: (r) => fmtPct(r.expected_met) },
  { key: "cost", header: "Labor cost", value: (r) => r.cost, align: "right", render: (r) => fmtMoney(r.cost) },
  { key: "ot", header: "Overtime", value: (r) => r.overtime_hours, align: "right", render: (r) => `${fmtInt(r.overtime_hours)} h` },
];

/** The headline recommendation: blocks below the goal, expected service and cost against PTO kept per block. */
export function PtoCard({ rows, intro, assumption, assumptionText, goal }: { rows: PtoRow[]; intro: string; assumption: string; assumptionText?: string; goal: number }) {
  const data = rows.map((r) => ({ ...r, other: r.blocks_below_goal - r.below_goal_with_holiday_pto }));
  const ticks = countTicks(Math.max(...data.map((r) => r.blocks_below_goal)));
  const met = data.map((r) => r.expected_met);
  const lo = Math.floor(Math.min(goal, ...met) * 100 - 0.5);
  const hi = Math.ceil(Math.max(...met) * 100 + 0.3);
  const metDomain: [number, number] = [lo / 100, hi / 100];
  const metTicks = Array.from({ length: hi - lo + 1 }, (_, i) => (lo + i) / 100);
  const tip = tooltipContent({ labelFormat: (l) => `${kept(l ?? 0)}` });
  return (
    <Card
      title="Limit holiday PTO"
      description="The headline recommendation, tested in BASE by re-running the search with some holiday PTO kept back."
      actions={
        <Tooltip content={assumptionText ?? assumption} width={340}>
          <span tabIndex={0} className="inline-flex rounded-chip">
            <Badge tone="outline" icon={<BookmarkCheck />}>
              Assumption {assumption}
            </Badge>
          </span>
        </Tooltip>
      }
    >
      <p className="max-w-[110ch] text-base leading-relaxed text-ink-muted">{intro}</p>

      <div className="mt-5 grid gap-x-8 gap-y-6 lg:grid-cols-3">
        <Multiple title="Blocks below the goal" note={<ChartLegend items={[{ label: "Holiday PTO", color: chartColors.plan }, { label: "Other", color: OTHER }]} />}>
          <BarChart data={data} margin={margin} barCategoryGap="28%">
            <CartesianGrid {...gridProps} />
            <XAxis {...xProps} />
            <YAxis {...yAxisProps} width={36} domain={[0, ticks[ticks.length - 1]]} ticks={ticks} />
            <RTooltip {...barTooltipProps} content={tip} />
            <Bar dataKey="other" name="Other blocks" stackId="b" fill={OTHER} stroke={chartColors.surface} strokeWidth={2} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="below_goal_with_holiday_pto" name="With holiday PTO" stackId="b" fill={chartColors.plan} stroke={chartColors.surface} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
              <LabelList dataKey="blocks_below_goal" position="top" offset={6} fill={chartColors.label} fontSize={14} fontWeight={600} />
            </Bar>
          </BarChart>
        </Multiple>
        <Multiple title="Expected service" note={<span className="text-sm text-ink-subtle">Dashed: the {fmtPct(goal, 0)} goal</span>}>
          <LineChart data={data} margin={margin}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xProps} padding={{ left: 12, right: 12 }} />
            <YAxis {...yAxisProps} width={48} domain={metDomain} ticks={metTicks} tickFormatter={(v: number) => fmtPct(v, 0)} />
            <ReferenceLine y={goal} stroke={chartColors.benchmark} strokeDasharray="4 4" />
            <RTooltip {...tooltipProps} content={tooltipContent({ format: (v) => fmtPct(v), labelFormat: (l) => kept(l ?? 0) })} />
            <Line dataKey="expected_met" name="Expected service" type="monotone" stroke={chartColors.plan} strokeWidth={2.5} dot={{ r: 4, fill: chartColors.plan, stroke: chartColors.surface, strokeWidth: 2 }} isAnimationActive={false}>
              <LabelList dataKey="expected_met" content={endLabel((v) => fmtPct(v), met, "beside")} />
            </Line>
          </LineChart>
        </Multiple>
        <Multiple title="Labor cost for the week">
          <LineChart data={data} margin={margin}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xProps} padding={{ left: 12, right: 12 }} />
            <YAxis {...yAxisProps} width={60} domain={["auto", "auto"]} tickFormatter={(v: number) => fmtMoney(v, true)} tickCount={4} />
            <RTooltip {...tooltipProps} content={tooltipContent({ format: (v) => fmtMoney(v), labelFormat: (l) => kept(l ?? 0) })} />
            <Line dataKey="cost" name="Labor cost" type="monotone" stroke={chartColors.plan} strokeWidth={2.5} dot={{ r: 4, fill: chartColors.plan, stroke: chartColors.surface, strokeWidth: 2 }} isAnimationActive={false}>
              <LabelList dataKey="cost" content={endLabel((v) => fmtMoney(v, true), data.map((r) => r.cost))} />
            </Line>
          </LineChart>
        </Multiple>
      </div>
      <p className="mt-1 text-center text-sm text-ink-subtle">People kept from holiday PTO per block, never more than the block lost against recent weeks</p>

      <div className="mt-5 overflow-hidden rounded-control border border-border">
        <DataTable columns={TABLE} rows={rows} rowKey={(r) => String(r.kept_per_block)} dense caption="Holiday PTO what-if, by people kept per block" />
      </div>
    </Card>
  );
}
