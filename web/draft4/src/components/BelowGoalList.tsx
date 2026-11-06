import { Maximize2 } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { blockId, DEPT_SHORT, SHIFT_SHORT, shortOf, type BoardModel } from "../lib/board";
import { chanceText, goalText, int } from "../lib/format";
import type { Block } from "../lib/types";

const ROW_H = 44;

/** A row of the Below goal list (snippets.md ranked row): square, name, W chip, chance, short, a 3 px gap-to-goal bar with a goal tick. */
export function GoalRow({ b, worst, showW, goal, onClick, selected, closest = false, wide = false }: {
  b: Block;
  worst: boolean;
  showW: boolean;
  goal: number;
  onClick: () => void;
  selected?: boolean;
  closest?: boolean;
  wide?: boolean;
}) {
  // The bar is the gap between the chance and the goal, drawn from the chance to the goal tick, so the worst row has
  // the longest warm bar (intensity grows toward the problem). In "Closest to goal" the grey bar is the margin above it.
  const c = Math.max(0, Math.min(1, b.chance ?? 0));
  const lo = Math.min(c, goal);
  const gap = Math.abs(goal - c);
  const dayLong = `${b.weekday} ${new Date(`${b.date}T12:00:00`).toLocaleDateString("en", { month: "long", day: "numeric" })}`;
  const aria = `${b.warehouse}, ${dayLong}, ${b.department}, ${b.shift}: ${chanceText(b.chance, b.below_goal, goal)} chance${b.below_goal ? `, ${int(shortOf(b))} short` : ""}${worst ? ", worst block in view" : ""}`;
  const sq = closest ? "bg-ink/25" : worst ? "bg-down" : "bg-warn";
  const bar = closest ? "bg-ink/25" : worst ? "bg-down" : "bg-warn";
  const short = shortOf(b);
  return (
    <button
      type="button"
      data-key={b.key}
      aria-current={selected || undefined}
      aria-label={aria}
      onClick={onClick}
      data-tip-title={chanceText(b.chance, b.below_goal, goal)}
      data-tip={`${b.label} · ${b.warehouse}\nNeed ${int(b.need ?? 0)} · can field ${int(b.availability.capacity)} · plan ${int(b.plan)}${worst ? "\nWorst block in view: lowest chance, then largest shortfall" : ""}`}
      className={`group relative flex h-11 w-full shrink-0 items-center gap-3 rounded-[10px] px-3 pb-1.5 text-left text-[14px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
        selected ? "bg-accent/[.06] ring-1 ring-accent/20 ring-inset" : "hover:bg-soft/60"
      }`}
    >
      <span aria-hidden className="absolute inset-x-3 bottom-[5px] h-[3px] overflow-hidden rounded-full bg-line/70">
        <span
          data-bar="gap"
          className={`absolute inset-y-0 rounded-full ${bar}`}
          style={c <= goal ? { right: `${(1 - goal) * 100}%`, width: `max(3px, ${gap * 100}%)` } : { left: `${lo * 100}%`, width: `max(3px, ${gap * 100}%)` }}
        />
      </span>
      <span aria-hidden className="absolute bottom-[3px] h-[7px] w-px bg-ink/60" style={{ left: `calc(12px + (100% - 24px) * ${goal})` }} />
      <span aria-hidden className={`relative size-1.5 shrink-0 rounded-[2px] ${sq}`} />
      <span className="relative flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate" title={b.label}>
          {b.day_short} · {wide ? b.department : <><span className="@max-[26rem]:hidden">{b.department}</span><span className="hidden @max-[26rem]:inline">{DEPT_SHORT[b.dept_id]}</span></>} · {SHIFT_SHORT[b.shift_code]}
        </span>
        {showW && <span className="shrink-0 rounded bg-ink/[.05] px-1 text-[11px] leading-[16px] text-ink-2 tnum">W{b.store_id}</span>}
      </span>
      <span className="relative shrink-0 text-right text-ink tnum">{chanceText(b.chance, b.below_goal, goal)}</span>
      <span className="relative w-9 shrink-0 text-right text-[13px] text-muted tnum">{closest && !b.below_goal ? "" : int(short)}</span>
    </button>
  );
}

/** The slot's list: P1 blocks worst first. It shows as many rows as fit (at least 6), so the card has no hole. */
export function BelowGoalList({ model, goal, selId, onSelect, onExpand, phone }: {
  model: BoardModel;
  goal: number;
  selId: string | null;
  onSelect: (b: Block) => void;
  onExpand: () => void;
  phone: boolean;
}) {
  const empty = model.p1.length === 0;
  const rows = empty ? model.closest : model.p1;
  const boxRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(8);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || phone) return;
    const measure = () => setFit(Math.max(6, Math.floor((el.clientHeight + 2) / ROW_H)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phone]);

  const n = phone ? 8 : fit;
  const shown = rows.slice(0, n);
  const g = goalText(goal);

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-2 px-5 compact:h-11 max-sm:px-3">
        <h2 className="text-[15.5px] font-semibold tracking-[-.01em]" data-tip={empty ? `No block in view is under ${g}; the lowest chances are listed` : undefined}>
          {empty ? "Closest to goal" : "Below goal"}
        </h2>
        <button
          type="button"
          onClick={onExpand}
          aria-label={empty ? "All open blocks, lowest chance first" : "All below-goal blocks"}
          data-tip={empty ? "All open blocks, lowest chance first" : "All below-goal blocks"}
          className="grid size-8 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Maximize2 size={15} strokeWidth={1.75} />
        </button>
      </div>
      <div className="flex shrink-0 items-center justify-between px-8 pb-1 text-[12px] text-muted max-sm:px-6">
        <span>Block</span>
        <span className="flex gap-3">
          <span>Chance</span>
          <span className="w-9 text-right">Short</span>
        </span>
      </div>
      <div ref={boxRef} className="min-h-0 flex-1 overflow-hidden px-2 max-sm:px-0">
        <div className="flex flex-col fade-in" key={empty ? "closest" : "below"}>
          {shown.map((b) => (
            <GoalRow key={b.key} b={b} worst={!empty && b === model.worst} closest={empty} showW={model.wk === "all"} goal={goal} selected={selId === blockId(b)} onClick={() => onSelect(b)} />
          ))}
        </div>
      </div>
      <div className="shrink-0 px-5 pt-1 pb-4 text-[12px] text-muted tnum compact:pb-3 max-sm:px-3">
        {int(shown.length)} of {int(empty ? model.blocks.filter((b) => b.is_open).length : rows.length)}
      </div>
    </div>
  );
}
