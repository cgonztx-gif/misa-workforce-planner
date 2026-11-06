import { ArrowRight, Clock, PhoneOff, TrendingDown, TrendingUp } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { chanceText, int, usd, usdCompact } from "../../lib/format";
import { niceTicks } from "../../lib/ticks";
import type { CapacityGap, CompareResponse, Meta, PlaybookResponse, PtoRow, ScenarioCode, TightBlock } from "../../lib/types";
import { Segmented } from "../Segmented";
import { CardHead, Key, ScopeChip } from "../StatTile";

/**
 * Figures inside a sentence in semibold ink, so the numbers scan first: money ("$377,504"), percentages ("30%"),
 * signed changes ("-370 hours") and counts with their unit ("975 hours", "36 more people", "39 blocks"). Bare numbers
 * in names and dates ("Warehouse 2", "Feb 13-16") stay plain.
 */
const FIGURE = /(\$[\d,]+(?:\.\d+)?k?|(?<![\w-])[+−-]\d[\d,]*(?:\.\d+)?%?(?: hours| people| blocks)?|\d+(?:[-–]\d+)?%|\d[\d,]*(?:\.\d+)? (?:more |fewer )?(?:hours|people|blocks|minutes|employee shifts|person))/g;
export function Figures({ text }: { text: string }) {
  const parts = text.split(FIGURE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-semibold text-ink tnum">
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

// ---- The PTO lever ------------------------------------------------------------------------------------------------

/**
 * Holiday PTO kept per block, 0 to 5 (A-16): one column per level, each a button that sets the lever. The column is
 * the blocks still below goal, split into those that lost holiday PTO (the part keeping PTO can fix, solid red) and
 * the rest (pale red). Under each column: service and cost at that level. Level 0 is the submitted plan.
 */
export function PtoLever({ rows, level, onLevel }: { rows: PtoRow[]; level: number; onLevel: (k: number) => void }) {
  const max = Math.max(...rows.map((r) => r.blocks_below_goal));
  const ticks = niceTicks(max * 1.1, 4);
  const top = ticks[ticks.length - 1];
  const h = (v: number) => `${(v / top) * 100}%`;
  return (
    <div data-chart="pto">
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[12px] text-muted">
        <Key swatch="h-3 w-3 rounded-[3px] bg-bad/85" label="Below goal, holiday PTO" tip="Blocks below goal that lost people to holiday PTO: keeping PTO can fix these" />
        <Key swatch="h-3 w-3 rounded-[3px] bg-bad/30" label="Below goal, other causes" tip="Blocks below goal for other reasons (illness, crew shortages, demand)" />
      </div>
      <div className="mt-3 flex">
        <div className="relative w-8 shrink-0" aria-hidden>
          <div className="relative h-[250px] compact:h-[200px]">
            {ticks.map((t) => (
              <span key={t} className="absolute right-2 translate-y-1/2 text-[11.5px] text-muted tnum" style={{ bottom: h(t) }}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[250px] compact:h-[200px]" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className={`absolute inset-x-0 h-px ${t === 0 ? "bg-line-strong" : "bg-line"}`} style={{ bottom: h(t) }} />
            ))}
          </div>
          <div className="relative grid grid-cols-6 gap-2" role="radiogroup" aria-label="Holiday PTO kept per block">
            {rows.map((r) => {
              const on = r.kept_per_block === level;
              const pto = r.below_goal_with_holiday_pto;
              const other = r.blocks_below_goal - pto;
              return (
                <button
                  key={r.kept_per_block}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-level={r.kept_per_block}
                  onClick={() => onLevel(r.kept_per_block)}
                  data-tip-title={`${int(r.blocks_below_goal)} blocks below goal`}
                  data-tip={`Keep up to ${r.kept_per_block} per block · ${int(r.people_kept)} people kept\n${int(pto)} with holiday PTO · ${int(other)} other causes\nService ${chanceText(r.expected_met)} · cost ${usd(r.cost)} · overtime ${int(r.overtime_hours)} h`}
                  className={`group flex flex-col rounded-[12px] pb-2 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    on ? "bg-accent/[.07] ring-1 ring-accent/25 ring-inset" : "hover:bg-soft/60"
                  }`}
                >
                  <div className="relative h-[250px] compact:h-[200px]">
                    <span className={`absolute inset-x-0 text-center text-[14px] font-semibold tnum ${on ? "text-ink" : "text-ink-2"}`} style={{ bottom: `calc(${h(r.blocks_below_goal)} + 6px)` }}>
                      {int(r.blocks_below_goal)}
                    </span>
                    <div className="absolute inset-x-[24%] bottom-0 flex h-full flex-col justify-end">
                      {other > 0 && <span className="block rounded-t-[6px] bg-bad/30" style={{ height: h(other) }} />}
                      {pto > 0 && <span className={`block bg-bad/85 ${other > 0 ? "" : "rounded-t-[6px]"}`} style={{ height: h(pto) }} />}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-col items-center leading-tight">
                    <span className={`text-[14px] font-semibold tnum ${on ? "text-accent" : "text-ink-2"}`}>{r.kept_per_block === 0 ? "0" : `${r.kept_per_block}`}</span>
                    <span className="text-[11px] text-muted">{r.kept_per_block === 0 ? "Submitted" : "per block"}</span>
                    <span className="mt-1 text-[11.5px] text-ink-2 tnum">{chanceText(r.expected_met)}</span>
                    <span className="text-[11.5px] text-muted tnum">{usdCompact(r.cost)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Slot: the plan to run ----------------------------------------------------------------------------------------

const SC_LABEL: Record<ScenarioCode, string> = { BASE: "Base", PEAK: "Peak", DISRUPT: "Disrupt" };

/** The scenario's play: when to switch to it, the numbers that define it, then its steps, numbered. */
export function PlanToRun({ playbook, compare, scenario, onScenario }: { playbook: PlaybookResponse; compare?: CompareResponse; scenario: ScenarioCode; onScenario: (s: ScenarioCode) => void }) {
  const play = playbook.scenarios[scenario];
  const c = compare?.scenarios.find((s) => s.code === scenario);
  return (
    <div className="flex h-full min-h-0 flex-col" data-detail="play" data-scenario={scenario}>
      <CardHead title="The plan to run" sub={play.name} />
      <div className="mt-3">
        <Segmented
          label="Scenario"
          value={scenario}
          onChange={onScenario}
          items={(["BASE", "PEAK", "DISRUPT"] as ScenarioCode[]).map((s) => ({ value: s, label: SC_LABEL[s], title: playbook.scenarios[s].name }))}
        />
      </div>
      {c && (
        <div className="mt-4 grid grid-cols-3 gap-3" data-play-stats>
          <div data-tip={`${int(c.plan.hours)} hours`}>
            <div className="text-[12px] text-muted">Cost</div>
            <div className="text-[17px] leading-tight font-semibold tnum">{usdCompact(c.plan.cost)}</div>
          </div>
          <div data-tip="Overtime hours to approve ahead of time">
            <div className="text-[12px] text-muted">Overtime</div>
            <div className="text-[17px] leading-tight font-semibold tnum">{int(c.plan.overtime_hours)} h</div>
          </div>
          <div data-tip="Blocks below the goal even with every available person">
            <div className="text-[12px] text-muted">Below goal</div>
            <div className="text-[17px] leading-tight font-semibold tnum">{int(c.plan.below_goal)}</div>
          </div>
        </div>
      )}
      <div className="mt-4 rounded-[12px] bg-soft/70 px-3 py-2.5" data-trigger>
        <div className="text-[11.5px] font-medium tracking-wide text-muted uppercase">When</div>
        <div className="mt-0.5 text-[13px] leading-snug text-ink-2">
          <Figures text={play.trigger} />
        </div>
      </div>
      <ol className="mt-4 flex flex-col gap-3" data-actions>
        {play.actions.map((a, i) => (
          <li key={i} className="flex gap-3 text-[13px] leading-snug text-ink-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink/[.08] text-[11px] font-semibold text-ink tnum">{i + 1}</span>
            <span>
              <Figures text={a} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---- On the day -----------------------------------------------------------------------------------------------------

const RULE_ICON = [PhoneOff, TrendingUp, Clock, TrendingDown];

/** Four rules for the day: the trigger on the left, the action on the right, numbers in ink. */
export function DayRules({ rules }: { rules: PlaybookResponse["on_the_day"] }) {
  return (
    <div className="flex h-full flex-col" data-card-body="rules">
      <CardHead title="On the day" sub="When this happens · do this" />
      <div className="mt-3 flex flex-col">
        {rules.map((r, i) => {
          const Icon = RULE_ICON[i] ?? ArrowRight;
          return (
            <div key={i} className="grid grid-cols-1 gap-x-4 gap-y-1 border-b border-line py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_16px_minmax(0,1.25fr)]" data-rule={i}>
              <div className="flex gap-2.5 text-[13px] leading-snug text-ink">
                <span className="mt-[1px] grid size-6 shrink-0 place-items-center rounded-lg bg-soft text-ink-2">
                  <Icon size={13} strokeWidth={1.9} />
                </span>
                <span className="font-medium">
                  <Figures text={r.trigger} />
                </span>
              </div>
              <ArrowRight size={14} strokeWidth={1.75} className="mt-1 hidden text-muted sm:block" />
              <div className="text-[13px] leading-snug text-ink-2 max-sm:pl-8">
                <Figures text={r.action} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Least cushion --------------------------------------------------------------------------------------------------

const DEPT_SHORT: Record<string, string> = { "Front End": "FE", Merchandising: "Merch", Pharmacy: "Pharm" };
const SHIFT_SHORT: Record<string, string> = { Opening: "Open", Midday: "Mid", Evening: "Eve" };
/** "Sat Feb 14, Merchandising, Evening" → "Sat 14 · Merch · Eve" (the Overview's list form). */
const shortLabel = (label: string) => {
  const [day, dept, shift] = label.split(", ");
  if (!dept || !shift) return label;
  const d = day.split(" ");
  return `${d[0]} ${d[2] ?? ""} · ${DEPT_SHORT[dept] ?? dept} · ${SHIFT_SHORT[shift] ?? shift}`;
};

/**
 * The blocks closest to a miss (cushion = people a block can lose, or extra demand it can take, before a miss becomes
 * the likelier outcome). A row opens that block on the Overview.
 */
export function TightList({ rows, showW, onOpen, filter }: { rows: TightBlock[]; showW: boolean; onOpen: (b: TightBlock) => void; filter?: ReactNode }) {
  const maxD = Math.max(0.01, ...rows.map((r) => r.cushion_demand ?? 0));
  return (
    <div className="flex h-full flex-col" data-card-body="tightest">
      <CardHead title="Least cushion" sub="Closest to a miss · open one on the Overview" />
      {filter && <div className="mt-3">{filter}</div>}
      <div className="mt-3 flex px-3 text-[12px] text-muted">
        <span className="flex-1">Block</span>
        <span className="w-14 text-right" data-tip="People the block can lose before a miss is likelier">
          Can lose
        </span>
        <span className="w-16 text-right" data-tip="Extra demand the block can take before a miss is likelier">
          Demand
        </span>
      </div>
      <div className="mt-1 flex flex-col">
        {rows.map((r) => (
          <button
            key={r.key}
            type="button"
            data-key={r.key}
            onClick={() => onOpen(r)}
            data-tip-title={r.label}
            data-tip={`${r.warehouse} · ${int(r.plan)} people · chance ${chanceText(r.chance)}\n${r.cushion_text}\nOpen it on the Overview`}
            className="group relative flex h-11 w-full items-center gap-2 rounded-[10px] px-3 pb-1.5 text-left text-[13.5px] hover:bg-soft/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <span aria-hidden className="absolute inset-x-3 bottom-[5px] h-[3px] overflow-hidden rounded-full bg-line/70">
              <span className="absolute inset-y-0 left-0 rounded-full bg-ink/45" style={{ width: `${(100 * (r.cushion_demand ?? 0)) / maxD}%` }} />
            </span>
            <span className="relative min-w-0 flex-1 truncate text-ink-2 group-hover:text-ink">{shortLabel(r.label)}</span>
            {showW && <span className="relative rounded bg-ink/[.06] px-1 text-[11px] text-ink-2">W{r.store_id}</span>}
            <span className={`relative w-14 text-right tnum ${r.cushion_people === 0 ? "font-semibold text-bad-strong" : "text-ink"}`}>{r.cushion_people == null ? "—" : int(r.cushion_people)}</span>
            <span className="relative w-16 text-right text-ink-2 tnum">{r.cushion_demand == null ? "—" : Math.round(r.cushion_demand * 100) > 0 ? `+${Math.round(r.cushion_demand * 100)}%` : "0%"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- People short, by department and day --------------------------------------------------------------------------

/**
 * The people the plan still can't field, by department and day (all warehouses): a 3 × 7 heatmap whose numbers are the
 * gap; empty days stay blank, and the red deepens with the gap (perception.md: intensity grows toward the problem).
 */
export function GapGrid({ gaps, meta, scenario }: { gaps: CapacityGap[]; meta: Meta; scenario: ScenarioCode }) {
  const mine = gaps.filter((g) => g.scenario_code === scenario);
  const by = new Map(mine.map((g) => [`${g.dept_id}|${g.day_date}`, g]));
  const total = mine.reduce((s, g) => s + g.gap_people, 0);
  const tier = (n: number) => (n >= 20 ? "bg-tier-far font-bold" : n >= 8 ? "bg-tier-mid" : "bg-tier-low");
  return (
    <div className="flex h-full flex-col" data-card-body="gaps">
      <CardHead
        title="People short"
        sub={`${int(total)} people the plan can't field · by department and day`}
        right={
          <>
            <Key swatch="h-3 w-4 rounded-[4px] bg-tier-low" label="1–7" />
            <Key swatch="h-3 w-4 rounded-[4px] bg-tier-mid" label="8–19" />
            <Key swatch="h-3 w-4 rounded-[4px] bg-tier-far" label="20+" />
            <ScopeChip text="All warehouses" />
          </>
        }
      />
      <div className="mt-4 grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-[5px]" role="table" aria-label="People short by department and day">
        <span />
        {meta.days.map((d) => (
          <span key={d.date} className="flex flex-col items-center pb-1 leading-tight" role="columnheader">
            <span className="text-[12px] text-muted">{d.label.slice(0, 3)}</span>
            <span className="text-[13.5px] font-semibold text-ink-2 tnum">{Number(d.date.slice(8))}</span>
          </span>
        ))}
        {meta.departments.map((dept) => (
          <Fragment key={dept.id}>
            <span className="flex items-center text-[12.5px] font-semibold text-ink-2" role="rowheader">
              {dept.name}
            </span>
            {meta.days.map((d) => {
              const g = by.get(`${dept.id}|${d.date}`);
              return g && g.gap_people > 0 ? (
                <span
                  key={d.date}
                  role="cell"
                  data-gap={g.gap_people}
                  data-tip-title={`${int(g.gap_people)} people short`}
                  data-tip={`${g.day} · ${g.department}\n${int(g.gap_hours)} h · ${int(g.blocks_short)} blocks short`}
                  tabIndex={0}
                  className={`grid h-9 place-items-center rounded-[9px] text-[13.5px] font-semibold text-ink tnum outline-none focus-visible:ring-2 focus-visible:ring-accent ${tier(g.gap_people)}`}
                >
                  {int(g.gap_people)}
                </span>
              ) : (
                <span key={d.date} role="cell" className="grid h-9 place-items-center rounded-[9px] text-[13px] text-muted ring-1 ring-line ring-inset" aria-label="none">
                  ·
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

