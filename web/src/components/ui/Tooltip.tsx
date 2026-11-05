import * as RT from "@radix-ui/react-tooltip";
import * as RP from "@radix-ui/react-popover";
import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useMeta } from "../../lib/api";

/** Wrap the app once (done in main.tsx). */
export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <RT.Provider delayDuration={250} skipDelayDuration={150}>
    {children}
  </RT.Provider>
);

export interface TooltipProps {
  /** What the tooltip says. Plain text or small markup. */
  content: ReactNode;
  /** The trigger. Must be one element that can hold a ref (a button, span, etc.). */
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Max width in px (default 300). */
  width?: number;
}

/** Hover/focus tooltip in navy. Use for short explanations on tiles, chips and controls. */
export function Tooltip({ content, children, side = "top", align = "center", width = 300 }: TooltipProps) {
  if (content == null || content === "") return <>{children}</>;
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          style={{ maxWidth: width }}
          className="wp-pop z-50 rounded-control bg-navy px-3 py-2 text-sm leading-snug text-navy-ink shadow-raised"
        >
          {content}
          <RT.Arrow className="fill-navy" width={12} height={6} />
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}

export interface HelpTipProps {
  /** A glossary term from /api/meta ("Block", "Cushion"). Its definition is shown. */
  term?: string;
  /** Or your own text. Takes precedence over the glossary. */
  children?: ReactNode;
  /** Visible label next to the icon, e.g. "What's a block?". Omit for an icon-only button. */
  label?: string;
  className?: string;
}

/**
 * A (?) that explains a term. Click or focus opens it (works on touch and for keyboard users),
 * so it's a popover rather than a hover-only tooltip.
 */
export function HelpTip({ term, children, label, className }: HelpTipProps) {
  const meta = useMeta();
  const entry = term ? meta.data?.glossary.find((g) => g.term.toLowerCase() === term.toLowerCase()) : undefined;
  const body = children ?? entry?.definition ?? (term ? `${term}.` : null);
  return (
    <RP.Root>
      <RP.Trigger
        type="button"
        aria-label={label ?? (term ? `What does ${term.toLowerCase()} mean?` : "More about this")}
        className={cn(
          "inline-flex items-center gap-1 rounded-chip text-sm font-medium text-ink-subtle transition-colors hover:text-accent focus-visible:text-accent",
          className,
        )}
      >
        <HelpCircle className="size-4" aria-hidden />
        {label && <span className="underline decoration-dotted underline-offset-4">{label}</span>}
      </RP.Trigger>
      <RP.Portal>
        <RP.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="wp-pop z-50 w-[300px] rounded-control border border-border bg-surface p-4 text-sm leading-relaxed text-ink-muted shadow-raised"
        >
          {term && <p className="mb-1 font-semibold text-ink">{entry?.term ?? term}</p>}
          <div>{body}</div>
          <RP.Arrow className="fill-surface" width={12} height={6} />
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}
