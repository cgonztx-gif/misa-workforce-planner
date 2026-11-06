import { Area, Bar, CartesianGrid, ComposedChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useBase } from "../lib/base";
import { chanceText, goalText, int, intCompact, pts, signed, signedUsd, usd, usdCompact } from "../lib/format";
import { niceTicks } from "../lib/ticks";
import type { GroupTotals, Meta, Summary } from "../lib/types";
import type { Lens } from "../lib/url";

type Row = { label: string; date: string; long: string; plan: number; draft: number };

const SPEC: Record<Lens, { title: string; pick: (s: Summary) => number; low: boolean; fmt: (n: number) => string; axis: (n: number) => string; color: string; fill: number; name: string }> = {
  service: { title: "Lowest day", pick: (s) => s.expected_met ?? 0, low: true, fmt: (n) => chanceText(n), axis: (n) => `${Math.round(n * 100)}%`, color: "var(--color-good)", fill: 0.2, name: "Expected service" },
  below: { title: "Worst day", pick: (s) => s.below_goal, low: false, fmt: int, axis: intCompact, color: "var(--color-bad)", fill: 0.22, name: "Blocks below goal" },
  people: { title: "Busiest day", pick: (s) => s.employees, low: false, fmt: int, axis: intCompact, color: "var(--color-ink)", fill: 0.1, name: "People" },
  cost: { title: "Costliest day", pick: (s) => s.cost, low: false, fmt: usdCompact, axis: usdCompact, color: "var(--color-ink)", fill: 0.1, name: "Labor cost" },
};

function deltaText(lens: Lens, plan: number, draft: number) {
  if (lens === "service") return pts(plan - draft);
  if (lens === "cost") return signedUsd(plan - draft);
  return signed(plan - draft);
}

function ChartTip({ active, payload, lens, compare }: { active?: boolean; payload?: { payload: Row }[]; lens: Lens; compare: boolean }) {
  const B = useBase();
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const s = SPEC[lens];
  const exact = lens === "cost" ? usd : s.fmt;
  return (
    <div className="pointer-events-none max-w-[320px] rounded-[10px] bg-tip px-3 py-2 text-[12px] leading-[1.45] text-white shadow-[var(--shadow-pop)] tnum">
      <div className="tip-title">{exact(r.plan)}</div>
      <div className="tip-muted">{r.long}</div>
      {compare && (
        <div className="tip-muted">
          {B.Word} {exact(r.draft)} · {deltaText(lens, r.plan, r.draft)}
        </div>
      )}
    </div>
  );
}

/** By day (components.md main chart): the selected tile's metric over the board's 7 days; the title is the takeaway. The draft is
 * always drawn as the grey "period before" line (as the tiles always show their Draft sub-line), so the gain reads on
 * the honest 0-100% axis; Compare with draft adds the draft to the board and the detail. */
