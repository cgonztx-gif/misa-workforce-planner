# Findings

Verified facts, with what to do about each. **Measured** findings (F-01 to F-20) reproduce with `evidence/verify_findings.py`; the section codes in its saved output match these IDs. **Docs** findings cite the data pack. F-21 to F-25 and F-36 to F-38 come from checks on this machine. F-39 to F-53 reproduce with `python -m src.pipeline`, whose results are in `outputs/`. F-54 records an independent check of them. F-55 reproduces with the pipeline too, and F-56 comes from driving the app in Chrome.

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
- **F-09: The draft is above capacity in 12 DISRUPT blocks (measured).** 7 at Warehouse 2 Front End, 4 at Warehouse 2 Pharmacy, and Warehouse 4 Merchandising OPEN on Feb 13. It has none in BASE or PEAK, and is never below `min_staff`. That is 29 people short at raw capacity, and 36 under the allocation rule (F-42).
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

## Diagnosis (as of 2026-11-04)

- **F-39: Hours are about right in total but in the wrong places (T-11, T-12).** Worked hours were 59,198 against 58,486 needed at 85% utilization, within 1.2%. That need is in whole people and above minimum staff. Before rounding, need is 56,234 hours, and worked hours are 5.3% above it. But 3,184 hours sat above need, worth $103,458 at loaded regular rates, and 2,472 were missing elsewhere. By department, blocks missing target: Front End 85, Merchandising 111, Pharmacy 37. Largest gaps: Warehouse 4 Merchandising weekday opening (702 hours over, 67% utilization) and weekday evening (234 short as worked and 222 as scheduled, 92%, 28% met), and Warehouse 2 Front End weekends (Sunday midday at 103%, 0% met). Some gaps are partly callouts: Warehouse 1 Merchandising weekday evening is 96 short as worked and 54 as scheduled. By department over weeks 2-6, weekly demand moved by up to 10%, scheduled hours by at most 2%. Ranked table: `outputs/diagnosis_staffing_gaps.csv`. *Use:* moving hours comes before adding them.
- **F-40: The Nov 2 dashboard holds up, with corrections (reproduce with `planning/evidence/reconcile_dashboard.py`).** Of its 97 headline figures, 85 are calculated, and 80 match within 0.15%. Of the other 5, three correlation figures and one noise figure can't be reproduced because their definitions aren't recorded, and none is relied on; the fifth is the correction in F-42. The remaining 12 are inputs and settings. Its tables for hours, service bands, holiday factors, callouts, raw capacity and the trade-off simulation also match. *Use:* the dashboard's analysis can be trusted except as noted here and in F-42 and F-46.
- **F-41: Demand is warehouse x weekday x holiday x weekly level.** R-squared on log daily demand: 0.977 for warehouse and weekday, 0.995 with holidays, 0.999997 with weekly level. Temperature and promotions add nothing once the weekday is known (correlations of -0.006 and -0.017), and Front End's raw -0.57 with temperature is a calendar artifact. Jan 20, flagged like Feb 17 as a post-holiday rebound, ran just 0.1% above its own week. *Use:* leave those features and the rebound flag out of the forecast, which also supports dropping T-25.
- **F-42: Correction: the draft is 36 people short in DISRUPT, not 29.** Same 12 blocks. Limiting flex to what the partner can spare (A-01) takes Warehouse 2 Front End's shortfall from 22 to 29, with Warehouse 2 Pharmacy at 5 and Warehouse 4 Merchandising at 2. The draft's DISRUPT cost is $326,367. The dashboard's $327,334 comes from fielding staff up to raw capacity and letting overtime run past its limit, which reproduces its figure exactly. Its mean utilization differs for the same reason, only on DISRUPT Front End on Feb 14-15.
- **F-43: Callout rates (T-13).** With the flu cluster separated, by weekday, weekend and day after a holiday: Front End 5.0%, 6.4%, 8.0%; Merchandising 3.4%, 5.5%, 4.0%; Pharmacy 2.9%, 6.1%, 11.0%. Flu week: Front End 12.3%, Pharmacy 10.7%. Day-after-holiday rates rest on two days, and Pharmacy's on 82 scheduled employees. Backfill is 49.2% overall, and 0% once overtime is used up. Table: `outputs/diagnosis_callout_rates.csv`.

## Forecast results (as of 2026-11-04)

