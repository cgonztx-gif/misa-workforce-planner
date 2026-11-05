// Chapter 3 (what history shows) and chapter 4 (forecasting demand).
const { fmt, fx, derive } = require("./claims");
const K = require("./kit");
const D = require("./data");

const { pct, int, money, moneyK, dec, effect, signedPct } = fmt;
const { s, callout, factor, DEPT, DEPT_IDS } = D;
const BANDS = "src/diagnosis.py: utilization bands for kpi.met_below_84, met_85_90 and met_above_90";
const NEED = "src/diagnosis.py: need at 85% utilization, the starter queries' target (F-17)";

function chapter3() {
  const k = (name) => s(`kpi.${name}`);
  const gv = (d, col) => s(`gap_value[dept_id=${d}].${col}`);
  const wm = D.S.worst_short.findIndex((r) => r.store_id === 1 && r.dept_id === 92 && r.shift_code === "EVE");
  const ctx = { weekday: "Weekdays", weekend: "Weekends", day_after_holiday: "Day after a holiday", flu_cluster: "Warehouse 2 flu week" };
  return [
    K.H1("3", "What history shows"),
    K.LEAD("Before planning anything, we asked what six weeks of history say about service, staffing and callouts. Four lessons shape the plan."),
    K.H2("Service falls off a cliff"),
    K.P(`Over the six weeks, ${pct(k("pct_met_all"))} of open blocks met their service target: ${pct(k("pct_met_38"))} in Front End, ${pct(k("pct_met_92"))} in Merchandising and ${pct(k("pct_met_95"))} in Pharmacy. Whether a block met target depended almost entirely on its utilization (${K.ref("fig:cliff")}). Below ${fx("84%", BANDS)} utilization, ${pct(k("met_below_84"), 0)} of blocks met target. Between ${fx("85% and 90%", BANDS)}, only ${pct(k("met_85_90"), 0)} did. At ${fx("90%", BANDS)} or above, almost none did (${pct(k("met_above_90"))}).`),
    ...K.FIG("service_cliff", "fig:cliff", `Share of historical blocks meeting target, by utilization, in five-point bands with at least three blocks. Past about ${fx("97%", "src/diagnosis.py: saturation band for kpi.sat_ratio")} utilization, waits level off at roughly ${dec(k("sat_ratio_38"), 1)} times target in Front End, ${dec(k("sat_ratio_92"), 1)} in Merchandising and ${dec(k("sat_ratio_95"), 1)} in Pharmacy.`,
      "Line chart: in all three departments, nearly every block meets target at low utilization, the share drops steeply across the shaded cliff band, and almost none meet target beyond it."),
    K.P(`This shape drives everything else. A plan that aims right at ${fx("85%", NEED)} has no margin: a little extra demand, or one person calling out, pushes a block over the edge. What counts is the staff who actually work, not the staff on the schedule.`),
    K.H2("The right total hours, in the wrong places"),
    K.P(`Across all six weeks, staff worked ${int(k("worked_hours"))} hours, within ${pct(k("worked_vs_req85"))} of the ${int(k("req85_hours"))} needed to run every block at ${fx("85%", NEED)} utilization, in whole people and never below minimum staff. So in total the warehouses had about the right hours. But ${int(k("over_hours"))} of those hours sat in blocks that didn't need them, worth ${money(k("over_value"))} at regular rates, while ${int(k("short_hours"))} hours were missing from blocks that did.`),
    ...K.FIG("staffing_gaps", "fig:gaps", `The block types with the largest gaps against need over six weeks, as worked. Iris bars had more hours than they needed; bronze bars had fewer. The full ranking is in outputs/diagnosis_staffing_gaps.csv.`,
      "Diverging bar chart of the five most overstaffed and five most understaffed block types; Warehouse 4 Merchandising weekday opening is the most overstaffed and its weekday evening the most understaffed."),
    K.P(`Some gaps are clear habits. Warehouse 4 Merchandising's weekday opening crew ran at ${pct(s("worst_over[0].avg_utilization"), 0)} utilization, while its weekday evening crew ran at ${pct(s("worst_short[0].avg_utilization"), 0)} and met target only ${pct(s("worst_short[0].met_target"), 0)} of the time. That evening crew was ${fmt.abs(s("worst_short[0].scheduled_net_hours"))} hours short before anyone called out. Other gaps are partly callouts: Warehouse 1 Merchandising's weekday evening gap falls from ${fmt.abs(s(`worst_short[${wm}].net_hours`))} hours as worked to ${fmt.abs(s(`worst_short[${wm}].scheduled_net_hours`))} as scheduled.`),
    ...K.TABLE("tab:gaps", `Six-week hours by department, against need at ${fx("85%", NEED)} utilization.`,
      ["Department", "Worked hours", "Needed", "Hours above need", "Hours short", "Value of the excess", "Blocks missing target"],
      DEPT_IDS.map((d) => [DEPT[d], int(gv(d, "worked_hours")), int(gv(d, "required_hours")), int(gv(d, "over_hours")), int(gv(d, "short_hours")), money(gv(d, "over_value")), int(gv(d, "missed_blocks"))]),
      [1800, 1200, 1100, 1300, 1160, 1400, 1400]),
    K.P(`**Schedules barely follow demand.** By department, weekly demand moved by up to ${pct(k("demand_index_spread"), 0)} across the five full weeks, while scheduled hours moved by at most ${pct(k("hours_index_spread"), 0)}. Managers schedule the same crews whatever the week brings. So moving hours comes before adding them.`),
    K.H2("Callouts are predictable"),
    K.P(`Overall, ${pct(k("callout_rate_all"))} of scheduled employees called out, and ${pct(k("backfill_share"), 0)} of those were replaced with overtime. When a block's overtime was already used up, none were. Callouts follow a pattern: more on weekends, more on the day after a holiday, and many more during Warehouse 2's flu week in late January (${K.ref("fig:callouts")}).`),
    ...K.FIG("callout_rates", "fig:callouts", `Callouts as a share of scheduled employees. The flu-week blocks (Warehouse 2 Front End and Pharmacy, late January) are kept apart from the other rows. The day-after-holiday rates rest on two days, and Pharmacy's rates on few people: ${int(callout(95, "day_after_holiday", "callouts"))} of ${int(callout(95, "day_after_holiday", "scheduled"))} scheduled the day after a holiday.`,
      "Grouped bar chart of callout rates by situation and department: rates rise from weekdays to weekends to the day after a holiday, and peak in Warehouse 2's flu week."),
    K.P(`Losing people hurts. Blocks that lost staff to callouts met target far less often: ${pct(k("met_loss_fe"), 0)} against ${pct(k("met_noloss_fe"), 0)} in Front End, ${pct(k("met_loss_ms"), 0)} against ${pct(k("met_noloss_ms"), 0)} in Merchandising, and ${pct(k("met_loss_rx"), 0)} against ${pct(k("met_noloss_rx"), 0)} in Pharmacy. So the plan carries an allowance for callouts at these rates (chapter 5).`),
    K.H2("Overtime isn't the main cost lever"),
    K.P(`Labor cost over the six weeks was ${money(k("labor_cost_6wk"))}. Overtime was ${pct(k("ot_hours_share"))} of worked hours, and its premium over regular pay came to ${money(k("ot_premium_6wk"))}, or ${pct(k("ot_premium_share"))} of labor cost. Where the hours go matters far more than whether a few of them are overtime.`),
    K.H2("The draft schedule's weak points"),
    K.P(`The manager's draft for the planning week copies recent weeks: ${pct(k("draft_within1"), 0)} of its open BASE blocks are within one person of the same weekday and shift's average over weeks 3 to 6. It is identical in all three scenarios. Under our forecast, ${pct(k("draft_over85_base"), 0)} of its Front End and Merchandising blocks on the holiday weekend would run above ${fx("85%", NEED)} utilization in BASE, and ${pct(k("draft_over85_peak"), 0)} in PEAK. Our model expects only ${pct(D.draft("BASE", "expected_met"))} of its BASE blocks to meet target.`),
  ];
}

