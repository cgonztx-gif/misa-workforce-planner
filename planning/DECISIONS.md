# Decisions

**Proposed** means recommended but not yet confirmed. The user confirmed the stack on 2026-11-03 (D-03 to D-10). D-05 and D-07 have since been refined by D-19 and D-18. On 2026-11-05 the user chose a React front end for the web tool (D-24), which supersedes D-03 and D-09 for the app's interface.

## D-01: Trust the data pack docs and the PDF over the `.pptx`

- **Status:** Accepted, 2026-11-02
- **Why:** the `.pptx` is older and says a baseline plus "at least one" changed scenario is enough. The newer PDF and the README require all three (F-01).

## D-02: Build the proof of concept as a locally hosted web app, demoed live or recorded

- **Status:** Accepted, 2026-11-03. This was the user's proposal, and a test on this machine showed it works (F-22).
- **Why:** it runs on one laptop in a browser, needs no hosting, and can be shown live or screen-recorded. The PDF accepts any working tool a warehouse leader could use, and allows a live or recorded demo.
- **Limit:** judges can't click through it themselves unless we hand it over (Q-04).

## D-03: Use Python with Streamlit

- **Status:** Accepted, 2026-11-03. Confirmed by the user (Q-09). **Superseded for the demo app's interface by D-24 on 2026-11-05.** Python stays the engine, and the Streamlit app stays as the fallback (D-27).
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

- **Status:** Accepted, 2026-11-03. **Superseded for the new web app by D-24 on 2026-11-05,** which uses a JavaScript chart library. Altair stays in the Streamlit fallback.
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

## D-23: Aim for a good-looking app, with no strict design system

- **Status:** Accepted, 2026-11-04, at the user's request: "the goal should be looking nice, it will just be made once so there is no strict layout to follow."
- **Choice:** `UI_FRAMEWORK.md` gives direction: the goal, a few real limits, the current look, each screen's job, how it behaves and a demo path. Exact colors and layout can change freely, and nothing tests them. The app stays in `app.py`, with testable helpers in `src/app_data.py`.
- **Rejected:** a design-token module, a component library, a multi-layer `src/ui/` package, and tests that fail on stray colors or direct Streamlit calls. Claude began writing these from an earlier request for an "extensive framework". The user stopped it before any of it was saved, because it suits a product that lives on, not a one-time build.
- **Kept as tests:** only what protects the demo: scenario switching, what-if settings, the reason panel, the simulated-data label, escaped dollar signs, readable board numbers, and default values matching the submission.

## D-24: Rebuild the web tool in React, served by a thin FastAPI layer over the Python engine

- **Status:** Accepted, 2026-11-05. The user asked for a from-scratch rebuild that is "perfectly functional, easy to follow, yet comprehensive and accurate", looking "like a real platform Costco could use" and "like a tech company's website". Given the choice, the user picked this over rebuilding in Streamlit. It supersedes D-03 for the interface and D-09 for its charts. D-22's "stay on Streamlit 1.56" now applies only to the fallback.
- **Why:** full control of layout and interaction, so it reads as a real product. Streamlit's look is recognizable, and the case is sponsored by an IT consultancy. The engine in `src/` is finished and tested, so the new layer is thin: an API over `run_scenario` and the saved outputs.
- **Choice:** Vite, React and TypeScript, Tailwind, Radix UI primitives, Recharts and lucide icons. FastAPI and uvicorn on `localhost:8501` serve the API and the built app from one process. Details are in `DELIVERABLES_PLAN.md` section 7.
- **Rejected:** rebuilding in Streamlit, which is lower risk but still looks like Streamlit.
- **Cost:** a Node build step, a second language, and new tests. The Streamlit app stays as the fallback (D-27).

## D-25: Install the skills and tools for the deck, notebook and browser checks

