# Workforce Planner API

The API behind the React app (D-24, section 7.3 of `planning/DELIVERABLES_PLAN.md`). It wraps the engine in `src/` and doesn't change it. All data is simulated and isn't Costco data.

Start it with `python -m server` (port 8501, opens the browser once ready), `python -m server --port 8601 --no-browser`, or `start_app.bat`. It serves on 127.0.0.1 only. The OpenAPI schema is at `/api/openapi.json`. There's no Swagger page, because it would load from a CDN and the app must work offline.

## Conventions

- **JSON only, strict.** No NaN or Infinity. Missing values are `null`. Floats are rounded to 6 decimals, and whole numbers come back as integers (`4`, not `4.0`).
- **Dates** are ISO strings (`"2026-02-14"`). Labels come ready to show: `day` is `"Sat Feb 14"`, `day_short` is `"Sat 14"`.
- **Block key** is `scenario|store|dept|date|shift`, for example `"BASE|1|38|2026-02-13|MID"`.
- **Ids:** warehouses `1`, `2`, `4`. Departments `38` Front End, `92` Merchandising, `95` Pharmacy. Shifts `OPEN`, `MID`, `EVE`.
- **Shares and chances are fractions** (`0.957696` means 95.8%). Money is dollars, and hours are paid hours.
- **Defaults are the submitted plan.** `/api/plan` always shows the plan in `outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv`. Only `/api/what-if` shows anything else, and it labels itself.
- **Warehouse filter:** totals come pre-computed for `"all"`, `"1"`, `"2"` and `"4"`, so the front end only picks a key.

### Status codes

| Code | When | Body |
|---|---|---|
| 200 | OK | The payload |
| 422 | A bad parameter | `{"error": "goal: must be one of 0.9, 0.925, 0.95, 0.975", "detail": [{"loc": ["query", "goal"], "msg": "...", "type": "..."}]}` |
| 503 | Still preparing, or startup failed | `{"error": "<message to show>", "ready": false, "seconds": null, "status": "preparing" or "error", "step": "...", "elapsed": 3.2}`, with a `Retry-After: 2` header |
| 404 | Unknown `/api/...` path | `{"error": "No such endpoint: /api/x. See server/API.md."}` |

While the server is preparing (15-20 seconds), every data endpoint returns 503. Poll `/api/health` every half second or so and move on once `ready` is true. If `status` is `"error"`, show `error`: it says what to run (for example, the commands that extract the data pack).

### Timings (measured 2026-11-05 on the team laptop, with other agents running, before and after D-29)

| What | Time |
|---|---|
| Ready after start | 11.7-17.5 s (budget 30 s) |
| `/api/plan` (500 KB, gzipped on the wire) | 13-19 ms |
| Other cached endpoints | 2-4 ms |
| `/api/what-if`, new settings | 2.4-5.6 s (budget 8 s) |
| `/api/what-if`, same settings again | 15-20 ms |

---

## GET /api/health

Never returns 503. `seconds` is how long preparing took, and it's `null` until ready.

```json
{"ready": true, "seconds": 14.599469, "error": null, "status": "ready", "step": "Ready", "elapsed": 14.599469}
```

While preparing: `{"ready": false, "seconds": null, "error": null, "status": "preparing", "step": "Planning PEAK", "elapsed": 6.1}`. `status` is `"preparing"`, `"ready"` or `"error"`.

## GET /api/meta

Everything the shell needs: labels, defaults, what-if limits, glossary and assumptions. It's ready about 2 seconds after start, before the scenarios are.

