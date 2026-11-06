// The board's cell model (DRAFT4.md 3 and 5.6). The browser only picks totals[wk], filters blocks by store, sums
// plan / draft / change / cost_change for All cells, takes a minimum chance, computes need − plan and sorts.
// "Below goal" is always block.below_goal (the server flags chance < goal − 0.0005); never compared to 0.95 here.

import type { Block, Meta, PlanResponse, WarehouseKey } from "./types";
import type { Lens } from "./url";

export const DEPTS = [38, 92, 95] as const;
export const SHIFTS = ["OPEN", "MID", "EVE"] as const;
export const SHIFT_SHORT: Record<string, string> = { OPEN: "Open", MID: "Mid", EVE: "Eve" };
export const SHIFT_LETTER: Record<string, string> = { OPEN: "O", MID: "M", EVE: "E" };
export const DEPT_SHORT: Record<number, string> = { 38: "FE", 92: "Merch", 95: "Pharm" };
export const STORES = ["1", "2", "4"] as const;

/** The block id without the scenario: "1|38|2026-02-14|MID". */
export const blockId = (b: Block) => `${b.store_id}|${b.dept_id}|${b.date}|${b.shift_code}`;
/** The All cell id: "all|38|2026-02-14|MID". */
export const cellIdOf = (wk: WarehouseKey, dept: number, date: string, shift: string) => `${wk}|${dept}|${date}|${shift}`;
export const allIdOf = (id: string) => `all|${id.split("|").slice(1).join("|")}`;
export const storeOf = (id: string) => id.split("|")[0] as WarehouseKey;

export const isP1 = (b: Block) => b.is_open && b.below_goal === true;
export const isFar = (b: Block) => isP1(b) && b.chance != null && b.chance < 0.8;
/** need − plan, the people a below-goal block is short. */
export const shortOf = (b: Block) => (b.need == null ? 0 : Math.max(0, b.need - b.plan));
export const isP3 = (b: Block) => b.is_open && (b.draft_sources?.unfilled ?? 0) > 0;

