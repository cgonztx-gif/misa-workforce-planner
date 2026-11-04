# Decisions

**Proposed** means recommended but not yet confirmed. The user confirmed the stack on 2026-11-03 (D-03 to D-10).

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

- **Status:** Proposed, 2026-11-03. This is demo advice rather than part of the stack the user confirmed. The `localhost` binding is already set in `.streamlit/config.toml`.
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

- **Status:** Proposed, 2026-11-03
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