```json
{
 "product": "Workforce Planner",
 "notice": "All data is simulated for the Texas MISA case competition. It is not Costco data and does not represent Costco wages, staffing levels, schedules or service performance.",
 "week": {"start": "2026-02-12", "end": "2026-02-18", "label": "Thu Feb 12 to Wed Feb 18, 2026"},
 "scenarios": [{"code": "BASE", "name": "Baseline planning week", "description": "Expected conditions for the week, including Valentine's Day and Presidents' Day."}, "... PEAK, DISRUPT"],
 "warehouses": [{"id": 1, "label": "Warehouse 1", "size": "Medium", "name": "Warehouse 1 (Medium)"}, "... 2, 4"],
 "departments": [{"id": 38, "name": "Front End", "service_target": "Checkout wait of 5 minutes or less", "metric": "Checkout wait", "target_value": 5, "target_unit": "minutes", "demand_unit": "Checkout workload units"}, "... 92, 95"],
 "shifts": [{"code": "OPEN", "name": "Opening"}, {"code": "MID", "name": "Midday"}, {"code": "EVE", "name": "Evening"}],
 "days": [{"date": "2026-02-14", "label": "Sat Feb 14", "short": "Sat 14", "weekday": "Saturday", "holiday": "Valentine's Day", "holiday_window": true, "day_type": "Saturday"}, "... 7 days"],
 "defaults": {"goal": 0.95, "callouts": 1, "demand": 0, "availability": 0},
 "what_if_limits": {
  "goal": {"allowed": [0.9, 0.925, 0.95, 0.975], "label": "Service goal", "help": "..."},
  "callouts": {"min": 0, "max": 2, "step": 0.25, "label": "Callouts, as a multiple of history", "help": "1.0 is the historical rate. 2.0 doubles it."},
  "demand": {"min": -0.1, "max": 0.15, "step": 0.01, "label": "Demand against forecast", "help": "..."},
  "availability": {"min": -0.3, "max": 0, "step": 0.05, "label": "Regular staff available", "help": "..."}
 },
 "glossary": [{"term": "Block", "definition": "One warehouse, department, day and shift."}, "... 12 terms"],
 "assumptions": [
  {"id": "A-01", "text": "Usable cross-trained staff is limited to what the partner department has left after filling its own total from regular staff.", "source": "ours", "detail": "<the full wording in planning/ASSUMPTIONS.md>", "basis": "...", "status": "Proposed"},
  {"id": "C-09", "text": "The benchmark forecast is the average of the same weekday in weeks 3-6. It ignores holidays, promotions and weather.", "source": "case", "detail": null, "basis": "Data pack, docs/ASSUMPTIONS.md", "status": "Given by the case"}
 ]
}
```

- `days[].holiday` is a name or `null`. Feb 13-16 is the Presidents' Day window (`holiday_window: true`), and Feb 14 is also Valentine's Day.
- `assumptions`: ours (`A-..`, from `planning/ASSUMPTIONS.md`, rejected ones left out) are listed first, then the case's (`C-..`). `text` is the short wording that blocks cite.

## GET /api/plan?scenario=BASE

`scenario` is `BASE` (the default), `PEAK` or `DISRUPT`, in any case. It returns all 189 blocks for that scenario, closed ones included, plus the totals. With default settings this is the submitted plan, and a test checks all 567 rows against the CSV.

```json
{"scenario": "BASE", "goal": 0.95, "blocks": ["... 189"], "totals": {"all": {}, "1": {}, "2": {}, "4": {}}}
```

### A block

