import { memo } from "react";
import { tierOf, STORES, type Cell, type Tier } from "../lib/board";
import { chanceText, goalText, int, signed, signedUsd, usd } from "../lib/format";
import type { Block, Meta } from "../lib/types";
import type { Lens } from "../lib/url";

// Fills per tier (DRAFT4.md 4 and 5.6), all tier tokens. Literal strings. Service: no fill when the block meets the goal;
// below goal: one red, stronger the further below (90-95%, 80-90%, under 80%) in every lens; People / Labor cost: an ink magnitude scale, never green or
// red, because more people or cost is not good or bad by itself. The ringed variants drop the hairline ring so the
// selection / worst ring is the only ring.
const FILL: Record<Tier, string> = {
  closed: "border-[1.5px] border-dashed border-line-strong",
  w2: "bg-tier-far",
  wm: "bg-tier-mid",
  w1: "bg-tier-low",
  ok: "ring-1 ring-inset ring-line",
  dim: "ring-1 ring-inset ring-line",
  cut: "bg-tier-cut ring-1 ring-inset ring-ink/30",
  same: "ring-1 ring-inset ring-line",
  p1: "bg-tier-m1",
  p2: "bg-tier-m2",
  p3: "bg-tier-m3",
  c0: "ring-1 ring-inset ring-line",
  c1: "bg-tier-m1",
  c2: "bg-tier-m2",
  c3: "bg-tier-m3",
};
const HAS_RING: Partial<Record<Tier, true>> = { ok: true, dim: true, same: true, c0: true };
// Cut keeps its fill but drops its ink ring when ringed.
const RINGED_FILL: Partial<Record<Tier, string>> = { cut: "bg-tier-cut" };
const NUM: Partial<Record<Tier, string>> = {
  closed: "font-normal text-muted",
  w2: "font-bold underline decoration-2 underline-offset-2",
  wm: "underline decoration-2 underline-offset-2",
  w1: "underline decoration-2 underline-offset-2",
  dim: "text-ink-2",
};

// Forced colours (Windows high contrast) drop box-shadow rings, so each ring also has an outline there.
const SELECTED_RING = "ring-2 ring-accent ring-offset-2 ring-offset-card forced-colors:outline-2 forced-colors:outline-offset-2 forced-colors:outline-[Highlight]";
// The single worst block: a heavier, darker red ring than the selection, plus a red corner flag, so it survives the blur test.
const WORST_RING = "ring-[3px] ring-bad-strong ring-offset-2 ring-offset-card forced-colors:outline-[3px] forced-colors:outline-offset-2 forced-colors:outline-[CanvasText]";
const RED: Partial<Record<Tier, true>> = { w1: true, wm: true, w2: true };
const UNFILLED: Partial<Record<Tier, true>> = { dim: true, same: true, c0: true, closed: true };

export interface CellProps {
  cell: Cell;
  lens: Lens;
  compare: boolean;
  selected: boolean;
  focusable: boolean;
  dayLabel: string;
  dayLong: string;
  meta: Meta;
  goal: number;
  onClick: (c: Cell) => void;
  onFocusCell: () => void;
}

const wName = (meta: Meta, store: number | string) => meta.warehouses.find((w) => String(w.id) === String(store))?.label ?? `Warehouse ${store}`;
const deptName = (meta: Meta, id: number) => meta.departments.find((d) => d.id === id)?.name ?? String(id);
const shiftName = (meta: Meta, code: string) => meta.shifts.find((s) => s.code === code)?.name ?? code;

function tipFor(c: Cell, lens: Lens, compare: boolean, meta: Meta, goal: number, dayLabel: string): { title: string; lines: string[] } {
  const where = `${dayLabel} · ${deptName(meta, c.dept)} · ${shiftName(meta, c.shift)}`;
  const g = goalText(goal);
  if (!c.isOpen) return { title: "Closed", lines: [`${where} · ${c.isAll ? "All warehouses" : wName(meta, c.blocks[0]?.store_id ?? "")}`] };
  const worstLine = c.worst ? ["Worst block in view: lowest chance, then largest shortfall"] : [];
  if (!c.isAll) {
    const b = c.blocks[0];
    const lines = [`${where} · ${wName(meta, b.store_id)} · ${b.start ?? ""}–${b.end ?? ""}`, `Chance ${chanceText(b.chance, b.below_goal, goal)} · goal ${g}`];
    if (b.below_goal) lines.push(`Need ${int(b.need ?? 0)} · can field ${int(b.availability.capacity)} · short ${int(Math.max(0, (b.need ?? 0) - b.plan))}`);
    if (compare) lines.push(`Draft ${int(b.draft)} · chance ${chanceText(b.chance_draft, b.below_goal_draft, goal)}${b.draft_sources.unfilled > 0 ? ` · ${int(b.draft_sources.unfilled)} unfilled` : ""}`);
    if (lens === "cost") lines.push(`Cost ${usd(b.cost)} · ${signedUsd(b.cost_change)}`);
    return { title: `${int(b.plan)} people`, lines: [...lines, ...worstLine] };
  }
  const per = STORES.map((s) => c.blocks.find((b) => String(b.store_id) === s))
    .filter((b): b is Block => !!b)
    .map((b) =>
      !b.is_open
        ? `W${b.store_id} closed`
        : `W${b.store_id} ${int(b.plan)} · ${chanceText(b.chance, b.below_goal, goal)}${b.below_goal ? " · below" : ""}${compare ? ` · draft ${int(b.draft)}${b.draft_sources.unfilled > 0 ? ` · ${int(b.draft_sources.unfilled)} unfilled` : ""}` : ""}`,
    );
  const lines = [`${where} · All warehouses`, ...per, "Lowest chance shown"];
  if (lens === "cost") lines.push(`Cost ${usd(c.blocks.reduce((s, b) => s + b.cost, 0))} · ${signedUsd(c.costChange)}`);
  return { title: `${int(c.plan)} people`, lines: [...lines, ...worstLine] };
}

