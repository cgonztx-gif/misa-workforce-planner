import { Eye } from "lucide-react";
import { Badge, Card, DeltaChip, deptColor, Skeleton, SwatchLabel, type DeltaChipProps } from "../../components";
import { cn } from "../../lib/cn";
import { fmtHours, fmtInt, fmtMoney, fmtPct, plural, signedHours, signedInt, signedMoney, signedPts } from "../../lib/format";
import type { Comparison, GroupTotals, ScenarioCode, Summary, SummaryChange } from "../../lib/types";

interface Metric {
  key: string;
  header: string;
  title: string;
  value: (s: Summary) => string;
  delta: (c: SummaryChange) => number | null;
  format: (n: number) => string;
  goodWhen: DeltaChipProps["goodWhen"];
  draft: (s: Summary) => string;
}

const METRICS: Metric[] = [
  { key: "cost", header: "Labor cost", title: "Loaded labor cost for the week", value: (s) => fmtMoney(s.cost), delta: (c) => c.cost, format: (n) => signedMoney(n, true), goodWhen: "down", draft: (s) => fmtMoney(s.cost) },
  { key: "hours", header: "Hours", title: "Paid hours", value: (s) => fmtHours(s.hours), delta: (c) => c.hours, format: signedHours, goodWhen: "neutral", draft: (s) => fmtHours(s.hours) },
  { key: "service", header: "Expected service", title: "Average chance of meeting target over open blocks", value: (s) => fmtPct(s.expected_met), delta: (c) => c.expected_met, format: (n) => signedPts(n), goodWhen: "up", draft: (s) => fmtPct(s.expected_met) },
  { key: "below", header: "Below the goal", title: "Blocks whose chance of meeting target stays under the service goal", value: (s) => fmtInt(s.below_goal), delta: (c) => c.below_goal, format: signedInt, goodWhen: "down", draft: (s) => plural(s.below_goal, "block") },
  { key: "ot", header: "Overtime", title: "Overtime hours", value: (s) => fmtHours(s.overtime_hours), delta: (c) => c.overtime_hours, format: signedHours, goodWhen: "neutral", draft: (s) => fmtHours(s.overtime_hours) },
  { key: "flex", header: "Cross-trained", title: "Hours worked by cross-trained (flex) staff from the partner department", value: (s) => fmtHours(s.flex_hours), delta: (c) => c.flex_hours, format: signedHours, goodWhen: "neutral", draft: (s) => fmtHours(s.flex_hours) },
];

export interface ScenarioTableProps {
  /** Each scenario's totals for the warehouse in view (undefined while loading). */
  totals: Record<ScenarioCode, GroupTotals | undefined>;
  names: Record<ScenarioCode, string>;
  current: ScenarioCode;
  onPick: (s: ScenarioCode) => void;
  warehouseName: string;
}

function Row({ label, comp, strong, dept }: { label: string; comp: Comparison; strong?: boolean; dept?: number }) {
  return (
    <tr className={cn("group", strong && "bg-surface")}>
      <th scope="row" className={cn("border-b border-border py-2.5 pr-3 pl-5 text-left align-middle", strong ? "font-semibold text-ink" : "font-normal text-ink-muted")}>
        {dept ? (
          <SwatchLabel color={deptColor(dept)} className="text-base text-ink-muted">
            {label}
          </SwatchLabel>
        ) : (
          label
        )}
      </th>
      {METRICS.map((m) => (
        <td key={m.key} className="border-b border-border px-3 py-2.5 text-right align-middle">
          <div className={cn("tnum whitespace-nowrap", strong ? "font-semibold text-ink" : "text-ink")}>{m.value(comp.plan)}</div>
          <div className="mt-1 flex justify-end">
            <DeltaChip size="sm" value={m.delta(comp.change)} format={m.format} goodWhen={m.goodWhen} tooltip={`Draft: ${m.draft(comp.draft)}`} />
          </div>
        </td>
      ))}
    </tr>
  );
}

/** Every scenario and department, plan against the draft (gap 4). Click a scenario to switch the app to it. */
export function ScenarioTable({ totals, names, current, onPick, warehouseName }: ScenarioTableProps) {
  const codes = Object.keys(totals) as ScenarioCode[];
  return (
    <Card
      title="Every scenario and department, against the draft"
      description={`The submitted plan for ${warehouseName}. Each figure is the plan, with its change from the draft below it; hover a change to see the draft.`}
      padding="none"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-base">
          <caption className="sr-only">Plan against draft for every scenario and department</caption>
          <colgroup>
            <col style={{ width: "19%" }} />
            {METRICS.map((m) => (
              <col key={m.key} style={{ width: `${81 / METRICS.length}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="border-y border-border bg-raised py-2.5 pr-3 pl-5 text-left text-sm font-medium text-ink-subtle">
                Scenario and department
              </th>
              {METRICS.map((m) => (
                <th key={m.key} scope="col" title={m.title} className="border-y border-border bg-raised px-3 py-2.5 text-right text-sm font-medium whitespace-nowrap text-ink-subtle">
                  {m.header}
                </th>
              ))}
            </tr>
          </thead>
          {codes.map((code) => {
            const t = totals[code];
            const active = code === current;
            const unfilled = t?.draft.unfilled ?? 0;
            return (
              <tbody key={code}>
                <tr>
                  <td colSpan={METRICS.length + 1} className={cn("border-b border-border px-5 py-2", active ? "bg-accent-soft" : "bg-raised/60")}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => onPick(code)}
                        aria-pressed={active}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-chip text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent",
                          active ? "text-accent-strong" : "text-ink hover:text-accent",
                        )}
                      >
                        {code}
                        <span className="font-normal text-ink-muted">{names[code]}</span>
                      </button>
                      {active ? (
                        <Badge tone="accent" icon={<Eye />}>
                          In view
                        </Badge>
                      ) : (
                        <button type="button" onClick={() => onPick(code)} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                          View {code}
                        </button>
                      )}
                      {unfilled > 0 && (
                        <span className="text-sm text-ink-subtle">
                          The draft's cost covers only the staff it can field: it schedules {plural(unfilled, "person", "people")} more than can be fielded.
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                {t ? (
                  <>
                    <Row label="All departments" comp={t} strong />
                    {t.by_department.map((d) => (
                      <Row key={d.dept_id} label={d.department} comp={d} dept={d.dept_id} />
                    ))}
                  </>
                ) : (
                  <tr>
                    <td colSpan={METRICS.length + 1} className="border-b border-border px-5 py-4">
                      <Skeleton className="h-24 w-full" />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
    </Card>
  );
}
