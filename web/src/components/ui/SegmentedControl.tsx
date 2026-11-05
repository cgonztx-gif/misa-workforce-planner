import * as TG from "@radix-ui/react-toggle-group";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Tooltip } from "./Tooltip";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Hover text for this option (e.g. the scenario's one-line description). */
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Accessible name when the label isn't plain text. */
  ariaLabel?: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  /** Accessible name for the group, e.g. "Scenario". */
  label: string;
  /** "light" on cards and the canvas; "navy" in the top bar. */
  tone?: "light" | "navy";
  size?: "sm" | "md";
  className?: string;
}

/**
 * Pick exactly one of a few options (scenario, warehouse, board color mode). Radix ToggleGroup:
 * arrow keys move between options; one is always selected.
 */
export function SegmentedControl<T extends string>({ value, onChange, options, label, tone = "light", size = "md", className }: SegmentedControlProps<T>) {
  const navy = tone === "navy";
  return (
    <TG.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-control p-0.5",
        navy ? "bg-navy-raised ring-1 ring-navy-border" : "bg-raised ring-1 ring-border",
        className,
      )}
    >
      {options.map((opt) => {
        const item = (
          <TG.Item
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
            aria-label={opt.ariaLabel ?? (typeof opt.label === "string" ? opt.label : undefined)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[6px] font-medium transition-colors outline-none",
              size === "sm" ? "h-7 px-2.5 text-sm" : "h-8 px-3 text-sm",
              navy
                ? "text-navy-ink-muted hover:text-navy-ink focus-visible:ring-2 focus-visible:ring-navy-accent aria-checked:bg-white aria-checked:text-ink aria-checked:shadow-sm"
                : "text-ink-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-accent aria-checked:bg-surface aria-checked:text-accent-strong aria-checked:shadow-sm aria-checked:ring-1 aria-checked:ring-border",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {opt.icon && <span className="inline-flex [&>svg]:size-4">{opt.icon}</span>}
            {opt.label}
          </TG.Item>
        );
        return opt.description ? (
          <Tooltip key={opt.value} content={opt.description} side="bottom">
            {item}
          </Tooltip>
        ) : (
          item
        );
      })}
    </TG.Root>
  );
}