function ariaFor(c: Cell, meta: Meta, goal: number, dayLong: string) {
  const where = `${c.isAll ? "All warehouses" : wName(meta, c.blocks[0]?.store_id ?? "")}, ${dayLong}, ${deptName(meta, c.dept)}, ${shiftName(meta, c.shift)}`;
  if (!c.isOpen) return `${where}: closed`;
  const ch = c.change;
  const vs = ch > 0 ? `${int(ch)} more than the draft` : ch < 0 ? `${int(-ch)} fewer than the draft` : "same as the draft";
  if (!c.isAll) {
    const b = c.blocks[0];
    const tail = b.below_goal ? `, below goal, ${int(Math.max(0, (b.need ?? 0) - b.plan))} short` : "";
    return `${where}: ${int(b.plan)} people, ${vs}, ${chanceText(b.chance, b.below_goal, goal)} chance${tail}${c.worst ? ", worst block in view" : ""}`;
  }
  const n = c.below.length;
  return `${where}: ${int(c.plan)} people, ${vs}, lowest chance ${chanceText(c.minChance, n > 0, goal)}${n ? `, ${n} warehouse${n === 1 ? "" : "s"} below goal` : ""}${c.worst ? ", holds the worst block in view" : ""}`;
}

export const BoardCell = memo(function BoardCell({ cell: c, lens, compare, selected, focusable, dayLabel, dayLong, meta, goal, onClick, onFocusCell }: CellProps) {
  const tier = tierOf(c, lens);
  const ringed = selected || c.worst;
  const fill = ringed && HAS_RING[tier] ? "" : ringed && RINGED_FILL[tier] ? RINGED_FILL[tier] : FILL[tier];
  const ring = selected ? SELECTED_RING : c.worst ? WORST_RING : "";
  const tip = tipFor(c, lens, compare, meta, goal, dayLabel);
  const delta = c.change;
  const pips = c.isAll ? c.below.length : 0;
  const second = c.isOpen ? chanceText(c.minChance, c.below.length > 0, goal) : "";
  const numCls = NUM[tier] ?? "";
  // Secondary text reaches 4.5:1 on every fill: ink on the red tiers, ink-2 on the green / grey tiers, muted on no fill.
  const secInk = RED[tier] ? "text-ink" : UNFILLED[tier] ? "text-muted" : "text-ink-2";
  const p3Mark = c.p3 ? "underline decoration-dashed decoration-bad decoration-[1.5px] underline-offset-[3px]" : "";
  const sec = `text-[11px] font-medium ${secInk} ${p3Mark}`;
  // A draft-unfilled (P3) cell with no net change still shows ±0, so its dashed mark has something to sit on.
  const showDelta = delta !== 0 || c.p3;

  return (
    <button
      type="button"
      role="gridcell"
      tabIndex={focusable ? 0 : -1}
      aria-selected={selected}
      aria-label={ariaFor(c, meta, goal, dayLong)}
      data-key={c.isAll ? c.id : c.blocks[0]?.key}
      data-cell={c.id}
      data-plan={c.plan}
      data-below={c.below.length}
      data-tier={tier}
      data-worst={c.worst ? "1" : undefined}
      data-p3={c.p3 ? "1" : undefined}
      data-tip-title={tip.title}
      data-tip={tip.lines.join("\n")}
      onClick={() => onClick(c)}
      onFocus={onFocusCell}
      className={`relative flex h-8 min-w-0 flex-col items-center justify-center rounded-[9px] text-[12px] leading-none font-semibold text-ink tnum transition-[filter] hover:brightness-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-9 sm:text-[13.5px] compact:h-[30px] min-[112.5rem]:h-[42px] min-[112.5rem]:tall:h-12 min-[112.5rem]:xtall:h-[54px] min-[112.5rem]:huge:h-16 min-[160rem]:h-11 min-[160rem]:tall:h-12 min-[160rem]:xtall:h-[54px] min-[160rem]:huge:h-16 min-[160rem]:rounded-[10px] min-[160rem]:text-[15px] ${fill} ${ring}`}
    >
      {!c.isOpen ? (
        <span className="font-normal text-muted">—</span>
      ) : compare ? (
        <>
          <span className="inline-flex items-baseline gap-1 min-[160rem]:hidden">
            <span className={numCls}>{int(c.plan)}</span>
            {showDelta && <span className={`hidden sm:inline-block ${sec}`}>{signed(delta)}</span>}
          </span>
          <span className="hidden items-baseline gap-1.5 min-[160rem]:inline-flex">
            <span className={`text-[13px] font-medium ${secInk} ${p3Mark}`}>{int(c.draft)}</span>
            <span className={`text-[12px] font-normal ${secInk}`}>→</span>
            <span className={numCls}>{int(c.plan)}</span>
          </span>
        </>
      ) : (
        <span className={numCls}>{int(c.plan)}</span>
      )}
      {c.isOpen && <span className={`mt-1 hidden text-[11px] font-medium min-[160rem]:block ${secInk}`}>{second}</span>}
      {pips > 0 && (
        <span aria-hidden className="absolute top-1 right-1 flex gap-[2px]">
          {Array.from({ length: pips }, (_, i) => (
            <span key={i} className="size-[3.5px] rounded-full bg-ink/75 forced-colors:bg-[CanvasText]" />
          ))}
        </span>
      )}
      {c.worst && <span aria-hidden data-flag="worst" className="absolute top-1 left-1 size-[6px] rounded-full bg-bad-strong forced-colors:bg-[CanvasText]" />}
    </button>
  );
});

