// The blocks that move most from the draft. Each row opens that block on the Schedule page.
import { ChevronRight, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { Card, DeltaChip, Tooltip } from "../../components";
import { signedInt, signedMoney } from "../../lib/format";
import { fmtChance } from "../../components/schedule/boardScales";
import type { Block } from "../../lib/types";

/** Draft (gray) to plan (iris) on a shared people scale from zero. */
function Dumbbell({ draft, plan, max }: { draft: number; plan: number; max: number }) {
  const x = (v: number) => `${(v / Math.max(max, 1)) * 100}%`;
  const lo = Math.min(draft, plan);
  const hi = Math.max(draft, plan);
  return (
    <div className="relative h-4 w-full" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent-line" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
      <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-draft ring-2 ring-surface" style={{ left: x(draft) }} />
      <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-plan ring-2 ring-surface" style={{ left: x(plan) }} />
    </div>
  );
}

export function LargestChanges({ blocks, showWarehouse, scenario, goal, allChanges }: { blocks: Block[]; showWarehouse: boolean; scenario: string; goal: number; allChanges: string }) {
  const max = Math.max(...blocks.map((b) => Math.max(b.plan, b.draft)), 1);
  const cols = "grid grid-cols-[minmax(0,1.6fr)_minmax(140px,1fr)_72px_minmax(0,0.8fr)_16px] gap-x-5";
  return (
    <Card
      title="Largest changes"
      description="The blocks the plan moves most from the draft: people, and the chance of meeting target, draft to plan. Click one to open it on the Schedule."
      actions={
        <Link to={allChanges} className="inline-flex items-center gap-0.5 text-sm font-medium text-accent hover:text-accent-strong">
          All changes <ChevronRight className="size-4" aria-hidden />
        </Link>
      }
      padding="none"
    >
      <div className="border-t border-border">
        <div className={`${cols} bg-raised px-5 py-2 text-sm text-ink-subtle`}>
          <span>Block</span>
          <span>People</span>
          <span className="text-right">Change</span>
          <span className="text-right">Chance</span>
          <span />
        </div>
        <ul className="divide-y divide-border">
          {blocks.map((b) => (
            <li key={b.key}>
              <Link
                to={`/schedule?scenario=${scenario}&wh=${b.store_id}&block=${encodeURIComponent(b.key)}`}
                title={`${b.label}${showWarehouse ? `, ${b.warehouse}` : ""}: ${b.draft} to ${b.plan} people, ${signedMoney(b.cost_change)} labor cost`}
                className={`group ${cols} h-12 items-center px-5 outline-none hover:bg-raised focus-visible:bg-accent-soft`}
              >
                <span className="flex min-w-0 items-center gap-2 text-base font-medium text-ink">
                  <span className="truncate">{b.label}</span>
                  {showWarehouse && <span className="shrink-0 text-sm font-normal text-ink-subtle">WH{b.store_id}</span>}
                  {b.below_goal && (
                    <Tooltip content="Below the goal, even at capacity">
                      <TriangleAlert className="size-4 shrink-0 text-warning" aria-label="Below the goal" />
                    </Tooltip>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tnum w-[52px] shrink-0 text-sm text-ink-muted">
                    {b.draft} <span className="text-ink-subtle">→</span> <span className="font-semibold text-ink">{b.plan}</span>
                  </span>
                  <Dumbbell draft={b.draft} plan={b.plan} max={max} />
                </span>
                <span className="text-right">
                  <DeltaChip value={b.change} format={signedInt} size="sm" />
                </span>
                <span className="tnum text-right text-sm whitespace-nowrap text-ink-muted">
                  {fmtChance(b.chance_draft, b.below_goal_draft, goal)} <span className="text-ink-subtle">→</span> <span className="font-semibold text-ink">{fmtChance(b.chance, b.below_goal, goal)}</span>
                </span>
                <ChevronRight className="size-4 text-ink-subtle group-hover:text-accent" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
