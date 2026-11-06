// Hash state: #s=BASE&w=all&l=service&c=0&b=<id>, written with history.replaceState (no router).
// An invalid value falls back to the default with no error UI. b is the block id without the scenario
// ("1|38|2026-02-14|MID", or "all|38|2026-02-14|MID" for an All cell), so it survives a scenario switch.

import type { ScenarioCode, WarehouseKey, WhatIfSettings } from "./types";
import { snap, WI_DEFAULTS, WI_LIMITS } from "./whatif";

export type Lens = "service" | "below" | "people" | "cost";
export type Page = "overview" | "demand" | "cost" | "playbook" | "methods";
export const PAGES: Page[] = ["overview", "demand", "cost", "playbook", "methods"];
export type DeptId = 38 | 92 | 95;

export interface ViewState {
  scenario: ScenarioCode;
  wk: WarehouseKey;
  lens: Lens;
  compare: boolean;
  sel: string | null;
  /** The page (p=). Overview is the default and is left out of the hash, so its links stay as they were. */
  page: Page;
  /** Demand: the department (dd=) and the day whose build is open (dy=). */
  dept: DeptId;
  day: string;
  /** What-if conditions (g=, co=, dm=, av=), written only when they differ from the submitted plan's. */
  wi: WhatIfSettings;
}

export const DEFAULT_VIEW: ViewState = { scenario: "BASE", wk: "all", lens: "service", compare: false, sel: null, page: "overview", dept: 38, day: "2026-02-14", wi: WI_DEFAULTS };

const SCEN: ScenarioCode[] = ["BASE", "PEAK", "DISRUPT"];
const WKS: WarehouseKey[] = ["all", "1", "2", "4"];
const LENSES: Lens[] = ["service", "below", "people", "cost"];
const SEL = /^(all|1|2|4)\|(38|92|95)\|2026-02-1[2-8]\|(OPEN|MID|EVE)$/;

export function readHash(): ViewState {
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  } catch {
    return DEFAULT_VIEW;
  }
  const s = (p.get("s") ?? "").toUpperCase() as ScenarioCode;
  const w = (p.get("w") ?? "") as WarehouseKey;
  const l = (p.get("l") ?? "") as Lens;
  const b = p.get("b");
  return {
    scenario: SCEN.includes(s) ? s : DEFAULT_VIEW.scenario,
    wk: WKS.includes(w) ? w : DEFAULT_VIEW.wk,
    lens: LENSES.includes(l) ? l : DEFAULT_VIEW.lens,
    compare: p.get("c") === "1",
    sel: b && SEL.test(b) ? b : null,
    page: PAGES.includes(p.get("p") as Page) ? (p.get("p") as Page) : "overview",
    dept: ([38, 92, 95] as number[]).includes(Number(p.get("dd"))) ? (Number(p.get("dd")) as DeptId) : DEFAULT_VIEW.dept,
    day: /^2026-02-1[2-8]$/.test(p.get("dy") ?? "") ? (p.get("dy") as string) : DEFAULT_VIEW.day,
    wi: readWi(p),
  };
}

export function writeHash(v: ViewState) {
  const p = new URLSearchParams();
  p.set("s", v.scenario);
  p.set("w", v.wk);
  p.set("l", v.lens);
  p.set("c", v.compare ? "1" : "0");
  if (v.sel) p.set("b", v.sel);
  if (Math.abs(v.wi.goal - WI_DEFAULTS.goal) > 1e-9) p.set("g", String(v.wi.goal));
  if (Math.abs(v.wi.callouts - WI_DEFAULTS.callouts) > 1e-9) p.set("co", String(v.wi.callouts));
  if (Math.abs(v.wi.demand - WI_DEFAULTS.demand) > 1e-9) p.set("dm", String(v.wi.demand));
  if (Math.abs(v.wi.availability - WI_DEFAULTS.availability) > 1e-9) p.set("av", String(v.wi.availability));
  if (v.page !== "overview") {
    p.set("p", v.page);
    p.set("dd", String(v.dept));
    p.set("dy", v.day);
  }
  const hash = `#${p.toString().replace(/%7C/gi, "|")}`;
  if (hash !== window.location.hash) {
    try {
      history.replaceState(null, "", hash);
    } catch {
      /* sandboxed frame: the view still works, it just isn't restorable */
    }
  }
}

/** A setting from the hash, snapped to its step; anything out of range or not a number falls back to the default. */
function readWi(p: URLSearchParams): WhatIfSettings {
  const num = (k: string) => {
    const raw = p.get(k);
    if (raw == null || raw === "") return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };
  const range = (k: string, lim: { min: number; max: number; step: number }, d: number) => {
    const v = num(k);
    if (v == null) return d;
    const s = snap(v, lim.step);
    return s >= lim.min - 1e-9 && s <= lim.max + 1e-9 ? s : d;
  };
  const g = num("g");
  return {
    goal: g != null && WI_LIMITS.goal.some((x) => Math.abs(x - g) < 1e-9) ? g : WI_DEFAULTS.goal,
    callouts: range("co", WI_LIMITS.callouts, WI_DEFAULTS.callouts),
    demand: range("dm", WI_LIMITS.demand, WI_DEFAULTS.demand),
    availability: range("av", WI_LIMITS.availability, WI_DEFAULTS.availability),
  };
}
