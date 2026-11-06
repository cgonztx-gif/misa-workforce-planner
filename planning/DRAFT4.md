# Draft 4: the Overview with the schedule (build contract)

**Summary.** The user asked for a new draft of the web app, built from scratch in UI and layout and in the colour scheme and formatting style of the dashboard-design skill's showcase images. It should be one Overview page with the weekly schedule inside it, use the same calculations, and use the skill extensively. Draft 4 is that page. It reads the existing FastAPI JSON API, which wraps the engine frozen at `numbers-freeze`, so its numbers are the submitted plan's. It sits beside drafts 2 and 3 as a second Vite root (`web/draft4/`, built to `web/dist-draft4/`, served by `python -m server --draft4`) and changes neither of them.

**How this spec was made.** Three independent specs were scored against the skill and the showcase. The *demo* spec won: the schedule is the hero, the strip and the board share one card, and a list/detail slot sits beside it. Parts of *monitor* and *showcase* were grafted on, and every figure was re-read from a live server (port 8653, 2026-11-05). Section 9 lists the exact numbers QA checks. **`server/API.md`'s example figures (2,701 people, 95.8%) are stale. Use section 9.**

**Method.** The dashboard-design skill: SKILL.md build steps 1-7, plus perception.md, layout.md, tokens.md, components.md, snippets.md, qa.md and the school case study. Style comes from the showcase images: dashboard, kpi-tiles, ranked-lists, wide-before/after, phone-menu and range-calendar. The skill's "Sign-off" section is not used anywhere: not in the UI, not in comments, not in commits.

---

## 0. Where it lives, and the rules it obeys

### Files (fixed)

```
web/
  vite.draft4.config.ts        root = web/draft4, base "./", outDir ../dist-draft4, emptyOutDir true
  tsconfig.draft4.json         extends ./tsconfig.json, include ["draft4/src", "vite.draft4.config.ts"]
  package.json                 add only: "build:draft4": "tsc --noEmit -p tsconfig.draft4.json && vite build -c vite.draft4.config.ts"
                                         "dev:draft4":   "vite -c vite.draft4.config.ts"
  draft4/
    index.html                 <html lang="en">, <div id="root">, <div id="tip" role="tooltip">, /src/main.tsx
    src/
      main.tsx                 QueryClient, theme bootstrap (reads localStorage in try/catch), <App/>
      App.tsx                  page shell + layout; TOP COMMENT BLOCK = deviations D1-D9 (section 11)
      styles.css               @import "tailwindcss" source("../"); @theme tokens; dark blocks; @custom-variant compact
      lib/
        types.ts               COPY of web/src/lib/types.ts (no import from web/src), plus Compare/Playbook shapes
        api.ts                 useHealth (poll), useMeta, usePlan(s), useCompare, usePlaybook, prefetch
        format.ts              int, usd, usdCompact, pct1, chanceText, pts, signed, wasN
        ticks.ts               niceTicks (snippets.md)
        board.ts               cell model (one warehouse / All), tiers per lens, worst pick, list order, note→chip
        url.ts                 hash state read/write (history.replaceState)
        tooltip.ts             the one delegated data-tip tooltip (snippets.md)
      components/
        Sidebar.tsx  HeaderBar.tsx  StatusPill.tsx  Segmented.tsx  PhoneBar.tsx  PhoneMenu.tsx  Sheet.tsx
        KpiStrip.tsx  KpiTile.tsx  Spark.tsx  Delta.tsx  CompareSwitch.tsx  Legend.tsx
        Board.tsx  BoardCell.tsx
        Slot.tsx  BelowGoalList.tsx  BlockDetail.tsx  AllCellDetail.tsx  Bullet.tsx  StaffBar.tsx
        DayChart.tsx  RankedCard.tsx  PageNote.tsx  Skeletons.tsx  ExpandDialog.tsx
planning/evidence/
  drive_draft4.py              Playwright QA (section 10), screenshots to planning/evidence/draft4/
  draft4/plan_fixture.json     fixture written by drive_draft4.py from the live BASE payload (section 1.1)
```

### Config details

- **Vite config.** `root: fileURLToPath(new URL("./draft4", import.meta.url))`, `base: "./"`, `build.outDir: "../dist-draft4"`, `emptyOutDir: true`, `plugins: [react(), tailwindcss()]`. The dev server runs on 127.0.0.1:5174 (`strictPort`) and proxies `/api` to 127.0.0.1:8501.
- **No `prebuild:draft4` hook.** Draft 3's `prebuild` token script must not run for draft 4.
- **Server.** `--draft4` is already in the working tree of `server/__main__.py` (uncommitted, next to `--draft2`), and `start_app_draft4.bat` already exists (untracked). Keep both. Check that they serve `web/dist-draft4`, and commit them with draft 4. Don't rewrite them.
- **Dependencies.** No new ones. Use React 19, Tailwind v4 (`@tailwindcss/vite`), `@tanstack/react-query`, `recharts` (By day chart only), `lucide-react`, `@radix-ui/react-dialog` (expand dialogs, phone menu, bottom sheet) and `@radix-ui/react-popover` if needed. Don't use Radix Tooltip: one delegated tooltip serves the page.
- **Isolation.** Import nothing from `web/src`; copy `types.ts`. Reuse no draft 2 or 3 component, token, palette, CSS or layout.
- **Tailwind scoping.** `styles.css` starts with `@import "tailwindcss" source("../");`, so only `web/draft4/` is scanned and draft 3's classes don't leak in.
- **Breakpoints.** Write wide and height breakpoints in rem (`min-[112.5rem]:`, `min-[160rem]:`). Keep every class string literal; never assemble one from fragments.
- **Offline.** System font stack only: no CDN, no remote font, no Google Fonts. Icons come from lucide-react.

### Numbers rules

- **Sources.** Every number comes from `/api/plan`, `/api/meta`, `/api/compare` or `/api/playbook`. **Never call `/api/what-if`.**
- **What the browser may do:**
  - pick `totals[wk]`, with `wk` one of `"all"`, `"1"`, `"2"`, `"4"`;
  - filter `blocks` by `store_id`;
  - sum `plan`, `draft`, `change` and `cost_change` for the All board's display cells;
  - take a minimum `chance`;
  - compute `need − plan`;
  - sort.
- **What it may never do:** re-plan, or decide "below goal" from `chance`. Always use `block.below_goal`.
- **Default view** (no URL state): BASE, All warehouses, the **Service** tile selected, Compare **off**, no block selected. Every board number is then `block.plan` = `submitted_employees` in the CSV. Section 6.1 says how QA proves it.

---

## 1. The question, the numbers, the problems, the actions (skill step 1)

**The one question:** *"Where, when and how many people does the plan put on each block this week, and which blocks still miss the 95% goal?"* It is asked for one scenario (Base, Peak or Disrupt) and for all warehouses or one.

### The numbers that answer it

`T = plan.totals[wk]`.

| # | Number (on screen) | API field | Baseline (compared to what) |
|---|---|---|---|
| 1 | **Service**: expected service, the mean chance over open blocks | `T.plan.expected_met` | `T.draft.expected_met`, delta `T.change.expected_met` × 100 in points; goal `plan.goal` (0.95) |
| 2 | **Below goal** | `T.plan.below_goal` | `T.draft.below_goal`, delta `T.change.below_goal` |
| 3 | **People**: employees summed over blocks (person-shifts, the submitted numbers) | `T.plan.employees` | `T.draft.employees`, delta % from `T.change.employees / T.draft.employees` |
| 4 | **Labor cost** | `T.plan.cost` | `T.draft.cost`, delta % from `T.change.cost / T.draft.cost` |
| 5 | **The schedule**: headcount per block | `block.plan` (All: Σ over 3 warehouses) | `block.draft`, `block.change` |
| 6 | Cell colour (lens; default chance) | `block.chance`, `block.below_goal` (other lenses: `change`, `cost_change`) | `plan.goal` |

### Problem rules, as numbers

| ID | Problem | Rule | BASE / PEAK / DISRUPT (All) |
|---|---|---|---|
| P1 | Block below goal | `block.is_open && block.below_goal === true`. The server flags `chance < goal − 0.0005`; **never compare to 0.95 yourself** | 25 / 45 / 39 of 180 open |
| P1b | Far below goal (second warm intensity) | P1 and `block.chance < 0.80` | 8 / 29 / 23 |
| P2 | The single worst block in view (the only red) | Lowest `chance` among P1. Ties go to the largest `need − plan`, then to `key` ascending | 1 per view. DISRUPT has 5 blocks at exactly 0, so the tie-break matters |
| P3 | Draft schedules more than can be fielded | `block.draft_sources.unfilled > 0` (agrees with `T.draft.over_capacity` / `T.draft.unfilled`). **Not** `draft > availability.capacity`, which gives 13, because one block has 15 against 14 with 0 unfilled | 0 / 0 / 12 blocks, 36 people |
| P4 | Plan over capacity or unfilled | `T.plan.over_capacity`, `T.plan.unfilled` | 0 in every scenario. It appears only as proof in the People tooltip ("0 over capacity"), never as an alarm |

**Fact checked in the data:** every P1 block is `at_capacity` (25/25, 45/45, 39/39), and `need − plan = need − capacity`. The plan has already used every regular, cross-trained and overtime person available, so the shortfall needs people from outside the block. Total shortfall over P1 blocks: 43 / 190 / 200.

### Actions, one click from each flag

| Flag | Action |
|---|---|
| P1 / P1b / P2: a warm cell or a Below goal row | **Opens the block detail in the slot beside the board** (closer look). The detail shows draft → plan, the chance on a bullet graph against the goal, the shortfall `Short N`, the staffing against capacity, and the cause chip from `availability.note`. **Next ›** and **‹ Previous** (keys N / P) walk the P1 blocks worst first. If the note is holiday PTO, the `Holiday PTO` chip's tooltip carries `/api/playbook` `pto.headline`: the team's lever, keeping up to 5 per block from holiday PTO. |
| P3 | Turn on **Compare with draft**. Those cells' draft figure gets a dashed warm underline, and the detail shows `Unfilled N` on the draft row. No action is needed, because the plan already fixes it. |
| The whole plan | **CSV** (header) downloads `/api/submission.csv`, the hand-in (567 rows). Its `team_id` is still the placeholder `TEAM_NAME` until T-62. |

