# Log

Newest first. Add an entry at the end of every work session.

## 2026-11-04

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
