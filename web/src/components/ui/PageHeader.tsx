import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";

export interface PageHeaderProps {
  /** Page title, e.g. "Overview". */
  title: string;
  /** The answer first: one sentence that says what matters on this page. Pass null while loading. */
  answer?: ReactNode | null;
  /** Context under the answer: scenario and warehouse in words, a what-if label. */
  meta?: ReactNode;
  /** Right side: export buttons, toggles. */
  actions?: ReactNode;
}

/** Title, then the one-sentence answer, then (optionally) context. Every page starts with this. */
export function PageHeader({ title, answer, meta, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0 max-w-[78ch]">
        <h1 className="text-page font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {answer === null ? (
          <div className="mt-3 space-y-2" aria-hidden>
            <Skeleton className="h-5 w-[min(640px,90%)]" />
            <Skeleton className="h-5 w-[min(420px,60%)]" />
          </div>
        ) : answer ? (
          <p className="mt-2 text-lead leading-snug text-ink-muted">{answer}</p>
        ) : null}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-subtle">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