### 1.1 Fixture (step 1)

`drive_draft4.py` writes `planning/evidence/draft4/plan_fixture.json`. It copies the live BASE payload and edits it so every case triggers:

- `totals["2"].plan.below_goal = 0`, and every W2 block has `below_goal: false`. This gives the empty-list state.
- One block with `draft_sources.unfilled: 6`. This is P3.
- One block with `chance: 0` and `below_goal: true`, plus a second one with `chance: 0` and a larger `need − plan`. This tests the P2 tie-break.
- Two edges kept as they are: `BASE|1|38|2026-02-14|OPEN` (chance 0.949875, `below_goal: false`, must **not** be warm) and a copy of `PEAK|4|38|2026-02-13|OPEN` (0.94595, `below_goal: true`, must be warm and print **94.6%**).
- `change` of −6 on one block and +18 on another.
- A closed block (already present).

Playwright serves it with `page.route('**/api/plan?scenario=BASE', …)`. The expected answers are in section 9.3 (Fixture). The app has no fixture code.

---

## 2. A form for every number (step 2, encoding ladder)

| Number | Form | Reason |
|---|---|---|
| Service, Below goal, People, Labor cost | KPI tile: big number, delta top-right, "Draft X" sub-line, 7-day sparkline | A headline with one baseline (the draft) and its shape over the same 7 days as the board |
| Schedule headcount per block | **Number inside a heatmap pill.** Rows are department × shift, columns are days | The grid is the schedule, and the numbers are the deliverable. It has 63 cells in every view, about the ~60-cell limit for numbers |
| Cell colour | Classed tiers of one hue, growing toward the problem, plus two warm tiers (rung 3, matrix only) | Position is taken by the grid. The healthiest cells are palest, and the problem is the loudest mark |
| Problem in a cell | Warm fill + underlined number (bold under 80%); All: count pips; worst block: red ring | Preattentive, and it survives greyscale (the underline, the bold, the pips) |
| Below goal list | Ranked list. Its 3px bar = chance on 0-100% with a goal tick at 95% | "Which ones, and how bad". Length (rung 2) |
| A block's chance vs the goal | Bullet graph: bar = chance, target = goal, 3 grey ranges, draft as a grey dot | A measure against a target in a small space |
| A block's staffing | Segmented share bar (regular / cross-trained / overtime) against capacity, with a need tick | "It's full, and need sits past it" in one glance |
| Selected metric by day | Line with a soft gradient (plan) and a grey line (draft, Compare on). **Below goal draws bars** | Position on a common scale. Below goal has zero days (Thu, Wed), and a line between zeros zigzags |
| Largest changes, departments, warehouses, scenarios | Ranked lists with 3px share bars in a tabbed card | The showcase pattern. A list beats a donut |
| Closed blocks | Dashed outline cell with "—" | Missing is not zero |

---

## 3. Layout (step 3, layout.md)

### Order and the eye's path

1. **Sidebar** (≥ 80rem): the product, the fixed week, the **scenario switch**, then the simulated-data note and the theme toggle.
2. **Header row:** "Overview" plus the scenario's full name. On the right, one pill group: `● Submitted plan`, `Simulated data`, `⤓ CSV`.
3. **Plan card** (the hero, one card in the way the showcase pairs its strip with its chart):
   - a. a toolbar with the warehouse segmented control (and an expand icon);
   - b. the KPI strip, 4 tiles;
   - c. the board toolbar (Compare with draft, legend);
   - d. **the schedule board**.
4. **Slot card**, to the right and the same height: the Below goal list, which swaps to the block detail.
5. **Breakdowns:** the By day chart and the ranked card. They sit below the fold at 1366 and 1440, and beside the slot at ≥ 1920.

Eye path: the warm cells, then the selected tile's number, then the top list row, then the detail. The monitoring view (tiles + board + list) fits above the fold. The trend chart is below it (layout.md: "on a monitoring screen … the trend chart moves below the problem view").

### Wireframe at 1440 x 900 (browser viewport about 1440 x 790; sidebar 232, gutter 24)

```
┌─────────────┬──────────────────────────────────────────────────────────────────────────────────────────┐
│[▦] Workforce│ Overview  Baseline planning week            (● Submitted plan) (ⓘ Simulated data) (⤓ CSV) │ 40
│    Planner  │ ╭──────────────── Plan card (8/12, ≈ 765) ────────────────╮ ╭─ Slot (4/12, ≈ 375) ────╮ │
│Feb 12–18,   │ │ [ All | Warehouse 1 | Warehouse 2 | Warehouse 4 ]     ⤢ │ │ Below goal            ⤢ │ │ 52
│2026         │ ├──────────────┬─────────────┬─────────────┬─────────────┤ │ Block       Chance Short │ │
│             │ │╭────────────╮│Below goal   │People   +13%│Labor   +15% │ │▪ Sat 14·Front End·Mid W1 │ │
│Scenario     │ ││Service     ││        −110 │2,710        │cost         │ │          57.0%      5    │ │
│▣ Base     B │ ││    +27.1pts││25           │Draft 2,390  │$377.5k      │ │▔▔▔▔▔▔▔▔▔╎▔▔ (red bar)   │ │ 150
│↗ Peak     P │ ││95.6%       ││Draft 135    │﹏﹏ grey     │Draft $329.1k│ │▪ Sat 14·Merch·Eve   W1   │ │
│⊖ Disrupt  D │ ││Draft 68.5% ││▁▃█▆▁▃▁ grey │             │﹏﹏ grey     │ │          62.3%      2    │ │
│             │ ││﹏﹏ blue    ││             │             │             │ │ … 8 rows, worst first    │ │
│             │ │╰────────────╯│             │             │             │ │                          │ │
│             │ ├──────────────┴─────────────┴─────────────┴─────────────┤ │                          │ │
│             │ │ (○─) Compare with draft   ▢99%+ ▢97%+ ▢95%+ ▨Below ▩<80% ┆Closed│ │                    │ │ 44
│             │ │              ╭──── Holiday window ────╮                 │ │                          │ │
│             │ │        Thu   Fri   Sat•   Sun   Mon•   Tue   Wed        │ │                          │ │ 48
│             │ │         12    13    14     15    16     17    18        │ │                          │ │
│             │ │Front End Open (··) (··) (··) (··) (··) (··) (··)         │ │                          │ │
│             │ │          Mid  (··) (··) (̲9̲8̲⁚) (··) (··) (··) (··)  36px  │ │                          │ │
│             │ │          Eve  (··) …                                    │ │                          │ │ 374
│             │ │Merchand. Open / Mid / Eve                               │ │                          │ │
│             │ │Pharmacy  Open (··) (··) (··) [┆—┆] (··) (··) (··)        │ │                          │ │
│             │ │          Mid  …                                         │ │                          │ │
│             │ │          Eve  (··) (··) [┆—┆] [┆—┆] (··) (··) (··)       │ │ 8 of 25                  │ │
│Simulated    │ ╰─────────────────────────────────────────────────────────╯ ╰──────────────────────────╯ │ ≈ 764
│data       ☀ │ ╭ By day (8/12): Lowest day / Sat 14 · 87.6% ─╮ ╭ [Changes|Depts|Warehouses|Scenarios] ╮ │ fold
└─────────────┴──────────────────────────────────────────────────────────────────────────────────────────┘
```

The cells are illustrative. In All, a cell is the 3 warehouses' sum, so FE Sat Mid is about 98, with pips. The real footer values are in section 9.

### Vertical budgets

| Part | Normal (1440 x 790 viewport) | Compact (`@custom-variant compact (@media (max-height: 48rem))`), 1366 x 657 |
|---|---|---|
| Page top padding | 20 | 12 |
| Header row | 40 | 36 |
| Gap | 16 | 12 |
| Card toolbar | 52 | 44 |
| KPI strip (p-2 wrapper, py-3 inner, label 20, value 37, sub 18, spark 28) | 150 | 102 (value 28px, **sparklines hidden**) |
| Board toolbar | 44 | 36 |
| Column header (band label 14 + weekday/date) | 48 | 40 |
| Rows: 9 × 36 + 6 × 5 (in a department) + 2 × 10 (between departments) | 374 | 9 × 30 + 6 × 4 + 2 × 8 = 310 |
| Card bottom padding | 20 | 12 |
| **Total** | **≈ 764 ≤ 790** | **≈ 604 ≤ 657** |

At 1366 x 768 fullscreen (F11) the normal budget (764) also fits. Rehearse in the exact browser and recommend F11. Anything added to the strip or the toolbars must come out of this budget.

### Widths

| Viewport | Changes |
|---|---|
| **375** (phone; `scrollWidth === innerWidth`) | <ul><li>No sidebar. Top bar: mark, "Overview", and a `☰ Menu` pill (it turns into `✕ Menu`). Under it, a summary pill `Base · All` that also opens the menu, and the `Simulated data` pill.</li><li>**Menu** (phone-menu.jpg): a sheet, `bg-side shadow-pop`, a 3-column grid with icons over labels. Row 1: Base / Peak / Disrupt. Rows 2-3: All / W1 / W2 / W4. Last row: CSV / Theme. The active item sits in a white card (`rounded-2xl shadow-[var(--shadow-pill)]`). It closes on tap, Escape, outside tap and any choice.</li><li>Strip 2x2 with hairlines, no sparklines, value 28px.</li><li>Board: label column 36px showing `O / M / E` only (tooltip: the shift name). A full-width 12px semibold department label row sits above each group of 3. Cells are 32px tall and about 35px wide, with 5px gaps. Numbers only, no secondary line, legend hidden. The holiday band stays and its label goes.</li><li>Tapping a cell opens the detail as a **bottom sheet** (Radix Dialog: max 85vh, handle, close button, internal scroll).</li><li>The slot list, By day (`touch-pan-y`) and the ranked card stack full width. Page gutter 16, card padding 12.</li></ul> |
| **640 – 1279** (tablet, narrow laptop) | <ul><li>No sidebar. The scenario segmented control `Base | Peak | Disrupt` goes first in the header pill group.</li><li>Plan card full width. Then the slot and By day side by side (`md:grid-cols-2`), then the ranked card full width.</li><li>Below 64rem the board uses the phone label column.</li></ul> |
| **1366 x 768** (projector; viewport ≈ 657) | Sidebar 216, gutter 24, 12-column grid at 8/4: the plan card is about 729 wide and the slot about 357. Label column 104, cells about 81 x 30 (compact). Warehouse labels shrink to `All · W1 · W2 · W4` through a container query when the toolbar is under 34rem; the full names stay in `title`. |
| **1440 x 900** | As in the wireframe: sidebar 232, plan card ≈ 765, cells ≈ 83 x 36. |
| **1920 x 1080** (`min-[112.5rem]:`) | Sidebar 248, gutter 32, a **6 / 3 / 3** grid: the plan card (6), the slot (3), and a third column (3) with **By day stacked over the ranked card**. Everything is above the fold and nothing scrolls. Cells ≈ 100 x 36. |
| **3440 x 1440** (`min-[160rem]:`) | Content `max-w-[2560px] mx-auto` in the main area, so there is no narrow column. Same 6/3/3 grid. Rows 44px, label column 140, cell number 15px. Each cell adds a muted second line with the block's chance in a single warehouse, or the lowest chance in All ("57.0%"). With Compare on, it shows `29 → 34` inline. Check the computed `grid-template-columns` (12 tracks) on a screenshot, and that the pills don't read as stretched bars. |

