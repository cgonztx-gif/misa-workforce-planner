import { useId } from "react";

/**
 * A 28 px sparkline over the same 7 days as the board and By day: 1.5 px line, faint fill, a dot on the last
 * point, no axes. bars = 7 micro-bars instead (Below goal has zero days, and a line between zeros zigzags).
 */
export function Spark({ values, color, fill, from = 0.15, to = 0, bars = false, quiet = false }: { values: number[]; color: string; fill: string; from?: number; to?: number; bars?: boolean; quiet?: boolean }) {
  const id = useId().replace(/:/g, "");
  const n = values.length;
  if (!n) return <div className="h-7" />;
  const max = Math.max(...values);
  const min = bars ? 0 : Math.min(...values);
  const span = max - min || 1;
  const W = 100;
  const H = 28;
  const pad = 3;

  if (bars) {
    // Unselected tiles: thinner, half-strength bars, so a grey tile's spark is no heavier than a hairline.
    const gap = quiet ? 6 : 3;
    const bw = (W - gap * (n - 1)) / n;
    return (
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 block h-7 w-full">
        {values.map((v, i) => {
          const h = max > 0 ? Math.max(1.5, ((v - min) / span) * (H - 2)) : 1.5;
          return <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={1.2} fill={v > 0 ? color : fill} opacity={v > 0 ? (quiet ? 0.5 : 0.85) : 1} />;
        })}
      </svg>
    );
  }

  const xs = values.map((_, i) => (i / (n - 1)) * W);
  const ys = values.map((v) => pad + (1 - (v - min) / span) * (H - pad * 2));
  const line = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const lastX = 100;
  const lastY = (ys[n - 1] / H) * 100;
  return (
    <div aria-hidden className="relative mt-2 h-7">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 block h-full w-full overflow-visible">
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity={from} />
            <stop offset="100%" stopColor={fill} stopOpacity={to} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#g${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="absolute size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${lastX}%`, top: `${lastY}%`, background: color }} />
    </div>
  );
}
