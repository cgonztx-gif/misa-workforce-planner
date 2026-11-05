# Plan

## Current focus

**Deadline: Saturday, Nov 7, 2026 at 7:00 AM (Q-11).** The presentation slot isn't known yet. Everything must be finished Friday night (D-14), because Saturday morning is too early to use. As of Thursday, that leaves Thursday and Friday.

**Now: the final push, planned in full in `DELIVERABLES_PLAN.md`. The user said go on Thursday, Nov 5, so implementation has started, with subagents running independent tasks in parallel.** T-73 is done. The WS1 checks (T-74 to T-77), the shared look (T-79), the API (T-80) and the app shell (T-81) are running. M2 and M3 were met on Wednesday: the analysis, plan, explanations, playbook and the Streamlit app all work (F-39 to F-59).

Work in this order (`DELIVERABLES_PLAN.md` section 3):

1. **T-73 to T-78:** check the analysis against the case, take the calibration result to the user, then freeze the numbers (M6, Thursday night).
2. **T-79 to T-90:** the shared look, then the new React app with its FastAPI layer (D-24). Go or no-go at M4, Friday 1 pm, with the Streamlit app as the fallback (D-27).
3. **T-91, T-92:** the notebook appendix and the rewritten report, in parallel once the numbers are frozen.
4. **T-93, T-94:** the deck and Q&A prep, once the app's look is final (M7, Friday 5 pm).
5. **T-62 to T-66, T-95:** team name, rehearsals, backup recording, final check and packaging (M5, Friday night).
6. **Settled:** the service goal is 95% (A-13), the plan allows for callouts (A-03), and the slot is 6-7 minutes of slides, a 5-minute live demo and 3-4 minutes of questions (Q-12).

Held for now:

- **Organizer questions (T-05):** deferred at the user's request, and nothing has been sent. **Thursday was the date to come back to them**, because the team still needs the exact deadline and how to hand in (Q-04, Q-11).
- **Team name (Q-07):** `team_id` stays the placeholder `TEAM_NAME` until the real name is known. T-62 must replace it before submitting.
- **Word file (Q-13): answered.** Nobody edited it by hand, and a copy is archived, so T-92 can rebuild it.

## Schedule

The team is 4 people with one main coder, so coding work mostly runs in sequence. Tasks stay general and aren't assigned per person (D-15). The second column lists work that doesn't depend on the build finishing first.

| When | Build | Can run alongside | Check at the end |
|---|---|---|---|
| Tue Nov 3, evening | T-04, T-06, T-07, T-09, T-10 (done) | T-08 (done Wed Nov 4), T-05 (deferred) | M1 |
| Wed Nov 4 | T-11, T-12, T-13, T-20 to T-24, T-30 to T-35, T-40 (done, ahead of schedule) | Deck outline for T-60, using `deliverables/Costco_Case_Analysis.docx` | M2: met |
| Thu Nov 5 | T-41, T-42, T-50 to T-56 (done Wed Nov 4, ahead of schedule). T-71 and T-72 (done). On the user's go: T-73 to T-83 | Come back to T-05 | M3: met. M6 by night |
| Fri Nov 6 | T-84 to T-90, then T-93, then T-62 to T-66 and T-95 | T-91, T-92 and T-94, by subagents after M6 | M4 at 1 pm, M7 at 5 pm, M5 by night |
| Sat Nov 7, morning | Submit. No new work, only buffer | | |

### If we fall behind

For the final push, `DELIVERABLES_PLAN.md` section 3 has its own cut order, which ends with falling back to the Streamlit app.

Everything in the original cut order (T-25, T-40, T-52 and T-54) is either dropped or already built, so nothing needs cutting there (D-14). If time runs short now:

1. **T-61:** use sections of the Word file as the appendix, rather than building separate slides.
2. **T-64:** keep the backup recording short, covering one scenario switch and the Why tab.

Never cut these, because the case requires them: a valid CSV for all three scenarios (T-35, T-62), staffing, cost and service risk in the app (T-50, T-51), explanations (T-41), the deck and appendix (T-60, T-61), and a way to show the demo (T-63 or T-64).

## Milestones