```json
{
 "key": "BASE|1|38|2026-02-13|MID", "scenario": "BASE",
 "store_id": 1, "warehouse": "Warehouse 1", "dept_id": 38, "department": "Front End",
 "date": "2026-02-13", "day": "Fri Feb 13", "day_short": "Fri 13", "weekday": "Friday", "holiday": "Presidents' Day weekend",
 "shift_code": "MID", "shift": "Midday", "start": "13:00", "end": "17:00", "paid_hours": 4,
 "label": "Fri Feb 13, Front End, Midday",
 "is_open": true, "min_staff": 6,
 "plan": 28, "draft": 26, "change": 2, "action": "Add 2",
 "sources": {"regular": 22, "flex": 1, "overtime": 5},
 "draft_sources": {"regular": 22, "flex": 1, "overtime": 3, "unfilled": 0},
 "cost": 3404, "cost_draft": 3100.4, "cost_change": 303.6,
 "hours": 112, "hours_draft": 104,
 "utilization": 0.74783, "utilization_draft": 0.805355,
 "chance": 0.945192, "chance_draft": 0.837237,
 "need": 29, "below_goal": true, "below_goal_draft": true, "at_capacity": true,
 "cushion_people": 4, "cushion_demand": 0.199825,
 "demand": 55.837976, "demand_sd": 0.059203, "demand_multiplier": 1, "adjustment_reason": "No adjustment (baseline demand)",
 "callout_rate": 0.049847, "callout_context": "weekday",
 "availability": {"regular": 22, "overtime": 5, "cross_trained": 1, "usable_flex": 1, "capacity": 28, "note": "Approved PTO/limited availability"},
 "explanation": {
  "headline": "Add 2: 26 in the draft to 28 in the plan",
  "why": "This block can't reach the goal. It needs 29 people for a 95% chance of meeting target, but the plan can only field 28, using all of its own regular staff and overtime. ...",
  "demand_driver": "The weekend before Presidents' Day: 12% more Front End demand than a normal day, going by the MLK weekend.",
  "staffing": "Filled with 22 regular, 1 cross-trained, 5 overtime.",
  "cost_effect": "$3,404, which is $304 more than the draft.",
  "service_effect": "Chance of meeting target goes from 84% in the draft to 95% in the plan.",
  "cushion": "Before a miss becomes the likelier outcome, this block can lose 4 people, or take 20% more demand.",
  "availability": "Approved PTO/limited availability"
 },
 "assumptions": [{"id": "A-01", "text": "Usable cross-trained staff is limited to ..."}, "... A-03, A-05, A-09, A-10, A-11, A-13, A-14"]
}
```

- **`plan`** is the recommended total employees: the number submitted. **`draft`** is management's draft.
- **`chance`** is the chance of meeting target (0-1). **`below_goal`** means `chance` is under the goal even with all of the block's own staff. Show a marker on the board and a red badge in the drawer.
- **`need`** is the headcount the goal would take, ignoring capacity. **`capacity`** is the most the block can field (regular + usable cross-trained + overtime).
- **`utilization`** is workload hours over worked hours. Service falls off a cliff near 0.85-0.90.
- **Closed blocks** (`is_open: false`, 9 per scenario) have `plan: 0`, `draft: 0`, `explanation.headline: "Closed"`, and `null` for `chance`, `utilization`, `need`, `cushion_*`, `demand` and `callout_*`. Hatch them on the board.
- Use `below_goal` for the flag, never the explanation text. The text rounds chances to whole percents, though it never rounds a below-goal chance up to the goal (0.947 reads "94.7%").

### Totals

`totals` holds `"all"`, `"1"`, `"2"` and `"4"`, each shaped like this:

```json
{
 "plan":  {"blocks": 180, "employees": 2701, "fielded": 2701, "hours": 11618, "regular_hours": 10565, "flex_hours": 95, "overtime_hours": 958,
           "cost": 376176.165, "expected_met": 0.957696, "lowest_chance": 0.615843, "below_goal": 25, "over_capacity": 0, "unfilled": 0,
           "below_min_staff": 0, "avg_utilization": 0.699585},
 "draft": {"blocks": 180, "employees": 2390, "hours": 10344, "cost": 329108.19, "expected_met": 0.697631, "below_goal": 134, "...": "same fields"},
 "change": {"employees": 311, "hours": 1274, "overtime_hours": 735, "flex_hours": 12, "cost": 47067.975, "expected_met": 0.260065, "below_goal": -109, "over_capacity": 0, "unfilled": 0},
 "verdict": "Against the draft, the plan adds 1,274 hours for $47,068 more, taking expected service from 69.8% to 95.8%. 25 blocks still can't reach a 95% chance of meeting target, even with all their own staff.",
 "by_day": [{"date": "2026-02-14", "day": "Sat Feb 14", "day_short": "Sat 14", "holiday": "Valentine's Day", "plan": {}, "draft": {}, "change": {}}, "... 7 days"],
 "by_department": [{"dept_id": 38, "department": "Front End", "plan": {}, "draft": {}, "change": {}}, "... 3"],
 "alerts": [{"level": "warning", "kind": "below_goal", "date": "2026-02-14", "count": 11, "at_capacity": 11, "page": "playbook",
             "text": "Sat Feb 14: 11 blocks can't reach the 95% goal, even with all their own staff and overtime. See the Playbook."}],
 "largest_changes": ["BASE|2|38|2026-02-15|MID", "... 10 keys, largest change from the draft first"]
}
```

