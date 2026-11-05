import { Card, deptColor, SegmentedControl, SwatchLabel, Tooltip } from "../../components";
import { fmtPct } from "../../lib/format";
import type { Block, ScenarioCode } from "../../lib/types";
import { tokens } from "../../styles/tokens";
import { fmtUnits } from "./types";

const SHIFTS = [
  { code: "OPEN", name: "Opening", fill: tokens.color.draft_soft, ink: tokens.color.ink },
  { code: "MID", name: "Midday", fill: tokens.color.accent, ink: tokens.color.on_accent },
  { code: "EVE", name: "Evening", fill: tokens.color.border_strong, ink: tokens.color.ink },
] as const;

interface DayRow {
  date: string;
  day: string;
  dayShort: string;
  holiday: string | null;
  total: number;
  parts: { code: string; name: string; demand: number | null; share: number | null; fill: string; ink: string }[];
}

/**
 * Each shift's share of the day's forecast demand, summed over the blocks in view. Exact: block demand
 * is the daily forecast times the shift share (and, in PEAK, the shift's own multiplier).
 */
export function shiftRows(blocks: Block[], dept: number): DayRow[] {
  const byDay = new Map<string, Block[]>();
  for (const b of blocks) {
    if (b.dept_id !== dept) continue;
    const list = byDay.get(b.date) ?? [];
    list.push(b);
    byDay.set(b.date, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      const sums = new Map<string, number | null>();
      for (const s of SHIFTS) {
        const open = list.filter((b) => b.shift_code === s.code && b.is_open && b.demand != null);
        sums.set(s.code, open.length ? open.reduce((acc, b) => acc + (b.demand ?? 0), 0) : null);
      }
      const total = [...sums.values()].reduce<number>((acc, v) => acc + (v ?? 0), 0);
      return {
        date,
        day: list[0].day,
        dayShort: list[0].day_short,
        holiday: list[0].holiday,
        total,
        parts: SHIFTS.map((s) => {
          const demand = sums.get(s.code) ?? null;
          return { code: s.code, name: s.name, demand, share: demand == null || total === 0 ? null : demand / total, fill: s.fill, ink: s.ink };
        }),
      };
    });
}

/** "Evening closed", or "Only midday open" when two of three shifts are closed. */
const closedNote = (r: DayRow) => {
  const open = r.parts.filter((p) => p.share != null);
  const closed = r.parts.filter((p) => p.share == null);
  if (!closed.length) return "";
  if (open.length === 1) return `Only ${open[0].name.toLowerCase()} open`;
  return `${closed.map((p) => p.name).join(" and ")} closed`;
};

export interface ShiftSplitProps {
  blocks: Block[];
  departments: { id: number; name: string }[];
  dept: number;
  onDept: (d: number) => void;
  note: string;
  scenario: ScenarioCode;
  warehouseName: string;
}

/** A 100% bar per day: how the day's demand splits across the three shifts. Midday carries the accent. */
export function ShiftSplit({ blocks, departments, dept, onDept, note, scenario, warehouseName }: ShiftSplitProps) {
  const rows = shiftRows(blocks, dept);
  const deptName = departments.find((d) => d.id === dept)?.name ?? "";
  const anyClosed = rows.some((r) => r.parts.some((p) => p.share == null));
  return (
    <Card
      title="The shift split"
      description={`${note} ${scenario}, ${warehouseName}.`}
      footer="Each shift's share of the day's forecast demand. The plan staffs each shift for its own share."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Department for the shift split"
          size="sm"
          value={String(dept)}
          onChange={(v) => onDept(Number(v))}
          options={departments.map((d) => ({ value: String(d.id), label: <SwatchLabel color={deptColor(d.id)} className="text-inherit">{d.name}</SwatchLabel> }))}
        />
        <div className="flex items-center gap-4" aria-hidden>
          {SHIFTS.map((s) => (
            <span key={s.code} className="inline-flex items-center gap-2 text-sm text-ink-muted">
              <span className="size-3 rounded-[3px] ring-1 ring-border" style={{ background: s.fill }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2" role="table" aria-label={`Shift split of ${deptName} demand by day`}>
        {rows.map((r) => (
          <div key={r.date} role="row" className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
            <div role="rowheader" className="flex flex-col leading-tight">
              <span className="tnum text-sm font-medium text-ink">{r.dayShort}</span>
              <span className="truncate text-sm text-ink-subtle" title={r.holiday ?? undefined}>
                {r.holiday ? (r.holiday === "Valentine's Day" ? "Valentine's" : r.holiday === "Presidents' Day" ? "Holiday" : "Holiday wknd") : "Normal day"}
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 min-w-0 flex-1 gap-[2px]">
              {r.parts.map((p) =>
                p.share == null ? null : (
                  <Tooltip
                    key={p.code}
                    content={
                      <span>
                        <span className="font-semibold">
                          {r.day}, {p.name}
                        </span>
                        <br />
                        {fmtPct(p.share)} of the day: {fmtUnits(p.demand)} of {fmtUnits(r.total)} units{r.holiday ? `. ${r.holiday}.` : "."}
                      </span>
                    }
                  >
                    <div
                      role="cell"
                      tabIndex={0}
                      aria-label={`${p.name} ${fmtPct(p.share)}`}
                      className="tnum flex min-w-0 items-center justify-center overflow-hidden rounded-[4px] text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      style={{ width: `${p.share * 100}%`, background: p.fill, color: p.ink }}
                    >
                      {p.share >= 0.12 ? fmtPct(p.share) : ""}
                    </div>
                  </Tooltip>
                ),
              )}
            </div>
              {anyClosed && (
                <span className="w-[124px] shrink-0 text-sm whitespace-nowrap text-ink-subtle">{closedNote(r)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
