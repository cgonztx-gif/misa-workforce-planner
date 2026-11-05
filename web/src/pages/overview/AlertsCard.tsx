// What needs attention in this scenario and warehouse, each linking to the page that handles it.
import { AlertTriangle, ChevronRight, Info, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router";
import { Card, EmptyState } from "../../components";
import { cn } from "../../lib/cn";
import type { Alert } from "../../lib/types";
import { PAGES } from "../../lib/view";

const ICON = { below_goal: AlertTriangle, draft_over_capacity: Users } as Record<string, typeof AlertTriangle>;

/** Split "Sat Feb 14: 11 blocks can't ... See the Playbook." into the day, the message, and the link target's name. */
function parts(alert: Alert) {
  let text = alert.text.replace(/\s*See the [A-Z][\w ]+\.?\s*$/, "");
  let day: string | null = null;
  const m = alert.date ? /^([A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2}):\s*/.exec(text) : null;
  if (m) {
    day = m[1];
    text = text.slice(m[0].length);
  }
  return { day, text: text.charAt(0).toUpperCase() + text.slice(1) };
}

export function AlertsCard({ alerts, carry }: { alerts: Alert[]; carry: string }) {
  const worst = alerts.reduce((m, a) => Math.max(m, a.count), 0);
  return (
    <Card
      title="Alerts"
      description={alerts.length ? "Where the plan runs out of room. Each links to what to do." : undefined}
      padding="none"
      className="flex h-full flex-col"
      bodyClassName="flex-1"
    >
      {alerts.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={<ShieldCheck />} tone="good" title="Nothing needs attention">
            Every block reaches the goal and the draft fits what can be fielded.
          </EmptyState>
        </div>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {alerts.map((a, i) => {
            const { day, text } = parts(a);
            const Icon = ICON[a.kind] ?? Info;
            const page = PAGES.find((p) => p.path === a.page);
            const risk = a.level === "risk" || (a.kind === "below_goal" && a.count === worst && worst > 0);
            return (
              <li key={`${a.kind}-${a.date ?? i}`}>
                <Link
                  to={`/${page?.path ?? "playbook"}${carry}`}
                  className="group flex items-start gap-3 px-5 py-3 outline-none hover:bg-raised focus-visible:bg-accent-soft"
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full [&>svg]:size-4",
                      risk ? "bg-risk-soft text-risk-ink" : "bg-warning-soft text-warning-ink",
                    )}
                  >
                    <Icon aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold whitespace-nowrap text-ink">{day ?? (a.kind === "draft_over_capacity" ? "The draft" : "This week")}</span>
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-accent group-hover:text-accent-strong">
                        {page?.label ?? "Playbook"}
                        <ChevronRight className="size-4" aria-hidden />
                      </span>
                    </span>
                    <span className="mt-0.5 block text-base leading-snug text-ink-muted">{text}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
