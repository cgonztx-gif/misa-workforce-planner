import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, ChartLegend, chartColors, gridProps, lineProps, tooltipContent, tooltipProps, xAxisProps, yAxisProps } from "../../components";
import { fmtMoney, fmtPct } from "../../lib/format";
import { tokens } from "../../styles/tokens";
import type { ForecastResponse } from "./types";

const REPLANNED = tokens.scale.chance.stops[2];

export interface ValentineCardProps {
  valentine: ForecastResponse["valentine"];
  /** Feb 14 Front End and Merchandising blocks in the BASE plan, and how many are at capacity. */
  capacity: { blocks: number; atCapacity: number } | null;
}

/** A-06: Valentine's Day is a judgment. If the true uplift differs, does planning for it help? */
export function ValentineCard({ valentine, capacity }: ValentineCardProps) {
  const ours = valentine.uplift["Front End"] ?? 0;
  const rows = valentine.sensitivity.map((r) => ({ ...r, x: r.true_uplift, label: `${Math.round(r.true_uplift * 100)}%` }));
  const worst = rows[rows.length - 1];
  const lo = Math.floor(Math.min(...rows.flatMap((r) => [r.our_plan_expected_met, r.replanned_expected_met])) * 20) / 20;
  const hi = Math.ceil(Math.max(...rows.flatMap((r) => [r.our_plan_expected_met, r.replanned_expected_met])) * 20) / 20;

  return (
    <Card
      title="If Valentine's Day is bigger than we assumed"
      description={`Expected service on Sat Feb 14, Front End and Merchandising, all warehouses. We assume +${Math.round(ours * 100)}% (${valentine.assumption}).`}
      actions={<Badge tone="neutral">BASE</Badge>}
      footer={
        capacity
          ? `Replanning for a larger uplift barely helps: ${capacity.atCapacity} of the ${capacity.blocks} blocks that day are already at capacity, so there's little room to add people.`
          : undefined
      }
    >
      <ChartLegend items={[{ label: `Our plan, built for +${Math.round(ours * 100)}%`, color: chartColors.plan }, { label: "Replanned for each uplift", color: REPLANNED }]} />
      <ResponsiveContainer width="100%" height={232}>
        <LineChart data={rows} margin={{ top: 16, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis type="number" dataKey="x" {...xAxisProps} domain={[0, worst.x]} ticks={rows.map((r) => r.x)} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
          <YAxis {...yAxisProps} width={52} domain={[lo, hi]} ticks={Array.from({ length: Math.round((hi - lo) / 0.05) + 1 }, (_, i) => lo + i * 0.05)} tickFormatter={(v: number) => fmtPct(v, 0)} />
          <ReferenceLine x={ours} stroke={tokens.color.ink_subtle} strokeWidth={1} label={{ value: "Our assumption", position: "insideTopLeft", fill: tokens.color.ink_subtle, fontSize: 14, dx: 6 }} />
          <RTooltip
            {...tooltipProps}
            content={tooltipContent({
              format: (v) => fmtPct(v),
              labelFormat: (_l, row) => `True uplift ${row?.label ?? ""}`,
              footer: (row) =>
                row ? `Feb 14 cost: ours ${fmtMoney(Number(row.our_plan_feb14_cost))}, replanned ${fmtMoney(Number(row.replanned_feb14_cost))}` : null,
            })}
          />
          <Line dataKey="replanned_expected_met" name="Replanned" {...lineProps.plan} type="linear" stroke={REPLANNED} strokeWidth={2} dot={{ r: 4, fill: REPLANNED, stroke: chartColors.surface, strokeWidth: 2 }} />
          <Line dataKey="our_plan_expected_met" name="Our plan" {...lineProps.plan} type="linear" dot={{ r: 4, fill: chartColors.plan, stroke: chartColors.surface, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-sm text-ink-muted">
        At a true uplift of {worst.label}, our plan reaches <span className="tnum font-semibold text-ink">{fmtPct(worst.our_plan_expected_met)}</span> and a plan built for it{" "}
        <span className="tnum font-semibold text-ink">{fmtPct(worst.replanned_expected_met)}</span>, for{" "}
        <span className="tnum">{fmtMoney(Math.abs(worst.replanned_feb14_cost - worst.our_plan_feb14_cost))}</span> {worst.replanned_feb14_cost >= worst.our_plan_feb14_cost ? "more" : "less"} that day.
      </p>
    </Card>
  );
}