| ID | Milestone | Done when | Target date |
|---|---|---|---|
| M1 | Setup complete | T-04 and T-06 to T-10 are done, with T-05 deferred | Tue Nov 3 (finished Wed Nov 4 with T-08) |
| M2 | Diagnosis and forecast locked | Phases 1 and 2 are done, and a first valid submission CSV exists | Wed Nov 4, night (met) |
| M3 | Staffing plans generated | Phases 3 and 4 are done, covering all three scenarios | Thu Nov 5, night (met Wed Nov 4) |
| M4 | App ready to demo | Phase 5 is done, which the Streamlit app met. For the new app: it passes section 7.8 of `DELIVERABLES_PLAN.md`, or the Streamlit fallback is chosen (D-27) | Fri Nov 6, 1 pm |
| M5 | Submission ready and frozen | Phases 6 and 7 are done | Fri Nov 6, night |
| M6 | Numbers frozen | T-73 to T-78 are done, and the commit is tagged `numbers-freeze` (D-28) | Thu Nov 5, night |
| M7 | Content complete | Drafts of the deck, report, notebook and Q&A sheet exist (T-91 to T-94) | Fri Nov 6, 5 pm |

## Tasks

### Phase 0: Setup

| ID | Task | Needs | Done when | Status |
|---|---|---|---|---|
| T-01 | Analyze the case files and check the docs against the data | | Findings recorded with evidence | Done |
| T-02 | Test a locally hosted Streamlit app on this machine | | Result recorded (F-22) | Done |
| T-03 | Create this planning system and shorten `CLAUDE.md` | | Files exist and all IDs resolve | Done |
| T-04 | Confirm the stack (D-03 to D-09) | Q-06, Q-09 | Each decision is Accepted or replaced | Done |
| T-05 | Send the organizers Q-02 to Q-05 and Q-11 (draft in `QUESTIONS.md`). Deferred 2026-11-04 at the user's request. Come back to it by Thursday | | Sent, with answers recorded as they arrive | Deferred |
| T-06 | Set milestone dates | Q-01 | The milestones table has dates | Done |
| T-07 | Extract the data pack to `data/` | | `data/team_distribution/README.md` exists | Done |
| T-08 | Decide on version control | Q-08 | Repository created, or decision recorded | Done |
| T-09 | Install and pin packages (`statsmodels`, `pytest`) | T-04 | `requirements.txt` exists and all imports work | Done |
| T-10 | Scaffold the project (see `DESIGN.md`) | T-04, T-07, T-09 | A placeholder app starts and `pytest` runs | Done |

### Phase 1: Diagnosis

| ID | Task | Needs | Done when | Status |
|---|---|---|---|---|
| T-11 | Map historical over- and under-staffing by warehouse, department, shift and day type | T-10 | Ranked table saved, main patterns in `FINDINGS.md` | Done |
| T-12 | Put a dollar and service figure on those gaps | T-11 | Excess cost and missed-target blocks in `FINDINGS.md` | Done |
| T-13 | Measure callout rates by department, weekend and post-holiday, separating the Warehouse 2 flu cluster | T-10 | Rates in `FINDINGS.md`, ready for T-33 and T-40 | Done |

### Phase 2: Forecast

| ID | Task | Needs | Done when | Status |
|---|---|---|---|---|
| T-20 | Build the daily training table: features shared by both periods (F-12), mapped holiday labels (F-13), closed days excluded (F-14) | T-10 | Table built and the mapping documented | Done |
| T-21 | Fit the log-demand regression and backtest it against the benchmark on held-out weeks (D-05) | T-20 | Both error figures in `FINDINGS.md`, final model chosen | Done |
| T-22 | Set holiday effects: Presidents' Day from the MLK window, Valentine's Day as a tested adjustment (A-05, A-06) | T-21 | Values and reasoning recorded, sensitivity run | Done |
| T-23 | Split daily forecasts into shifts, including the Front End midday shift on holiday windows (F-31) | T-21 | Shifts sum to daily, split error recorded | Done |
| T-24 | Measure forecast error by department and warehouse | T-21, T-23 | Error figures ready for T-40 | Done |
| T-25 | Optional: test whether the SQL-only daily features improve the forecast (D-04). Dropped 2026-11-03 for lack of time. Reopen only if T-21 fails to beat the benchmark | T-21 | Result recorded, D-04 confirmed or changed | Dropped |

