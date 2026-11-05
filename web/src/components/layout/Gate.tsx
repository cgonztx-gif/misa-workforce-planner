import { Loader2, PlugZap, TriangleAlert } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useHealth } from "../../lib/api";
import { CommandBlock, DATA_COMMANDS, START_COMMANDS } from "../ui/ErrorPanel";
import { LogoMark } from "./Logo";

/** Full-screen navy backdrop with one centered card, for the moments before the app can run. */
function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy p-6">
      <div className="w-full max-w-[560px] rounded-frame bg-surface p-8 shadow-raised">
        <div className="mb-6 flex items-center gap-2.5">
          <LogoMark size={32} />
          <span className="font-display text-title-sm font-semibold text-ink">Workforce Planner</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function useElapsed(running: boolean) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);
  return Math.max(0, Math.round((now - start) / 1000));
}

/**
 * Holds the app until /api/health says ready. Shows a "preparing" screen while the server warms up,
 * the start commands if it isn't running, and the error with fixes if preparing failed.
 * Recovers by itself: health keeps polling.
 */
export function Gate({ children }: { children: ReactNode }) {
  const health = useHealth();
  const ready = health.data?.ready === true;
  const elapsed = useElapsed(!ready);

  if (ready) return <>{children}</>;

  if (health.data?.error) {
    const missingData = /data|zip|csv|no such file|not found|extract/i.test(health.data.error);
    return (
      <Screen>
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-1 size-5 shrink-0 text-risk" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-title font-semibold text-ink">The server couldn't prepare the scenarios</h1>
            <p className="mt-2 font-mono text-sm break-words text-risk-ink">{health.data.error}</p>
          </div>
        </div>
        {missingData && (
          <div className="mt-5">
            <p className="mb-2 text-base text-ink-muted">If the case data isn't extracted yet, run these in the project folder:</p>
            <CommandBlock commands={DATA_COMMANDS} />
          </div>
        )}
        <div className="mt-5">
          <p className="mb-2 text-base text-ink-muted">Then stop the server (Ctrl+C) and start it again:</p>
          <CommandBlock commands={START_COMMANDS} />
        </div>
      </Screen>
    );
  }

  if (health.error) {
    return (
      <Screen>
        <div className="flex items-start gap-3">
          <PlugZap className="mt-1 size-5 shrink-0 text-ink-subtle" aria-hidden />
          <div>
            <h1 className="text-title font-semibold text-ink">Start the planner's server</h1>
            <p className="mt-2 text-base leading-relaxed text-ink-muted">
              The page is open, but the server that runs the plan isn't responding. Run this in a terminal, in the project folder:
            </p>
          </div>
        </div>
        <div className="mt-5">
          <CommandBlock commands={START_COMMANDS} />
        </div>
        <p className="mt-5 flex items-center gap-2 text-sm text-ink-subtle">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Checking again every 2 seconds. This page continues by itself once the server is up.
        </p>
      </Screen>
    );
  }

  return (
    <Screen>
      <div role="status" aria-live="polite">
        <h1 className="text-title font-semibold text-ink">Preparing the three scenarios</h1>
        <p className="mt-2 text-base leading-relaxed text-ink-muted">
          Forecasting demand, fitting the service curves and searching every block for BASE, PEAK and DISRUPT. This happens once, when the server starts, and takes 10 to 20 seconds.
        </p>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-accent-soft">
          <div className="wp-progress-bar h-full w-2/5 rounded-full bg-accent" />
        </div>
        <p className="tnum mt-3 text-sm text-ink-subtle">{health.isLoading ? "Connecting to the server" : `${health.data?.step && health.data.step !== "Ready" ? health.data.step : "Working"}, ${Math.round(health.data?.elapsed ?? elapsed)} s`}</p>
      </div>
    </Screen>
  );
}
