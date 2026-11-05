import { Star } from "lucide-react";
import { Badge, Card, Tooltip } from "../../components";
import { chanceTierFill, legendStops } from "../../components/schedule/boardScales";
import { cn } from "../../lib/cn";
import { fmtMoney, fmtPct, signedMoney } from "../../lib/format";
import type { ScenarioCode } from "../../lib/types";
import { metFor, type TradeoffResponse } from "./types";

/** Each plan scored in three worlds: what the callout allowance buys, and what it costs (A-03, F-51). */
export function CalloutCard({ allowance, scenario, warehouseNote }: { allowance: TradeoffResponse["callout_allowance"]; scenario: ScenarioCode; warehouseNote: string | null }) {
  const plans = allowance.plans.filter((p) => p.scenario_code === scenario);
  const rec = plans[0];
  const feOnly = plans.find((p) => /forecast error only/i.test(p.plan));
  const isDraft = (name: string) => /draft/i.test(name);

  return (
    <Card
      title="Callout allowance"
      description={`${scenario}: each plan scored three ways. ${allowance.note}${
        rec && feOnly
          ? ` Allowing for callouts costs ${fmtMoney(rec.cost - feOnly.cost)} more than allowing for forecast error alone, and keeps expected service at ${fmtPct(rec.met_both_risks)} instead of ${fmtPct(feOnly.met_both_risks)} when callouts run at historical rates.`
          : ""
      }`}
      actions={warehouseNote ? <Badge tone="neutral">{warehouseNote}</Badge> : undefined}
      padding="none"
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
                  const f = chanceTierFill(v);
                  return (
                    <td key={w.id} className="border-b border-border px-1.5 py-1.5 align-middle">
                      <Tooltip content={`${p.plan}, scored for "${w.label}": ${fmtPct(v)} expected service. ${w.text ?? ""}`}>
                        <div tabIndex={0} className="tnum flex h-9 items-center justify-center rounded-[6px] text-base font-semibold ring-1 ring-black/[0.06] ring-inset outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ background: f.fill, color: f.ink }}>
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
        {legendStops("chance").map((st) => (
          <span key={st.sample} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[3px] ring-1 ring-black/[0.06] ring-inset" style={{ background: st.fill }} />
            {st.sample}
          </span>
        ))}
      </div>
    </Card>
  );
}
