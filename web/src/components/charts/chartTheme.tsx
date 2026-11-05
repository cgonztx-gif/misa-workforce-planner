// Recharts styling from the tokens, so every chart in the app matches the deck and report.
// Rules (design/README.md, dataviz): plan in iris, draft solid gray, benchmark dashed gray,
// horizontal hairline grid, 14px ticks, 2px lines, bars <= 24px with a 4px rounded end,
// bar axes from zero, never two y-axes, a legend for 2+ series, navy tooltips.
//
// Usage:
//   <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
//     <LineChart data={rows} margin={chartMargin}>
//       <CartesianGrid {...gridProps} />
//       <XAxis dataKey="day_short" {...xAxisProps} />
//       <YAxis {...yAxisProps} tickFormatter={(v) => fmtInt(v)} />
//       <Tooltip {...tooltipProps} content={tooltipContent({ format: fmtInt })} />
//       <Line dataKey="draft" name="Draft" {...lineProps.draft} />
//       <Line dataKey="plan" name="Plan" {...lineProps.plan} />
//     </LineChart>
//   </ResponsiveContainer>
//   <ChartLegend items={[legendItems.plan, legendItems.draft]} />
import type { ReactNode } from "react";
import { tokens } from "../../styles/tokens";
import { SwatchLabel } from "../ui/Badge";

const c = tokens.color;
const ch = tokens.chart;

export const chartColors = {
  plan: c.plan,
  draft: c.draft,
  draftSoft: c.draft_soft,
  benchmark: c.benchmark,
  accentSoft: c.accent_soft,
  good: c.good,
  warning: c.warning,
  risk: c.risk,
  grid: ch.grid,
  axis: ch.axis,
  tick: ch.tick,
  label: ch.label,
  band: ch.band,
  bandNeutral: ch.band_neutral,
  surface: c.surface,
} as const;

/** Department colors by id (38 Front End, 92 Merchandising, 95 Pharmacy) and by name. Fixed: never by rank. */
export const DEPT_COLORS: Record<number, string> = { 38: c.dept_front_end, 92: c.dept_merchandising, 95: c.dept_pharmacy };
const DEPT_BY_NAME: Record<string, string> = { "front end": c.dept_front_end, merchandising: c.dept_merchandising, pharmacy: c.dept_pharmacy };
export const deptColor = (dept: number | string) =>
  (typeof dept === "number" ? DEPT_COLORS[dept] : DEPT_COLORS[Number(dept)] ?? DEPT_BY_NAME[String(dept).toLowerCase()]) ?? c.ink_subtle;

/** Sequential fill for a chance of meeting target (0-1), with the ink to print on it. */
export function chanceFill(chance: number | null | undefined): { fill: string; ink: string } {
  const s = tokens.scale.chance;
  if (chance == null) return { fill: c.raised, ink: c.ink_subtle };
  let i = s.breaks.findIndex((b) => chance < b);
  if (i === -1) i = s.stops.length - 1;
  return { fill: s.stops[i], ink: s.label_ink[i] };
}

/** Diverging fill for a headcount change vs the draft (clamped to -3..+3), with the ink to print on it. */
export function changeFill(change: number | null | undefined): { fill: string; ink: string } {
  const s = tokens.scale.change;
  if (change == null) return { fill: c.raised, ink: c.ink_subtle };
  const i = Math.max(-3, Math.min(3, Math.round(change))) + 3;
  return { fill: s.stops[i], ink: s.label_ink[i] };
}

/** Chart height that includes the x-axis band, so the card never scrolls. */
export const CHART_HEIGHT = 280;
export const chartMargin = { top: 8, right: 16, bottom: 4, left: 4 };

const tick = { fill: ch.tick, fontSize: ch.tick_size, fontFamily: tokens.type.family_ui };

export const gridProps = { stroke: ch.grid, strokeWidth: 1, vertical: false } as const;
export const xAxisProps = { tick, tickLine: false, axisLine: { stroke: ch.axis }, tickMargin: 8, interval: 0 as const, minTickGap: 4 };
export const yAxisProps = { tick, tickLine: false, axisLine: false, tickMargin: 6, width: 64 };
/** Bars and columns start at zero, always. */
export const zeroDomain: [number, string] = [0, "auto"];