### The board: All warehouses against one warehouse

- **One warehouse** (`wk` = "1", "2" or "4"): 63 cells, one per block (`store_id = wk`). The number is `block.plan`.
- **All** (the default): still **63 cells**, one per (department, day, shift), each over the 3 warehouses' blocks:
  - **Number:** `Σ plan` (BASE range 9-134; the sum equals the CSV).
  - **Service-lens tier:** from the **lowest** `chance` of the 3. The legend reads "lowest" in All, and the tooltip lists all 3.
  - **Warm:** if any of the 3 is `below_goal`. The intensity is P1b if any below-goal block has `chance < 0.80`.
  - **Pips:** 1-3 small `bg-ink/60` dots in the top-right corner count the warehouses below goal. BASE: 43 cells with none, 10 with 1, 6 with 2, 1 with 3, so **17 warm**. PEAK: 21 (7 / 4 / 10). DISRUPT: 28 (19 / 7 / 2).
  - **People and cost lenses:** the mean `change` (or `cost_change`) per open block, on the single-warehouse thresholds.
  - **Click:** the slot shows the **All-cell detail** (section 5.8). Clicking a warehouse row there sets `wk` and selects that block (the drill-down).
- **Closed:** always Pharmacy Sat 14 Eve, Sun 15 Open and Sun 15 Eve, in every warehouse and scenario. So the same 3 cells are closed in every view: 9 blocks per scenario.

---

## 4. Tokens (step 4, tokens.md, read against the showcase)

Defined once in `web/draft4/src/styles.css`:

- light values in `@theme`;
- dark values under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`, and **again** under `:root[data-theme="dark"] { … }`;
- `body { background: var(--color-page); color: var(--color-ink); }`.

Tints are always token + alpha (`bg-bad/12`), or a tier token, so they adapt to the theme.

**Colour rules (the user, 2026-11-05, from the showcase image):** green = good, red = bad, grey = comparison and
neutral, blue = controls only. No amber anywhere. Red and green never carry meaning alone: signs, underline / bold,
the worst block's corner flag, position in the list and labels carry it too. The showcase has one data hue, a teal-green,
so the Service series and the ranked card's share bars are green; the people / money entity hues are gone. Magnitudes
(People, Labor cost, headcount bars) are ink or grey, never green or red, and the selected tile is a control state (blue).

| Token | Light | Dark | Use |
|---|---|---|---|
| `page` | `#f8f8f6` | `#0b0b0d` | page background (warm light grey) |
| `card` | `#ffffff` | `#141417` | cards, selected segment pill, slot |
| `soft` | `#f1f1ef` | `#1c1c20` | segmented track, hover, holiday band, skeletons |
| `side` | `#f3f3f1` | `#101013` | sidebar, phone menu sheet |
| `ink` | `#17171a` | `#f3f3f5` | primary text, **every cell number**; base of the People / Labor cost magnitude tiers |
| `ink-2` | `#48484d` | `#c4c4ca` | unselected tile values, row labels, draft values |
| `muted` | `#66666d` | `#8c8c95` | labels, axes, sub-lines, legend, neutral deltas (≥ 4.5:1 on card, soft, side and page in both themes) |
| `line` | `rgb(0 0 0 / .075)` | `rgb(255 255 255 / .08)` | hairlines, tile dividers, 3px bar tracks |
| `line-strong` | `rgb(0 0 0 / .14)` | `rgb(255 255 255 / .16)` | closed-cell dashes, switch-off track |
| `accent` | `#3e63dd` | `#7b96ff` | **controls only**: Compare switch on, focus rings, selected cell ring, selected tile / row / day fill, Next button, active sidebar icon |
| `on-accent` | `#ffffff` | `#0b0b0d` | text on solid accent (the Next button) |
| `good` | `#0f7f57` | `#34c48b` | **good**: Service tiers that meet the goal, improving deltas (Service ▲, Below goal ▼, a cost fall), the Service plan series in By day (line + soft gradient), the selected Service tile's sparkline, the ranked card's share bars (every row, whatever the sign), chance bars that meet the goal, Meets goal chip |
| `bad` | `#d23f45` | `#e5484d` | **bad**: below-goal tiers, worsening deltas (a cost rise), Below goal list squares and bars, Short / Below goal / Unfilled chips, the bullet bar and gap below goal, the need tick past capacity, the dashed unfilled underline, Below goal bars in By day, the Offline dot |
| `bad-strong` | `#a3262c` | `#ff7b80` | the single worst block: its 3px ring, corner flag, list square and bar (darker in light, brighter in dark, so it is the most salient red in both); and red **text** (worsening deltas), because `bad` is under 4.5:1 on the selected tile's tint |
| `tip` | `#1f2530` | `#2a3548` | the one tooltip surface (text `#fff`, muted lines `rgb(255 255 255 / .68)`) |
| `live` | `#0f7f57` | `#34c48b` | the `● Submitted plan` dot (the good green) |
| `series-grey` | `#828289` | `#75757f` | **comparison and neutral**: draft line and fill, draft bars, draft dot, unselected sparklines, the All-cell warehouses' plan bars (≥ 3:1 on the card and the bullet's darkest range) |

### Board tier tokens (colour-mix of a base token; text in every cell is ink)

| Tier token | Light | Dark | Cells |
|---|---|---|---|
| `tier-ok1` | `good` 5% | `good` 5% | Service 99%+ (healthiest, palest) |
| `tier-ok2` | `good` 8.5% | `good` 8.5% | Service 97%+ |
| `tier-ok3` | `good` 12.5% | `good` 12.5% | Service 95%+ (nearest the goal) |
| `tier-low` | `bad` 26% | `bad` 34% | below goal (chance ≥ 80%), every lens; number underlined |
| `tier-far` | `bad` 42% | `bad` 52% | below goal, chance < 80%, every lens; number **bold** + underlined |
| `tier-cut` | `ink` 3.5% + `ring-ink/30` | `ink` 5% + `ring-ink/30` | People: fewer than the draft (outlined) |
| `tier-m1` / `m2` / `m3` | `ink` 5.5 / 10 / 15% | `ink` 8 / 13 / 19% | People +1 / +3 / +6, Labor cost +$1 / +$300 / +$800 (magnitude, never green or red) |

In greyscale (light) every red tier is darker than every green or grey tier (`tier-low` relative luminance 0.67 against `tier-ok3` 0.84
and `tier-m3` 0.72), so intensity grows toward the problem.

### Derived fills (token + alpha over the card)

| Use | Value |
|---|---|
| Selected tile (every tile) | `bg-accent/[.06] ring-1 ring-inset ring-accent/20` (as a selected row); sparkline in the metric colour: Service `good`, Below goal `bad` micro-bars, People / Labor cost `ink` |
| Unselected tile sparkline | `series-grey` line on a `soft` fill |
| Worst block (P2) | its tier fill + `ring-[3px] ring-bad-strong ring-offset-2 ring-offset-card` + a `bad-strong` corner flag |
| Selected cell | `ring-2 ring-accent ring-offset-2 ring-offset-card` (it wins over the red ring; the red returns on deselect) |
| Selected row / day | `bg-accent/[.06] ring-1 ring-accent/20 ring-inset` (selection is a control state) |
| Chips | Below goal, Short N, Unfilled N, the ranked card's count: `bg-bad/12 text-ink`; Meets goal: `bg-good/10 text-ink`; neutral (Closed, At capacity, cause, a change): `bg-ink/[.05]`–`[.07]` |
| Deltas | `text-good` improving, `text-bad-strong` worsening (Labor cost is lower-is-better), `text-muted` People and tiny bases |
| By day | plan: Service `good` 2px line over a `good` 20% → 2% gradient; People / Labor cost `ink` 2px line over an `ink` 10% → 2% gradient (Below goal: `bad` 22% bars with a solid `bad` cap); draft: `series-grey` 1.5px line over a 14% → 2% grey gradient (bars at 45%) |
| Share bars | ranked card: 3px `good` at 75% opacity on `line/70`, one colour on every row (Changes: length = share of the largest \|change\|, the sign is in the number); All-cell warehouses: `series-grey` (plan headcount, beside the red below-goal dots) |
| Staff bar (block detail) | headcount by source, a magnitude: Regular `ink/80`, Cross-trained `ink/62`, Overtime `ink/48` (each ≥ 3:1 on the card); the need tick past capacity and the draft's dashed unfilled part stay `bad` |
| Holiday band | `bg-soft` (header), `soft/60` (chart `ReferenceArea`) |
| Bar track / hover | `bg-line/70` / `hover:bg-soft/60` |

Measured on the rendered page (`planning/evidence/draft4/recolor/contrast.json`): every cell number, delta and chip ≥ 4.5:1
and every mark ≥ 3:1, light and dark.

### Radius, shadow, type, spacing (read from the images)

**Radius**

| Element | Radius |
|---|---|
| Cards | 18px |
| Bottom sheet, phone menu, dialogs | 20px |
| Selected tile inner fill | 12px |
| Board cells | 9px (10px at ≥ 160rem) |
| List rows, sidebar rows | 10px |
| Tooltip | 10px |
| Pills, segmented control, switch | fully round |

**Shadows**

