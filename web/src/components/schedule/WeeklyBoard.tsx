// The weekly board: department x shift down, the 7 days across, one cell per block.
// The board is the page's centerpiece, so it is a crisp grid with a strong selection ring.
import { useEffect, useMemo, useRef } from "react";
import { cn } from "../../lib/cn";
import { signedInt } from "../../lib/format";
import type { Block } from "../../lib/types";
import { BoardCell } from "./BoardCell";
import { DEPT_ORDER, shiftIndex, type ColorMode } from "./boardScales";

export interface BoardDay {
  date: string;
  label: string;
  short: string;
  weekday: string;
  holiday: string | null;
  holiday_window: boolean;
}

export interface WeeklyBoardProps {
  /** The blocks of one warehouse (all 63, closed ones included). */
  blocks: Block[];
  days: BoardDay[];
  mode: ColorMode;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** People per day in the plan and the change from the draft, for the footer row. */
  dayTotals?: Map<string, { plan: number; change: number | null }>;
  goal: number;
  /** Scroll the selected cell into view on first render (when it was opened from the URL). */
  scrollToSelected?: boolean;
}

const COLS = "grid-cols-[minmax(124px,150px)_minmax(84px,96px)_repeat(7,minmax(86px,1fr))]";

/** Split the week into runs of holiday-window days, for the bracket over the column headers. */
function windowRuns(days: BoardDay[]) {
  const runs: { start: number; end: number; name: string }[] = [];
  days.forEach((d, i) => {
    if (!d.holiday_window) return;
    const last = runs[runs.length - 1];
    if (last && last.end === i - 1) last.end = i;
    else runs.push({ start: i, end: i, name: "" });
  });
  for (const r of runs) {
    const tail = days[r.end];
    const named = days.slice(r.start, r.end + 1).filter((d) => d.holiday && !/weekend/i.test(d.holiday));
    const base = named.length ? named[named.length - 1].holiday : tail.holiday;
    r.name = base ? `${base.replace(/ weekend$/i, "")} window` : "Holiday window";
  }
  return runs;
}

