# Costco Workforce Planner

Our entry for the Texas MISA Fall 2026 case competition: labor planning for one week at three warehouses. **Submission is due the morning of Saturday, Nov 7, 2026.**

All data in this case is simulated. It is not real Costco data and must not be presented as such.

## Start here

| If you want to | Go to |
|---|---|
| Understand the analysis and the recommendation | `deliverables/Costco_Case_Analysis.docx` |
| Try the tool | [Run the app](#run-the-app) |
| See the staffing plan we'd submit | `outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv` |
| See why any block changed | `outputs/explanations.csv`, or the app's Why tab |
| See the plan, decisions and open questions | `planning/README.md`, then `planning/PLAN.md` |
| See how the app should look and behave, and a demo path | `planning/UI_FRAMEWORK.md` |
| Check the case rules | `data/team_distribution/README.md`, after the setup below |

## Run the app

You need Python 3.13. These commands work in PowerShell and in a Unix shell, except the activate line. Run them from this folder.

```bash
# 1. Create a virtual environment and turn it on
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Mac or Linux

# 2. Install the packages
python -m pip install -r requirements.txt

# 3. Extract the case data
python -m zipfile -e MISA.zip .
python -m zipfile -e "MISA/Student Teams/Costco_Case_Competition_TEAMS.zip" data

# 4. Start the app, then open http://localhost:8501
python -m streamlit run app.py
```

The first page load takes up to 20 seconds, and after that it's fast. **Before a demo, open the app once** so this doesn't happen in front of the judges. The app needs no internet once it's installed.

**Using it:** pick a scenario and a warehouse in the sidebar. The tabs show staffing, cost and service, demand, why each block changed, and the playbook. Click any block on the staffing board to see why it changed. The sliders under "What if?" recalculate the plan, and "Reset what-if" returns to the plan we'd submit.

## Rebuild the results

Do this after changing the code. The pipeline takes a minute or two.

```bash
python -m pytest                     # all tests
python -m src.pipeline               # writes outputs/
python -m src.charts                 # writes outputs/charts/
python planning/evidence/reconcile_dashboard.py > planning/evidence/reconcile_dashboard.output.txt
```

To rebuild the Word file, run `npm install` once, then `node scripts/build_analysis_doc.js`. This needs Node.js, and it isn't needed to run the app. **A rebuild replaces the Word file, including any edits made in it, and it fails while the file is open in Word.**

## Before submitting

1. Replace the placeholder team name: set `TEAM_ID` in `src/submission.py`.
2. Rerun `python -m src.pipeline`.
3. Run the final check, which also rejects the placeholder name:

```bash
python -c "import pandas as pd; from src.submission import validate; print(validate(pd.read_csv('outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv', parse_dates=['day_date']), final=True) or 'Passes')"
```

## What's where

```text
app.py                     The Streamlit app
assets/                    The app's page icon
src/                       The analysis: forecast, service curves, risk, staffing search, explanations, playbook
tests/                     Automated tests
outputs/                   Generated results: the submission CSV, tables, charts, analysis_summary.json
deliverables/              The analysis Word file for the team
scripts/                   Builds the Word file
planning/                  Plan, requirements, decisions, findings, assumptions, questions and log
planning/evidence/         Scripts and saved output that back up the findings
MISA.zip                   The original case files
Texas MISA ... .pptx       The original case deck. It's out of date, so trust the PDF and data pack docs
requirements.txt           Pinned Python packages
package.json               Node package for the Word file
.streamlit/config.toml     App settings and the current theme. It stays local
pytest.ini                 Test settings
CLAUDE.md                  Essentials for Claude Code sessions
.claude/                   Claude Code settings and UI skills. Not needed to run the app
```

`MISA/` and `data/` aren't in git, because they're extracted from `MISA.zip`.
