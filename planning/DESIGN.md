# Design

Status: first versions of the analysis engine, submission CSV, explanations, playbook and app are all built. The choices behind this design are in `DECISIONS.md` (D-03 to D-11 and D-17 to D-21).

Paths like `csv/` are relative to `data/team_distribution/`, created by T-07.

## Data model

Every fact table has the same grain: warehouse x department x date x shift.

- **Warehouses:** `store_id` 1 (Medium), 2 (Large), 4 (Large). There is no store 3.
- **Departments:** `dept_id` 38 Front End, 92 Merchandising, 95 Pharmacy.
- **Shifts:** `shift_code` OPEN, MID, EVE.

| View | Period | Rows | Notes |
|---|---|---|---|
| `csv/v_ShiftHistory.csv` | Jan 1 - Feb 11, 2026 | 1,134 | Demand, schedule, callouts, availability, cost, service |
| `csv/v_PlanningWeekGrid.csv` | Feb 12 - 18, 2026 | 567 | 3 scenarios x 189 blocks. Has no demand; forecasting it is the task. Same keys as the submission template |

Other sources:

- `comp.X` tables are in `csv/comp_X.csv`.
- `csv/PlanningWeek_BenchmarkForecast.csv` holds the naive daily forecast.
- `Costco_Workforce_Case_Student_DataPack.xlsx` holds the key views in Excel.
- The daily core tables (`API.*`, `src.*`, `model.*`) exist only in the SQL scripts (F-16).
- `docs/DATA_DICTIONARY.md` and `docs/ASSUMPTIONS.md` define every field and case assumption.

## Calculation chain

1. **Forecast** BASE shift demand: a regression of log daily demand on warehouse, department weekday, department holiday window and department week, predicted at the last four weeks' average level (D-19), times 1.03 for Front End and Merchandising on Feb 14 (A-06), times the average shift share. Only Front End gets separate shares on holiday-window days (F-45). The floor to beat is the benchmark (F-07), which is daily and ignores holidays, promotions and weather. Its `predicted_transaction_count_proxy` is in the same units as `daily_demand_units`.
2. **Apply the scenario:** multiply by `demand_multiplier` and use that scenario's availability columns.
3. **Convert to headcount:** the smallest headcount, at or above `min_staff`, that reaches the service goal once risk is counted (see below), and 0 when closed. There is no single target utilization, so the implied one varies by block.
4. **Allocate and cost:** fill with regular staff, then usable cross-trained staff, then overtime, all in `src/allocation.py`. `cost = (regular + flex) x paid_hours x loaded_regular_hourly_cost + overtime x paid_hours x loaded_overtime_hourly_cost`. A block above capacity or below `min_staff` is infeasible.
5. **Predict service** from a curve fitted on history, where `utilization = shift_demand_units x labor_hours_per_workload_unit / worked_labor_hours`. Per department: `log(metric / target) = min(cap, level[warehouse] + slope x u + extra_slope x bend(u))`, with normal scatter around it. `bend(u) = width x log(1 + exp((u - knot) / width))` is a smooth version of `max(0, u - knot)` (D-29). The first model used the sharp version, which ran slightly high near the goal (F-62 to F-64).

## Staffing search (D-06)

```text
for each scenario x warehouse x date x shift:
    need = smallest headcount reaching the service goal, per department
    floor = min(need, regular + overtime), so a department only lends what it doesn't need (D-17)
    for each Front End and Merchandising headcount pair from the floors upward:
        apply the allocation rule to both departments (A-01)
        skip the pair if either department is over capacity
    keep the best pair, in this order:
        1. highest sum of chances of meeting target, each capped at the goal, to 3 decimals
        2. fewest hours short of need
        3. lowest cost
Pharmacy: min(need, regular + overtime), with no flex
```

The service goal is 95% (A-13, F-49) and is set by `SERVICE_GOAL` in `src/search.py`. A block still below the goal is flagged in `outputs/plan_vs_draft.csv` as `below_service_goal`, and `outputs/capacity_gaps.csv` totals the people short.

## Service risk (D-07)

Each block's chance of meeting target combines forecast error (T-24, plus A-11 on Feb 13-16), callouts by department and situation (T-13, A-12), backfill of 49% limited by the overtime still free, and the curve's scatter (T-31). `chance_met()` in `src/risk.py` calculates this exactly, and `monte_carlo_chance()` simulates it as a check (D-18). This is what the app will show as service risk, and what the search compares against the service goal.

## Layout

All of this is built.

```text
app.py               Streamlit entry point: the views below
src/data.py          Load CSVs, join them, map holiday labels
src/diagnosis.py     Staffing gaps, callouts, and the rebuilt dashboard figures
src/forecast.py      Daily regression and shift split
src/service.py       Service curve fit and prediction
src/allocation.py    Regular, flex and overtime allocation, and cost (D-10)
src/search.py        Per-shift staffing search
src/risk.py          Service risk: exact calculation and Monte Carlo check
src/explain.py       A reason and assumptions for every block (D-08)
src/playbook.py      Triggers, actions and the holiday PTO test
src/app_data.py      What the app shows, kept testable without Streamlit
src/submission.py    Export and validate the template; team_id is one constant, TEAM_NAME until Q-07
src/pipeline.py      Runs everything and writes outputs/
src/charts.py        Charts for the Word file
scripts/             Builds the Word file (Node, D-20)
tests/               Unit and integration tests
outputs/             Generated CSVs, charts and analysis_summary.json
deliverables/        Costco_Case_Analysis.docx, for the team
```

