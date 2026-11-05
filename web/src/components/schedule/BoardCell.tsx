import { AlertTriangle, UserX } from "lucide-react";
import { memo } from "react";
import { cn } from "../../lib/cn";
import { fmtPct, signedInt } from "../../lib/format";
import type { Block } from "../../lib/types";
import { Tooltip } from "../ui/Tooltip";
import { cellFill, cellMetric, fmtChance, type ColorMode } from "./boardScales";

/** Closed blocks: a diagonal hatch, so they read as "nothing scheduled", not as a pale value. */
export const HATCH =
  "repeating-linear-gradient(135deg, var(--wp-color-raised) 0 5px, var(--wp-color-border) 5px 6.5px)";

export interface BoardCellProps {
  block: Block;
  mode: ColorMode;
  selected: boolean;
  onSelect: (key: string) => void;
  goal: number;
}

function CellTip({ block, goal }: { block: Block; goal: number }) {
  if (!block.is_open) {
    return (
      <div>
        <p className="font-semibold">{block.label}</p>
        <p className="mt-1 text-navy-ink-muted">Closed: no staff needed. Click for details.</p>
      </div>
    );
  }
  return (
    <div className="min-w-[230px]">
      <p className="font-semibold">{block.label}</p>
      <p className="text-navy-ink-muted">
        {block.warehouse}
        {block.start && block.end ? `, ${block.start} to ${block.end}` : ""}
      </p>
      <dl className="tnum mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0.5">
        <dt className="text-navy-ink-muted" />
        <dd className="text-right text-navy-ink-muted">Draft</dd>
        <dd className="text-right text-navy-ink-muted">Plan</dd>
        <dt>People</dt>
        <dd className="text-right">{block.draft}</dd>
        <dd className="text-right font-semibold">{block.plan}</dd>
        <dt>Chance of meeting target</dt>
        <dd className="text-right">{fmtChance(block.chance_draft, block.below_goal_draft, goal)}</dd>
        <dd className="text-right font-semibold">{fmtChance(block.chance, block.below_goal, goal)}</dd>
        <dt>Utilization</dt>
        <dd className="text-right">{fmtPct(block.utilization_draft, 0)}</dd>
        <dd className="text-right font-semibold">{fmtPct(block.utilization, 0)}</dd>
      </dl>
      {block.below_goal && (
        <p className="mt-2 flex items-center gap-1.5 border-t border-navy-border pt-1.5 text-navy-ink">
          <AlertTriangle className="size-3.5 text-risk" aria-hidden /> Below the {fmtPct(goal, 0)} goal, even at capacity
        </p>
      )}
      {block.draft_sources.unfilled > 0 && (
        <p className="mt-1.5 flex items-center gap-1.5 text-navy-ink">
          <UserX className="size-3.5 text-warning" aria-hidden /> The draft's {block.draft} include {block.draft_sources.unfilled} who can't be fielded
        </p>
      )}
      <p className="mt-1.5 text-navy-ink-muted">Click for the full explanation.</p>
    </div>
  );
}

/** The marker for a block whose draft schedules more people than it can field. */
export const UnfilledIcon = () => <UserX className="size-[10px]" strokeWidth={2.5} />;

/** One block on the board, on one line: headcount, then the figure the color encodes (change, chance or utilization). */
export const BoardCell = memo(function BoardCell({ block, mode, selected, onSelect, goal }: BoardCellProps) {
  const base = cn(
    "group/cell relative flex h-10 w-full items-center rounded-control px-2.5 text-left outline-none transition-[box-shadow,transform] duration-100",
    "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
    selected
      ? "z-[2] shadow-[0_0_0_2px_var(--wp-color-surface),0_0_0_4.5px_var(--wp-color-navy),0_6px_16px_rgba(19,26,54,0.28)]"
      : "hover:z-[1] hover:shadow-[0_0_0_2px_var(--wp-color-surface),0_0_0_3.5px_var(--wp-color-accent-line)]",
  );

  if (!block.is_open) {
    return (
      <Tooltip content={<CellTip block={block} goal={goal} />} side="top">
        <button
          type="button"
          data-key={block.key}
          aria-label={`${block.label}: closed`}
          aria-pressed={selected}
          onClick={() => onSelect(block.key)}
          className={cn(base, "items-center border border-border text-ink-subtle")}
          style={{ background: HATCH }}
        >
          <span className="rounded-chip bg-surface/85 px-1.5 text-sm">Closed</span>
        </button>
      </Tooltip>
    );
  }

  const { fill, ink } = cellFill(block, mode);
  const metric = cellMetric(block, mode, goal);
  const quiet = mode === "change" && block.change === 0;
  const label = `${block.label}: plan ${block.plan}, ${block.change === 0 ? "no change" : `${signedInt(block.change)} from the draft's ${block.draft}`}, chance of meeting target ${fmtChance(block.chance, block.below_goal, goal)}${block.below_goal ? ", below the goal" : ""}${block.draft_sources.unfilled > 0 ? `, the draft can't field ${block.draft_sources.unfilled}` : ""}`;

  return (
    <Tooltip content={<CellTip block={block} goal={goal} />} side="top">
      <button
        type="button"
        data-key={block.key}
        aria-label={label}
        aria-pressed={selected}
        onClick={() => onSelect(block.key)}
        className={cn(base, "ring-1 ring-black/[0.06] ring-inset")}
        style={{ background: fill, color: ink }}
      >
        <span className="flex items-baseline gap-1.5 leading-none">
          <span className="tnum font-display text-[18px] font-semibold tracking-[-0.01em]">{block.plan}</span>
          <span className={cn("tnum text-sm font-medium", quiet ? "text-ink-subtle" : "text-ink-muted")}>{metric}</span>
        </span>
        <span className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
          {block.draft_sources.unfilled > 0 && (
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-surface text-warning-ink ring-[1.5px] ring-warning" aria-hidden>
              <UnfilledIcon />
            </span>
          )}
          {block.below_goal && (
            <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-risk text-white shadow-[0_0_0_1.5px_var(--wp-color-surface)]" aria-hidden>
              <AlertTriangle className="size-[11px]" strokeWidth={2.75} />
            </span>
          )}
        </span>
      </button>
    </Tooltip>
  );
});
