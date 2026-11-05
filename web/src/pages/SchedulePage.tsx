import { Download, FileSpreadsheet, LayoutGrid, ListOrdered } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { Badge, Button, Card, ErrorPanel, HelpTip, LinkButton, PageHeader, Refreshing, SegmentedControl, SkeletonCard } from "../components";
import { BlockDrawer } from "../components/schedule/BlockDrawer";
import { COLOR_MODES, type ColorMode } from "../components/schedule/boardScales";
import { WeeklyBoard, type BoardDay } from "../components/schedule/WeeklyBoard";
import { apiUrl, submissionCsvUrl, useMeta } from "../lib/api";
import { useCurrentPlan, useViewNames } from "../lib/hooks";
import { useView } from "../lib/view";
import { signedInt } from "../lib/format";
import type { Block, PlanResponse, WarehouseKey } from "../lib/types";
import { BoardLegend } from "./schedule/BoardLegend";
import { changesCsv, ChangesView, filterChanges, type DeptFilter, type Direction } from "./schedule/ChangesView";
import { scheduleAnswer } from "./schedule/answer";

type Tab = "board" | "changes";

/** Days of the week, from /api/meta, or from the blocks while meta loads. */
function useDays(blocks: Block[]): BoardDay[] {
  const meta = useMeta().data;
  return useMemo(() => {
    if (meta?.days?.length) {
      return meta.days.map((d) => {
        const x = d as typeof d & { short?: string; weekday?: string; holiday_window?: boolean };
        return { date: d.date, label: d.label, short: x.short ?? d.label, weekday: x.weekday ?? d.label, holiday: d.holiday, holiday_window: x.holiday_window ?? !!d.holiday };
      });
    }
    const seen = new Map<string, BoardDay>();
    for (const b of blocks) {
      if (!seen.has(b.date)) seen.set(b.date, { date: b.date, label: b.day, short: b.day_short, weekday: b.weekday, holiday: b.holiday, holiday_window: !!b.holiday });
    }
    return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [meta, blocks]);
}

function dayTotalsFor(data: PlanResponse | undefined, key: WarehouseKey) {
  const t = data?.totals[key];
  return new Map((t?.by_day ?? []).map((d) => [d.date, { plan: d.plan.employees, change: d.change.employees }]));
}

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SchedulePage() {
  const view = useView();
  const { scenario, warehouse, setBlock, setWarehouse, carry } = view;
  const { query, data, blocks, blockByKey } = useCurrentPlan();
  const { scenarioName, warehouseName } = useViewNames();
  const meta = useMeta().data;
  const [params, setParams] = useSearchParams();
  const days = useDays(blocks);

  const setParam = useCallback(
    (key: string, value: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === null) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const tab: Tab = params.get("tab") === "changes" ? "changes" : "board";
  const modeParam = params.get("color") as ColorMode | null;
  const mode: ColorMode = COLOR_MODES.some((m) => m.value === modeParam) ? (modeParam as ColorMode) : "change";
  const direction = (["all", "add", "cut"].includes(params.get("dir") ?? "") ? params.get("dir") : "all") as Direction;
  const dept = (["all", "38", "92", "95"].includes(params.get("dept") ?? "") ? params.get("dept") : "all") as DeptFilter;

  const goal = data?.goal ?? 0.95;
  const selected = view.block ? blockByKey.get(view.block) : undefined;
  const stores = useMemo(() => [...new Set(blocks.map((b) => b.store_id))].sort((a, b) => a - b), [blocks]);
  const answer = useMemo(() => (data ? scheduleAnswer(blocks, days, goal) : null), [data, blocks, days, goal]);

  // Step through the same department and shift across the week.
  const neighbors = useMemo(() => {
    if (!selected || !data) return {};
    const row = data.blocks.filter((b) => b.store_id === selected.store_id && b.dept_id === selected.dept_id && b.shift_code === selected.shift_code).sort((a, b) => a.date.localeCompare(b.date));
    const i = row.findIndex((b) => b.key === selected.key);
    return { prev: row[i - 1], next: row[i + 1] };
  }, [selected, data]);

  const demandUnit = useCallback(
    (id: number) => {
      const d = meta?.departments.find((x) => x.id === id) as { demand_unit?: string } | undefined;
      return d?.demand_unit ? d.demand_unit.charAt(0).toLowerCase() + d.demand_unit.slice(1) : undefined;
    },
    [meta],
  );

  const exportView = () => {
    if (tab === "changes") {
      const rows = filterChanges(blocks, direction, dept).sort((a, b) => b.change - a.change);
      downloadText(`changes_${scenario}_${warehouse === "all" ? "all_warehouses" : `warehouse_${warehouse}`}.csv`, changesCsv(rows));
    } else {
      window.location.href = apiUrl("plan.csv", { scenario, store: warehouse });
    }
  };

  if (query.error) {
    return (
      <>
        <PageHeader title="Schedule" />
        <ErrorPanel error={query.error} what={`the ${scenario} plan`} onRetry={() => query.refetch()} />
      </>
    );
  }

  const changedCount = blocks.filter((b) => b.is_open && b.change !== 0).length;
  const hasUnfilled = blocks.some((b) => b.draft_sources.unfilled > 0);

  return (
    <>
      <PageHeader
        title="Schedule"
        answer={answer}
        meta={
          <>
            <Badge tone="accent">{scenario}</Badge>
            <span>
              {scenarioName}, {warehouseName}
            </span>
            <HelpTip term="Block" label="What's a block?" className="ml-2" />
          </>
        }
        actions={
          <>
            <Button icon={<FileSpreadsheet />} onClick={exportView} disabled={!data} title={tab === "changes" ? "The changes on screen, as a CSV" : "Every block in this view, as a CSV"}>
              Export this view
            </Button>
            <LinkButton variant="primary" icon={<Download />} href={submissionCsvUrl} download title="The filled submission template: all 567 blocks, three scenarios">
              Download submission CSV
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<Tab>
          label="Schedule view"
          value={tab}
          onChange={(t) => setParam("tab", t === "board" ? null : t)}
          options={[
            { value: "board", label: "Board", icon: <LayoutGrid /> },
            { value: "changes", label: data ? `Changes (${changedCount})` : "Changes", icon: <ListOrdered /> },
          ]}
        />
        {tab === "board" && (
          <div className="flex items-center gap-2.5">
            <span className="text-sm text-ink-subtle">Color by</span>
            <SegmentedControl<ColorMode> label="Color the board by" value={mode} onChange={(m) => setParam("color", m === "change" ? null : m)} options={COLOR_MODES} />
          </div>
        )}
      </div>

      {!data ? (
        <SkeletonCard chart className="min-h-[520px]" />
      ) : (
        <Refreshing active={query.isPlaceholderData}>
          {tab === "board" ? (
            <div className="space-y-5">
              {stores.length > 1 && (
                <div className="rounded-card border border-border bg-surface px-5 py-3 shadow-card">
                  <BoardLegend mode={mode} goal={goal} unfilled={hasUnfilled} />
                </div>
              )}
              {stores.map((store) => {
                const key = String(store) as WarehouseKey;
                const own = blocks.filter((b) => b.store_id === store);
                const t = data.totals[key];
                const wh = meta?.warehouses.find((w) => String(w.id) === key);
                const multi = stores.length > 1;
                return (
                  <Card
                    key={store}
                    padding="none"
                    title={multi ? (wh ? `${wh.label} (${wh.size})` : own[0]?.warehouse) : undefined}
                    description={multi && t ? `${signedInt(t.change.employees)} people against the draft, ${t.plan.below_goal} ${t.plan.below_goal === 1 ? "block" : "blocks"} below the goal` : undefined}
                    actions={multi ? <Button size="sm" onClick={() => setWarehouse(key)}>Show only this warehouse</Button> : undefined}
                  >
                    {!multi && (
                      <div className="border-b border-border px-5 py-3">
                        <BoardLegend mode={mode} goal={goal} unfilled={hasUnfilled} />
                      </div>
                    )}
                    <div className="px-3 pt-2 pb-3">
                      <WeeklyBoard
                        blocks={own}
                        days={days}
                        mode={mode}
                        selectedKey={view.block}
                        onSelect={setBlock}
                        dayTotals={dayTotalsFor(data, key)}
                        goal={goal}
                        scrollToSelected
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card padding="none">
              <ChangesView
                blocks={blocks}
                showWarehouse={warehouse === "all"}
                direction={direction}
                dept={dept}
                onDirection={(d) => setParam("dir", d === "all" ? null : d)}
                onDept={(d) => setParam("dept", d === "all" ? null : d)}
                selectedKey={view.block}
                onSelect={setBlock}
                goal={goal}
                warehouseLabel={(id) => {
                  const w = meta?.warehouses.find((x) => String(x.id) === String(id));
                  return w ? `${w.id} ${w.size}` : `Warehouse ${id}`;
                }}
              />
            </Card>
          )}
        </Refreshing>
      )}

      <BlockDrawer
        block={selected}
        onClose={() => setBlock(null)}
        goal={goal}
        demandUnit={demandUnit}
        prev={neighbors.prev}
        next={neighbors.next}
        onNavigate={setBlock}
        carry={carry}
      />
    </>
  );
}