- `change` is plan minus draft. `expected_met` is the mean chance over open blocks, so a change of 0.26 is 26 points.
- `alerts[].kind` is `below_goal` (one per day with blocks below the goal) or `draft_over_capacity` (DISRUPT: the draft schedules more people than can be fielded). `page` names the page to link to.
- The `"all"` figures equal `analysis_summary.json`'s `plan_summary` and `draft_summary`, which a test checks.

## GET /api/plan.csv?scenario=BASE&store=1

The plan as a CSV download, for "export the current view". `store` is `1`, `2`, `4` or `all` (the default). Open blocks only, with columns Scenario, Warehouse, Date, Day, Department, Shift, Draft, Plan, Change, Regular, Cross-trained, Overtime, Chance of meeting target, Below the goal and Cost.

## GET /api/submission.csv

The filled submission template, `outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv`, as a download. It has 567 rows and passes `src.submission.validate()`. Until T-62, `team_id` is the placeholder `TEAM_NAME`.

## GET /api/compare

All three scenarios side by side, as submitted.

```json
{"goal": 0.95, "scenarios": [{
 "code": "DISRUPT", "name": "Callouts and reduced availability", "description": "Illness at Warehouse 2 on Feb 13-16 ...",
 "plan": {"...": "a summary, as in totals"}, "draft": {}, "change": {"employees": 206, "hours": 1042, "cost": 38953.455, "expected_met": 0.219198, "below_goal": -102, "over_capacity": -12, "unfilled": -36},
 "verdict": "Against the draft, the plan adds 1,042 hours for $38,953 more, taking expected service from 67.8% to 89.7%. 39 blocks still can't reach ... The draft also schedules 36 people more than can be fielded.",
 "vs_base": {"employees": -105, "hours": -369.5, "cost": -10855.47, "overtime_hours": 39.5, "expected_met": -0.060695, "below_goal": 14},
 "by_department": [{"dept_id": 38, "department": "Front End", "plan": {}, "draft": {}, "change": {}}],
 "by_warehouse": [{"store_id": 1, "warehouse": "Warehouse 1", "plan": {}, "draft": {}, "change": {}, "verdict": "..."}],
 "alerts": ["... as in totals"]
}]}
```

## GET /api/forecast?store=&dept=

Both parameters are optional. `store` is `1`, `2`, `4`, or `all` for the totals across warehouses. `dept` is `38`, `92` or `95`. With neither, it returns every series: 9 warehouse-and-department series plus 3 all-warehouse totals (`store_id: null`).

