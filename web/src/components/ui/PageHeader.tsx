import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** Page title, e.g. "Overview". */
  title: string;
  /**
   * The page's answer as a sentence. Draft 3 is wordless (planning/DRAFT3.md): the sentence is read to screen
   * readers only, and the KPI tiles and the main card's title carry the answer on screen.
   */
  answer?: ReactNode | null;
  /** Compact facts beside the title: a what-if chip, "567 rows". One or two words each, never a sentence. */
  meta?: ReactNode;
  /** Right side: export buttons, toggles. */
  actions?: ReactNode;
}

/** Title and actions in one row. Scenario and warehouse already sit in the top bar, so they aren't repeated here. */
export function PageHeader({ title, answer, meta, actions }: PageHeaderProps) {
  return (
    <header className="mb-5 flex min-h-10 flex-wrap items-center justify-between gap-x-8 gap-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-page font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {meta && <div className="flex flex-wrap items-center gap-2 text-sm text-ink-subtle">{meta}</div>}
        {answer ? <p className="sr-only">{answer}</p> : null}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
