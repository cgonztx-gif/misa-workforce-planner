import { AlertTriangle, Clock, DollarSign, Gauge, ShieldCheck, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import {
  Badge,
  bandProps,
  barGap,
  barProps,
  Card,
  CHART_HEIGHT,
  ChartLegend,
  chartMargin,
  ErrorPanel,
  gridProps,
  HelpTip,
  KpiRow,
  KpiTile,
  legendItems,
  PageHeader,
  Refreshing,
  SkeletonCard,
  tooltipContent,
  barTooltipProps,
  xAxisProps,
  yAxisProps,
  zeroDomain,
} from "../components";
import { fmtHours, fmtInt, fmtMoney, fmtPct, plural, signedHours, signedInt, signedMoney, signedPts } from "../lib/format";
import { useCurrentPlan, useViewNames } from "../lib/hooks";

/**
 * Overview (T-82). For now: the verdict, the KPI tiles and hours by day from /api/plan,
 * proving the data path. The page builder replaces the rest.
 */
export default function OverviewPage() {
  const { query, totals } = useCurrentPlan();
  const { scenario, scenarioName, warehouseName } = useViewNames();

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
            delta={{ value: change?.cost, format: (n) => signedMoney(n, true), goodWhen: "down", suffix: "vs draft" }}
            sub={draft && `Draft ${fmtMoney(draft.cost, true)}`}
            help="Loaded labor cost for the week: regular hours at base wage x 1.25, overtime at base x 1.5 x 1.10."
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
            help="The average predicted chance of meeting the service target across open blocks. It's a prediction from our model, not a measured result."
          />
          <KpiTile
            label="Below the goal"
            icon={plan && plan.below_goal > 0 ? <AlertTriangle /> : <ShieldCheck />}
            tone={plan && plan.below_goal > 0 ? "risk" : "default"}
            value={plan ? fmtInt(plan.below_goal) : null}
            delta={{ value: change?.below_goal, format: signedInt, goodWhen: "down", suffix: "vs draft" }}
            sub={draft && `Draft ${plural(draft.below_goal, "block")}`}
            help="Blocks whose chance of meeting target stays under the 95% goal even with all their own regular staff and overtime."
          />
          <KpiTile
            label="Over capacity"
            icon={<Users />}
            value={plan ? fmtInt(plan.over_capacity) : null}
            delta={{ value: change?.over_capacity, format: signedInt, goodWhen: "down", suffix: "vs draft" }}
            sub={draft && `Draft ${plural(draft.over_capacity, "block")}`}
            help="Blocks that schedule more people than can be fielded from regular staff, cross-trained staff and overtime."
          />
        </KpiRow>

        <div className="mt-6">
          {loading ? (
            <SkeletonCard chart />
          ) : (
            <Card
              title="Hours by day"
              description="Plan against draft. The shaded days are the Presidents' Day window, with Valentine's Day on Sat Feb 14."
              actions={<ChartLegend items={[legendItems.plan, legendItems.draft]} />}
            >
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={totals.by_day.map((d) => ({ ...d, planHours: d.plan.hours, draftHours: d.draft.hours }))} margin={chartMargin} barGap={barGap}>
                  <CartesianGrid {...gridProps} />
                  {(() => {
                    const hol = totals.by_day.filter((d) => d.holiday);
                    return hol.length ? <ReferenceArea {...bandProps} x1={hol[0].day_short} x2={hol[hol.length - 1].day_short} /> : null;
                  })()}
                  <XAxis dataKey="day_short" {...xAxisProps} />
                  <YAxis {...yAxisProps} domain={zeroDomain} tickFormatter={(v: number) => fmtInt(v)} />
                  <RTooltip
                    {...barTooltipProps}
                    content={tooltipContent({
                      format: (v) => fmtHours(v),
                      labelFormat: (_l, row) => String(row?.day ?? _l),
                      footer: (row) => (row?.holiday ? String(row.holiday) : null),
                    })}
                  />
                  <Bar dataKey="draftHours" name="Draft" {...barProps.draft} />
                  <Bar dataKey="planHours" name="Plan" {...barProps.plan} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      </Refreshing>
    </>
  );
}
