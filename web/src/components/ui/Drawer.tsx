import * as D from "@radix-ui/react-dialog";
import { Info, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Tooltip } from "./Tooltip";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Drawer heading, e.g. "Sat Feb 14, Front End, Midday". */
  title: ReactNode;
  /** One line under the title: warehouse, scenario. */
  description?: ReactNode;
  /** Badges beside the title (e.g. "Below goal"). */
  badges?: ReactNode;
  /** Sticky footer: actions, links. */
  footer?: ReactNode;
  /** Width in px (default 520). */
  width?: number;
  /**
   * Default true: an overlay dims the page and focus stays in the drawer. false makes it an inspector
   * panel: no overlay, the page stays clickable (e.g. pick another board cell, switch scenario), and only
   * Esc or the X closes it.
   */
  modal?: boolean;
  /** Offset from the top of the window in px, e.g. the top bar's height so its switches stay usable. Default 0. */
  top?: number;
  children: ReactNode;
}

/**
 * A right-side sheet (Radix Dialog). Esc, the X and the overlay close it; focus is trapped while open.
 * Keep `open` in the URL (useView().block) so a refresh reopens it.
 */
export function Drawer({ open, onOpenChange, title, description, badges, footer, width = 520, modal = true, top = 0, children }: DrawerProps) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <D.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <D.Portal>
        {modal && <D.Overlay className="wp-overlay fixed inset-0 z-40 bg-navy/25" />}
        <D.Content
          ref={content}
          tabIndex={-1}
          onInteractOutside={modal ? undefined : (e) => e.preventDefault()}
          // Focus the panel, not the X: Chrome counts focus set before any click (a link or a refresh) as
          // keyboard focus and would draw the ring on the X. Tab still reaches the X, and Esc closes.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            content.current?.focus({ preventScroll: true });
          }}
          style={{ width: `min(${width}px, 100vw)`, top }}
          className={cn(
            "wp-drawer fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-surface shadow-raised outline-none",
            "rounded-l-frame",
          )}
        >
          <header className="flex items-start gap-3 border-b border-border px-6 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <D.Title className="font-display text-title font-semibold leading-tight text-ink">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-sm text-ink-subtle">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">Details</D.Description>
              )}
              {badges && <div className="mt-3 flex flex-wrap gap-2">{badges}</div>}
            </div>
            <D.Close
              aria-label="Close"
              className="-mr-2 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-control text-ink-subtle hover:bg-raised hover:text-ink"
            >
              <X className="size-5" aria-hidden />
            </D.Close>
          </header>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5 text-body-lg leading-relaxed text-ink-muted">{children}</div>
          {footer && <footer className="border-t border-border bg-raised px-6 py-3">{footer}</footer>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** A labeled section inside a drawer: "Demand", "Staff sources". */
/**
 * A titled section of the drawer. Draft 3: `info` is the section's explanation in words, opened from an (i)
 * beside the title, so the section itself shows numbers and shapes.
 */
export function DrawerSection({ title, icon, info, children }: { title: string; icon?: ReactNode; info?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-border py-4 first:pt-0 last:border-b-0">
      <h4 className="mb-2 flex items-center gap-2 font-sans text-sm font-semibold text-ink [&>svg]:size-4 [&>svg]:text-ink-subtle">
        {icon}
        {title}
        {info && (
          <Tooltip content={info} side="left" width={360}>
            <button type="button" aria-label={`About ${title.toLowerCase()}`} className="inline-flex rounded-chip text-ink-subtle/70 hover:text-accent focus-visible:text-accent">
              <Info className="size-4" aria-hidden />
            </button>
          </Tooltip>
        )}
      </h4>
      {info && <div className="sr-only">{info}</div>}
      <div className="text-base leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}
