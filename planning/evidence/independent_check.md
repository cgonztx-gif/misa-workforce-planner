# Independent check, 2026-11-04

A separate agent recomputed the Word file's figures from the raw CSVs, writing its own scripts, which are in `independent_check/`. It worked from raw data first, then opened `plan_vs_draft.csv`, `capacity_gaps.csv`, `service_limits.csv` and the dashboard evidence to reconcile, and searched `src/` only for the definition of the Jan 20 figure. The scripts use absolute paths from this machine.

## Numbers

| Check | Word file | Independent | Result |
|---|---|---|---|
| History counts and target rates | 1,134 / 1,053; 77.9; 77.0 / 69.9 / 88.3 | Same | Match |
| Utilization bands | 100%; 62%; 0.6% | 696/696; 90/145; 1/178 | Match |
| Tables 1 and 2 | 3,184; 2,472; $103K; 1.2% | Same, all rows | Match |
| Table 3, callouts, overtime | 5.2%; 49%; $21,345 | All cells same | Match |
| Table 4 | 1.12 / 1.08 / 0.95; 1.05 / 1.05 / 0.70 | Same, also in the SQL build script | Match |
| Table 5 daily | 2.4 vs 4.1 | 2.42 vs 4.06 | Match |
| Table 5 block | 4.2 vs 5.4 | 4.19 vs 5.43 | Match |
| Table 6 | 9.6 vs 10.2 | 9.61 vs 10.21 | Match |
| Draft cost, hours, shortfall | $329,108 / $326,367; 12 blocks, 36 | Same | Match |
| Dashboard's 29 and $327,334 | Corrected | Both reproduced exactly | Match |
| Submission format | 567 rows | Keys, order, closed 0, no minimum or capacity breaches | Match |
| Plan cost, hours, Table 9, Feb 14 | $376,176 / $387,092 / $365,321 | Same | Match |
| Draft service | 69.8 / 59.1 / 67.8 | 69.7 / 59.6 / 67.8 | Plausible |
| Plan service | 95.8 / 87.4 / 89.7 | 95.4 / 87.0 / 89.3 | Plausible |
| Rebuilt BASE plan costs | $376K; $353K; $328K | About $375K; $357K; $328K | Plausible |
| BASE blocks / people short | 25 / 42 | 20 / 33 | Plausible |
| Callout allowance | $22,755 | About $19K | Model-dependent |

**Limit:** its service model shares our structure (logistic curve, about 5% demand error, half of callouts backfilled), and its rebuild reused the 5.57% demand error from `plan_vs_draft.csv`. Agreement supports the arithmetic, not the assumptions.

**Not verified:** Table 7's "if we had planned for it" columns, the calibration figures, Table 12's service column except roughly, the simulation and test claims, judges' scoring and true planning-week demand.

## Points raised, and what we did

Each was rechecked against the data before acting on it.

| Point | Rechecked | Action |
|---|---|---|
| "Our forecast beats the benchmark" overstated: the gap is all Fri-Mon | Confirmed: Fri-Mon 2.42% vs 5.08%, Tue-Thu 2.42% vs 2.69%, Tue-Wed 2.42% vs 2.45%, and normal planning days within 0.1% | Reworded the headline, status and Table 5 text. R-28 moved to Partial |
| Feb 17 shortage rests on the thin 11% Pharmacy rate | Confirmed: 3 Pharmacy blocks, and at the weekday rate only 1 stays below the goal | Added text and A-15 |
| "Feb 14 is already at capacity" | Confirmed: 10 of 18 blocks | Reworded with the count |
| "25 blocks miss our goal" easy to misread | Confirmed: average chance 84%, and 11 at 90-95% | Reworded, with a note under Table 10 |
| "Habits by warehouse, not chance" too strong | Confirmed: Warehouse 4 Merchandising evening is 234 short worked and 222 scheduled, but Warehouse 1 Merchandising evening goes from 96 to 54 | Reworded, and added an as-scheduled column to Table 2 |
| "Up to 10%, at most 2%" true only for all-department totals | **Not confirmed.** By department over weeks 2-6, these are 10.09% and 2.21%, as the Word file says. All-department totals are 5.31% and 0.66%. We could not reproduce the check's 13.9% and 3.1% | Kept the figures, and stated the grouping |
| Selective thin-sample caveat | Confirmed | Table 3's note now gives all three Pharmacy counts |
| "Within 1.2%" depends on rounding and minimum staff | Confirmed: raw need is 56,234 hours, and worked is 5.3% above it | Stated in the summary and under Table 1 |
| "80 matched" includes the 29 we correct | Confirmed | Reworded |
| About 4 fewer Front End staff per block | Depends on the comparison: 4.2 to 4.7 by our reference weekends, 4.4 to 5.1 by the check's | Now says about 4 to 5 |
| Jan 20 ran 0.1% above its week | Immaterial: 0.00% against 0.1% | Now says level with its week |