| Token | Light | Dark |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgb(0 0 0/.04), 0 1px 1px rgb(0 0 0/.02)` (barely there, as in the showcase) | none; the `line` border carries the card |
| `--shadow-pill` | `0 1px 2px rgb(0 0 0/.06), 0 0 0 1px rgb(0 0 0/.04)` (selected segment, active sidebar row) | `0 0 0 1px rgb(255 255 255/.08)` |
| `--shadow-pop` | `0 12px 32px -8px rgb(0 0 0/.18), 0 0 0 1px rgb(0 0 0/.06)` (sheet, dialog, tooltip) | `0 12px 32px -8px rgb(0 0 0/.6), 0 0 0 1px rgb(255 255 255/.08)` |

There is no shadow on data.

**Type.** `font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif`. Base 14px. Every number gets `.tnum { font-variant-numeric: tabular-nums }`.

| Role | Size / weight / tracking |
|---|---|
| Page title "Overview" | 20 / 600 / −0.015em |
| Scenario full name, week | 14 muted / 12.5 muted |
| Card title | 15.5 / 600 / −0.01em |
| Tile label | 14, ink-2 (ink 500 when selected) |
| KPI value | **32 / 600 / −0.03em, line-height 1.15** (28 compact and phone) |
| Delta | 12 / 500 |
| Tile sub-line | 12.5 muted |
| Cell number | 13.5 / 600 (bold 700 for W2); 12 on phone; 15 at ≥ 160rem |
| Cell secondary | 11 muted |
| Column header | weekday 12 muted, date 13.5 / 600 ink-2 |
| Legend, chips, list column headers | 12 muted |
| Axis | 11.5 muted |
| Tooltip | 12; first line 15 / 600 |

**Spacing.** Gutter 24 (32 at ≥ 112.5rem, 16 on phone). Card gap 16 (12 compact). Card padding 20 (24 at ≥ 112.5rem, 12 on phone). Tile wrapper `p-2`, inner `px-4 py-3` (`py-2.5` compact). List rows `h-11 px-3 pb-1.5`. Board gaps: 5px between cells, 10px between departments (4 / 8 compact).

---

## 5. Components (step 5; the skill pattern in brackets)

### 5.1 Sidebar [showcase sidebar, wide-before.jpg]

`bg-side border-r border-line`, 232px wide (216 below 90rem, 248 at ≥ 112.5rem), full height, sticky, 12px padding.

- **Top.** A 24px `rounded-lg bg-ink` square holding lucide `LayoutGrid` (14px, card colour). Then "Workforce Planner" (14 / 600) and "Feb 12 – 18, 2026" (12.5 muted) from `meta.days`. Tooltip: the week plus the holidays. There is no date picker (D8).
- **"Scenario"** (12 muted, mt-6). Three rows, each `h-10 rounded-[10px] px-3`, a `<button aria-pressed>`:
  - icon 16px muted: `CalendarDays` Base, `TrendingUp` Peak, `UserMinus` Disrupt;
  - label `Base` / `Peak` / `Disrupt` (14px);
  - a `kbd` chip on the right: `B` / `P` / `D` (11px, `border border-line rounded px-1.5 text-muted`).
  - **Selected:** `bg-card shadow-[var(--shadow-pill)]`, label ink 500, icon accent (the white pill on grey, as "Analytics" in wide-before). Hover: `bg-card/60`.
  - While a newly chosen scenario is still loading, its row swaps the kbd chip for a 12px spinner.
  - **Tooltip:** `meta.scenarios[i].name`, then `description`, then "Service 87.0% · Below goal 45" from `/api/compare` (`by_warehouse` when a warehouse is selected). These figures are tooltip-only (say it once).
- **Footer**, pinned to the bottom like the showcase "QA UI / Times in UTC" row: "Simulated data" (13 ink-2) over "Not Costco data" (12 muted); tooltip `meta.notice`. On the right, a round 32px theme button (`Sun` / `Moon` / `Monitor`, `hover:bg-soft`) cycles system → light → dark. It sets `data-theme` on `<html>` (none for system) and is saved in `localStorage` inside try/catch. Tooltip: "Theme · System", "Theme · Light" or "Theme · Dark".

### 5.2 Header row [layout.md page order; showcase pill toolbar]

- **Left:** "Overview" (20 / 600), then the scenario full name (14 muted): "Baseline planning week", "Promotion and winter-weather surge" or "Callouts and reduced availability". It changes on a switch, so the room sees what's on screen.
- **Right**, one pill group with gap 8. Each pill is `h-8 rounded-full border border-line bg-card px-3 text-[13px]`:
  1. **Status pill.** Ready: a 6px `bg-live` dot and "Submitted plan". Tooltip: "Default settings · exactly the submitted file · 567 rows". While preparing: a spinner and "Preparing · {health.step} · {elapsed} s". When a fetch fails: a `bg-down` dot and "Offline".
  2. **Simulated data:** lucide `Info` 13px muted and "Simulated data". Tooltip `meta.notice`, verbatim.
  3. **CSV:** lucide `Download` 14px and "CSV", as `<a href="/api/submission.csv" download>`. Tooltip: "Submission file · 567 rows · 3 scenarios".
- **Below 80rem,** the scenario segmented control (5.3) goes first in this group.

### 5.3 Segmented control [components.md "Tabs inside a panel"; showcase "Revenue | Visitors"]

- **Track:** `inline-flex rounded-full bg-soft p-1 h-9`.
- **Items:** `h-7 px-3.5 rounded-full text-[13px] text-ink-2 min-w-0 truncate` with a `title`. Selected: `bg-card text-ink font-medium shadow-[var(--shadow-pill)]`.
- **Behaviour:** it shrinks and truncates, and never scrolls. `role="radiogroup"`, items `role="radio"`, arrow keys move between them.
- **Where it's used:**
  - **Warehouse filter** in the plan card toolbar: `All | Warehouse 1 | Warehouse 2 | Warehouse 4`. Keys `0` / `1` / `2` / `4`, and the tooltip is `meta.warehouses[].name` ("Warehouse 2 (Large)").
  - **Scenario switch** below 80rem.
  - **Ranked card tabs.**
- **Shortcuts** B / P / D / 0 / 1 / 2 / 4 work globally. They're disabled while focus is in an input or a dialog.

### 5.4 KPI strip and the selected tile [components.md KPI strip; snippets.md "KPI tile with the selected fill"]

One strip inside the plan card: `grid grid-cols-4` (2x2 on phone), `border-b border-line`, tiles divided by `border-r border-line` (none on the last). Each tile is a `<button aria-pressed data-tile="service|below|people|cost" data-value="{raw}">` with a `p-2` wrapper and an inner `rounded-xl px-4 py-3`.

**Anatomy, matching kpi-tiles.jpg:**

1. Label (14, ink-2; ink 500 when selected) left, **delta** right (12 / 500, tabular).
2. Value (32 / 600, −0.03em): ink when selected, ink-2 when not.
3. Sub-line: the baseline as a numeric fact, `Draft {draft value}` (12.5 muted).
4. Sparkline: 28px, 1.5px line, faint fill (15% → 0), no axes, a dot on the last point. It draws the 7 `T.by_day[].plan.<metric>` values, the same window as the board's columns and the By day chart. Unselected tiles use a `series-grey` line on a `soft` fill; the selected tile uses its entity colour. For Below goal it's 7 micro-bars instead of a line (zero days). Hidden in compact mode and on phones.

| Tile | Value (BASE All) | Delta | Delta colour | Sub-line | Selected tint | Spark |
|---|---|---|---|---|---|---|
| **Service** (default) | `95.6%` = `plan.expected_met`, 1 decimal | `+27.1 pts` = `change.expected_met` × 100, 1 decimal | `up` when > 0, `down` when < 0 | `Draft 68.5%` | accent | line of `by_day[].plan.expected_met` |
| **Below goal** | `25` | `−110` = `change.below_goal` (U+2212) | `up` when negative (lower is better), grey `±0` | `Draft 135` | warn | 7 bars of `by_day[].plan.below_goal` |
| **People** | `2,710` | `+13%` = change / draft, whole % | **grey always** (volume, neutral) | `Draft 2,390` | accent | `by_day[].plan.employees` |
| **Labor cost** | `$377.5k` (exact `$377,504` in the tooltip) | `+15%` | **grey always** (the deliberate trade; see the tooltip) | `Draft $329.1k` | money | `by_day[].plan.cost` |

**Delta rules.**

- A draft base under 5 shows grey `was N`, never a percentage. It's a guard: no real base is that small.
- The sign is always shown (`+` or `−`), so the delta never relies on colour.
- A tile's delta appears nowhere else on screen.

**Tooltips** (the explanations live here; filled from `T`):

| Tile | Tooltip |
|---|---|
| Service | "Expected service · average chance an open block meets its wait target · 95.56% · Draft 68.46% · Goal 95% per block · lowest block 57.0%" |
| Below goal | "Open blocks under a 95% chance even with all their own staff and overtime · 25 of 180 · Draft 135". In DISRUPT add "· Draft can't field 36 people in 12 blocks". |
| People | "Employees summed over the 180 open blocks, as submitted · one person in two blocks counts twice · 11,657.5 paid hours · 974.5 overtime · 0 over capacity · Draft 2,390" |
| Labor cost | "$377,504 · Draft $329,108 · +$48,396 · The extra cost buys 27.1 points of expected service" |

**Selection** sets `lens`, one of `service`, `below`, `people` or `cost`. It drives the board's colours **and** the By day chart's metric. **The cell numbers never change meaning: they are always the headcount** (D1, D2). Focus: `group-focus-visible:ring-2 ring-accent` on the inner fill.

### 5.5 Board toolbar [showcase "Compare with the period before" row; components.md heatmap legend]

- **Left: the Compare with draft switch.** A 32x18 track (`bg-accent` when on, `bg-line-strong` when off) with a white knob and a 13.5px ink-2 label. It's a `role="switch"`, **off by default**.
  - It's global: it adds the draft secondary in the board cells, the draft line and bars in By day, and the draft rows in the detail.
- **Right: the legend for the lens.** Swatches are 14x10 with radius 4, labels 12 muted.

| Lens | Legend (in order) |
|---|---|
| Service | `99%+` · `97%+` · `95%+` · `Below goal` (warn/30, underlined) · `Under 80%` (warn/52, bold underlined) · `Closed` (dashed). In All, prefix "lowest". |
| Below goal | `Below goal` · `Under 80%` · `Closed` |
| People | `Cut` · `Same` · `+1` · `+3` · `+6` · `Below goal` · `Closed` |
| Labor cost | `Same` · `+$1` · `+$300` · `+$800` · `Below goal` · `Closed` |

### 5.6 The schedule board [components.md Heatmap; snippets.md "Heatmap tiers and cells"]

**Grid.** `role="grid"`, `gridTemplateColumns: "104px repeat(7, minmax(0,1fr))"`: 112px at ≥ 90rem, 140px at ≥ 160rem, 36px below 64rem. Grid `aria-label`: "Schedule, Base, all warehouses: 2,710 people, 25 blocks below goal, most on Sat 14".

**Column header.**

- **Holiday band.** Above the headers a range-calendar-style band (`bg-soft`, rounded only at its outer ends) spans the 4 `meta.days[].holiday_window` columns, Fri 13 to Mon 16. It's labelled "Holiday window" (11 muted, centred).
- **Each column:** weekday (12 muted, "Thu"), then the date (13.5 / 600 ink-2, "12").
- **Named-holiday dot:** a 4px `bg-ink-2` dot under the date on Sat 14 and Mon 16. Rule: `holiday` is set and doesn't end in "weekend".
- **Header tooltip** (from `T.by_day`): "Sat Feb 14 · Valentine's Day · 499 people · 11 below goal".
- **Focus day.** Clicking a By day point marks its column: the date turns accent and gets the dot. This reuses the skill's "latest column" marker.
- There is no "today" mark (D8).

**Row labels.** The department name appears once per group (12.5 / 600 ink-2, centred over its 3 rows: "Front End", "Merchandising", "Pharmacy"); its tooltip is `meta.departments[].service_target`. The shift is right-aligned on every row ("Open", "Mid", "Eve", 12 muted); its tooltip is `meta.shifts[].name`. Rows run Front End, Merchandising, Pharmacy, and within each Open, Mid, Eve.

**Cell.** `<button role="gridcell" class="relative grid place-items-center h-9 rounded-[9px] text-[13.5px] font-semibold tnum text-ink">`, with `data-key`, `data-plan`, `data-below`, `data-tier`. In All, `data-key` is `all|{dept}|{date}|{shift}`.

- **Centre:** the headcount, `plan` (All: Σ).
- **Compare on:** a muted 11px secondary after the number: `+5`, `−1`, or nothing when it's 0. At ≥ 160rem it shows `29 → 34` instead. Hidden on phones.
  - On P3 blocks the secondary gets `underline decoration-dashed decoration-warn`.
- **Fill**, applied in this order (the warm tier overrides every lens):

| Order | Condition | Service lens | Below goal lens | People lens (`change`) | Cost lens (`cost_change`) |
|---|---|---|---|---|---|
| 1 | `!is_open` | dashed `border-[1.5px] border-dashed border-line-strong`, no fill, "—" muted | same | same | same |
| 2 | P1 and chance < 0.80 | W2 `warn/52`, bold, underlined | same | same | same |
| 3 | P1 | W1 `warn/30`, underlined | same | same | same |
| 4 | healthy | ≥ 0.99 `accent/7` · ≥ 0.97 `accent/15` · otherwise `accent/26` | no fill, `ring-1 ring-inset ring-line`, number ink-2 at 55% opacity | < 0 `ink/6` · 0 `ring-line` · +1-2 `accent/7` · +3-5 `accent/15` · ≥ +6 `accent/26` | ≤ 0 `ring-line` · < $300 `money/7` · $300-800 `money/15` · ≥ $800 `money/26` |

- **Real BASE tier counts** (single blocks, 180 open):
  - Service: 27 / 78 / 50, warm 17 + 8.
  - People: 12 / 36 / 87 / 34 / 11.
  - Cost: 46 / 64 / 61 / 9.
  - No tier is empty and none is a wall.
- **Extra marks:**
  - All: pips for warehouses below goal (3.5px `bg-ink/60` dots, 2px apart, top-right inset 4).
  - P2: the red ring. In All, it goes on the aggregated cell that contains the worst block.
  - Selected: the accent ring; its row label and column header turn ink.
- **Hover:** `brightness-[.97]` and the tooltip.

**Cell tooltip** (dark):

- First line, big: "34 people".
- Muted lines:
  - "Sat Feb 14 · Front End · Midday · Warehouse 1 · 12:30–16:00";
  - "Chance 57.0% · goal 95%";
  - "Need 39 · can field 34 · short 5" (short only when below goal);
  - Compare on: "Draft 29 · chance 4.8%";
  - Cost lens: "Cost $3,647 · +$696".
- In All: one line per warehouse ("W1 34 · 57.0% · below"), plus "Lowest chance shown".
- On P2, add "Worst block in view: lowest chance, then largest shortfall".

**Keyboard.**

- Roving tabindex. The arrows move between cells, and closed cells are focusable. Home and End go to the row ends.
- Enter or Space selects and opens the detail. Escape clears the selection and returns focus. N and P go to the next or previous P1 block in list order.
- The tooltip shows on focus. The focus ring is `ring-2 ring-accent ring-offset-2`.
- **aria-label, context first:** "Warehouse 1, Saturday February 14, Front End, Midday: 34 people, 5 more than the draft, 57.0% chance, below goal, 5 short".

**Expand (⤢)** in the plan card toolbar. Build it last; cut it if time is short. It opens a Radix Dialog with the board alone at full viewport: 44px rows, the inline `29 → 34`, the same marks and selection (Apple's "expanded" size). Escape closes it.

### 5.7 Slot card: the Below goal list [components.md Ranked list; snippets.md "Ranked row with a slim share bar"]

The same height as the plan card (`self-stretch`), and never empty. The content swaps with a 150ms opacity crossfade.

- **Header:** "Below goal" (15.5 / 600). On the right, ⤢ ("All below-goal blocks"), which opens a Radix Dialog with the full list.
- **Column header** (12 muted): `Block` on the left; `Chance` and `Short` on the right.
- **Rows** (`<button class="group relative flex h-11 w-full items-center gap-3 rounded-[10px] px-3 pb-1.5 text-left text-[14px] hover:bg-soft/60">`), `data-key`:
  - a 6px square on the left: `bg-warn`, or `bg-down` for P2;
  - the name `{day_short} · {department} · {Open|Mid|Eve}`, truncated with `title`. On a narrow card it folds to `FE / Merch / Pharm`.
  - in All, a `W1` chip (11px, `bg-ink/[.05] rounded px-1`);
  - `Chance` right-aligned, tabular, ink (`chanceText`);
  - `Short` = `need − plan`, 13 muted, `w-9` right-aligned;
  - the **3px bar** (`absolute inset-x-3 bottom-[5px] h-[3px] rounded-full bg-line/70`): fill width = chance on 0-100%, `bg-warn` at 75% opacity (`bg-down` for P2; full opacity on hover). A 1px × 7px `bg-ink/40` goal tick sits at 95% on the track.
- **Order:** P1 blocks by `chance` ascending, then `need − plan` descending, then `key`. BASE All top row: **Sat 14 · Front End · Mid · W1 · 57.0% · 5**.
- **Count:** the first 8 rows show (6 in compact), and there's no inner scroll. The bottom-left footnote reads `8 of 25` (12 muted, a list position, not a claim).
- **Click:** the row selects the block (ring on the board, scrolled into view if needed) and opens the detail.
- **Empty** (the view has 0 P1 blocks; real data never does, but the fixture's W2 does): the header becomes **"Closest to goal"**, and the 8 lowest-chance open blocks are listed with `bg-ink/25` bars. There's no all-clear sentence, because real data is on screen.

### 5.8 Slot card: block detail and All-cell detail [range-calendar.jpg "‹ Ranges" back-link swap]

**Block detail** (a single-warehouse block), top to bottom:

1. **Top row:** `‹ Below goal` back link (13 muted, the showcase's "‹ Ranges"), an `ⓘ` button and `×`. Escape also goes back.
   - The ⓘ tooltip (max 320) carries `explanation.why`, then `explanation.demand_driver`, then `explanation.cushion`. This is the only place the reason is written out.
2. **Title:** `Sat 14 · Front End · Midday` (15.5 / 600). Under it, muted: `Warehouse 1 · 12:30–16:00 · {paid_hours} h`.
3. **Chips** (`h-6 rounded-full px-2.5 text-[12px]`, one or two words each):
   - `Below goal` (warn/15 fill, ink text) or `Meets goal` (accent/10);
   - `At capacity` (`bg-ink/[.05]` ink-2);
   - a cause chip from `availability.note`, whose tooltip is the full note:

     | Note starts with | Chip | Extra tooltip line |
     |---|---|---|
     | "Holiday-weekend PTO" | `Holiday PTO` | `/api/playbook` `pto.headline` |
     | "Approved PTO" | `PTO` | |
     | "Illness cluster" | `Illness` | |
     | "Receiving crew shortage" | `Crew shortage` | |
     | `null` | no chip | |
     | anything else | its first two words | |

   - `Closed`, for closed blocks only.
4. **Draft → Plan:** "Draft" (12 muted) over `29` (26 ink-2), then `→`, then "Plan" over `34` (32 ink), then a change chip: `+5` (accent/10), `−1` (soft) or `Same`. `block.action` is its `aria-label`.
5. **Chance** [Bullet snippet], 24px track on 0-100%:
   - label row: "Chance" on the left; `57.0%` (15 / 600) on the right, and `draft 4.8%` (muted) when Compare is on;
   - ranges 0-80 `ink/25`, 80-95 `ink/15`, 95-100 `ink/7` (darker for poor);
   - the bar is a third of the track's height, `warn` when below goal, else `accent`;
   - the target is a 2px ink line at `plan.goal`, labelled "95%" (11 muted);
   - the draft chance is a 6px `series-grey` dot on the midline (Compare on);
   - a `Short 5` warn chip sits beside the label when below goal.
6. **Staff** [segmented share bar]:
   - label row: "Staff" on the left; `34 of 34` on the right (`plan` of `availability.capacity`);
   - the track width is `max(capacity, need, draft)`, with segments `h-2.5` and 3px gaps: regular `accent`, cross-trained `accent/55`, overtime `accent/30`;
   - a need tick (2px, `warn` when need > capacity, else `ink/40`) labelled "need 39" (11 muted);
   - legend: `Regular 27 · Overtime 7` (zero parts omitted);
   - Compare on, with `draft_sources.unfilled > 0`: a second muted row `Draft 22 · 1 · 3` and a warn chip `Unfilled 4`.
7. **Stats row** (3 mini stats: label 12 muted over value 15 / 600):
   - `Cost` **$3,647** in money, then grey `+$696`. Tooltip `explanation.cost_effect`.
   - `Cushion` **2** (`cushion_people`). Tooltip `explanation.cushion`.
   - `Utilization` **82%** (`utilization`), with muted `draft {utilization_draft}` when Compare is on. Tooltip: "Service falls off near 85–90%".
8. **Actions** (bottom, sticky): `‹ Previous` (a secondary pill) and **`Next ›`** (`bg-accent text-on-accent rounded-full h-8 px-4`), each with a `kbd` chip (P / N).
   - They walk the P1 list order and are disabled at its ends.
   - For a healthy block they step through the same department and shift on the previous or next day.

The selection persists across scenario switches: the same `store|dept|date|shift` under the new scenario prefix. The presenter can pick one block and flip Base → Peak → Disrupt. A warehouse switch keeps it when the block is in the new view; going from a single warehouse to All maps it to its aggregated cell.

**Closed block detail:** the title, the `Closed` chip, and `—` for chance, staff, cushion and utilization.

**All-cell detail:**

- The title without the warehouse ("Sat 14 · Front End · Midday").
- A 3-row table, Warehouse 1 / 2 / 4. Columns: `Draft` · `Plan` · `±` · `Chance`, plus a warn square for below-goal rows. Each row is `h-11` with a 3px plan-share bar in accent.
- A footer row of sums: draft, plan, change.
- The cause chips that apply to any row.
- Clicking a row sets `wk` and selects that block.

### 5.9 By day chart [components.md Main chart; the showcase chart with its compare toggle]

- **Card title**, a muted label over the large value:

| Lens | Title (BASE All) |
|---|---|
| Service | `Lowest day` / `Sat 14 · 87.6%` |
| Below goal | `Worst day` / `Sat 14 · 11` |
| People | `Busiest day` / `Sat 14 · 499` |
| Labor cost | `Costliest day` / `Sat 14 · $64.2k` |

  The legend sits on the right: `— Plan`, plus `— Draft` when Compare is on.
- **Recharts** `ComposedChart`, 220px plot (260 at ≥ 112.5rem), `isAnimationActive` 200ms.
  - **Plan:** a 2px `monotoneX` line in the entity colour (accent; money for cost) with a 15% → 0 gradient area.
  - **Draft:** a 1.5px `series-grey` line, no fill, drawn behind, Compare on only.
  - **Below goal:** bars instead. The plan bar is `warn/25` with a solid 6px rounded `warn` cap; the draft bar is `series-grey/40` beside it.
  - No dots until hover.
- **Y axis:**
  - Service is fixed 0-100%, ticks 0 / 25 / 50 / 75 / 100%, with a dashed 1px `ink/40` `Goal 95%` line.
  - The others use `niceTicks(max(plan, draft), 4)` from 0 with compact labels (`$20k`, `200`).
  - The axis covers both series, so toggling Compare never moves it. 11.5 muted, gridlines `line`.
- **X axis:** all 7 days (`Thu 12` … `Wed 18`). A `ReferenceArea` in `soft/60` covers Fri 13 to Mon 16.
- **Tooltip** (the dark one): "87.6%" big, then "Sat Feb 14 · Valentine's Day", then "Draft 46.4% · +41.2 pts" when comparing. A vertical hairline marks the day.
- **Interaction:** the hit area is the full-height column. A click focuses that day's column on the board. Arrow keys move between days. `touch-pan-y`.
  - `aria-label`: "Expected service by day, plan: lowest Sat 14 87.6%, highest Wed 18 97.8%".

### 5.10 Ranked card [components.md Ranked list with tabs; ranked-lists.jpg]

- **Header:** segmented tabs `Changes | Departments | Warehouses | Scenarios`. `Warehouses` shows only when `wk = "all"`, so no tab ever has a single row. ⤢ sits on the right.
- **Rows** use the 5.7 anatomy. Each card shows at most 7 rows and keeps a 7-row minimum height, so switching tabs never makes the page jump.

| Tab | Source | Row | Bar | Click | Footnote |
|---|---|---|---|---|---|
| Changes | `T.largest_changes` (10 keys) → blocks, first 7 | name (+ W chip in All) · `+15` ink · `32 → 47` muted | `|change| / max`, accent for adds, `ink/25` for cuts | selects the block | `vs draft` |
| Departments | `T.by_department` | name · `1,466` · `54%` muted · warn chip with `below_goal` when > 0 | share of `T.plan.employees`, accent | none | `of 2,710 people` |
| Warehouses | `plan.totals["1"/"2"/"4"]` | `Warehouse 2` + `Large` muted · employees · share · warn chip | share, accent | sets `wk` | `of 2,710 people` |
| Scenarios | `/api/compare` (`by_warehouse` when a warehouse is selected) | name · `95.6%` · `$377.5k` muted | expected service on 0-100%, accent | switches the scenario; the current row gets the selection fill | `Service · Cost` |

### 5.11 Tooltip [components.md Tooltip; snippets.md "One tooltip for the whole screen"]

- **One delegated system for the page.** Elements carry `data-tip` (and `data-tip-title` for the big first line), and a single fixed `#tip` shows them.
  - Style: `bg-tip text-white text-[12px] rounded-[10px] px-3 py-2 max-w-[320px] shadow-[var(--shadow-pop)]`.
  - Lines are split on `\n`; muted lines are `white/68`.
