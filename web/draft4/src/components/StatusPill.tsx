import type { Health } from "../lib/types";

export type Status = { kind: "ready" } | { kind: "preparing"; health?: Health } | { kind: "offline" } | { kind: "error" };

const pill = "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-line bg-card px-3 text-[13px] text-ink-2 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent";

export function Spinner({ className = "size-3" }: { className?: string }) {
  return <span aria-hidden className={`spin inline-block shrink-0 rounded-full border-[1.5px] border-line-strong border-t-accent ${className}`} />;
}

/** The green-dot pill of the showcase toolbar: what is on screen, and whether the server answers. */
export function StatusPill({ status }: { status: Status }) {
  if (status.kind === "error")
    return (
      <span className={pill} data-status="error" tabIndex={0} data-tip="The planner answered with an error · see the note">
        <span aria-hidden className="size-1.5 rounded-full bg-bad" />
        Error
      </span>
    );
  if (status.kind === "offline")
    return (
      <span className={pill} data-status="offline" tabIndex={0} data-tip="The planner isn't answering · start_app_draft4.bat starts it">
        <span aria-hidden className="size-1.5 rounded-full bg-bad" />
        Offline
      </span>
    );
  if (status.kind === "preparing") {
    const h = status.health;
    const step = h?.step && h.step !== "Ready" ? h.step : null;
    const secs = h?.elapsed != null ? `${Math.round(h.elapsed)} s` : null;
    return (
      <span className={pill} data-status="preparing" aria-live="polite">
        <Spinner />
        {["Preparing", step, secs].filter(Boolean).join(" · ")}
      </span>
    );
  }
  return (
    <span className={pill} data-status="ready" tabIndex={0} data-tip="Default settings · exactly the submitted file · 567 rows">
      <span aria-hidden className="size-1.5 rounded-full bg-live" />
      Submitted plan
    </span>
  );
}
