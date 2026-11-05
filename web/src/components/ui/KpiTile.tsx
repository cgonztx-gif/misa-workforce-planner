import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Tooltip } from "./Tooltip";
import { Skeleton } from "./Skeleton";

export interface DeltaChipProps {
  /** The change (plan minus draft, what-if minus submitted). null shows a dash. */
  value: number | null | undefined;
  /** Formats the signed value, e.g. signedMoney, signedPts (lib/format). */
  format: (n: number) => string;
  /**
   * Which direction is good: "up" (service), "down" (cost, blocks below goal) or "neutral"
   * (hours: more isn't good or bad). Decides green/red; the sign and arrow always show.
   */
  goodWhen?: "up" | "down" | "neutral";
  /** Words after the number, e.g. "vs draft". */
  suffix?: string;
  /** Hover text. */
  tooltip?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/** A signed, colored change chip: "+$12.4K vs draft". Color is never the only signal: sign and arrow too. */
export function DeltaChip({ value, format, goodWhen = "neutral", suffix, tooltip, size = "md", className }: DeltaChipProps) {
  const zero = value == null || Math.abs(value) < 1e-9;
  const up = !zero && (value as number) > 0;
  const good = zero || goodWhen === "neutral" ? null : goodWhen === "up" ? up : !up;
  const tone =
    good === null ? "bg-raised text-ink-muted border-border" : good ? "bg-good-soft text-good-ink border-transparent" : "bg-risk-soft text-risk-ink border-transparent";
  const Icon = zero ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const chip = (
    <span
      className={cn(
        "tnum inline-flex items-center gap-1 whitespace-nowrap rounded-chip border font-medium",
        size === "sm" ? "px-1.5 py-px text-sm" : "px-2 py-0.5 text-sm",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden strokeWidth={2.25} />
      {value == null ? "–" : format(value)}
      {suffix && <span className="font-normal opacity-80">{suffix}</span>}
    </span>
  );
  return tooltip ? (
    <Tooltip content={tooltip}>
      <span tabIndex={0} className="inline-flex rounded-chip">
        {chip}
      </span>
    </Tooltip>
  ) : (
    chip
  );
}

export interface KpiTileProps {
  /** Sentence case, no colon: "Labor cost". */
  label: string;
  /** The formatted figure: "$412,880". Pass null while loading. */
  value: ReactNode | null;
  /** The change chip under the value, usually against the draft. */
  delta?: DeltaChipProps;
  /** A quiet line under the chip: "Draft $398,120". */
  sub?: ReactNode;
  /** A one-line definition under the figures: "Average chance a block meets its wait target". */
  note?: ReactNode;
  /** Hover explanation for the whole tile: what it measures and where it comes from. */
  help?: ReactNode;
  /** A lucide icon element shown beside the label. */
  icon?: ReactNode;
  /** "risk" draws a red rule on the left edge, e.g. when blocks are below the goal. */
  tone?: "default" | "risk" | "accent";
  /** Click to go somewhere (e.g. the below-goal table). Makes the tile a button. */
  onClick?: () => void;
  className?: string;
}

/**
 * A stat tile: label with a small monochrome icon square, the big value, and the change vs the draft.
 * Draft 3 (planning/DRAFT3.md, dashboard-design skill): wordless, so `sub` and `note` no longer print under the
 * number; they join `help` in the tile's tooltip. No colored edge rule: a tile reports, and only a problem tile
 * (tone "risk") warms its icon square.
 */
export function KpiTile({ label, value, delta, sub, note, help, icon, tone = "default", onClick, className }: KpiTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-ink-muted">{label}</span>
        {icon && (
          <span
            aria-hidden
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-control [&>svg]:size-4",
              tone === "risk" ? "bg-warning-soft text-warning-ink" : "bg-raised text-ink-subtle",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      {value === null ? (
        <Skeleton className="mt-2 h-8 w-32" />
      ) : (
        <div className="tnum mt-1 font-display text-kpi font-semibold leading-none tracking-[-0.02em] text-ink">{value}</div>
      )}
      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">{delta && value !== null && <DeltaChip {...delta} />}</div>
    </>
  );
  const tip =
    help || sub || note ? (
      <div className="space-y-1.5">
        {sub && <p className="tnum font-medium">{sub}</p>}
        {note && <p>{note}</p>}
        {help && <div className="text-navy-ink-muted">{help}</div>}
      </div>
    ) : null;
  const classes = cn(
    "relative min-w-0 rounded-card border border-border bg-surface px-5 py-4 text-left shadow-card",
    onClick && "cursor-pointer transition-colors hover:border-accent-line hover:bg-accent-soft/40",
    className,
  );
  const tile = onClick ? (
    <button type="button" onClick={onClick} className={cn(classes, "flex w-full flex-col justify-start")}>
      {body}
    </button>
  ) : (
    <div className={classes} tabIndex={tip ? 0 : undefined}>
      {body}
    </div>
  );
  return tip ? (
    <Tooltip content={tip} side="bottom" align="start">
      {tile}
    </Tooltip>
  ) : (
    tile
  );
}

/** A responsive row of KPI tiles: 2 columns on narrow screens, up to `columns` on wide ones. */
export function KpiRow({ children, columns = 4 }: { children: ReactNode; columns?: 3 | 4 | 5 | 6 }) {
  const cols = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-3 xl:grid-cols-5", 6: "lg:grid-cols-3 xl:grid-cols-6" }[columns];
  return <div className={cn("grid grid-cols-2 gap-4", cols)}>{children}</div>;
}
