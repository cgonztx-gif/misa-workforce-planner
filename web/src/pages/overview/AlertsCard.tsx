// What needs attention in this scenario and warehouse: a compact day-by-day count of blocks that can't
// reach the goal, plus the draft's over-capacity warning, each linking to the page that handles it.
import { AlertTriangle, ChevronRight, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router";
import { Card, EmptyState } from "../../components";
import { cn } from "../../lib/cn";
import { fmtPct, plural } from "../../lib/format";
import type { Alert } from "../../lib/types";
import { PAGES } from "../../lib/view";

/** "Sat Feb 14: 11 blocks can't ..." -> "Sat Feb 14". */
const dayOf = (a: Alert) => /^([A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2}):/.exec(a.text)?.[1] ?? a.date ?? "This week";
/** The message without its trailing "See the Playbook." */
const message = (a: Alert) => a.text.replace(/\s*See the [A-Z][\w ]+\.?\s*$/, "");

export function AlertsCard({ alerts, carry, goal = 0.95 }: { alerts: Alert[]; carry: string; goal?: number }) {
  const days = alerts.filter((a) => a.kind === "below_goal");
  const others = alerts.filter((a) => a.kind !== "below_goal");
  const worst = days.reduce((m, a) => Math.max(m, a.count), 0);
  const total = days.reduce((s, a) => s + a.count, 0);
  const link = (a: Alert) => `/${PAGES.find((p) => p.path === a.page)?.path ?? "playbook"}${carry}`;

  return (
    <Card
      title="Alerts"
      description={
        alerts.length
          ? `Days with blocks that can't reach the ${fmtPct(goal, 0)} goal even with all their own staff and overtime. Red marks the worst day; amber the others.`
          : undefined
      }
      padding="none"
      className="flex h-full flex-col"
      bodyClassName="flex flex-1 flex-col"
    >
      {alerts.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={<ShieldCheck />} tone="good" title="Nothing needs attention">
            Every block reaches the goal and the draft fits what can be fielded.
          </EmptyState>
        </div>
      ) : (
        <>
          {days.length > 0 && (
            <ul className="border-t border-border" aria-label="Blocks below the goal, by day">
              {days.map((a) => {
                const risk = a.level === "risk" || a.count === worst;
                return (
                  <li key={a.date ?? a.text} className="border-b border-border last:border-b-0">
                    <Link
                      to={link(a)}
                      title={message(a)}
                      className="group grid grid-cols-[20px_88px_minmax(0,1fr)_auto_16px] items-center gap-3 px-5 py-2.5 outline-none hover:bg-raised focus-visible:bg-accent-soft"
                    >
                      <AlertTriangle className={cn("size-4", risk ? "text-risk" : "text-warning")} aria-label={risk ? "Worst day" : "Below the goal"} />
                      <span className="font-semibold whitespace-nowrap text-ink">{dayOf(a)}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-raised" aria-hidden>
                        <span className={cn("block h-full rounded-full", risk ? "bg-risk" : "bg-warning")} style={{ width: `${(a.count / Math.max(worst, 1)) * 100}%` }} />
                      </span>
                      <span className="tnum text-right text-base whitespace-nowrap text-ink-muted">
                        <span className="font-semibold text-ink">{a.count}</span> {a.count === 1 ? "block" : "blocks"}
                      </span>
                      <ChevronRight className="size-4 text-ink-subtle group-hover:text-accent" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {others.map((a) => (
            <Link
              key={`${a.kind}-${a.date ?? ""}`}
              to={link(a)}
              className="group flex items-start gap-3 border-t border-border px-5 py-3 outline-none hover:bg-raised focus-visible:bg-accent-soft"
            >
              <Users className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span className="min-w-0 flex-1 text-base leading-snug text-ink-muted">{message(a)}</span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-subtle group-hover:text-accent" aria-hidden />
            </Link>
          ))}
          {days.length > 0 && (
            <p className="mt-auto border-t border-border bg-raised px-5 py-3 text-sm text-ink-muted">
              {plural(total, "block")} in all. Moving hours can't fix them; they need more people available.{" "}
              <Link to={`/playbook${carry}`} className="font-medium text-accent hover:text-accent-strong">
                See the Playbook
              </Link>
            </p>
          )}
        </>
      )}
    </Card>
  );
}
