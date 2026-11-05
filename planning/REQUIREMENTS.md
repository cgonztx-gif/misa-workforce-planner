# Requirements

Everything the case asks for. Sources: **README** is `team_distribution/README.md` in the data pack, and **PDF pN** is that page of the case PDF. The PDF and README take precedence over the older `.pptx` (D-01).

Status as of 2026-11-05 (night), checked for T-66 against the built deliverables. **What's left is the team's:** the real team name (R-03, T-62), and the timed rehearsals, the offline rehearsal and the backup recording (R-01, R-02, R-32: T-63 to T-65). R-28 stays Partial on purpose: the forecast beats the benchmark's method on held-out weeks, but only by removing holiday distortion, and the planning-week holiday days can't be tested, so every deliverable words it as F-44 allows.

## Deliverables

| ID | Requirement | Source | Covered by | Status |
|---|---|---|---|---|
| R-01 | 12-15 minute presentation covering diagnosis, forecast, recommendation and how it changes across the three scenarios | README, PDF p8 | T-60, T-65 | Partial: the deck covers diagnosis (slide 3), forecast (4), recommendation (5-6), all three scenarios (7) and action (8), with an appendix. Timed rehearsals are left (T-65) |
| R-02 | Short demo of the proof of concept within the presentation (live or recorded, see Q-05) | README, PDF p8 | T-63, T-64 | Partial: the new app passes every browser check, including the 5-minute demo script end to end (F-74). The offline rehearsal and backup recording are left (T-63, T-64) |
| R-03 | Completed `TEAM_SUBMISSION_TEMPLATE.csv`: `submitted_employees` on all 567 rows, total employees per block, 0 for closed blocks | README, PDF p8 | T-35, T-62 | Partial: all 567 rows pass an independent rebuild (F-67). Only the placeholder team name is left (T-62) |
| R-04 | A working tool a warehouse leader could use: takes a scenario as input, shows staffing, labor cost and service risk | README, PDF p6, p8 | T-40, T-50, T-51 | Met |
| R-05 | Supporting analysis shows the forecast method | README, PDF p8 | T-61 | Met: deck A1-A2, report ch. 4, notebook §3 |
| R-06 | Supporting analysis shows key assumptions, clearly identifying any we added | README, PDF p7, p8 | T-61 | Met: deck slide 5 strip and A5, report ch. 10, app Methods page; ours are marked apart from the case's |
| R-07 | Supporting analysis shows cost and service compared with the draft schedule | README, PDF p8 | T-34, T-61 | Met: deck slides 6-7 and A6 (every scenario and department), report ch. 6, app Cost and service page |
| R-08 | All three scenarios are covered: BASE, PEAK and DISRUPT | README, PDF p5, p7 | T-32, T-35 | Met: the CSV, app, deck, report and notebook all cover BASE, PEAK and DISRUPT |

## What the proof of concept must demonstrate

| ID | Requirement | Source | Covered by | Status |
|---|---|---|---|---|
| R-09 | Forecasts or estimates future demand | PDF p6 | T-21, T-22, T-23, T-52 | Met |
| R-10 | Converts demand into staffing requirements | PDF p6 | T-31, T-32 | Met |
| R-11 | Recommends schedules, staffing levels or labor coverage | PDF p6 | T-32, T-50 | Met |
| R-12 | Balances labor cost with service-level objectives | PDF p6 | T-33, T-51 | Met |
| R-13 | Responds to changing conditions or scenarios | PDF p6 | T-50, T-54 | Met |
| R-14 | Explains why a recommendation was made | PDF p6 | T-41, T-53 | Met |
| R-15 | Is more than a dashboard | PDF p6 | T-32, T-41, T-54 | Met |

## What a warehouse leader must be able to understand

| ID | Requirement | Source | Covered by | Status |
|---|---|---|---|---|
| R-16 | When demand is expected to increase or decrease | PDF p4 | T-52 | Met |
| R-17 | How staffing needs vary by department and time period | PDF p4 | T-50 | Met |
| R-18 | How schedules or labor coverage should be adjusted | PDF p4 | T-41, T-50 | Met |
| R-19 | How the recommendation affects labor costs and service levels | PDF p4 | T-51 | Met |
| R-20 | What actions to take when demand or staffing conditions change | PDF p4 | T-42, T-54 | Met |

