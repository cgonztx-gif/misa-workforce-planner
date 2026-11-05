import { BadgeCheck, CheckCircle2, ClipboardCheck, FlaskConical, Target, TrendingDown } from "lucide-react";
import type { ReactNode } from "react";
import { Card, ErrorPanel, KpiRow, KpiTile, PageHeader, SkeletonCard } from "../components";
import { useForecast, useMethods } from "../lib/api";
import { fmtInt, fmtPct } from "../lib/format";
import { EngineDiagram } from "./methods/EngineDiagram";
import { AssumptionsSection, DocumentsCard, NoticeBand, PerBlockCard } from "./methods/MethodsParts";
import type { ForecastAccuracy, MethodsResponse } from "./methods/types";
import { BacktestCard, CalibrationCard, LimitsCard } from "./methods/Validation";

/** Independent checks behind the numbers, each recorded as a finding with a way to reproduce it. No figures here: those are on the cards. */
const CHECKS: { text: string; ref: string }[] = [
  { text: "Rerunning the analysis rewrites every output file byte for byte.", ref: "F-66" },
  { text: "The submission passes an independent rebuild: joined on keys, closed blocks at 0, every block within capacity and at or above minimum staff.", ref: "F-67" },
  { text: "An independent brute force over every feasible staffing pair picks the same answer as the search.", ref: "F-70" },
  { text: "Costs rebuilt row by row from the README's rule, without our code, match the plan's.", ref: "F-71" },
  { text: "Every explanation quotes its own block's numbers, checked by a test on every row.", ref: "F-72" },
  { text: "The exact risk calculation agrees with a Monte Carlo simulation.", ref: "F-47" },
  { text: "Expected service agrees with history when the model is set aside.", ref: "F-65" },
];

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <div className="mb-4">
        <h2 id={id} className="text-title font-semibold text-ink">
          {title}
        </h2>
        {lead && <p className="mt-1 max-w-[90ch] text-base text-ink-muted">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Methods (T-88): how the planner works, what it assumes and how well it holds up.
 * Every figure comes from /api/methods; the benchmark caveat comes from /api/forecast (F-44's wording).
 */
export default function MethodsPage() {
  const query = useMethods<MethodsResponse>();
  const accuracy = useForecast<ForecastAccuracy>("all", 38).data?.accuracy;
  const data = query.data;

  if (query.error) {
    return (
      <>
        <PageHeader title="Methods" />
        <ErrorPanel error={query.error} what="the methods" onRetry={() => query.refetch()} />
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Methods" answer={null} />
        <div className="space-y-6">
          <SkeletonCard lines={3} />
          <SkeletonCard chart />
        </div>
      </>
    );
  }

  const all = data.forecast.backtest_daily.find((r) => r.group === "All");
  const problems = data.plan.validator_problems.length;
  const answer = all
    ? `The engine runs ${data.engine.length} steps, from the case's data to a reason for every block. On held-out normal weeks the forecast's daily error is ${fmtPct(all.model)} against the benchmark method's ${fmtPct(all.benchmark)}, and the risk model's chances track what really happened far better than one average rate (Brier score ${data.service.brier.model.toFixed(3)} against ${data.service.brier.base_rate.toFixed(3)}; lower is better).`
    : `The engine runs ${data.engine.length} steps, from the case's data to a reason for every block.`;

  return (
    <>
      <PageHeader title="Methods" answer={answer} />

      <Card title="How the engine works" description="Python on the case's CSVs, with no optimization solver. Each step feeds the next.">
        <EngineDiagram steps={data.engine} />
      </Card>

      <div className="mt-6">
        <PerBlockCard />
      </div>

      <Section id="validation" title="How well it holds up" lead="Each figure is measured on data the model didn't see, or by an independent check.">
        <KpiRow columns={4}>
          <KpiTile
            label="Forecast error, by day"
            icon={<TrendingDown />}
            tone="accent"
            value={fmtPct(all?.model)}
            sub={`Benchmark method ${fmtPct(all?.benchmark)}`}
            help={accuracy?.text ?? "Mean absolute percentage error on held-out normal weeks."}
          />
          <KpiTile
            label="Risk model Brier score"
            icon={<Target />}
            value={data.service.brier.model.toFixed(3)}
            sub={`Average rate ${data.service.brier.base_rate.toFixed(3)}`}
            help="The mean squared gap between each predicted chance and what happened, on held-out weeks. Lower is better; always predicting the average rate scores the second figure."
          />
          <KpiTile
            label="Submission check"
            icon={problems === 0 ? <ClipboardCheck /> : <FlaskConical />}
            tone={problems === 0 ? "default" : "risk"}
            value={problems === 0 ? "Passes" : fmtInt(problems)}
            sub={problems === 0 ? "No problems found in the template" : "problems in the template"}
            help={problems === 0 ? "The filled template passes the case's checks: every row, joined on keys, whole numbers, closed blocks at 0." : data.plan.validator_problems.join(" ")}
          />
          <KpiTile label="Automated tests" icon={<BadgeCheck />} value={fmtInt(data.tests.count)} sub={`In ${fmtInt(data.tests.files)} files`} help={data.tests.how} />
        </KpiRow>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <BacktestCard daily={data.forecast.backtest_daily} block={data.forecast.backtest_block} limit={accuracy?.limit} />
          <CalibrationCard bins={data.service.calibration} brier={data.service.brier} />
        </div>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
          <LimitsCard limits={data.service.limits} />
          <Card title="Independent checks" description="Each is recorded as a finding with a way to reproduce it." padding="none">
            <ul className="divide-y divide-border border-t border-border">
              {CHECKS.map((c) => (
                <li key={c.ref} className="flex items-start gap-3 px-5 py-2.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
                  <span className="min-w-0 flex-1 text-base leading-snug text-ink-muted">{c.text}</span>
                  <span className="shrink-0 font-mono text-sm text-ink-subtle">{c.ref}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      <Section id="assumptions" title="What it assumes" lead="The case requires assumptions to be identified clearly, so ours are listed apart from the case's own.">
        <AssumptionsSection assumptions={data.assumptions} />
      </Section>

      <div className="mt-10 space-y-6">
        <NoticeBand notice={data.notice} />
        <DocumentsCard documents={data.documents} />
      </div>
    </>
  );
}