### Phase 3: Staffing engine

| ID | Task | Needs | Done when | Status |
|---|---|---|---|---|
| T-30 | Build the allocation and cost function with tests (D-10, A-01, A-02) | T-10 | Tests cover regular, flex, overtime, flex sharing, capacity and `min_staff` | Done |
| T-31 | Fit service curves per department, check warehouse differences, choose utilization limits (D-07, A-04) | T-10 | Curves and limits recorded | Done |
| T-32 | Build the per-shift search and generate plans for all three scenarios (D-06) | T-23, T-30, T-31 | All 567 blocks have a feasible value, or are flagged | Done |
| T-33 | Set the objective and callout buffer, with service ahead of cost (A-03). Use the answer to Q-02 if it arrives, but don't wait for it | T-13, T-31 | Rule recorded in `DESIGN.md` and used by the search | Done |
| T-34 | Compare each plan with the draft: hours, cost, predicted service, over-capacity blocks (F-09) | T-32, T-33 | Comparison table ready for the deck | Done |
| T-35 | Export and validate the submission CSV, with the placeholder `TEAM_NAME` in `team_id` until T-62 | T-32 | Validator passes: 567 rows, keys match, closed blocks are 0, within capacity, at or above `min_staff` | Done |

### Phase 4: Risk and explanations

| ID | Task | Needs | Done when | Status |
|---|---|---|---|---|
| T-40 | Build the service-risk estimate (D-07, D-18) | T-13, T-24, T-31 | Each block has a chance of missing target | Done |
| T-41 | Generate explanations: change from draft, demand driver, cost and risk effect (D-08) | T-34, T-40 | Every changed block has a reason | Done |
| T-42 | Write the leader playbook: what to do when demand or staffing shifts | T-34 | Each scenario has clear triggers and actions | Done |

### Phase 5: App

| ID | Task | Needs | Done when | Status |
|---|---|---|---|---|
| T-50 | Scenario selector and staffing view by warehouse, department, day and shift | T-32 | Switching scenario updates the view | Done |
| T-51 | Cost and service-risk view compared with the draft | T-34, T-40 | Both are shown for the selected scenario | Done |
| T-52 | Demand view: when demand rises or falls, and why | T-23 | Peaks and their drivers are visible | Done |
| T-53 | "Why this recommendation" panel, including the assumptions behind it | T-41 | Available for any changed block | Done |
| T-54 | What-if control that recalculates live, such as callout rate, plus the playbook | T-42, T-50 | Moving it changes the recommendation | Done |
| T-55 | Cache the three scenarios at startup and time the app (D-11) | T-50 to T-54 | Timings in `FINDINGS.md` and fast enough to demo | Done |
| T-68 | Install skills for the app's UI, design and behavior (D-22) | | Reviewed, installed, and visible to a new session | Done |
| T-69 | Write the UI guide (`UI_FRAMEWORK.md`, D-23) | T-68 | Covers the goal, limits, look, screens, behavior and demo path | Done |
| T-70 | Restyle the app so it looks good (D-23) | T-50 to T-54 | Screenshots look right, and the browser check passes (F-59) | Done |
| T-56 | Package it: `requirements.txt`, start command, `.streamlit/config.toml` (Q-04) | T-55 | Runs from a clean environment using written steps | Done |

### Phase 6: Deliverables

| ID | Task | Needs | Done when | Status |
|---|---|---|---|---|
| T-60 | Build the deck: 6-7 minutes of slides and a 5-minute demo in a 15-minute slot (Q-12). T-93 delivers it | T-34, T-42, T-93 | Covers diagnosis, forecast, recommendation and all three scenarios | Not started |
| T-61 | Build the appendix: forecast method, assumptions, cost and service against the draft. The deck's appendix slides (T-93), the report (T-92) and the notebook (T-91) deliver it | T-34 | All three are covered | In progress |
| T-62 | Finalize the submission CSV with the real team name (Q-07) | T-35 | Validator passes on the final file, and `team_id` no longer holds `TEAM_NAME` | Not started |
| T-63 | Rehearse the demo in a real browser with Wi-Fi off (closes the gap in F-22) | T-56 | Works offline, result recorded | Not started |
| T-64 | Record a backup demo (Q-05) | T-63 | Video saved and watched through | Not started |
| T-65 | Run two timed full rehearsals | T-60, T-63 | Slides take 6-7 minutes and the whole thing, with the 5-minute demo and questions, ends within 15 (Q-12) | Not started |
| T-66 | Do a final check against `REQUIREMENTS.md` | T-61, T-62, T-65 | Every requirement is Met | Not started |
| T-67 | Keep the team's analysis Word file current (D-20). T-92 rewrites it as a standalone report (R-35) | T-34 | `deliverables/Costco_Case_Analysis.docx` matches the latest `outputs/` | In progress |

