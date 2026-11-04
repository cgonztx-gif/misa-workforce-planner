# Log

Newest first. Add an entry at the end of every work session.

## 2026-11-04

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
