import { Clock, DollarSign, Gauge, Repeat, Timer } from "lucide-react";
import { useMemo } from "react";
import { ErrorPanel, HelpTip, KpiRow, KpiTile, PageHeader, Refreshing, SkeletonCard } from "../components";
import { useDiagnosis, useMeta, usePlan, useTradeoff } from "../lib/api";
import { fmtHours, fmtMoney, fmtPct, signedHours, signedMoney, signedPct, signedPts } from "../lib/format";
import { useCurrentPlan, useViewNames } from "../lib/hooks";
import { SCENARIOS, type GroupTotals, type ScenarioCode } from "../lib/types";
import { useView } from "../lib/view";
import { BelowGoalTable } from "./cost/BelowGoalTable";
import { ByDayCharts } from "./cost/ByDayCharts";
import { CalloutCard } from "./cost/CalloutCard";
import { HistoryCard } from "./cost/HistoryCard";
import { ScenarioTable } from "./cost/ScenarioTable";
import { TradeoffCard } from "./cost/TradeoffCard";
import type { DiagnosisResponse, TradeoffResponse } from "./cost/types";

/** Cost and service page (T-85): labor cost and service risk, plan against the draft. */
export default function CostServicePage() {
  const { scenario, warehouse, setScenario } = useView();
  const { warehouseName } = useViewNames();
  const { query, totals, blocks, data } = useCurrentPlan();
  const meta = useMeta().data;
  const base = usePlan("BASE");
  const peak = usePlan("PEAK");
  const disrupt = usePlan("DISRUPT");
  const tradeoff = useTradeoff<TradeoffResponse>();
  const diagnosis = useDiagnosis<DiagnosisResponse>();

  // Each scenario's totals for the warehouse in view. keepPreviousData can hand back another scenario's
  // payload for a moment, so only use a response whose scenario matches.
  const all = useMemo(() => {
    const pick = (code: ScenarioCode, d: typeof base.data): GroupTotals | undefined => (d && d.scenario === code ? d.totals[warehouse] : undefined);
    return { BASE: pick("BASE", base.data), PEAK: pick("PEAK", peak.data), DISRUPT: pick("DISRUPT", disrupt.data) } as Record<ScenarioCode, GroupTotals | undefined>;
  }, [base.data, peak.data, disrupt.data, warehouse]);
  const names = Object.fromEntries(SCENARIOS.map((c) => [c, meta?.scenarios.find((s) => s.code === c)?.name ?? c])) as Record<ScenarioCode, string>;

  const goal = data?.goal ?? meta?.defaults.goal ?? 0.95;
  const points = tradeoff.data?.goals[scenario] ?? [];
  const selected = points.find((p) => p.selected);
  const warehouseNote = warehouse === "all" ? null : "All warehouses";
  const place = warehouse === "all" ? "all warehouses" : warehouseName;

  if (query.error) {
    return (
      <>
        <PageHeader title="Cost and service" />
        <ErrorPanel error={query.error} what={`the ${scenario} plan`} onRetry={() => query.refetch()} />
      </>
    );
  }

  const plan = totals?.plan;
  const draft = totals?.draft;
  const change = totals?.change;
  const answer =
    plan && draft && change ? (
      <>
        Against the draft, the {scenario} plan spends {fmtMoney(Math.abs(change.cost ?? 0))} {(change.cost ?? 0) >= 0 ? "more" : "less"} a week ({signedPct((plan.cost - draft.cost) / draft.cost, 1)}) and takes expected service from{" "}
        {fmtPct(draft.expected_met)} to {fmtPct(plan.expected_met)}.
        {selected?.cost_per_point != null && ` ${warehouse === "all" ? "Going" : "Across all warehouses, going"} from a ${fmtPct(points[points.indexOf(selected) - 1]?.goal ?? 0, 1)} to a ${fmtPct(selected.goal, 0)} goal costs ${fmtMoney(selected.cost_per_point)} per point of service, and each point above that costs more.`}
      </>
    ) : null;

  return (
    <>
      <PageHeader
        title="Cost and service"
        answer={answer}
        actions={<HelpTip term="Expected service" label="Expected service" />}
      />

      <Refreshing active={query.isPlaceholderData}>
        <KpiRow columns={4}>
          <KpiTile
            label="Labor cost"
            icon={<DollarSign />}
            value={plan ? fmtMoney(plan.cost, true) : null}
            delta={{ value: change?.cost, format: (n) => signedMoney(n, true), goodWhen: "neutral", suffix: "vs draft" }}
            sub={plan && draft && `${fmtMoney(plan.cost)} plan, ${fmtMoney(draft.cost)} draft`}
            help="Loaded labor cost for the week: regular staff first, then cross-trained staff, then overtime, at the case's rates. The extra cost buys the service gain, so the change is shown in neutral gray rather than as a loss."
          />
          <KpiTile
            label="Expected service"
            icon={<Gauge />}
            value={plan ? fmtPct(plan.expected_met) : null}
            delta={{ value: change?.expected_met, format: (n) => signedPts(n), goodWhen: "up", suffix: "vs draft" }}
            sub={draft && `Draft ${fmtPct(draft.expected_met)}`}
            help="The average predicted chance of meeting the service target across open blocks. A prediction from our model, not a measured result."
          />
          <KpiTile
            label="Overtime"
            icon={<Timer />}
            value={plan ? fmtHours(plan.overtime_hours) : null}
            delta={{ value: change?.overtime_hours, format: signedHours, goodWhen: "neutral", suffix: "vs draft" }}
            sub={draft && `Draft ${fmtHours(draft.overtime_hours)}`}
            help="Overtime is the last source the plan uses, after regular and cross-trained staff, because it costs the most."
          />
          <KpiTile
            label="Cross-trained hours"
            icon={<Repeat />}
            value={plan ? fmtHours(plan.flex_hours) : null}
            delta={{ value: change?.flex_hours, format: signedHours, goodWhen: "neutral", suffix: "vs draft" }}
            sub={plan && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                {fmtHours(plan.hours)} in all
              </span>
            )}
            help="Hours worked by Front End and Merchandising staff in the partner department, using people the partner isn't using."
          />
        </KpiRow>

        <div className="mt-5 space-y-5">
          {tradeoff.error ? (
            <ErrorPanel error={tradeoff.error} what="the trade-off" onRetry={() => tradeoff.refetch()} />
          ) : tradeoff.data && points.length ? (
            <TradeoffCard points={points} scenario={scenario} warehouseNote={warehouseNote} />
          ) : (
            <SkeletonCard chart />
          )}

          <ScenarioTable totals={all} names={names} current={scenario} onPick={setScenario} warehouseName={place} />

          {totals ? <ByDayCharts totals={totals} goal={goal} place={`${scenario}, ${place}`} /> : <SkeletonCard chart />}

          {tradeoff.data && points.length ? (
            <div className="grid gap-5 min-[1280px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <CalloutCard allowance={tradeoff.data.callout_allowance} scenario={scenario} warehouseNote={warehouseNote} />
              {diagnosis.data ? <HistoryCard diagnosis={diagnosis.data} /> : diagnosis.error ? <ErrorPanel error={diagnosis.error} what="the history" /> : <SkeletonCard />}
            </div>
          ) : null}

          <div id="below-goal" className="scroll-mt-6">
            {data ? <BelowGoalTable blocks={blocks} goal={goal} place={place} /> : <SkeletonCard />}
          </div>
        </div>
      </Refreshing>
    </>
  );
}