```json
{
 "series": [{"store_id": 1, "warehouse": "Warehouse 1", "dept_id": 38, "department": "Front End", "unit": "Checkout workload units", "days": [{
   "date": "2026-02-14", "day": "Sat Feb 14", "day_short": "Sat 14", "holiday": "Valentine's Day",
   "window": "pre_holiday_weekend", "window_label": "Presidents' Day weekend",
   "normal_day": 130.083669, "holiday_factor": 1.12, "holiday_effect": 15.610046, "model_forecast": 145.693715,
   "valentine_uplift": 0.03, "valentine_effect": 4.370811, "forecast": 150.064526,
   "benchmark": 134.262, "vs_benchmark": 0.117699,
   "driver": "The weekend before Presidents' Day: 12% more Front End demand than a normal day, going by the MLK weekend. Valentine's Day adds 3%, as a judgment call.",
   "scenarios": {
    "BASE": {"demand": 150.064526, "multiplier": 1, "effect": 0, "reason": null, "driver": "..."},
    "PEAK": {"demand": 174.218712, "multiplier": 1.160959, "effect": 24.154186, "reason": "Promotion launch + storm stock-up trips", "driver": "... This scenario raises demand 18%: ..."},
    "DISRUPT": {"demand": 150.064526, "multiplier": 1, "effect": 0, "reason": null, "driver": "..."}
   }}]}],
 "shift_shares": [{"dept_id": 38, "department": "Front End", "date": "2026-02-14", "day": "Sat Feb 14", "holiday": "Valentine's Day", "shares": {"OPEN": 0.34605, "MID": 0.432133, "EVE": 0.221817}}],
 "shift_note": "On holiday-window days, Front End demand shifts about 3 points toward midday.",
 "holiday_factors": [{"dept_id": 38, "department": "Front End", "window": "holiday_monday", "factor": 1.05}],
 "valentine": {"uplift": {"Front End": 0.03, "Merchandising": 0.03, "Pharmacy": 0}, "sensitivity": [{"true_uplift": 0, "our_plan_expected_met": 0.918, "replanned_expected_met": 0.909, "replanned_feb14_cost": 57464.115, "our_plan_feb14_cost": 58907.73}], "assumption": "A-06"},
 "accuracy": {"daily_model": 0.0242, "daily_benchmark": 0.0406, "block_model": 0.0415, "block_benchmark": 0.0541,
   "text": "On held-out normal weeks, daily error was 2.4% against the benchmark method's 4.1%, and 4.2% against 5.4% by block. The edge comes from Fri-Mon (2.4% vs 5.1%) ...",
   "limit": "These weeks hold no holidays and there are only three folds, so the claim is that the forecast removes holiday distortion, not that it beats the benchmark in the planning week."},
 "backtest": {"daily": [], "block": [], "by_week": [], "by_day_group": [{"group": "Fri-Mon", "rows": 108, "model": 0.0242, "benchmark": 0.0508}], "analog": [], "split": [], "forecast_sd": []},
 "drivers_tested": [{"driver": "Temperature (weather)", "tested": "Correlation with what the model leaves unexplained", "found": "-0.006. Front End's raw -0.57 is a calendar artifact.", "use": "Left out. PEAK's storm effect enters through the case's multipliers."}],
 "notes": {"units": "...", "benchmark": "...", "steps": "normal_day x holiday_factor = model_forecast; x (1 + valentine_uplift) = forecast (BASE); x scenarios[code].multiplier = scenarios[code].demand."}
}
```

- **Waterfall** for a day: start at `normal_day`, add `holiday_effect`, then `valentine_effect`, which gives `forecast` (BASE). Then add `scenarios[code].effect` to reach `scenarios[code].demand`.
- `scenarios[code].multiplier` is the effective daily multiplier (scenario demand over BASE). PEAK's multipliers differ by shift, so the day's figure can sit between them.
- Units differ by department, so never put two departments on one axis.
- Error figures (`model`, `benchmark`) are mean absolute percentage errors. In the `backtest` lists, `group` is `"All"` or a department id, with `department` added.
- `drivers_tested` has 8 rows: weekday, holiday windows, weekly level, temperature, promotions, customer traffic, Valentine's Day and the post-holiday rebound. The figures in `found` come from `analysis_summary.json`.

## GET /api/tradeoff