- **F-44: The forecast beats the benchmark on held-out weeks (T-21, T-24, R-28).** Mean absolute percentage error on weeks 4-6, each from earlier weeks only. Daily: 2.4% against 4.1%. By week: 1.6% vs 4.8%, 4.2% vs 5.5%, 1.4% vs 1.8%. By block: 4.2% against 5.4%. The last four weeks' level beats all weeks slightly (2.42% vs 2.58%). Held-out log error per block, used for risk: Front End 5.6%, Merchandising 5.3%, Pharmacy 4.5%. **Limit:** these weeks hold no holidays, and three folds is few. The edge also comes entirely from Fri-Mon, where the benchmark's average held earlier holiday days: 2.42% vs 5.08%, against 2.42% vs 2.69% on Tue-Thu and 2.42% vs 2.45% on Tue-Wed. In the planning week, the two match within 0.1% on normal days. *Use:* say that the forecast removes holiday distortion, not that it beats the benchmark in the planning week.
- **F-45: Holiday effects are measured exactly, but borrowing them is unproven (T-22, T-23).** With weekly level in the model, factors match the build script (`sql/02_Load_Core_Data.sql`): Fri-Sun before the holiday 1.12, 1.08, 0.95; holiday Monday 1.05, 1.05, 0.70; New Year rebound 1.10, 1.06, 0.90 (Front End, Merchandising, Pharmacy). Forecasting the MLK weekend from weeks 1-2 with the New Year effect gave 9.6% error against the benchmark's 10.2%: better for Front End (8.2 vs 12.4) and Merchandising (8.7 vs 11.3), worse for Pharmacy (11.9 vs 7.0). On the shift split, holiday shares for Front End only do best when leaving one week out (3.2% error, and 4.2% vs 5.6% on Front End holiday days), which confirms F-31. *Use:* A-05 and A-11 stay assumptions.

## Service and risk (as of 2026-11-04)

- **F-46: Service limits by warehouse (T-31, A-09).** Utilization for a 95% chance of meeting target, Warehouses 1, 2, 4: Front End 0.861, 0.832, 0.851; Merchandising 0.862, 0.877, 0.844; Pharmacy 0.852, 0.843, 0.844. Fitted on log(metric / target) with a kink and a cap. Leaving one week out, the Brier score is 0.026 against 0.177 for the average rate. Predicted chances track outcomes, though they run slightly high near the goal: 97.3% predicted against 94.3% observed in the 95-99% group, and 80.9% against 68.4% in the 70-90% group. **Correction:** the dashboard's 0.908 for Warehouse 1 Pharmacy rests on 6 blocks between 0.85 and 0.95, so don't quote it. Our largest other gap from the dashboard is Warehouse 4 Merchandising, 0.844 vs 0.866. Table: `outputs/service_limits.csv`.
- **F-47: The risk calculation agrees with simulation, after a fix (T-40, D-18).** A 21-point integration rule was 0.7 points off a 200,000-draw simulation, because the curve is steep near the cliff. A fine 181-point grid agrees to within 0.5 points in `tests/test_service_and_risk.py`.

## The first plan (as of 2026-11-04)

Expected service below means the average chance of meeting target across open blocks, from our risk model. It is a prediction, not a measured result.

- **F-48: Plan against the draft (T-32, T-34, T-35).**

  | | BASE | PEAK | DISRUPT |
  |---|---|---|---|
  | Draft cost | $329,108 | $329,108 | $326,367 |
  | Plan cost | $376,176 | $387,092 | $365,321 |
  | Change | +14.3% | +17.6% | +11.9% |
  | Draft hours | 10,344 | 10,344 | 10,206.5 |
  | Plan hours | 11,618 | 11,897.5 | 11,248.5 |
  | Draft expected service | 69.8% | 59.1% | 67.8% |
  | Plan expected service | 95.8% | 87.4% | 89.7% |
  | Draft blocks above capacity | 0 | 0 | 12 |
  | Plan blocks above capacity | 0 | 0 | 0 |
  | Plan blocks below the 95% goal | 25 | 44 | 39 |

  The filled template is `outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv`, and it passes the validator with the placeholder team name. Block by block: `outputs/plan_vs_draft.csv`.
