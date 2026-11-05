import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, chartColors, gridProps, barTooltipProps, tooltipProps, xAxisProps, yAxisProps } from "../../components";
import { fmtHours, fmtInt, fmtMoney, fmtPct } from "../../lib/format";
import type { ScenarioCode } from "../../lib/types";
import { tokens } from "../../styles/tokens";
import type { GoalPoint } from "./types";

const OTHER_STEP = tokens.scale.chance.stops[1];
const kDollars = (v: number) => (v === 0 ? "$0" : `$${Math.round(v / 1000)}K`);
/** Ticks from zero in a round step, at most five intervals. */
const roundTicks = (max: number) => {
  const step = [1000, 2000, 2500, 5000, 10_000, 20_000, 25_000, 50_000].find((s) => max / s <= 5) ?? 100_000;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
};
const goalLabel = (g: number) => `${(g * 100).toFixed(g * 100 === Math.round(g * 100) ? 0 : 1)}%`;

function PointTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: GoalPoint }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const rows: [string, string][] = [
    ["Labor cost", fmtMoney(p.cost)],
    ["Expected service", fmtPct(p.expected_met)],
    ["Hours", fmtHours(p.hours)],
    ["Blocks below this goal", fmtInt(p.below_goal)],
  ];
  return (
    <div className="min-w-[220px] rounded-control bg-navy px-3 py-2.5 text-sm text-navy-ink shadow-raised">
      <div className="mb-1.5 font-semibold">
        {goalLabel(p.goal)} goal{p.selected ? ", submitted" : ""}
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-6">
          <span className="text-navy-ink-muted">{k}</span>
          <span className="tnum font-medium">{v}</span>
        </div>
      ))}
      {p.cost_per_point != null && (
        <div className="mt-2 border-t border-navy-border pt-1.5 text-navy-ink-muted">{fmtMoney(p.cost_per_point)} per extra point of service against the goal before it</div>
      )}
    </div>
  );
}

/** Cost and expected service at each service goal, with the submitted 95% marked, and what each extra point costs. */
export function TradeoffCard({ points, scenario, warehouseNote }: { points: GoalPoint[]; scenario: ScenarioCode; warehouseNote: string | null }) {
  const sel = points.find((p) => p.selected);
  const steps = points.filter((p) => p.cost_per_point != null).map((p) => ({ ...p, step: `to ${goalLabel(p.goal)}` }));
  const costs = points.map((p) => p.cost);
  const mets = points.map((p) => p.expected_met);
  // Nice round ticks: $10K steps on cost, 2-point steps on service.
  const xStep = 10_000;
  const xLo = Math.floor((Math.min(...costs) - 2_000) / xStep) * xStep;
  const xHi = Math.ceil((Math.max(...costs) + 2_000) / xStep) * xStep;
  const xTicks = Array.from({ length: Math.round((xHi - xLo) / xStep) + 1 }, (_, i) => xLo + i * xStep);
  const yLo = Math.floor(Math.min(...mets) * 50 - 0.25) / 50;
  const yHi = Math.min(1, Math.ceil(Math.max(...mets) * 50 + 0.25) / 50);
  const yTicks = Array.from({ length: Math.round((yHi - yLo) * 50) + 1 }, (_, i) => Math.round((yLo + i * 0.02) * 1000) / 1000);
  const stepTicks = roundTicks(Math.max(...steps.map((s) => s.cost_per_point ?? 0)));
  const first = steps[0];
  const last = steps[steps.length - 1];

  return (
    <Card
      title="The service-goal trade-off"
      description={`${scenario}: what each service goal costs and the expected service it buys. Each point is a full replan at that goal.`}
      actions={warehouseNote ? <Badge tone="neutral">{warehouseNote}</Badge> : undefined}
      footer={
        first && last
          ? `Each extra point costs more than the last: ${fmtMoney(first.cost_per_point)} a point going to ${goalLabel(first.goal)}, ${fmtMoney(last.cost_per_point)} going to ${goalLabel(last.goal)}. Blocks below the goal rise with the goal, because a higher goal is harder to reach.`
          : undefined
      }
    >
      <div className="grid gap-6 min-[1280px]:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-ink-subtle">Expected service against labor cost</p>
          <ResponsiveContainer width="100%" height={286}>
            <LineChart data={points} margin={{ top: 24, right: 28, bottom: 4, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" dataKey="cost" {...xAxisProps} domain={[xLo, xHi]} ticks={xTicks} tickFormatter={kDollars} />
              <YAxis {...yAxisProps} width={56} domain={[yLo, yHi]} ticks={yTicks} tickFormatter={(v: number) => fmtPct(v, 0)} />
              {sel && <ReferenceLine x={sel.cost} stroke={tokens.color.accent_line} strokeWidth={1} />}
              <RTooltip {...tooltipProps} content={(p) => <PointTooltip active={p.active} payload={p.payload as never} />} />
              <Line
                dataKey="expected_met"
                type="linear"
                stroke={chartColors.plan}
                strokeWidth={tokens.chart.line_width_plan}
                isAnimationActive={false}
                activeDot={{ r: 6, stroke: chartColors.surface, strokeWidth: 2 }}
                dot={(d: { cx?: number; cy?: number; payload?: GoalPoint; index?: number }) => (
                  <circle key={d.index} cx={d.cx} cy={d.cy} r={d.payload?.selected ? 7 : 4} fill={chartColors.plan} stroke={chartColors.surface} strokeWidth={2} />
                )}
              >
                <LabelList
                  dataKey="goal"
                  content={(l: { x?: number | string; y?: number | string; value?: unknown; index?: number }) => {
                    const p = l.index != null ? points[l.index] : undefined;
                    if (!p || l.x == null || l.y == null) return null;
                    return (
                      <text x={Number(l.x)} y={Number(l.y) - 14} textAnchor={l.index === points.length - 1 ? "end" : "middle"} fontSize={14} fontWeight={p.selected ? 600 : 400} fill={p.selected ? tokens.color.accent_strong : tokens.color.ink_muted}>
                        {p.selected ? `${goalLabel(p.goal)} goal, submitted` : goalLabel(p.goal)}
                      </text>
                    );
                  }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-ink-subtle">Cost of each extra point of expected service</p>
          <ResponsiveContainer width="100%" height={286}>
            <BarChart data={steps} margin={{ top: 24, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="step" {...xAxisProps} />
              <YAxis {...yAxisProps} width={60} domain={[0, stepTicks[stepTicks.length - 1]]} ticks={stepTicks} tickFormatter={kDollars} />
              <RTooltip
                {...barTooltipProps}
                content={(p) => {
                  const r = p.payload?.[0]?.payload as (GoalPoint & { step: string }) | undefined;
                  if (!p.active || !r) return null;
                  return (
                    <div className="rounded-control bg-navy px-3 py-2.5 text-sm text-navy-ink shadow-raised">
                      <div className="font-semibold">Raising the goal {r.step}</div>
                      <div className="tnum mt-1">{fmtMoney(r.cost_per_point)} per point of expected service</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="cost_per_point" maxBarSize={tokens.chart.bar_max_width * 1.5} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {steps.map((s) => (
                  <Cell key={s.goal} fill={s.selected ? chartColors.plan : OTHER_STEP} />
                ))}
                <LabelList dataKey="cost_per_point" position="top" formatter={(v: unknown) => `$${(Number(v) / 1000).toFixed(1)}K`} fill={tokens.color.ink_muted} fontSize={14} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
