# Plan

## Current focus

**Deadline: the morning of Saturday, Nov 7, 2026.** The exact time isn't known yet (Q-11), so we aim to finish Friday night (D-14). As of Wednesday evening, that leaves Thursday and Friday.

**Now: M2 is met, ahead of the schedule.** Diagnosis, forecast, allocation rule, service curves, risk model, staffing search and a valid submission CSV all exist, and a separate check recomputed the tables (F-39 to F-54). The team's analysis is in `deliverables/Costco_Case_Analysis.docx` (T-67). The app is still only a placeholder.

Next actions:

1. **T-41, T-42:** explanations for each changed block, and the leader playbook. Feb 14 capacity (F-50) and the Warehouse 2 illness case need clear actions.
2. **T-50, T-51, T-52, T-53:** build the app views on `src/search.py` and `outputs/`.
3. **Callouts:** whether to allow for them is still open (A-03, F-51, Q-02), and the allowance stays in the plan unless that changes. The service goal is set at 95% (A-13).

Held for now:

- **Organizer questions (T-05):** deferred at the user's request, and nothing has been sent. Build on A-01 to A-03. The team still needs the exact deadline and how to hand in (Q-04, Q-11), so come back to this by Thursday, which leaves time for a reply.
- **Team name (Q-07):** `team_id` stays the placeholder `TEAM_NAME` until the real name is known. T-62 must replace it before submitting.

## Schedule

The team is 4 people with one main coder, so coding work mostly runs in sequence. Tasks stay general and aren't assigned per person (D-15). The second column lists work that doesn't depend on the build finishing first.

| When | Build | Can run alongside | Check at the end |
|---|---|---|---|
| Tue Nov 3, evening | T-04, T-06, T-07, T-09, T-10 (done) | T-08 (done Wed Nov 4), T-05 (deferred) | M1 |
| Wed Nov 4 | T-11, T-12, T-13, T-20 to T-24, T-30 to T-35, T-40 (done, ahead of schedule) | Deck outline for T-60, using `deliverables/Costco_Case_Analysis.docx` | M2: met |
| Thu Nov 5 | T-41, T-50, T-51, T-52, T-53 | T-42, T-60, T-61, and come back to T-05 | M3 |
| Fri Nov 6 | T-54, T-55, T-56, T-62, T-63, T-64 | Finish T-60 and T-61, then T-65 and T-66 | M4 by afternoon, M5 by night |
| Sat Nov 7, morning | Submit. No new work, only buffer | | |

### If we fall behind

Cut in this order (D-14):

1. **T-25:** already dropped.
2. **T-40:** replace the simulation with risk bands read directly from the service curve.
3. **T-52:** reduce to one simple chart.
4. **T-54:** remove the what-if control. The scenario selector still meets R-13.

Never cut these, because the case requires them: a valid CSV for all three scenarios (T-35, T-62), staffing, cost and service risk in the app (T-50, T-51), explanations (T-41), the deck and appendix (T-60, T-61), and a way to show the demo (T-63 or T-64).

## Milestones

| ID | Milestone | Done when | Target date |
|---|---|---|---|
| M1 | Setup complete | T-04 and T-06 to T-10 are done, with T-05 deferred | Tue Nov 3 (finished Wed Nov 4 with T-08) |
| M2 | Diagnosis and forecast locked | Phases 1 and 2 are done, and a first valid submission CSV exists | Wed Nov 4, night (met) |
| M3 | Staffing plans generated | Phases 3 and 4 are done, covering all three scenarios | Thu Nov 5, night |
| M4 | App ready to demo | Phase 5 is done | Fri Nov 6, afternoon |
| M5 | Submission ready and frozen | Phase 6 is done | Fri Nov 6, night |

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
| T-41 | Generate explanations: change from draft, demand driver, cost and risk effect (D-08) | T-34, T-40 | Every changed block has a reason | Not started |
| T-42 | Write the leader playbook: what to do when demand or staffing shifts | T-34 | Each scenario has clear triggers and actions | Not started |

### Phase 5: App

| ID | Task | Needs | Done when | Status |
|---|---|---|---|---|
| T-50 | Scenario selector and staffing view by warehouse, department, day and shift | T-32 | Switching scenario updates the view | Not started |
| T-51 | Cost and service-risk view compared with the draft | T-34, T-40 | Both are shown for the selected scenario | Not started |
| T-52 | Demand view: when demand rises or falls, and why | T-23 | Peaks and their drivers are visible | Not started |
| T-53 | "Why this recommendation" panel, including the assumptions behind it | T-41 | Available for any changed block | Not started |
| T-54 | What-if control that recalculates live, such as callout rate, plus the playbook | T-42, T-50 | Moving it changes the recommendation | Not started |
| T-55 | Cache the three scenarios at startup and time the app (D-11) | T-50 to T-54 | Timings in `FINDINGS.md` and fast enough to demo | Not started |
| T-56 | Package it: `requirements.txt`, start command, `.streamlit/config.toml` (Q-04) | T-55 | Runs from a clean environment using written steps | Not started |

### Phase 6: Deliverables

| ID | Task | Needs | Done when | Status |
|---|---|---|---|---|
| T-60 | Build the 12-15 minute deck | T-34, T-42 | Covers diagnosis, forecast, recommendation and all three scenarios | Not started |
| T-61 | Build the appendix: forecast method, assumptions, cost and service against the draft | T-34 | All three are covered | In progress |
| T-62 | Finalize the submission CSV with the real team name (Q-07) | T-35 | Validator passes on the final file, and `team_id` no longer holds `TEAM_NAME` | Not started |
| T-63 | Rehearse the demo in a real browser with Wi-Fi off (closes the gap in F-22) | T-56 | Works offline, result recorded | Not started |
| T-64 | Record a backup demo (Q-05) | T-63 | Video saved and watched through | Not started |
| T-65 | Run a timed full rehearsal | T-60, T-63 | Finishes within 12-15 minutes including the demo | Not started |
| T-66 | Do a final check against `REQUIREMENTS.md` | T-61, T-62, T-65 | Every requirement is Met | Not started |
| T-67 | Keep the team's analysis Word file current (D-20) | T-34 | `deliverables/Costco_Case_Analysis.docx` matches the latest `outputs/` | In progress |
