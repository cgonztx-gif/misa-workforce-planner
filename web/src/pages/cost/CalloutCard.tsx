import { Star } from "lucide-react";
import { Badge, Card, chanceFill, Tooltip } from "../../components";
import { cn } from "../../lib/cn";
import { fmtMoney, fmtPct, signedMoney } from "../../lib/format";
import type { ScenarioCode } from "../../lib/types";
import { tokens } from "../../styles/tokens";
import { metFor, type TradeoffResponse } from "./types";

/** Each plan scored in three worlds: what the callout allowance buys, and what it costs (A-03, F-51). */
export function CalloutCard({ allowance, scenario, warehouseNote }: { allowance: TradeoffResponse["callout_allowance"]; scenario: ScenarioCode; warehouseNote: string | null }) {
  const plans = allowance.plans.filter((p) => p.scenario_code === scenario);
  const rec = plans[0];
  const feOnly = plans.find((p) => /forecast error only/i.test(p.plan));
  const isDraft = (name: string) => /draft/i.test(name);
  const s = tokens.scale.chance;

  return (
    <Card
      title="What the callout allowance buys"
      description={`${scenario}: each plan scored three ways. ${allowance.note}`}
      actions={warehouseNote ? <Badge tone="neutral">{warehouseNote}</Badge> : undefined}
      padding="none"
      footer={
        rec && feOnly ? (
          <span>
            Allowing for callouts costs <span className="tnum font-semibold text-ink">{fmtMoney(rec.cost - feOnly.cost)}</span> more than allowing for forecast error alone, and keeps expected service at{" "}
            <span className="tnum font-semibold text-ink">{fmtPct(rec.met_both_risks)}</span> instead of <span className="tnum">{fmtPct(feOnly.met_both_risks)}</span> when callouts run at historical rates.
          </span>
        ) : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-base">
          <caption className="sr-only">Expected service of each plan under three sets of conditions</caption>
          <colgroup>
            <col style={{ width: "36%" }} />
            <col style={{ width: "16%" }} />
            {allowance.worlds.map((w) => (
              <col key={w.id} style={{ width: `${48 / allowance.worlds.length}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="border-y border-border bg-raised py-2.5 pr-3 pl-5 text-left text-sm font-medium text-ink-subtle">
                Plan
              </th>
              <th scope="col" className="border-y border-border bg-raised px-3 py-2.5 text-right text-sm font-medium text-ink-subtle">
                Labor cost
              </th>
              {allowance.worlds.map((w) => (
                <th key={w.id} scope="col" className="border-y border-border bg-raised px-2 py-2.5 text-center align-bottom text-sm leading-snug font-medium text-ink-subtle">
                  <Tooltip content={w.text}>
                    <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">
                      {w.label}
                    </span>
                  </Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((p, i) => (
              <tr key={p.plan}>
                <th scope="row" className={cn("border-b border-border py-2.5 pr-3 pl-5 text-left align-middle font-normal", i === 0 ? "text-ink" : isDraft(p.plan) ? "text-ink-subtle" : "text-ink-muted")}>
                  <span className="flex items-center gap-2">
                    {i === 0 && <Star className="size-4 shrink-0 fill-accent text-accent" aria-label="Recommended" />}
                    <span className={cn("whitespace-nowrap", i === 0 && "font-semibold")}>{p.plan.replace(" (recommended)", "")}</span>
                    {i === 0 && <span className="sr-only">(recommended)</span>}
                  </span>
                </th>
                <td className="tnum border-b border-border px-3 py-2.5 text-right align-middle text-ink">
                  {fmtMoney(p.cost)}
                  {i > 0 && rec && <div className="text-sm text-ink-subtle">{signedMoney(p.cost - rec.cost, true)}</div>}
                </td>
                {allowance.worlds.map((w) => {
                  const v = metFor(p, w.id);
                  const f = chanceFill(v);
                  return (
                    <td key={w.id} className="border-b border-border px-1.5 py-1.5 align-middle">
                      <Tooltip content={`${p.plan}, scored for "${w.label}": ${fmtPct(v)} expected service. ${w.text ?? ""}`}>
                        <div tabIndex={0} className="tnum flex h-9 items-center justify-center rounded-[6px] text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ background: f.fill, color: f.ink }}>
                          {fmtPct(v)}
                        </div>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm text-ink-subtle">
        <span>Expected service</span>
        {s.stops.map((stop, i) => (
          <span key={stop} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[3px]" style={{ background: stop }} />
            {s.labels[i]}
          </span>
        ))}
      </div>
    </Card>
  );
}
