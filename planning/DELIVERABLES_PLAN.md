# Final deliverables plan

**Status:** Approved for planning on 2026-11-05. **Implementation waits for the user's go.** Skills and tools are already installed (T-71, F-60).

This plan covers the last push before the deadline on the morning of Saturday, Nov 7. It has five deliverables and one verification pass:

1. Check the analysis against every element of the case, and confirm it's the best approach (WS1).
2. Rebuild the web tool from scratch as a professional product (WS3), sharing one look with everything else (WS2).
3. Rewrite the Word file as a standalone report on the analysis and the tool (WS5).
4. Build the presentation: 6-7 minutes of slides, a 5-minute live demo, then 3-4 minutes of questions, within 15 minutes in all (WS6).
5. Build a Jupyter notebook as the code appendix (WS4).

Each workstream lists its tasks (T-73 to T-95), and section 14 maps them to `PLAN.md`. IDs such as F-, D-, A- and R- refer to the other files in `planning/`.

---

## 1. What we hand in

| Deliverable | File(s) | Audience | Built by | Done when |
|---|---|---|---|---|
| Staffing plan | `outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv` | Judges' scorer | `python -m src.pipeline` | The final validator passes with the real team name (T-62) |
| Web tool (proof of concept) | `server/`, `web/`, started with one command | Judges in the live demo, and a warehouse leader | FastAPI with React (D-24) | Acceptance checks in 7.8 pass, and M4 is met |
| Presentation | `deliverables/Costco_Workforce_Presentation.pptx`, plus `.pdf` | Judges, live | `scripts/deck/build_deck.js` (pptxgenjs) | Every check in 10.5 passes, and two timed rehearsals fit in 15 minutes |
| Written report | `deliverables/Costco_Case_Analysis.docx`, plus `.pdf` | Anyone with no context: judges, teammates, a Costco reader | `scripts/build_analysis_doc.js` (docx-js), rewritten | Every check in 9.4 passes |
| Code appendix | `deliverables/Costco_Analysis_Appendix.ipynb`, plus `.html` | Judges who want to see the code | `scripts/build_notebook.py` from `notebooks/appendix.py` | It runs top to bottom with no errors, and its figures match `outputs/` |
| Supporting analysis (case p8) | The deck's appendix slides, the report and the notebook | Judges | The above | R-05, R-06 and R-07 are all Met |

Every deliverable says the data is simulated and isn't Costco's (R-30). None uses Costco's logo or brand colors (`UI_FRAMEWORK.md` limits).

## 2. Decisions this plan rests on

| ID | Decision | Status |
|---|---|---|
| D-24 | Rebuild the web tool as a React front end (Vite, TypeScript) served by a thin FastAPI layer over the existing Python engine in `src/`. This replaces Streamlit for the demo app | Accepted, user, 2026-11-05 |
| D-25 | Install `webapp-testing` and `theme-factory` at project level, and add the deck, notebook and browser tools in `requirements-dev.txt` and `package.json` | Accepted, user, 2026-11-05 |
| D-26 | The deck, report charts and notebook charts share the web app's colors, font and chart styling, all read from one file, `design/tokens.json`. This is a shared palette, not a design system, so D-23 still holds | Accepted, user asked for it, 2026-11-05 |
| D-27 | The current Streamlit app stays working and untouched as the fallback demo until the new app passes its checks at M4 | Proposed |
| D-28 | Freeze the numbers (M6) before writing the deck, report and notebook. Calculated figures in all three come from `outputs/`, extending D-20 to the deck | Proposed |

## 3. Schedule and gates

Today is Thursday, Nov 5. As before, we aim to finish Friday night and keep Saturday morning as buffer (D-14). The exact deadline time is still unknown (Q-11).

| When | Main thread (the app) | In parallel (subagents, once the numbers are frozen) | Gate |
|---|---|---|---|
| Thu, now to evening | WS1 checks (T-73 to T-77), WS2 shared look (T-79), then the API and the app's shell (T-80, T-81) | | |
| Thu, night | Calibration result goes to the user (T-75), then the numbers freeze (T-78). Overview and Schedule pages (T-82, T-83) | | **M6: numbers frozen** |
| Fri, morning | Demand, Cost and service, Scenario lab, Playbook and Methods pages (T-84 to T-88), then browser checks (T-89) | Notebook (T-91), and the report's analysis chapters (T-92, part 1) | |
| Fri, 1 pm | Polish, a fresh-eyes review, then go or no-go on the new app (T-90) | | **M4: app ready to demo** |
| Fri, afternoon | Deck (T-93), with screenshots from whichever app passed M4 | The report's tool chapter and screenshots (T-92, part 2), and Q&A prep (T-94) | **M7: content complete, 5 pm** |
| Fri, evening | Team name (T-62), rehearsal with Wi-Fi off (T-63), backup recording (T-64), two timed run-throughs (T-65), final check (T-66), package (T-95) | | **M5: frozen, Fri night** |
| Sat, morning | Submit. Buffer only, no new work | | |

**Order of dependencies:** WS1 → M6 → WS4 and the report's analysis chapters. WS2 → WS3 → M4 → screenshots → the deck and the report's tool chapter. The deck comes last because it needs the final app's look and screenshots.

**If we fall behind,** cut in this order and never cut what the case requires:

1. The Scenario lab's availability slider (7.4, a stretch goal).
2. The Methods page. Its content already lives in the report and the deck's appendix.
3. Notebook polish. A notebook that runs correctly with fewer words still meets the need.
4. The new app itself. If it isn't ready at M4, demo the Streamlit app, which works today (D-27).

## 4. Skills and tools

All of these are installed and smoke-tested (F-60). Each row says when to load the skill.

| Area | Skill or tool | Use it for |
|---|---|---|
| Web app look | `frontend-design` (plugin, D-22) | Visual direction, layout, typography and wording for the new app |
| Charts everywhere | `dataviz` (built in) | Every chart in the app, deck, report and notebook: chart form, colors (run its palette validator), marks and labels |
| Web app checks | `webapp-testing` (new, `.claude/skills/`) | Playwright scripts that drive the app, take screenshots and capture console errors |
| One theme for the deck and report | `theme-factory` (new, `.claude/skills/`) | Its "create your own theme" path, using the app's tokens. Don't use its presets (`SOURCE.md` explains why) |
| Deck | `pptx` (account skill) + pptxgenjs 4.0.1 + react-icons, react and sharp for icons | A structured deck, native charts, `validate.py`, `slide_text.py` |
| Report | `docx` (account skill) + docx 9.5.1 | Rewriting `scripts/build_analysis_doc.js` |
| Notebook | nbformat, nbclient, nbconvert, ipykernel | Building, running and exporting the notebook |
| Visual checks | PowerPoint and Word through COM, pypdfium2 | Rendering slides and pages to images. LibreOffice isn't installed, so the skills' `soffice` steps are replaced by `planning/evidence/render_deck.py` (new) and `render_word_file.py` |
| App API | FastAPI 0.135.3, uvicorn 0.42.0 (already installed) | The server in D-24. Pin both in `requirements.txt` when the app is built |
| Interactive browser checks | Claude in Chrome | Spot checks by hand alongside the scripted ones |
| Fallback app only | `developing-with-streamlit` | Only if the Streamlit app needs a fix |

