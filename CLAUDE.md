# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Entry for the Texas MISA Fall 2026 case competition: the Costco workforce planning challenge. The output is a locally hosted web app, a staffing plan CSV, and a presentation with supporting analysis. All data is simulated and is not real Costco data, so label it that way in deliverables.

**Submission is due the morning of Saturday, Nov 7, 2026.**

So far, only a data loader, a placeholder app and basic tests exist. Git is local only, on `main`. `MISA/` and `data/` aren't tracked because they extract from `MISA.zip`.

## Stack

Python with Streamlit, pandas on the CSVs, a statsmodels regression forecast, SciPy service curves, NumPy risk simulation, Altair charts, and an exhaustive per-shift staffing search with no optimization solver. The reasons are in `planning/DECISIONS.md`.

## Planning system

All plans, decisions and findings live in `planning/`.

- **Starting work:** read "Current focus" in `planning/PLAN.md`. `planning/README.md` explains what goes where.
- **Finishing work:** update the task status in `planning/PLAN.md`, add an entry to `planning/LOG.md`, and commit once the tests pass. Don't add a remote or push without asking.
- **New facts:** add them to `planning/FINDINGS.md` with a way to reproduce them. Anything unverified goes in `planning/ASSUMPTIONS.md`.

## Commands

```bash
# Install pinned packages
python -m pip install -r requirements.txt

# Extract the data pack if data/ is missing (creates MISA/ and data/team_distribution/)
unzip -o MISA.zip -d . && unzip -o "MISA/Student Teams/Costco_Case_Competition_TEAMS.zip" -d data

# Run all tests, or a single test
python -m pytest
python -m pytest tests/test_data.py::test_row_counts

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
