import { cn } from "../../lib/cn";

/**
 * The product mark: a 3 x 3 shift board (days across, shifts down) with the planned blocks lit.
 * It echoes the Schedule board, the product's centerpiece.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  const lit = [false, true, false, true, true, false, false, true, true];
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden className={cn("shrink-0", className)}>
      <rect width="28" height="28" rx="7" fill="var(--wp-color-navy-raised)" />
      {lit.map((on, i) => {
        const x = 5 + (i % 3) * 6.5;
        const y = 5 + Math.floor(i / 3) * 6.5;
        return <rect key={i} x={x} y={y} width="5" height="5" rx="1.3" fill="var(--wp-color-navy-accent)" opacity={on ? 1 : 0.28} />;
      })}
    </svg>
  );
}

export function Wordmark({ product = "Workforce Planner" }: { product?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-title-sm font-semibold tracking-[-0.005em] text-navy-ink">{product}</span>
    </span>
  );
}