export function DayChart({ T, meta, lens, focusDay, onDay, goal = 0.95 }: { T: GroupTotals; meta: Meta; lens: Lens; compare?: boolean; focusDay: string | null; onDay: (date: string) => void; goal?: number }) {
  const B = useBase();
  const s = SPEC[lens];
  const rows: Row[] = T.by_day.map((d) => {
    return {
      label: d.day_short,
      date: d.date,
      long: [d.day, d.holiday].filter(Boolean).join(" · "),
      plan: s.pick(d.plan),
      draft: s.pick(d.draft),
    };
  });
  const key = [...rows].sort((a, b) => (s.low ? a.plan - b.plan : b.plan - a.plan))[0];
  const hi = [...rows].sort((a, b) => (s.low ? b.plan - a.plan : a.plan - b.plan))[0];
  const max = Math.max(...rows.map((r) => Math.max(r.plan, r.draft)));
  const ticks = lens === "service" ? [0, 0.25, 0.5, 0.75, 1] : niceTicks(max, 4);
  const top = ticks[ticks.length - 1];
  const hw = meta.days.filter((d) => d.holiday_window);
  const hwFrom = T.by_day.find((d) => d.date === hw[0]?.date)?.day_short;
  const hwTo = T.by_day.find((d) => d.date === hw[hw.length - 1]?.date)?.day_short;
  const gid = `byday-${lens}`;
  const aria = `${s.name} by day, plan: ${s.low ? "lowest" : "highest"} ${key.label} ${s.fmt(key.plan)}, ${s.low ? "highest" : "lowest"} ${hi.label} ${s.fmt(hi.plan)}`;

  return (
    <div className="flex h-full min-h-0 flex-col" data-chart="byday" data-lens={lens} data-series={rows.map((r) => r.plan).join(",")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12.5px] text-muted">{s.title}</div>
          <div className="mt-0.5 truncate text-[20px] leading-tight font-semibold tracking-[-.02em] tnum" data-tip={key.long}>
            {key.label} · {s.fmt(key.plan)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-1 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-[2px] w-3 rounded-full" style={{ background: s.color }} />
            {B.Plan}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-[2px] w-3 rounded-full bg-series-grey" />
            {B.Word}
          </span>
        </div>
      </div>
      <div className="mt-3 min-h-[380px] flex-1 touch-pan-y max-sm:min-h-[260px] min-[160rem]:min-h-[460px]" role="group" aria-label={aria} data-plot>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 6, right: 4, bottom: 0, left: 0 }}
            onClick={(st) => {
              const i = Number(st?.activeTooltipIndex);
              if (Number.isFinite(i) && rows[i]) onDay(rows[i].date);
            }}
            barGap={3}
            barCategoryGap="28%"
          >
            <defs>
              {/* The showcase's fills: a soft gradient under the plan (green for Service; ink for People and Labor cost,
                  which are magnitudes, not good or bad), a fainter grey one under the draft. */}
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={s.fill} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={`${gid}-draft`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-series-grey)" stopOpacity={0.14} />
                <stop offset="100%" stopColor="var(--color-series-grey)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            {hwFrom && hwTo && (
              <ReferenceArea x1={hwFrom} x2={hwTo} fill="var(--color-soft)" fillOpacity={0.6} stroke="none" ifOverflow="extendDomain" shape={lens === "below" ? undefined : (pr: unknown) => <DayBand {...(pr as BandProps)} days={hw.length} />} />
            )}
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11.5, fill: "var(--color-muted)" }} tickMargin={8} padding={lens === "below" ? undefined : { left: 18, right: 18 }} />
            <YAxis
              domain={[0, top]}
              ticks={ticks}
              tickFormatter={s.axis}
              tickLine={false}
              axisLine={false}
              width={lens === "cost" ? 44 : 38}
              tick={{ fontSize: 11.5, fill: "var(--color-muted)" }}
            />
            {lens === "service" && (
              <ReferenceLine y={goal} stroke="var(--color-ink)" strokeOpacity={0.4} strokeDasharray="3 3" label={{ value: `Goal ${goalText(goal)}`, position: "insideTopLeft", fontSize: 11, fill: "var(--color-muted)", dy: 2, dx: 2 }} />
            )}
            {focusDay && <ReferenceLine x={rows.find((r) => r.date === focusDay)?.label} stroke="var(--color-accent)" strokeOpacity={0.5} />}
            <Tooltip
              cursor={lens === "below" ? { fill: "var(--color-soft)", opacity: 0.8 } : { stroke: "var(--color-line-strong)", strokeWidth: 1 }}
              content={<ChartTip lens={lens} compare />}
              isAnimationActive={false}
              wrapperStyle={{ outline: "none", zIndex: 5 }}
            />
            {lens === "below" ? (
              <>
                <Bar dataKey="draft" fill="var(--color-series-grey)" fillOpacity={0.45} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="plan" fill="var(--color-bad)" fillOpacity={0.22} radius={[6, 6, 0, 0]} isAnimationActive={false} shape={CapBar} />
              </>
            ) : (
              <>
                <Area type="monotoneX" dataKey="draft" stroke="var(--color-series-grey)" strokeWidth={1.5} fill={`url(#${gid}-draft)`} dot={false} activeDot={{ r: 3, fill: "var(--color-series-grey)", strokeWidth: 0 }} isAnimationActive={false} />
                <Area type="monotoneX" dataKey="plan" stroke={s.color} strokeWidth={2} fill={`url(#${gid})`} dot={false} activeDot={{ r: 4, fill: s.color, stroke: "var(--color-card)", strokeWidth: 2 }} isAnimationActive={false} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type BandProps = { x: number; y: number; width: number; height: number };

/**
 * The holiday band on the line lenses. Lines put each day on a point, so a band from the Fri point to the Mon point
 * would cut Fri and Mon in half; widen it by half a day on each side so it covers the four days, as on the board.
 */
function DayBand({ x, y, width, height, days }: BandProps & { days: number }) {
  if (!(width > 0) || days < 2) return <g />;
  const half = width / (days - 1) / 2;
  return <rect x={x - half} y={y} width={width + 2 * half} height={height} rx={10} fill="var(--color-soft)" fillOpacity={0.6} />;
}

/** A pastel bar with a solid 6 px rounded cap (the showcase's bars). */
function CapBar(props: unknown) {
  const { x, y, width, height } = props as { x: number; y: number; width: number; height: number };
  if (!(height > 0)) return <g />;
  const cap = Math.min(6, height);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} fill="var(--color-bad)" fillOpacity={0.22} />
      <rect x={x} y={y} width={width} height={cap} rx={3} fill="var(--color-bad)" />
    </g>
  );
}