### Phase 7: Final push (`DELIVERABLES_PLAN.md`)

Section numbers refer to `DELIVERABLES_PLAN.md`, which has the details, checks and order.

| ID | Task | Needs | Done when | Status |
|---|---|---|---|---|
| T-71 | Install and smoke-test the skills and tools for the deck, notebook and browser checks (D-25) | | Installed, pinned and smoke-tested (F-60) | Done |
| T-72 | Write the final deliverables plan | | `DELIVERABLES_PLAN.md` exists and the planning files point to it | Done |
| T-73 | Complete the case coverage matrix and close its gaps (5.1, 5.2, V-03) | | No ✗ remains except deliverables being built | Done |
| T-74 | Reproduce everything and check the submission independently (V-01, V-02) | | Tests pass, outputs are identical, the submission checks pass | In progress |
| T-75 | Calibration study and model-free check of expected service (V-04, V-11) | T-74 | Result recorded, and any change to the plan decided by the user | In progress |
| T-76 | Check the forecast's and scenarios' inputs (V-05, V-06) | T-74 | All hold, or the changes go to the user | In progress |
| T-77 | Independent checks of the search and cost, plus a test that explanations match their numbers (V-07 to V-09) | T-74 | 20 of 20 shifts agree, costs match to the cent, the test passes | In progress |
| T-78 | Freeze the numbers (5.4, D-28) | T-73 to T-77 | Pipeline rerun, committed, tagged `numbers-freeze` (M6) | Not started |
| T-79 | Shared look: `design/tokens.json`, `src/viz_style.py`, the deck theme (section 6, D-26) | | A sample chart in each medium looks like the same product | In progress |
| T-80 | API layer and its tests (7.3) | | `tests/test_api.py` passes, and defaults equal the submission | In progress |
| T-81 | Web app shell: layout, navigation, top bar, data client, "preparing" screen (7.2) | T-79, T-80 | Served by FastAPI on localhost:8501, with no outside requests | In progress |
| T-82 | Overview page (7.4) | T-81 | Checked in a browser | Not started |
| T-83 | Schedule page: board, block drawer, changes list, export (7.4) | T-81 | Checked in a browser | Not started |
| T-84 | Demand page (7.4) | T-81 | Checked in a browser | Not started |
| T-85 | Cost and service page (7.4) | T-81 | Checked in a browser | Not started |
| T-86 | Scenario lab (7.4) | T-81 | A what-if finishes in under 8 seconds and Reset works | Not started |
| T-87 | Playbook page (7.4) | T-81 | Checked in a browser | Not started |
| T-88 | Methods page (7.4) | T-81 | Checked in a browser | Not started |
| T-89 | Browser checks, screenshots, offline and timing checks (7.8) | T-82 to T-88 | `planning/evidence/drive_web.py` passes | Not started |
| T-90 | Polish, fresh-eyes review, the M4 decision, then update the README, `CLAUDE.md`, `DESIGN.md` and the UI guide (7.9) | T-89 | M4 met with the new app or the fallback | Not started |
| T-91 | Jupyter appendix (section 8) | T-78, T-79 | Runs with no errors, and its reproducibility cell passes | Not started |
| T-92 | Rewrite the report (section 9) | T-78, T-79, then T-89 for screenshots | Every page checked as rendered, and the PDF exported | Not started |
| T-93 | Build the presentation, main and appendix slides (section 10) | T-78, T-90 | `validate.py` passes, every slide checked as rendered, and the PDF exported | Not started |
| T-94 | Q&A prep sheet (10.6) | T-78 | Saved in `deliverables/` | Not started |
| T-95 | Package the hand-in and tag `submission` (section 11) | T-62, T-66 | The folder is complete and the tag exists | Not started |
