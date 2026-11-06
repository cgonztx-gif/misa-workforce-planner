/*
 * Draft 4: the Overview with the schedule (planning/DRAFT4.md). Built with the dashboard-design skill.
 *
 * Colour (the user's request, 2026-11-05, after the showcase image): green = good, red = bad, grey = comparison and
 * neutral, blue = controls only, no amber. The user's stated taste wins over the skill's house style (one accent blue
 * plus a money green), so the plan's one data hue is the showcase's teal-green and the people / money entity hues are gone.
 *
 * Deviations from the skill (DRAFT4.md section 11):
 * D1. The KPI tiles drive the board's colour lens (the main view) and the below-fold By day chart, not only a
 *     trend chart. The board is the monitoring view, so the strip and the problem grid share one card above the
 *     fold. That keeps the showcase's selected-tile interaction and also obeys layout.md's "monitoring view fits
 *     one screen".
 * D2. A cell's number (the headcount, the schedule being submitted) and its colour (the lens metric) are
 *     different measures. The number never changes meaning; the legend names the colour, and the tooltip gives both.
 * D3. There are 63 numbered cells in every view, just over the ~60 guideline. The numbers are the deliverable.
 *     Cells are at least 30px tall, with ink text at 4.5:1 or better. All folds the warehouses into sums rather
 *     than showing 189 cells.
 * D4. The selected cell uses an outer blue (control) ring, not a tinted fill, because the fill already encodes the tier.
 *     Row and day selections keep the soft blue fill: selection is a control state, and a green fill on a below-goal
 *     row would read as "good".
 * D5. There are two red intensities (below goal; under 80%), because the real below-goal chances run from 0% to
 *     94.9%. The single worst block takes the darker red (bad-strong) on its ring, corner flag, list square and bar,
 *     with the tie-break rule in its tooltip; every other below-goal mark uses the one red (bad).
 * D6. The People delta is grey (volume). The Labor cost delta follows the skill now: cost is lower-is-better, so a
 *     rise is red (components.md "Delta badge"); its tooltip says lower is better and what the extra cost buys.
 * D10. The selected tile is the showcase image's pale green fill and faint green ring, whichever tile it is, as the
 *     user asked ("change the color scheme to follow this"). The sparkline and the By day plan series take the metric's
 *     colour, as its board lens does: Service green, Below goal red bars, People and Labor cost ink (magnitudes), so a
 *     cost rise is never drawn in the good colour beside its red delta. Red delta text is bad-strong (4.5:1 on the tint).
 * D11. The People and Labor cost board lenses encode magnitude, not good or bad, so they use an ink (grey) intensity
 *     scale; Cut is a faint fill with an ink outline. Since the clarity sweep a below-goal cell keeps that fill there
 *     and gets a red outline; only Service and Below goal fill below-goal cells red.
 * D7. The sidebar holds the pages (Overview, Demand), the scenario switch and, on the Overview, the what-if
 *     adjustments (D-33). The phone menu grid holds scenarios, warehouses, CSV and Theme; below 80rem the
 *     adjustments open from the plan card.
 * D8. There's no date-range picker and no "today" column, because the planning week is fixed and in the future.
 *     The range-calendar band marks the holiday window instead, and the dot marks named holidays.
 * D9. By day draws bars for Below goal and lines for the other metrics, because zero days would zigzag as a line.
 *     This is different data, not variety.
 *
 * Builder's notes where this file departs from DRAFT4.md itself (each for a reason seen on a screenshot):
 * B1. Previous is Shift+N, not P: P is already Peak, and the demo flips Base → Peak → Disrupt with a block open.
 * B2. The Below goal list shows as many rows as fit the slot (at least 6), not a fixed 8 / 6, so the slot beside
 *     the tall plan card has no empty lower half (layout.md "no holes"). The footnote still reads "N of 25".
 * B3. The board's label column is 124 px from 64rem (not 104 / 112), so "Merchandising" sits on one line; 140 at 160rem.
 * B4. lib/theme.ts holds the theme helpers shared by the sidebar, the phone menu and main.tsx.
 * B5. Tier fills are the tier tokens of section 4 (Service green 6, 11, 17; below goal red 26; under 80% red 42; dark
 *     lifts the red to 34 / 52), so in greyscale every red tier is darker than every healthy one (perception.md:
 *     intensity grows toward the problem). People and Labor cost use ink 5.5, 10, 15 (+ Cut ink 3.5 with an ink/30
 *     outline); +6 at 15 is still lighter than red 26 in greyscale. Both legends list both red tiers, as the cells use both.
 * B6. The People lens in All places a fractional mean on the legend's own words: (0, 2] +1, (2, 5] +3, > 5 +6.
 * B7. By day always draws the draft as the grey "period before" line (the tiles always show their Draft sub-line);
 *     Compare with draft adds the draft to the board and the detail. No chart animation.
 * B8. With Compare on, a draft-unfilled (P3) cell whose net change is 0 shows ±0, so its dashed mark has a figure to
 *     sit on. The block detail shows Unfilled N beside the change whatever the switch says, and draws the draft's
 *     staffing as a grey bar whose unfilled part runs past capacity, dashed.
 * B9. The detail ends in the selection's week (its chance on each of the 7 days), and the All-cell detail adds each
 *     warehouse's chance against the goal, so the slot beside the tall board has no blank band. Next / Previous also
 *     work from an All cell (Next opens its lowest below-goal block).
 * B10. The worst block's dark-red ring is 3 px with a dark-red corner flag, so it survives the blur test on a red mass.
 * B11. A failed fetch with numbers on screen puts its slim note in the header row, in place of the scenario name, so
 *     it never pushes the board below the fold. Health keeps a 10 s heartbeat after ready; the CSV downloads through
 *     fetch, so a stopped server shows Offline and the note instead of failing silently. A startup error reads Error.
 * B12. The board grows its rows on tall wide screens (48 / 54 / 64 px at 58 / 66 / 85rem of height).
 * B13. The Below goal list's 3 px bar is the gap to the goal (from the chance to the 95% tick), not the chance from 0
 *     (section 5.7). With bar = chance the worst rows (0%) had empty bars and the rows nearest the goal the longest
 *     red ones; now the worst row has the longest bar (darkest red), as the skill's "intensity grows toward the problem" asks.
 *     The bar's left end still sits at the chance on the same 0–100% track. "Closest to goal" draws the margin above it.
 * B14. The detail's bullet graph uses lighter ranges (ink 10 / 6 / 3, not Few's 40 / 25 / 10) and labels 80%, and below
 *     goal it outlines the missing part from the chance to the goal with a dashed red box, so a 0% block reads as a long
 *     red gap rather than a long grey bar. The value bar keeps a 5 px red stub at 0% (green when the block meets the goal).
 * B15. With Compare on and draft-unfilled (P3) blocks in view, the legend adds "Unfilled" (the dashed red underline),
 *     so "21 −6" reads as "the draft scheduled people it couldn't field", not as a cut. Its legend gaps tighten below
 *     90rem so it stays on one line at 1366; the toolbar grows rather than overlapping the board if it ever wraps.
 * D12. What-if (D-33): any adjustment re-plans through /api/what-if and the page shows that plan, re-based on the
 *     submitted one, with "Draft" read as "Submitted" everywhere (lib/base.tsx). The default view never calls it; a
 *     dashed What-if pill and Reset replace the green Submitted plan pill; the CSV stays the submitted file.
 * D13. Five pages (T-99, DRAFT4.md 13-17): Overview, Demand, Cost and service, Playbook, Methods. The others keep the
 *     Overview's frame with read-only tiles, always show the submitted plan, and Playbook keeps its instructions as
 *     sentences (figures in ink). Laptop only: no phone work beyond the existing menu sheet.
 */

