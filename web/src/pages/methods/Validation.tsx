import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip as RTooltip, XAxis, YAxis, ZAxis } from "recharts";
import { barProps, barTooltipProps, Card, chartColors, ChartLegend, gridProps, SegmentedControl, tooltipContent, xAxisProps, yAxisProps } from "../../components";
import { fmtInt, fmtPct, fmtRatio } from "../../lib/format";
import type { BacktestRow, CalibrationBin, ServiceLimit } from "./types";

const short = (name: string) => (name === "All departments" ? "All" : name);

/** Forecast error on held-out weeks, our forecast against the benchmark method, by department. */
export function BacktestCard({ daily, block, limit }: { daily: BacktestRow[]; block: BacktestRow[]; limit?: string }) {
  const [grain, setGrain] = useState<"daily" | "block">("daily");
  const rows = (grain === "daily" ? daily : block).map((r) => ({ ...r, name: short(r.department) }));
  const top = Math.max(...rows.map((r) => Math.max(r.model, r.benchmark)));
  const step = top > 0.08 ? 0.02 : 0.01;
  const ticks = Array.from({ length: Math.ceil(top / step) + 1 }, (_, i) => Number((i * step).toFixed(2)));
  const label = { position: "top" as const, offset: 6, fill: chartColors.label, fontSize: 14, formatter: (v: unknown) => fmtPct(Number(v)) };
  return (
    <Card
      title="Forecast error on held-out weeks"
      description={`Mean absolute percentage error. Lower is better.${limit ? ` ${limit}` : ""}`}
      actions={<SegmentedControl<"daily" | "block"> label="Error measured by" size="sm" value={grain} onChange={setGrain} options={[{ value: "daily", label: "By day" }, { value: "block", label: "By block" }]} />}
    >
      <ChartLegend className="mb-2" items={[{ label: "Our forecast", color: chartColors.plan }, { label: "Benchmark method", color: chartColors.benchmark }]} />
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={rows} margin={{ top: 24, right: 8, bottom: 4, left: 0 }} barGap={14} barCategoryGap="22%">
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="name" {...xAxisProps} />
          <YAxis {...yAxisProps} width={48} domain={[0, ticks[ticks.length - 1]]} ticks={ticks} tickFormatter={(v: number) => fmtPct(v, 0)} />
          <RTooltip {...barTooltipProps} content={tooltipContent({ format: (v) => fmtPct(v), footer: (r) => (r ? `${fmtInt(Number(r.rows))} held-out ${grain === "daily" ? "days" : "blocks"}` : null) })} />
          <Bar dataKey="model" name="Our forecast" {...barProps.plan}>
            <LabelList dataKey="model" {...label} />
          </Bar>
          <Bar dataKey="benchmark" name="Benchmark method" {...barProps.draft} fill={chartColors.benchmark}>
            <LabelList dataKey="benchmark" {...label} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** Predicted chance against the share that met target, by band, on held-out weeks. On the line = well calibrated. */
export function CalibrationCard({ bins, brier }: { bins: CalibrationBin[]; brier: { model: number; base_rate: number } }) {
  return (
    <Card
      title="Predicted vs actual"
      description={`Do predicted chances come true? Each week predicted by a curve fitted without it. Dots on the line mean a predicted chance matched what happened; bigger dots hold more blocks. Brier score ${brier.model.toFixed(3)} against ${brier.base_rate.toFixed(3)} for always predicting the average rate; lower is better.`}
    >
      <ResponsiveContainer width="100%" height={264}>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 22, left: 0 }}>
          <CartesianGrid {...gridProps} vertical />
          <XAxis type="number" dataKey="predicted" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => fmtPct(v, 0)} {...xAxisProps} interval="preserveStartEnd"
            label={{ value: "Predicted chance of meeting target", position: "insideBottom", offset: -16, fill: chartColors.tick, fontSize: 14 }} />
          <YAxis type="number" dataKey="observed" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => fmtPct(v, 0)} {...yAxisProps} width={72}
            label={{ value: "Share that met target", angle: -90, position: "insideLeft", offset: 4, dy: 70, fill: chartColors.tick, fontSize: 14 }} />
          <ZAxis type="number" dataKey="blocks" range={[50, 420]} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke={chartColors.benchmark} strokeDasharray="6 4" ifOverflow="hidden" />
          <RTooltip
            cursor={{ strokeDasharray: "3 3", stroke: chartColors.axis }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as CalibrationBin | undefined;
              if (!active || !r) return null;
              return (
                <div className="min-w-[200px] rounded-control bg-navy px-3 py-2.5 text-sm text-navy-ink shadow-raised">
                  <div className="mb-1 font-semibold">Predicted {r.bin}</div>
                  <div className="tnum">{fmtInt(r.blocks)} blocks</div>
                  <div className="tnum">Predicted {fmtPct(r.predicted)}, met target {fmtPct(r.observed)}</div>
                </div>
              );
            }}
          />
          <Scatter data={bins} fill={chartColors.plan} fillOpacity={0.85} stroke={chartColors.surface} strokeWidth={2} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** The utilization at which each warehouse and department's chance of meeting target falls to 95%, and to 50%. */
export function LimitsCard({ limits }: { limits: ServiceLimit[] }) {
  const depts = [...new Map(limits.map((l) => [l.dept_id, l.department])).entries()];
  const stores = [...new Map(limits.map((l) => [l.store_id, l.warehouse])).entries()];
  const cell = (d: number, s: number) => limits.find((l) => l.dept_id === d && l.store_id === s);
  return (
    <Card
      title="Where service falls off"
      description="Utilization at which a block's chance of meeting target falls to 95%, from the fitted curves. The second figure is where it falls to 50%. This is why the plan never aims for the edge: a block a little past its limit misses far more often."
      padding="none"
    >
      <table className="w-full border-separate border-spacing-0 text-base">
        <thead>
          <tr>
            <th scope="col" className="border-y border-border bg-raised px-5 py-2 text-left text-sm font-medium text-ink-subtle">Department</th>
            {stores.map(([id, name]) => (
              <th key={id} scope="col" className="border-y border-border bg-raised px-5 py-2 text-right text-sm font-medium text-ink-subtle">{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {depts.map(([d, name]) => (
            <tr key={d}>
              <th scope="row" className="border-b border-border px-5 py-3 text-left font-medium text-ink">{name}</th>
              {stores.map(([s]) => {
                const l = cell(d, s);
                return (
                  <td key={s} className="border-b border-border px-5 py-3 text-right tnum">
                    <span className="font-semibold text-ink">{fmtRatio(l?.u95)}</span>
                    <span className="ml-2 text-sm text-ink-subtle">{fmtRatio(l?.u50)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