## What the recommendation must show

| ID | Requirement | Source | Covered by | Status |
|---|---|---|---|---|
| R-21 | Where, when and how much labor is needed | PDF p5 | T-50 | Met |
| R-22 | Which assumptions drive it | PDF p5 | T-53, T-61 | Met |
| R-23 | What the leader should do when conditions shift | PDF p5 | T-42 | Met |

## Rules the work must follow

| ID | Requirement | Source | Covered by | Status |
|---|---|---|---|---|
| R-24 | Evaluate staffing with the service measures: Front End wait 5 min, Merchandising response 60 min, Pharmacy wait 20 min | PDF p7, `docs/ASSUMPTIONS.md` section 6 | T-31, T-40 | Met |
| R-25 | Cost labor by the fixed rule using the provided rates: regular, then usable cross-trained, then overtime | README, PDF p7 | T-30 | Met |
| R-26 | Keep each block within capacity and at or above `min_staff`, or it is flagged infeasible | README | T-32, T-35 | Met |
| R-27 | Prioritize in the judging order: service first, then labor cost, then feasibility | README | T-33 | Met |
| R-28 | Beat the naive benchmark forecast, which the case calls "a floor to beat" | `docs/ASSUMPTIONS.md` section 8 | T-21 | Partial |
| R-29 | Forecast the Valentine's Day and Presidents' Day effects ourselves | README, PDF p5 | T-22 | Met |
| R-30 | Treat the data as simulated: it is not Costco data, so don't present it as such | README, PDF p7 | T-60, T-61 | Met: labeled in the app's top bar, every slide's footer, the report's cover and footers, the notebook's header and the Q&A sheet |

## What the user asked for (2026-11-05)

These come from the user, not the case, and `DELIVERABLES_PLAN.md` covers them. T-66's final check includes them.

| ID | Requirement | Source | Covered by | Status |
|---|---|---|---|---|
| R-31 | Rebuild the web tool from scratch, using the current app only as a draft: fully functional, easy to follow, comprehensive and accurate, with a professional UI that looks like a tech company's product Costco could use | User | T-80 to T-90 | Met: rebuilt in React with FastAPI (D-24), seven pages, 27 of 27 browser checks (F-74), two fresh-eyes reviews applied (T-90) |
| R-32 | The presentation fits the slot: 6-7 minutes of slides, a 5-minute live demo, and 3-4 minutes of questions, 15 minutes at most (Q-12) | User | T-93, T-65 | Partial: the main slides are timed in the notes for 6-7 minutes and the demo script for 5:00. Two timed run-throughs are left (T-65) |
| R-33 | The deck puts the project in context and explains the most important parts of the tool | User | T-93 | Met: slides 2-8 give the context and story, and slide 9 explains the tool before the demo |
| R-34 | The deck matches the tool's formatting, including its charts (D-26) | User | T-79, T-93 | Met: one set of tokens (D-26) drives the app, the deck's theme and charts, and the report's charts |
| R-35 | The Word file gives a written analysis of the whole project and how the tool works, detailed enough for someone with no context | User | T-92 | Met: a 50-page standalone report, with chapter 8 a guided tour of the tool using its final screenshots |
| R-36 | The Word file and the deck use data visualizations wherever they help | User | T-92, T-93 | Met: 26 figures and 18 tables in the report, native charts on the deck's content slides |
| R-37 | A comprehensive Jupyter notebook serves as the appendix for the analysis code | User | T-91 | Met: a 116-cell notebook that runs clean, shows the real code and rebuilds every figure in `analysis_summary.json` (T-91) |
| R-38 | The analysis is checked against every element of the case deck, and is confirmed as the best approach | User | T-73 to T-78 | Met: the coverage matrix (T-73), 8 independent checks (F-66 to F-72), the calibration study and the change it led to (D-29) |
