import { AlertOctagon, Check, Copy, PlugZap, RotateCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ApiError } from "../../lib/api";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

/** The commands that start the server, from the project folder. */
export const START_COMMANDS = ["cd \"C:\\MISA Case\"", "python -m server"];
/** The commands that extract the case data when data/ is missing. */
export const DATA_COMMANDS = [
  "python -m zipfile -e MISA.zip .",
  "python -m zipfile -e \"MISA/Student Teams/Costco_Case_Competition_TEAMS.zip\" data",
];

/** A copyable block of shell commands. */
export function CommandBlock({ commands, tone = "light" }: { commands: string[]; tone?: "light" | "navy" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(commands.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };
  return (
    <div className={cn("group relative rounded-control border font-mono text-sm leading-6", tone === "navy" ? "border-navy-border bg-navy-raised text-navy-ink" : "border-border bg-raised text-ink")}>
      <pre className="overflow-x-auto px-4 py-3 pr-12 select-all">{commands.map((c) => `> ${c}`).join("\n")}</pre>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy commands"
        className={cn("absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-chip", tone === "navy" ? "text-navy-ink-muted hover:bg-navy-border" : "text-ink-subtle hover:bg-surface hover:text-ink")}
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

export interface ErrorPanelProps {
  /** Any error; ApiError kinds get specific wording and the fix. */
  error: unknown;
  /** What was being loaded, e.g. "the BASE plan". */
  what?: string;
  /** Shows a "Try again" button. */
  onRetry?: () => void;
  className?: string;
  children?: ReactNode;
}

/** An in-page error: what happened, and the commands that fix it. Never a blank screen. */
export function ErrorPanel({ error, what, onRetry, className, children }: ErrorPanelProps) {
  const api = error instanceof ApiError ? error : null;
  const offline = api?.kind === "offline";
  const title = offline
    ? "The planner's server isn't running"
    : api?.kind === "not_ready"
      ? "The server is still preparing the scenarios"
      : `Couldn't load ${what ?? "this view"}`;
  const text = offline
    ? "Start it from the project folder, then this page reconnects by itself."
    : api?.kind === "http" && api.status === 422
      ? "The server rejected these settings."
      : api
        ? `The server answered${api.status ? ` ${api.status}` : ""} for ${api.path}.`
        : (error as Error)?.message || "Something went wrong while drawing this view.";
  return (
    <div role="alert" className={cn("rounded-card border border-risk/30 bg-risk-soft/60 p-5", className)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-risk-soft text-risk-ink">
          {offline ? <PlugZap className="size-4" aria-hidden /> : <AlertOctagon className="size-4" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-title-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 text-base text-ink-muted">{text}</p>
          {api?.detail && !offline && <p className="mt-2 rounded-chip bg-surface/70 px-3 py-2 font-mono text-sm break-words text-ink-muted">{api.detail}</p>}
          {offline && (
            <div className="mt-3 max-w-xl">
              <CommandBlock commands={START_COMMANDS} />
            </div>
          )}
          {children}
          {onRetry && (
            <Button className="mt-4" size="sm" icon={<RotateCw />} onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
