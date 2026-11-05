// The blocks that move most from the draft. Each row opens that block on the Schedule page.
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { Card, DeltaChip, deptColor, Tooltip } from "../../components";
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

export function LargestChanges({ blocks, showWarehouse, scenario, goal }: { blocks: Block[]; showWarehouse: boolean; scenario: string; goal: number }) {
  const max = Math.max(...blocks.map((b) => Math.max(b.plan, b.draft)), 1);
  return (
    <Card
      title="Largest changes from the draft"
      description="The blocks the plan moves most. Click one to open it on the Schedule."
      padding="none"
    >
      <div className="border-t border-border">
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(120px,1fr)_88px_minmax(0,0.9fr)_96px_20px] gap-x-4 bg-raised px-5 py-2 text-sm text-ink-subtle">
          <span>Block</span>
          <span>Draft to plan</span>
          <span className="text-right">Change</span>
          <span className="text-right">Chance of meeting target</span>
          <span className="text-right">Cost</span>
          <span />
        </div>
        <ul className="divide-y divide-border">
          {blocks.map((b) => (
            <li key={b.key}>
              <Link
                to={`/schedule?scenario=${scenario}&wh=${b.store_id}&block=${encodeURIComponent(b.key)}`}
                className="group grid grid-cols-[minmax(0,1.5fr)_minmax(120px,1fr)_88px_minmax(0,0.9fr)_96px_20px] items-center gap-x-4 px-5 py-2.5 outline-none hover:bg-raised focus-visible:bg-accent-soft"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 truncate text-base font-medium text-ink">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: deptColor(b.dept_id) }} />
                    <span className="truncate">{b.label}</span>
                    {b.below_goal && (
                      <Tooltip content="Below the goal, even at capacity">
                        <AlertTriangle className="size-4 shrink-0 text-risk" aria-label="Below the goal" />
                      </Tooltip>
                    )}
                  </span>
                  {showWarehouse && <span className="ml-[18px] block text-sm text-ink-subtle">{b.warehouse}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tnum w-[52px] shrink-0 text-sm text-ink-muted">
                    {b.draft} <span className="text-ink-subtle">to</span> <span className="font-semibold text-ink">{b.plan}</span>
                  </span>
                  <Dumbbell draft={b.draft} plan={b.plan} max={max} />
                </span>
                <span className="text-right">
                  <DeltaChip value={b.change} format={signedInt} size="sm" />
                </span>
                <span className="tnum text-right text-sm whitespace-nowrap text-ink-muted">
                  {fmtChance(b.chance_draft, b.below_goal_draft, goal)} <span className="text-ink-subtle">to</span> <span className="font-semibold text-ink">{fmtChance(b.chance, b.below_goal, goal)}</span>
                </span>
                <span className="tnum text-right text-sm text-ink-muted">{signedMoney(b.cost_change)}</span>
                <ChevronRight className="size-4 text-ink-subtle group-hover:text-accent" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
