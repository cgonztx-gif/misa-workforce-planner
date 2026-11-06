import { Maximize2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { blockId, DEPT_SHORT, SHIFT_SHORT } from "../lib/board";
import { chanceText, int, share, signed, usdCompact } from "../lib/format";
import type { Block, CompareResponse, GroupTotals, Meta, PlanResponse, ScenarioCode, WarehouseKey } from "../lib/types";
import { Segmented } from "./Segmented";

export type RankTab = "changes" | "depts" | "warehouses" | "scenarios";

export interface RankRow {
  id: string;
  name: ReactNode;
  title: string;
  chip?: ReactNode;
  value: string;
  aside: string;
  pct: number;
  bar: string;
  tip?: string;
  selected?: boolean;
  onClick?: () => void;
  dataKey?: string;
}

const SCEN_SHORT: Record<ScenarioCode, string> = { BASE: "Base", PEAK: "Peak", DISRUPT: "Disrupt" };

export function RankRowView({ r }: { r: RankRow }) {
  const body = (
    <>
      <span aria-hidden className="absolute inset-x-3 bottom-[5px] h-[3px] overflow-hidden rounded-full bg-line/70">
        <span className={`absolute inset-y-0 left-0 rounded-full opacity-75 transition-opacity group-hover:opacity-100 ${r.bar}`} style={{ width: `${Math.max(1.5, Math.min(100, r.pct))}%` }} />
      </span>
      <span className="relative flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate" title={r.title}>
          {r.name}
        </span>
        {r.chip}
      </span>
      <span className="relative shrink-0 text-right text-ink tnum">{r.value}</span>
      <span className="relative w-[4.5rem] shrink-0 text-right text-[13px] text-muted tnum">{r.aside}</span>
    </>
  );
  const cls = `group relative flex h-11 w-full shrink-0 items-center gap-3 rounded-[10px] px-3 pb-1.5 text-left text-[14px] ${
    r.selected ? "bg-accent/[.06] ring-1 ring-accent/20 ring-inset" : r.onClick ? "hover:bg-soft/60" : ""
  }`;
  return r.onClick ? (
    <button type="button" className={`${cls} focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent`} onClick={r.onClick} data-tip={r.tip} data-key={r.dataKey} aria-current={r.selected || undefined}>
      {body}
    </button>
  ) : (
    <div className={cls} data-tip={r.tip} data-key={r.dataKey}>
      {body}
    </div>
  );
}

const warnChip = (n: number) =>
  n > 0 ? (
    <span className="shrink-0 rounded-full bg-warn/15 px-1.5 text-[11px] leading-[18px] font-medium text-ink tnum" data-tip={`${int(n)} below goal`}>
      {int(n)}
    </span>
  ) : null;

export function rankRows(tab: RankTab, ctx: {
  T: GroupTotals;
  plan: PlanResponse;
  wk: WarehouseKey;
  meta: Meta;
  compare?: CompareResponse;
  scenario: ScenarioCode;
  selId: string | null;
  onBlock: (b: Block) => void;
  onWk: (wk: WarehouseKey) => void;
  onScenario: (s: ScenarioCode) => void;
  wide?: boolean;
}): { rows: RankRow[]; foot: string; head: [string, string, string] } {
  const { T, plan, wk, meta } = ctx;
  const people = T.plan.employees;
  if (tab === "changes") {
    const byKey = new Map(plan.blocks.map((b) => [b.key, b]));
    const blocks = T.largest_changes.map((k) => byKey.get(k)).filter((b): b is Block => !!b);
    const max = Math.max(1, ...blocks.map((b) => Math.abs(b.change)));
    return {
      head: ["Block", "Change", ""],
      foot: "vs draft",
      rows: blocks.map((b) => ({
        id: b.key,
        dataKey: b.key,
        title: `${b.label} · ${b.warehouse}`,
        name: (
          <>
            {b.day_short} ·{" "}
            {ctx.wide ? (
              b.department
            ) : (
              <>
                <span className="@max-[26rem]:hidden">{b.department}</span>
                <span className="hidden @max-[26rem]:inline">{DEPT_SHORT[b.dept_id]}</span>
              </>
            )}{" "}
            · {SHIFT_SHORT[b.shift_code]}
          </>
        ),
        chip: wk === "all" ? <span className="shrink-0 rounded bg-ink/[.05] px-1 text-[11px] leading-[16px] text-ink-2 tnum">W{b.store_id}</span> : undefined,
        value: signed(b.change),
        aside: `${int(b.draft)} → ${int(b.plan)}`,
        pct: (100 * Math.abs(b.change)) / max,
        bar: b.change >= 0 ? "bg-accent" : "bg-ink/25",
        tip: `${b.explanation.headline}\n${b.label} · ${b.warehouse}`,
        selected: ctx.selId === blockId(b),
        onClick: () => ctx.onBlock(b),
      })),
    };
  }
  if (tab === "depts") {
    return {
      head: ["Department", "People", ""],
      foot: `of ${int(people)} people`,
      rows: T.by_department.map((d) => ({
        id: String(d.dept_id),
        title: d.department,
        name: d.department,
        chip: warnChip(d.plan.below_goal),
        value: int(d.plan.employees),
        aside: share((100 * d.plan.employees) / people),
        pct: (100 * d.plan.employees) / people,
        bar: "bg-accent",
        tip: `${d.department} · ${usdCompact(d.plan.cost)} · service ${chanceText(d.plan.expected_met)}\n${typeof meta.departments.find((x) => x.id === d.dept_id)?.service_target === "string" ? meta.departments.find((x) => x.id === d.dept_id)?.service_target : ""}`,
      })),
    };
  }
  if (tab === "warehouses") {
    return {
      head: ["Warehouse", "People", ""],
      foot: `of ${int(people)} people`,
      rows: meta.warehouses.map((w) => {
        const t = plan.totals[String(w.id) as WarehouseKey];
        return {
          id: String(w.id),
          title: w.label,
          name: (
            <>
              {w.label} <span className="text-muted">{w.size}</span>
            </>
          ),
          chip: warnChip(t.plan.below_goal),
          value: int(t.plan.employees),
          aside: share((100 * t.plan.employees) / people),
          pct: (100 * t.plan.employees) / people,
          bar: "bg-accent",
          tip: `${w.label} · ${usdCompact(t.plan.cost)} · service ${chanceText(t.plan.expected_met)}\nShow this warehouse`,
          onClick: () => ctx.onWk(String(w.id) as WarehouseKey),
        };
      }),
    };
  }
  const scen = ctx.compare?.scenarios ?? [];
  return {
    head: ["Scenario", "Service", "Cost"],
    foot: `${int(scen.length)} scenarios`,
    rows: scen.map((s) => {
      const src = wk === "all" ? s : s.by_warehouse.find((x) => String(x.store_id) === wk) ?? s;
      return {
        id: s.code,
        title: s.name,
        name: SCEN_SHORT[s.code],
        value: chanceText(src.plan.expected_met),
        aside: usdCompact(src.plan.cost),
        pct: 100 * (src.plan.expected_met ?? 0),
        bar: "bg-accent",
        tip: `${s.name}\n${s.description}\nBelow goal ${int(src.plan.below_goal)} · People ${int(src.plan.employees)}`,
        selected: s.code === ctx.scenario,
        onClick: () => ctx.onScenario(s.code),
      };
    }),
  };
}

/** The tabbed ranked card (ranked-lists.jpg): at most 7 rows, a 7-row minimum height, so tabs never jump. */
export function RankedCard(props: Omit<Parameters<typeof rankRows>[1], "wide"> & { onExpand: (tab: RankTab) => void }) {
  const [tab, setTab] = useState<RankTab>("changes");
  const tabs: { value: RankTab; label: ReactNode; title: string }[] = [
    { value: "changes", label: "Changes", title: "Changes" },
    {
      value: "depts",
      label: (
        <>
          <span className="@max-[22rem]:hidden">Departments</span>
          <span className="hidden @max-[22rem]:inline">Depts</span>
        </>
      ),
      title: "Departments",
    },
    ...(props.wk === "all" ? [{ value: "warehouses" as RankTab, label: "Warehouses", title: "Warehouses" }] : []),
    { value: "scenarios", label: "Scenarios", title: "Scenarios" },
  ];
  const active = tabs.some((t) => t.value === tab) ? tab : "changes";
  const { rows, foot, head } = rankRows(active, props);

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2">
        <Segmented items={tabs} value={active} onChange={setTab} label="Breakdown" dense className="min-w-0" />
        <span className="flex-1" />
        <button type="button" onClick={() => props.onExpand(active)} aria-label="Expand" data-tip="All rows" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
          <Maximize2 size={15} strokeWidth={1.75} />
        </button>
      </div>
      {/* Column heads sit over the columns they name (ranked-lists.jpg): the main value right-aligned over its
          figures, the muted second column headed only when it is a measure of its own (Scenarios: Cost). */}
      <div className="mt-3 flex items-center gap-3 px-3 text-[12px] text-muted">
        <span className="flex-1">{head[0]}</span>
        <span className="shrink-0 text-right">{head[1]}</span>
        <span className="w-[4.5rem] shrink-0 text-right">{head[2]}</span>
      </div>
      <div className="mt-1 flex min-h-[308px] flex-col fade-in" key={active}>
        {rows.slice(0, 7).map((r) => (
          <RankRowView key={r.id} r={r} />
        ))}
      </div>
      <div className="mt-auto flex h-8 items-center pt-1 pl-3 text-[12px] text-muted tnum">
        <span>{foot}</span>
      </div>
    </div>
  );
}
