import { AlertTriangle, ArrowUpRight, CheckCircle2, Lock } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Badge, Card, DataTable, deptColor, EmptyState, SwatchLabel, Tooltip, type Column } from "../../components";
import { fmtDate, fmtInt, fmtPct, plural } from "../../lib/format";
import type { Block } from "../../lib/types";
import { useView } from "../../lib/view";

const SHIFT_ORDER: Record<string, number> = { OPEN: 0, MID: 1, EVE: 2 };

/** Blocks whose chance stays under the goal, each with its reason: capacity. A row opens the block on the Schedule. */
export function BelowGoalTable({ blocks, goal, place }: { blocks: Block[]; goal: number; place: string }) {
  const navigate = useNavigate();
  const { carry } = useView();
  const rows = blocks.filter((b) => b.below_goal);
  const short = rows.reduce((acc, b) => acc + Math.max(0, (b.need ?? b.plan) - b.plan), 0);
  const atCap = rows.filter((b) => b.at_capacity).length;
  const byDay = new Map<string, number>();
  for (const b of rows) byDay.set(b.date, (byDay.get(b.date) ?? 0) + 1);
  const worstDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
  const open = (b: Block) => navigate(`/schedule${carry}&block=${encodeURIComponent(b.key)}`);

  const columns: Column<Block>[] = [
    { key: "date", header: "Day", value: (b) => `${b.date}|${SHIFT_ORDER[b.shift_code] ?? 9}`, render: (b) => <span className="tnum whitespace-nowrap text-ink">{b.day}</span>, width: "11%" },
    { key: "shift", header: "Shift", value: (b) => SHIFT_ORDER[b.shift_code] ?? 9, render: (b) => b.shift, width: "8%" },
    { key: "warehouse", header: "Warehouse", value: (b) => b.store_id, render: (b) => <span className="whitespace-nowrap">{b.warehouse}</span>, width: "10%" },
    {
      key: "dept",
      header: "Department",
      value: (b) => b.department,
      render: (b) => (
        <SwatchLabel color={deptColor(b.dept_id)} className="text-base whitespace-nowrap">
          {b.department}
        </SwatchLabel>
      ),
      width: "12%",
    },
    { key: "chance", header: "Chance", title: "Chance of meeting target with the plan", value: (b) => b.chance, render: (b) => <span className="font-medium text-ink">{fmtPct(b.chance)}</span>, align: "right", width: "8%" },
    { key: "plan", header: "Plan", title: "People in the plan. For a block at capacity, that's everyone it can field", value: (b) => b.plan, align: "right", width: "6%" },
    { key: "need", header: "Need", title: `People the ${fmtPct(goal, 0)} goal would take`, value: (b) => b.need, align: "right", width: "6%" },
    { key: "short", header: "Short", title: "Need minus plan", value: (b) => (b.need ?? b.plan) - b.plan, render: (b) => <span className="font-semibold text-ink">{fmtInt((b.need ?? b.plan) - b.plan)}</span>, align: "right", width: "6%" },
    {
      key: "reason",
      header: "Reason",
      value: (b) => (b.at_capacity ? 0 : 1),
      sortable: false,
      render: (b) => (
        <Tooltip content={b.explanation.why} width={360}>
          <span tabIndex={0} className="flex min-w-0 items-center gap-2 whitespace-nowrap">
            {b.at_capacity ? (
              <Badge tone="risk" icon={<Lock />}>
                At capacity
              </Badge>
            ) : (
              <Badge tone="warning" icon={<AlertTriangle />}>
                Below goal
              </Badge>
            )}
            <span className="truncate text-sm text-ink-muted">{b.availability.note ?? (b.at_capacity ? "Everyone it can field is in the plan" : b.explanation.headline)}</span>
          </span>
        </Tooltip>
      ),
    },
    {
      key: "open",
      header: <span className="sr-only">Open</span>,
      value: () => null,
      sortable: false,
      align: "right",
      width: "4%",
      render: () => <ArrowUpRight className="ml-auto size-4 text-ink-subtle group-hover:text-accent" aria-hidden />,
    },
  ];

  return (
    <Card
      title="Blocks below the goal"
      description={
        rows.length
          ? `${plural(rows.length, "block")} in ${place} stay under a ${fmtPct(goal, 0)} chance of meeting target, ${fmtInt(short)} people short of what the goal would take. ${atCap === rows.length ? "Every one is at capacity: it already uses all its own regular staff, usable cross-trained staff and overtime." : `${atCap} are at capacity.`}${worstDay ? ` The most fall on ${fmtDate(worstDay[0])} (${worstDay[1]}).` : ""}`
          : undefined
      }
      padding="none"
      footer={
        <span>
          Moving hours can't fix these: they need more people available, such as fewer holiday PTO approvals. See the{" "}
          <Link to={`/playbook${carry}`} className="font-medium text-accent underline-offset-4 hover:underline">
            Playbook
          </Link>
          . Click a row to open the block on the Schedule.
        </span>
      }
    >
      {rows.length ? (
        <DataTable columns={columns} rows={rows} rowKey={(b) => b.key} initialSort={{ key: "date", dir: "asc" }} onRowClick={open} maxHeight={520} dense caption="Blocks below the goal" />
      ) : (
        <div className="p-5">
          <EmptyState icon={<CheckCircle2 />} tone="good" title="Every block reaches the goal">
            No block in {place} stays under a {fmtPct(goal, 0)} chance of meeting target.
          </EmptyState>
        </div>
      )}
    </Card>
  );
}
