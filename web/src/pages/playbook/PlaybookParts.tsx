import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Badge, Button, Card, DataTable, Tooltip, type Column } from "../../components";
import { cn } from "../../lib/cn";
import { fmtInt, fmtPct } from "../../lib/format";
import { SCENARIOS, type Block, type ScenarioCode } from "../../lib/types";
import type { DayRule, ScenarioPlay, TightBlock } from "./types";

/**
 * Draft 3: the engine writes each trigger and action as full sentences. On screen each shows its first clause,
 * which carries the verb and the number; the whole text is its tooltip.
 */
export function brief(text: string, cutAtComma = true): string {
  let t = text.split(/(?<=[.!?])\s+(?=[A-Z])/)[0];
  if (cutAtComma) t = t.split(", ")[0];
  return t.replace(/\s*\([^)]*\)/g, "").replace(/[.:;]$/, "");
}

const Brief = ({ text, cut = true, className }: { text: string; cut?: boolean; className?: string }) => {
  const short = brief(text, cut);
  return short === text.replace(/[.:;]$/, "") ? (
    <span className={className}>{short}</span>
  ) : (
    <Tooltip content={text} width={360}>
      <span tabIndex={0} className={cn("cursor-help decoration-border-strong decoration-dotted underline-offset-4 hover:underline", className)}>
        {short}
      </span>
    </Tooltip>
  );
};

/** When to use each scenario's plan, and what to do. The scenario on screen is marked; the others switch to it. */
export function ScenarioPlays({
  plays,
  current,
  onSwitch,
  inView,
}: {
  plays: Record<ScenarioCode, ScenarioPlay>;
  current: ScenarioCode;
  onSwitch: (s: ScenarioCode) => void;
  /** The scenario on screen at the selected warehouse(s): blocks below the goal and people short. */
  inView?: { where: string; blocks: number; short: number } | null;
}) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-3">
      {SCENARIOS.filter((code) => plays[code]).map((code) => {
        const play = plays[code];
        const on = code === current;
        return (
          <article
            key={code}
            aria-current={on || undefined}
            className={cn("flex min-w-0 flex-col rounded-card border bg-surface shadow-card", on ? "border-accent ring-1 ring-accent" : "border-border")}
          >
            <header className="flex items-start gap-2.5 px-5 pt-4">
              <Badge tone={on ? "accent" : "neutral"} className="mt-px">{code}</Badge>
              <h3 className="min-w-0 text-title-sm font-semibold text-ink">{play.name}</h3>
            </header>
            {on && inView && (
              <div className="mx-5 mt-3">
                {inView.blocks > 0 ? (
                  <Badge tone="warning" icon={<AlertTriangle />} title={`At ${inView.where}`}>
                    {fmtInt(inView.blocks)} below goal · {fmtInt(inView.short)} short
                  </Badge>
                ) : (
                  <Badge tone="good" icon={<CheckCircle2 />} title={`At ${inView.where}`}>
                    Every block meets the goal
                  </Badge>
                )}
              </div>
            )}
            <div className="mx-5 mt-3 rounded-control bg-raised px-3.5 py-2.5">
              <p className="text-sm font-semibold text-ink">When</p>
              <p className="mt-0.5 text-base leading-snug text-ink-muted">
                <Brief text={play.trigger} cut={false} />
              </p>
            </div>
            <div className="px-5 pt-3 pb-5">
              <p className="text-sm font-semibold text-ink">Do</p>
              <ol className="mt-1.5 space-y-2">
                {play.actions.map((a, i) => (
                  <li key={i} className="flex gap-2.5 text-base leading-snug text-ink-muted">
                    <span aria-hidden className={cn("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-sm font-semibold tnum", on ? "bg-accent text-on-accent" : "bg-raised text-ink-muted ring-1 ring-border")}>
                      {i + 1}
                    </span>
                    <Brief text={a} />
                  </li>
                ))}
              </ol>
            </div>
            <footer className="mt-auto flex items-center justify-between gap-3 border-t border-border px-5 py-2.5">
              {on ? (
                <span className="inline-flex h-8 items-center gap-1.5 text-sm font-medium text-accent-strong">
                  <CheckCircle2 className="size-4" aria-hidden />
                  On screen
                </span>
              ) : (
                <Button size="sm" onClick={() => onSwitch(code)} icon={<ArrowRight />} className="flex-row-reverse">
                  Switch to {code}
                </Button>
              )}
            </footer>
          </article>
        );
      })}
    </div>
  );
}

