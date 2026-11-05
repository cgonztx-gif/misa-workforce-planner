import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface EmptyStateProps {
  /** A lucide icon element. */
  icon?: ReactNode;
  title: string;
  /** What this means, or what to do next. */
  children?: ReactNode;
  /** A button or link. */
  action?: ReactNode;
  /** "good" for confirmations ("Every block reaches the goal"). */
  tone?: "neutral" | "good";
  className?: string;
}

/** Shown in place of a table or chart with nothing to show. Says what it means, never just "No data". */
export function EmptyState({ icon, title, children, action, tone = "neutral", className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-card border border-dashed border-border-strong px-6 py-10 text-center", className)}>
      {icon && (
        <div
          className={cn(
            "mb-3 inline-flex size-10 items-center justify-center rounded-full [&>svg]:size-5",
            tone === "good" ? "bg-good-soft text-good-ink" : "bg-raised text-ink-subtle",
          )}
        >
          {icon}
        </div>
      )}
      <p className="text-title-sm font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-[52ch] text-base text-ink-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