function chapter4() {
  const k = (name) => s(`kpi.${name}`);
  const back = (g, key) => s(`backtest_daily[group=${g}].${key}`);
  const block = (g, key) => s(`backtest_block[group=${g}].${key}`);
  const dg = (g, key) => s(`backtest_by_day_group[group=${g}].${key}`);
  const analog = (g, key) => s(`analog_test[group=${g}].${key}`);
  const wk = (w, key) => s(`backtest_by_week[week=${w}].${key}`);
  const fday = (d, day, key) => s(`forecast_by_day[dept_id=${d},day_date=${day}].${key}`);
  const gapVsBench = (d, day) => derive("daily forecast / benchmark - 1", fday(d, day, "daily_forecast").v / fday(d, day, "benchmark").v - 1, fday(d, day, "daily_forecast"), fday(d, day, "benchmark"));
  const normal = ["2026-02-12", "2026-02-17", "2026-02-18"];
  const normalGaps = DEPT_IDS.flatMap((d) => normal.map((day) => [fday(d, day, "model_forecast"), fday(d, day, "benchmark")]));
  const normalMax = derive("largest |model / benchmark - 1| on Feb 12, 17 and 18", Math.max(...normalGaps.map(([m, b]) => Math.abs(m.v / b.v - 1))), ...normalGaps.flat());
  const val = D.S.valentine_sensitivity;
  const fe = s("valentine_uplift.Front End");
  const split = (o, key) => s(`split_test[option=${o}].${key}`);
  const A11 = "assumption A-11 (planning/ASSUMPTIONS.md)";
  return [
    K.H1("4", "Forecasting demand"),
    K.LEAD("The planning grid has no demand, so the first job is to forecast it: for every warehouse, department, day and shift. This chapter explains how, what we tested, and how far to trust the result."),
    K.H2("The approach in plain words"),
    K.P("We forecast each department's demand for each day, then split each day into its three shifts. The daily forecast starts from a normal day for that warehouse, department and weekday. It then applies a holiday effect where one applies, measured on the MLK weekend in January, the only holiday weekend in the history. Valentine's Day gets a small adjustment of its own. PEAK then multiplies the result by the case's surge factors."),
    K.H2("The model"),
    K.P(`The daily forecast is a regression on the logarithm of demand, so every effect reads as a percentage ("the holiday weekend adds ${pct(derive("factor - 1", factor(38, "pre_holiday_weekend").v - 1, factor(38, "pre_holiday_weekend")), 0)} to Front End"). It has four parts:`),
    K.BUL("**Warehouse level:** how busy each department is at each warehouse."),
    K.BUL("**Weekday shape:** each department's own weekly pattern. Front End peaks on Saturday, while Merchandising peaks on Monday."),
    K.BUL("**Holiday windows:** the weekend before a holiday and the holiday Monday, by department, plus the rebound after New Year's Day."),
    K.BUL(`**Weekly level:** this keeps a busy week from being mistaken for a holiday effect, since MLK week was the busiest of the six. A future week's level can't be known, so the forecast uses the average of the last ${int(s("level_weeks"))} weeks.`),
    K.P(`Together these explain almost all of the variation in daily demand: warehouse and weekday alone reach ${pct(k("r2_dow"))}, holidays raise it to ${pct(k("r2_dow_hol"))}, and weekly level to ${pct(k("r2_full"), 4)}. We chose a regression over machine learning on purpose: there are only ${int(k("open_blocks"))} open blocks of history and a single holiday weekend, too little to train a flexible model, and a regression's effects can be explained to a manager.`),
    K.H2("Drivers we tested"),
    K.P("The case names several things that drive demand. The table shows what we tested for each, what we found, and how it enters the plan.", { para: { keepNext: true } }),
    ...K.TABLE("tab:drivers", "The demand drivers the case names, and how each one is handled.",
      ["Driver", "What we tested", "What we found", "How it enters the plan"],
      [
        ["Day of the week", "Each department's weekday shape", `Warehouse and weekday explain ${pct(k("r2_dow"))} of the variation`, "In the model"],
        ["Holidays", "New Year rebound, MLK weekend and MLK Day, by department", `Holidays raise the fit to ${pct(k("r2_dow_hol"))}`, "In the model, borrowing MLK's effects for Presidents' Day (A-05)"],
        ["Weekly level", "A level for each week", `Weeks ran from ${dec(k("week_level_min"), 2)} to ${dec(k("week_level_max"), 2)} of average, with no trend`, `In the model, at the last ${int(s("level_weeks"))} weeks' average (A-14)`],
        ["Warehouse size", "A level for each warehouse and department", "Large warehouses are busier, as expected", "In the model, and each warehouse gets its own service curve"],
        ["Department activity", "Labor hours per workload unit, from the case", "Departments differ in units and in effort per unit", "Converts demand into hours of work (chapter 5)"],
        ["Weather (temperature)", "Correlation with what the model leaves unexplained", `${dec(k("corr_temp_resid"), 3)}: no effect. Front End's raw ${dec(k("corr_temp_raw_fe"), 2)} is a calendar artifact`, "Left out. PEAK's storm comes in through the case's multipliers"],
        ["Promotions", "Correlation with what the model leaves unexplained", `${dec(k("corr_promo_resid"), 3)}: promotions always fall on weekends and holidays, which already carry their effect`, "Left out. PEAK's promotion comes in through the case's multipliers"],
        ["Customer traffic", "The data pack's traffic index", "An output of the simulation, marked never to use as an input", "Not used: it would leak the answer"],
        ["Valentine's Day", "No history: it falls outside the six weeks", "A judgment, tested for sensitivity", `Adds ${pct(fe, 0)} to Front End and Merchandising on Feb 14 (A-06)`],
        ["Post-holiday rebound", "Jan 20, flagged like Feb 17", `Ran only ${pct(k("rebound_extra"))} above its own week`, "Left out"],
      ], [1500, 2200, 3060, 2600], { align: ["l", "l", "l", "l"], size: 16 }),
    K.H2("Holiday effects"),
    K.P(`With weekly level in the model, the holiday effects match the factors in the data pack's own build script exactly, so the MLK effects themselves are measured, not guessed (${K.ref("fig:holidays")}). Front End and Merchandising get busier over a holiday weekend. Pharmacy gets quieter, and on the holiday Monday its demand falls by ${pct(derive("1 - factor", 1 - factor(95, "holiday_monday").v, factor(95, "holiday_monday")), 0)}.`),
    ...K.FIG("holiday_factors", "fig:holidays", "Holiday effects measured in history, as a change against a normal day. The MLK window's effects are applied to Presidents' Day.",
      "Bar chart of holiday effects by department: Front End and Merchandising rise before and on the holiday, while Pharmacy falls, most of all on the holiday Monday."),
    K.P(`**Whether Presidents' Day repeats MLK is the assumption (A-05).** We can test borrowing a holiday only once: forecasting the MLK weekend from the first two weeks, using the New Year rebound as the guide. Our error was ${pct(analog("All", "model"))} against the benchmark's ${pct(analog("All", "benchmark"))}: better for Front End (${pct(analog(38, "model"))} against ${pct(analog(38, "benchmark"))}) and Merchandising (${pct(analog(92, "model"))} against ${pct(analog(92, "benchmark"))}), worse for Pharmacy (${pct(analog(95, "model"))} against ${pct(analog(95, "benchmark"))}). So the plan carries extra forecast uncertainty on Feb 13-16: ${fx("2%", A11)} for Front End and Merchandising, and ${fx("5%", A11)} for Pharmacy.`),
    K.H2("Valentine's Day is a judgment"),
    K.P(`History holds no Valentine's Day, and the data pack gives Feb 14 the same features as the days around it. The case still asks us to forecast it, so we add ${pct(fe, 0)} for Front End and Merchandising on that Saturday, on top of the holiday weekend, and nothing for Pharmacy (A-06). The table shows how little the answer depends on that choice.`),
    ...K.TABLE("tab:valentine", `Feb 14 Front End and Merchandising blocks in BASE. Our plan costs ${money(s("valentine_sensitivity[true_uplift=0].our_plan_feb14_cost"))} for those blocks.`,
      ["If the true uplift is", "Expected service, our plan", "Had we planned for it", "Feb 14 cost, had we planned for it"],
      val.map((r) => [pct(s(`valentine_sensitivity[true_uplift=${r.true_uplift}].true_uplift`), 0), pct(s(`valentine_sensitivity[true_uplift=${r.true_uplift}].our_plan_expected_met`)),
        pct(s(`valentine_sensitivity[true_uplift=${r.true_uplift}].replanned_expected_met`)), money(s(`valentine_sensitivity[true_uplift=${r.true_uplift}].replanned_feb14_cost`))]),
      [2400, 2320, 2320, 2320]),
    K.P(`**Planning for a bigger uplift barely helps, because ${int(s("base_shortfall.feb14_front_merch_at_capacity"))} of those ${int(s("base_shortfall.feb14_front_merch_blocks"))} blocks are already at capacity.** The size of this assumption matters less than the shortage of people that day.`),
    K.H2("The shift split"),
    K.P(`Each day's forecast is split into opening, midday and evening using each department's average shares for that kind of day. Front End's demand moves about ${fmt.pts(k("fe_mid_shift_pts"), 0)} toward midday on holiday-window days, so Front End gets its own holiday shares. Leaving one week out, that cut the split's error on Front End holiday days from ${pct(split("pooled", "front_end_holiday_window_days"))} to ${pct(split("front_end_holiday_shares", "front_end_holiday_window_days"))}. Other departments didn't improve, so they keep one set of shares.`),
    K.H2("Accuracy, and its limits"),
    K.P(`We tested the forecast the honest way: forecast each of weeks 4, 5 and 6 using only the weeks before it, and compare with what happened. The benchmark's method gets the same test.`),
    ...K.FIG("backtest_error", "fig:backtest", `Mean absolute percentage error of daily demand on held-out weeks. By week, ours against the benchmark's: ${pct(wk(4, "model"))} against ${pct(wk(4, "benchmark"))}, ${pct(wk(5, "model"))} against ${pct(wk(5, "benchmark"))}, and ${pct(wk(6, "model"))} against ${pct(wk(6, "benchmark"))}. By block, after the shift split: ${pct(block("All", "model"))} against ${pct(block("All", "benchmark"))}.`,
      "Bar chart of forecast error: ours is lower than the benchmark method's in every group, by a wide margin from Friday to Monday and narrowly from Tuesday to Thursday."),
    K.P(`Our daily error was ${pct(back("All", "model"))} against the benchmark method's ${pct(back("All", "benchmark"))}. **But the edge comes entirely from Friday to Monday**, where the benchmark's four-week average still held earlier holiday days: ${pct(dg("Fri-Mon", "model"))} against ${pct(dg("Fri-Mon", "benchmark"))}. From Tuesday to Thursday the two nearly tie (${pct(dg("Tue-Thu", "model"))} against ${pct(dg("Tue-Thu", "benchmark"))}). So the test shows that our forecast removes holiday distortion. It doesn't show that we beat the benchmark in the planning week: these held-out weeks hold no holidays, and three weeks is a small test.`),
    K.H2("The planning-week forecast"),
    ...K.FIG("forecast_vs_benchmark", "fig:forecast", `Our BASE daily forecast against the benchmark, summed across warehouses. On normal days the two agree within ${pct(normalMax)}, because both start from the same recent weeks. They differ only in the Presidents' Day window.`,
      "Three line charts, one per department: our forecast sits above the benchmark for Front End and Merchandising over the holiday weekend and below it for Pharmacy on Presidents' Day."),
    K.P(`The benchmark averages four weeks, only one of which held the MLK weekend, so it carries just a quarter of the holiday effect. That is why it runs low for Front End on Valentine's Day (our forecast is ${pct(gapVsBench(38, "2026-02-14"))} above it) and high for Pharmacy on Presidents' Day (ours is ${pct(derive("benchmark gap, as a positive share", -gapVsBench(95, "2026-02-16").v, gapVsBench(95, "2026-02-16")))} below it). Over the whole week, our Front End forecast is ${signedPct(derive("week forecast / benchmark - 1", s("forecast_week[dept_id=38].daily_forecast").v / s("forecast_week[dept_id=38].benchmark").v - 1, s("forecast_week[dept_id=38].daily_forecast"), s("forecast_week[dept_id=38].benchmark")))} against the benchmark, and Pharmacy's is ${signedPct(derive("week forecast / benchmark - 1", s("forecast_week[dept_id=95].daily_forecast").v / s("forecast_week[dept_id=95].benchmark").v - 1, s("forecast_week[dept_id=95].daily_forecast"), s("forecast_week[dept_id=95].benchmark")))}.`),
    K.P(`Forecast error still matters, so the risk model carries it: the held-out error per block was ${pct(s("forecast_sd[dept_id=38].sd"))} for Front End, ${pct(s("forecast_sd[dept_id=92].sd"))} for Merchandising and ${pct(s("forecast_sd[dept_id=95].sd"))} for Pharmacy, plus the extra holiday uncertainty above.`),
  ];
}

module.exports = { chapter3, chapter4 };
