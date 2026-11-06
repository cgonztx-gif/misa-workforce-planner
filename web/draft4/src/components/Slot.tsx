import { useEffect, useRef } from "react";
import { allIdOf, dayStrip, stepSel, type BoardModel } from "../lib/board";
import type { Block, Meta } from "../lib/types";
import { AllCellDetail } from "./AllCellDetail";
import { BelowGoalList } from "./BelowGoalList";
import { BlockDetail } from "./BlockDetail";
import { DayStrip } from "./DayStrip";

export interface SlotProps {
  model: BoardModel;
  meta: Meta;
  goal: number;
  compare: boolean;
  sel: string | null;
  ptoHeadline?: string;
  phone: boolean;
  onSelectBlock: (b: Block) => void;
  onSelect: (id: string) => void;
  onClear: () => void;
  onStep: (dir: 1 | -1) => void;
  onDrill: (b: Block) => void;
  onExpand: () => void;
}

/** What the detail shows for a selection id: an All cell, a block, or nothing. */
export function resolveSel(model: BoardModel, sel: string | null) {
  if (!sel) return { cell: undefined, block: undefined };
  if (sel.startsWith("all|")) return { cell: model.wk === "all" ? model.cells.get(sel) : undefined, block: undefined };
  return { cell: undefined, block: model.byId.get(sel) };
}

/** The detail on its own (the slot on wide screens, the bottom sheet on phones). */
export function Detail(p: SlotProps) {
  const { cell, block } = resolveSel(p.model, p.sel);
  const back = p.model.p1.length ? "Below goal" : "Closest to goal";
  const steps = {
    onPrev: () => p.onStep(-1),
    onNext: () => p.onStep(1),
    canPrev: stepSel(p.model, p.sel, -1) != null,
    canNext: stepSel(p.model, p.sel, 1) != null,
  };
  const strip = p.sel ? (
    <DayStrip
      days={dayStrip(p.model, p.sel)}
      meta={p.meta}
      goal={p.goal}
      label={cell ? "Lowest chance by day" : "Chance by day"}
      onPick={p.onSelect}
      roomy={!(p.compare && !cell)} // on the projector the draft rows take its room; Previous / Next stay on screen
    />
  ) : null;
  if (cell) return <AllCellDetail cell={cell} meta={p.meta} goal={p.goal} back={back} strip={strip} onBack={p.onClear} onClose={p.onClear} onDrill={p.onDrill} {...steps} />;
  if (block) return <BlockDetail b={block} goal={p.goal} compare={p.compare} back={back} ptoHeadline={p.ptoHeadline} strip={strip} onBack={p.onClear} onClose={p.onClear} {...steps} />;
  return null;
}

/** The slot card beside the board: the Below goal list, swapped for the detail on a selection. Never empty. */
export function Slot(p: SlotProps) {
  const { cell, block } = resolveSel(p.model, p.sel);
  const showDetail = !p.phone && !!(cell || block);
  const ref = useRef<HTMLDivElement>(null);
  const prevSel = useRef(p.sel);
  const mounted = useRef(false);

  // Focus never falls back to the page when the slot swaps: a list row opens the detail (focus its back link);
  // Escape or × closes it (focus the list row, or else the board cell, it came from).
  useEffect(() => {
    const was = prevSel.current;
    prevSel.current = p.sel;
    if (!mounted.current) return void (mounted.current = true); // a restored hash on load moves no focus
    if (p.phone) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    if (showDetail) {
      ref.current?.querySelector<HTMLElement>("[data-back]")?.focus({ preventScroll: true });
      return;
    }
    if (!was) return;
    const b = p.model.byId.get(was);
    const row = b ? ref.current?.querySelector<HTMLElement>(`button[data-key="${b.key}"]`) : null;
    if (row) return row.focus({ preventScroll: true });
    const cellId = p.model.wk === "all" && !was.startsWith("all|") ? allIdOf(was) : was;
    document.querySelector<HTMLElement>(`[data-card=plan] [role=gridcell][data-cell="${cellId}"]`)?.focus({ preventScroll: true });
  }, [p.sel, showDetail, p.phone]); // eslint-disable-line react-hooks/exhaustive-deps -- only a swap moves focus

  return (
    <div ref={ref} className="flex h-full min-h-0 flex-col">
      {showDetail ? (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto px-5 pt-3 pb-5 compact:pt-2 compact:pb-3">
          <Detail {...p} />
        </div>
      ) : (
        <BelowGoalList model={p.model} goal={p.goal} selId={p.sel} onSelect={p.onSelectBlock} onExpand={p.onExpand} phone={p.phone} />
      )}
    </div>
  );
}
