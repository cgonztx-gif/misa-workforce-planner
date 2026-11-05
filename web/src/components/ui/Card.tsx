import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface CardProps {
  /** Card title (17px semibold). Omit for a bare card. */
  title?: ReactNode;
  /** One line under the title in muted ink. */
  description?: ReactNode;
  /** Right side of the header: a HelpTip, a SegmentedControl, a link. */
  actions?: ReactNode;
  /** Small text under the body: sources, notes. */
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
export function Card({ title, description, actions, footer, padding = "md", className, bodyClassName, children, as = "section" }: CardProps) {
  const Tag = as;
  const pad = padding === "none" ? "" : padding === "sm" ? "p-4" : "p-5";
  const hasHeader = title || description || actions;
  return (
    <Tag className={cn("min-w-0 rounded-card border border-border bg-surface shadow-card", className)}>
      {hasHeader && (
        <header className={cn("flex items-start justify-between gap-4", padding === "none" ? "px-5 pt-4 pb-3" : cn(pad, "pb-0"))}>
          <div className="min-w-0">
            {title && <h3 className="text-title-sm font-semibold text-ink">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-ink-subtle">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padding === "none" ? "" : pad, hasHeader && padding !== "none" && "pt-4", bodyClassName)}>{children}</div>
      {footer && <footer className="border-t border-border px-5 py-3 text-sm text-ink-subtle">{footer}</footer>}
    </Tag>
  );
}
