import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type Tone = "neutral" | "accent" | "good" | "warning" | "risk" | "navy" | "outline";

const TONES: Record<Tone, string> = {
  neutral: "bg-raised text-ink-muted border-border",
  accent: "bg-accent-soft text-accent-strong border-accent-line",
  good: "bg-good-soft text-good-ink border-transparent",
  warning: "bg-warning-soft text-warning-ink border-transparent",
  risk: "bg-risk-soft text-risk-ink border-transparent",
  navy: "bg-navy-raised text-navy-ink border-navy-border",
  outline: "bg-transparent text-ink-muted border-border-strong",
};

export interface BadgeProps {
  tone?: Tone;
  /** A lucide icon element. Status badges (good/warning/risk) should always have one: color is never the only signal. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}

/** A small label: status ("Below goal"), kind ("What-if"), or tag ("Holiday"). 14px, never smaller. */
export function Badge({ tone = "neutral", icon, children, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip border px-2 py-0.5 text-sm font-medium leading-5",
        TONES[tone],
        className,
      )}
    >
      {icon && <span className="-ml-0.5 inline-flex shrink-0 [&>svg]:size-3.5">{icon}</span>}
      {children}
    </span>
  );
}

/** A colored dot plus a name, for departments and series. The text stays ink; the dot carries identity. */
export function SwatchLabel({ color, children, dashed = false, className }: { color: string; children: ReactNode; dashed?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-ink-muted", className)}>
      {dashed ? (
        <svg width="18" height="4" aria-hidden className="shrink-0">
          <line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth="2" strokeDasharray="5 3" />
        </svg>
      ) : (
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
      )}
      {children}
    </span>
  );
}
