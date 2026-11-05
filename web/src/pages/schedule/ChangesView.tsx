// Every block whose headcount differs from the draft, as a sortable table. Clicking a row opens the drawer.
import { AlertTriangle, ArrowRight, UserX } from "lucide-react";
import { useMemo } from "react";
import { Badge, DataTable, DeltaChip, deptColor, EmptyState, SegmentedControl, SwatchLabel, type Column } from "../../components";
import { DEPT_ORDER, fmtChance, shiftIndex } from "../../components/schedule/boardScales";
import { plural, signedInt, signedMoney } from "../../lib/format";
import type { Block } from "../../lib/types";

export type Direction = "all" | "add" | "cut";
export type DeptFilter = "all" | "38" | "92" | "95";

export function filterChanges(blocks: Block[], direction: Direction, dept: DeptFilter) {
  return blocks.filter(
    (b) => b.is_open && b.change !== 0 && (direction === "all" || (direction === "add" ? b.change > 0 : b.change < 0)) && (dept === "all" || String(b.dept_id) === dept),
  );
}

export interface ChangesViewProps {
  blocks: Block[];
  showWarehouse: boolean;
  direction: Direction;
  dept: DeptFilter;
  onDirection: (d: Direction) => void;
  onDept: (d: DeptFilter) => void;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  goal: number;
  /** Short warehouse name for the table, e.g. "2 Large". */
  warehouseLabel?: (storeId: number) => string;
}

export function ChangesView({ blocks, showWarehouse, direction, dept, onDirection, onDept, selectedKey, onSelect, goal, warehouseLabel }: ChangesViewProps) {
  const changed = useMemo(() => blocks.filter((b) => b.is_open && b.change !== 0), [blocks]);
  const rows = useMemo(() => filterChanges(blocks, direction, dept), [blocks, direction, dept]);
  const adds = changed.filter((b) => b.change > 0);
  const cuts = changed.filter((b) => b.change < 0);
  const depts = useMemo(
    () => [...new Map(blocks.map((b) => [b.dept_id, b.department])).entries()].sort((a, b) => DEPT_ORDER.indexOf(a[0]) - DEPT_ORDER.indexOf(b[0])),
    [blocks],
  );

  const columns: Column<Block>[] = [
    { key: "date", header: "Day", value: (b) => b.date, render: (b) => <span className="whitespace-nowrap text-ink">{b.day}</span>, width: "120px" },
    ...(showWarehouse
      ? [{ key: "store", header: "Warehouse", value: (b: Block) => b.store_id, render: (b: Block) => <span className="whitespace-nowrap">{warehouseLabel?.(b.store_id) ?? b.warehouse}</span>, width: "104px" }]
      : []),
    {
      key: "dept",
      header: "Department",
      value: (b) => DEPT_ORDER.indexOf(b.dept_id),
      render: (b) => <SwatchLabel color={deptColor(b.dept_id)} className="text-ink">{b.department}</SwatchLabel>,
    },
    { key: "shift", header: "Shift", value: (b) => shiftIndex(b.shift_code), render: (b) => b.shift, width: "96px" },
    { key: "draft", header: "Draft", value: (b) => b.draft, align: "right", width: "76px" },
    { key: "plan", header: "Plan", value: (b) => b.plan, align: "right", width: "76px", render: (b) => <span className="font-semibold text-ink">{b.plan}</span> },
    {
      key: "change",
      header: "Change",
      value: (b) => b.change,
      align: "right",
      width: "96px",
      render: (b) => <DeltaChip value={b.change} format={signedInt} goodWhen="neutral" size="sm" />,
    },
    {
      key: "chance",
      header: "Chance",
      title: "Chance of meeting target, draft to plan",
      value: (b) => b.chance,
      align: "right",
      render: (b) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-ink-subtle">{fmtChance(b.chance_draft, b.below_goal_draft, goal)}</span>
          <ArrowRight className="size-3.5 text-ink-subtle" aria-hidden />
          <span className="font-semibold text-ink">{fmtChance(b.chance, b.below_goal, goal)}</span>
        </span>
      ),
    },
    { key: "cost", header: "Cost change", value: (b) => b.cost_change, align: "right", width: "112px", render: (b) => signedMoney(b.cost_change) },
    {
      key: "status",
      header: "Status",
      value: (b) => (b.below_goal ? 2 : 0) + (b.draft_sources.unfilled > 0 ? 1 : 0),
      render: (b) => (
        <span className="flex flex-nowrap gap-1.5">
          {b.below_goal && (
            <Badge tone="risk" icon={<AlertTriangle />}>
              Below goal
            </Badge>
          )}
          {b.draft_sources.unfilled > 0 && (
            <Badge tone="warning" icon={<UserX />} title={`The draft's ${b.draft} include ${b.draft_sources.unfilled} who can't be fielded`}>
              {b.draft_sources.unfilled} unfilled
            </Badge>
          )}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <p className="tnum text-base text-ink-muted">
          <span className="font-semibold text-ink">{plural(changed.length, "block")}</span> change from the draft:{" "}
          {plural(adds.length, "gets", "get")} more people ({signedInt(adds.reduce((s, b) => s + b.change, 0))}), {plural(cuts.length, "gets", "get")} fewer (
          {signedInt(cuts.reduce((s, b) => s + b.change, 0))}).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<Direction>
            label="Show changes"
            size="sm"
            value={direction}
            onChange={onDirection}
            options={[
              { value: "all", label: `All ${changed.length}` },
              { value: "add", label: `Added ${adds.length}` },
              { value: "cut", label: `Cut ${cuts.length}` },
            ]}
          />
          <SegmentedControl<DeptFilter>
            label="Department"
            size="sm"
            value={dept}
            onChange={onDept}
            options={[{ value: "all" as DeptFilter, label: "All departments" }, ...depts.map(([id, name]) => ({ value: String(id) as DeptFilter, label: name }))]}
          />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(b) => b.key}
        initialSort={{ key: "change", dir: "desc" }}
        onRowClick={(b) => onSelect(b.key)}
        selectedKey={selectedKey}
        maxHeight={620}
        dense
        caption="Every block that changes from the draft"
        empty={
          <div className="p-5">
            <EmptyState title="No changes match these filters">Pick another department or show all changes.</EmptyState>
          </div>
        }
      />
    </div>
  );
}

/** The rows on screen as a CSV, for "Export this view" in the Changes view. */
export function changesCsv(rows: Block[]): string {
  const head = ["Scenario", "Warehouse", "Date", "Day", "Department", "Shift", "Draft", "Plan", "Change", "Chance draft", "Chance plan", "Below the goal", "Cost draft", "Cost plan", "Cost change"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((b) =>
    [b.scenario, b.store_id, b.date, b.day, b.department, b.shift, b.draft, b.plan, b.change, b.chance_draft, b.chance, b.below_goal ? "Yes" : "No", b.cost_draft, b.cost, b.cost_change]
      .map(esc)
      .join(","),
  );
  return [head.join(","), ...lines].join("\r\n");
}
