// What needs attention: blocks that can't reach the goal, counted by day, plus the draft's over-capacity
// warning. Draft 3 (dashboard-design "attention lives on the data"): a ranked list with slim bars whose
// intensity grows toward the worst day, no sentences on screen (each row's message is its tooltip), and the
// action, the Playbook, one click away in the header.
import { ChevronRight, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router";
import { Card, EmptyState, Tooltip } from "../../components";
import { cn } from "../../lib/cn";
import { fmtPct } from "../../lib/format";
import type { Alert, GroupTotals } from "../../lib/types";
import { PAGES } from "../../lib/view";

/** The message without its trailing "See the Playbook." */
const message = (a: Alert) => a.text.replace(/\s*See the [A-Z][\w ]+\.?\s*$/, "");

export function AlertsCard({ alerts, byDay, carry, goal = 0.95 }: { alerts: Alert[]; byDay: GroupTotals["by_day"]; carry: string; goal?: number }) {
  const others = alerts.filter((a) => a.kind !== "below_goal");
  const byDate = new Map(alerts.filter((a) => a.kind === "below_goal" && a.date).map((a) => [a.date as string, a]));
  // Every day of the week, so healthy days read as a quiet gray 0 and the problem days stand out.
  const days = byDay.map((d) => ({ date: d.date, day: d.day, count: d.plan.below_goal, alert: byDate.get(d.date) }));
  const worst = days.reduce((m, d) => Math.max(m, d.count), 0);
  const link = (a?: Alert) => `/${PAGES.find((p) => p.path === a?.page)?.path ?? "playbook"}${carry}`;

  return (
    <Card
      title="Below the goal, by day"
      description={`Blocks whose chance of meeting target stays under the ${fmtPct(goal, 0)} goal even with all their own regular staff and overtime. Moving hours can't fix them: they need more people available, which is what the Playbook is for.`}
      actions={
        <Link to={`/playbook${carry}`} className="inline-flex items-center gap-0.5 text-sm font-medium text-accent hover:text-accent-strong">
          Playbook <ChevronRight className="size-4" aria-hidden />
        </Link>
      }
      padding="none"
      className="flex h-full flex-col"
      bodyClassName="flex flex-1 flex-col"
    >
      {worst === 0 && others.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={<ShieldCheck />} tone="good" title="Every block reaches the goal">
            The draft also fits what each block can field.
          </EmptyState>
        </div>
      ) : (
        <ul className="border-t border-border" aria-label="Blocks below the goal, by day">
          {days.map((d) => {
            const top = d.count > 0 && d.count === worst;
            const row = (
              <span className="grid h-11 grid-cols-[96px_minmax(0,1fr)_32px_16px] items-center gap-3 px-5">
                <span className={cn("whitespace-nowrap", d.count ? "text-ink" : "text-ink-subtle", top ? "font-semibold" : "font-medium")}>{d.day}</span>
                <span className="h-2 overflow-hidden rounded-full bg-raised" aria-hidden>
                  {d.count > 0 && <span className={cn("block h-full rounded-full", top ? "bg-risk" : "bg-warning")} style={{ width: `${(d.count / Math.max(worst, 1)) * 100}%` }} />}
                </span>
                <span className={cn("tnum text-right text-lg", top ? "font-semibold text-risk-ink" : d.count ? "font-medium text-ink" : "text-ink-subtle")}>{d.count}</span>
                {d.count ? <ChevronRight className="size-4 text-ink-subtle group-hover:text-accent" aria-hidden /> : <span />}
              </span>
            );
            return (
              <li key={d.date} className="border-b border-border last:border-b-0">
                {d.count ? (
                  <Tooltip content={d.alert ? message(d.alert) : `${d.count} ${d.count === 1 ? "block" : "blocks"} below the goal`} side="left">
                    <Link to={link(d.alert)} className="group block outline-none hover:bg-raised focus-visible:bg-accent-soft">
                      {row}
                    </Link>
                  </Tooltip>
                ) : (
                  row
                )}
              </li>
            );
          })}
          {others.map((a) => (
            <li key={`${a.kind}-${a.date ?? ""}`} className="border-b border-border last:border-b-0">
              <Tooltip content={message(a)} side="left">
                <Link to={link(a)} className="group grid h-11 grid-cols-[minmax(0,1fr)_16px] items-center gap-3 px-5 outline-none hover:bg-raised focus-visible:bg-accent-soft">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
                    <Users className="size-4 shrink-0 text-warning-ink" aria-hidden />
                    <span className="truncate">Draft over capacity</span>
                    {a.count ? <span className="tnum font-semibold text-risk-ink">{a.count}</span> : null}
                  </span>
                  <ChevronRight className="size-4 text-ink-subtle group-hover:text-accent" aria-hidden />
                </Link>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
