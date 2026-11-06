// Hash state: #s=BASE&w=all&l=service&c=0&b=<id>, written with history.replaceState (no router).
// An invalid value falls back to the default with no error UI. b is the block id without the scenario
// ("1|38|2026-02-14|MID", or "all|38|2026-02-14|MID" for an All cell), so it survives a scenario switch.

import type { ScenarioCode, WarehouseKey } from "./types";

export type Lens = "service" | "below" | "people" | "cost";

export interface ViewState {
  scenario: ScenarioCode;
  wk: WarehouseKey;
  lens: Lens;
  compare: boolean;
  sel: string | null;
}

export const DEFAULT_VIEW: ViewState = { scenario: "BASE", wk: "all", lens: "service", compare: false, sel: null };

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
  };
}

export function writeHash(v: ViewState) {
  const p = new URLSearchParams();
  p.set("s", v.scenario);
  p.set("w", v.wk);
  p.set("l", v.lens);
  p.set("c", v.compare ? "1" : "0");
  if (v.sel) p.set("b", v.sel);
  const hash = `#${p.toString().replace(/%7C/gi, "|")}`;
  if (hash !== window.location.hash) {
    try {
      history.replaceState(null, "", hash);
    } catch {
      /* sandboxed frame: the view still works, it just isn't restorable */
    }
  }
}
