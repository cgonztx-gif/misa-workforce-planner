# Costco Workforce Planner

Our entry for the Texas MISA Fall 2026 case competition: labor planning for one week at three warehouses. **Submission is due Saturday, Nov 7, 2026 at 7:00 AM.**

All data in this case is simulated. It is not real Costco data and must not be presented as such.

## Start here

| If you want to | Go to |
|---|---|
| Understand the analysis and the recommendation | `deliverables/Costco_Case_Analysis.docx` (or `.pdf`) |
| See the presentation | `deliverables/Costco_Workforce_Presentation.pptx` (or `.pdf`) |
| Read the code behind every number | `deliverables/Costco_Analysis_Appendix.ipynb` (or `.html`) |
| Try the tool | [Run the app](#run-the-app) |
| See the staffing plan we'd submit | `outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv` |
| See why any block changed | `outputs/explanations.csv`, or click the block on the app's Schedule page |
| Prepare for judges' questions | `deliverables/Costco_QA_Prep.docx` |
| See the plan, decisions and open questions | `planning/README.md`, then `planning/PLAN.md` |
| Check the case rules | `data/team_distribution/README.md`, after the setup below |

## Run the app

The Workforce Planner is a web app: a React front end served, with its JSON API, by a small Python server over the analysis in `src/`. The built front end is in `web/dist`, so running it needs only Python. It needs no internet once installed.

You need Python 3.13 and access to the private repository. Get a copy with `git clone https://github.com/cgonztx-gif/misa-workforce-planner.git`, then run the commands below from the new `misa-workforce-planner` folder. They work in PowerShell and in a Unix shell, except the activate line. **Just running the app needs no Node.js and no changes**: the built front end is included.

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

# 4. Start the app. It opens http://localhost:8501 once it's ready
python -m server
```

On Windows you can double-click `start_app.bat` instead. It checks that port 8501 is free, starts the server and opens the browser once it's ready.

The server prepares all three scenarios when it starts, which takes 15-20 seconds, with a "preparing" screen meanwhile. After that, every page and scenario switch is instant, and the demo's what-if (demand +10%, callouts 150%) is ready in advance. **Before a demo, start the app a minute early.**

**Using it:** pick a scenario (BASE, PEAK, DISRUPT) and a warehouse in the top bar; they carry across pages and stay in the address, so a refresh keeps the view.

- **Overview:** the answer for the scenario, against the draft, and all three scenarios side by side.
- **Schedule:** the weekly board. Click any block for why it changed, where its staff come from, and its cost and service. **Changes** lists every change, and **Export** downloads the submission CSV.
- **Demand:** the forecast against the benchmark, what drives each day, and the drivers we tested.
- **Cost and service:** every scenario and department against the draft, and the trade-offs.
- **Scenario lab:** change demand, callouts, staff or the service goal, and re-plan live. **Reset** returns to the submitted plan.
- **Playbook** and **Methods:** what to do when conditions change, and how the engine works.

**Fallback:** the earlier Streamlit app still works. Start it with `python -m streamlit run app.py --server.port 8502` and open http://localhost:8502.

**Changing the front end** needs Node.js: `cd web`, `npm install` once, then `npm run dev` (http://127.0.0.1:5173, with the server running) or `npm run build` to rebuild `web/dist`.

## Rebuild the results

Do this after changing the code. The pipeline takes a minute or two.

```bash
python -m pytest                     # all tests
python -m src.pipeline               # writes outputs/
python -m src.charts                 # writes outputs/charts/
python planning/evidence/ws1_checks.py --full    # the independent accuracy checks
python planning/evidence/reconcile_dashboard.py > planning/evidence/reconcile_dashboard.output.txt
```

Restart the app after rerunning the pipeline, because it reads `outputs/` when it starts.

The tools for building the deck and notebook and for the browser checks are in `requirements-dev.txt`: run `python -m pip install -r requirements-dev.txt`, then `python -m playwright install chromium` once. The browser checks are `python planning/evidence/drive_web.py`.

The documents are built from `outputs/`, so their figures are never typed by hand. Run `npm install` once in this folder, then:

```bash
node scripts/build_analysis_doc.js      # the report (Word)
node scripts/deck/build_deck.js         # the presentation
node scripts/build_qa_sheet.js          # the Q&A sheet
python scripts/build_notebook.py        # the notebook appendix, run and exported to HTML
```

**A rebuild replaces the file, including any edits made in it, and fails while the file is open in Word or PowerPoint.**

## Before submitting

1. Replace the placeholder team name: set `TEAM_ID` in `src/submission.py`.
2. Rerun `python -m src.pipeline`.
3. Rebuild the documents (the deck and report show the team name), then run the final check, which also rejects the placeholder name:

```bash
python -c "import pandas as pd; from src.submission import validate; print(validate(pd.read_csv('outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv', parse_dates=['day_date']), final=True) or 'Passes')"
```

4. Commit, then build the hand-in folder with `python scripts/package_submission.py`. It writes `submission/`: the CSV, deck, report, notebook, a zip of the tool's source and a README. It refuses while the team name is the placeholder.

## What's where

```text
server/                    The app's Python server: the JSON API over src/, and the built front end (python -m server)
web/                       The app's React front end (Vite, TypeScript). web/dist is the built copy the server serves
start_app.bat              Double-click start for Windows
design/                    The shared look: colors, type and chart settings for the app, deck, report and notebook
src/                       The analysis: forecast, service curves, risk, staffing search, explanations, playbook, charts
tests/                     Automated tests, including the API
outputs/                   Generated results: the submission CSV, tables, charts, analysis_summary.json
deliverables/              The report, presentation, notebook appendix and Q&A sheet
notebooks/                 The notebook appendix's source, as a plain Python script
scripts/                   Builds the report, deck, Q&A sheet, notebook and design tokens
planning/                  Plan, requirements, decisions, findings, assumptions, questions and log
planning/evidence/         Scripts and saved output that back up the findings, plus app screenshots
app.py                     The earlier Streamlit app, kept as a fallback (port 8502)
assets/                    The Streamlit app's page icon
MISA.zip                   The original case files
Texas MISA ... .pptx       The original case deck. It's out of date, so trust the PDF and data pack docs
requirements.txt           Pinned Python packages
requirements-dev.txt       Extra tools for the deck, notebook and browser checks
package.json               Node packages for the documents and the deck (the app's are in web/package.json)
.streamlit/config.toml     The Streamlit fallback's settings
pytest.ini                 Test settings
CLAUDE.md                  Essentials for Claude Code sessions
.claude/                   Claude Code settings and skills. Not needed to run the app
```

`MISA/` and `data/` aren't in git, because they're extracted from `MISA.zip`.
