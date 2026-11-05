# Design

Status: the analysis engine and first submission CSV are built. The app is still a placeholder, and explanations aren't built yet. The choices behind this design are in `DECISIONS.md` (D-03 to D-11 and D-17 to D-21).

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
5. **Predict service** from a curve fitted on history, where `utilization = shift_demand_units x labor_hours_per_workload_unit / worked_labor_hours`. Per department: `log(metric / target) = min(cap, level[warehouse] + slope x u + extra_slope x max(0, u - knot))`, with normal scatter around it.

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

Built so far: everything below except `src/explain.py`. `app.py` is still a placeholder.

```text
app.py               Streamlit entry point
src/data.py          Load CSVs, join them, map holiday labels
src/diagnosis.py     Staffing gaps, callouts, and the rebuilt dashboard figures
src/forecast.py      Daily regression and shift split
src/service.py       Service curve fit and prediction
src/allocation.py    Regular, flex and overtime allocation, and cost (D-10)
src/search.py        Per-shift staffing search
src/risk.py          Service risk: exact calculation and Monte Carlo check
src/explain.py       Recommendation text (D-08)
src/submission.py    Export and validate the template; team_id is one constant, TEAM_NAME until Q-07
src/pipeline.py      Runs everything and writes outputs/
src/charts.py        Charts for the Word file
scripts/             Builds the Word file (Node, D-20)
tests/               Unit and integration tests
outputs/             Generated CSVs, charts and analysis_summary.json
deliverables/        Costco_Case_Analysis.docx, for the team
```

## App views

| View | Shows | Requirements |
|---|---|---|
| Scenario input | Scenario selector and what-if control | R-04, R-13 |
| Staffing | Recommended headcount by warehouse, department, day and shift, against the draft | R-11, R-17, R-18, R-21 |
| Cost and service | Labor cost and service risk against the draft | R-04, R-12, R-19 |
| Demand | When demand rises or falls, and why | R-09, R-16 |
| Why | Reason and assumptions for each change | R-14, R-22 |
| Playbook | What to do when conditions shift | R-20, R-23 |

## Commands

```bash
# Extract the data pack (already done on this machine)
unzip -o MISA.zip -d . && unzip -o "MISA/Student Teams/Costco_Case_Competition_TEAMS.zip" -d data

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

The start command reads `.streamlit/config.toml`, which runs headless, binds to `localhost` and turns off usage stats. It was tested with the placeholder app (F-37).

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