---

## 5. WS1: Check the analysis against the case

The case deck in the root (`.pptx`) and the newer PDF list the same elements. The PDF adds the dates, requires all three scenarios, gives the labor cost rule, and has the "What to submit" page. Where they differ, the PDF wins (D-01, F-01). The matrix below covers every element in either one.

### 5.1 Coverage matrix

**Status:** ✅ the analysis covers it and the deliverables show it. ◐ the analysis covers it, but the deliverables don't show it yet. ✗ not covered.

| Case element (source) | How we answer it | Evidence | Shown in | Status |
|---|---|---|---|---|
| Staffing affects checkout, availability, replenishment, pharmacy, membership and safety (p2) | Three departments, each with its own service measure: checkout wait, replenishment response, prescription wait | R-24 | Deck slide 2, report ch. 1 | ◐ say it explicitly |
| Demand driver: day of the week (p3) | Department x weekday term in the forecast | F-41: warehouse and weekday explain 97.7% of variation | Demand page, report ch. 4, notebook §3 | ✅ |
| Demand driver: customer traffic (p3) | We forecast the workload proxy directly. The data pack's `traffic_index` is an output, labeled "never use as model input", so using it would leak the answer | `sql/02_Load_Core_Data.sql`, feature registry row for `traffic_index` | Report ch. 4 "Drivers we tested", notebook §3 | ◐ add |
| Demand driver: holidays (p3) | Holiday windows mapped from MLK to Presidents' Day. Valentine's Day is a +3% judgment, tested for sensitivity | F-45, A-05, A-06, F-52 | Demand page, deck slide 4 | ✅ |
| Demand driver: promotions (p3) | History has a promotion on every Fri-Sun and every holiday-window day, so the weekday and holiday terms carry its effect. The planning week's promotions fall on the same days as MLK's. PEAK's launch comes in through the given multipliers | F-61 (new), F-41, F-10 | Report ch. 4, notebook §3 | ◐ add |
| Demand driver: weather (p3) | Temperature adds nothing once the weekday is known. The winter-storm advisory comes in through PEAK's multipliers | F-41 (correlation -0.006) | Report ch. 4, notebook §3 | ◐ add |
| Demand driver: warehouse size (p3) | Warehouse level in the forecast, and a warehouse level on each service curve | F-41, F-46 | Warehouse selector, report | ✅ |
| Demand driver: department activity (p3) | Department labor standards, service curves and shift shares | DESIGN.md calculation chain | Report ch. 5 | ✅ |
| Employee availability and qualifications (p3) | Availability per scenario, read from the grid. Front End and Merchandising share cross-trained staff, and Pharmacy has none because of licensing | F-08, F-28, A-01 | Block detail panel, report ch. 5 | ✅ |
| Callouts and overtime (p3) | Callout rates by department and situation, 49% backfill limited by overtime room, and the overtime cost rule | F-43, D-18, R-25 | Block detail panel, report ch. 5 | ✅ |
| Too much labor costs money, too little hurts service (p3) | Over- and under-staffing in history, plus the cost of each extra point of service | F-39, F-49 | Deck slide 3, Cost and service page | ✅ |
| Forecast needs, optimize schedules, maintain service (p4) | Forecast, then the search, then the 95% service goal | F-44, D-06, A-13 | Whole tool | ✅ |
| When demand rises or falls (p4, R-16) | Forecast by day and department, with what drives each day | F-45 | Demand page | ✅ |
| How needs vary by department and time period (p4, R-17) | The weekly board by department and shift | outputs/plan_vs_draft.csv | Schedule page | ✅ |
| How schedules or coverage should change (p4, R-18) | The change from the draft in every block, with a list of changes | outputs/explanations.csv | Schedule page, changes list | ✅ |
| Effect on labor cost and service (p4, R-19) | Cost and expected service against the draft in every scenario | F-48 | Overview, Cost and service page | ✅ |
| Actions when conditions change (p4, R-20) | The playbook: triggers, actions, rules for the day, and limiting holiday PTO | F-55, T-42 | Playbook page, deck slide 8 | ✅ |
| The decision: allocate labor across departments and time periods at the lowest practical cost while keeping service (p5) | The search: service goal first, then cost, with Front End and Merchandising solved together | D-06, D-17 | Deck slides 5 and 6 | ✅ |
| All three scenarios for Feb 12-18 (p5, p7, R-08) | Separate plans for BASE, PEAK and DISRUPT | F-48 | Scenario switch, deck slide 7 | ✅ |
| Where, when and how much labor is needed (p5, R-21) | The board, plus hours by day | | Schedule page | ✅ |
| Which assumptions drive it (p5, R-22) | Assumptions for each block, plus the full list with ours marked | A-01 to A-16 | Block detail panel, Methods page, deck appendix | ✅ |
| What to do when conditions shift (p5, R-23) | The playbook | | Playbook page | ✅ |
| A proof of concept, not just a dashboard (p6, R-15) | It recommends, explains and recalculates live | | Scenario lab, demo | ✅ |
| Forecasts demand (p6, R-09) | Log-linear regression, then a shift split | F-44 | Demand page | ✅ |
| Converts demand into staffing (p6, R-10) | Service curve plus the risk model, giving the smallest headcount that reaches the goal | F-46, F-47 | Methods page, report ch. 5 | ✅ |
| Recommends schedules, staffing or coverage (p6, R-11) | Total employees per block. This is what the template asks for, and individual shifts aren't modeled (ASSUMPTIONS.md section 4) | | Schedule page | ◐ explain why it's per block, not per person |
| Balances cost with service (p6, R-12) | The service goal and its trade-off curve | F-49 | Cost and service page | ✅ |
| Responds to changing conditions (p6, R-13) | Scenarios plus live what-ifs | | Scenario lab | ✅ |
| Explains why (p6, R-14) | A reason for every block, built from templates filled with its own numbers | D-08 | Block detail panel | ✅ |
| Simulated data, not Costco's (p7, R-30) | Labeled in every deliverable | | All | ◐ the deck and notebook don't exist yet |
| Identify any added assumptions (p7, R-06) | A-01 to A-16, kept apart from the case's own | ASSUMPTIONS.md | Deck appendix, report ch. 10 | ◐ the deck doesn't exist yet |
| Labor cost: regular, then cross-trained, then overtime (p7, R-25) | One allocation function, checked independently in the notebook | D-10, V-08 | Report ch. 5, notebook §6 | ✅ |
| Use service measures to judge plans (p7, R-24) | Chance of meeting each department's target | F-46 | Everywhere | ✅ |
| Presentation: diagnosis, forecast, recommendation, all three scenarios, demo (p8, R-01, R-02) | Deck slides 3-9 plus the live demo | | Deck | ✗ not built (T-93) |
| The completed template (p8, R-03) | All 567 rows, joined on keys | F-15, T-35 | CSV | ◐ placeholder team name (T-62) |
| A tool that takes a scenario and shows staffing, cost and service risk (p8, R-04) | The web app | | App | ✅ Streamlit today, rebuilt in WS3 |
| Appendix: forecast method, key assumptions, cost and service against the draft (p8, R-05 to R-07) | Appendix slides, the report and the notebook | | Deck appendix, report, notebook | ◐ |
| `.pptx` only: "at least one changed scenario", and labor cost wording without the flex rule (p7) | Superseded by the PDF and README (D-01) | F-01 | | n/a |
| Data pack: judging order is service, then cost, then feasibility (R-27) | Built into the search's ranking | D-06 | Report ch. 5 | ✅ |
| Data pack: the benchmark is "a floor to beat" (R-28) | Beats it on held-out weeks, but only by removing holiday distortion. In the planning week the two match within 0.1% on normal days | F-44 | Demand page accuracy card, report ch. 4 | ◐ use F-44's wording everywhere |

