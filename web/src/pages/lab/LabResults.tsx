import { AlertTriangle, Clock, DollarSign, Gauge, Layers, ShieldCheck } from "lucide-react";
import { Badge, DataTable, DeltaChip, KpiRow, KpiTile, type Column } from "../../components";
import { fmtHours, fmtInt, fmtMoney, fmtPct, plural, signedHours, signedInt, signedMoney, signedPts } from "../../lib/format";
import type { Summary } from "../../lib/types";
import type { WhatIfChange } from "./types";

export interface LabKpisProps {
  /** The re-planned week under the new conditions. */
  whatIf: Summary;
  /** The submitted plan kept as it is, scored under the same conditions. */
  kept: Summary;
  /** The submitted plan as submitted, under normal conditions. */
  submitted: Summary;
  changes: WhatIfChange[];
}

/**
 * KPI tiles for a what-if. Every delta compares the re-planned week with the submitted plan
 * kept as it is under the same conditions, so the chip shows what re-planning buys.
 */
export function LabKpis({ whatIf, kept, submitted, changes }: LabKpisProps) {
  const added = changes.filter((c) => c.change > 0).reduce((s, c) => s + c.change, 0);
  const cut = changes.filter((c) => c.change < 0).reduce((s, c) => s - c.change, 0);
  const asSubmitted = `As submitted, under normal conditions: `;
  return (
    <KpiRow columns={5}>
      <KpiTile
        label="Labor cost"
        icon={<DollarSign />}
        value={fmtMoney(whatIf.cost)}
        delta={{ value: whatIf.cost - kept.cost, format: (n) => signedMoney(n, true), goodWhen: "down" }}
        sub={`Submitted ${fmtMoney(kept.cost, true)}`}
        help={`The re-planned week's loaded labor cost, against the submitted plan's ${fmtMoney(kept.cost)} for the staff it can field under these conditions.`}
      />
      <KpiTile
        label="Hours"
        icon={<Clock />}
        value={fmtHours(whatIf.hours)}
        delta={{ value: whatIf.hours - kept.hours, format: signedHours, goodWhen: "neutral" }}
        sub={`${fmtInt(whatIf.overtime_hours)} h overtime`}
        help={`Paid hours in the re-planned week. The submitted plan has ${fmtHours(kept.hours)}, ${fmtInt(kept.overtime_hours)} of them overtime.`}
      />
      <KpiTile
        label="Expected service"
        icon={<Gauge />}
        tone="accent"
        value={fmtPct(whatIf.expected_met)}
        delta={{ value: whatIf.expected_met != null && kept.expected_met != null ? whatIf.expected_met - kept.expected_met : null, format: (n) => signedPts(n), goodWhen: "up" }}
        sub={`Submitted ${fmtPct(kept.expected_met)}`}
        help={`The average chance of meeting target under these conditions: ${fmtPct(whatIf.expected_met)} re-planned, ${fmtPct(kept.expected_met)} if the submitted plan stays as it is. ${asSubmitted}${fmtPct(submitted.expected_met)}.`}
      />
      <KpiTile
        label="Below the goal"
        icon={whatIf.below_goal > 0 ? <AlertTriangle /> : <ShieldCheck />}
        tone={whatIf.below_goal > 0 ? "risk" : "default"}
        value={fmtInt(whatIf.below_goal)}
        delta={{ value: whatIf.below_goal - kept.below_goal, format: signedInt, goodWhen: "down" }}
        sub={`Submitted ${plural(kept.below_goal, "block")}`}
        help={`Blocks under the goal even with all their own staff: ${fmtInt(whatIf.below_goal)} re-planned, ${fmtInt(kept.below_goal)} if the submitted plan stays as it is. ${asSubmitted}${fmtInt(submitted.below_goal)}.`}
      />
      <KpiTile
        label="Blocks changed"
        icon={<Layers />}
        value={fmtInt(changes.length)}
        sub={`${fmtInt(added)} people added, ${fmtInt(cut)} cut`}
        help="Blocks whose recommended headcount differs from the submitted plan. They're numbered on the boards below and listed under them."
      />
    </KpiRow>
  );
}

const SHIFT_ORDER: Record<string, number> = { OPEN: 1, MID: 2, EVE: 3 };

const COLUMNS = (showWarehouse: boolean): Column<WhatIfChange>[] => [
  {
    key: "label",
    header: "Block",
    value: (r) => `${r.date}|${r.dept_id}|${SHIFT_ORDER[r.shift_code] ?? r.shift_code}|${r.store_id}`,
    render: (r) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-ink">{r.label}</div>
        {showWarehouse && <div className="text-sm text-ink-subtle">{r.warehouse}</div>}
      </div>
    ),
  },
  { key: "submitted", header: "Submitted", value: (r) => r.submitted, align: "right", width: "104px" },
  { key: "what_if", header: "What-if", value: (r) => r.what_if, align: "right", width: "88px", render: (r) => <span className="font-semibold text-ink">{fmtInt(r.what_if)}</span> },
  {
    key: "change",
    header: "Change",
    value: (r) => r.change,
    align: "right",
    width: "104px",
    render: (r) => <DeltaChip size="sm" value={r.change} format={signedInt} />,
  },
  {
    key: "chance",
    header: "Chance here",
    title: "Chance of meeting target under these conditions, with the what-if headcount",
    value: (r) => r.chance_what_if,
    align: "right",
    width: "190px",
    render: (r) => (
      <span className="inline-flex items-center justify-end gap-2">
        {r.below_goal_what_if && (
          <Badge tone="risk" icon={<AlertTriangle />}>
            Below goal
          </Badge>
        )}
        {fmtPct(r.chance_what_if)}
      </span>
    ),
  },
  { key: "cost", header: "Cost change", value: (r) => r.cost_change, align: "right", width: "120px", render: (r) => signedMoney(r.cost_change) },
];

/** Every block whose headcount differs from the submitted plan, largest change first. */
export function ChangesTable({ rows, showWarehouse, maxHeight = 460 }: { rows: WhatIfChange[]; showWarehouse: boolean; maxHeight?: number }) {
  return (
    <DataTable
      columns={COLUMNS(showWarehouse)}
      rows={rows}
      rowKey={(r) => r.key}
      dense
      maxHeight={maxHeight}
      caption="Blocks whose headcount differs from the submitted plan"
      empty={<p className="px-5 py-8 text-center text-base text-ink-muted">No block's headcount changes here. The submitted plan already fits these conditions.</p>}
    />
  );
}
