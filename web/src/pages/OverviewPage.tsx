import { AlertTriangle, Clock, DollarSign, Gauge, ShieldCheck, Users } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Badge, ErrorPanel, HelpTip, KpiRow, KpiTile, PageHeader, Refreshing, SkeletonCard } from "../components";
import { useMeta } from "../lib/api";
import { fmtHours, fmtInt, fmtMoney, fmtPct, plural, signedHours, signedInt, signedMoney, signedPts } from "../lib/format";
import { useCurrentPlan, useViewNames } from "../lib/hooks";
import { useView } from "../lib/view";
import { AlertsCard } from "./overview/AlertsCard";
import { ByDayCharts } from "./overview/ByDayCharts";
import { LargestChanges } from "./overview/LargestChanges";
import { ScenarioStrip } from "./overview/ScenarioStrip";

/** Overview (T-82): the answer for this scenario and warehouse, then the figures behind it. */
export default function OverviewPage() {
  const { query, data, totals, blockByKey } = useCurrentPlan();
  const { scenario, scenarioName, warehouseName } = useViewNames();
  const { warehouse, setScenario, carry } = useView();
  const meta = useMeta().data;
  const navigate = useNavigate();

  // Holiday-window days come from /api/meta; fall back to any day with a holiday name.
  const windowDates = useMemo(() => {
    const days = (meta?.days ?? []) as { date: string; holiday: string | null; holiday_window?: boolean }[];
    if (days.length) return new Set(days.filter((d) => d.holiday_window ?? !!d.holiday).map((d) => d.date));
    return new Set((totals?.by_day ?? []).filter((d) => d.holiday).map((d) => d.date));
  }, [meta, totals]);
  const windowName = useMemo(() => {
    const days = (totals?.by_day ?? []).filter((d) => windowDates.has(d.date));
    const named = days.filter((d) => d.holiday && !/weekend/i.test(d.holiday));
    const base = (named.length ? named[named.length - 1].holiday : days[days.length - 1]?.holiday) ?? "holiday";
    const short = `${base.replace(/ weekend$/i, "")} window`;
    return { short, long: days.length ? `${short}, ${days[0].day} to ${days[days.length - 1].day}` : short };
  }, [totals, windowDates]);

  const largest = useMemo(() => (totals?.largest_changes ?? []).map((k) => blockByKey.get(k)).filter((b): b is NonNullable<typeof b> => !!b), [totals, blockByKey]);

  if (query.error) {
    return (
      <>
        <PageHeader title="Overview" />
        <ErrorPanel error={query.error} what={`the ${scenario} plan`} onRetry={() => query.refetch()} />
      </>
    );
  }

  const plan = totals?.plan;
  const draft = totals?.draft;
  const change = totals?.change;
  const loading = !totals;
  const goal = data?.goal ?? 0.95;
  const goalPct = fmtPct(goal, 0);
  const toSchedule = () => navigate(`/schedule${carry}`);
  const toChanges = () => navigate(`/schedule${carry}&tab=changes`);

  return (
    <>
      <PageHeader
        title="Overview"
        answer={loading ? null : totals.verdict}
        meta={
          <>
            <Badge tone="accent">{scenario}</Badge>
            <span>
              {scenarioName}, {warehouseName}
            </span>
          </>
        }
        actions={<HelpTip term="Block" label="What's a block?" />}
      />

      <Refreshing active={query.isPlaceholderData}>
        <KpiRow columns={5}>
          <KpiTile
            label="Labor cost"
            icon={<DollarSign />}
            value={plan ? fmtMoney(plan.cost) : null}
            delta={{ value: change?.cost, format: (n) => signedMoney(n, true), goodWhen: "neutral", suffix: "vs draft" }}
            sub={draft && `Draft ${fmtMoney(draft.cost, true)}`}
            help={
              <>
                Loaded labor cost for the week: regular hours at base wage x 1.25, overtime at base x 1.5 x 1.10. The extra cost buys the service gain, so the change is
                shown in neutral gray rather than as a loss.
              </>
            }
          />
          <KpiTile
            label="Hours"
            icon={<Clock />}
            value={plan ? fmtHours(plan.hours) : null}
            delta={{ value: change?.hours, format: signedHours, goodWhen: "neutral", suffix: "vs draft" }}
            sub={plan && `${fmtInt(plan.overtime_hours)} h overtime`}
            help="Paid hours across every open block. More hours aren't good or bad by themselves: they go where history says people are missing."
          />
          <KpiTile
            label="Expected service"
            icon={<Gauge />}
            tone="accent"
            value={plan ? fmtPct(plan.expected_met) : null}
            delta={{ value: change?.expected_met, format: (n) => signedPts(n), goodWhen: "up", suffix: "vs draft" }}
            sub={draft && `Draft ${fmtPct(draft.expected_met)}`}
            note="Average chance a block meets its wait target"
            help="The average predicted chance of meeting the service target across open blocks. It's a prediction from our model, not a measured result."
          />
          <KpiTile
            label="Below the goal"
            icon={plan && plan.below_goal > 0 ? <AlertTriangle /> : <ShieldCheck />}
            tone={plan && plan.below_goal > 0 ? "risk" : "default"}
            value={plan ? fmtInt(plan.below_goal) : null}
            delta={{ value: change?.below_goal, format: signedInt, goodWhen: "down", suffix: "vs draft" }}
            sub={draft && `Draft ${plural(draft.below_goal, "block")}`}
            help={`Blocks whose chance of meeting target stays under the ${goalPct} goal even with all their own regular staff and overtime. Click to see them on the board.`}
            onClick={toSchedule}
          />
          <KpiTile
            label="Over capacity"
            icon={<Users />}
            value={plan ? fmtInt(plan.over_capacity) : null}
            // A zero against a zero says nothing as a chip, so say what it means instead.
            delta={plan && draft && plan.over_capacity === 0 && draft.over_capacity === 0 ? undefined : { value: change?.over_capacity, format: signedInt, goodWhen: "down", suffix: "vs draft" }}
            sub={
              draft &&
              (plan && plan.over_capacity === 0 && draft.over_capacity === 0
                ? "Plan and draft both fit what each block can field"
                : `Draft ${plural(draft.over_capacity, "block")}${draft.unfilled ? `, ${plural(draft.unfilled, "person", "people")} too many` : ""}`)
            }
            help="Blocks that schedule more people than can be fielded from regular staff, cross-trained staff and overtime."
          />
        </KpiRow>
      </Refreshing>

      <div className="mt-6">
        <ScenarioStrip scenario={scenario} warehouse={warehouse} warehouseName={warehouseName} onPick={setScenario} />
      </div>

      <Refreshing active={query.isPlaceholderData}>
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          {loading ? <SkeletonCard chart className="h-[560px]" /> : <ByDayCharts totals={totals} goal={goal} holidayWindow={(d) => windowDates.has(d)} windowName={windowName} />}
          {loading ? <SkeletonCard lines={6} /> : <AlertsCard alerts={totals.alerts} carry={carry} goal={goal} />}
        </div>

        <div className="mt-6">
          {loading ? (
            <SkeletonCard lines={8} />
          ) : (
            <>
              <LargestChanges blocks={largest} showWarehouse={warehouse === "all"} scenario={scenario} goal={goal} />
              <p className="mt-3 text-sm text-ink-subtle">
                {plural(totals.plan.blocks, "open block")} in this view.{" "}
                <button type="button" onClick={toChanges} className="font-medium text-accent hover:text-accent-strong">
                  See every change from the draft
                </button>
              </p>
            </>
          )}
        </div>
      </Refreshing>
    </>
  );
}
