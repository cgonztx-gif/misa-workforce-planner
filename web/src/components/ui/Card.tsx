import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Tooltip } from "./Tooltip";

export interface CardProps {
  /** Card title (17px semibold). Carries the takeaway as a label, with `value` as its number. */
  title?: ReactNode;
  /** A big number beside the title: the card's answer ("95.6%", "+320 people"). */
  value?: ReactNode;
  /**
   * What the card shows, in words. Draft 3 keeps it off the screen (wordless): it opens from an (i) beside the
   * title, on hover or focus.
   */
  description?: ReactNode;
  /** Right side of the header: a legend, a SegmentedControl, a link. */
  actions?: ReactNode;
  /** Small text under the body: a link or a count. Never a sentence. */
  footer?: ReactNode;
  /** "md" = 20px padding (default), "none" for tables and boards that run to the edge. */
  padding?: "none" | "sm" | "md";
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
  /** Render as a section with an accessible name from the title. */
  as?: "section" | "div" | "article";
}

/** White card with a hairline border and soft radius. The basic unit of every page. */
export function Card({ title, value, description, actions, footer, padding = "md", className, bodyClassName, children, as = "section" }: CardProps) {
  const Tag = as;
  const pad = padding === "none" ? "" : padding === "sm" ? "p-4" : "p-5";
  const hasHeader = title || value || actions;
  return (
    <Tag className={cn("min-w-0 rounded-card border border-border bg-surface shadow-card", className)}>
      {hasHeader && (
        <header className={cn("flex items-start justify-between gap-4", padding === "none" ? "px-5 pt-4 pb-3" : cn(pad, "pb-0"))}>
          <div className="min-w-0">
            {title && (
              <div className="flex items-center gap-1.5">
                <h3 className="text-title-sm font-semibold text-ink">{title}</h3>
                {description && (
                  <Tooltip content={description} side="bottom" align="start" width={340}>
                    <button type="button" aria-label="About this card" className="inline-flex rounded-chip text-ink-subtle/70 hover:text-accent focus-visible:text-accent">
                      <Info className="size-4" aria-hidden />
                    </button>
                  </Tooltip>
                )}
              </div>
            )}
            {value != null && <div className="tnum mt-1 font-display text-kpi font-semibold leading-none tracking-[-0.01em] text-ink">{value}</div>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padding === "none" ? "" : pad, hasHeader && padding !== "none" && "pt-4", bodyClassName)}>{children}</div>
      {footer && <footer className="border-t border-border px-5 py-3 text-sm text-ink-subtle">{footer}</footer>}
    </Tag>
  );
}