```json
{
 "goal": 0.95,
 "goals": {"BASE": [{"goal": 0.95, "scenario_code": "BASE", "hours": 11618, "cost": 376176.165, "expected_met": 0.957696, "lowest_chance": 0.615843, "below_goal": 25,
                     "over_capacity": 0, "unfilled": 0, "below_min_staff": 0, "overtime_hours": 958, "flex_hours": 95, "avg_utilization": 0.699585,
                     "selected": true, "cost_per_point": 7336.79338}], "PEAK": [], "DISRUPT": []},
 "callout_allowance": {
  "plans": [{"plan": "Allows for both risks (recommended)", "scenario_code": "BASE", "cost": 376176.165, "hours": 11618, "met_both_risks": 0.958, "met_forecast_error_only": 0.996, "met_neither": 1}],
  "worlds": [{"id": "both_risks", "label": "Callouts and forecast error", "text": "..."}, {"id": "forecast_error_only", "label": "Forecast error only"}, {"id": "neither", "label": "Neither"}],
  "note": "Each plan is scored three ways, because the case doesn't publish how judges score service."
 },
 "history_tradeoff": [{"target_util": 0.72, "hours": 68685.625, "cost": 2164076.5971, "cost_vs_actual": 0.1449, "exp_pct_met": 0.9871}]
}
```

`goals` has six points per scenario (0.85 to 0.99), and `selected` marks 95%. `cost_per_point` is the extra cost per point of expected service against the previous goal, and it's `null` for the first. The four `callout_allowance.plans` are the recommended plan, forecast error only, neither, and the current draft, each in every scenario. `met_<world>` is expected service when that world comes true.

## GET /api/playbook

```json
{
 "scenarios": {"PEAK": {"trigger": "The Feb 13 member promotion is confirmed, or a winter-storm advisory covers Feb 13-14.",
                        "actions": ["Switch to the PEAK plan: +280 hours against BASE, at a cost of $387,092.", "..."],
                        "name": "Promotion and winter-weather surge", "description": "..."}},
 "on_the_day": [{"trigger": "Callouts in a block pass its cushion. The typical cushion in people is: Front End 3, Merchandising 2, Pharmacy 1.", "action": "Replace them in this order: ..."}],
 "pto": {"intro": "Holiday PTO is a main cause of the Feb 14-16 shortage. ...",
         "headline": "Keeping up to 4 people per block from holiday PTO cuts blocks below the goal from 25 to 6, raises expected service from 95.8% to 97.2%, and lowers cost by $4,752.",
         "assumption": "A-16",
         "rows": [{"kept_per_block": 1, "people_kept": 62, "blocks_below_goal": 16, "below_goal_with_holiday_pto": 10, "expected_met": 0.967634, "cost": 374674.56, "overtime_hours": 763}]},
 "tightest": {"BASE": {"all": [{"key": "BASE|1|92|2026-02-14|EVE", "label": "Sat Feb 14, Merchandising, Evening", "store_id": 1, "warehouse": "Warehouse 1", "plan": 11,
                                "cushion_people": 0, "cushion_demand": 0.088032, "cushion_text": "...", "chance": 0.639797}], "1": [], "2": [], "4": []}},
 "capacity_gaps": [{"scenario_code": "BASE", "day_date": "2026-02-13", "day": "Fri Feb 13", "dept_id": 38, "department": "Front End", "gap_people": 4, "gap_hours": 16, "blocks_short": 3}]
}
```

Everything here is for the submitted plan. `tightest` lists 8 blocks per scenario and warehouse key, least cushion first. `pto.rows` runs from 0 to 5 people kept per block, in BASE. `capacity_gaps` gives the people each scenario would need beyond capacity, by day and department.

## GET /api/diagnosis

History (Jan 1 to Feb 11): what went wrong with past schedules.

