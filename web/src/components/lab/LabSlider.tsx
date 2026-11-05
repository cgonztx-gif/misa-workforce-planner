import * as S from "@radix-ui/react-slider";
import { cn } from "../../lib/cn";

export interface LabSliderProps {
  /** Accessible name, e.g. "Demand against forecast". */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /** Where "no change" sits. The filled span runs from here to the value, so a cut and a rise read differently. */
  origin: number;
  /** Text for the origin tick, e.g. "Forecast". */
  originLabel?: string;
  /** Formats the ends and the screen-reader value. */
  format: (value: number) => string;
  disabled?: boolean;
}

/**
 * A slider for one what-if condition (Radix Slider: arrow keys, Page Up/Down, Home/End).
 * The filled span starts at the origin rather than the minimum, and the origin is marked on the track.
 */
export function LabSlider({ label, value, onChange, min, max, step, origin, originLabel, format, disabled }: LabSliderProps) {
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  const pOrigin = pos(origin);
  const pValue = pos(value);
  const changed = Math.abs(value - origin) > 1e-9;
  return (
    <div className="pt-1">
      <S.Root
        className="relative flex h-6 w-full touch-none items-center select-none data-[disabled]:opacity-50"
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
      >
        <S.Track className="relative h-1.5 grow rounded-full bg-border">
          {/* Filled span from the origin to the value. */}
          <span
            aria-hidden
            className={cn("absolute inset-y-0 rounded-full", changed ? "bg-accent" : "bg-transparent")}
            style={{ left: `${Math.min(pOrigin, pValue)}%`, width: `${Math.abs(pValue - pOrigin)}%` }}
          />
          <S.Range className="absolute h-full bg-transparent" />
        </S.Track>
        {/* The origin tick, above the track. */}
        {pOrigin > 0.5 && pOrigin < 99.5 && <span aria-hidden className="pointer-events-none absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-subtle/70" style={{ left: `${pOrigin}%` }} />}
        <S.Thumb
          aria-label={label}
          aria-valuetext={format(value)}
          className={cn(
            "block size-5 rounded-full border-2 bg-surface shadow-card transition-colors outline-none",
            "focus-visible:ring-4 focus-visible:ring-accent/25",
            changed ? "border-accent" : "border-border-strong hover:border-accent",
          )}
        />
      </S.Root>
      <div className="relative mt-1.5 h-5 text-sm text-ink-subtle tnum">
        <span className="absolute left-0">{format(min)}</span>
        {originLabel && pOrigin > 12 && pOrigin < 88 && (
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pOrigin}%` }}>
            {originLabel}
          </span>
        )}
        <span className="absolute right-0">{format(max)}</span>
      </div>
    </div>
  );
}
