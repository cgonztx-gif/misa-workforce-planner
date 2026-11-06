import { PlugZap, RotateCw } from "lucide-react";
import { useState } from "react";

/** The one page-level note (components.md States): what went wrong, and the fix as a button. */
export function PageNote({ title, detail, code, onRetry }: { title: string; detail?: string | null; code?: string; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(detail ?? code ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };
  return (
    <div role="alert" data-note="page" className="mb-4 flex items-start gap-4 rounded-[18px] border border-line bg-card p-5 shadow-[var(--shadow-card)]">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-down/10 text-down">
        <PlugZap size={18} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15.5px] font-semibold tracking-[-.01em]">{title}</div>
        {detail && <pre className="mt-2 max-h-40 overflow-auto rounded-[10px] bg-soft px-3 py-2 font-mono text-[12px] whitespace-pre-wrap text-ink-2">{detail}</pre>}
        {code && (
          <code className="mt-2 inline-block rounded-md bg-soft px-2 py-0.5 font-mono text-[12.5px] text-ink-2" data-tip="Double-click it in the project folder">
            {code}
          </code>
        )}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onRetry} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-medium text-on-accent hover:brightness-105">
            <RotateCw size={14} strokeWidth={1.75} />
            Retry
          </button>
          {detail && (
            <button type="button" onClick={copy} className="inline-flex h-8 items-center rounded-full border border-line bg-card px-3.5 text-[13px] text-ink-2 hover:bg-soft">
              {copied ? "Copied" : "Copy commands"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The slim bar when a later fetch fails but numbers are on screen. */
export function NoteBar({ text, onRetry, inline = false }: { text: string; onRetry: () => void; inline?: boolean }) {
  return (
    <div
      role="status"
      data-note="bar"
      className={`flex items-center gap-3 rounded-full border border-line bg-card pr-1 pl-3.5 text-[13px] text-ink-2 shadow-[var(--shadow-card)] ${inline ? "h-8 max-w-[34rem]" : "mb-3 h-10 pr-1.5 pl-4"}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-down" />
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <button type="button" onClick={onRetry} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-[12.5px] hover:bg-soft focus-visible:outline-2 focus-visible:outline-accent ${inline ? "h-6" : "h-7"}`}>
        <RotateCw size={13} strokeWidth={1.75} />
        Retry
      </button>
    </div>
  );
}