### 5.2 Gaps to close in the deliverables

The analysis itself has no gaps. These are things the deliverables need to *say*:

1. **"Drivers we tested" table** (report ch. 4, notebook §3, Methods page): for each of the case's demand drivers, what we tested, what we found, and how it enters the plan. This covers traffic, promotions and weather, which the case names and the current Word file barely mentions.
2. **The three departments and why they matter** (deck slide 2): checkout wait, replenishment response, prescription wait.
3. **Why we recommend totals per block and not individual shifts** (report ch. 5): the template asks for totals, and the data has no individual employee records.
4. **Cost and service against the draft for every scenario and department** (deck appendix A6, report ch. 6). Today only BASE has a department breakdown on screen.
5. **The benchmark claim, worded as F-44 allows** everywhere it appears.
6. **The simulated-data label** on the title slide, the report cover, the notebook header and the app's header.

### 5.3 Accuracy checks

Each check has a method and a pass condition. A failed check goes to the user before anything that feeds the submission changes.

| ID | Check | Method | Passes when | Task |
|---|---|---|---|---|
| V-01 | Everything reproduces | `python -m pytest`, `python -m src.pipeline`, `python -I planning/evidence/verify_findings.py`. Compare `outputs/` hashes with the committed files | All 77 tests pass, and the outputs are identical | T-74 |
| V-02 | The submission is valid | `validate()`, plus independent checks in the notebook: 567 rows, keys, closed blocks 0, whole numbers, within capacity under the allocation rule, at or above `min_staff` | No problems except the placeholder name | T-74 |
| V-03 | The coverage matrix is complete | 5.1 above. Every ◐ gets a named fix in a deliverable | No ✗ left except deliverables being built | T-73 |
| V-04 | **The risk model's calibration** | Out-of-sample predictions run slightly high near the goal: 80.9% predicted against 68.4% observed in the 70-90% group (38 blocks), and 97.3% against 94.3% in the 95-99% group (53 blocks) (F-46). Test two fixes on the same leave-one-week-out folds: scale each department's scatter by a fitted factor, and let scatter vary with utilization. Compare log loss, Brier score and calibration by group. If one is better, rerun the plan with it and report the change in hours, cost and expected service | A decision is recorded. **If the submitted plan would change, the user decides before the numbers freeze.** Service is judged first, so the default leans toward adopting a better-calibrated model | T-75 |
| V-05 | The forecast's inputs hold up | Promotions are confounded with weekends and holidays (F-61, done). Feb 17 is treated as a normal day (F-41). PEAK demand divided by BASE demand equals the grid's multiplier in every block. Valentine's sensitivity is current (F-52) | All hold | T-76 |
| V-06 | DISRUPT doesn't count the illness twice | A-12 adds January's flu-week callout rates on top of the availability cut. Check whether Warehouse 2's availability also fell in January's flu week. If it didn't, the extra callouts may double-count, so measure what dropping them would change | Kept with evidence, or the change goes to the user | T-76 |
| V-07 | The search really is optimal | For 20 random shifts, an independent brute force over every feasible pair, scored by the stated rule, picks the same pair. Also confirm the D-17 guard and the 0 / capacity / `min_staff` rules | 20 of 20 agree | T-77 |
| V-08 | The cost rule matches the README | The notebook recomputes plan and draft costs from the README text, without `src/allocation.py` | Equal to the cent | T-77 |
| V-09 | Every explanation matches its numbers | Draft, plan, change, utilization and chance in each explanation equal `plan_vs_draft.csv`. Becomes a test | 100% of rows | T-77 |
| V-10 | Every claim has a source | A claims register (section 9.3): every figure in the deck and report traces to a key in `analysis_summary.json` or to a finding | No figures typed by hand | T-92, T-93 |
| V-11 | Expected service holds up without the model | For each planned block, the historical rate of meeting target at similar utilization (within 0.02, same department), compared with the model's chance | Within a few points overall. Report the result either way | T-75 |

### 5.4 Numbers freeze (M6)

After V-01 to V-11, and any change the user approves, rerun the pipeline, commit, and tag the commit `numbers-freeze`. After that, only a bug fix changes a number, and a bug fix means rebuilding every deliverable (each takes seconds to minutes, because none has typed figures).

---

## 6. WS2: One look across the app, deck, report and notebook (T-79)

The user wants the deck, including its charts, to match the app's UI. So the look is defined once and read everywhere. This is a shared palette, not a design system (D-23, D-26).

**One file, `design/tokens.json`, holds:**

