# Requirements

Everything the case asks for. Sources: **README** is `team_distribution/README.md` in the data pack, and **PDF pN** is that page of the case PDF. The PDF and README take precedence over the older `.pptx` (D-01).

Status as of 2026-11-04. **Partial** usually means the analysis or engine exists, but the app, deck or final file doesn't yet. R-28 is Partial: the forecast beats the benchmark's method on held-out weeks, but only by removing holiday distortion, and the planning-week holiday days can't be tested (F-44).

## Deliverables

| ID | Requirement | Source | Covered by | Status |
|---|---|---|---|---|
| R-01 | 12-15 minute presentation covering diagnosis, forecast, recommendation and how it changes across the three scenarios | README, PDF p8 | T-60, T-65 | Not met |
| R-02 | Short demo of the proof of concept within the presentation (live or recorded, see Q-05) | README, PDF p8 | T-63, T-64 | Not met |
| R-03 | Completed `TEAM_SUBMISSION_TEMPLATE.csv`: `submitted_employees` on all 567 rows, total employees per block, 0 for closed blocks | README, PDF p8 | T-35, T-62 | Partial |
| R-04 | A working tool a warehouse leader could use: takes a scenario as input, shows staffing, labor cost and service risk | README, PDF p6, p8 | T-40, T-50, T-51 | Not met |
| R-05 | Supporting analysis shows the forecast method | README, PDF p8 | T-61 | Partial |
| R-06 | Supporting analysis shows key assumptions, clearly identifying any we added | README, PDF p7, p8 | T-61 | Partial |
| R-07 | Supporting analysis shows cost and service compared with the draft schedule | README, PDF p8 | T-34, T-61 | Partial |
| R-08 | All three scenarios are covered: BASE, PEAK and DISRUPT | README, PDF p5, p7 | T-32, T-35 | Partial |

## What the proof of concept must demonstrate

| ID | Requirement | Source | Covered by | Status |
|---|---|---|---|---|
| R-09 | Forecasts or estimates future demand | PDF p6 | T-21, T-22, T-23, T-52 | Partial |
| R-10 | Converts demand into staffing requirements | PDF p6 | T-31, T-32 | Partial |
| R-11 | Recommends schedules, staffing levels or labor coverage | PDF p6 | T-32, T-50 | Partial |
| R-12 | Balances labor cost with service-level objectives | PDF p6 | T-33, T-51 | Partial |
| R-13 | Responds to changing conditions or scenarios | PDF p6 | T-50, T-54 | Not met |
| R-14 | Explains why a recommendation was made | PDF p6 | T-41, T-53 | Not met |
| R-15 | Is more than a dashboard | PDF p6 | T-32, T-41, T-54 | Not met |

## What a warehouse leader must be able to understand

| ID | Requirement | Source | Covered by | Status |
|---|---|---|---|---|
| R-16 | When demand is expected to increase or decrease | PDF p4 | T-52 | Not met |
| R-17 | How staffing needs vary by department and time period | PDF p4 | T-50 | Not met |
| R-18 | How schedules or labor coverage should be adjusted | PDF p4 | T-41, T-50 | Not met |
| R-19 | How the recommendation affects labor costs and service levels | PDF p4 | T-51 | Not met |
| R-20 | What actions to take when demand or staffing conditions change | PDF p4 | T-42, T-54 | Not met |

## What the recommendation must show

| ID | Requirement | Source | Covered by | Status |
|---|---|---|---|---|
| R-21 | Where, when and how much labor is needed | PDF p5 | T-50 | Not met |
| R-22 | Which assumptions drive it | PDF p5 | T-53, T-61 | Partial |
| R-23 | What the leader should do when conditions shift | PDF p5 | T-42 | Not met |

## Rules the work must follow

| ID | Requirement | Source | Covered by | Status |
|---|---|---|---|---|
| R-24 | Evaluate staffing with the service measures: Front End wait 5 min, Merchandising response 60 min, Pharmacy wait 20 min | PDF p7, `docs/ASSUMPTIONS.md` section 6 | T-31, T-40 | Met |
| R-25 | Cost labor by the fixed rule using the provided rates: regular, then usable cross-trained, then overtime | README, PDF p7 | T-30 | Met |
| R-26 | Keep each block within capacity and at or above `min_staff`, or it is flagged infeasible | README | T-32, T-35 | Met |
| R-27 | Prioritize in the judging order: service first, then labor cost, then feasibility | README | T-33 | Partial |
| R-28 | Beat the naive benchmark forecast, which the case calls "a floor to beat" | `docs/ASSUMPTIONS.md` section 8 | T-21 | Partial |
| R-29 | Forecast the Valentine's Day and Presidents' Day effects ourselves | README, PDF p5 | T-22 | Met |
| R-30 | Treat the data as simulated: it is not Costco data, so don't present it as such | README, PDF p7 | T-60, T-61 | Partial |
