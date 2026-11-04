# Findings

Verified facts, with what to do about each. **Measured** findings (F-01 to F-20) reproduce with `evidence/verify_findings.py`; the section codes in its saved output match these IDs. **Docs** findings cite the data pack. F-21 to F-25 and F-36 to F-38 come from checks on this machine.

## Sources

- **F-01: The `.pptx` is out of date (measured).** It has 7 slides, was last modified Oct 27, and says "at least one changed-condition scenario". The PDF has 8 pages, a zip date of Oct 30, and a submission page, and it and the README require all three scenarios. *Use:* follow the PDF and README (D-01).
- **F-29: The sources differ on the demo (docs).** The README says "short live demo", and the PDF says live or recorded. *Use:* ask (Q-05), and prepare both.
- **F-33: The scorer is not provided (docs).** The README says plans are evaluated on service first, then labor cost, then feasibility. *Use:* treat any scoring detail beyond that as an assumption.

## Data reliability

- **F-02: Row counts and keys are consistent (measured).** History has 1,134 rows, the planning grid 567, the template 567, the benchmark 63, availability 1,701 and schedules 1,323. Template keys match the grid exactly, and so do its draft values.
- **F-05: `labor_cost` follows the documented formula (measured).** The maximum error across all history is 0.
- **F-06: Shift demand sums exactly to daily demand (measured).** There are 378 daily rows, 369 of them open.
- **F-07: The benchmark is what the docs say (measured).** All 63 rows equal the same-weekday mean of weeks 3-6, within 0.0001, in the same units as `daily_demand_units`. It is daily, so it must be split to shifts.

## Service

- **F-03: Service falls off a cliff near 0.85-0.90 utilization, in every department (measured).**

  | Utilization | Front End met target | Merchandising | Pharmacy |
  |---|---|---|---|
  | Below 0.85 | 99.6% | 100% | 100% |
  | 0.85 - 0.90 | 59.6% | 63.1% | 64.3% |
  | 0.90 and above | 0% | 1.1% | 0% |
  | All blocks | 77.0% | 69.9% | 88.3% |

  *Use:* the starter queries' target of 0.85 (F-17) sits at the edge of the cliff, with no margin for callouts or forecast error. The saved output has finer bands and average metric values.
- **F-04: Scheduled is not worked (measured).** Callouts were 5.17% of scheduled staff and 49.2% were backfilled, and service history depends on worked staff. The docs don't say whether judging applies callouts to submitted totals (Q-02). *Use:* treat any buffer as a stated assumption (A-03).

## Staffing

- **F-26: Don't learn staffing levels from `scheduled_employees` (docs).** `docs/ASSUMPTIONS.md` section 3 says historical schedules follow manager habits, and some blocks are systematically over- or under-staffed. The draft rolls that pattern forward. *Use:* derive staffing from demand and the service curve.
- **F-28: Cross-trained staff are shared and limited (docs).** Each one used is one fewer for the partner department in that shift, so Front End and Merchandising must be solved together. Pharmacy has none. The usable-flex formula isn't published (Q-03). Starter query Q5 ignores this sharing. OPEN also covers different clock hours by department: on weekdays, Merchandising 04:00-10:00 and Front End 09:00-13:00.
- **F-18: Flex pools are small (measured).** Per block in the planning grid: Front End 0-2, Merchandising 0-4, Pharmacy 0.
- **F-11: `min_staff` is always reachable without flex (measured).** No open block in any scenario has regular plus overtime below it.
- **F-20: Paid hours vary from 2.5 to 6 per block (measured).** *Use:* headcount isn't comparable across blocks, so compare hours, utilization or cost.
- **F-30: Demand units are department-specific (docs).** *Use:* never compare raw units across departments.
- **F-17: Starter query Q5 declares its own weaknesses (measured).** Naive forecast, one target utilization for all departments, no callout buffer, and flex borrowed without reducing the other department. Its default utilization is 0.85. *Use:* don't copy it unchanged.

## Scenarios

- **F-08: DISRUPT cuts more than the docs describe (measured).** Beyond the listed cuts, partner flex also falls: Warehouse 2 Merchandising on Feb 13-16, and Warehouse 4 Front End OPEN on Feb 12-13. *Use:* read availability per scenario from the grid and never hardcode the described cuts. The saved output lists all 36 changed blocks.
- **F-09: The draft is above capacity in 12 DISRUPT blocks (measured).** 7 at Warehouse 2 Front End, 4 at Warehouse 2 Pharmacy, and Warehouse 4 Merchandising OPEN on Feb 13. It has none in BASE or PEAK, and is never below `min_staff`.
- **F-10: PEAK changes demand only (measured).** Availability matches BASE exactly. Multipliers on Feb 13-14 are 1.10-1.25 at Warehouses 1 and 2, 1.15-1.30 at Warehouse 4, and 1.05 for Pharmacy. On Feb 15, Front End and Merchandising are 1.06.
- **F-19: The draft is identical in all three scenarios (measured).** 10,344 labor hours in each.
- **F-32: Holiday-weekend PTO reduces availability on Feb 14-16 (docs).** This is already in the BASE availability figures.