## App views

`UI_FRAMEWORK.md` covers the look, behavior and demo path in full.

| View | Shows | Requirements |
|---|---|---|
| Sidebar | Scenario and warehouse selectors. What-if sliders for callouts, demand and service goal, which rerun the search | R-04, R-13 |
| Staffing | A clickable weekly board of recommended headcount against the draft, with the clicked block's reason below | R-11, R-17, R-18, R-21 |
| Cost and service | All three scenarios side by side, then labor cost and service risk against the draft | R-04, R-12, R-19 |
| Demand | When demand rises or falls, and why | R-09, R-16 |
| Why | Reason and assumptions for each change | R-14, R-22 |
| Playbook | Triggers and actions per scenario, the holiday PTO test, rules for the day and the tightest blocks | R-20, R-23 |

An answer in words and totals across all warehouses sit above the tabs, and the tabs show the selected warehouse. Everything is prepared on first load, up to 20 seconds, and then cached (F-56, F-59). A block's **cushion** is the people it can lose, or the extra demand it can take, before its chance of meeting target falls to 50% (`cushion()` in `src/risk.py`).

## Charts

Front End, Merchandising and Pharmacy use blue, orange and green, which pass the color-blind check. Word file charts are drawn by `src/charts.py`, and app charts in `app.py`. `UI_FRAMEWORK.md` describes the rest of the current look.

## Outputs

`python -m src.pipeline` writes these to `outputs/`, and `python -m src.charts` adds `charts/`.

| File | Holds |
|---|---|
| `TEAM_SUBMISSION_TEMPLATE_filled.csv` | The submission: all 567 rows, with the placeholder team name for now |
| `plan_vs_draft.csv` | Every block: demand, plan, draft, staff sources, cost, utilization, chance of meeting target, `below_service_goal` |
| `explanations.csv` | Every block: action, reasons, cushion and assumptions |
| `capacity_gaps.csv` | People short of need by scenario, day and department |
| `goal_tradeoff.csv` | Cost and expected service at each service goal |
| `pto_what_if.csv` | The holiday PTO test. The app reads this copy, and a test checks that it's current |
| `forecast_daily.csv`, `forecast_blocks.csv` | The forecast by day and by block, with the benchmark |
| `service_limits.csv` | Utilization for a 95%, 90% and 50% chance of meeting target |
| `diagnosis_staffing_gaps.csv`, `diagnosis_callout_rates.csv`, `diagnosis_service_bands.csv` | The historical diagnosis |
| `analysis_summary.json` | Everything the Word file reads |

## Tests

| File | Covers |
|---|---|
| `tests/test_data.py` | Row counts, template keys, closed rows, draft capacity |
| `tests/test_allocation.py` | The allocation and cost rule |
| `tests/test_diagnosis.py` | The rebuilt figures against the dashboard, and the callout split |
| `tests/test_forecast.py` | Holiday factors, the backtest and the shift split |
| `tests/test_service_and_risk.py` | Service curves, and the risk calculation against simulation |
| `tests/test_search_and_submission.py` | The search's rules and the submission validator |
| `tests/test_explain_and_playbook.py` | Reasons, assumptions, cushions, playbook and the PTO test |
| `tests/test_app.py` | The app, run without a browser, plus readable numbers on the board. `planning/evidence/drive_app.py` covers a real browser |

## Commands

```bash
# Extract the data pack (already done on this machine)
python -m zipfile -e MISA.zip .
python -m zipfile -e "MISA/Student Teams/Costco_Case_Competition_TEAMS.zip" data

# Install the pinned packages (already done on this machine)
python -m pip install -r requirements.txt

# Run the tests
python -m pytest

# Rebuild the analysis, charts, dashboard comparison and Word file
python -m src.pipeline
python -m src.charts
python planning/evidence/reconcile_dashboard.py > planning/evidence/reconcile_dashboard.output.txt
node scripts/build_analysis_doc.js   # needs npm install once

# Start the app, then open http://localhost:8501
python -m streamlit run app.py
```

The start command reads `.streamlit/config.toml`, which runs headless, binds to `localhost`, turns off usage stats and sets a light theme with a minimal toolbar. It also holds the current theme, which can change freely (D-23). It was tested in Chrome and in a clean environment (F-56, F-57). `README.md` has the full setup steps.

## Optional SQL Server build

In SSMS, run `sql/01` through `sql/04` in order, which creates the `LaunchProject` database. Then run `sql/05_Validation_Checks.sql`, where every row should read PASS or INFO.

`sql/06_Example_Queries.sql` holds deliberately naive starters that are still useful as references:

| Query | Purpose |
|---|---|
| Q1a, Q1b | Historical demand and the typical profile by weekday and shift |
| Q1c | Starter forecast: naive daily x average shift share x scenario multiplier |
| Q2, Q2b | Staffing gap against a target utilization, and a summary of where it is too high or low |
| Q3 | Labor cost by warehouse, department and week |
| Q4a, Q4b | Service performance, and service against utilization |
| Q5, Q5b | Starter recommendation by scenario, and its summary against the draft |
