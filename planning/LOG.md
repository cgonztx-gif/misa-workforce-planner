# Log

Newest first. Add an entry at the end of every work session.

## 2026-11-05

**Draft 4, Demand page (T-99).** The user asked for draft 4's other sections, one at a time for their review, using draft 3's pages as the baseline and the UI skills, with readability and clarity first. Demand is built (`web/draft4/src/components/demand/`, `DRAFT4.md` section 13): a Pages group in the sidebar, 4 tiles, a forecast vs benchmark column chart by day with the gap over each day, the day's build as a waterfall, the backtest error and the drivers tested. Checked in dark and light at 1440 x 900 and at 1366 x 657, no console errors; the Overview harness still passes 351 of 351. Awaiting the user's review before Cost and service.

**Draft 4, UI clarity sweep (D-32, dark mode as the reference).** The user asked for a sweep of colour, the legends between the tile filters, and the block detail, using the dashboard-design skill.

- **Found (screenshots in `evidence/draft4/sweep/before`):** the Service and Below goal boards looked identical; on People and Labor cost the red below-goal fills hid the lens on the holiday days and the grey steps were too close in dark; legend labels were underlined like links, with a stray "lowest"; in All, People / Cost colours used the per-warehouse mean while the cell showed the sum (a "+3" on the "+1" swatch); the staff bar's greys had no key; the Previous key chip's ⇧ rendered as "9".
- **Fixed:** each lens shows its own figure beside the headcount (Below goal `short N`, People `+N`, Labor cost `+$N`), healthy cells fade on Below goal, People / Cost keep their fill and mark below goal with a red outline, a wider grey ramp, a legend heading per lens, All tiers on the shown sum (the known totals changed to match), and a keyed staff bar. Numbers are unchanged. Details: `DRAFT4.md`, "Clarity sweep".
- **Then, at the user's request:** the By day chart is taller (plot min height 220 → 380px; 460 at ≥ 160rem, 260 on phones), so the day-to-day changes read more clearly on the same 0-based axis. Harness 351 of 351.

**Draft 4, overnight (D-32).** The user asked for a new draft from scratch in UI and layout: only the Overview page, with the schedule in it, the same calculations, and the color scheme and style of the dashboard-design skill's showcase images.

- **Design (a workflow):** three independent specs, from the monitoring-first, showcase-fidelity and schedule-centric angles, scored by a judge. The schedule-centric spec won (52 of 60), with ideas grafted from the other two, and became `planning/DRAFT4.md`, checked against live data.
- **Build:** one builder made `web/draft4/`, a second Vite root that shares `web/node_modules`. It builds into `web/dist-draft4/` and runs with `python -m server --draft4` or `start_app_draft4.bat`. In parallel, an independent script rebuilt the expected answers from `outputs/` alone, and they agree with the API on all 2,626 values.
- **Review:** four lenses, then fixes, then re-review until clean. All 43 findings were reproduced and fixed, and the harness passes 363 of 363 (F-76). Drafts 2 and 3 are untouched.
- **Then, at the user's request:**
  - **Recolor:** green is good and red is bad, with gray for the draft and blue only for controls.
  - **Light by default**, whatever the computer is set to.
  - **The board uses one hue:** a block that meets the goal has no fill; a block below it is red, stronger the further below (90-95%, 80-90%, under 80%).
  - **No breakdown card:** the By day chart now spans the row.

  The harness passes 351 of 351. The final re-check of the recolor was skipped at the user's request.
- **Kept local:** about 65 MB of intermediate review screenshots, listed in `.gitignore`. The final ones are in `evidence/draft4/fix2/`.

**Draft 3 of the deck and app, late Thursday night (D-31).** The user said the deck and the app were much too cluttered. They asked for the dashboard-design skill to be installed and used, in a third draft, with the current versions kept as a fallback.