export const lineProps = {
  plan: { type: "monotone" as const, stroke: c.plan, strokeWidth: ch.line_width_plan, dot: false, activeDot: { r: 5, stroke: c.surface, strokeWidth: 2 }, isAnimationActive: false },
  draft: { type: "monotone" as const, stroke: c.draft, strokeWidth: ch.line_width, dot: false, activeDot: { r: 4, stroke: c.surface, strokeWidth: 2 }, isAnimationActive: false },
  benchmark: {
    type: "monotone" as const,
    stroke: c.benchmark,
    strokeWidth: ch.line_width,
    strokeDasharray: (ch.benchmark_dash as readonly number[]).join(" "),
    dot: false,
    activeDot: { r: 4, stroke: c.surface, strokeWidth: 2 },
    isAnimationActive: false,
  },
  /** A department series line. */
  dept: (dept: number | string) => ({ type: "monotone" as const, stroke: deptColor(dept), strokeWidth: ch.line_width, dot: false, isAnimationActive: false }),
};

export const barProps = {
  plan: { fill: c.plan, radius: [ch.bar_radius, ch.bar_radius, 0, 0] as [number, number, number, number], maxBarSize: ch.bar_max_width, isAnimationActive: false },
  draft: { fill: c.draft, radius: [ch.bar_radius, ch.bar_radius, 0, 0] as [number, number, number, number], maxBarSize: ch.bar_max_width, isAnimationActive: false },
};
/** Space between grouped bars (the 2px surface gap). */
export const barGap = ch.bar_gap;

/** A shaded span (holiday window, Valentine's Day) for <ReferenceArea {...bandProps} x1=.. x2=.. />. */
export const bandProps = { fill: ch.band, fillOpacity: 1, strokeOpacity: 0, ifOverflow: "extendDomain" as const };

/** Props for a line/area chart's <Tooltip>: a hairline crosshair, no animation. Pair with content={tooltipContent(...)}. */
export const tooltipProps = {
  cursor: { stroke: ch.axis, strokeWidth: 1 },
  isAnimationActive: false,
  wrapperStyle: { outline: "none", zIndex: 20 },
};
/** Props for a bar/column chart's <Tooltip>: a soft band behind the hovered group, no outline. */
export const barTooltipProps = {
  ...tooltipProps,
  cursor: { fill: c.accent_soft, fillOpacity: 0.6, stroke: "none" },
};

interface TooltipEntry {
  name?: string | number;
  value?: unknown;
  color?: string;
  stroke?: string;
  fill?: string;
  dataKey?: unknown;
  payload?: Record<string, unknown>;
}
export interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
  /** Formats each value. */
  format?: (value: number, entry: TooltipEntry) => string;
  /** Formats the heading (the x value). */
  labelFormat?: (label: string | number | undefined, payload?: Record<string, unknown>) => ReactNode;
  /** An extra line at the bottom, e.g. the holiday name. */
  footer?: (payload?: Record<string, unknown>) => ReactNode;
}

/** The navy tooltip panel: heading, then one row per series with its swatch. */
export function ChartTooltip({ active, payload, label, format, labelFormat, footer }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const foot = footer?.(row);
  return (
    <div className="min-w-[180px] rounded-control bg-navy px-3 py-2.5 text-sm text-navy-ink shadow-raised">
      <div className="mb-1.5 font-semibold">{labelFormat ? labelFormat(label, row) : label}</div>
      <div className="space-y-1">
        {payload.map((entry, i) => {
          const value = typeof entry.value === "number" ? (format ? format(entry.value, entry) : String(entry.value)) : String(entry.value ?? "–");
          return (
            <div key={i} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-2 text-navy-ink-muted">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: entry.color ?? entry.stroke ?? entry.fill }} />
                {entry.name}
              </span>
              <span className="tnum font-medium">{value}</span>
            </div>
          );
        })}
      </div>
      {foot && <div className="mt-2 border-t border-navy-border pt-1.5 text-navy-ink-muted">{foot}</div>}
    </div>
  );
}

/** Build a Recharts Tooltip `content` function: <Tooltip content={tooltipContent({ format: fmtMoney })} />. */
export const tooltipContent = (opts: Omit<ChartTooltipProps, "active" | "payload" | "label">) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (props: any) => <ChartTooltip active={props.active} payload={props.payload} label={props.label} {...opts} />;

export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}
export const legendItems = {
  plan: { label: "Plan", color: c.plan },
  draft: { label: "Draft", color: c.draft },
  benchmark: { label: "Benchmark", color: c.benchmark, dashed: true },
  forecast: { label: "Our forecast", color: c.plan },
} satisfies Record<string, LegendItem>;

/** A small legend row above or below a chart. Always present for two or more series. */
export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className ?? ""}`}>
      {items.map((it) => (
        <SwatchLabel key={it.label} color={it.color} dashed={it.dashed}>
          {it.label}
        </SwatchLabel>
      ))}
    </div>
  );
}
