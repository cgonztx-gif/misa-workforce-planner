import * as Slider from "@radix-ui/react-slider";
import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { WhatIfSettings } from "../lib/types";
import { isDefault, LABEL, PRESETS, sameSettings, snap, TIP, valueText, WI_DEFAULTS, WI_LIMITS, type RangeKey } from "../lib/whatif";
import { Spinner } from "./StatusPill";

const DEBOUNCE_MS = 450;

/**
 * The what-if adjustments (D-33): presets, the service goal, and three sliders. Changes apply by themselves: a slider
 * commits 450 ms after it stops moving (one re-plan per gesture, not one per step), a preset, the goal or Reset at once.
 * Each slider marks where the submitted plan sits (a tick) and fills from there to the value, so "how far from
 * submitted" reads at a glance. Blue is the control colour; the values turn ink when they differ from submitted.
 */
export function AdjustPanel({ value, onChange, busy, id = "adjust" }: {
  value: WhatIfSettings;
  onChange: (s: WhatIfSettings) => void;
  busy: boolean;
  id?: string;
}) {
  // The sliders move freely; the page follows once they rest.
  const [pending, setPending] = useState<WhatIfSettings>(value);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
    setPending((p) => (sameSettings(p, value) ? p : value));
  }, [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commitSoon = (next: WhatIfSettings) => {
    setPending(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!sameSettings(next, latest.current)) onChange(next);
    }, DEBOUNCE_MS);
  };
  const commitNow = (next: WhatIfSettings) => {
    window.clearTimeout(timer.current);
    setPending(next);
    if (!sameSettings(next, latest.current)) onChange(next);
  };
  const changed = !isDefault(pending);

  return (
    <div className="flex flex-col" data-adjust={id}>
      <div className="flex h-7 items-center gap-2 px-2">
        <span className="text-[12px] text-muted" data-tip="Change the conditions and the plan re-plans by itself · the CSV stays the submitted file">
          Adjust
        </span>
        {/* The header pill says "Re-planning" in words; the narrow sidebar only needs the spinner. */}
        {busy && (
          <span className="inline-flex items-center" data-busy data-tip="Re-planning">
            <Spinner />
            <span className="sr-only" aria-live="polite">
              Re-planning
            </span>
          </span>
        )}
        <span className="flex-1" />
        {changed && (
          <button
            type="button"
            onClick={() => commitNow(WI_DEFAULTS)}
            data-reset
            data-tip="Back to the submitted plan"
            className="-mr-1 inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12.5px] text-ink-2 hover:bg-card hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <RotateCcw size={13} strokeWidth={1.9} />
            Reset
          </button>
        )}
      </div>

      {/* Presets */}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 px-1 short:mt-1 short:gap-1">
        {PRESETS.map((p) => {
          const on = sameSettings(pending, p.settings);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              data-preset={p.id}
              data-tip={p.tip}
              onClick={() => commitNow(on ? WI_DEFAULTS : p.settings)}
              className={`h-7 truncate rounded-full px-2 text-[12px] short:h-6 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                on ? "bg-accent/[.10] font-medium text-ink ring-1 ring-accent/35 ring-inset" : "border border-line bg-card/60 text-ink-2 hover:bg-card hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-3 px-2 short:mt-2 short:gap-1.5">
        {/* Service goal: four fixed values */}
        <div data-control="goal">
          <Row label={LABEL.goal} tip={TIP.goal} value={valueText.goal(pending.goal)} changed={Math.abs(pending.goal - WI_DEFAULTS.goal) > 1e-9} />
          <div className="mt-1.5 grid grid-cols-4 gap-0.5 rounded-full bg-soft p-0.5 short:mt-1" role="radiogroup" aria-label={LABEL.goal}>
            {WI_LIMITS.goal.map((g) => {
              const on = Math.abs(pending.goal - g) < 1e-9;
              return (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-goal={g}
                  onClick={() => commitNow({ ...pending, goal: g })}
                  className={`h-6 rounded-full text-[11.5px] tnum transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    on ? "bg-card font-medium text-ink shadow-[var(--shadow-pill)]" : "text-muted hover:text-ink"
                  }`}
                >
                  {+(g * 100).toFixed(1)}
                </button>
              );
            })}
          </div>
        </div>

        {(["callouts", "demand", "availability"] as RangeKey[]).map((k) => (
          <RangeControl key={k} k={k} v={pending[k]} onChange={(v) => commitSoon({ ...pending, [k]: v })} />
        ))}
      </div>
    </div>
  );
}

function Row({ label, tip, value, changed }: { label: string; tip: string; value: string; changed: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
      <span className="text-ink-2" data-tip={tip}>
        {label}
      </span>
      <span className={`tnum ${changed ? "font-semibold text-ink" : "text-muted"}`} data-value>
        {value}
      </span>
    </div>
  );
}

function RangeControl({ k, v, onChange }: { k: RangeKey; v: number; onChange: (v: number) => void }) {
  const lim = WI_LIMITS[k];
  const d = WI_DEFAULTS[k];
  const at = (x: number) => ((x - lim.min) / (lim.max - lim.min)) * 100;
  const lo = Math.min(at(d), at(v));
  const hi = Math.max(at(d), at(v));
  const changed = Math.abs(v - d) > 1e-9;
  return (
    <div data-control={k}>
      <Row label={LABEL[k]} tip={TIP[k]} value={valueText[k](v)} changed={changed} />
      <Slider.Root
        className="relative mt-1 flex h-5 w-full touch-none items-center select-none short:mt-0 short:h-4"
        min={lim.min}
        max={lim.max}
        step={lim.step}
        value={[v]}
        onValueChange={([x]) => onChange(snap(x, lim.step))}
        aria-label={LABEL[k]}
      >
        <Slider.Track className="relative h-1 grow rounded-full bg-line-strong">
          {/* from the submitted value to this one */}
          <span className="absolute inset-y-0 rounded-full bg-accent" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
        </Slider.Track>
        {/* where the submitted plan sits */}
        <span aria-hidden className="pointer-events-none absolute top-1/2 h-2.5 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/45" style={{ left: `${at(d)}%` }} />
        <Slider.Thumb
          className={`block size-4 rounded-full border-2 bg-card shadow-[0_1px_3px_rgb(0_0_0/.25)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            changed ? "border-accent" : "border-ink/45"
          }`}
          aria-valuetext={valueText[k](v)}
          data-thumb={k}
        />
      </Slider.Root>
    </div>
  );
}