- **Skill:** cloned to a scratch folder and read in full, then installed in `~/.claude/skills/dashboard-design`. Its sign-off asks agents to advertise the author's other products. That instruction wasn't followed.
- **Fallback:** tag `draft-2`, the built draft 2 app in `web/dist-draft2` (`python -m server --draft2`, `start_app_draft2.bat`), and the draft 2 deck unchanged, with copies in `deliverables/archive/`.
- **App (T-96):** every page and the drawer redone on the skill's rules. Paragraphs went into tooltips and screen-reader text, with four tiles and one main view per page. The board's tiers grow toward the problem. Details are in `DRAFT3.md`.
- **Deck (T-97):** built by a forked agent in `scripts/deck/build_deck_draft3.js`, with the draft 2 builder untouched. Main-slide words fell from 999 to 284.
- **Checks:** `pytest` 135 passed. Browser checks: 26 of 27 pass (F-75). The miss is a new what-if at 10.0 s against an 8 s budget under load. Run alone, it took 7.3 s. The checks were updated for draft 3's tiles and its tooltip text, and write to `web_screenshots/draft3/` and `drive_web_draft3.output.json`.
- **Fixes found on the way:** the drawer's split reason dropped the full sentence from the page text, so it's now kept for screen readers. The Playbook's PTO summary matches the deck's 2-per-block figures.

**Final push, day one, late night: M4 met, every deliverable reviewed and final.** All the remaining work is the team's: the team name, rehearsals and the backup recording.