- **Status:** Accepted, 2026-11-05. The user asked for UI and design skills for the deck, and anything else where skills help, and chose to install them before implementation starts.
- **Choice:** `webapp-testing` and `theme-factory` from Anthropic's skills repository, at project level, read before installing (F-60). Python tools go in `requirements-dev.txt`, so the app's `requirements.txt` stays small. Node tools for the deck go in `package.json`. The `pptx`, `docx`, `dataviz` and `frontend-design` skills were already available.
- **Rejected:** `superdesign`, which sends work to an outside service (as in D-22). `canvas-design`, which isn't needed. The Playwright MCP plugin, because `webapp-testing` and Claude in Chrome cover it. Anthropic's `document-skills` plugin, which duplicates the account's `pptx` and `docx` skills.

## D-26: One look across the app, deck, report and notebook

- **Status:** Accepted, 2026-11-05. The user asked that the deck match the app's formatting, including its charts.
- **Choice:** `design/tokens.json` holds the colors, font, shapes and chart styling. The app turns it into CSS variables, `src/viz_style.py` turns it into a matplotlib style for the report and notebook, and the deck's builder turns it into a pptxgenjs theme. The font is Segoe UI, which is installed here and in Office and works offline. PDF copies of the deck and report embed it.
- **Why not a design system:** D-23 still holds. This is one shared palette so the deliverables match, not a set of rules or tests.

## D-27: Keep the Streamlit app as the fallback demo until the new app is accepted

- **Status:** Accepted, 2026-11-05, when the user said to start implementing the plan.
- **Why:** it works today (F-56, F-59). If the new app isn't ready by M4, Friday at 1 pm, the team still has a tested demo, and the deck's screenshots come from it.
- **Choice:** `app.py` and its tests stay untouched until M4. After that, it runs on port 8502 as a documented fallback.

## D-28: Freeze the numbers before writing, and print no figures by hand

- **Status:** Accepted, 2026-11-05, when the user said to start implementing the plan. Extends D-20 to the deck and the notebook.
- **Why:** the deck, report and notebook are written in parallel, so they must all quote the same plan. Any model change after the freeze means rebuilding all three.
- **Choice:** after the checks in `DELIVERABLES_PLAN.md` section 5, rerun the pipeline, commit and tag `numbers-freeze` (M6). The deck's and report's builders read every calculated figure from `outputs/analysis_summary.json`, and the notebook recomputes and asserts against it.

## D-29: Replace the service curve's sharp knot with a smooth bend

- **Status:** Accepted, 2026-11-05. The user chose it after the calibration study (T-75, V-04): "Adopt smooth knot".
- **Why:** service is judged first. The model ran slightly high near the goal, mostly in Front End (F-62). The cause is the curve's shape, not its scatter (F-63). A smooth (softplus) bend, with one more parameter, fits better out of sample on every measure (F-64). It also agrees with history without the model, within 0.1 points (F-65). The study predicted it adds 24 people and cuts none, at +0.35% cost per scenario.
- **Choice:** `src/service.py` fits the smooth bend and keeps today's scatter rule. Then the pipeline, the tests and the WS1 checks are rerun, and the numbers freeze (M6).
- **Rejected:** scaling the scatter (fix a), which isn't clearly better and is unstable. Letting scatter vary with utilization (fix b), which is clearly better but tiny (+3 people) and leaves the bias near the goal.
- **Cost:** a model change the day before the freeze. Nothing downstream had been built yet, so the rebuild is cheap.

## D-30: A private GitHub repository for the team to run the app

- **Status:** Accepted, 2026-11-05. The user asked: "make a private repo and push. on github. others will be running the app, not changing anything."
- **Choice:** `https://github.com/cgonztx-gif/misa-workforce-planner`, private, as the `origin` remote of `main`. Teammates clone it and follow the README: Python only, because the built front end (`web/dist`) is committed. A fresh clone was tested on 2026-11-05: data extracted, server ready in 25.5 seconds, the app served, and BASE's cost matched the submission.
- **Rules:** teammates run the app and don't change it, so `main` stays the one source. Push finished, tested work when the user asks. Don't push `.vscode/` or anything untracked by `.gitignore`. Teammates need to be added as collaborators to see the repository.

