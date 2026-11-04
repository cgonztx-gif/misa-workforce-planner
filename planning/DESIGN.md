# Design

Status: the stack is confirmed and the project is scaffolded. So far, only the data loader, a placeholder app and basic tests are built. The choices behind this design are in `DECISIONS.md` (D-03 to D-11).

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

1. **Forecast** BASE shift demand. The floor to beat is the benchmark (F-07), which is daily and ignores holidays, promotions and weather. Its `predicted_transaction_count_proxy` is in the same units as `daily_demand_units`.
2. **Apply the scenario:** multiply by `demand_multiplier` and use that scenario's availability columns.
3. **Convert to headcount:** `hours = demand x labor_hours_per_workload_unit / target_utilization`, then `employees = ceil(hours / paid_hours)`, floored at `min_staff` when open and 0 when closed.
4. **Allocate and cost:** fill with regular staff, then usable cross-trained staff, then overtime. `cost = (regular + flex) x paid_hours x loaded_regular_hourly_cost + overtime x paid_hours x loaded_overtime_hourly_cost`. A block above capacity or below `min_staff` is infeasible.
5. **Predict service** from a curve fitted on history, where `utilization = shift_demand_units x labor_hours_per_workload_unit / worked_labor_hours`.

## Staffing search (D-06)

```text
for each scenario x warehouse x date x shift:
    for each Front End and Merchandising headcount pair from min_staff upward:
        apply the allocation rule to both departments (A-01)
        skip the pair if either department is over capacity
        calculate cost and predicted service risk
    keep the cheapest pair that meets the service goal
Pharmacy: same steps with one department and no flex
```

If no pair meets the service goal, keep the pair with the best service and flag the block, because judging puts service first (R-27). T-33 sets the exact rule.

## Service risk (D-07)

Simulate each block using forecast error (T-24), callouts (T-13) and the curve's scatter (T-31). Report the share of runs that miss the target. This is what the app shows as service risk, and what the search compares against the service goal.

## Layout

Built so far: `app.py` (placeholder), `src/data.py` and `tests/`. Each other module is added by the task that needs it.

```text
app.py               Streamlit entry point
src/data.py          Load CSVs, join them, map holiday labels
src/forecast.py      Daily regression and shift split
src/service.py       Service curve fit and prediction
src/allocation.py    Regular, flex and overtime allocation, and cost (D-10)
src/search.py        Per-shift staffing search
src/risk.py          Monte Carlo service risk
src/explain.py       Recommendation text (D-08)
src/submission.py    Export and validate the template; team_id is one constant, TEAM_NAME until Q-07
tests/               Allocation rule and submission validator first
outputs/             Generated CSV and comparison tables
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
