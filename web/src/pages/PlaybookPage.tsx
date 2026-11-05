import { Badge, Card, ErrorPanel, HelpTip, PageHeader, Refreshing, SkeletonCard } from "../components";
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
  const { scenario, scenarioName, warehouse, warehouseName } = useViewNames();
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

  return (
    <>
      <PageHeader
        title="Playbook"
        answer={data ? data.pto.headline : null}
        meta={
          <>
            <Badge>Submitted plan</Badge>
            <span>Actions for the week, for each scenario</span>
          </>
        }
        actions={<HelpTip term="Cushion" label="What's a cushion?" />}
      />

      {!data ? (
        <div className="space-y-6">
          <SkeletonCard chart />
          <SkeletonCard lines={6} />
        </div>
      ) : (
        <div className="space-y-6">
          <PtoCard rows={data.pto.rows} intro={data.pto.intro} assumption={data.pto.assumption} assumptionText={assumption?.text} goal={goal} />

          <section aria-labelledby="plays-title">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="plays-title" className="text-title font-semibold text-ink">
                Which plan to run, and what to do
              </h2>
              <p className="text-sm text-ink-subtle">Switching here changes the scenario across the app.</p>
            </div>
            <ScenarioPlays plays={data.scenarios} current={scenario} onSwitch={setScenario} />
          </section>

          <div className="grid gap-6 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <DayRules rules={data.on_the_day} />
            <Card
              title="Blocks with the least cushion"
              description={`${scenario}, ${where}: the blocks closest to a miss. Open one to see why.`}
              padding="none"
              footer={<span>{scenarioName}. Cushion is how many people a block can lose, or how much extra demand it can take, before a miss becomes the likelier outcome.</span>}
            >
              <Refreshing active={plan.query.isPlaceholderData}>
                <TightestTable rows={tight} scenario={scenario} blockByKey={plan.blockByKey} showWarehouse={warehouse === "all"} />
              </Refreshing>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