```json
{
 "service_bands": [{"dept_id": 38, "department": "Front End", "band": 0.6, "blocks": 4, "met_target": 1, "median_ratio": 0.25}],
 "staffing_gaps": [{"store_id": 4, "warehouse": "Warehouse 4", "dept_id": 92, "department": "Merchandising", "day_type": "Weekday", "shift_code": "OPEN", "blocks": 29,
                    "avg_utilization": 0.671175, "met_target": 1, "missed_blocks": 0, "over_hours": 702, "short_hours": 0, "scheduled_net_hours": 762, "net_hours": 702}],
 "worst_short": ["... 8 rows, same shape"], "worst_over": ["... 8 rows"],
 "gap_value": [{"dept_id": 38, "department": "Front End", "blocks": 369, "worked_hours": 26855.5, "required_hours": 26573.5, "over_hours": 1284, "short_hours": 1002, "over_value": 37395.74, "missed_blocks": 85, "labor_cost": 797144.28}],
 "callout_rates": [{"dept_id": 38, "department": "Front End", "context": "day_after_holiday", "callouts": 27, "scheduled": 336, "backfilled": 15, "rate": 0.080357, "backfill_share": 0.555556}],
 "draft_stress": [{"scenario_code": "BASE", "day_date": "2026-02-12", "day": "Thu Feb 12", "dept_id": 38, "department": "Front End", "over": 0}],
 "kpi": {"pct_met_all": 0.778727, "over_hours": 3184, "short_hours": 2472, "over_value": 103458.24, "callout_rate_all": 0.051713, "backfill_share": 0.491736},
 "notes": {"service_bands": "...", "staffing_gaps": "...", "callout_rates": "..."}
}
```

`band` is the lower edge of a five-point utilization band. `draft_stress.over` is the share of a day's blocks where the draft runs above 0.85 utilization.

## GET /api/what-if?scenario=&goal=&callouts=&demand=&availability=

| Parameter | Default | Allowed |
|---|---|---|
| `scenario` | `BASE` | `BASE`, `PEAK`, `DISRUPT` |
| `goal` | `0.95` | `0.9`, `0.925`, `0.95`, `0.975` |
| `callouts` | `1` | 0 to 2: a multiple of the historical callout rate |
| `demand` | `0` | -0.10 to 0.15: a change to every block's forecast |
| `availability` | `0` | -0.30 to 0: a change to each block's available regular staff, rounded to whole people. Overtime and cross-trained pools stay as they are. Usable cross-trained staff still shrink, because they come from the partner department's spare regular staff |

Anything else, including `nan` and `inf`, returns 422. The response has **the same shape as `/api/plan`**, scored under the new conditions (the draft too), plus these fields:

```json
{
 "what_if": true, "is_submitted_plan": false, "label": "What-if: not the submitted plan",
 "settings": {"scenario": "BASE", "goal": 0.95, "callouts": 1, "demand": 0.1, "availability": 0},
 "defaults": {"goal": 0.95, "callouts": 1, "demand": 0, "availability": 0},
 "seconds": 2.36,
 "changes": [{"key": "BASE|4|38|2026-02-15|OPEN", "label": "Sun Feb 15, Front End, Opening", "store_id": 4, "warehouse": "Warehouse 4", "dept_id": 38, "department": "Front End",
              "date": "2026-02-15", "day": "Sun Feb 15", "shift_code": "OPEN", "shift": "Opening", "submitted": 30, "what_if": 34, "change": 4,
              "chance_submitted": 0.9589, "chance_what_if": 0.940515, "cost_submitted": 3632.16, "cost_what_if": 4251.52, "cost_change": 619.36, "below_goal_what_if": true}],
 "changes_summary": {"blocks": 126, "people_added": 171, "people_cut": 5, "net": 166},
 "vs_submitted": {"all": {
   "submitted": {"...": "the submitted plan's summary"},
   "what_if": {"...": "this plan's summary"},
   "change": {"employees": 166, "hours": 741, "overtime_hours": 339, "flex_hours": -57, "cost": 27411.275, "expected_met": -0.068731, "below_goal": 31, "over_capacity": 0, "unfilled": 0},
   "submitted_rescored": {"cost": 376176.165, "expected_met": 0.804833, "below_goal": 154, "unfilled": 0, "...": "the submitted headcounts, scored under these conditions"}
 }, "1": {}, "2": {}, "4": {}}
}
```

