// Small visual pieces of the block drawer. Every figure comes straight from the block.
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { fmtPct } from "../../lib/format";
import type { Block } from "../../lib/types";
import { tokens } from "../../styles/tokens";
import { fmtChance } from "./boardScales";

const c = tokens.color;

/** Draft and plan chance of meeting target on one 0-100% scale, with the goal marked. */
export function ServiceBars({ block, goal }: { block: Block; goal: number }) {
  const rows = [
    { label: "Draft", value: block.chance_draft, below: block.below_goal_draft, color: c.draft, strong: false },
    { label: "Plan", value: block.chance, below: block.below_goal, color: c.plan, strong: true },
  ];
  return (
    <div className="mt-3">
      <div className="relative">
        {rows.map((r) => (
          <div key={r.label} className="mb-2 grid grid-cols-[52px_1fr_52px] items-center gap-3">
            <span className={cn("text-sm", r.strong ? "font-semibold text-ink" : "text-ink-muted")}>{r.label}</span>
            <div className="relative h-3.5 rounded-full bg-raised ring-1 ring-border ring-inset">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${Math.max(1.5, (r.value ?? 0) * 100)}%`, background: r.color }}
              />
            </div>
            <span className={cn("tnum text-right text-base", r.strong ? "font-semibold text-ink" : "text-ink-muted")}>{fmtChance(r.value, r.below, goal)}</span>
          </div>
        ))}
        {/* The goal: a tick through both bars. */}
        <div className="pointer-events-none absolute inset-y-[-4px] right-[64px] left-[64px]" aria-hidden>
          <div className="absolute inset-y-0 w-0 border-l-2 border-dashed border-ink" style={{ left: `${goal * 100}%` }} />
        </div>
      </div>
      <div className="relative mr-[64px] ml-[64px] h-5" aria-hidden>
        <span className="absolute -translate-x-1/2 text-sm whitespace-nowrap text-ink-subtle" style={{ left: `${goal * 100}%` }}>
          {fmtPct(goal, 0)} goal
        </span>
      </div>
    </div>
  );
}

/** A labeled figure: "Plan cost / $3,647". */
export function Stat({ label, value, sub, tone = "default" }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "default" | "accent" | "muted" }) {
  return (
    <div className={cn("min-w-0 rounded-control border px-3 py-2.5", tone === "accent" ? "border-accent-line bg-accent-soft/60" : "border-border bg-raised")}>
      <div className="text-sm text-ink-subtle">{label}</div>
      <div className={cn("tnum mt-0.5 font-display text-[22px] leading-tight font-semibold", tone === "muted" ? "text-ink-muted" : "text-ink")}>{value}</div>
      {sub && <div className="tnum mt-0.5 text-sm text-ink-subtle">{sub}</div>}
    </div>
  );
}

const SOURCES = [
  { key: "regular", label: "Regular" },
  { key: "flex", label: "Cross-trained" },
  { key: "overtime", label: "Overtime" },
] as const;

const PLAN_FILLS = [c.accent_strong, tokens.scale.change.stops[5], c.accent_line];
const DRAFT_FILLS = [c.draft, c.border_strong, c.draft_soft];

function StackBar({ parts, fills, total, unfilled = 0 }: { parts: number[]; fills: string[]; total: number; unfilled?: number }) {
  const all = Math.max(total, 1);
  return (
    <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-raised">
      {parts.map((n, i) => (n > 0 ? <div key={i} style={{ width: `${(n / all) * 100}%`, background: fills[i] }} /> : null))}
      {unfilled > 0 && (
        <div
          style={{ width: `${(unfilled / all) * 100}%`, background: `repeating-linear-gradient(135deg, ${c.risk_soft} 0 4px, ${c.risk} 4px 5.5px)` }}
        />
      )}
    </div>
  );
}

/** Where the people come from: plan, draft and what the block can field, by source, each with a bar on one scale. */
export function SourcesTable({ block }: { block: Block }) {
  const plan = [block.sources.regular, block.sources.flex, block.sources.overtime];
  const draft = [block.draft_sources.regular, block.draft_sources.flex, block.draft_sources.overtime];
  const avail = [block.availability.regular, block.availability.usable_flex, block.availability.overtime];
  const unfilled = block.draft_sources.unfilled;
  const scale = Math.max(block.availability.capacity, block.plan, block.draft); // the draft total includes unfilled people
  const rows = [
    { label: "Plan", values: plan, total: block.plan, fills: PLAN_FILLS, tone: "strong", unfilled: 0 },
    { label: "Draft", values: draft, total: block.draft, fills: DRAFT_FILLS, tone: "muted", unfilled },
    { label: "Can field", values: avail, total: block.availability.capacity, fills: [c.border_strong, c.border_strong, c.border_strong], tone: "avail", unfilled: 0 },
  ] as const;
  // In a wide drawer each bar sits in its own column; in the narrow one (below 480px) it runs the full width
  // under the row's numbers, drawn from the label cell so the table keeps one row per source line.
  const wideBar = "hidden @min-[480px]:table-cell";
  const pad = "pt-2 pb-7 @min-[480px]:pb-2";
  return (
    <div className="@container">
    <table className="tnum mt-3 w-full text-base">
      <thead>
        <tr className="text-sm text-ink-subtle">
          <th className="pb-1.5 text-left font-normal" />
          <th className={cn("w-[34%] pb-1.5 font-normal", wideBar)} />
          {SOURCES.map((s, i) => (
            <th key={s.key} className="pb-1.5 pl-2 text-right font-normal whitespace-nowrap">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm" style={{ background: PLAN_FILLS[i] }} />
                {s.label}
              </span>
            </th>
          ))}
          <th className="pb-1.5 pl-2 text-right font-normal">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const strong = r.tone === "strong";
          const ink = strong ? "text-ink" : "text-ink-muted";
          const bar = <StackBar parts={[...r.values]} fills={[...r.fills]} total={scale} unfilled={r.unfilled} />;
          return (
            <tr key={r.label} className="border-t border-border">
              <td className={cn("relative pr-3 align-top text-sm whitespace-nowrap", pad, strong ? "font-semibold text-ink" : "text-ink-muted")}>
                {r.label}
                <div aria-hidden className="absolute bottom-3 left-0 w-[100cqw] @min-[480px]:hidden">
                  {bar}
                </div>
              </td>
              <td className={cn("py-2 align-middle", wideBar)} aria-hidden>
                {bar}
              </td>
              {r.values.map((v, i) => (
                <td key={i} className={cn("pl-2 text-right align-top", pad, ink)}>
                  {v}
                </td>
              ))}
              <td className={cn("pl-2 text-right align-top whitespace-nowrap", pad, strong ? "font-semibold text-ink" : "text-ink-muted")}>
                {r.total}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    {unfilled > 0 && (
      <p className="mt-2 flex items-center gap-2 text-sm text-risk-ink">
        <span aria-hidden className="inline-block h-3 w-6 rounded-sm" style={{ background: `repeating-linear-gradient(135deg, ${c.risk_soft} 0 4px, ${c.risk} 4px 5.5px)` }} />
        <span title={`The draft's total includes ${unfilled} ${unfilled === 1 ? "person" : "people"} this block can't field.`}>
          {unfilled} over capacity
        </span>
      </p>
    )}
    </div>
  );
}