- **Placement:** above the element, flipping below near the top, clamped 8px inside the viewport.
- **Behaviour:** it shows on hover and on focus, and hides on scroll, on Escape, and when its element re-renders.
- **Coverage:** recharts uses the same look through a custom `content`. Every icon-only control, every compact number ($377.5k → $377,504) and every chip has a tip.
- Radix is used only for dialogs and the sheet.

### 5.12 Number formats (`lib/format.ts`)

| Value | Format |
|---|---|
| Integers | `toLocaleString('en')` |
| Money | compact on tiles and axes (`$377.5k`, `$20k`); exact in tooltips and the detail (`$377,504`, `$3,647`) |
| Hours | `11,658 h` (exact `11,657.5 h` in tooltips) |
| Chance and service (`chanceText`) | always **one decimal**, `Math.round(c * 1000 + 1e-6) / 10`, so 0.949875 → `95.0%` and 0.94595 → `94.6%`; `null` → `—`; `0 < c < 0.001` → `<0.1%`; exactly 0 → `0%`. **Guard:** if `below_goal` and the text would be ≥ the goal's percent, floor to one decimal instead (it never fires under the 0.0005 tolerance, but it must exist) |
| Points | `+27.1 pts` (1 decimal) |
| Signed values | `+5` / `−1` (U+2212) / `±0` |
| Shares | snippets.md `share()` |

