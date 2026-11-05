import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, ChartLegend, chartColors, gridProps, legendItems, barTooltipProps, tooltipContent, xAxisProps, yAxisProps } from "../../components";
import { fmtPct } from "../../lib/format";
import { tokens } from "../../styles/tokens";
import type { ForecastResponse } from "./types";

const GROUP_LABEL: Record<string, string> = { "Fri-Mon": "Fri to Mon", "Tue-Thu": "Tue to Thu", "Tue-Wed": "Tue and Wed" };

export interface AccuracyCardProps {
  data: ForecastResponse;
  /** Largest gap between our forecast and the benchmark on the planning week's normal days. */
  normalDayGap: number;
  /** "All warehouses" when one warehouse is in view: the backtest covers all of them. */
  warehouseNote?: string | null;
}

/** Held-out accuracy, worded as F-44 allows: it removes holiday distortion; no claim about the planning week. */
export function AccuracyCard({ data, normalDayGap, warehouseNote }: AccuracyCardProps) {
  const acc = data.accuracy;
  const rows = [
    { label: "All days", model: acc.daily_model, benchmark: acc.daily_benchmark, n: data.backtest.daily.find((r) => r.group === "All")?.rows },
    ...data.backtest.by_day_group.map((r) => ({ label: GROUP_LABEL[String(r.group)] ?? String(r.group), model: r.model, benchmark: r.benchmark, n: r.rows })),
    { label: "By block", model: acc.block_model, benchmark: acc.block_benchmark, n: data.backtest.block.find((r) => r.group === "All")?.rows },
  ];
  const max = Math.max(...rows.flatMap((r) => [r.model, r.benchmark]));
  const top = Math.ceil(max * 100) / 100;

  return (
    <Card
      title="Forecast accuracy"
      description={`Mean absolute percentage error on held-out weeks 4 to 6, each forecast from earlier weeks only. Lower is better. ${acc.text} What this doesn't show: ${acc.limit}`}
      actions={
        <>
          <ChartLegend items={[legendItems.forecast, { label: "Benchmark method", color: chartColors.benchmark }]} />
          {warehouseNote && <Badge tone="neutral">{warehouseNote}</Badge>}
        </>
      }
    >
      <div className="grid items-center gap-6 min-[1280px]:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <div className="min-w-0">
          <div className="text-sm text-ink-muted">Daily error, held-out weeks</div>
          <div className="tnum mt-1 flex items-baseline gap-2">
            <span className="font-display text-hero leading-none font-semibold tracking-[-0.02em] text-ink">{fmtPct(rows[0]?.model)}</span>
            <span className="text-lg text-ink-subtle">vs {fmtPct(rows[0]?.benchmark)}</span>
          </div>
          <div className="mt-1 text-sm text-ink-subtle">ours vs benchmark method</div>
          <div className="tnum mt-5 flex items-center gap-2 text-sm text-ink-muted">
            <Badge tone="neutral">Planning week</Badge>
            <span>
              normal days within <span className="font-semibold text-ink">{fmtPct(normalDayGap)}</span>
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <ResponsiveContainer width="100%" height={rows.length * 56 + 24}>
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barGap={tokens.chart.bar_gap} barCategoryGap="22%">
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" {...xAxisProps} domain={[0, top]} ticks={Array.from({ length: Math.round(top / 0.01) + 1 }, (_, i) => i * 0.01)} tickFormatter={(v: number) => fmtPct(v, 0)} />
              <YAxis type="category" dataKey="label" {...yAxisProps} width={104} tick={{ ...yAxisProps.tick, fill: tokens.color.ink_muted }} />
              <RTooltip
                {...barTooltipProps}
                content={tooltipContent({
                  format: (v) => fmtPct(v),
                  labelFormat: (l, row) => `${l}${row?.n ? `, ${row.n} held-out ${l === "By block" ? "blocks" : "days"}` : ""}`,
                })}
              />
              <Bar dataKey="model" name="Our forecast" fill={chartColors.plan} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                <LabelList dataKey="model" position="right" formatter={(v: unknown) => fmtPct(Number(v))} fill={tokens.color.ink} fontSize={14} fontWeight={600} />
              </Bar>
              <Bar dataKey="benchmark" name="Benchmark method" fill={chartColors.benchmark} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                <LabelList dataKey="benchmark" position="right" formatter={(v: unknown) => fmtPct(Number(v))} fill={tokens.color.ink_muted} fontSize={14} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