## Forecasting

- **F-12: History and planning columns differ (measured).** `promotion_index`, `is_pre_holiday_stockup`, `is_post_holiday_rebound` and `holiday_name` appear only in the planning grid. *Use:* build features both periods share.
- **F-13: Holiday labels differ between periods (measured).** History uses `Pre_MLK_Weekend` and `MLK_Holiday`, and planning uses `Pre_Presidents_Day_Weekend` and `Presidents_Day_Holiday`. *Use:* map them to shared categories, or a model won't carry the effect across.
- **F-27: Holiday evidence is thin (derived from F-13).** MLK (Jan 16-19) is the only analog for Presidents' Day, and Valentine's Day has none.
- **F-14: Closed blocks must be excluded when fitting (measured).** History has 81 closed blocks (New Year's Day and Pharmacy closures), with zero demand and a NULL metric.
- **F-34: Two periods in history need special handling (measured and docs).** Jan 2-4 is labeled a post-New-Year rebound, and `docs/ASSUMPTIONS.md` describes a flu callout cluster at Warehouse 2 in late January.
- **F-31: Front End demand shifts toward midday on holiday-window days (docs).** *Use:* a plain average shift share will misplace it (T-23).
- **F-16: Daily core features exist only in the SQL scripts (measured).** No CSV has `traffic_index`, `markdown1` or `fuel_price`, and only the planning grid has `promotion_index`. History rows are in `02_Load_Core_Data.sql` and planning rows in `04_Load_Shift_Planning_Data.sql`. The database is named `LaunchProject`. Both views do have `has_promotion`, `temperature` and `holiday_window_role`.

## Submission

- **F-15: Template details (measured).** Rows sort alphabetically by shift (EVE, MID, OPEN), so join on `scenario_id, store_id, dept_id, day_date, shift_code` and never by row position. `team_id` holds the placeholder `TEAM_NAME`, and `submitted_employees` is empty on every row. Enter total employees only.
- **F-35: 27 template rows are closed blocks (measured under F-14).** Saturday EVE, Sunday EVE and Sunday OPEN for Pharmacy. Enter 0.

## Environment (as of 2026-11-03)

- **F-21: Installed tools (measured by `evidence/smoke_test.py`).** Python 3.13.14, Streamlit 1.56.0, pandas 3.0.1, Altair 6.0.0, NumPy, SciPy and openpyxl. Not installed at that check: scikit-learn, statsmodels, pytest, PuLP, OR-Tools, Plotly, pyodbc. `statsmodels` and `pytest` have since been installed (F-36).
- **F-22: A locally hosted Streamlit app works here (measured by `evidence/smoke_test.py`).**
  - The server was healthy after 6-8 seconds, bound to `localhost`.
  - The first page run took under 1 second, and each scenario switch took under 0.1 seconds, with no errors. That was for simple calculations only, without browser drawing.
  - It correctly showed 12 over-capacity blocks in DISRUPT and 0 in the others.
  - The page loads nothing from outside the laptop; its only URL is a license reference.
  - **Not tested:** a real browser, Wi-Fi off, and the real calculations (T-55, T-63).
- **F-23: `statsmodels` can install here.** Version 0.15.0 has a Python 3.13 Windows build. This was first checked with `pip download`, and it has since been installed (F-36).
- **F-24: `python -I` hides installed packages.** It wrongly reported pandas and Streamlit as missing on 2026-11-02. *Use:* check packages with plain `python`.
- **F-25: `sqlcmd` and `sqllocaldb` are not on PATH, but Docker Desktop is.** Checked with `which`, which doesn't rule out SQL Server or SSMS being installed elsewhere.
- **F-36: The confirmed stack is installed and works together.** Versions are pinned in `requirements.txt`: statsmodels 0.15.0, pytest 9.2.0, NumPy 2.4.2 and SciPy 1.17.1, alongside the versions in F-21. A statsmodels regression on log daily demand ran successfully with pandas 3.0.1 on all 369 open daily rows. That was a compatibility check, not a forecast result.
- **F-37: The scaffold runs (reproduce with `python -m pytest`).** All 7 tests pass, covering row counts, template keys, closed rows, over-capacity blocks and scenario switching. One deprecation warning comes from a third-party plugin (anyio), not our code. `python -m streamlit run app.py` was healthy after 1.6 seconds on `http://localhost:8501`. **Not tested:** a real browser or Wi-Fi off (T-63).
- **F-38: The tracked files are enough to run the project (reproduce with `git clone`, the extraction command in `CLAUDE.md`, then `python -m pytest`).** On 2026-11-04, a copy of only the tracked files extracted the data and passed all 7 tests. It used this machine's installed packages, so it doesn't test a clean environment (T-56). Git's warnings about LF becoming CRLF when staging are expected on this machine, and the tests passed on that converted copy.
