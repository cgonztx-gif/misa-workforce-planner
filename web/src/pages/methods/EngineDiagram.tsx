import { Activity, ArrowRight, Calculator, Database, Dices, MessageSquareText, Search, TrendingUp, Workflow, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Tooltip } from "../../components";

interface Step {
  step: string;
  text: string;
}

const ICONS: [RegExp, LucideIcon][] = [
  [/data/i, Database],
  [/forecast/i, TrendingUp],
  [/curve/i, Activity],
  [/risk/i, Dices],
  [/allocation|cost/i, Calculator],
  [/search/i, Search],
  [/explanation/i, MessageSquareText],
];
const iconFor = (name: string) => ICONS.find(([re]) => re.test(name))?.[1] ?? Workflow;

/** "cross-trained" and the like stay on one line instead of splitting at the hyphen. */
function keepHyphenatedWhole(text: string): ReactNode {
  const parts = text.split(/(\w+-\w+)/);
  return parts.length === 1 ? text : parts.map((p, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{p}</span> : p));
}

function Node({ step, index, className }: { step: Step; index: number; className?: string }) {
  const Icon = iconFor(step.step);
  // Draft 3: the step's one-line description is its tooltip; the card shows the icon, number and name.
  return (
    <Tooltip content={keepHyphenatedWhole(step.text)} width={300}>
    <div tabIndex={0} className={cn("relative flex min-w-0 cursor-help flex-col rounded-card border border-border bg-raised/60 px-3.5 pt-3 pb-3.5 outline-none hover:border-accent-line focus-visible:ring-2 focus-visible:ring-accent", className)}>
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="text-sm font-medium text-ink-subtle tnum">Step {index + 1}</span>
      </div>
      <h3 className="mt-2.5 text-title-sm font-semibold leading-tight text-balance text-ink">{step.step}</h3>
      <p className="sr-only">{keepHyphenatedWhole(step.text)}</p>
    </div>
    </Tooltip>
  );
}

/** Steps in the first row when the flow wraps (below 2xl): 4 then 3, on a 12-column grid so both rows fill. */
const FIRST_ROW = 4;

/**
 * The engine as a left-to-right flow, one node per step in the API's order. One row of seven on wide
 * screens; two rows (4 + 3) below 1536px, so titles and text don't squeeze into 130px columns at 1366.
 * Arrows sit in the gaps, level with the step icons, so the eye reads across; the step numbers carry
 * the order from the end of the first row to the start of the second.
 */
export function EngineDiagram({ steps }: { steps: Step[] }) {
  const wraps = steps.length === 7;
  return (
    <ol
      className={cn("grid gap-5", wraps ? "grid-cols-2 md:grid-cols-12 2xl:grid-cols-7" : undefined)}
      style={wraps ? undefined : { gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      aria-label="How the engine works, in order"
    >
      {steps.map((s, i) => (
        <li key={s.step} className={cn("relative flex min-w-0", wraps && (i < FIRST_ROW ? "md:col-span-3" : "md:col-span-4"), wraps && "2xl:col-span-1")}>
          <Node step={s} index={i} className="w-full" />
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={cn(
                "absolute top-[22px] -right-[17px] z-[1] size-[14px] items-center justify-center text-accent",
                !wraps ? "inline-flex" : i === FIRST_ROW - 1 ? "hidden 2xl:inline-flex" : "hidden md:inline-flex",
              )}
            >
              <ArrowRight className="size-[14px]" strokeWidth={2.5} />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
