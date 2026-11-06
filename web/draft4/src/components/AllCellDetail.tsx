import type { ReactNode } from "react";
import { causeChip, shortOf, STORES, type Cell } from "../lib/board";
import { chanceText, goalText, int, signed } from "../lib/format";
import type { Block, Meta } from "../lib/types";
import { chip, StepActions, TopRow } from "./BlockDetail";

/**
 * An All cell: the 3 warehouses side by side, then each one's chance against the goal (so the story, 57.0% and
 * Short 5, is there without a drill-down), then the row's week. A table row click drills into that warehouse.
 */
export function AllCellDetail({ cell, meta, goal, back, strip, onBack, onClose, onDrill, onPrev, onNext, canPrev, canNext }: {
  cell: Cell;
  meta: Meta;
  goal: number;
  back: string;
  strip?: ReactNode;
  onBack: () => void;
  onClose: () => void;
  onDrill: (b: Block) => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const day = meta.days.find((d) => d.date === cell.date);
  const dept = meta.departments.find((d) => d.id === cell.dept)?.name ?? "";
  const shift = meta.shifts.find((s) => s.code === cell.shift)?.name ?? cell.shift;
  const rows = STORES.map((s) => cell.blocks.find((b) => String(b.store_id) === s)).filter((b): b is Block => !!b);
  const maxPlan = Math.max(1, ...rows.map((b) => b.plan));
  const notes = [...new Map(rows.filter((b) => b.is_open && b.availability.note).map((b) => [causeChip(b.availability.note), b.availability.note])).entries()].filter(
    (e): e is [string, string] => !!e[0],
  );
  const pct = (v: number) => `${Math.max(0, Math.min(100, v * 100))}%`;
  const g = goalText(goal);

  return (
    <div className="flex h-full min-h-0 flex-col fade-in" data-detail="all" data-key={cell.id}>
      <TopRow back={back} onBack={onBack} onClose={onClose} />
      <h3 className="mt-2 text-[15.5px] font-semibold tracking-[-.01em]">
        {day?.short} · {dept} · {shift}
      </h3>
      <div className="mt-0.5 text-[12.5px] text-muted">All warehouses</div>

      {(cell.below.length > 0 || notes.length > 0 || !cell.isOpen) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {!cell.isOpen && <span className={`${chip} bg-ink/[.05] text-ink-2`}>Closed</span>}
          {cell.below.length > 0 && (
            <span className={`${chip} bg-warn/15 text-ink`} data-tip={`${int(cell.below.length)} of ${int(cell.open.length)} warehouses under a ${g} chance`}>
              Below goal
            </span>
          )}
          {notes.map(([c, note]) => (
            <span key={c} className={`${chip} bg-ink/[.05] text-ink-2`} data-tip={note}>
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex px-3 text-[12px] text-muted compact:mt-3">
        <span className="flex-1">Warehouse</span>
        <span className="w-11 text-right">Draft</span>
        <span className="w-11 text-right">Plan</span>
        <span className="w-10 text-right">±</span>
        <span className="w-16 text-right">Chance</span>
      </div>
      <div className="mt-1 flex flex-col">
        {rows.map((b) => (
          <button
            key={b.key}
            type="button"
            data-key={b.key}
            onClick={() => onDrill(b)}
            disabled={!b.is_open}
            data-tip={b.is_open ? `${b.warehouse} · ${b.label}\nOpen this block` : undefined}
            className="group relative flex h-11 w-full items-center rounded-[10px] px-3 pb-1.5 text-left text-[14px] hover:bg-soft/60 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <span aria-hidden className="absolute inset-x-3 bottom-[5px] h-[3px] overflow-hidden rounded-full bg-line/70">
              <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${(100 * b.plan) / maxPlan}%` }} />
            </span>
            <span className="relative flex flex-1 items-center gap-2">
              {b.is_open && b.below_goal ? <span aria-hidden className="size-1.5 rounded-[2px] bg-warn" /> : <span className="size-1.5" />}
              {b.warehouse}
            </span>
            {b.is_open ? (
              <>
                <span className="relative w-11 text-right text-ink-2 tnum">{int(b.draft)}</span>
                <span className="relative w-11 text-right font-semibold tnum">{int(b.plan)}</span>
                <span className="relative w-10 text-right text-[13px] text-muted tnum">{signed(b.change)}</span>
                <span className="relative w-16 text-right tnum">{chanceText(b.chance, b.below_goal, goal)}</span>
              </>
            ) : (
              <span className="relative text-muted">—</span>
            )}
          </button>
        ))}
        <div className="flex h-10 items-center border-t border-line px-3 text-[14px]">
          <span className="flex-1 pl-3.5 text-muted">All</span>
          <span className="w-11 text-right text-ink-2 tnum">{int(cell.draft)}</span>
          <span className="w-11 text-right font-semibold tnum">{int(cell.plan)}</span>
          <span className="w-10 text-right text-[13px] text-muted tnum">{signed(cell.change)}</span>
          <span className="w-16" />
        </div>
      </div>

      {/* Each warehouse's chance against the goal: the bullet of the block detail, in mini form. */}
      {cell.isOpen && (
        <div className="mt-4 compact:mt-3" data-mini="chance">
          <div className="mb-1 flex items-center justify-between text-[12px] text-muted">
            <span>Chance</span>
            <span className="tnum">Goal {g}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {rows.map((b) => (
              <div key={b.key} className="flex h-6 items-center gap-2.5 text-[12.5px]" aria-label={`${b.warehouse}: ${b.is_open ? `${chanceText(b.chance, b.below_goal, goal)} chance${b.below_goal ? `, ${shortOf(b)} short` : ""}` : "closed"}`}>
                <span className="w-6 shrink-0 text-ink-2 tnum">W{b.store_id}</span>
                <span aria-hidden className="relative h-3.5 min-w-0 flex-1 overflow-hidden rounded-[4px]">
                  <span className="absolute inset-y-0 left-0 bg-ink/[.16]" style={{ width: "80%" }} />
                  <span className="absolute inset-y-0 bg-ink/[.09]" style={{ left: "80%", width: `calc(${pct(goal)} - 80%)` }} />
                  <span className="absolute inset-y-0 right-0 bg-ink/[.04]" style={{ left: pct(goal) }} />
                  {b.is_open && (
                    <span className={`absolute top-1/3 left-0 h-1/3 rounded-r-[2px] ${b.below_goal ? "bg-warn-mark" : "bg-accent"}`} style={{ width: b.chance == null ? 0 : `max(2px, ${pct(b.chance)})` }} />
                  )}
                  <span className="absolute inset-y-0.5 w-[2px] -translate-x-1/2 bg-ink" style={{ left: pct(goal) }} />
                </span>
                <span className="w-12 shrink-0 text-right font-medium tnum">{b.is_open ? chanceText(b.chance, b.below_goal, goal) : "—"}</span>
                <span className="w-16 shrink-0">
                  {b.is_open && b.below_goal && (
                    <span className={`${chip} h-5 bg-warn/15 px-2 text-[11.5px] font-medium text-ink tnum`} data-tip={`Need ${int(b.need ?? 0)} · can field ${int(b.availability.capacity)}`}>
                      Short {int(shortOf(b))}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {strip}

      <StepActions onPrev={onPrev} onNext={onNext} canPrev={canPrev} canNext={canNext} />
    </div>
  );
}
