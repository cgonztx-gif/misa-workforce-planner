import { useState } from "react";
import { chanceText, int, pts, signed, signedUsd, signedUsdCompact, usd, usdCompact } from "../../lib/format";
import type { CompareResponse, Meta, PlaybookResponse, ScenarioCode, TightBlock, WarehouseKey } from "../../lib/types";
import { Segmented, type SegItem } from "../Segmented";
import { ChartSkeleton, ListSkeleton, TilesSkeleton } from "../Skeletons";
import { CARD, CardHead, ScopeChip, StatTile } from "../StatTile";
import { DayRules, GapGrid, PlanToRun, PtoLever, TightList } from "./PlaybookParts";

/**
 * Playbook (T-99, DRAFT4.md section 16). The one question: what should a warehouse leader do this week? Hero: the
 * holiday-PTO lever (the headline recommendation), whose level drives the tiles; the slot: the plan to run for the
 * scenario, with its trigger and steps; below: the rules for the day, the blocks with least cushion (each opens on the
 * Overview) and the people still short by department and day. Words stay where they are the instruction itself.
 */
export function PlaybookPage({ playbook, compare, meta, scenario, wk, wkSeg, dim, onWk, onScenario, onOpenBlock }: {
  playbook?: PlaybookResponse;
  compare?: CompareResponse;
  meta?: Meta;
  scenario: ScenarioCode;
  wk: WarehouseKey;
  wkSeg: SegItem<WarehouseKey>[];
  dim: string;
  onWk: (w: WarehouseKey) => void;
  onScenario: (s: ScenarioCode) => void;
  onOpenBlock: (b: TightBlock) => void;
}) {
  const rows = playbook?.pto.rows ?? [];
  const maxLevel = rows.length ? rows[rows.length - 1].kept_per_block : 0;
  // The headline's level (the most the analysis keeps) shows first, so the recommendation is what opens.
  const [level, setLevel] = useState<number | null>(null);
  const k = level ?? maxLevel;
  const r = rows.find((x) => x.kept_per_block === k);
  const r0 = rows[0];
  const tight = playbook?.tightest[scenario]?.[wk] ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 compact:gap-3 md:grid-cols-2 min-[80rem]:grid-cols-12" data-page="playbook">
      <section data-card="pto" aria-label="Holiday PTO" className={`${CARD} min-w-0 md:col-span-2 min-[80rem]:col-span-8`}>
        <div className={`transition-opacity duration-150 ${dim}`}>
          {/* The PTO analysis covers Base across all warehouses, whatever the filters say: the scope leads the card. */}
          <div className="flex h-[52px] items-center gap-3 border-b border-line px-5 compact:h-11 max-sm:px-3">
            <span className="text-[13.5px] font-medium text-ink-2">Holiday PTO</span>
            <span className="flex-1" />
            <ScopeChip text="Base · all warehouses" tip="The PTO analysis was run for the Base scenario across all warehouses; the filters don't change it" />
          </div>
          {r && r0 ? (
            <div className="grid grid-cols-2 border-b border-line sm:grid-cols-4" data-strip="pto">
              <StatTile
                id="below"
                label="Below goal"
                value={int(r.blocks_below_goal)}
                delta={k === 0 ? undefined : signed(r.blocks_below_goal - r0.blocks_below_goal)}
                tone={r.blocks_below_goal < r0.blocks_below_goal ? "good" : r.blocks_below_goal > r0.blocks_below_goal ? "bad" : "grey"}
                sub={`Submitted ${int(r0.blocks_below_goal)}`}
                tip={`Blocks below the goal when up to ${k} per block are kept from holiday PTO\n${int(r.below_goal_with_holiday_pto)} of them still lost holiday PTO`}
              />
              <StatTile
                id="service"
                label="Service"
                value={chanceText(r.expected_met)}
                delta={k === 0 ? undefined : pts(r.expected_met - r0.expected_met)}
                tone={r.expected_met > r0.expected_met ? "good" : r.expected_met < r0.expected_met ? "bad" : "grey"}
                sub={`Submitted ${chanceText(r0.expected_met)}`}
                tip="Expected service · average chance an open block meets its wait target"
              />
              <StatTile
                id="cost"
                label="Labor cost"
                value={usdCompact(r.cost)}
                delta={k === 0 ? undefined : signedUsdCompact(r.cost - r0.cost)}
                tone={r.cost < r0.cost ? "good" : r.cost > r0.cost ? "bad" : "grey"}
                sub={`Submitted ${usdCompact(r0.cost)}`}
                tipTitle={usd(r.cost)}
                tip={`${signedUsd(r.cost - r0.cost)} against the submitted plan\nCost falls because regular staff replace overtime · overtime ${int(r.overtime_hours)} h (submitted ${int(r0.overtime_hours)} h)`}
              />
              <StatTile
                id="kept"
                label="People kept"
                value={int(r.people_kept)}
                sub={k === 0 ? "The submitted plan" : `Up to ${k} per block`}
                tip={`People kept working who would be on holiday PTO, never more than each block lost against recent weeks (${playbook?.pto.assumption})`}
              />
            </div>
          ) : (
            <TilesSkeleton />
          )}
          <div className="px-5 pt-4 pb-5 max-sm:px-3">
            <CardHead
              title="Keep people from holiday PTO"
              sub={r && r0 ? `Up to ${k} per block · ${int(r.people_kept)} people · below goal ${int(r0.blocks_below_goal)} → ${int(r.blocks_below_goal)}` : ""}
              subTip={playbook ? `${playbook.pto.headline}\n${playbook.pto.intro}` : undefined}
            />
            <div className="mt-3">{rows.length ? <PtoLever rows={rows} level={k} onLevel={setLevel} /> : <ChartSkeleton />}</div>
          </div>
        </div>
      </section>

      <section data-card="play" aria-label="The plan to run" className={`${CARD} relative min-w-0 overflow-hidden p-5 md:col-span-2 min-[80rem]:col-span-4 max-sm:p-3`}>
        {playbook ? <PlanToRun playbook={playbook} compare={compare} scenario={scenario} onScenario={onScenario} /> : <ListSkeleton />}
      </section>

      <section data-card="rules" aria-label="On the day" className={`${CARD} min-w-0 p-5 md:col-span-2 min-[80rem]:col-span-7 max-sm:p-3`}>
        {playbook ? <DayRules rules={playbook.on_the_day} /> : <ListSkeleton />}
      </section>
      <section data-card="tightest" aria-label="Least cushion" className={`${CARD} min-w-0 p-5 md:col-span-2 min-[80rem]:col-span-5 max-sm:p-3`}>
        {playbook ? (
          <TightList
            rows={tight}
            showW={wk === "all"}
            onOpen={onOpenBlock}
            filter={<div className="@container"><Segmented label="Warehouse" value={wk} onChange={onWk} items={wkSeg} className="min-w-0" /></div>}
          />
        ) : (
          <ListSkeleton />
        )}
      </section>
      <section data-card="gaps" aria-label="People short" className={`${CARD} min-w-0 p-5 md:col-span-2 min-[80rem]:col-span-12 max-sm:p-3`}>
        {playbook && meta ? <GapGrid gaps={playbook.capacity_gaps} meta={meta} scenario={scenario} /> : <ChartSkeleton rows />}
      </section>
    </div>
  );
}
