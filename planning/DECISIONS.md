# Decisions

**Proposed** means recommended but not yet confirmed. The user confirmed the stack on 2026-11-03 (D-03 to D-10). D-05 and D-07 have since been refined by D-19 and D-18.

## D-01: Trust the data pack docs and the PDF over the `.pptx`

- **Status:** Accepted, 2026-11-02
- **Why:** the `.pptx` is older and says a baseline plus "at least one" changed scenario is enough. The newer PDF and the README require all three (F-01).

## D-02: Build the proof of concept as a locally hosted web app, demoed live or recorded

- **Status:** Accepted, 2026-11-03. This was the user's proposal, and a test on this machine showed it works (F-22).
- **Why:** it runs on one laptop in a browser, needs no hosting, and can be shown live or screen-recorded. The PDF accepts any working tool a warehouse leader could use, and allows a live or recorded demo.
- **Limit:** judges can't click through it themselves unless we hand it over (Q-04).

## D-03: Use Python with Streamlit

- **Status:** Accepted, 2026-11-03. Confirmed by the user (Q-09).
- **Why:** most of it is already installed (F-21), it builds quickly, and it can recalculate live when a judge switches scenario.
- **Rejected:**
  - **Power BI or Tableau:** good for displaying results, but they can't easily run the forecast and search, and the case asks for more than a dashboard.
  - **Excel Solver:** awkward with whole-number staffing and a nonlinear curve across 567 rows, and a weak live demo.
  - **React and FastAPI:** extra build time that judging doesn't reward.
- **Team fit:** the user has the main Python and coding experience (Q-06), so that person is effectively the single main coder. The schedule in `PLAN.md` allows for this.

## D-04: Read the CSVs with pandas and use no database

- **Status:** Accepted, 2026-11-03
- **Why:** about 1,700 rows across the two main views. SQL Server tools aren't on PATH here (F-25).
- **Rejected:** SQL Server as the working data store.
- **Revisit if:** the forecast fails to beat the benchmark (T-21), which would reopen T-25. Then run SQL Server once in Docker and export the SQL-only daily features (F-16) to CSV.

## D-05: Forecast with a regression on log demand, then split to shifts

- **Status:** Accepted, 2026-11-03
- **Choice:** a statsmodels regression at daily level, then a shift split.
- **Why:** effects read as percentages ("Presidents' Day +X%"), which supports explaining recommendations, and it gives intervals for the risk estimate.
- **Rejected:** gradient boosting. 369 open daily rows (F-06) and a single holiday analog (F-27) are too few.

## D-06: Find staffing by exhaustive search per shift, with no optimization solver

- **Status:** Accepted, 2026-11-03
- **Why:** weekly hour limits are already built into availability, so the only link between decisions is Front End and Merchandising sharing cross-trained staff in the same shift. That leaves 63 shifts x 3 scenarios = 189 small joint searches, plus Pharmacy on its own. Trying every headcount pair finds the true best answer for the model, applies the published allocation rule directly, and uses the real nonlinear service curve.
- **Rejected:** PuLP and OR-Tools. They would require approximating that curve and the allocation rule, and add a dependency.
- **Revisit if:** a constraint spanning several shifts is added.

## D-07: Fit service curves with SciPy and estimate risk with Monte Carlo

- **Status:** Accepted, 2026-11-03
- **Choice:** SciPy `curve_fit` per department. NumPy simulation of forecast error and callouts gives each block's chance of missing target.
- **Why:** service risk is a required output (R-04). Both libraries are installed.

## D-08: Generate explanations from templates, with no language model

- **Status:** Accepted, 2026-11-03
- **Why:** repeatable in a demo, needs no API key, and can't invent reasons, because the text is filled from the calculated numbers.

## D-09: Use Altair for charts

- **Status:** Accepted, 2026-11-03
- **Why:** it ships with Streamlit, so it adds no dependency.

## D-10: Keep the allocation rule in one function

- **Status:** Accepted, 2026-11-03
- **Why:** the exact usable-flex rule isn't published (Q-03). If the organizers clarify it, the change stays in one place. The search, the cost figures and the draft comparison all use the same rule.

## D-11: Demo setup

- **Status:** Proposed, 2026-11-03. This is demo advice rather than part of the stack the user confirmed. Built so far: the `localhost` binding, preparing all scenarios on first load, the what-if controls and the written setup steps (F-56, F-57). Still to do: choosing the laptop and recording the backup.
- **Choice:**
  - Bind to `localhost`, which should also stop a Windows firewall prompt appearing mid-demo.
  - Cache the three scenarios at startup, since the real search and risk simulation will be slower than the test in F-22.
  - Include a what-if control that recalculates live, such as callout rate, to show more than three saved answers.
  - Use our own laptop if possible, and record a backup.
  - Include a `requirements.txt` and start command in case someone else must run it.

## D-12: Keep planning in `planning/`, with `CLAUDE.md` holding only the essentials

- **Status:** Accepted, 2026-11-03, at the user's request.

## D-13: Every data finding must be reproducible from the original files

- **Status:** Accepted, 2026-11-03
- **Why:** the original checks lived in a temporary folder and would have been lost. `evidence/verify_findings.py` reads straight from `MISA.zip` and needs only the standard library.

## D-14: Build a rough end-to-end version first, and finish Friday night

