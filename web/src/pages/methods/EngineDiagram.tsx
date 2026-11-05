import { Activity, ArrowRight, Calculator, Database, Dices, MessageSquareText, Search, TrendingUp, Workflow, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

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

function Node({ step, index, className }: { step: Step; index: number; className?: string }) {
  const Icon = iconFor(step.step);
  return (
    <div className={cn("relative flex min-w-0 flex-col rounded-card border border-border bg-raised/60 px-3.5 pt-3 pb-3.5", className)}>
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="text-sm font-medium text-ink-subtle tnum">Step {index + 1}</span>
      </div>
      <h3 className="mt-2.5 text-title-sm font-semibold leading-tight text-ink">{step.step}</h3>
      <p className="mt-1 text-sm leading-snug text-ink-muted">{step.text}</p>
    </div>
  );
}

/**
 * The engine as a left-to-right flow, one node per step in the API's order.
 * Arrows sit in the gaps, level with the step icons, so the eye reads across.
 */
export function EngineDiagram({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid gap-5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="How the engine works, in order">
      {steps.map((s, i) => (
        <li key={s.step} className="relative flex min-w-0">
          <Node step={s} index={i} className="w-full" />
          {i < steps.length - 1 && (
            <span aria-hidden className="absolute top-[22px] -right-[17px] z-[1] inline-flex size-[14px] items-center justify-center text-accent">
              <ArrowRight className="size-[14px]" strokeWidth={2.5} />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