Never show `NaN`, `Infinity`, `−0`, `0.0%`, `$-0` or "1 blocks".

### 5.13 Data fetching (`lib/api.ts`)

- **Health:** `useHealth` polls `/api/health` every 500ms until `ready`, or until `status === "error"`.
- **Queries**, all with `staleTime: Infinity` because the numbers are frozen:
  - `useMeta`;
  - `usePlan(scenario)` with `placeholderData: keepPreviousData`, keyed `["plan", scenario]`;
  - `useCompare`;
  - `usePlaybook`, for the PTO headline only.
- **Prefetch:** after BASE lands, prefetch PEAK, DISRUPT, `/api/compare` and `/api/playbook` (about 500 KB each, 13-19ms), so switching scenario during the demo is instant.
- **Warehouse switch:** client-side, choosing `totals[wk]` and filtering blocks. It's instant and never stale.
- **URL state:** `#s=BASE&w=all&l=service&c=0&b=<key>`, written with `history.replaceState`, no router. An invalid value falls back to the default with no error UI. The hash restores the demo view after a refresh.

---

## 6. States (step 6)

| State | When | What shows |
|---|---|---|
| **Preparing** | `health.ready === false`, `status: "preparing"` (≈ 20 s after start; measured 20.6 s) | The frame is real: sidebar, header and static words. Everything else is skeletons at their final sizes (`bg-soft rounded animate-pulse`, still under `prefers-reduced-motion`): 4 tiles, 63 board pills, 8 list rows, the chart rectangle. The status pill shows `◌ Preparing · {step} · {elapsed} s`. No zeros, no fake numbers. |
| **Loading** | ready, plan not yet in | The same skeletons. Prefetch starts once BASE lands. |
| **Stale** | a scenario switch whose plan isn't cached yet (rare after prefetch) | The sidebar row is selected at once and shows the spinner. The plan card, slot, By day and ranked card keep the old payload at `opacity-40 pointer-events-none transition-opacity`. Nothing flashes to 0. Query keys are per scenario, so a late answer for an older scenario never shows. |
| **Startup error** | `health.status === "error"` | **One page-level note card** (`PageNote`) across the main area, above the skeletons. It has a lucide `PlugZap` icon in `down`, the title "Couldn't start the planner", `health.error` in a mono block (it names the commands to run), `Retry` (re-poll) and `Copy commands`. |
| **Unreachable, no data** | fetch rejects, nothing loaded | The same note: "Can't reach the planner", the code chip `start_app_draft4.bat`, and `Retry`. The status pill shows `● Offline`. |
| **Unreachable, with data** | a later fetch fails | The last numbers stay on screen, dimmed only if stale. One slim note bar under the header: "Couldn't load Peak · showing Base", with `Retry`. The status pill shows `Offline`. It never appears per card. |
| **503 mid-session** | the server restarted | Back to Preparing polling. Data on screen stays. |
| **Empty list** | the view has 0 P1 blocks (fixture W2) | "Closest to goal" (5.7). The Below goal tile shows `0` with grey flat bars; the delta follows the tiny-base rule. |
| **Tiny data** | a draft base under 5 | grey `was N` (a guard; real data never triggers it) |
| **Closed blocks** | 9 per scenario | Dashed "—" cells, and the closed detail (5.8). They're never counted: totals use the 180 open blocks. |
| **Theme** | system, light, dark | All tokens swap, and the tiers follow because they're token + alpha. Check it with the app's own toggle, not only the OS. |

