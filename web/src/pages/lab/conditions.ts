// The Scenario lab's conditions: defaults and limits from /api/meta, the applied run in the URL,
// and the words used to describe a run.
//   #/scenario-lab?scenario=BASE&wh=all&demand=0.1&callouts=1.5
// Only conditions that differ from the defaults are written, so a link reproduces the run exactly.
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { useMeta } from "../../lib/api";
import type { ConditionKey, Conditions, WhatIfLimits } from "./types";

export const CONDITION_KEYS: ConditionKey[] = ["goal", "callouts", "demand", "availability"];

const MINUS = "−";

/** Round to the slider's step so 0.1 never travels as 0.09999999. */
export const snap = (value: number, step: number) => Number((Math.round(value / step) * step).toFixed(4));

export const sameConditions = (a: Conditions, b: Conditions) => CONDITION_KEYS.every((k) => Math.abs(a[k] - b[k]) < 1e-9);

/** Defaults and limits from /api/meta. Undefined until meta loads. */
export function useLabMeta() {
  const meta = useMeta().data;
  return useMemo(() => {
    if (!meta) return undefined;
    const d = meta.defaults;
    const defaults: Conditions = {
      goal: Number(d.goal),
      callouts: Number(d.callouts),
      demand: Number(d.demand),
      availability: Number(d.availability ?? 0),
    };
    const limits = meta.what_if_limits as WhatIfLimits | undefined;
    return { defaults, limits, days: meta.days, shifts: meta.shifts, warehouses: meta.warehouses, departments: meta.departments };
  }, [meta]);
}

function inRange(key: ConditionKey, value: number, limits?: WhatIfLimits): boolean {
  if (!Number.isFinite(value) || !limits) return false;
  if (key === "goal") return limits.goal.allowed.some((g) => Math.abs(g - value) < 1e-9);
  const lim = limits[key];
  return !!lim && value >= lim.min - 1e-9 && value <= lim.max + 1e-9;
}

/**
 * The applied run lives in the URL. `applied` is null when the URL holds no conditions,
 * which means the page shows the submitted plan. Out-of-range values are ignored.
 */
export function useAppliedConditions(defaults?: Conditions, limits?: WhatIfLimits) {
  const [params, setParams] = useSearchParams();

  const applied = useMemo<Conditions | null>(() => {
    if (!defaults) return null;
    let any = false;
    const out = { ...defaults };
    for (const key of CONDITION_KEYS) {
      const raw = params.get(key);
      if (raw === null) continue;
      const value = Number(raw);
      if (!inRange(key, value, limits)) continue;
      out[key] = value;
      any = true;
    }
    return any && !sameConditions(out, defaults) ? out : null;
  }, [params, defaults, limits]);

  const write = useCallback(
    (next: Conditions | null) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const key of CONDITION_KEYS) {
            if (next && defaults && Math.abs(next[key] - defaults[key]) > 1e-9) p.set(key, String(next[key]));
            else p.delete(key);
          }
          return p;
        },
        { replace: true },
      );
    },
    [setParams, defaults],
  );

  return { applied, apply: write, clear: useCallback(() => write(null), [write]) };
}

const pctText = (share: number, digits = 0) => `${Math.abs(share * 100).toFixed(digits)}%`;
const signedPctText = (share: number) => (Math.abs(share) < 1e-9 ? "0%" : `${share > 0 ? "+" : MINUS}${pctText(share)}`);

/** Display text for one condition's value: "+10%", "150% of history", "95%". */
export function conditionValue(key: ConditionKey, value: number): string {
  switch (key) {
    case "goal":
      return `${(value * 100).toFixed(Number.isInteger(Math.round(value * 1000) / 10) ? 0 : 1)}%`;
    case "callouts":
      return `${Math.round(value * 100)}%`;
    case "demand":
    case "availability":
      return signedPctText(value);
  }
}

/** A phrase for a changed condition: "demand +10%", "callouts at 150% of history". */
export function conditionPhrase(key: ConditionKey, value: number): string {
  switch (key) {
    case "goal":
      return `a ${conditionValue("goal", value)} service goal`;
    case "callouts":
      return `callouts at ${conditionValue("callouts", value)} of history`;
    case "demand":
      return `demand ${conditionValue("demand", value)}`;
    case "availability":
      return `regular staff ${conditionValue("availability", value)}`;
  }
}

/** The order conditions are named in sentences and chips: what changed in the world first, then the goal. */
export const PHRASE_ORDER: ConditionKey[] = ["demand", "callouts", "availability", "goal"];

/** "demand +10% and callouts at 150% of history" for the changed conditions. */
export function describeConditions(c: Conditions, defaults: Conditions): string {
  const parts = PHRASE_ORDER.filter((k) => Math.abs(c[k] - defaults[k]) > 1e-9).map((k) => conditionPhrase(k, c[k]));
  if (parts.length <= 1) return parts[0] ?? "the submitted conditions";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Quick starts. Each sets the conditions; Run still has to be pressed (except the empty state's demo button). */
export interface Preset {
  id: string;
  label: string;
  changes: Partial<Conditions>;
}
export const PRESETS: Preset[] = [
  { id: "busier", label: "Busier week", changes: { demand: 0.1, callouts: 1.5 } },
  { id: "illness", label: "Illness wave", changes: { callouts: 2, availability: -0.2 } },
  { id: "quieter", label: "Quieter week", changes: { demand: -0.05 } },
  { id: "goal", label: "Higher goal", changes: { goal: 0.975 } },
];
