# Assumptions

Only what **we** add. The case's own assumptions (labor standards, wage rates, shift hours, scenario definitions) are in `docs/ASSUMPTIONS.md` in the data pack.

The case requires us to identify these clearly, so this list feeds the appendix (R-06). All are Proposed until tested or confirmed.

| ID | Assumption | Basis | If it's wrong | Status | Linked |
|---|---|---|---|---|---|
| A-01 | Usable flex = the smaller of this row's `cross_trained_flex_employees` and the partner department's regular staff left over in that shift, where leftover = `max(0, partner available_regular_employees - partner submitted)` | Our reading of the README's "limited to people that department is not already using" | Plans could cost more than expected or be flagged infeasible | Proposed | Q-03, T-30, D-10 |
| A-02 | Flex sharing follows `shift_code`, even though OPEN covers different clock hours by department | README says "same shift" | Flex availability could differ in OPEN blocks | Proposed | Q-03, F-28 |
| A-03 | Plans should carry a callout buffer, based on history: about 5% of scheduled staff call out, and about half are backfilled | F-04. Q5 lists "no expected callout buffer" as a weakness | If judging ignores callouts, the buffer adds cost without scoring benefit | Proposed | Q-02, T-13, T-33 |
| A-04 | 0.85 utilization is a ceiling, not a target. Each department gets its own limit below the cliff | F-03 | Overstaffing if too cautious, missed targets if too tight | Proposed | T-31 |
| A-05 | The MLK window is a reasonable guide to the Presidents' Day window | They are the same holiday shape, Friday to Monday (F-13) | The holiday effect is misjudged, and Valentine's Day overlaps this window | Proposed | T-22, F-27 |
| A-06 | The Valentine's Day effect is a judgment-based adjustment, shown separately and tested for sensitivity | No analog exists in history (F-27) | Saturday Feb 14 demand is misjudged | Proposed | T-22 |
| A-07 | The Jan 2-4 rebound gets its own treatment in the forecast. The Warehouse 2 flu cluster affects callouts and availability, not demand | F-34. The effect on demand still needs checking | The forecast's baseline is skewed | Proposed | T-13, T-20 |
| A-08 | Planning-week temperature and promotion fields are accepted as given | The data dictionary labels them as forecasts known at planning time | The forecast inherits any error in them | Proposed | T-20 |
| A-09 | The historical service curve applies to the planning week | The case's docs say to estimate it from history | Service risk is misjudged, especially at utilization levels rarely seen | Proposed | T-31 |
| A-10 | Borrowed flex staff are costed at the regular rate of the department they cover | `docs/ASSUMPTIONS.md` section 5 and query Q5 use the block's own rate | Small cost differences | Proposed | Q-03, T-30 |