import * as Popover from "@radix-ui/react-popover";
import { useQueryClient } from "@tanstack/react-query";
import { Maximize2, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { allIdOf, blockId, buildBoard, isP3, stepSel, storeOf, type Cell } from "./lib/board";
import { ApiError, backToPreparing, useCompare, useDiagnosis, useForecast, useHealth, useMeta, useMethods, usePlan, usePlaybook, usePrefetch, useTradeoff, useWhatIf } from "./lib/api";
import { BaseContext, DRAFT_BASE, SUBMITTED_BASE } from "./lib/base";
import { changedChips, isDefault, rebase, WI_DEFAULTS } from "./lib/whatif";
import type { WhatIfSettings } from "./lib/types";
import { AdjustPanel } from "./components/AdjustPanel";
import { CostBreakdown } from "./components/CostBreakdown";
import { nextTheme, readTheme, saveTheme, type Theme } from "./lib/theme";
import type { Block, PlanResponse, ScenarioCode, WarehouseKey } from "./lib/types";
import { readHash, writeHash, type DeptId, type Lens, type Page, type ViewState } from "./lib/url";
import { DemandPage } from "./components/demand/DemandPage";
import { CostPage } from "./components/cost/CostPage";
import { MethodsPage } from "./components/methods/MethodsPage";
import { PlaybookPage } from "./components/playbook/PlaybookPage";
import { GoalRow } from "./components/BelowGoalList";
import { Board } from "./components/Board";
import { CompareSwitch } from "./components/CompareSwitch";
import { DayChart } from "./components/DayChart";
import { ExpandDialog } from "./components/ExpandDialog";
import { downloadCsv, HeaderBar } from "./components/HeaderBar";
import { KpiStrip } from "./components/KpiStrip";
import { Legend } from "./components/Legend";
import { NoteBar, PageNote } from "./components/PageNote";
import { PhoneBar } from "./components/PhoneBar";
import { PhoneMenu } from "./components/PhoneMenu";
import { Segmented } from "./components/Segmented";
import { Sheet } from "./components/Sheet";
import { PAGE_TITLE, Sidebar, SCEN } from "./components/Sidebar";
import { BoardSkeleton, ChartSkeleton, ListSkeleton, TilesSkeleton } from "./components/Skeletons";
import { Detail, resolveSel, Slot } from "./components/Slot";
import type { Status } from "./components/StatusPill";

const CARD = "rounded-[18px] border border-line bg-card shadow-[var(--shadow-card)]";

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const SCEN_LABEL: Record<ScenarioCode, string> = { BASE: "Base", PEAK: "Peak", DISRUPT: "Disrupt" };

export function App() {
  const qc = useQueryClient();
  const [view, setView] = useState<ViewState>(readHash);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expand, setExpand] = useState<null | "list" | "board">(null);
  const [csvFail, setCsvFail] = useState<null | "offline" | "error">(null);
  const phone = useMedia("(max-width: 39.99rem)");

  useEffect(() => writeHash(view), [view]);
  useEffect(() => {
    const onHash = () => setView(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const health = useHealth();
  const ready = health.data?.ready === true;
  const meta = useMeta(true);
  const planQ = usePlan(view.scenario, ready);
  const compareQ = useCompare(ready);
  const playbookQ = usePlaybook(ready);
  const forecastQ = useForecast(ready);
  const tradeoffQ = useTradeoff(ready);
  const diagnosisQ = useDiagnosis(ready);
  const methodsQ = useMethods(ready);
  usePrefetch(ready && !!planQ.data && !planQ.isPlaceholderData);

  // A 503 mid-session means the server restarted: back to polling health. The data on screen stays.
  const failure = planQ.failureReason;
  useEffect(() => {
    if (failure instanceof ApiError && failure.notReady && ready) backToPreparing(qc);
  }, [failure, ready, qc]);

  // The last plan that landed stays on screen when a later fetch fails (react-query drops the placeholder on error).
  const lastGood = useRef<PlanResponse | undefined>(undefined);
  if (planQ.data && !planQ.isPlaceholderData) lastGood.current = planQ.data;
  const submitted = planQ.data ?? lastGood.current;

  // What-if (D-33): with any adjustment, the server re-plans and the page shows that plan, re-based on the submitted
  // one. Until the first result lands the submitted plan stays on screen, dimmed; later changes keep the previous
  // what-if on screen, dimmed, until the new one arrives.
  const wiOn = !isDefault(view.wi);
  const wiQ = useWhatIf(view.scenario, view.wi, ready && wiOn);
  const wiSub = wiQ.data ? (wiQ.data.scenario === submitted?.scenario ? submitted : qc.getQueryData<PlanResponse>(["plan", wiQ.data.scenario])) : undefined;
  const wiPlan = useMemo(() => (wiOn && wiQ.data && wiSub ? rebase(wiQ.data, wiSub) : null), [wiOn, wiQ.data, wiSub]);
  const showWi = !!wiPlan;
  const wiBusy = wiOn && !wiQ.isError && (wiQ.isFetching || !wiPlan);
  const plan = wiPlan ?? submitted;
  const stale = !!plan && plan.scenario !== view.scenario;
  const goal = plan?.goal ?? meta.data?.defaults.goal ?? 0.95;

  const model = useMemo(() => (plan && meta.data ? buildBoard(plan, view.wk, meta.data) : null), [plan, meta.data, view.wk]);
  const T = plan?.totals[view.wk];
  // With Compare on, the legend names the dashed red mark when the view has draft-unfilled (P3) blocks.
  const unfilledInView = view.compare && !!model?.blocks.some(isP3);

  // ---- state changes -------------------------------------------------------------------------------------
  const setScenario = useCallback((s: ScenarioCode) => setView((v) => ({ ...v, scenario: s })), []);
  const setLens = useCallback((l: Lens) => setView((v) => ({ ...v, lens: l })), []);
  const setCompare = useCallback((c: boolean) => setView((v) => ({ ...v, compare: c })), []);
  const setWk = useCallback(
    (wk: WarehouseKey) =>
      setView((v) => {
        let sel = v.sel;
        if (sel) {
          const from = storeOf(sel);
          if (wk === "all") sel = from === "all" ? sel : allIdOf(sel);
          else if (from === "all") sel = `${wk}|${sel.split("|").slice(1).join("|")}`;
          else if (from !== wk) sel = null;
        }
        return { ...v, wk, sel };
      }),
    [],
  );
  const select = useCallback((sel: string | null) => setView((v) => ({ ...v, sel })), []);
  const setPage = useCallback((page: Page) => setView((v) => ({ ...v, page })), []);
  const setDept = useCallback((dept: DeptId) => setView((v) => ({ ...v, dept })), []);
  const setDay = useCallback((day: string) => setView((v) => ({ ...v, day })), []);
  const setWi = useCallback((wi: WhatIfSettings) => setView((v) => ({ ...v, wi })), []);
  const resetWi = useCallback(() => setWi(WI_DEFAULTS), [setWi]);
  // Playbook → Overview: open a block from the least-cushion list ("BASE|1|92|2026-02-14|EVE" → "1|92|2026-02-14|EVE").
  const openBlock = useCallback(
    (b: { key: string }) => setView((v) => ({ ...v, page: "overview", sel: b.key.split("|").slice(1).join("|") })),
    [],
  );
  const clear = useCallback(() => select(null), [select]);
  const onCell = useCallback((c: Cell) => setView((v) => {
    const id = c.isAll ? c.id : c.blocks[0] ? blockId(c.blocks[0]) : null;
    return { ...v, sel: v.sel === id ? null : id };
  }), []);
  const onBlock = useCallback((b: Block) => select(blockId(b)), [select]);
  const onDrill = useCallback((b: Block) => setView((v) => ({ ...v, wk: String(b.store_id) as WarehouseKey, sel: blockId(b) })), []);
  const onStep = useCallback(
    (dir: 1 | -1) => {
      if (!model) return;
      const next = stepSel(model, view.sel, dir);
      if (next) select(next);
    },
    [model, view.sel, select],
  );
  const onCsvFail = useCallback(
    (off: boolean) => {
      setCsvFail(off ? "offline" : "error");
      void qc.refetchQueries({ queryKey: ["health"] });
    },
    [qc],
  );
  const onCsv = useCallback(() => void downloadCsv(onCsvFail), [onCsvFail]);
  const cycleTheme = useCallback(() => {
    setTheme((t) => {
      const n = nextTheme(t);
      saveTheme(n);
      return n;
    });
  }, []);

  // Global shortcuts: B / P / D, 0 / 1 / 2 / 4, N / Shift+N, Escape. Off inside inputs and dialogs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable=true]") || t.closest('[role="dialog"]'))) return;
      if (document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === "b") setScenario("BASE");
      else if (k === "p") setScenario("PEAK");
      else if (k === "d") setScenario("DISRUPT");
      else if (e.key === "0") setWk("all");
      else if (e.key === "1" || e.key === "2" || e.key === "4") setWk(e.key as WarehouseKey);
      else if (k === "n") onStep(e.shiftKey ? -1 : 1);
      else if (e.key === "Escape") clear();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setScenario, setWk, onStep, clear]);

  // Bring a selected cell into view when it was picked from a list (narrow screens).
  useEffect(() => {
    if (!view.sel || phone || !model) return;
    const id = view.wk === "all" && !view.sel.startsWith("all|") ? allIdOf(view.sel) : view.sel;
    const cell = model.cells.get(id);
    const key = cell ? (cell.isAll ? cell.id : cell.blocks[0]?.key) : null;
    const el = key ? document.querySelector<HTMLElement>(`[role="gridcell"][data-key="${key}"]`) : null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [view.sel, view.wk, phone, model]);

  // ---- status and states ---------------------------------------------------------------------------------
  const offline =
    (health.error instanceof ApiError && health.error.offline) ||
    (planQ.error instanceof ApiError && planQ.error.offline) ||
    (meta.error instanceof ApiError && meta.error.offline) ||
    csvFail === "offline";
  const startupError = health.data?.status === "error";
  // Offline is for a fetch that got no answer; an answer that is an error is "Error", beside its page note.
  const status: Status = startupError ? { kind: "error" } : offline ? { kind: "offline" } : !ready ? { kind: "preparing", health: health.data } : { kind: "ready" };
  const retry = () => {
    setCsvFail(null);
    void health.refetch();
    void meta.refetch();
    if (ready) void planQ.refetch();
  };
  // A CSV that failed for want of a server clears itself once a later heartbeat gets an answer.
  const healthAt = health.dataUpdatedAt;
  const csvAt = useRef(0);
  useEffect(() => {
    if (csvFail === "offline" && !csvAt.current) csvAt.current = Date.now();
    if (!csvFail) csvAt.current = 0;
    if (csvFail === "offline" && healthAt > csvAt.current && !health.error) setCsvFail(null);
  }, [csvFail, healthAt, health.error]);

  // One page-level note at most. With numbers on screen it is a slim bar in the header row (it never pushes the board).
  let note: ReactNode = null;
  let bar: string | null = null;
  if (startupError) note = <PageNote title="Couldn't start the planner" detail={health.data?.error} onRetry={retry} />;
  else if (offline && !plan) note = <PageNote title="Can't reach the planner" code="start_app_draft4.bat" onRetry={retry} />;
  else if (planQ.isError && plan && stale) bar = `Couldn't load ${SCEN_LABEL[view.scenario]} · showing ${SCEN_LABEL[plan.scenario]}`;
  else if (offline && plan) bar = "Can't reach the planner · showing the last numbers";
  else if (csvFail === "error") bar = "Couldn't download the CSV";
  else if (view.page === "overview" && wiOn && wiQ.isError) bar = `Couldn't run this what-if · showing ${showWi ? "the last what-if" : "the submitted plan"}`;

  const loaded = !!(model && T && meta.data && plan);
  // A scenario still loading greys the page out; a what-if re-planning only dims it, so the old numbers stay readable.
  const staleDim = stale ? "pointer-events-none opacity-40" : "";
  const dim = stale ? staleDim : wiBusy ? "opacity-55" : "";
  const retryAll = () => {
    retry();
    if (wiOn) void wiQ.refetch();
  };
  // "Submitted" wording is the Overview's alone: the other pages always show the submitted plan against the draft.
  const base = showWi && view.page === "overview" ? SUBMITTED_BASE : DRAFT_BASE;
  const adjust = (
    <AdjustPanel value={view.wi} onChange={setWi} busy={wiBusy} />
  );
  const selCellId = model && view.sel ? (view.wk === "all" && !view.sel.startsWith("all|") ? allIdOf(view.sel) : view.sel) : null;
  const scenName = SCEN.find((s) => s.code === view.scenario)?.label ?? "";
  const { cell: selCell, block: selBlock } = model ? resolveSel(model, view.sel) : { cell: undefined, block: undefined };

  const wkItems = (meta.data?.warehouses ?? [{ id: 1 }, { id: 2 }, { id: 4 }]).map((w) => ({
    value: String(w.id) as WarehouseKey,
    title: `Warehouse ${w.id}`,
    tip: `${(w as { name?: string }).name ?? `Warehouse ${w.id}`} · key ${w.id}`,
    label: (
      <>
        <span className="@max-[34rem]:hidden">Warehouse {w.id}</span>
        <span className="hidden @max-[34rem]:inline">W{w.id}</span>
      </>
    ),
  }));
  const wkSeg = [{ value: "all" as WarehouseKey, title: "All warehouses", tip: "All warehouses · key 0", label: "All" }, ...wkItems];

  const slotProps = model && meta.data
    ? {
        model,
        meta: meta.data,
        goal,
        compare: view.compare,
        sel: view.sel,
        ptoHeadline: playbookQ.data?.pto?.headline,
        phone,
        onSelectBlock: onBlock,
        onSelect: select,
        onClear: clear,
        onStep,
        onDrill,
        onExpand: () => setExpand("list"),
      }
    : null;

  return (
    <BaseContext.Provider value={base}>
    <div className="flex min-h-dvh">
      <Sidebar
        meta={meta.data}
        scenario={view.scenario}
        loading={stale && planQ.isFetching ? view.scenario : null}
        onScenario={setScenario}
        compare={compareQ.data}
        wk={view.wk}
        theme={theme}
        onTheme={cycleTheme}
        page={view.page}
        onPage={setPage}
        adjust={view.page === "overview" ? adjust : undefined}
      />

      <main className="min-w-0 flex-1 px-4 pt-3 pb-10 sm:px-6 sm:pt-5 compact:pt-3 min-[112.5rem]:px-8">
        <div className="mx-auto max-w-[2560px]">
          <PhoneBar meta={meta.data} scenario={view.scenario} wk={view.wk} menuOpen={menuOpen} onMenu={() => setMenuOpen(true)} title={PAGE_TITLE[view.page]} />
          <HeaderBar
            meta={meta.data}
            scenario={view.scenario}
            onScenario={setScenario}
            status={status}
            note={bar ? <NoteBar text={bar} onRetry={retryAll} inline /> : null}
            onCsvFail={onCsvFail}
            title={PAGE_TITLE[view.page]}
            onMenu={() => setMenuOpen(true)}
            whatIf={view.page === "overview" && wiOn ? { chips: changedChips(view.wi), busy: wiBusy, showing: showWi, onReset: resetWi } : null}
          />
          <div className="mt-4 compact:mt-3">
            {note}
            {bar && (
              <div className="sm:hidden">
                <NoteBar text={bar} onRetry={retryAll} />
              </div>
            )}
            {view.page === "playbook" ? (
              <PlaybookPage
                playbook={playbookQ.data}
                compare={compareQ.data}
                meta={meta.data}
                scenario={view.scenario}
                wk={view.wk}
                wkSeg={wkSeg}
                dim={staleDim}
                onWk={setWk}
                onScenario={setScenario}
                onOpenBlock={openBlock}
              />
            ) : view.page === "methods" ? (
              <MethodsPage methods={methodsQ.data} diagnosis={diagnosisQ.data} forecast={forecastQ.data} />
            ) : view.page === "cost" ? (
              <CostPage
                plan={submitted && submitted.scenario === view.scenario ? submitted : undefined}
                compare={compareQ.data}
                tradeoff={tradeoffQ.data}
                diagnosis={diagnosisQ.data}
                scenario={view.scenario}
                scenarioName={scenName}
                wk={view.wk}
                wkSeg={wkSeg}
                dim={staleDim}
                onWk={setWk}
                onScenario={setScenario}
              />
            ) : view.page === "demand" ? (
              <DemandPage
                data={forecastQ.data}
                meta={meta.data}
                scenario={view.scenario}
                scenarioName={scenName}
                wk={view.wk}
                wkSeg={wkSeg}
                dept={view.dept}
                day={view.day}
                dim={staleDim}
                onWk={setWk}
                onDept={setDept}
                onDay={setDay}
              />
            ) : (
            <div className="grid grid-cols-1 gap-4 compact:gap-3 md:grid-cols-2 min-[80rem]:grid-cols-12 min-[112.5rem]:gap-4">
              {/* The plan card: warehouse control, KPI strip, board toolbar, the schedule board. */}
              <section
                data-card="plan"
                aria-label="Plan"
                aria-busy={wiBusy || undefined}
                data-whatif={showWi ? "1" : undefined}
                data-busy={wiBusy ? "1" : undefined}
                className={`${CARD} min-w-0 md:col-span-2 min-[80rem]:col-span-8 min-[112.5rem]:col-span-6`}
              >
                <div className={`transition-opacity duration-150 ${dim}`}>
                  <div className="@container flex h-[52px] items-center gap-3 border-b border-line px-5 compact:h-11 max-sm:px-3">
                    <Segmented label="Warehouse" value={view.wk} onChange={setWk} items={wkSeg} className="min-w-0" />
                    <span className="flex-1" />
                    {/* No sidebar below 80rem: the same adjustments open from here. */}
                    <Popover.Root>
                      <Popover.Trigger asChild>
                        <button
                          type="button"
                          aria-label="Adjust"
                          data-tip="Adjust · what-if"
                          className={`relative grid size-8 shrink-0 place-items-center rounded-full hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent min-[80rem]:hidden ${wiOn ? "text-accent" : "text-muted"}`}
                        >
                          <SlidersHorizontal size={15} strokeWidth={1.75} />
                          {wiOn && <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-accent" />}
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content align="end" sideOffset={6} className="z-50 w-[17rem] rounded-[16px] border border-line bg-side p-3 shadow-[var(--shadow-pop)]">
                          <AdjustPanel value={view.wi} onChange={setWi} busy={wiBusy} id="popover" />
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                    <button
                      type="button"
                      onClick={() => setExpand("board")}
                      disabled={!loaded}
                      aria-label="Expand the schedule"
                      data-tip="Expand the schedule"
                      className="hidden size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent sm:grid"
                    >
                      <Maximize2 size={15} strokeWidth={1.75} />
                    </button>
                  </div>
                  {loaded ? <KpiStrip T={T!} goal={goal} lens={view.lens} onLens={setLens} /> : <TilesSkeleton />}
                  <div className="flex min-h-11 items-center justify-between gap-4 px-5 compact:min-h-9 max-sm:px-3">
                    <CompareSwitch on={view.compare} onChange={setCompare} />
                    <Legend lens={view.lens} all={view.wk === "all"} unfilled={unfilledInView} goal={goal} />
                  </div>
                  <div className="px-5 pb-5 compact:pb-3 max-sm:px-3 max-sm:pb-3">
                    {loaded ? (
                      <Board
                        model={model!}
                        T={T!}
                        meta={meta.data!}
                        goal={goal}
                        lens={view.lens}
                        compare={view.compare}
                        selCellId={selCellId}
                        focusDay={focusDay}
                        scenarioName={scenName}
                        onCell={onCell}
                        onEscape={clear}
                      />
                    ) : (
                      <BoardSkeleton />
                    )}
                  </div>
                </div>
              </section>

              {/* The slot: Below goal list, or the detail of the selection. */}
              <section data-card="slot" aria-label="Below goal" className={`${CARD} relative min-w-0 overflow-hidden max-md:min-h-0 md:col-span-1 min-[80rem]:col-span-4 min-[112.5rem]:col-span-3`}>
                <div className={`h-full transition-opacity duration-150 min-[80rem]:absolute min-[80rem]:inset-0 ${dim}`}>
                  {slotProps ? <Slot {...slotProps} /> : <ListSkeleton />}
                </div>
              </section>

              {/* Below the fold: By day (8 columns) and Where the cost goes (4), as the plan card and slot above; both
                  stack in the third column from 112.5rem. Both follow the what-if. */}
              <div className="contents min-[112.5rem]:col-span-3 min-[112.5rem]:flex min-[112.5rem]:min-w-0 min-[112.5rem]:flex-col min-[112.5rem]:gap-4">
                <section data-card="byday" aria-label="By day" className={`${CARD} min-w-0 p-5 md:col-span-2 min-[80rem]:col-span-8 min-[112.5rem]:flex-1 max-sm:p-3`}>
                  <div className={`h-full transition-opacity duration-150 ${dim}`}>
                    {loaded ? <DayChart T={T!} meta={meta.data!} lens={view.lens} compare={view.compare} goal={goal} focusDay={focusDay} onDay={(d) => setFocusDay((f) => (f === d ? null : d))} /> : <ChartSkeleton />}
                  </div>
                </section>
                <section data-card="costbreakdown" aria-label="Where the cost goes" className={`${CARD} min-w-0 p-5 md:col-span-2 min-[80rem]:col-span-4 max-sm:p-3`}>
                  <div className={`h-full transition-opacity duration-150 ${dim}`}>{loaded ? <CostBreakdown T={T!} /> : <ChartSkeleton rows />}</div>
                </section>
              </div>
            </div>
            )}
          </div>
        </div>
      </main>

      <PhoneMenu open={menuOpen} onOpenChange={setMenuOpen} scenario={view.scenario} wk={view.wk} theme={theme} onScenario={setScenario} onWk={setWk} onTheme={cycleTheme} onCsv={onCsv} page={view.page} onPage={setPage} />

      {phone && slotProps && (
        <Sheet open={!!(selCell || selBlock)} onClose={clear} title="Block">
          <Detail {...slotProps} phone={false} />
        </Sheet>
      )}

      {model && T && meta.data && (
        <>
          <ExpandDialog open={expand === "list"} onClose={() => setExpand(null)} title={model.p1.length ? "Below goal" : "Closest to goal"}>
            <div className="flex px-5 pb-1 text-[12px] text-muted">
              <span className="flex-1">Block</span>
              <span>Chance</span>
              <span className="w-12 text-right">Short</span>
            </div>
            <div className="flex flex-col" data-list="expanded">
              {(model.p1.length ? model.p1 : model.blocks.filter((b) => b.is_open && b.chance != null).sort((a, b) => (a.chance ?? 0) - (b.chance ?? 0))).map((b) => (
                <GoalRow key={b.key} b={b} worst={b === model.worst} closest={!model.p1.length} showW={view.wk === "all"} goal={goal} wide selected={view.sel === blockId(b)} onClick={() => (onBlock(b), setExpand(null))} />
              ))}
            </div>
          </ExpandDialog>
          <ExpandDialog
            open={expand === "board"}
            onClose={() => setExpand(null)}
            title={`Schedule · ${scenName} · ${view.wk === "all" ? "All warehouses" : `Warehouse ${view.wk}`}${showWi ? " · What-if" : ""}`}
            wide
            aside={<CompareSwitch on={view.compare} onChange={setCompare} />}
          >
            <div className="px-2 pt-1">
              <div className="mb-3 flex justify-end">
                <Legend lens={view.lens} all={view.wk === "all"} unfilled={unfilledInView} goal={goal} />
              </div>
              <div className="[&_[role=gridcell]]:h-11 [&_[role=gridcell]]:text-[15px]">
                <Board
                  model={model}
                  T={T}
                  meta={meta.data}
                  goal={goal}
                  lens={view.lens}
                  compare={view.compare}
                  selCellId={selCellId}
                  focusDay={focusDay}
                  scenarioName={scenName}
                  onCell={(c) => (onCell(c), setExpand(null))}
                  onEscape={() => setExpand(null)}
                />
              </div>
            </div>
          </ExpandDialog>
        </>
      )}
    </div>
    </BaseContext.Provider>
  );
}