- `changes` lists every block whose headcount differs from the **submitted** plan, largest change first. `chance_submitted` and `cost_submitted` are the submitted plan's figures under normal conditions.
- `vs_submitted[group].change` is this plan minus the submitted plan. `submitted_rescored` is the submitted plan left as it is but scored under the changed conditions, which answers "what if we don't re-plan?" (here, expected service would fall to 80.5%).
- Default settings return the submitted plan at once, with `is_submitted_plan: true` and `changes: []`.
- Response headers: `X-Cache` is `hit` or `miss`, and `X-Seconds` is the server time for this request. New settings take about 2.5-5 seconds, so show a progress state. Results are cached by settings (the last 48 kept), and two identical requests share one run.

## GET /api/methods

```json
{
 "notice": "All data is simulated ...",
 "engine": [{"step": "Data", "text": "Six weeks of simulated history and the planning grid, read from the case's CSVs."}, "... 7 steps, in order"],
 "forecast": {"backtest_daily": [{"group": 38, "department": "Front End", "rows": 63, "model": 0.029, "model_all_weeks": 0.0301, "benchmark": 0.0457}],
              "backtest_block": [], "backtest_by_week": [], "backtest_by_day_group": [], "forecast_sd": [], "level_weeks": 4},
 "service": {"limits": [{"dept_id": 38, "department": "Front End", "store_id": 1, "warehouse": "Warehouse 1", "u95": 0.861309, "u90": 0.870466, "u50": 0.897265}],
             "brier": {"model": 0.026109, "base_rate": 0.177295},
             "calibration": [{"bin": "0-10%", "blocks": 191, "predicted": 0.004, "observed": 0.016}],
             "curves": {"Front End": {"levels": {"1": -4.8111, "2": -4.6558, "4": -4.7538}, "slope": 5.3293, "extra_slope": 12.0863, "knot": 0.8948, "cap": 1.5188, "scatter": 0.1343}}},
 "plan": {"service_goal": 0.95, "validator_problems": [], "team_id": "TEAM_NAME"},
 "tests": {"count": 87, "files": 9, "how": "Test cases in tests/, with each parametrized case counted once."},
 "assumptions": ["... as in /api/meta"],
 "documents": [{"name": "Written report", "path": "deliverables/Costco_Case_Analysis.docx"}, "..."]
}
```

- `service.limits` gives the utilization at which a block has a 95%, 90% and 50% chance of meeting target.
- `service.curves` passes through `analysis_summary.json` as it is, so its fields follow whatever `src/service.py` saves. Don't rely on a fixed set of keys.
- `tests.count` is read from the test files when the server starts, and it matched `pytest --collect-only` (87 before `tests/test_api.py` was added). It rises as tests are added.

## The front end

`web/dist` is served at `/` when it exists. It's checked on each request, so a new build shows up without a restart. Files under `assets/` are cached for a year, and `index.html` is never cached. A plain path with no file extension falls back to `index.html`, and nothing outside `web/dist` can be reached. If `web/dist` is missing, `/` shows a page with the build command (`cd web && npm install && npm run build`).

## Where the numbers come from

At startup the engine runs `src.app_data.run_scenario` for each scenario with default settings. Plans, blocks, totals, compare, playbook actions and what-ifs come from that. Forecast parts come from `src.forecast`. Saved tables come from `outputs/` (`analysis_summary.json`, `goal_tradeoff.csv`, `pto_what_if.csv`, `capacity_gaps.csv`, `diagnosis_*.csv`, `service_limits.csv`). Nothing is hard-coded, so after a model change and a pipeline rerun, **restart the server** to pick up the new curves and outputs. The example figures on this page are from a run on 2026-11-05 and only illustrate the shape.
