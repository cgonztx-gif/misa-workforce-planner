import { FlaskConical } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Card, ErrorPanel, PageHeader, SkeletonCard } from "../components";
import { useWhatIf } from "../lib/api";
import { fmtInt, fmtMoney, fmtPct, plural, signedInt } from "../lib/format";

const moneyWord = (n: number) => (Math.abs(n) < 0.5 ? "no change in cost" : `${fmtMoney(Math.abs(n))} ${n > 0 ? "more" : "less"}`);
import { useCurrentPlan, useViewNames } from "../lib/hooks";
import type { WhatIfParams } from "../lib/types";
import { CONDITION_KEYS, conditionPhrase, describeConditions, PHRASE_ORDER, PRESETS, useAppliedConditions, useLabMeta } from "./lab/conditions";
import { ConditionsPanel } from "./lab/ConditionsPanel";
import { ChangesTable, LabKpis } from "./lab/LabResults";
import { DeptSummary, MiniBoard, MiniBoardLegend } from "./lab/MiniBoard";
import { LabIntro, RunProgress, WhatIfFrame } from "./lab/ResultsFrame";
import type { Conditions, WhatIfResponse } from "./lab/types";

/**
 * Scenario lab (T-86). Change the conditions, run, and see the re-planned week against the submitted plan.
 * The only page that shows what-if results; they sit in a dashed frame with a What-if label.
 * The applied conditions live in the URL (#/scenario-lab?demand=0.1&callouts=1.5), so a link reruns them.
 */
