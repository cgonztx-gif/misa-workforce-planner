import { Loader2, Play, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Card, HelpTip, SegmentedControl } from "../../components";
import { LabSlider } from "../../components/lab/LabSlider";
import { cn } from "../../lib/cn";
import { CONDITION_KEYS, conditionPhrase, conditionValue, PRESETS, sameConditions, snap, type Preset } from "./conditions";
import type { ConditionKey, Conditions, WhatIfLimits } from "./types";

export interface ConditionsPanelProps {
  scenario: string;
  scenarioName: string;
  defaults: Conditions;
  limits: WhatIfLimits;
  pending: Conditions;
  onPending: (next: Conditions) => void;
  /** The conditions of the results on screen, or null for the submitted plan. */
  applied: Conditions | null;
  running: boolean;
  onRun: () => void;
  onReset: () => void;
}

const ORIGIN_LABEL: Partial<Record<ConditionKey, string>> = { callouts: "History", demand: "Forecast" };

/** One control: label with help, the value, and the input. */
function Control({ label, help, value, changed, children }: { label: string; help: string; value: string; changed: boolean; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium text-ink-muted">{label}</span>
          <HelpTip>{help}</HelpTip>
        </div>
        <span className={cn("font-display text-title font-semibold whitespace-nowrap tnum", changed ? "text-accent-strong" : "text-ink")}>{value}</span>
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

/** The conditions card: four controls, quick starts, Reset and Run. */
export function ConditionsPanel({ scenario, scenarioName, defaults, limits, pending, onPending, applied, running, onRun, onReset }: ConditionsPanelProps) {
  const current = applied ?? defaults;
  const dirty = !sameConditions(pending, current);
  const canReset = applied !== null || !sameConditions(pending, defaults);
  const keys = CONDITION_KEYS.filter((k) => k !== "availability" || limits.availability);
  const set = (key: ConditionKey, value: number) => onPending({ ...pending, [key]: value });
  const usePreset = (p: Preset) => onPending({ ...defaults, ...p.changes });
  const presetActive = (p: Preset) => sameConditions(pending, { ...defaults, ...p.changes });

  return (
    <Card
      title="Conditions"
      description={
        <>
          Re-plans <span className="font-medium text-ink-muted">{scenario}</span>, {scenarioName.toLowerCase()}. Change the scenario in the top bar.
        </>
      }
      padding="none"
    >
      <div className={cn("grid gap-x-8 gap-y-6 px-5 pt-2 pb-5", keys.length === 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3")}>
        {keys.map((key) => {
          const changed = Math.abs(pending[key] - defaults[key]) > 1e-9;
          if (key === "goal") {
            return (
              <Control key={key} label={limits.goal.label} help={limits.goal.help} value={conditionValue("goal", pending.goal)} changed={changed}>
                <SegmentedControl<string>
                  label={limits.goal.label}
                  value={String(pending.goal)}
                  onChange={(v) => set("goal", Number(v))}
                  options={limits.goal.allowed.map((g) => ({ value: String(g), label: conditionValue("goal", g) }))}
                  className="flex w-full [&>*]:flex-1 [&>*]:justify-center"
                />
              </Control>
            );
          }
          const lim = limits[key]!;
          const fmt = (v: number) => conditionValue(key, v);
          const label = key === "callouts" ? "Callouts vs history" : key === "availability" ? "Regular staff" : "Demand vs forecast";
          return (
            <Control key={key} label={label} help={lim.help} value={fmt(pending[key])} changed={changed}>
              <LabSlider
                label={lim.label}
                value={pending[key]}
                onChange={(v) => set(key, snap(v, lim.step))}
                min={lim.min}
                max={lim.max}
                step={lim.step}
                origin={defaults[key]}
                originLabel={ORIGIN_LABEL[key]}
                format={fmt}
              />
            </Control>
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border bg-raised/60 px-5 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm text-ink-subtle">Quick start</span>
          {PRESETS.filter((p) => !("availability" in p.changes) || limits.availability).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => usePreset(p)}
              aria-pressed={presetActive(p)}
              title={Object.entries(p.changes)
                .map(([k, v]) => conditionPhrase(k as ConditionKey, v as number))
                .join(", ")}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium transition-colors",
                presetActive(p) ? "border-accent-line bg-accent-soft text-accent-strong" : "border-border-strong bg-surface text-ink-muted hover:border-accent-line hover:text-ink",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {dirty && !running && <span className="text-sm text-ink-subtle">Not run yet</span>}
          <Button icon={<RotateCcw />} onClick={onReset} disabled={!canReset}>
            Reset to submitted plan
          </Button>
          <Button variant="primary" icon={running ? <Loader2 className="animate-spin" /> : <Play />} onClick={onRun} disabled={!dirty || running} className="min-w-[148px]">
            {running ? "Running…" : "Run what-if"}
          </Button>
        </div>
      </footer>
    </Card>
  );
}