/** The Streamlit app put each block's cushion on a "Why" tab; in this app it's in the block's details. */
const fixWording = (text: string) => text.replace("Each block's own cushion is on the Why tab.", "Each block's own cushion is in its details on the Schedule page.");

/** Rules for the day: when this happens, do that. */
export function DayRules({ rules }: { rules: DayRule[] }) {
  return (
    <Card title="Rules for the day" description="What a shift lead does when the day doesn't go to plan. Hover a rule for the full text." padding="none">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] border-t border-border">
        <div className="border-b border-border bg-raised px-5 py-2 text-sm font-medium text-ink-subtle">When</div>
        <div className="border-b border-border bg-raised px-5 py-2 text-sm font-medium text-ink-subtle">Do this</div>
        {rules.map((r, i) => (
          <div key={i} className="contents">
            <div className={cn("px-5 py-3.5 text-base leading-snug font-medium text-ink", i < rules.length - 1 && "border-b border-border")}>
              <Brief text={r.trigger} cut={false} />
            </div>
            <div className={cn("flex gap-2.5 px-5 py-3.5 text-base leading-snug text-ink-muted", i < rules.length - 1 && "border-b border-border")}>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <Brief text={fixWording(r.action)} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** The Schedule page with this block's drawer open, in its own warehouse. */
export const scheduleLink = (b: { key: string; store_id: number }, scenario: ScenarioCode) =>
  `/schedule?${new URLSearchParams({ scenario, wh: String(b.store_id), block: b.key }).toString()}`;

/** The blocks with the least cushion, each linking to its block on the Schedule page. */
export function TightestTable({ rows, scenario, blockByKey, showWarehouse }: { rows: TightBlock[]; scenario: ScenarioCode; blockByKey: Map<string, Block>; showWarehouse: boolean }) {
  const navigate = useNavigate();
  const columns: Column<TightBlock>[] = [
    {
      key: "label",
      header: "Block",
      value: (r) => r.label,
      sortable: false,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{r.label}</div>
          {showWarehouse && <div className="text-sm text-ink-subtle">{r.warehouse}</div>}
        </div>
      ),
    },
    { key: "plan", header: "Plan", value: (r) => r.plan, align: "right", width: "72px" },
    { key: "people", header: "Can lose", title: "People the block can lose before a miss becomes the likelier outcome", value: (r) => r.cushion_people, align: "right", width: "104px", render: (r) => (r.cushion_people == null ? "–" : `${fmtInt(r.cushion_people)} ${r.cushion_people === 1 ? "person" : "people"}`) },
    { key: "demand", header: "Extra demand", title: "Extra demand the block can take before a miss becomes the likelier outcome", value: (r) => r.cushion_demand, align: "right", width: "124px", render: (r) => fmtPct(r.cushion_demand, 0) },
    {
      key: "chance",
      header: "Chance",
      title: "Chance of meeting target with the plan's headcount",
      value: (r) => r.chance,
      align: "right",
      width: "170px",
      render: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          {blockByKey.get(r.key)?.below_goal && (
            <Badge tone="risk" icon={<AlertTriangle />}>
              Below goal
            </Badge>
          )}
          {fmtPct(r.chance)}
        </span>
      ),
    },
    {
      key: "open",
      header: <span className="sr-only">Open</span>,
      value: () => null,
      sortable: false,
      width: "150px",
      align: "right",
      render: (r) => (
        <Link to={scheduleLink(r, scenario)} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip text-sm font-medium text-accent hover:text-accent-strong hover:underline">
          On Schedule
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      ),
    },
  ];
  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.key} onRowClick={(r) => navigate(scheduleLink(r, scenario))} dense caption="Blocks with the least cushion" />;
}