export default function ScenarioLabPage() {
  const { scenario, scenarioName, warehouse, warehouseName } = useViewNames();
  const lab = useLabMeta();
  const { applied, apply, clear } = useAppliedConditions(lab?.defaults, lab?.limits);
  const submittedPlan = useCurrentPlan();

  // Settings being edited. They follow the applied run whenever it changes (Run, Reset, a link).
  const [pending, setPending] = useState<Conditions | null>(null);
  const appliedKey = applied ? CONDITION_KEYS.map((k) => applied[k]).join("|") : "none";
  useEffect(() => {
    if (lab) setPending(applied ?? lab.defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey, lab]);

  const params: WhatIfParams = { scenario };
  if (applied) {
    params.goal = applied.goal;
    params.callouts = applied.callouts;
    params.demand = applied.demand;
    if (lab?.limits?.availability) params.availability = applied.availability;
  }
  const query = useWhatIf<WhatIfResponse>(params, applied !== null);
  const running = applied !== null && query.isFetching;
  const data = applied ? query.data : undefined;

  const group = data?.vs_submitted[warehouse];
  const stores = useMemo(() => {
    const all = (lab?.warehouses ?? []).map((w) => ({ id: Number(w.id), label: w.label, size: w.size }));
    return warehouse === "all" ? all : all.filter((w) => String(w.id) === warehouse);
  }, [lab, warehouse]);
  const changes = useMemo(() => (data ? data.changes.filter((c) => warehouse === "all" || String(c.store_id) === warehouse) : []), [data, warehouse]);
  const changeByKey = useMemo(() => new Map((data?.changes ?? []).map((c) => [c.key, c])), [data]);

  const demo = PRESETS[0];
  const runDemo = () => lab && run({ ...lab.defaults, ...demo.changes });
  const reset = () => {
    clear();
    if (lab) setPending(lab.defaults);
  };

  const net = changes.reduce((sum, c) => sum + c.change, 0);
  // One definition everywhere: people added and cut, with the net, as on the "Blocks changed" tile.
  const addedPeople = changes.reduce((sum, c) => sum + Math.max(0, c.change), 0);
  const cutPeople = changes.reduce((sum, c) => sum + Math.max(0, -c.change), 0);
  const moves =
    addedPeople && cutPeople
      ? `adds ${plural(addedPeople, "person", "people")} and cuts ${fmtInt(cutPeople)} (net ${signedInt(net)})`
      : cutPeople
        ? `cuts ${plural(cutPeople, "person", "people")}`
        : `adds ${plural(addedPeople, "person", "people")}`;
  const where = warehouse === "all" ? "all warehouses" : warehouseName;

  // When a run started here finishes, bring the results to the top of the view.
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollOnRun = useRef(false);
  const done = !running && !!data && !query.isPlaceholderData;
  useEffect(() => {
    if (done && scrollOnRun.current) {
      scrollOnRun.current = false;
      // Scroll only the page's own scroller (<main>): scrollIntoView would also shift the app frame.
      const el = resultsRef.current;
      const main = el?.closest("main");
      if (el && main) {
        const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - 8;
        main.scrollTo({ top, behavior: "smooth" });
      }
    }
  }, [done]);
  const run = (next: Conditions) => {
    scrollOnRun.current = true;
    apply(next);
  };
  const fresh = data && !query.isPlaceholderData && group;
  const answer = !lab
    ? null
    : !applied
      ? "Change the conditions and the plan recalculates live. Results here are what-ifs, never the submitted plan."
      : fresh && group.submitted_rescored.unfilled > 0
        ? `With ${describeConditions(applied, lab.defaults)}, the submitted ${scenario} plan${warehouse === "all" ? "" : ` at ${warehouseName}`} schedules ${plural(group.submitted_rescored.unfilled, "person", "people")} who can't be fielded. Re-planning ${moves} across ${plural(changes.length, "block")} and takes expected service from ${fmtPct(group.submitted_rescored.expected_met)} to ${fmtPct(group.what_if.expected_met)}, at ${moneyWord(group.what_if.cost - group.submitted_rescored.cost)} than the submitted plan's fielded staff cost.`
      : fresh
        ? `With ${describeConditions(applied, lab.defaults)}, re-planning ${scenario}${warehouse === "all" ? "" : ` at ${warehouseName}`} ${moves} across ${plural(changes.length, "block")}, for ${moneyWord(group.what_if.cost - group.submitted_rescored.cost)}. Expected service is ${fmtPct(group.what_if.expected_met)}, against ${fmtPct(group.submitted_rescored.expected_met)} if the submitted plan stays as it is.`
        : query.error && !running
          ? `The what-if with ${describeConditions(applied, lab.defaults)} didn't finish. Try again, or reset to the submitted plan.`
          : `Re-planning ${scenario} with ${describeConditions(applied, lab.defaults)}.`;

  const conditionChips = applied && lab && (
    <>
      <Badge tone="outline">{scenario}</Badge>
      {PHRASE_ORDER.filter((k) => Math.abs(applied[k] - lab.defaults[k]) > 1e-9).map((k) => (
        <Badge key={k} tone="outline">
          {conditionPhrase(k, applied[k]).replace(/^./, (c) => c.toUpperCase())}
        </Badge>
      ))}
      <span className="text-sm text-ink-subtle">{where === "all warehouses" ? "All warehouses" : where}</span>
    </>
  );

  return (
    <>
      <PageHeader
        title="Scenario lab"
        answer={answer}
        meta={
          <>
            {applied ? (
              <Badge tone="accent" icon={<FlaskConical />}>
                What-if
              </Badge>
            ) : (
              <Badge>Submitted plan</Badge>
            )}
          </>
        }
      />

      {!lab || !pending ? (
        <SkeletonCard lines={4} />
      ) : !lab.limits ? (
        <ErrorPanel error={new Error("The server didn't send the what-if limits (/api/meta what_if_limits).")} what="the what-if settings" />
      ) : (
        <ConditionsPanel
          scenario={scenario}
          scenarioName={scenarioName}
          defaults={lab.defaults}
          limits={lab.limits}
          pending={pending}
          onPending={setPending}
          applied={applied}
          running={running}
          onRun={() => run(pending)}
          onReset={reset}
        />
      )}

      <div ref={resultsRef} />
      {lab && !applied && (
        <LabIntro scenario={scenario} where={where} plan={submittedPlan.totals?.plan} onDemo={runDemo} demoLabel={`Try ${describeConditions({ ...lab.defaults, ...demo.changes }, lab.defaults)}`} running={running} />
      )}

      {applied && query.error && !running && (
        <ErrorPanel className="mt-6" error={query.error} what="the what-if" onRetry={() => query.refetch()} />
      )}

      {applied && !query.error && !data && (
        <section className="mt-6 rounded-frame border-2 border-dashed border-accent-line bg-accent-soft/30 p-4">
          <RunProgress running={running} scenario={scenario} />
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <SkeletonCard key={i} lines={2} />
            ))}
          </div>
        </section>
      )}

      {applied && data && group && lab && (
        <WhatIfFrame label={data.label} conditions={conditionChips} seconds={query.isPlaceholderData ? null : data.seconds} dimmed={running}>
          <RunProgress running={running} scenario={scenario} />
          <LabKpis whatIf={group.what_if} kept={group.submitted_rescored} submitted={group.submitted} changes={changes} />
          {group.submitted_rescored.unfilled > 0 && (
            <div className="mt-3">
              <Badge
                tone="warning"
                title={`Under these conditions the submitted plan schedules ${fmtInt(group.submitted_rescored.unfilled)} people who can't be fielded. The re-planned week schedules ${fmtInt(group.what_if.unfilled)}.`}
              >
                Over capacity: {fmtInt(group.submitted_rescored.unfilled)} submitted, {fmtInt(group.what_if.unfilled)} re-planned
              </Badge>
            </div>
          )}

          <div className="mt-5 space-y-5">
            <Card
              title="Where the plan changes"
              description="People against the submitted plan, by block. Hover a block for its numbers."
              footer={stores.length > 1 ? <MiniBoardLegend /> : undefined}
            >
              {stores.length > 1 ? (
                // Two boards a row below 1700px, so cells stay about 60px wide on a 1366 projector; the
                // department summary fills the fourth slot. Three a row on wide screens.
                <div className="grid gap-x-8 gap-y-6 min-[768px]:grid-cols-2 min-[1700px]:grid-cols-3">
                  {stores.map((s) => (
                    <div key={s.id} className="min-w-0">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <h4 className="text-base font-semibold text-ink">
                          {s.label} <span className="font-normal text-ink-subtle">{s.size}</span>
                        </h4>
                        <span className="text-sm text-ink-subtle tnum">{fmtInt(changes.filter((c) => c.store_id === s.id).length)} changed</span>
                      </div>
                      <MiniBoard blocks={data.blocks.filter((b) => b.store_id === s.id)} changes={changeByKey} days={lab.days} shifts={lab.shifts} departments={lab.departments} cellHeight={32} />
                    </div>
                  ))}
                  <aside className="min-w-0 min-[1700px]:hidden">
                    <h4 className="text-base font-semibold text-ink">By department, {where}</h4>
                    <DeptSummary changes={changes} departments={lab.departments} />
                  </aside>
                </div>
              ) : (
                <div className="grid gap-8 lg:grid-cols-[minmax(0,680px)_minmax(260px,1fr)]">
                  {stores.map((s) => (
                    <MiniBoard key={s.id} blocks={data.blocks.filter((b) => b.store_id === s.id)} changes={changeByKey} days={lab.days} shifts={lab.shifts} departments={lab.departments} cellHeight={32} />
                  ))}
                  <aside className="min-w-0 space-y-5">
                    <div>
                      <h4 className="text-base font-semibold text-ink">By department</h4>
                      <DeptSummary changes={changes} departments={lab.departments} />
                    </div>
                    <MiniBoardLegend vertical />
                  </aside>
                </div>
              )}
            </Card>
            <Card title="Changes" description={`${fmtInt(changes.length)} blocks differ from the submitted plan, largest change first.`} padding="none">
              <ChangesTable rows={changes} showWarehouse={warehouse === "all"} maxHeight={460} />
            </Card>
          </div>
        </WhatIfFrame>
      )}
    </>
  );
}
