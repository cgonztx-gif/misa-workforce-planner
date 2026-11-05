# Assumptions

Only what **we** add. The case's own assumptions (labor standards, wage rates, shift hours, scenario definitions) are in `docs/ASSUMPTIONS.md` in the data pack.

The case requires us to identify these clearly, so this list feeds the appendix (R-06). Each is Proposed until tested or confirmed.

| ID | Assumption | Basis | If it's wrong | Status | Linked |
|---|---|---|---|---|---|
| A-01 | Usable flex = the smaller of this row's `cross_trained_flex_employees` and the partner department's regular staff left over in that shift, where leftover = `max(0, partner available_regular_employees - partner submitted)` | Our reading of the README's "limited to people that department is not already using" | Plans could cost more than expected or be flagged infeasible | Proposed | Q-03, T-30, D-10 |
| A-02 | Flex sharing follows `shift_code`, even though OPEN covers different clock hours by department | README says "same shift" | Flex availability could differ in OPEN blocks | Proposed | Q-03, F-28 |
| A-03 | Plans should carry a callout buffer, based on history: about 5% of scheduled staff call out, and about half are backfilled | F-04. Q5 lists "no expected callout buffer" as a weakness | If judging ignores callouts, the buffer adds cost without scoring benefit | Confirmed by the user, 2026-11-04 | Q-02, T-13, T-33 |
| A-04 | 0.85 utilization is a ceiling, not a target. Each department gets its own limit below the cliff | F-03 | Overstaffing if too cautious, missed targets if too tight | Proposed | T-31 |
| A-05 | The MLK window is a reasonable guide to the Presidents' Day window | They are the same holiday shape, Friday to Monday (F-13) | The holiday effect is misjudged, and Valentine's Day overlaps this window | Proposed | T-22, F-27 |
| A-06 | The Valentine's Day effect is a judgment-based adjustment, shown separately and tested for sensitivity | No analog exists in history (F-27) | Saturday Feb 14 demand is misjudged | Proposed | T-22 |
| A-07 | The Jan 2-4 rebound gets its own treatment in the forecast. The Warehouse 2 flu cluster affects callouts and availability, not demand | F-34. Log demand fits with an R-squared of 0.999997 with no warehouse-by-week or flu term (F-41) | The forecast's baseline is skewed | Confirmed | T-13, T-20 |
| A-08 | Planning-week temperature and promotion fields are accepted as given | The data dictionary labels them as forecasts known at planning time. No longer needed: the forecast doesn't use them (F-41) | No effect on this version | Rejected | T-20 |
| A-09 | The historical service curve applies to the planning week | The case's docs say to estimate it from history | Service risk is misjudged, especially at utilization levels rarely seen | Proposed | T-31 |
| A-10 | Borrowed flex staff are costed at the regular rate of the department they cover | `docs/ASSUMPTIONS.md` section 5 and query Q5 use the block's own rate | Small cost differences | Proposed | Q-03, T-30 |
| A-11 | Borrowing a holiday effect adds forecast uncertainty on Feb 13-16: a standard deviation of 2% for Front End and Merchandising, 5% for Pharmacy | The gap between the only two comparable windows: 1.10 vs 1.12, 1.06 vs 1.08 and 0.90 vs 0.95 (F-45) | Holiday-week headroom is too small or too large | Proposed | T-22, T-40 |
| A-12 | DISRUPT's illness cluster has January's flu-week callout rates (Front End 12.3%, Pharmacy 10.7%), on top of the availability cuts | Both appeared together in January (F-43). The docs describe only the availability cut | DISRUPT plans at Warehouse 2 are over- or under-buffered | Proposed | T-13, T-40 |
| A-13 | The service goal is a 95% chance of meeting target in each block | Judging puts service first (R-27), and cost per point of service climbs quickly above this (F-49) | Cost and service move along the trade-off | Confirmed by the user, 2026-11-04 | T-33 |
| A-14 | A future week's demand level matches the average of the last four weeks | Slightly better than all weeks in the backtest (F-44). Weekly levels have run from 0.95 to 1.06 with no trend | All forecasts shift together | Proposed | T-21 |
| A-15 | Callout rates by situation are used as measured, even where few people stand behind them (Pharmacy: 9 of 82 the day after a holiday, 8 of 132 on weekends, 9 of 84 in flu week) | F-43. Simple and traceable, with no pooling | A few Pharmacy blocks are over- or under-buffered, most visibly on Feb 17 (F-50) | Proposed | T-13, T-40 |
