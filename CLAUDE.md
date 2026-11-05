# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Entry for the Texas MISA Fall 2026 case competition: the Costco workforce planning challenge. The output is a locally hosted web app, a staffing plan CSV, and a presentation with supporting analysis. All data is simulated and is not real Costco data, so label it that way in deliverables.

**Submission is due the morning of Saturday, Nov 7, 2026.**

First versions of the analysis, staffing CSV, explanations, playbook and Streamlit app all work. **The final push is planned in `planning/DELIVERABLES_PLAN.md`:** a new React web app, a rewritten report, the deck and a notebook appendix. Start there. Git is local only, on `main`. `MISA/` and `data/` aren't tracked because they extract from `MISA.zip`.

## Stack

Python for the analysis: pandas on the CSVs, a statsmodels regression forecast, SciPy service curves, a risk model checked by NumPy simulation, and an exhaustive per-shift staffing search with no optimization solver. The web app is being rebuilt in React with a thin FastAPI layer (D-24). The Streamlit app, with Altair charts, stays as the fallback until M4 (D-27). Small Node scripts build the Word file and the deck. The reasons are in `planning/DECISIONS.md`.

## Planning system

All plans, decisions and findings live in `planning/`.

- **Starting work:** read "Current focus" in `planning/PLAN.md`. `planning/README.md` explains what goes where.
- **Finishing work:** update the task status in `planning/PLAN.md`, add an entry to `planning/LOG.md`, and commit once the tests pass. Don't add a remote or push without asking.
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

# Start the app, then open http://localhost:8501
python -m streamlit run app.py

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
- **Calculated figures in the Word file come from `outputs/`.** Change the code or `scripts/build_analysis_doc.js`, and don't type those numbers in by hand. Rebuilding replaces hand edits and fails while the file is open.
