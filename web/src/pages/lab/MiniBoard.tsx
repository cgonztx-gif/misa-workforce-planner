import { AlertTriangle } from "lucide-react";
import { deptColor, Tooltip } from "../../components";
import { changeTierFill } from "../../components/schedule/boardScales";
import { cn } from "../../lib/cn";
import { fmtInt, fmtPct, signedInt, signedMoney } from "../../lib/format";
import type { Block } from "../../lib/types";
import type { WhatIfChange } from "./types";

interface Day {
  date: string;
  label: string;
  short?: string;
  holiday: string | null;
}

export interface MiniBoardProps {
  /** The what-if's blocks for one warehouse. */
  blocks: Block[];
  /** Blocks whose headcount differs from the submitted plan, by key. */
  changes: Map<string, WhatIfChange>;
  days: Day[];
  shifts: { code: string; name: string }[];
  departments: { id: number; name: string }[];
  /** Cell height in px. */
  cellHeight?: number;
}

const HATCH = "repeating-linear-gradient(135deg, var(--wp-color-border-strong) 0 1px, transparent 1px 6px)";

/** The below-goal marker, the same red disc with a warning sign as on the Schedule board. */
function BelowGoalMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex size-4 items-center justify-center rounded-full bg-risk text-white shadow-[0_0_0_1.5px_var(--wp-color-surface)]", className)}>
      <AlertTriangle className="size-[9px]" strokeWidth={3} />
    </span>
  );
}

/** One cell: the change against the submitted plan, colored on the diverging scale. */
function Cell({ block, change, height }: { block: Block | undefined; change: WhatIfChange | undefined; height: number }) {
  if (!block) return <div style={{ height }} className="rounded-[5px] bg-raised" />;
  if (!block.is_open) {
    return (
      <Tooltip content={<span><span className="font-semibold">{block.label}</span><br />Closed: 0 people in every plan.</span>}>
        <div tabIndex={0} aria-label={`${block.label}: closed`} style={{ height, backgroundImage: HATCH }} className="rounded-[5px] bg-raised outline-none focus-visible:ring-2 focus-visible:ring-accent" />
      </Tooltip>
    );
  }
  const delta = change?.change ?? 0;
  const fill = delta !== 0 ? changeTierFill(delta) : null;
  const submitted = change ? change.submitted : block.plan;
  const tip = (
    <div className="space-y-1">
      <div className="font-semibold">{block.label}</div>
      <div className="text-navy-ink-muted">{block.warehouse}</div>
      <div className="tnum">
        Submitted {fmtInt(submitted)}, what-if {fmtInt(block.plan)}
        {delta !== 0 && <span className="font-semibold"> ({signedInt(delta)})</span>}
      </div>
      <div className="tnum">Chance of meeting target here: {fmtPct(block.chance)}</div>
      {change && <div className="tnum">Cost {signedMoney(change.cost_change)}</div>}
      {block.below_goal && (
        <div className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="size-3.5" aria-hidden />
          Below the goal under these conditions
        </div>
      )}
    </div>
  );
  return (
    <Tooltip content={tip} width={320}>
      <div
        tabIndex={0}
        aria-label={`${block.label}: ${delta === 0 ? "no change" : `${signedInt(delta)} people`}${block.below_goal ? ", below the goal" : ""}`}
        style={{ height, background: fill?.fill, color: fill?.ink }}
        className={cn(
          "flex items-center justify-between gap-1 rounded-[5px] px-2 text-base font-semibold tnum outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
          fill ? "ring-1 ring-black/[0.08] ring-inset" : "bg-raised text-ink-subtle",
        )}
      >
        {/* Number on the left and the marker on the right, as on the Schedule board, so they never overlap. */}
        <span>{delta !== 0 ? signedInt(delta) : ""}</span>
        {block.below_goal && <BelowGoalMark className="shrink-0" />}
      </div>
    </Tooltip>
  );
}

