# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Entry for the Texas MISA Fall 2026 case competition: the Costco workforce planning challenge. The output is a locally hosted web app, a staffing plan CSV, and a presentation with supporting analysis. All data is simulated and is not real Costco data, so label it that way in deliverables.

**Submission is due Saturday, Nov 7, 2026 at 7:00 AM (Q-11).**

The analysis, staffing CSV and the new web app work, and **the numbers are frozen at the `numbers-freeze` tag (M6, D-28)**: after it, only a bug fix changes a number, and then every deliverable is rebuilt. **The final push is planned in `planning/DELIVERABLES_PLAN.md`:** the app, the rewritten report, the deck, a notebook appendix and a Q&A sheet. Start there, with "Current focus" in `planning/PLAN.md`. **Draft 3 (D-31, `planning/DRAFT3.md`)** redid the deck and app with less text, on the `dashboard-design` skill. Draft 2 is the fallback: tag `draft-2`, `web/dist-draft2` and the unchanged `Costco_Workforce_Presentation.pptx`. The team still has to pick one. **Draft 4 (D-32, `planning/DRAFT4.md`)** is a from-scratch one-page Overview with the schedule, in the skill showcase's style (`web/draft4/`, `python -m server --draft4`). Git is on `main`, with a private GitHub remote, `origin` (`cgonztx-gif/misa-workforce-planner`), so teammates can run the app (D-30). `MISA/` and `data/` aren't tracked because they extract from `MISA.zip`.

## Stack

Python for the analysis: pandas on the CSVs, a statsmodels regression forecast, SciPy service curves, a risk model checked by NumPy simulation, and an exhaustive per-shift staffing search with no optimization solver. The web app is a React front end (`web/`, Vite and TypeScript) served with a JSON API by a thin FastAPI layer (`server/`) over `src/` (D-24). The service curve has a smooth bend (D-29). The Streamlit app (`app.py`, Altair charts) is the fallback on port 8502 (D-27). Small Node scripts build the Word file, the deck and the Q&A sheet, and `scripts/build_notebook.py` builds the notebook. The reasons are in `planning/DECISIONS.md`.

## Planning system

All plans, decisions and findings live in `planning/`.

- **Starting work:** read "Current focus" in `planning/PLAN.md`. `planning/README.md` explains what goes where.
- **Finishing work:** update the task status in `planning/PLAN.md`, add an entry to `planning/LOG.md`, and commit once the tests pass. Push to `origin` only when the user asks, and only tested work, because teammates run what's there.
- **New facts:** add them to `planning/FINDINGS.md` with a way to reproduce them. Anything unverified goes in `planning/ASSUMPTIONS.md`.

## Commands

`README.md` has the full setup steps for a new machine.

```bash
# Install pinned packages
python -m pip install -r requirements.txt

# Tools for the deck, notebook and browser checks (then run once: python -m playwright install chromium)
python -m pip install -r requirements-dev.txt

# Extract the data pack if data/ is missing (creates MISA/ and data/team_distribution/)
python -m zipfile -e MISA.zip .
python -m zipfile -e "MISA/Student Teams/Costco_Case_Competition_TEAMS.zip" data

# Run all tests, or a single test
python -m pytest
python -m pytest tests/test_data.py::test_row_counts

# Rebuild the analysis (writes outputs/), its charts, and the team's Word file (run npm install once)
python -m src.pipeline
python -m src.charts
node scripts/build_analysis_doc.js

# Draft 3 of the deck, and its render (draft 2's builder is scripts/deck/build_deck.js)
node scripts/deck/build_deck_draft3.js
python planning/evidence/render_deck.py deliverables/Costco_Workforce_Presentation_draft3.pptx planning/evidence/deck_render_draft3

# Start the app (opens http://localhost:8501 once ready; restart it after rerunning the pipeline)
python -m server

# Draft 2 of the app, the fallback for draft 3 (or double-click start_app_draft2.bat)
python -m server --draft2

# Draft 4, the one-page Overview in the skill showcase's style (D-32): build, serve, check
cd web && npm run build:draft4
python -m server --draft4
python planning/evidence/drive_draft4.py

# The Streamlit fallback
python -m streamlit run app.py --server.port 8502

# Rebuild the front end after changing web/ (needs Node; run npm install in web/ once)
cd web && npm run build

# Independent accuracy checks, and the browser acceptance checks
python planning/evidence/ws1_checks.py --full
python planning/evidence/drive_web.py

# Reproduce the data findings (reads MISA.zip directly)
python -I planning/evidence/verify_findings.py
```

## Rules not to miss

- **All three scenarios are required** (BASE, PEAK, DISRUPT). The `.pptx` in the root is outdated, so trust the case PDF and the data pack docs.
- **Judging order:** service first, then labor cost, then feasibility.
- **Demand must be forecast.** The planning grid has none.
- **Service depends on worked staff, not scheduled.** Blocks meet target over 99% of the time below 0.85 utilization and almost never at 0.90 or above, so don't aim for the edge.
- **Don't learn staffing levels from historical schedules.** They follow manager habits and are often wrong.
- **Solve Front End and Merchandising together.** They share cross-trained staff in each shift.
- **Read availability per scenario from the grid.** The docs understate what DISRUPT changes.
- **Join the submission template on keys, never row position.** It needs all 567 rows, total employees per block, and 0 for closed blocks.
- **For UI work, the goal is that it looks good, with no strict design system (D-23).** The new app's direction is in sections 6 and 7 of `planning/DELIVERABLES_PLAN.md`, and the deck, report and notebook charts match it through `design/tokens.json` (D-26). Use `frontend-design`, `dataviz` and `webapp-testing` for the app, and `pptx`, `docx` and `theme-factory` for the deck and report. Check every change in a real browser or as rendered pages, because tests miss visual problems. The demo must work offline, so use no CDNs, remote fonts or the Streamlit skill's themes. The Streamlit fallback stays on 1.56 (D-22).
- **The team name is still a placeholder.** Replace `TEAM_ID` in `src/submission.py` before submitting.
- **Calculated figures in every deliverable come from `outputs/` (D-20, D-28).** Change the code or the builders (`scripts/`), and don't type numbers into the report, deck, Q&A sheet or notebook by hand. Rebuilding replaces hand edits and fails while the file is open.
