import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** A shimmering placeholder block. Size it with className (h-*, w-*). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("wp-skeleton rounded-chip", className)} />;
}

/** A card-shaped loading placeholder with a title line and `lines` body lines (or a chart area). */
export function SkeletonCard({ lines = 3, chart = false, className }: { lines?: number; chart?: boolean; className?: string }) {
  return (
    <div aria-busy className={cn("rounded-card border border-border bg-surface p-5 shadow-card", className)}>
      <Skeleton className="h-5 w-40" />
      {chart ? (
        <Skeleton className="mt-5 h-48 w-full rounded-control" />
      ) : (
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Keeps the previous render visible at reduced opacity while new data loads (no layout jump).
 * Wrap content that refetches on a scenario switch: <Refreshing active={query.isPlaceholderData}>.
 */
export function Refreshing({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div aria-busy={active || undefined} className={cn("transition-opacity duration-150", active && "pointer-events-none opacity-55")}>
      {children}
    </div>
  );
}