/** A small board for one warehouse: department and shift down, days across. Only changed blocks carry a number. */
export function MiniBoard({ blocks, changes, days, shifts, departments, cellHeight = 30 }: MiniBoardProps) {
  const byPlace = new Map(blocks.map((b) => [`${b.dept_id}|${b.date}|${b.shift_code}`, b]));
  return (
    <table className="w-full table-fixed border-separate border-spacing-[3px]">
      <colgroup>
        <col style={{ width: 66 }} />
        {days.map((d) => (
          <col key={d.date} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className="sr-only">
            Shift
          </th>
          {days.map((d) => {
            const [wd, num] = (d.short ?? d.label).split(" ");
            return (
              <th key={d.date} scope="col" title={d.holiday ? `${d.label}: ${d.holiday}` : d.label} className={cn("rounded-[5px] pt-1 pb-1 text-center font-normal leading-tight", d.holiday ? "bg-band" : "")}>
                <span className="block text-sm text-ink-subtle">{wd}</span>
                <span className="block text-sm font-semibold text-ink tnum">{num}</span>
              </th>
            );
          })}
        </tr>
      </thead>
      {departments.map((dept) => (
        <tbody key={dept.id}>
          <tr>
            <th colSpan={days.length + 1} scope="rowgroup" className="pt-2 pb-0.5 text-left text-sm font-semibold text-ink">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: deptColor(dept.id) }} />
                {dept.name}
              </span>
            </th>
          </tr>
          {shifts.map((s) => (
            <tr key={s.code}>
              <th scope="row" className="pr-1 text-left text-sm font-normal whitespace-nowrap text-ink-subtle">
                {s.name}
              </th>
              {days.map((d) => {
                const block = byPlace.get(`${dept.id}|${d.date}|${s.code}`);
                return (
                  <td key={d.date} className="p-0">
                    <Cell block={block} change={block ? changes.get(block.key) : undefined} height={cellHeight} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

/** The legend for the mini boards: the change scale, closed blocks and the below-goal corner. */
export function MiniBoardLegend({ vertical = false }: { vertical?: boolean }) {
  const steps = [-3, -2, -1, 1, 2, 3];
  return (
    <div className={cn("flex text-sm text-ink-subtle", vertical ? "flex-col items-start gap-2.5" : "flex-wrap items-center gap-x-5 gap-y-2")}>
      <span className="inline-flex items-center gap-2">
        <span>Fewer</span>
        <span className="inline-flex gap-0.5">
          {steps.map((s) => (
            <span key={s} aria-hidden className="h-3.5 w-5 rounded-[3px] ring-1 ring-black/[0.08] ring-inset" style={{ background: changeTierFill(s).fill }} />
          ))}
        </span>
        <span title="People against the submitted plan">More</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="h-3.5 w-5 rounded-[3px] border border-border bg-raised" />
        No change
      </span>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="h-3.5 w-5 rounded-[3px] bg-raised" style={{ backgroundImage: HATCH }} />
        Closed
      </span>
      <span className="inline-flex items-center gap-2">
        <BelowGoalMark />
        Below the goal
      </span>
    </div>
  );
}

/** People and cost by department for the changed blocks: the board's totals in words. */
export function DeptSummary({ changes, departments }: { changes: WhatIfChange[]; departments: { id: number; name: string }[] }) {
  return (
    <ul className="divide-y divide-border">
      {departments.map((d) => {
        const rows = changes.filter((c) => c.dept_id === d.id);
        const net = rows.reduce((sum, c) => sum + c.change, 0);
        const cost = rows.reduce((sum, c) => sum + c.cost_change, 0);
        return (
          <li key={d.id} className="flex items-baseline justify-between gap-4 py-2.5">
            <span className="inline-flex items-center gap-2 font-medium text-ink">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: deptColor(d.id) }} />
              {d.name}
            </span>
            <span className="text-right text-sm text-ink-muted tnum">
              <span className="font-semibold text-ink">{signedInt(net)}</span> people in {fmtInt(rows.length)} {rows.length === 1 ? "block" : "blocks"}
              <span className="block text-ink-subtle">{signedMoney(cost)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