### 6.1 The default view equals the submitted plan

- `/api/plan` always returns the submitted plan, and draft 4 never calls `/api/what-if`.
- With no hash, the page shows BASE / All / Service lens / Compare off. The board's numbers sum to **2,710**, which equals the People tile, `T.plan.employees`, and Σ `submitted_employees` for BASE in `/api/submission.csv`.
- In every scenario and warehouse view, each single-warehouse cell's `data-plan` equals the CSV row joined **on keys** (`scenario_code`, `store_id`, `dept_id`, `day_date`, `shift_code`), never by position. Closed cells are 0. Verified on 2026-11-05: 567 / 567, 0 mismatches.
- The `● Submitted plan` pill says so, and the CSV button downloads that same file.

---

## 7. Words (zero sentences on screen)

**On screen (the complete list):**

| Area | Words |
|---|---|
| Shell | Workforce Planner · Feb 12 – 18, 2026 · Scenario · Base · Peak · Disrupt · Simulated data · Not Costco data · Overview · Submitted plan · Preparing · Offline · CSV · Menu |
| Header | Baseline planning week · Promotion and winter-weather surge · Callouts and reduced availability (the scenario names from `meta`) |
| Filter | All · Warehouse 1 · Warehouse 2 · Warehouse 4 · W1 · W2 · W4 |
| Tiles | Service · Below goal · People · Labor cost · Draft · pts |
| Board | Compare with draft · Holiday window · Thu … Wed · Front End · Merchandising · Pharmacy · Open · Mid · Eve · O · M · E |
| Legend | 99%+ · 97%+ · 95%+ · lowest · Below goal · Under 80% · Closed · Cut · Same · +1 · +3 · +6 · +$1 · +$300 · +$800 |
| Slot | Below goal · Closest to goal · Block · Chance · Short · ‹ Below goal · Meets goal · At capacity · Holiday PTO · PTO · Illness · Crew shortage · Closed · Draft · Plan · Staff · of · need · Regular · Cross-trained · Overtime · Unfilled · Cost · Cushion · Utilization · draft · Previous · Next · "8 of 25" |
| Chart | Lowest day · Worst day · Busiest day · Costliest day · Plan · Draft · Goal 95% |
| Ranked card | Changes · Departments · Warehouses · Scenarios · Medium · Large · vs draft · of 2,710 people · Service · Cost |
| States (the only sentences allowed: errors and empty) | Couldn't start the planner · Can't reach the planner · Couldn't load Peak · showing Base · Retry · Copy commands |

**One word per concept:**

| Concept | Word | Never |
|---|---|---|
| The managers' schedule | Draft | current, baseline, schedule before |
| Ours | Plan | recommendation |
| P1 | Below goal | at risk, miss |
| `need − plan` | Short | |
| The chance of meeting the target | Chance | |
| Expected service | Service (the tile label; "Expected service" in its tooltip) | |
| Summed headcount | People | staff, headcount, employees (on screen) |
| Warehouse × department × day × shift | Block (list header and tooltips only) | |

**In tooltips only:**

- `meta.notice`;
- scenario descriptions with their compare numbers;
- each tile's explanation and exact value, including why People is person-shifts and why cost is grey;
- department wait targets;
- shift names and per-block times;
- holiday names and day totals;
- every cell's facts;
- `explanation.why`, `demand_driver`, `cushion`, `cost_effect`, and the full `availability.note`;
- the PTO headline;
- the utilization note;
- what the CSV holds;
- the worst-block rule;
- the P3 explanation ("Draft can't field 36 people in 12 blocks").

---

## 8. QA plan (step 7, qa.md; use the `webapp-testing` skill)

`planning/evidence/drive_draft4.py` (Python Playwright, `deviceScaleFactor: 2`):

1. Builds with `npm run build:draft4`.
2. Serves with `python -m server --draft4 --port 8654 --no-browser` and polls `/api/health`.
3. Fetches the expected answers **from the API and CSV in Python** (not from the app's code) and asserts them against the rendered text and the `data-*` attributes: `data-key`, `data-plan`, `data-below`, `data-tier` on cells; `data-value` on tiles; `data-key` on list rows.
4. Fails on any mismatch. Screenshots go to `planning/evidence/draft4/`.

### 8.1 Known totals

- Every number in section 9 is checked, per scenario and per warehouse key.
- **Each component on its own:**
  - tile text and delta as rendered;
  - sparkline points = `by_day`;
  - board numbers summed (single warehouse and All) = the People tile;
  - warm cells = `plan.below_goal` (single warehouse) and the warm-cell and pip counts (All);
  - list rows (expanded dialog) = the tile count, and its top row;
  - the By day plotted series (from the aria-label or recharts DOM) = `by_day`, and the title's day = its min or max;
  - Departments rows sum to the People tile;
  - Scenarios rows = the tiles after switching;
  - the tile tooltip's exact values = the tile.
- No `NaN`, `Infinity`, `−0`, `0.0%`, `$-0` or "1 blocks" anywhere.
- Quick switches B → P → D → B end on BASE's numbers with no flash of zeros.

### 8.2 Words audit

Collect the visible text nodes outside `#tip`, dialogs, the PageNote and the empty-list header. Flag any node of 5 or more words, or one ending in ".". The target is **0** in every lens and scenario, All and W2, with the detail open.

### 8.3 Salience test

- Take full screenshots at 1440x790 and 1366x657, and a blurred copy (8px Gaussian).
- **Landing order:** first the warm cluster in Sat 14 / Sun 15 and the red-ringed worst cell; second the selected Service tile's `95.6%`; third the top list row. Never the sidebar, the logo square or a healthy tier.
- Repeat for PEAK, DISRUPT W2 (21 of 63 warm) and the Below goal lens.
- No healthy cell is darker than `accent/26`.
- Run every lens under CDP `Emulation.setEmulatedVisionDeficiency` (achromatopsia, deuteranopia, tritanopia). The problems stay findable by the underline, the bold, the pips and the ring.

### 8.4 Widths, states and measurements

- **Viewports:** 375x812 (full page), 768x1024, 1366x657, 1366x768, 1440x790, 1440x900, 1920x1080, 3440x1440.
- **Captures:**
  - each lens;
  - Compare on and off;
  - All and W2 in each scenario;
  - a warm cell's tooltip, and a chart tooltip via keyboard;
  - the detail for the BASE worst block, a healthy block, a closed block, an All cell, and a DISRUPT P3 block with Compare on;
  - Next stepping (N three times);
  - the expanded list and the expanded board;
  - each ranked tab;
  - the phone menu and the phone sheet;
  - dark theme through the app toggle;
  - Preparing (load within 3 s of starting the server);
  - Startup error and Offline (`page.route('**/api/plan*', r => r.abort())` after the first load, then switch to an uncached scenario with prefetch blocked);
  - Stale (throttle `/api/plan` by 1.5 s);
  - the fixture's empty list.
- **Measure:**
  - the plan card's `getBoundingClientRect().bottom ≤ innerHeight` at 1366x657, 1440x790 and 1920x1080 (and the slot card's too);
  - at 375, `document.documentElement.scrollWidth === innerWidth`, with all 7 board columns visible;
  - the computed `gridTemplateColumns` at 1920 and 3440 (12 tracks, 6/3/3), and content width ≤ 2560 at 3440;
  - a single-warehouse board has exactly 63 `[role=gridcell]` (60 numbered + 3 dashed);
  - contrast: muted ≥ 4.5:1 on card, soft, side and page in both themes; cell ink ≥ 4.5:1 on `warn/52`, `accent/26` and `money/26`.
- **Keyboard:** Tab → scenario rows → warehouse control → tiles (`aria-pressed`) → Compare → board (arrows, Enter, N, Escape) → slot → chart (←/→) → ranked tabs. Focus stays visible, and the aria-labels read context first. B/P/D and 0/1/2/4 work, and are disabled inside dialogs and inputs.
- **Offline:** `page.on('request')` sees only `127.0.0.1` URLs.
- **Drafts 2 and 3 untouched:**
  - `git diff --stat -- web/src web/index.html web/vite.config.ts web/tsconfig.json web/dist web/dist-draft2` is empty;
  - `python -m server` and `python -m server --draft2` still serve their apps;
  - `python -m pytest` and `python planning/evidence/drive_web.py` pass.
- **Smell check** (qa.md table): no tinted block behind a list row, no underline marking the selected tile, no sentence under a KPI number, no wall of colour, no card half empty beside a tall neighbour, no sideways-scrolling tabs.
- Record the results and the screenshots in `planning/LOG.md` and `planning/PLAN.md`, following CLAUDE.md.

---

## 9. Known totals (live, port 8653, 2026-11-05; frozen numbers)

### 9.1 Tiles (All warehouses)

| Scenario | Service (draft) · delta | Below goal (draft) · delta | People (draft) · delta | Labor cost (draft) · delta | Hours (draft) · overtime |
|---|---|---|---|---|---|
| **BASE** | **95.6%** (68.5%) · **+27.1 pts** | **25** (135) · **−110** | **2,710** (2,390) · **+13%** | **$377.5k** = $377,504 ($329.1k = $329,108) · **+15%** | 11,657.5 (10,344) · 974.5 |
| PEAK | 87.0% (58.3%) · +28.7 pts | 45 (139) · −94 | 2,766 (2,390) · +16% | $387.9k = $387,926 ($329.1k) · +18% | 11,923 (10,344) · 1,224 |
| DISRUPT | 89.5% (66.6%) · +22.9 pts | 39 (142) · −103 | 2,605 (2,390) · +9% | $366.6k = $366,649 ($326.4k = $326,367) · +12% | 11,288 (10,206.5) · 1,014 |

### 9.2 Per warehouse