- **Color roles:** canvas, surface, raised surface, border, ink, muted ink, subtle ink, accent, light accent, plan, draft, benchmark, good, warning, risk, the three departments, a sequential scale for chance of meeting target, and a diverging scale for change against the draft.
- **Type:** the font family, weights, a size scale, and tabular figures for numbers.
- **Shape:** corner radius, border width, spacing steps.
- **Charts:** gridline and axis colors, label sizes, line widths, marker sizes.

**Who reads it:**

| Consumer | How |
|---|---|
| Web app | Turned into CSS variables at build time (`web/src/styles/tokens.css`) and read by Tailwind's config |
| Report and notebook charts (PNG) | `src/viz_style.py`, a matplotlib style built from the tokens. `src/charts.py` and the notebook both use it |
| Deck | `scripts/deck/theme.js` builds the pptxgenjs theme and chart defaults from the tokens |
| Word file | Heading and table styles in `scripts/build_analysis_doc.js` |

**Starting direction** (WS2 settles the exact values with the `frontend-design` and `dataviz` skills):

- A light, calm product UI on a slate neutral scale: white cards on a very light canvas, with a dark navy app header. Title, demo and closing slides use the same dark navy, and content slides are white.
- One confident accent for the plan and for interactive elements, probably indigo or violet-blue. It must be clearly different from Costco's red and blue.
- The draft is always neutral gray and the benchmark is a dashed gray, so the plan stands out in every chart in every medium.
- Department colors are checked with the `dataviz` skill's palette validator for color blindness. They must not be confused with good, warning or risk.
- **Font: Segoe UI** (Segoe UI Variable in the app). It's on this laptop and in Office, and it works offline with no download. The deck's PDF copy embeds it, which covers a machine without it. Bundling Inter would need extra installs for PowerPoint, which isn't worth it.
- Text readable on a projector: nothing under 14px in the app or 14pt in the deck body, and WCAG AA contrast.

**Chart rules for every medium** (from `dataviz`):

- Bar and column axes start at zero. pptxgenjs cut the smoke test's axis at 350 by default (F-60), so the deck's builder must set it.
- Never two y-axes. Use small multiples instead.
- Label lines directly, and keep the legend small or remove it.
- Color is never the only signal: numbers or markers go with it.
- Plan in the accent, draft in gray, benchmark dashed.

**Done when:** the tokens file exists, the matplotlib style and deck theme read it, and a sample chart from each medium looks like the same product.

---

## 7. WS3: The web app (D-24)

### 7.1 Goals and acceptance

**Goal:** a tool that looks and behaves like a real workforce-planning product a large retailer would use. It should be easy to follow in a 5-minute demo, comprehensive enough to answer judges' questions, and correct to the last number.

**Principles:**

- **Answer first.** Every page opens with one sentence that says what matters, then the figures behind it.
- **No dead controls.** Every button, filter and link works. Nothing is a mock-up.
- **One source of numbers.** The app shows the engine's results, and with default settings it shows exactly the submitted plan (a test enforces this, as it does today).
- **Offline.** No CDN, no web fonts, no request leaves the laptop.
- **Projector-first.** It works at 1366 x 768 and looks best at 1440 to 1920 wide.

### 7.2 Architecture

```text
Browser (React SPA)  --HTTP JSON-->  FastAPI (server/)  -->  src/ engine (unchanged)
      ^                                   |
      +---- static files from web/dist ---+     one process, one port: http://localhost:8501
```

```text
server/                 FastAPI app
  __main__.py           python -m server: precomputes, then serves the API and web/dist on localhost:8501
  api.py                Endpoints (7.3)
  engine.py             Loads curves and inputs once, caches results, wraps src/app_data.run_scenario
web/                    Vite + React + TypeScript (its own package.json, separate from the document builders)
  src/pages/            One file per page (7.4)
  src/components/       Cards, KPI tiles, the board, the block drawer, charts, the scenario switch
  src/lib/api.ts        Typed client
  src/styles/           tokens.css (generated from design/tokens.json), global styles
  dist/                 The built app, committed at the freeze, so the demo laptop doesn't need Node
tests/test_api.py       API tests (pytest + FastAPI TestClient)
planning/evidence/drive_web.py    Browser checks and screenshots (Playwright)
start_app.bat           Double-click start for teammates: starts the server and opens the browser once it's ready
```

**Front-end stack:** React 19 with TypeScript; Tailwind CSS; Radix UI primitives for accessible tabs, dialogs, the side drawer, tooltips, sliders and toggle groups (optionally generated in the shadcn/ui style); lucide-react icons, the same set the deck uses; Recharts for charts; TanStack Query for fetching and caching; React Router with a hash router, so the server needs no fallback routes. The scenario, warehouse, page and selected block live in the URL, so a refresh keeps the view.

**Server:** FastAPI with uvicorn, bound to `localhost` only. At startup it fits the curves and prepares the three scenarios, which takes 10-20 seconds. While it's preparing, `/api/health` reports `ready: false` and the front end shows a short "preparing" screen instead of errors. What-if results are cached by their settings, and a lock stops two identical heavy runs at once.

**Ports:** the new app takes 8501, so the demo URL stays the same. The Streamlit fallback runs with `--server.port 8502`.

### 7.3 API

Every response is JSON, with no NaN or Infinity, and dates as ISO strings. Blocks use the key `scenario|store|dept|date|shift`.