/** P1 order: chance ascending, then need − plan descending, then key ascending. Also the worst-block rule. */
export function byWorst(a: Block, b: Block) {
  const ca = a.chance ?? 0;
  const cb = b.chance ?? 0;
  if (ca !== cb) return ca - cb;
  const s = shortOf(b) - shortOf(a);
  if (s !== 0) return s;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

export type Tier = "closed" | "w2" | "wm" | "w1" | "ok" | "dim" | "cut" | "same" | "p1" | "p2" | "p3" | "c0" | "c1" | "c2" | "c3";

export interface Cell {
  id: string;
  dept: number;
  date: string;
  shift: string;
  /** All: the 3 warehouses' blocks; one warehouse: its block. */
  blocks: Block[];
  open: Block[];
  isOpen: boolean;
  plan: number;
  draft: number;
  change: number;
  costChange: number;
  /** Lowest chance over the open blocks (the tier's measure in All). */
  minChance: number | null;
  below: Block[];
  far: boolean;
  p3: boolean;
  /** The single worst block in view lives here. */
  worst: boolean;
  isAll: boolean;
}

export interface BoardModel {
  wk: WarehouseKey;
  rows: { dept: number; shift: string; cells: Cell[] }[];
  cells: Map<string, Cell>;
  /** Blocks in view (one store, or all three). */
  blocks: Block[];
  byId: Map<string, Block>;
  /** P1 blocks in list order, worst first. */
  p1: Block[];
  worst: Block | null;
  /** The lowest-chance open blocks (the list shows as many as fit, at least 6), for "Closest to goal" when p1 is empty. */
  closest: Block[];
  days: string[];
}

export function buildBoard(plan: PlanResponse, wk: WarehouseKey, meta: Meta): BoardModel {
  const days = meta.days.map((d) => d.date);
  const all = plan.blocks;
  const blocks = wk === "all" ? all : all.filter((b) => String(b.store_id) === wk);
  const byId = new Map<string, Block>();
  for (const b of all) byId.set(blockId(b), b);

  const p1 = blocks.filter(isP1).sort(byWorst);
  const worst = p1[0] ?? null;
  const closest = blocks
    .filter((b) => b.is_open && b.chance != null)
    .sort(byWorst)
    .slice(0, 24);

  const cells = new Map<string, Cell>();
  const rows = DEPTS.flatMap((dept) =>
    SHIFTS.map((shift) => ({
      dept,
      shift,
      cells: days.map((date) => {
        const inCell = blocks.filter((b) => b.dept_id === dept && b.date === date && b.shift_code === shift);
        const open = inCell.filter((b) => b.is_open);
        const below = open.filter(isP1);
        const chances = open.map((b) => b.chance).filter((c): c is number => c != null);
        const cell: Cell = {
          id: cellIdOf(wk, dept, date, shift),
          dept,
          date,
          shift,
          blocks: inCell,
          open,
          isOpen: open.length > 0,
          plan: sum(inCell, (b) => b.plan),
          draft: sum(inCell, (b) => b.draft),
          change: sum(inCell, (b) => b.change),
          costChange: sum(inCell, (b) => b.cost_change),
          minChance: chances.length ? Math.min(...chances) : null,
          below,
          far: below.some(isFar),
          p3: open.some(isP3),
          worst: !!worst && inCell.includes(worst),
          isAll: wk === "all",
        };
        cells.set(cell.id, cell);
        return cell;
      }),
    })),
  );

  return { wk, rows, cells, blocks, byId, p1, worst, closest, days };
}

function sum(bs: Block[], f: (b: Block) => number) {
  let s = 0;
  for (const b of bs) s += f(b);
  return s;
}

/** Mean change (or cost change) per open block: the People and Labor cost lens measure. */
const meanOpen = (c: Cell, f: (b: Block) => number) => (c.open.length ? sum(c.open, f) / c.open.length : 0);

/**
 * The cell's tier for a lens. One hue only (the user, 2026-11-05): a block that meets the goal has no fill, and a block
 * below it is red, stronger the further below (90-95%, 80-90%, under 80%, on the lowest chance in the cell). The red
 * tiers override every lens, so the problems are the only colour on the Service board.
 */
export function tierOf(c: Cell, lens: Lens): Tier {
  if (!c.isOpen) return "closed";
  if (c.below.length) {
    const m = c.minChance ?? 0;
    return m < 0.8 ? "w2" : m < 0.9 ? "wm" : "w1";
  }
  if (lens === "service") return "ok";
  if (lens === "below") return "dim";
  if (lens === "people") {
    const v = meanOpen(c, (b) => b.change);
    // The legend's wording ("1 to 2 more", "3 to 5 more", "6 or more") read on a fractional All mean: (0, 2], (2, 5], > 5.
    return v < 0 ? "cut" : v === 0 ? "same" : v <= 2 ? "p1" : v <= 5 ? "p2" : "p3";
  }
  const v = meanOpen(c, (b) => b.cost_change);
  return v <= 0 ? "c0" : v < 300 ? "c1" : v < 800 ? "c2" : "c3";
}

/** The cause chip from availability.note (DRAFT4.md 5.8). */
export function causeChip(note: string | null | undefined): string | null {
  if (!note) return null;
  if (note.startsWith("Holiday-weekend PTO")) return "Holiday PTO";
  if (note.startsWith("Approved PTO")) return "PTO";
  if (note.startsWith("Illness cluster")) return "Illness";
  if (note.startsWith("Receiving crew shortage")) return "Crew shortage";
  if (note.startsWith("Department closed")) return null; // the Closed chip already says it
  return note.split(/\s+/).slice(0, 2).join(" ");
}

/** Next / previous in P1 list order; for a healthy block, the same department and shift a day later or earlier. */
export function step(model: BoardModel, current: Block | null, dir: 1 | -1): Block | null {
  if (!current) return model.p1[dir === 1 ? 0 : model.p1.length - 1] ?? null;
  const i = model.p1.indexOf(current);
  if (i >= 0) return model.p1[i + dir] ?? null;
  const d = model.days.indexOf(current.date) + dir;
  if (d < 0 || d >= model.days.length) return null;
  return model.byId.get(`${current.store_id}|${current.dept_id}|${model.days[d]}|${current.shift_code}`) ?? null;
}

export function canStep(model: BoardModel, current: Block | null, dir: 1 | -1) {
  return step(model, current, dir) != null;
}

/**
 * Next / previous as a selection id. A block steps as above. An All cell that holds below-goal blocks sits just
 * before its own lowest one in list order: Next opens that block, Previous the block before it. A healthy All cell
 * steps to the same department and shift a day later or earlier. Nothing selected: the first (or last) in the list.
 */
export function stepSel(model: BoardModel, sel: string | null, dir: 1 | -1): string | null {
  if (!sel) {
    const b = model.p1[dir === 1 ? 0 : model.p1.length - 1] ?? model.closest[0] ?? null;
    return b ? blockId(b) : null;
  }
  if (sel.startsWith("all|")) {
    const cell = model.wk === "all" ? model.cells.get(sel) : undefined;
    if (!cell) return null;
    if (cell.below.length) {
      const own = [...cell.below].sort(byWorst)[0];
      const i = model.p1.indexOf(own);
      const b = dir === 1 ? model.p1[i] : model.p1[i - 1];
      return b ? blockId(b) : null;
    }
    const d = model.days.indexOf(cell.date) + dir;
    if (d < 0 || d >= model.days.length) return null;
    const id = cellIdOf("all", cell.dept, model.days[d], cell.shift);
    return model.cells.has(id) ? id : null;
  }
  const b = model.byId.get(sel);
  const n = b ? step(model, b, dir) : null;
  return n ? blockId(n) : null;
}

/** The chance strip in the detail: the same department and shift on each of the 7 days (a block, or an All cell's lowest). */
export interface DayChance {
  id: string;
  date: string;
  open: boolean;
  chance: number | null;
  below: boolean;
  current: boolean;
}

export function dayStrip(model: BoardModel, sel: string): DayChance[] {
  const isAll = sel.startsWith("all|");
  const [store, dept, date, shift] = sel.split("|");
  return model.days.map((d) => {
    if (isAll) {
      const c = model.cells.get(cellIdOf("all", Number(dept), d, shift));
      return { id: cellIdOf("all", Number(dept), d, shift), date: d, open: !!c?.isOpen, chance: c?.minChance ?? null, below: !!c?.below.length, current: d === date };
    }
    const id = `${store}|${dept}|${d}|${shift}`;
    const b = model.byId.get(id);
    return { id, date: d, open: !!b?.is_open, chance: b?.is_open ? b.chance : null, below: !!b && isP1(b), current: d === date };
  });
}