| View | Service · delta | Below goal (draft) | People (draft) · delta | Cost (draft) · delta | Warm cells |
|---|---|---|---|---|---|
| BASE W1 | 94.6% · +21.9 pts | 9 (42) | 781 (701) · +11% | $107.3k = $107,325 ($93.6k) · +15% | 9 |
| BASE W2 | 96.3% · +25.9 pts | 8 (42) | 957 (829) · +15% | $135.6k = $135,642 ($117.8k) · +15% | 8 |
| BASE W4 | 95.8% · +33.4 pts | 8 (51) | 972 (860) · +13% | $134.5k = $134,537 ($117.7k) · +14% | 8 |
| PEAK W1 / W2 / W4 | 87.7% / 88.5% / 84.8% | 14 / 14 / 17 | 798 / 975 / 993 | $110.3k / $139.1k / $138.5k | 14 / 14 / 17 |
| DISRUPT W1 | **equals BASE W1 exactly** | 9 | 781 | $107,325 | 9 |
| DISRUPT W2 | 78.7% · +13.8 pts | 21 (48) | 854 (829) | $124.7k ($114.9k) | **21 of 60**; draft unfilled 11 blocks / 34 people |
| DISRUPT W4 | 95.2% · +33.1 pts | 9 (52) | 970 (860) | $134.6k ($117.9k) | 9; draft unfilled 1 block / 2 people |

The warehouses sum to All: 781 + 957 + 972 = 2,710, and $107,325 + $135,642 + $134,537 = $377,504.

### 9.3 Board, list, chart and edges

| Check | BASE | PEAK | DISRUPT |
|---|---|---|---|
| Board sum = CSV `submitted_employees` | 2,710 | 2,766 | 2,605 |
| Footer `by_day[].plan.employees` (Thu → Wed) | 331 · 413 · 499 · 466 · 338 · 337 · 326 | 331 · 448 · 508 · 478 · 338 · 337 · 326 | 331 · 387 · 457 · 432 · 335 · 337 · 326 |
| `by_day[].plan.below_goal` (bars) | 0 · 3 · 11 · 7 · 1 · 3 · 0 | 0 · 9 · 18 · 14 · 1 · 3 · 0 | 0 · 7 · 14 · 9 · 6 · 3 · 0 |
| By day Service title | Lowest day Sat 14 · 87.6% | Sat 14 · 46.7% | Sat 14 · 75.0% |
| Service tiers ≥99 / ≥97 / rest / W1 / W2 (180 blocks) | 27 / 78 / 50 / 17 / 8 | 21 / 74 / 40 / 16 / 29 | 21 / 72 / 48 / 16 / 23 |
| People tiers cut / 0 / +1-2 / +3-5 / +6 | 12 / 36 / 87 / 34 / 11 | 10 / 36 / 78 / 41 / 15 | 22 / 34 / 89 / 30 / 5 |
| Cost tiers ≤0 / <300 / 300-800 / ≥800 | 46 / 64 / 61 / 9 | 45 / 59 / 58 / 18 | 54 / 64 / 57 / 5 |
| All board warm cells (1 / 2 / 3 pips) | **17** (10 / 6 / 1); 43 clean | 21 (7 / 4 / 10); 39 clean | 28 (19 / 7 / 2); 32 clean |
| Worst block (red ring, list top) | `BASE\|1\|38\|2026-02-14\|MID`: W1 Sat 14 Front End Mid, **57.0%**, plan 34, need 39, short 5 | `PEAK\|1\|92\|2026-02-14\|OPEN`: W1 Sat 14 Merchandising Open, **0.3%**, short 8 | `DISRUPT\|2\|38\|2026-02-14\|MID`: W2 Sat 14 Front End Mid, **0%**, short 23 (5 blocks at 0%; the tie-break picks this one) |
| Total short over P1 (`need − plan`) | 43 | 190 | 200 |
| Largest change (Changes, top row) | W2 Sun 15 Front End Mid, 32 → 47, **+15** | W2 Sun 15 Front End Mid, 32 → 50, +18 | W4 Sat 14 Front End Mid, 39 → 48, +9 |
| Change range | −3 … +15 | −3 … +18 | −6 … +9 |
| Draft unfilled marks (Compare on) | 0 | 0 | **12 blocks / 36 people** (W2 11, W4 1). `draft > capacity` would wrongly give 13 |
| Departments (people · cost · below) | FE 1,466 · $163.3k · 11 / Merch 1,002 · $169.5k · 9 / Pharm 242 · $44.7k · 5 | 1,489 / 1,035 / 242; 24 / 16 / 5 | 1,366 / 1,000 / 239; 18 / 10 / 11 |
| Scenarios tab | 95.6% · $377.5k | 87.0% · $387.9k | 89.5% · $366.6k |
| Closed cells | 3 per view: Pharmacy Sat 14 Eve, Sun 15 Open, Sun 15 Eve; 9 per scenario | same | same |

**The worst block's detail (BASE W1 Front End Sat 14 Mid):**

| Field | Value |
|---|---|
| Plan → draft | 34 ← 29, so `+5` |
| Need / capacity | 39 / 34, so `Short 5` |
| Sources | regular 27, cross-trained 0, overtime 7 |
| Chance | 57.0% (draft 4.8%) |
| Cost | $3,647 (`+$696`) |
| Utilization | 82% |
| Cushion | 2 |
| Time | 12:30–16:00 |
| Note | "Holiday-weekend PTO requests", so the chip is `Holiday PTO` |
| Chips | `Below goal` · `At capacity` |

**Edges:**

- `BASE|1|38|2026-02-14|OPEN` (and the same key in DISRUPT): chance 0.949875, `below_goal: false`. It must be a healthy tier with no Short chip, and print **95.0%**.
- `PEAK|4|38|2026-02-13|OPEN`: chance 0.94595, `below_goal: true`. It must be warm and print **94.6%**.

**Fixture (1.1) expected:**

- W2: 0 warm cells; the list header reads "Closest to goal" with 8 rows.
- The P3 block shows a dashed underline with Compare on, and `Unfilled 6` in its detail.
- The P2 tie-break picks the larger-shortfall 0% block.
- The edges behave as above.

**Other facts:**

- `/api/submission.csv`: 567 rows, `team_id` = `TEAM_NAME` (placeholder until T-62), columns `scenario_code, store_id, dept_id, day_date, shift_code, submitted_employees, …`. 0 mismatches against `/api/plan`.
- `/api/health` was ready after 20.6 s.
- `meta.notice`: "All data is simulated for the Texas MISA case competition. It is not Costco data and does not represent Costco wages, staffing levels, schedules or service performance."
- `meta.days[].holiday`: Fri 13 "Presidents' Day weekend", Sat 14 "Valentine's Day", Sun 15 "Presidents' Day weekend", Mon 16 "Presidents' Day". `holiday_window` is true Fri–Mon.

**Corrections to the input specs:**

- BASE All has 43 clean aggregated cells, not 46.
- The worst block's detail is draft 29, chance draft 4.8%, $3,647 (+$696) and 12:30–16:00, not draft 30, 41%, $3,404 and 13:00–17:00.
- The PEAK edge prints 94.6% under this spec's rounding rule.

---

## 10. Build order (one pass)

1. Config, tsconfig, the `package.json` scripts, `styles.css` tokens, `index.html`, `main.tsx`. Run `npm run build:draft4` on an empty `App`.
2. `lib/format.ts`, `ticks.ts`, `board.ts`, `api.ts`, `url.ts`, `tooltip.ts`.
3. The shell: Sidebar, HeaderBar, StatusPill, PageNote, Skeletons, the states.
4. The plan card: Segmented, KpiStrip/KpiTile/Spark/Delta, CompareSwitch, Legend, Board/BoardCell (single warehouse first, then All).
5. The slot: BelowGoalList, BlockDetail (Bullet, StaffBar), AllCellDetail.
6. DayChart, RankedCard.
7. The phone: PhoneBar, PhoneMenu, Sheet. Then the wide breakpoints and compact mode.
8. `drive_draft4.py`; fix until everything is green. Look at every screenshot.
9. ExpandDialog for the board, last; cut it if time is short.

---

## 11. Deviations from the skill (copy into the top comment of `App.tsx`)

- **D1.** The KPI tiles drive the **board's colour lens** (the main view) and the below-fold By day chart, not only a trend chart. The board is the monitoring view, so the strip and the problem grid share one card above the fold. That keeps the showcase's selected-tile interaction and also obeys layout.md's "monitoring view fits one screen".
- **D2.** A cell's number (the headcount, the schedule being submitted) and its colour (the lens metric) are different measures. The number never changes meaning; the legend names the colour, and the tooltip gives both.
- **D3.** There are 63 numbered cells in every view, just over the ~60 guideline. The numbers are the deliverable. Cells are at least 30px tall, with ink text at 4.5:1 or better. All folds the warehouses into sums rather than showing 189 cells.
- **D4.** The selected cell uses an outer accent ring, not a tinted fill, because the fill already encodes the tier.
- **D5.** There are two warm intensities (below goal; under 80%), because the real below-goal chances run from 0% to 94.9%. Red is used on the single worst block only (its ring, list square and bar), with the tie-break rule in its tooltip.
- **D6.** The People and Labor cost deltas are grey. People is volume. Cost rising is the deliberate trade for service, and its tooltip says so.
- **D7.** The sidebar holds the scenario switch, not pages (it's a one-page app). The phone menu grid likewise holds scenarios, warehouses, CSV and Theme.
- **D8.** There's no date-range picker and no "today" column, because the planning week is fixed and in the future. The range-calendar band marks the holiday window instead, and the dot marks named holidays.
- **D9.** By day draws bars for Below goal and lines for the other metrics, because zero days would zigzag as a line. This is different data, not variety.

The skill's "Sign-off" section is intentionally not used anywhere.

---

## 12. Risks for the builder

- **Fold.** The budgets in section 3 are tight. Anything added to the strip or the toolbars pushes the board's last rows below the fold on the projector. Measure them, and recommend F11.
- **DISRUPT W2** (21 of 63 warm) is close to a wall of warm. Keep two warm intensities and no more, and check the blurred screenshot.
- **The All board** mixes a sum (the number) and a minimum (the tier). The "lowest" word in the legend, the pips and the per-warehouse tooltip lines must all ship.
- **3440.** Pills about 160px wide may read as stretched bars. If they do, keep the 2560 cap and add the chance second line, as specified. Don't narrow the content.
- **The CSV** shows `team_id` `TEAM_NAME` until T-62. Don't open it during the demo before then.
- **Uncommitted work.** The `--draft4` flag and `start_app_draft4.bat` are uncommitted work already in the tree. Build on them, and don't overwrite them.