- **Status:** Proposed, 2026-11-03. The work follows it, and the user hasn't confirmed or objected.
- **Why:** the deadline is Saturday morning (Q-01), with one main coder and three full working days. A valid submission CSV by Wednesday night means there is always something to submit, and each later task improves it. Finishing Friday night leaves Saturday morning as buffer, especially while the exact time is unknown (Q-11).
- **Cut order if behind:** listed in `PLAN.md`.

## D-15: Keep tasks general, not assigned per person

- **Status:** Accepted, 2026-11-03, at the user's request. Revisit if the user wants owners added later.

## D-16: Use git, local only for now

- **Status:** Accepted, 2026-11-04, at the user's request (Q-08). The details below are the working setup chosen to carry that out.
- **Why:** it gives a way back to a working demo if a late change breaks it.
- **Choice:**
  - One repository on `main`, with a commit after each finished task once the tests pass.
  - `MISA.zip` and the `.pptx` are tracked. `MISA/` and `data/` are ignored because they extract from the zip, and a copy of the tracked files runs after extracting (F-38).
- **Not decided:** a remote such as GitHub, which the team would need to share files this way. Nothing gets pushed without asking, and any remote should be private because the repository holds the case files.

## D-17: A department only lends staff it doesn't need itself

- **Status:** Proposed, 2026-11-04
- **Why:** without this, the search cut the most overloaded blocks to lend their people, for example Warehouse 4 Front End to 36 people at 124% utilization, below its own 40 regular staff. Those blocks can't meet target either way, so this scores well on blocks meeting target. No warehouse leader would accept it, and it would be badly exposed if judges score waits rather than pass or fail (F-53).
- **Cost:** a slightly lower expected-service figure, about one point in PEAK and less in DISRUPT, measured before the D-18 fix. We accept this.

## D-18: Use an exact risk calculation in the search, and check it with Monte Carlo

- **Status:** Proposed, 2026-11-04. Refines D-07.
- **Why:** a calculation over the callout distribution and a fine grid of demand error gives the same answer every run, so plans don't change between runs, and it is fast enough to try every headcount. `monte_carlo_chance()` simulates the same model, and a test keeps the two within half a point (F-47).

## D-19: Include weekly level in the forecast, and forecast at the last four weeks' average

- **Status:** Proposed, 2026-11-04. Refines D-05.
- **Why:** without a weekly term, the regression mistakes MLK week's high volume for a holiday effect and overstates it. With the term, the holiday factors match the data pack's build script exactly (F-45). A future week's level can't be known, so the forecast uses the last four weeks' average, which did slightly better than all weeks in the backtest (F-44, A-14).

## D-20: Build the team's Word file from the pipeline's results

- **Status:** Proposed, 2026-11-04. The user asked for a Word file to give to group members.
- **Choice:** `scripts/build_analysis_doc.js` writes `deliverables/Costco_Case_Analysis.docx`, reading calculated figures from `outputs/analysis_summary.json`. A few fixed references are typed in the script: case facts, the dashboard's old figures (29 people, $327,334, 0.908), assumption values (2%, 5%), and rounded PTO effects ("about 4", "4 to 5").
- **Why:** calculated figures can't drift from the code, and rebuilding after a change takes seconds.
- **Limit:** a rebuild replaces the file, so hand edits are lost unless they are also made in the script. If the team starts editing the Word file directly, stop rebuilding it and update it by hand instead.
- **Cost:** a small Node dependency (`docx`, in `package.json`), used only for this.

## D-21: Keep a copy of the Nov 2 dashboard's tables as evidence

- **Status:** Accepted, 2026-11-04. The user asked for the dashboard to be rebuilt and verified.
- **Why:** the dashboard is at https://claude.ai/artifact/Y4fhxQ8KMaWau2LssMyWLn, and `planning/evidence/dashboard_2026-11-02/` holds the tables we compare against, so the comparison still runs if the dashboard changes. The dashboard itself wasn't changed, including the figures we've corrected (F-40, F-42, F-46).

## D-22: Install two official skills for UI work, and keep Streamlit at 1.56

- **Status:** Accepted, 2026-11-04. The user asked for skills covering the app's UI, design and how it functions. Keeping Streamlit at 1.56 was Claude's call, and the user can reverse it.
- **Choice:** installed at project level, so they travel with the repository:
  - `developing-with-streamlit`: Streamlit's own skill for layout, design, widgets, dashboards, session state and performance. A copy from the Streamlit 1.57.0 package is in `.claude/skills/`.
  - `frontend-design`: Anthropic's plugin for visual direction and interface wording, version 1.1.1 from the official marketplace. `.claude/settings.json` enables it.
  - `dataviz`, already available, still governs charts.
- **Why not upgrade to get the newest copy:** Streamlit's recommended route is `streamlit skills`, which needs 1.58 or later. That changes the framework under a tested app three days before the deadline, just to get documentation. 1.57 is the closest copy to our pinned version.
- **Rejected:**
  - `streamlit/agent-skills`: archived. It only points to the copy inside a Streamlit package of 1.57 or later, so it finds nothing on 1.56.
  - Third-party design plugins such as Superdesign: not needed, and they would send work to an outside service.
- **Limits:** a skill is guidance, and the case rules and `CLAUDE.md` still win. `frontend-design` favors a distinctive look, which should stay subordinate to a clear tool a warehouse leader can use. Installing these changed nothing in the app.
- **Revisit if:** the UI work needs a Streamlit feature newer than 1.56. An upgrade would then need the full tests and `evidence/drive_app.py`.