export function WeeklyBoard({ blocks, days, mode, selectedKey, onSelect, dayTotals, goal, scrollToSelected }: WeeklyBoardProps) {
  const byCell = useMemo(() => new Map(blocks.map((b) => [`${b.dept_id}|${b.shift_code}|${b.date}`, b])), [blocks]);
  const depts = useMemo(() => {
    const ids = [...new Set(blocks.map((b) => b.dept_id))].sort((a, b) => DEPT_ORDER.indexOf(a) - DEPT_ORDER.indexOf(b));
    return ids.map((id) => {
      const own = blocks.filter((b) => b.dept_id === id);
      const shifts = [...new Map(own.map((b) => [b.shift_code, b.shift])).entries()].sort((a, b) => shiftIndex(a[0]) - shiftIndex(b[0]));
      const net = own.reduce((s, b) => s + b.change, 0);
      return { id, name: own[0]?.department ?? String(id), shifts, net };
    });
  }, [blocks]);
  const runs = useMemo(() => windowRuns(days), [days]);
  const selected = selectedKey ? blocks.find((b) => b.key === selectedKey) : undefined;

  // Only a block opened from the URL (selected when the board first renders) is scrolled into view;
  // a click never moves the page.
  const root = useRef<HTMLDivElement>(null);
  const initialKey = useRef(selectedKey);
  const scrolled = useRef(false);
  useEffect(() => {
    if (!scrollToSelected || scrolled.current || !initialKey.current) return;
    const el = root.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(initialKey.current)}"]`);
    if (!el) return;
    scrolled.current = true;
    el.scrollIntoView({ block: "center" });
  }, [scrollToSelected, blocks]);

  return (
    <div ref={root} className="scrollbar-thin overflow-x-auto">
      <div className={cn("grid min-w-[860px]", COLS)} role="grid" aria-label="Weekly board" aria-rowcount={depts.reduce((s, d) => s + d.shifts.length, 0) + 1}>
        {/* Holiday-window bracket over the day headers. */}
        <div className="col-span-2" aria-hidden />
        {days.map((d, i) => {
          const run = runs.find((r) => r.start === i);
          if (run) {
            return (
              <div
                key={`run-${d.date}`}
                aria-hidden
                style={{ gridColumn: `span ${run.end - run.start + 1}` }}
                className="relative flex h-6 items-end justify-center"
              >
                <span className="absolute inset-x-1 bottom-1 h-2 rounded-t-[5px] border-x-2 border-t-2 border-accent-line" />
                <span className="relative mb-[3px] bg-surface px-2 text-sm leading-none font-medium text-accent-strong">{run.name}</span>
              </div>
            );
          }
          if (runs.some((r) => i > r.start && i <= r.end)) return null;
          return <div key={`run-${d.date}`} aria-hidden />;
        })}

        {/* Column headers. */}
        <div className="flex items-end pb-1.5 pl-1 text-sm text-ink-subtle" role="columnheader">
          Department
        </div>
        <div className="flex items-end pb-1.5 text-sm text-ink-subtle" role="columnheader">
          Shift
        </div>
        {days.map((d) => {
          const active = selected?.date === d.date;
          const i = days.indexOf(d);
          const runStart = runs.some((r) => r.start === i);
          const runEnd = runs.some((r) => r.end === i);
          const named = d.holiday && !/weekend/i.test(d.holiday) ? d.holiday : null;
          return (
            <div
              key={d.date}
              role="columnheader"
              className={cn(
                "flex min-h-[46px] min-w-0 flex-col justify-end px-2 pt-1.5 pb-2 whitespace-nowrap",
                d.holiday_window && "bg-band",
                runStart && "rounded-tl-control",
                runEnd && "rounded-tr-control",
                active && "shadow-[inset_0_-2px_0_var(--wp-color-navy)]",
              )}
            >
              <span className={cn("text-base font-semibold whitespace-nowrap", active ? "text-ink" : "text-ink-muted")}>
                {d.weekday.slice(0, 3)} <span className="tnum">{d.label.split(" ").slice(1).join(" ")}</span>
              </span>
              {named && <span className="truncate text-sm leading-tight font-medium text-accent-strong" title={named}>{named}</span>}
            </div>
          );
        })}

        {/* Body: one band of shift rows per department. */}
        {depts.map((dept, di) =>
          dept.shifts.map(([code, shiftName], si) => {
            const rowActive = selected?.dept_id === dept.id && selected?.shift_code === code;
            return (
              <div key={`${dept.id}-${code}`} className="contents" role="row">
                {si === 0 && (
                  <div
                    role="rowheader"
                    style={{ gridRow: `span ${dept.shifts.length}` }}
                    className={cn("relative flex flex-col justify-center pr-2 pl-4", di > 0 ? "pt-4 pb-1" : "py-1")}
                  >
                    <span aria-hidden className={cn("absolute bottom-1.5 left-0 w-[3px] rounded-full bg-border-strong", di > 0 ? "top-[18px]" : "top-1.5")} />
                    <span className="text-base leading-tight font-semibold text-ink">{dept.name}</span>
                    <span className="tnum mt-1 text-sm text-ink-subtle">{signedInt(dept.net)} people</span>
                  </div>
                )}
                <div
                  role="rowheader"
                  className={cn(
                    "flex items-center pr-2 text-sm whitespace-nowrap",
                    si === 0 && di > 0 ? "pt-[14px] pb-[2px]" : "py-[2px]",
                    rowActive ? "font-semibold text-ink" : "text-ink-muted",
                  )}
                >
                  {rowActive && <span aria-hidden className="mr-1.5 h-4 w-0.5 rounded-full bg-navy" />}
                  {shiftName}
                </div>
                {days.map((d) => {
                  const block = byCell.get(`${dept.id}|${code}|${d.date}`);
                  return (
                    <div key={d.date} className={cn("px-[2px]", d.holiday_window && "bg-band", si === 0 && di > 0 ? "pt-[14px] pb-[2px]" : "py-[2px]")}>
                      {block ? (
                        <BoardCell block={block} mode={mode} selected={block.key === selectedKey} onSelect={onSelect} goal={goal} />
                      ) : (
                        <div className="h-10 rounded-control border border-dashed border-border" aria-label="No block" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }),
        )}

        {/* Footer: people per day. */}
        {dayTotals && (
          <>
            <div className="col-span-2 pt-2" role="rowheader">
              <div className="flex h-full items-center border-t border-border pt-2 pb-1 pl-1 text-sm font-medium text-ink-muted">People per day</div>
            </div>
            {days.map((d, i) => {
              const t = dayTotals.get(d.date);
              return (
                <div
                  key={d.date}
                  className={cn(
                    "pt-2",
                    d.holiday_window && "bg-band",
                    runs.some((r) => r.start === i) && "rounded-bl-control",
                    runs.some((r) => r.end === i) && "rounded-br-control",
                  )}
                >
                  <div className="flex items-baseline gap-2 border-t border-border px-2.5 pt-2 pb-2">
                    <span className="tnum text-base font-semibold text-ink">{t?.plan ?? "–"}</span>
                    <span className="tnum text-sm text-ink-subtle">{t ? signedInt(t.change) : ""}</span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
