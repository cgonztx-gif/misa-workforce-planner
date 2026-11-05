import { Card, ErrorPanel, HelpTip, PageHeader, Refreshing, SkeletonCard } from "../components";
import { useMeta, usePlaybook } from "../lib/api";
import { useCurrentPlan, useViewNames } from "../lib/hooks";
import { useView } from "../lib/view";
import { DayRules, ScenarioPlays, TightestTable } from "./playbook/PlaybookParts";
import { PtoCard } from "./playbook/PtoCard";
import type { PlaybookResponse } from "./playbook/types";

/**
 * Playbook (T-87): what to do when conditions shift. Everything here is for the submitted plan.
 * The headline recommendation (limit holiday PTO) comes first, then each scenario's trigger and
 * actions, the rules for the day, and the blocks with the least cushion (linked to the Schedule).
 */
export default function PlaybookPage() {
  const query = usePlaybook<PlaybookResponse>();
  const meta = useMeta().data;
  const { setScenario } = useView();
  const { scenario, warehouse, warehouseName } = useViewNames();
  const plan = useCurrentPlan();
  const data = query.data;

  if (query.error) {
    return (
      <>
        <PageHeader title="Playbook" />
        <ErrorPanel error={query.error} what="the playbook" onRetry={() => query.refetch()} />
      </>
    );
  }

  const goal = Number(meta?.defaults.goal ?? plan.data?.goal ?? 0.95);
  const assumption = data && meta?.assumptions.find((a) => a.id === data.pto.assumption);
  const tight = data?.tightest[scenario]?.[warehouse] ?? [];
  const where = warehouse === "all" ? "all warehouses" : warehouseName;
  // What the scenario on screen leaves short where you're looking: shown on its card, so the filters visibly apply.
  const below = plan.blocks.filter((b) => b.below_goal);
  const short = below.reduce((acc, b) => acc + Math.max(0, (b.need ?? b.plan) - b.plan), 0);
  const inView = plan.data ? { where, blocks: below.length, short } : null;
  const ptoView = scenario === "BASE" && warehouse === "all" ? null : `${scenario}, ${where}`;

  return (
    <>
      <PageHeader
        title="Playbook"
        answer={data ? data.pto.headline : null}
        actions={<HelpTip term="Cushion" label="Cushion" />}
      />

      {!data ? (
        <div className="space-y-6">
          <SkeletonCard chart />
          <SkeletonCard lines={6} />
        </div>
      ) : (
        <div className="space-y-5">
          <PtoCard rows={data.pto.rows} intro={data.pto.intro} assumption={data.pto.assumption} assumptionText={assumption?.text} goal={goal} view={ptoView} />

          <section aria-labelledby="plays-title">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="plays-title" className="text-title font-semibold text-ink">
                Which plan to run
              </h2>
            </div>
            <ScenarioPlays plays={data.scenarios} current={scenario} onSwitch={setScenario} inView={inView} />
          </section>

          <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Card
              title="Least cushion"
              description={`${scenario}, ${where}: the blocks closest to a miss. Cushion is how many people a block can lose, or how much extra demand it can take, before a miss becomes the likelier outcome. Open one to see why.`}
              padding="none"
            >
              <Refreshing active={plan.query.isPlaceholderData}>
                <TightestTable rows={tight} scenario={scenario} blockByKey={plan.blockByKey} showWarehouse={warehouse === "all"} />
              </Refreshing>
            </Card>
            <DayRules rules={data.on_the_day} />
          </div>
        </div>
      )}
    </>
  );
}
