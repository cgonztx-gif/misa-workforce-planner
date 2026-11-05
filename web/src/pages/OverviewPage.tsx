import { Clock, DollarSign, Gauge, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { ErrorPanel, HelpTip, KpiRow, KpiTile, PageHeader, Refreshing, SkeletonCard } from "../components";
import { useMeta } from "../lib/api";
import { fmtHours, fmtInt, fmtMoney, fmtPct, plural, signedHours, signedInt, signedMoney, signedPts } from "../lib/format";
import { useCurrentPlan, useViewNames } from "../lib/hooks";
import { useView } from "../lib/view";
import { AlertsCard } from "./overview/AlertsCard";
import { ServiceByDay } from "./overview/ByDayCharts";
import { LargestChanges } from "./overview/LargestChanges";
import { ScenarioStrip } from "./overview/ScenarioStrip";

/**
 * Overview (T-82, draft 3). The one question: does the plan meet service this week, and what's still at risk?
 * Four tiles answer it, the service-by-day chart shows where the draft fails, and the below-goal list is the
 * problem view, with the Playbook beside it. Wordless (planning/DRAFT3.md): the verdict sentence is for screen
 * readers, and every explanation is a tooltip.
 */
export default function OverviewPage() {
  const { query, data, totals, blockByKey } = useCurrentPlan();
  const { scenario, warehouseName } = useViewNames();
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

  return (
    <>
      <PageHeader title="Overview" answer={loading ? null : totals.verdict} actions={<HelpTip term="Block" label="Block" />} />

      <Refreshing active={query.isPlaceholderData}>
        <KpiRow columns={4}>
          <KpiTile
            label="Expected service"
            icon={<Gauge />}
            value={plan ? fmtPct(plan.expected_met) : null}
            delta={{ value: change?.expected_met, format: (n) => signedPts(n), goodWhen: "up", suffix: "vs draft" }}
            sub={draft && `Draft ${fmtPct(draft.expected_met)}`}
            note="Average chance a block meets its wait target"
            help="A prediction from our model, not a measured result."
          />
          <KpiTile
            label="Below the goal"
            icon={<TriangleAlert />}
            tone={plan && plan.below_goal > 0 ? "risk" : "default"}
            value={plan ? fmtInt(plan.below_goal) : null}
            delta={{ value: change?.below_goal, format: signedInt, goodWhen: "down", suffix: "vs draft" }}
            sub={draft && `Draft ${plural(draft.below_goal, "block")}${plan && draft.over_capacity + plan.over_capacity > 0 ? `. Over capacity: ${draft.over_capacity} in the draft, ${plan.over_capacity} in the plan` : ""}`}
            help={`Blocks whose chance of meeting target stays under the ${goalPct} goal even with all their own regular staff and overtime. Click to see them on the board.`}
            onClick={toSchedule}
          />
          <KpiTile
            label="Labor cost"
            icon={<DollarSign />}
            value={plan ? fmtMoney(plan.cost, true) : null}
            delta={{ value: change?.cost, format: (n) => signedMoney(n, true), goodWhen: "neutral", suffix: "vs draft" }}
            sub={plan && draft && `${fmtMoney(plan.cost)} plan, ${fmtMoney(draft.cost)} draft`}
            help="Regular hours at base wage × 1.25, overtime at base × 1.5 × 1.10. The extra cost buys the service gain, so its change is gray, not red."
          />
          <KpiTile
            label="Paid hours"
            icon={<Clock />}
            value={plan ? fmtHours(plan.hours) : null}
            delta={{ value: change?.hours, format: signedHours, goodWhen: "neutral", suffix: "vs draft" }}
            sub={plan && `${fmtInt(plan.overtime_hours)} h overtime`}
            help="More hours aren't good or bad by themselves: they go where history says people are missing."
          />
        </KpiRow>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {loading ? <SkeletonCard chart className="h-[400px]" /> : <ServiceByDay totals={totals} goal={goal} holidayWindow={(d) => windowDates.has(d)} windowName={windowName} />}
          {loading ? <SkeletonCard lines={6} /> : <AlertsCard alerts={totals.alerts} byDay={totals.by_day} carry={carry} goal={goal} />}
        </div>
      </Refreshing>

      <div className="mt-5">
        <ScenarioStrip scenario={scenario} warehouse={warehouse} warehouseName={warehouseName} onPick={setScenario} />
      </div>

      <Refreshing active={query.isPlaceholderData}>
        <div className="mt-5">
          {loading ? <SkeletonCard lines={6} /> : <LargestChanges blocks={largest.slice(0, 6)} showWarehouse={warehouse === "all"} scenario={scenario} goal={goal} allChanges={`/schedule${carry}&tab=changes`} />}
        </div>
      </Refreshing>
    </>
  );
}