| Endpoint | Returns | Source |
|---|---|---|
| `GET /api/health` | Whether it's ready, and how long it took to prepare | |
| `GET /api/meta` | Scenarios with one-line descriptions, warehouses, departments, shifts, days, defaults, glossary, assumptions (ours and the case's, labeled), and the simulated-data notice | `src/explain.py`, `ASSUMPTIONS.md` |
| `GET /api/plan?scenario=` | Every block for that scenario: plan, draft, change, sources (regular, flex, overtime), cost, utilization, chance plan and draft, need, cushion, availability note, below-goal flag, and the full explanation. Plus totals by day, department and warehouse, plan against draft | `run_scenario` with defaults = the submission |
| `GET /api/compare` | All three scenarios side by side, plan against draft, by department too | pipeline summaries |
| `GET /api/forecast?store=&dept=` | Daily forecast, benchmark, the parts that make it up (weekday level, holiday window, Valentine's adjustment, scenario multipliers), shift shares, and backtest figures | `outputs/forecast_*.csv`, `analysis_summary.json` |
| `GET /api/tradeoff` | Cost and expected service at each service goal, and the callout allowance comparison | `goal_tradeoff.csv`, `buffer_test` |
| `GET /api/playbook` | Triggers and actions by scenario, rules for the day, the PTO table, and the tightest blocks | `src/playbook.py`, `pto_what_if.csv` |
| `GET /api/diagnosis` | Service by utilization band, over- and under-staffing in history, callout rates | `outputs/diagnosis_*.csv` |
| `GET /api/what-if?scenario=&goal=&callouts=&demand=` | The same shape as `/api/plan`, plus changes against the submitted plan | `run_scenario` |
| `GET /api/methods` | Model facts: backtest, service limits, Brier score, calibration, number of tests | `analysis_summary.json` |
| `GET /api/submission.csv` | The filled template, as a download | `outputs/` |

### 7.4 Pages

A dark left sidebar holds the navigation. The top bar holds the product name ("Workforce Planner", see Q-14), a **Simulated data** badge, the scenario switch (BASE, PEAK, DISRUPT, each with a one-line hover description) and the warehouse selector (All, 1 Medium, 2 Large, 4 Large). These carry across pages.

| Page | Its job | What's on it | Case requirements |
|---|---|---|---|
| **Overview** | The answer for this scenario | One-sentence verdict. KPI tiles for labor cost, hours, expected service, blocks below the goal and blocks over capacity, each with the change from the draft. A strip comparing all three scenarios (click one to switch). Hours and expected service by day, plan against draft, with the holiday days marked. Alerts such as "Feb 14 runs out of capacity: see the Playbook". The largest changes from the draft | R-04, R-12, R-19, R-21 |
| **Schedule** | Where, when and how much | The weekly board: rows are department and shift, columns are days. Each cell shows recommended headcount and its change. A toggle colors the board by change from the draft, chance of meeting target, or utilization. Blocks below the goal are marked, and closed blocks are hatched. **Clicking a block opens a side drawer** with the action, why, demand driver, staff sources (regular, flex, overtime), cost effect, service effect (draft against plan), cushion and the assumptions behind it. A **Changes** view lists every change in the draft as a sortable table. Export downloads the submission CSV or the current view | R-11, R-14, R-17, R-18, R-21 |
| **Demand** | When demand rises or falls, and why | Forecast against benchmark by day for each department, with Valentine's Day, the holiday window and PEAK's surge shaded. For a chosen day, a waterfall from a normal weekday, through the holiday window and Valentine's adjustment, to the scenario multiplier. Shift split, including Front End's holiday shift toward midday. An accuracy card worded as F-44 allows. The "drivers we tested" table | R-09, R-16, R-29 |
| **Cost and service** | Labor cost and service risk against the draft | Scenario and department table: cost, hours, expected service, blocks below the goal, overtime and flex hours. Cost and service by day. The service-goal trade-off curve with 95% marked. The callout allowance comparison. Blocks below the goal, each with its reason (capacity) | R-04, R-07, R-12, R-19 |
| **Scenario lab** | Respond to changing conditions live | Settings for service goal, callouts (0-200% of history) and demand (-10% to +15%), plus a stretch goal: staff availability (-30% to 0%). Run, then show the KPI changes against the submitted plan, a mini board highlighting changed blocks, and a list of changes. Clearly labeled as a what-if, not the submitted plan. Reset | R-13, R-15, R-20 |
| **Playbook** | What to do when conditions shift | For each scenario: when to use it and what to do. The headline recommendation, limiting holiday PTO, as a chart of blocks below the goal, expected service and cost against PTO kept per block. Rules for the day. The blocks with the least cushion | R-20, R-23 |
| **Methods** | How it works and what it assumes | A diagram of the engine: data, forecast, service curve and risk, allocation and cost, search, explanations. Our assumptions listed apart from the case's. Validation figures. The data notice. Where to find the report and notebook | R-05, R-06, R-22, R-30 |

The other pages always show the submitted plan. Only the Scenario lab shows what-if results, so no one mistakes a what-if for the plan.

### 7.5 Behavior

| Situation | What happens |
|---|---|
| Opening the app before the server is ready | A short "preparing the three scenarios" screen, which moves on by itself |
| Switching scenario or warehouse | Under half a second, because results are prepared at startup. The page, filters and selected block stay put |
| Running a what-if | A progress state, results in about 3-8 seconds, a clear "what-if" label, and Reset |
| Clicking a board cell | The drawer opens on that block, and the URL updates so it can be reopened |
| A block below the goal | A marker on the board, a red badge in the drawer, and a row in the below-goal table |
| Data not extracted, or the server not running | A clear message with the commands that fix it |
| Any error | A message in the page, never a blank screen |

### 7.6 Visual direction

Use the `frontend-design` skill. The intended feel is a modern operations SaaS product: calm and dense with information, but never cluttered.

- A clear page title, then the answer sentence, then KPI tiles, then detail.
- Cards with a light border and soft radius, generous spacing, and a single accent color used sparingly.
- Numbers in tabular figures, with deltas as small colored chips that also carry a sign.
- The board is the visual centerpiece, a crisp grid with a legend and a strong selection state.
- Charts follow section 6's rules and use the tokens.
- Hover tooltips on every chart and tile, and short help text on terms ("What's a block?").

### 7.7 Build order

Build in vertical slices, so there's a usable app at every step:

1. **T-80 API:** `server/` with every endpoint, plus `tests/test_api.py`. Defaults must equal the submission CSV.
2. **T-81 Shell:** Vite, React and TypeScript set up, tokens, layout, navigation, top bar, data client, the "preparing" screen, error handling. Built files served by FastAPI.
3. **T-82 Overview**, then **T-83 Schedule** with the drawer. This is the core of the demo, so it's checked in a browser before going on.
4. **T-84 Demand**, **T-85 Cost and service**, **T-86 Scenario lab**, **T-87 Playbook**, **T-88 Methods**.
5. **T-89 Browser checks**, then **T-90 polish** and the M4 decision.

### 7.8 Testing and acceptance

| Layer | What's checked | Tool |
|---|---|---|
| API (`tests/test_api.py`) | Default plan equals the submission CSV on all 567 rows. Costs equal `plan_vs_draft.csv`. A demand what-if changes at least one block. Bad settings return 422. No NaN in any response. The simulated-data notice is present | pytest, FastAPI TestClient |
| Browser (`planning/evidence/drive_web.py`) | Cold start time. Every page renders with no console errors. A scenario switch changes the KPIs. Clicking a cell opens a drawer whose numbers match the API. A what-if finishes in under 8 seconds and Reset restores the plan. The exported CSV passes `validate()`. **No request leaves localhost.** Screenshots at 1366 x 768, 1440 x 900 and 1920 x 1080 | Playwright, `webapp-testing` skill |
| Visual review | Every screenshot is looked at, then reviewed by a fresh-eyes subagent that hasn't seen the code. Fix what they find | Read tool, subagent |
| Existing tests | All 77 still pass, including the Streamlit fallback's | pytest |

**Performance budgets:** server ready in under 30 seconds, page changes under 300 ms, scenario switches under 500 ms, a what-if under 8 seconds.

**M4 passes when** every row above passes, and a teammate can follow the 5-minute demo script without help.

### 7.9 Fallback and cutover

- `app.py` (Streamlit) and its tests stay as they are until M4 (D-27).
- **If the new app passes at M4:** it becomes the demo. Update `README.md`, `CLAUDE.md`, `DESIGN.md` and `UI_FRAMEWORK.md`, and keep the Streamlit app documented as the fallback on port 8502.
- **If it doesn't:** demo the Streamlit app, take the deck's screenshots from it, and finish the new app only if time is left over.

### 7.10 The 5-minute demo script

One presenter drives and talks. It's timed, rehearsed, and backed by a recording (T-64).

| Time | Do | Say (the point) |
|---|---|---|
| 0:00 | Overview, BASE, all warehouses | "This is the answer: 14% more hours, placed where history says they're missing, take expected service from 70% to 96%." |
| 0:40 | Schedule, Warehouse 1. Point at the holiday weekend | "Days across, shifts down. Blue is where we add people. The draft ignored the holiday." |
| 1:10 | Click Sat Feb 14, Front End, Midday | "Every block explains itself with its own numbers: demand driver, staff sources, cost, risk, cushion." |
| 1:50 | Switch to PEAK, then DISRUPT at Warehouse 2 | "The plan changes with the conditions. Here illness takes out Front End, and the plan responds." |
| 2:40 | Demand page | "We forecast the holiday effects ourselves. The benchmark misses them." |
| 3:10 | Scenario lab: demand +10%, callouts 150%, Run | "This isn't three saved answers. It recalculates the plan live." |
| 4:00 | Playbook: holiday PTO | "The single best action: keep 2 people per block from holiday PTO. Service rises and cost falls." |
| 4:40 | Schedule, Export | "And this is the file we submitted, straight from the tool." |

---

## 8. WS4: Jupyter appendix (T-91)

**Purpose:** the code appendix for the analysis. A judge can read it top to bottom and see each step's code, its output and its conclusion. It also checks itself against the submitted results.

**Files:** written as a plain Python script with `# %%` cells (`notebooks/appendix.py`), so it's easy to edit and compare. `scripts/build_notebook.py` turns it into `deliverables/Costco_Analysis_Appendix.ipynb`, runs it with nbclient, saves the outputs, and exports `.html`.

**Conventions:** every section opens with "What this shows" and ends with a "Takeaway". The key functions from `src/` are shown with `inspect.getsource`, so the appendix contains the real code that produced the plan, not a copy. Charts use `src/viz_style.py`, so they match the app. It recomputes everything by default, which takes about 3-5 minutes.

| § | Section | Shows | Backs up |
|---|---|---|---|
| 0 | Title and setup | Simulated-data notice, how to run it, versions, contents | R-30 |
| 1 | The data | Loading the views, row counts and key checks, the grain, closed blocks | F-02, F-05 to F-07, F-14 |
| 2 | Diagnosis | The service cliff, worked against scheduled, over- and under-staffing in history, callouts, the draft under stress | F-03, F-04, F-39, F-43, F-09, F-42 |
| 3 | Forecast | Building the daily table, holiday mapping, **drivers we tested** (temperature, promotions, traffic), the regression, holiday factors against the build script, backtest against the benchmark, analog and shift-split tests, the planning-week forecast, Valentine's sensitivity | F-41, F-44, F-45, F-61, F-52 |
| 4 | Service curves | Curve fits with the data behind them, service limits, Brier score and calibration (with V-04's result) | F-46, V-04 |
| 5 | Risk model | Callouts, backfill, the exact calculation against Monte Carlo | F-47, D-18 |
| 6 | Allocation and cost | The rule, a worked example, and an independent recomputation of the draft's and plan's costs | V-08, R-25 |
| 7 | Staffing search | The code, one shift's search as a heatmap of score and cost, the plans for all three scenarios, plan against draft, capacity gaps, independent check of optimality | F-48, F-50, V-07 |
| 8 | Trade-offs | Service goal, callout allowance, holiday PTO | F-49, F-51, F-55 |
| 9 | Scenarios | BASE, PEAK and DISRUPT compared by day and department | R-08 |
| 10 | Submission | Filling the template on keys, validation | R-03 |
| 11 | Reproducibility | The notebook's results against `outputs/analysis_summary.json`, as assertions | V-01 |

**Done when:** it runs top to bottom with no errors or warnings in the outputs, the reproducibility cell passes, and the HTML export reads well. nbconvert's HTML refers to a CDN only for math and widgets, which the notebook doesn't use, so it reads fine offline (F-60).

---

## 9. WS5: The written report (T-92)

**Audience:** someone with no context, such as a judge reading afterward, a teammate, or a Costco manager. It must stand alone: what the problem is, what we did, why, what we found, what to do, and how to use the tool.

**Approach:** rewrite `scripts/build_analysis_doc.js` (docx-js, D-20) so it builds a polished report into the same file. Calculated figures come from `outputs/analysis_summary.json`. Charts are PNGs from `src/charts.py` in the shared style, at 200 dpi, and the tool chapter uses screenshots from `drive_web.py`. It's US Letter with a cover, contents, page numbers, figure captions and a glossary. Fonts and colors come from the tokens.

**Before the first rebuild:** Word currently has the file open (seen 2026-11-05). Close it, copy the current file to `deliverables/archive/Costco_Case_Analysis_2026-11-04.docx`, and confirm with the team that nobody has edited it by hand (Q-13), because a rebuild replaces it.

### 9.1 Outline

| Ch. | Title | Contents |
|---|---|---|
| | Cover | Title, team, date, simulated-data notice |
| 0 | Executive summary (1 page) | The question, the answer, results in each scenario, the three recommendations, what the tool does |
| 1 | The case | Costco's model, why staffing matters for each department, the planning week and its holidays, the three scenarios, what's judged and how |
| 2 | The data | Sources and grain, history against planning, quality checks, what we found that the docs don't say (DISRUPT's extra cuts, the draft over capacity) |
| 3 | What history shows | The service cliff, the right total hours in the wrong places, callouts, the draft schedule's weak points |
| 4 | Forecasting demand | The approach in plain words, the model, holiday effects, Valentine's Day as a judgment, the **drivers we tested**, the shift split, accuracy and its limits, the planning-week forecast |
| 5 | From demand to staff | The service curve, risk from callouts and forecast error, the allocation and cost rule with a worked example, the search with a worked example, why per block, choosing the 95% goal |
| 6 | Results | Each scenario against the draft, by department and day, where capacity runs out (Feb 14), the blocks below the goal and why |
| 7 | What a warehouse leader should do | Limit holiday PTO, when to use each scenario's plan, rules for the day |
| 8 | The Workforce Planner tool | What it's for, how it's built, how to start it, a guided tour of every page with screenshots, how to read the board, how a recommendation explains itself, running a what-if, exporting the plan |
| 9 | How we checked it | Tests, the independent recomputation, backtests, calibration, sensitivity, and what hasn't been checked |
| 10 | Assumptions and limits | Our assumptions apart from the case's, limits, and how Costco could run this for real (weekly data feed, rerun, review, publish) |
| A | Appendices | Output files and fields, the submission format and its validation, how to reproduce everything, glossary |

### 9.2 Figures

Planning week timeline with holidays and scenario changes · service cliff · over and under hours in history · callout rates · forecast against benchmark, by day · backtest error · holiday factors · service curves · one block's risk, broken down · allocation worked example (diagram) · plan against draft by scenario · BASE hours by day, with Feb 14's capacity · service goal trade-off · holiday PTO what-if · calibration · the app's architecture (diagram) · one screenshot per app page.

### 9.3 Claims register

The builders keep a table of every figure they print and its source key, and the report gets a hidden check that it's complete. This is V-10. Words like "about" or "roughly" are allowed, but the figure itself comes from the data.

### 9.4 Checks

Render through Word to PDF, then to page images (`render_word_file.py`), and look at every page: layout, figures, tables, no overflow or orphaned headings. Re-read for plain language: could someone new follow it? Export `deliverables/Costco_Case_Analysis.pdf`.

---

## 10. WS6: The presentation (T-93)

### 10.1 Timing

The slot is 15 minutes at most: **6-7 minutes of slides, a 5-minute live demo, then 3-4 minutes of questions.** That allows about 9 main slides at 40-60 seconds each. The appendix slides are for questions and meet the case's "supporting analysis" requirement (R-05 to R-07).

### 10.2 Main slides

Each title states the slide's message as a sentence. The figures shown below are today's values, and the final ones come from `outputs/` after M6.

| # | Time | Message (title) | Visual | Source |
|---|---|---|---|---|
| 1 | 0:15 | Title: the Workforce Planner, team name, simulated-data note | Dark slide, product wordmark, a hint of the board | |
| 2 | 0:40 | Costco needs one week of staffing that holds service through Valentine's Day and Presidents' Day | A week timeline marking the holidays, three scenario chips, and the three departments with their service targets | Case p5, p7 |
| 3 | 1:00 | History has about the right hours in the wrong places, and service collapses past 85% utilization | Service cliff chart (native), plus callouts: $103K of hours above need, 2,472 hours short elsewhere | F-03, F-39 |
| 4 | 0:50 | Demand peaks on the holiday weekend, and the naive benchmark misses it | Forecast against benchmark by day (native line), holidays shaded. Callouts: holiday effects, 2.4% against 4.1% error worded as F-44 allows | F-44, F-45 |
| 5 | 0:45 | Our engine turns a forecast into a staffing plan that explains itself | Five-step flow: forecast → service curve and risk → cost rule → search → explanations, each with one line on what it uses | DESIGN.md |
| 6 | 1:00 | 14% more hours, in the right places, lift expected service from 70% to 96% | KPI tiles styled like the app, and plan against draft by day (native columns) | F-48 |
| 7 | 0:45 | The plan adapts to each scenario | Three columns, BASE, PEAK and DISRUPT: what changes, cost, service, blocks over capacity (12 in the draft, 0 in the plan for DISRUPT) | F-48, F-42 |
| 8 | 0:45 | The best single action: limit holiday PTO | PTO what-if chart (native; small multiples, never two axes) plus the actions before the week and on the day | F-55 |
| 9 | 0:10 | The Workforce Planner: what you're about to see | Annotated screenshot of the app: scenario switch, board, why drawer, Scenario lab | Screenshots |
| — | 5:00 | **Live demo** (7.10) | | |
| 10 | 0:20 | Close: three numbers, and what we hand over | Dark slide: service gain, cost change, zero blocks over capacity. The CSV, the tool, the report and the notebook | |

### 10.3 Appendix slides

A1 Forecast method · A2 Forecast accuracy and its limits · A3 Service curve and risk model · A4 Allocation and cost rule · A5 Key assumptions, with ours marked · A6 **Cost and service against the draft for every scenario and department** · A7 Where capacity runs out (Feb 14) · A8 Service goal trade-off and callout allowance · A9 Validation and checks · A10 Data notes (DISRUPT's extra cuts, simulated data) · A11 The submission file.

### 10.4 Design and build

- **It matches the app:** the same tokens, font, KPI tile style, chart styling and Lucide icons (rendered through react-icons and sharp). Title, demo and closing slides use the app's dark navy, and content slides are white.
- **It follows the `pptx` skill's rules:** a structured deck with a theme, layouts, sections and placeholders. Charts are native and editable. No accent bars or lines under titles. At least 0.5" margins. Body text at least 14pt.
- **Screenshots** come from `drive_web.py` at 1920 x 1080, framed as rounded cards with a soft shadow.
- **Speaker notes** on every slide, holding the talking points and the target time.
- **No typed figures:** `scripts/deck/build_deck.js` reads `outputs/analysis_summary.json` (D-28).
- A PDF copy goes alongside, which keeps fonts on any machine and serves as a backup if PowerPoint fails.

### 10.5 Checks

1. `validate.py` passes.
2. `slide_text.py` read-through: content, order, typos, no placeholder text.
3. Render every slide through PowerPoint (`planning/evidence/render_deck.py`) and look at each one: overflow, overlap, alignment, contrast, consistent titles and chart labels. Then a fresh-eyes subagent review. Fix, re-render, repeat.
4. Two timed run-throughs: slides take 6-7 minutes, and the whole thing ends within 15.

### 10.6 Q&A prep (T-94)

A one-page sheet in `deliverables/`, with an answer for each likely question:

| Likely question | Short answer (source) |
|---|---|
| Why aim for 95%? | Service is judged first, and each point above it costs more and more (F-49, A-13) |
| Isn't +14% cost a lot? | Moving hours alone, at about the draft's cost, already beats the draft. The rest buys the callout allowance (F-51) |
| What if judges don't apply callouts? | Then the allowance costs $22,755 and gains nothing in their score. We chose to plan for real conditions (A-03, Q-02) |
| How accurate is the forecast? | 2.4% error against 4.1% on held-out weeks. That edge comes from avoiding holiday distortion (F-44) |
| Why +3% for Valentine's Day? | There's no history for it. Service barely changes between 0% and 10%, because capacity binds (F-52) |
| Why did you cut some blocks? | History shows those blocks overstaffed. The panel gives each one's reason (F-39) |
| Why are some blocks still below the goal? | Capacity runs out: every regular and overtime person is already used (F-50) |
| How would Costco run this for real? | A weekly data feed, rerun each week, leaders review the board, then publish. The API design already allows this (report ch. 10) |
| How do you know the code is right? | 77+ tests, independent recomputation, calibration checks (report ch. 9) |
| Why React and FastAPI? | The analysis stays in tested Python, and the interface is a real web front end, which is how it would be deployed (D-24) |

---

## 11. WS7: Finish and submit

| Task | What | Done when |
|---|---|---|
| T-62 | Real team name in `TEAM_ID`, rerun the pipeline, final validator (Q-07) | `validate(final=True)` passes |
| T-63 | Rehearse the demo with Wi-Fi off, on the presenting laptop | It works offline, and the result is recorded |
| T-64 | Backup demo recording: a narrated screen recording, plus a scripted Playwright video as a silent fallback | Both saved and watched through |
| T-65 | Two timed full run-throughs | Slides 6-7 minutes, the whole thing within 15 |
| T-66 | Final check against `REQUIREMENTS.md`, including the user's R-31 to R-38 | Every requirement is Met |
| T-95 | Package the hand-in: deck (`.pptx`, `.pdf`), CSV, report (`.docx`, `.pdf`), notebook (`.ipynb`, `.html`), and the tool's source as a zip with run steps. Tag the commit `submission` | The folder is complete and the tag exists |

---

## 12. Risks

| Risk | Effect | What we do |
|---|---|---|
| The new app overruns | No polished demo | The M4 gate. The Streamlit app works today (D-27) |
| A model change after the freeze | Every deliverable is out of date | The freeze at M6. After it, bug fixes only, and every build is scripted |
| The Word file is open, or hand-edited | A rebuild fails or wipes edits | Close Word, archive a copy, ask the team (Q-13) |
| The presenting machine lacks Segoe UI | The deck renders with another font | Present from this laptop. A PDF copy embeds the fonts |
| The projector's resolution | Cramped layout | Test at 1366 x 768. Layout and type sizes are projector-first |
| No internet at the venue | A broken demo | No CDN or web fonts, the browser check catches outside requests, and a rehearsal with Wi-Fi off |
| A slow first load | Waiting in front of judges | The server prepares everything at startup. Start it before presenting, and `start_app.bat` opens the browser only once it's ready |
| Port 8501 already in use, such as an old Streamlit | The server won't start | `start_app.bat` checks the port first and says what to close |
| Time | Unfinished work | Subagents for the notebook and the report's analysis chapters after M6. The cut order in section 3 |
| The npm advisory in pptxgenjs's image parser | None in practice: it reads only our own PNGs | Recorded in F-60, no forced upgrade |

## 13. Open questions

| ID | Question | Needed by | Default if no answer |
|---|---|---|---|
| Q-07 | Team name | Before T-62 (Fri evening) | None. It's required |
| Q-11 | Exact submission time and presentation slot | Before scheduling Friday night | Finish Friday night |
| Q-13 | Has anyone edited the Word file by hand since Nov 4? | Before the first report rebuild (T-92) | Archive a copy, then rebuild |
| Q-14 | Product name for the tool | Before T-81 | "Workforce Planner" |
| Q-04 | How is the tool handed in? | T-95 | Zip the source with run steps |
| — | Who presents which part, and who drives the demo? | T-65 | The team decides at the first rehearsal |

## 14. Tasks

These are in `PLAN.md` under Phase 7. T-60, T-61 and T-67 remain as umbrellas: T-93 delivers T-60, T-91 with the deck's appendix delivers T-61, and T-92 replaces T-67.

| ID | Task | Workstream | Needs |
|---|---|---|---|
| T-71 | Install and smoke-test the skills and tools | Setup | Done (F-60) |
| T-72 | Write this plan | Setup | Done |
| T-73 | Complete the coverage matrix and close the gaps (V-03) | WS1 | |
| T-74 | Reproduce everything and check the submission (V-01, V-02) | WS1 | |
| T-75 | Calibration study and the model-free check (V-04, V-11), with the decision going to the user | WS1 | T-74 |
| T-76 | Forecast and scenario input checks (V-05, V-06) | WS1 | T-74 |
| T-77 | Independent search and cost checks, and the explanation test (V-07 to V-09) | WS1 | T-74 |
| T-78 | Numbers freeze (M6) | WS1 | T-73 to T-77 |
| T-79 | Shared look: tokens, matplotlib style, deck theme | WS2 | |
| T-80 | API layer and API tests | WS3 | |
| T-81 | Web app shell | WS3 | T-79, T-80 |
| T-82 | Overview page | WS3 | T-81 |
| T-83 | Schedule page with block drawer, changes list and export | WS3 | T-81 |
| T-84 | Demand page | WS3 | T-81 |
| T-85 | Cost and service page | WS3 | T-81 |
| T-86 | Scenario lab | WS3 | T-81 |
| T-87 | Playbook page | WS3 | T-81 |
| T-88 | Methods page | WS3 | T-81 |
| T-89 | Browser checks, screenshots, offline and performance checks | WS3 | T-82 to T-88 |
| T-90 | Polish, fresh-eyes review, M4 decision, docs cutover | WS3 | T-89 |
| T-91 | Jupyter appendix | WS4 | T-78, T-79 |
| T-92 | Written report | WS5 | T-78, T-79, then T-89 for screenshots |
| T-93 | Presentation, main and appendix | WS6 | T-78, T-90 |
| T-94 | Q&A prep sheet | WS6 | T-78 |
| T-95 | Package the hand-in | WS7 | T-62, T-66 |
