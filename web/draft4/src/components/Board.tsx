import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SHIFT_LETTER, SHIFT_SHORT, type BoardModel, type Cell } from "../lib/board";
import { int, plural } from "../lib/format";
import type { GroupTotals, Meta } from "../lib/types";
import type { Lens } from "../lib/url";
import { BoardCell } from "./BoardCell";

// Label column 36 px on phones and tablets (O / M / E), 124 px from 64rem (so "Merchandising" fits on one line),
// 140 from 160rem. Literal class strings: Tailwind must see them whole.
export const BOARD_COLS =
  "grid grid-cols-[36px_repeat(7,minmax(0,1fr))] gap-x-[5px] compact:gap-x-[4px] min-[64rem]:grid-cols-[124px_repeat(7,minmax(0,1fr))] min-[160rem]:grid-cols-[140px_repeat(7,minmax(0,1fr))] min-[160rem]:gap-x-[6px]";

export interface BoardProps {
  model: BoardModel;
  T: GroupTotals;
  meta: Meta;
  goal: number;
  lens: Lens;
  compare: boolean;
  selCellId: string | null;
  focusDay: string | null;
  scenarioName: string;
  onCell: (c: Cell) => void;
  onEscape: () => void;
}

export function Board({ model, T, meta, goal, lens, compare, selCellId, focusDay, scenarioName, onCell, onEscape }: BoardProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);
  const cols = model.days.length;
  const total = model.rows.length * cols;

  const focusAt = useCallback(
    (i: number) => {
      const el = gridRef.current?.querySelectorAll<HTMLElement>('[role="gridcell"]')[i];
      if (el) {
        setPos(i);
        el.focus();
      }
    },
    [gridRef],
  );

  const onKey = (e: KeyboardEvent) => {
    const r = Math.floor(pos / cols);
    const c = pos % cols;
    let next = -1;
    if (e.key === "ArrowRight") next = r * cols + Math.min(cols - 1, c + 1);
    else if (e.key === "ArrowLeft") next = r * cols + Math.max(0, c - 1);
    else if (e.key === "ArrowDown") next = Math.min(total - 1, pos + cols);
    else if (e.key === "ArrowUp") next = pos - cols >= 0 ? pos - cols : pos;
    else if (e.key === "Home") next = r * cols;
    else if (e.key === "End") next = r * cols + cols - 1;
    else if (e.key === "Escape") {
      onEscape();
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      focusAt(next);
    }
  };

  const selCell = selCellId ? model.cells.get(selCellId) : undefined;

  // When the selection moves while focus sits on the board (N / Shift+N), focus and its tooltip follow it.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !selCellId) return;
    const active = document.activeElement as HTMLElement | null;
    if (!active || active.getAttribute("role") !== "gridcell" || !grid.contains(active)) return;
    const cells = [...grid.querySelectorAll<HTMLElement>('[role="gridcell"]')];
    const i = cells.findIndex((el) => el.dataset.cell === selCellId);
    if (i >= 0 && cells[i] !== active) {
      setPos(i);
      cells[i].focus();
    }
  }, [selCellId]);
  const dayTotals = new Map(T.by_day.map((d) => [d.date, d]));
  const busiestBelow = [...T.by_day].sort((a, b) => b.plan.below_goal - a.plan.below_goal)[0];
  const wkName = model.wk === "all" ? "all warehouses" : (meta.warehouses.find((w) => String(w.id) === model.wk)?.label ?? "");
  const aria = `Schedule, ${scenarioName}, ${wkName}: ${int(T.plan.employees)} people, ${plural(T.plan.below_goal, "block")} below goal${
    T.plan.below_goal > 0 && busiestBelow ? `, most on ${busiestBelow.day_short}` : ""
  }`;

  const hw = meta.days.map((d, i) => (d.holiday_window ? i : -1)).filter((i) => i >= 0);
  const hwStart = hw.length ? hw[0] + 2 : 0;
  const hwEnd = hw.length ? hw[hw.length - 1] + 3 : 0;

  return (
    <div className="min-w-0 select-none">
      {/* Column header: the holiday band (range-calendar style), weekday, date, named-holiday dot. */}
      <div className={`${BOARD_COLS} mb-[5px] grid-rows-[14px_auto] compact:mb-1 compact:grid-rows-[12px_auto]`} aria-hidden>
        {hw.length > 0 && (
          <>
            <div className="rounded-[10px] bg-soft" style={{ gridColumn: `${hwStart} / ${hwEnd}`, gridRow: "1 / 3" }} />
            <div className="hidden items-end justify-center text-[11px] leading-none text-muted sm:flex" style={{ gridColumn: `${hwStart} / ${hwEnd}`, gridRow: "1 / 2" }}>
              Holiday window
            </div>
          </>
        )}
        {meta.days.map((d, i) => {
          const tot = dayTotals.get(d.date);
          const named = !!d.holiday && !/weekend$/i.test(d.holiday);
          const focus = focusDay === d.date;
          const sel = selCell?.date === d.date;
          const tip = [d.label, d.holiday, tot ? `${int(tot.plan.employees)} people` : null, tot ? `${plural(tot.plan.below_goal, "block")} below goal` : null].filter(Boolean).join(" · ");
          return (
            <div key={d.date} style={{ gridColumn: `${i + 2} / ${i + 3}`, gridRow: "2 / 3" }} className="relative flex flex-col items-center py-1 compact:pt-0.5 compact:pb-[5px]" data-tip={tip} data-day={d.date}>
              <span className={`text-[12px] leading-[16px] ${sel ? "text-ink" : "text-muted"}`}>{d.label.slice(0, 3)}</span>
              <span className={`text-[13.5px] leading-[17px] font-semibold tnum ${focus ? "text-accent" : sel ? "text-ink" : "text-ink-2"}`}>{Number(d.date.slice(8))}</span>
              {(named || focus) && <span className={`absolute bottom-0 size-1 rounded-full compact:bottom-[1px] ${focus ? "bg-accent" : "bg-ink-2"}`} />}
            </div>
          );
        })}
      </div>
      <div ref={gridRef} role="grid" aria-label={aria} onKeyDown={onKey} className="flex flex-col gap-[10px] compact:gap-2 min-[160rem]:gap-3">
        {meta.departments.map((dept) => {
          const rows = model.rows.filter((r) => r.dept === dept.id);
          const tip = `${dept.name} · ${typeof dept.service_target === "string" ? dept.service_target : ""}`;
          return (
            <div key={dept.id} role="rowgroup" className="relative">
              <div className="mb-[5px] text-[12px] font-semibold text-ink-2 min-[64rem]:hidden" data-tip={tip}>
                {dept.name}
              </div>
              <div
                className="absolute inset-y-0 left-0 hidden w-[88px] items-center text-[12.5px] leading-[1.2] font-semibold whitespace-nowrap text-ink-2 min-[64rem]:flex min-[160rem]:w-[100px] min-[160rem]:text-[13.5px]"
                data-tip={tip}
                aria-hidden
              >
                {dept.name}
              </div>
              <div className={`${BOARD_COLS} gap-y-[5px] compact:gap-y-[4px] min-[160rem]:gap-y-[6px]`}>
                {rows.map((row) => {
                  const ri = model.rows.indexOf(row);
                  const rowSel = selCell?.dept === row.dept && selCell?.shift === row.shift;
                  const shiftFull = meta.shifts.find((s) => s.code === row.shift)?.name ?? row.shift;
                  return (
                    <Fragment key={row.shift}>
                      <div role="row" className="contents">
                        <div role="rowheader" aria-label={`${dept.name}, ${shiftFull}`} data-tip={shiftFull} className={`flex items-center justify-end pr-0.5 text-[12px] ${rowSel ? "text-ink" : "text-muted"}`}>
                          <span className="min-[64rem]:hidden">{SHIFT_LETTER[row.shift]}</span>
                          <span className="hidden min-[64rem]:inline">{SHIFT_SHORT[row.shift]}</span>
                        </div>
                        {row.cells.map((cell, ci) => {
                          const i = ri * cols + ci;
                          const day = meta.days[ci];
                          return (
                            <BoardCell
                              key={cell.id}
                              cell={cell}
                              lens={lens}
                              compare={compare}
                              selected={cell.id === selCellId}
                              focusable={i === pos}
                              dayLabel={day.label}
                              dayLong={`${day.weekday ?? ""} ${new Date(`${day.date}T12:00:00`).toLocaleDateString("en", { month: "long", day: "numeric" })}`}
                              meta={meta}
                              goal={goal}
                              onClick={onCell}
                              onFocusCell={() => setPos(i)}
                            />
                          );
                        })}
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