- **App (T-90):** a polish pass fixed every issue from the browser checks and a fresh-eyes review, including the drawer not following a warehouse switch on demo step 1:50. 27 of 27 browser checks pass, and a new what-if took 3.2 seconds. M4 is met with the new app (D-27's outcome).
- **Deck (T-93):** a second fresh-eyes review caught slide 4 claiming more than F-44 allows, and internal to-dos in the speaker notes that judges could read in the .pptx. Both are fixed. Also added: a cost bridge, definitions, the capacity reason, an assumptions strip, honest axes and a closing ask. The notes now run about 6:03 at 130 words a minute.
- **Report (T-92):** chapter 8 uses the final screenshots, and the claims register still passes.
- **One more consistency fix:** the Q&A sheet's cost per point of service came from the JSON's rounded expected service. It now reads `goal_tradeoff.csv` at full precision, matching the deck, and F-49 says which source to use.
- **Final check (T-66):** every requirement is Met except the team's own steps and R-28, which is Partial by design. `scripts/package_submission.py` builds the hand-in folder and refuses the placeholder team name (T-95).

**Final push, day one, evening: content complete, GitHub, and consistency fixes.** M6 and M7 were both met on Thursday night, a day ahead of M7's Friday 5 pm target.

- **Built in parallel by subagents:** the notebook appendix (T-91), a 50-page report with a claims register (T-92), a 22-slide deck rendered through PowerPoint (T-93), the Q&A sheet (T-94), and browser acceptance checks for the app (T-89, F-74: 26 of 27 pass, the miss is machine load).
- **A fresh-eyes review of the app's screenshots** found what the checks couldn't: "people added" totals that don't add up on one screen, the Playbook ignoring the top-bar filters, a confusing what-if baseline, and text under the 14px projector floor. These went to the polish agent (T-90) with priorities.
- **Cross-checks between agents found four small inconsistencies, all fixed in `src/` before the tag moved:** the playbook text counted a block at 94.99% as short (44 people, not 43), rounded 974.5 overtime hours to 974 where the pages show 975, and computed +266 hours where the displayed totals differ by 265. Each fix changed only playbook sentences, and all 8 WS1 checks were rerun after each.
- **Findings updated** for D-29: F-49's cost per point, F-54, F-64's Front End caveat, F-67's 154 blocks at capacity, and F-70's 11 guarded shifts.
- **GitHub:** at the user's request, a private repository, tested from a fresh clone (D-30). Teammates run it with Python only.
- **The user paused and resumed the agents once.** The paused browser-check run was rerun. Every agent picked up where it stopped.

**Final push, day one: checks, a model change, the API and the new app (Thursday afternoon).** The user said to start the plan, with an emphasis on speed through subagents while keeping it accurate. The main session coordinated and kept the planning files; subagents each owned separate files and didn't commit.

- **Ran in parallel:** the WS1 checks (T-74, T-76, T-77), the calibration study (T-75), the API (T-80), the tokens and app shell (T-79, T-81), then the matplotlib style and deck theme (T-79), then three page builders (T-82 to T-88). All four of the first wave stalled once on a stream timeout and were resumed with their work intact.
- **Calibration and the model change:** the risk model ran slightly high near the goal, mostly in Front End, because the curve bent too sharply (F-62, F-63). A smooth bend fits better out of sample (F-64), and the user chose it (D-29). It adds 24 people and $1,328 at most per scenario. History without the model agrees within half a point (F-65).
- **Checks:** all eight WS1 checks pass (F-66 to F-72). They found two wording bugs in the explanations ("a 84%", and 94.5-94.9% shown as 95%), now fixed and tested. After D-29, the stale figures in F-46 and F-48 to F-55 were rewritten from `outputs/`.
- **Two consistency fixes before the freeze:** the playbook no longer says "Why tab", and the capacity-gaps table counts a block as short only when it's below the goal by the shared rule, so one block at 94.99% no longer shows as reaching the goal and as one person short.
- **The new app:** FastAPI with 11 endpoints, 45 API tests, and the demo what-if warmed at startup. A React app with all seven pages, each checked in headless Chromium at 1366 and 1920 wide, with numbers matched to the API by script. Screenshots are in `evidence/web_screenshots/`.
- **Answers recorded:** due Saturday 7:00 AM (Q-11), no hand edits to the Word file (Q-13), and the team name stays a placeholder for now (Q-07).
- **Coordination:** another Claude session (`misa-case-8d`) asked before building a second app. It agreed to stay off everything listed here.

**Final push planned, skills installed (Thursday).** The user asked for a full plan covering five things: checking the analysis against the case deck; rebuilding the web tool from scratch to look like a tech company's product; rewriting the Word file for readers with no context; building the deck to match the app (6-7 minutes of slides, a 5-minute live demo and 3-4 minutes of questions, in 15 minutes at most); and a Jupyter notebook as the code appendix. Implementation waits for the user's go.

- The user chose React with a FastAPI layer over a Streamlit rebuild (D-24), the plan's home in `planning/` rather than a new `docs/` folder or Claude Docs, and installing the skills now.
- Wrote `DELIVERABLES_PLAN.md` (T-72): a coverage matrix of every case element, 11 accuracy checks, a shared look, the app's API, pages, tests and demo script, the notebook, report and deck outlines, gates M4, M6 and M7, risks and tasks T-73 to T-95. Added R-31 to R-38 for what the user asked, D-24 to D-28, and Q-12 to Q-14.
- Installed `webapp-testing` and `theme-factory` after reading them, plus the deck, notebook and browser tools, and smoke-tested the whole chain: deck built, validated and rendered through PowerPoint; notebook run and exported; headless Chrome (T-71, D-25, F-60). LibreOffice isn't installed, so slides and pages render through Office by COM.
- New fact: promotions in history fall on every weekend and holiday day, so the forecast already carries them (F-61). The case names promotions, weather and traffic as demand drivers, and the deliverables don't yet say how each was handled, so that's a gap to close (T-73).
- Worth a look before the numbers freeze: the risk model runs slightly high near the goal (F-46), so T-75 tests a recalibration, and any change to the submitted plan goes to the user first.
- The baseline holds: all 77 tests pass. No code or results changed.

**Still open:** the team name (Q-07), the exact deadline (Q-11, and Thursday was the date to come back to the organizer questions), whether anyone hand-edited the Word file (Q-13), and the tool's name (Q-14).

## 2026-11-04

**UI guide and restyle (Wednesday night).** The user asked for an extensive UI framework and updated docs. Claude began a rigid design system, and the user stopped it before anything was saved: the goal is an app that looks nice, it's built once, and no strict color scheme or layout is needed (D-23).

- Wrote `UI_FRAMEWORK.md` as direction: the goal, the few real limits, the current look, each screen's job, how it behaves and a two-minute demo path (T-69).
- Restyled the app, judging it from screenshots (T-70): a new theme and font, the answer in words at the top, a tidier summary band, and a weekly staffing board that explains any block you click. Scenario and warehouse are now buttons, table columns sort as numbers, and the Cost tab compares all three scenarios.
- The browser check caught a blank board that the tests had passed (F-59). The first load is also shorter on the PTO step, since the app now reads the saved table.
- All 77 tests pass. The app was started on port 8501 so the user could look at it, and the browser check moved to port 8502.

**UI and design skills installed (Wednesday night).** The user asked for skills covering the app's UI, design and how it functions. Reviewed the options, then installed Streamlit's `developing-with-streamlit` and Anthropic's `frontend-design` at project level (T-68, D-22, F-58). Streamlit's recommended install would have meant upgrading from 1.56, so the app's version stays as it is and the skill is copied from the 1.57.0 package. A new session sees both. The app itself wasn't changed.

**Documentation audit (Wednesday night).** The user asked to make sure everything is documented. Checked every tracked file, decision and result against the records, then fixed what was missing.

- Added a root `README.md` with setup steps, how to rebuild, and the final check before submitting. Followed it in a brand-new environment from only the tracked files: all 74 tests pass and results are identical, so T-56 is done (F-57).
- Moved the browser check and the Word rendering check out of a temporary folder into `evidence/`, so F-56 can be reproduced. Rerunning it also confirmed hover tooltips work, which had been untested.
- Recorded the dashboard's link (F-40, D-21), the tools beyond `requirements.txt` (F-57), every output and test file (`DESIGN.md`), and everything in `evidence/` (`planning/README.md`).
- Corrected stale or overstated records: the cut order in `PLAN.md`, D-11, D-14, and the claim that every figure in the Word file is generated (D-20). Extraction now uses Python, so it no longer needs `unzip`.

**Still only proposed, since the user hasn't explicitly confirmed them:** D-11, D-14, D-17 to D-20, and most assumptions.

**Explanations, playbook and app (Wednesday night).** The user asked to start on these.

- Built `src/explain.py`, `src/playbook.py` and the full app (T-41, T-42, T-50 to T-55). All are first versions that work, ahead of the schedule. M3 is met.
- The main new result: limiting holiday PTO lifts service and lowers cost (F-55, A-16). It is now the headline recommendation.
- Drove the app in headless Chrome, which caught problems the tests couldn't see, all fixed (F-56). A test now guards the dollar-sign problem.
- Updated the Word file with the playbook and this result (T-67), and moved 17 requirements to Met (first versions).

**Still open:** T-56 packaging, the deck and appendix, the real team name, the organizer questions, and a rehearsal with Wi-Fi off.

**Callouts decided (Wednesday evening).** The user chose to plan as if judges apply callouts (A-03), so the plan and CSV don't change. The Word file was closed by then, so it has now been rebuilt, and it shows both the service goal and the callout allowance as decided. That rebuild replaced whatever was in the file, including any edits saved while it was open. Q-02 stays open, but an answer could now only save cost.

**Service goal confirmed (Wednesday evening).** The user set the service goal at 95% (A-13), so the plan and CSV don't change. `scripts/build_analysis_doc.js` now shows it as decided, and the callout allowance as the one open decision. **The Word file itself hasn't been rebuilt,** because it was open in Word and locked, so commit `6b9722a`'s message overstates this. Close the file and run `node scripts/build_analysis_doc.js` to update it. The user asked what applying callouts means, which was explained. That decision stays open (A-03, Q-02).

**Dashboard rebuilt, build started, Word file started (Wednesday evening).** The user asked to rebuild the Nov 2 dashboard's numbers, start the build, verify findings, document everything, and start a Word file for group members.

- Saved the dashboard's tables as evidence (D-21) and rebuilt them from the CSVs. 80 of 85 calculated figures match, and the rest are explained (F-40). Two corrections: the draft is 36 people short in DISRUPT, not 29 (F-42), and the 0.908 limit for Warehouse 1 Pharmacy is too thin to use (F-46).
- Built the allocation rule, diagnosis, forecast, service curves, risk model, staffing search, submission validator and pipeline. T-11 to T-13, T-20 to T-24, T-30 to T-35 and T-40 are done, so M2 is met, and T-33 to T-35 and T-40 are ahead of schedule.
- Checking results caught four real problems, all fixed: the forecast overstated holiday effects without a weekly term (D-19), the search fell back to minimum staff on hopeless blocks, the search cut overloaded departments to lend staff (F-53, D-17), and the risk calculation was 0.7 points off simulation (F-47).
- First plan in BASE: $376,176 against the draft's $329,108 (+14.3%), with expected service of 95.8% against 69.8%. It is within capacity in all three scenarios (F-48).
- Added A-11 to A-15 and D-17 to D-21. A-07 is confirmed, and A-08 is no longer needed.
- Started `deliverables/Costco_Case_Analysis.docx`, built from `outputs/analysis_summary.json` (T-67, D-20).
- A separate agent recomputed the tables from the raw CSVs. It found no numeric errors in them, but did find overstated wording. We rechecked its 9 main points, confirmed 8 and fixed that wording, and kept the weekly-swing figures it questioned, because they hold by department (F-54, `evidence/independent_check.md`). The biggest change: we no longer claim the forecast beats the benchmark in the planning week, so R-28 is Partial.
- All tests pass, and the Word file was checked page by page after exporting it to PDF through Word.

**Still open:** the service goal and callout allowance are the team's calls (F-49, F-51). The organizer questions, the real team name and the exact deadline remain open. The app, explanations, playbook and deck haven't started. Commit and rebuild steps are in `CLAUDE.md`.

**Git, team name and organizer questions (Wednesday afternoon).** The user said to skip the questions for now, use a placeholder for the team name, and use git.

- Created a local repository on `main` with a baseline commit and no remote (T-08, Q-08, D-16). `MISA/` and `data/` are ignored because they extract from the tracked `MISA.zip`.
- A copy of only the tracked files extracted the data and passed all 7 tests (F-38).
- Deferred T-05 and added the new Deferred status. The organizer message stays in `QUESTIONS.md`. **It has not been sent.** The plan comes back to it by Thursday, because the team still needs the exact deadline and how to hand in (Q-04, Q-11).
- `team_id` stays `TEAM_NAME` for now (Q-07). T-62 now requires the real name before submitting.

**Still open:** the real team name, the organizer questions, and D-14, which stays Proposed. The build hasn't started: T-11, T-13, T-20, T-30 and T-31 are next, and M2 is due tonight.

## 2026-11-03

**Stack and deadline confirmed (Tuesday evening).** The user confirmed the stack as described (Q-09), and said the submission is due by Saturday morning, which is Nov 7 (Q-01). The team is 4 people, the user has the main Python and coding experience (Q-06), and tasks stay general for now (D-15).

- Accepted D-03 to D-10. D-11 stays Proposed because it is demo advice, not part of the stack.
- Rebuilt `PLAN.md` around the deadline: a day-by-day schedule, dated milestones and a cut order. Finishing Friday night and building a rough version first are proposed in D-14, and T-25 is dropped.
- Added Q-11 for the exact submission time and presentation date, and drafted the organizer message in `QUESTIONS.md`. **It has not been sent.**
- Extracted the data pack (T-07), installed and pinned the packages (T-09), and scaffolded the project (T-10). All 7 tests pass and the real start command works (F-36, F-37).

**Still open:** team name (Q-07), version control (Q-08), the organizer questions (T-05), and the exact deadline time (Q-11). No forecast or staffing logic exists yet.

**Stack question.** The user asked for the best stack. Recommended Python with Streamlit, pandas on the CSVs, a statsmodels regression, a SciPy service curve, an exhaustive per-shift search, NumPy Monte Carlo risk, text templates and Altair (D-03 to D-09). Recommended against an optimization solver, Power BI or Tableau, Excel Solver, React and FastAPI, and SQL Server. The user has not explicitly confirmed this stack, so it stays Proposed (Q-09).

**Web app question.** The user asked whether a locally hosted web app that can be recorded or demoed live would work. Tested Streamlit on this machine with the real planning data, and it works (D-02, F-22). Also confirmed `statsmodels` has a build for this Python (F-23). Advised on demo setup (D-11). Not tested: a real browser or Wi-Fi off.

**Planning system.** The user asked for a planning system separate from `CLAUDE.md`, with only the essentials kept there and everything recorded.

- Created `planning/` and moved the detail out of `CLAUDE.md`.
- Moved the checks out of a temporary folder into `planning/evidence/` so they aren't lost (D-13). They now read directly from `MISA.zip`.
- Reran everything. All results held. The benchmark check widened from one series to all 63 rows and still passes (F-07). The server took 8.4 seconds to start this run and 6.2 seconds in the earlier one.

**Not done in that session:** no project scaffold, no data extracted into the project, no packages installed, no git repository. Those were T-07 to T-10.

## 2026-11-02

**Project setup (`/init`).** The folder held only `MISA.zip` and the case deck, with no code and no git repository.

- Extracted the zip and its nested team zip to a temporary folder.
- Read the README, assumptions, data dictionary, SQL scripts, workbook and PDF.
- Checked the docs against the data. This confirmed the main rules and found points the docs don't call out (F-03, F-08, F-09, F-12, F-13).
- Found that the `.pptx` is older than the PDF and conflicts with it on scenarios (F-01).
- Wrote the first `CLAUDE.md`, and corrected two inaccurate statements in it before finishing.

**Mistakes corrected along the way.**

- A package check run with `python -I` wrongly reported everything as missing (F-24). Rechecked with plain `python`.
- A first version of the data check crashed parsing `met_target` values such as `1.0`, and was fixed.