- **F-49: Service goal trade-off in BASE (T-33, A-13).** Goal, cost, expected service: 85%, $354,040, 91.0%; 90%, $362,576, 93.6%; 92.5%, $368,103, 94.7%; 95%, $376,176, 95.8%; 97.5%, $386,599, 96.6%; 99%, $397,649, 97.0%. Each extra point costs more than the last: about $3,300 from 85% to 90%, $7,300 from 92.5% to 95%, and $27,600 from 97.5% to 99%. Full table: `outputs/goal_tradeoff.csv`.
- **F-50: Capacity runs out on the holiday weekend, above all Feb 14.** Blocks below the goal already use all their own regular staff and overtime, and a test enforces this. People short of need, BASE, PEAK, DISRUPT: total 42, 187, 197; Feb 14 alone 24, 112, 78. In BASE, 22 of the 25 short blocks fall on Feb 13-16, with 11 on Feb 14. Their average chance is 84%, and 11 sit at 90-95%, so being short of the goal doesn't mean expected failure. On Feb 14, 10 of 18 Front End and Merchandising blocks are at capacity. The other 3 short blocks are Pharmacy on Feb 17, which rest on the thin 11% rate: at the weekday rate, only 1 stays short (A-15). Front End regular staff is down about 4 to 5 per block on Feb 14-15 against recent weekends. Table: `outputs/capacity_gaps.csv`. *Use:* this is an availability problem for the playbook (T-42), such as limiting PTO approvals, since rearranging the schedule can't solve it.
- **F-51: What the allowance for risk costs (Q-02, A-03).** In BASE, by plan: cost, then expected service with both risks, with forecast error only, and with neither.

  | Plan allows for | Cost | Both | Forecast error only | Neither |
  |---|---|---|---|---|
  | Both risks (recommended) | $376,176 | 95.8% | 99.6% | 100% |
  | Forecast error only | $353,421 | 90.7% | 98.4% | 100% |
  | Neither | $328,201 | 75.2% | 87.6% | 99.3% |
  | Current draft | $329,108 | 69.8% | 78.1% | 81.1% |

  *Use:* moving hours alone, at about the draft's cost, beats the draft under every condition. The callout allowance costs $22,755, and the user chose to keep it (A-03). Q-02 would show whether it's needed.
- **F-52: Valentine's Day sensitivity (T-22, A-06).** BASE, Front End and Merchandising on Feb 14. If the true uplift is 0%, 3%, 5% or 10%, our plan's expected service is 91.8%, 86.5%, 81.9% or 66.6%. Having planned for that uplift would give 90.9%, 86.5%, 82.3% or 68.3%, at $57,464, $58,908, $59,960 or $60,459. *Use:* planning for more barely helps because 10 of those 18 blocks are at capacity, so the choice of 3% matters little (R-29).
- **F-53: Two search failures, found by checking results and now fixed (T-32, D-17).** First, blocks that couldn't reach the goal fell back to minimum staff, because extra staff don't change a saturated block's chance of meeting target. This made PEAK's hours lower than BASE's. Second, the search cut overloaded departments to lend staff (D-17). Tests now cover both.

## Independent check (as of 2026-11-04)

- **F-54: A separate recomputation found no numeric errors in the tables, but did find overstated wording (`evidence/independent_check.md`).** Every table it could recompute from the raw CSVs matched, and its model-based results were close (BASE plan service 95.4% against 95.8%). Its service model shares our structure, so that supports the arithmetic, not the assumptions. Of its 9 main points, we reproduced 8 and fixed the wording. We didn't reproduce the point about weekly swings, because the Word file's 10% and 2% are correct by department. The most important fix is that we no longer claim the forecast beats the benchmark in the planning week (F-44). *Use:* quote these figures with the limits stated.

## Playbook and app (as of 2026-11-04)

- **F-55: Limiting holiday PTO is the strongest move found (T-42, A-16).** PTO takes about 4 Front End and 3 Merchandising people per block out of Feb 14-15 against the last three normal weeks. Rerunning the BASE search with up to N of them kept per block, capped at what each block lost, gives (N, employee shifts kept, blocks below goal, expected service, cost, overtime hours): 0, 0, 25, 95.8%, $376,176, 958; 1, 62, 16, 96.8%, $374,675, 763; 2, 115, 10, 97.1%, $373,711, 616; 3, 150, 7, 97.2%, $372,032, 494; 4, 171, 6, 97.2%, $371,425, 430; 5, 179, 6, 97.2%, $371,186, 404. Cost falls because regular staff replace overtime. At N = 5, the 6 blocks still below the goal are all on Feb 13 and Feb 17, which holiday PTO doesn't touch. Table: `outputs/pto_what_if.csv`. *Use:* this is the headline recommendation for a warehouse leader. It relies on some PTO still being open to change, which the data doesn't show.
- **F-56: The app works in Chrome and is fast enough to demo (T-50 to T-55).** Driven with Playwright in headless Chrome against `python -m streamlit run app.py`. Over two runs: first page load 14.5 to 15 seconds, tabs under 1 second, scenario switches under 1 second, and a what-if 2.4 to 5 seconds. No exceptions or console errors, and no requests off this machine. This caught problems `AppTest` can't see, all fixed: dollar signs rendering as math, a Playbook tab blank during its first calculation, a color scale drifting through purple, cut-off text, and a warning that shifted the tabs. **Not tested:** a person using it with Wi-Fi off (T-63), and hover tooltips. *Use:* open the app once before presenting, so the cold start doesn't happen in front of judges.

