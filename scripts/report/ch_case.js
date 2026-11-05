// Chapter 1 (the case) and chapter 2 (the data).
const { fmt, fx, derive } = require("./claims");
const K = require("./kit");
const D = require("./data");

const { pct, int, times, dec } = fmt;
const { s, f, plan, draft } = D;
const CASE = "Case PDF p7 and data pack docs/ASSUMPTIONS.md section 6";
const GRID_NOTE = "planning grid v_PlanningWeekGrid.csv, availability_note";
const CLIFF = "F-03: the service cliff (src/diagnosis.py utilization bands)";

function chapter1() {
  const blocksPerScenario = derive("submission rows / 3 scenarios", s("kpi.plan_blocks").v / 3, s("kpi.plan_blocks"));
  const closed = D.planSum({ is_open: "0" }, null, "is_open=0");
  const closedPer = derive("closed rows / 3 scenarios", closed.v / 3, closed);
  return [
    K.H1("1", "The case"),
    K.LEAD("A warehouse club runs on a simple promise: low prices, full shelves and short lines. Labor is one of the biggest costs it controls, and it is also what keeps that promise. This chapter sets out the decision the case asks us to make."),
    K.H2("The business problem"),
    K.P("Each week, managers decide how many people to schedule in each department and shift. Today they mostly copy recent weeks. That works when next week looks like last week. It fails when demand moves, as it does around holidays, promotions, storms and illness. The case asks for a way to forecast what a week will need, turn that into staffing, balance cost against service, and explain the result to the people who must act on it."),
    K.H2("Three departments, and why each matters"),
    ...K.TABLE("tab:departments", "The three departments in the case and the service measure each is judged on.",
      ["Department", "What the staff do", "Service measure", "Target", "Shared staff"],
      [
        ["**Front End**", "Run the checkout lanes and the exit", "Checkout wait", fx("5 minutes or less", CASE), "Cross-trained with Merchandising"],
        ["**Merchandising**", "Stock the floor and refill shelves", "Replenishment response", fx("60 minutes or less", CASE), "Cross-trained with Front End"],
        ["**Pharmacy**", "Fill prescriptions and counsel members", "Prescription wait", fx("20 minutes or less", CASE), "None: licensed staff only"],
      ], [1600, 2500, 1900, 1660, 1700], { align: ["l", "l", "l", "l", "l"] }),
    K.P("**Front End** is what members feel first: a short staff at checkout means long lines at the busiest hours. **Merchandising** keeps the shelves full; when it falls behind, items run out on the floor and restocking spills into busy hours. **Pharmacy** has the least room to adjust, because its staff are licensed and can't be borrowed from another department. Each department counts its demand in its own workload units, so we never compare units across departments."),
    K.P("Front End and Merchandising share a small pool of cross-trained staff in each shift. Someone covering checkout can't also be stocking shelves, so the two departments must be planned together."),
    K.H2("The planning week"),
    K.P(`The week runs Thursday, Feb 12 to Wednesday, Feb 18, 2026. It holds two events that six weeks of history can't show directly: **Valentine's Day** on Saturday, Feb 14, and **Presidents' Day** on Monday, Feb 16. Friday to Monday forms the Presidents' Day window, when holiday shopping and holiday time off both peak (${K.ref("fig:timeline")}).`),
    ...K.FIG("planning_timeline", "fig:timeline", "What happens on each day of the planning week, read from the case's planning grid. The shaded days are the Presidents' Day window. Time off over the holiday weekend applies in every scenario; PEAK and DISRUPT add their own changes.",
      "Timeline of the planning week from Thursday Feb 12 to Wednesday Feb 18, showing Valentine's Day, Presidents' Day, the Friday to Monday holiday window, holiday PTO, PEAK's surge and DISRUPT's staff cuts."),
    K.P(`We plan three warehouses: Warehouse 1 is medium-sized, and Warehouses 2 and 4 are large (there is no Warehouse 3). Each has the three departments and three shifts a day: opening, midday and evening. One warehouse, department, day and shift is a **block**, the unit everything in this report is planned in. That gives ${int(blocksPerScenario)} blocks per scenario and ${int(s("kpi.plan_blocks"))} rows in the submission. Of those, ${int(closedPer)} per scenario are closed, all of them Pharmacy shifts on the weekend.`),
    K.H2("The three scenarios"),
    K.P("The case asks for a plan under each of three sets of conditions. All three are required."),
    ...K.TABLE("tab:scenarios", "The three scenarios, as the planning grid applies them.",
      ["Scenario", "What changes", "When", "Effect on staffing"],
      [
        ["**BASE**", "Expected conditions for the week, including holiday-weekend time off", "All week", "Our forecast against the planned availability"],
        ["**PEAK**", `A member promotion launches and a winter-storm advisory brings stock-up trips. Demand rises by ${times(f("timeline.peak_multiplier_min"))} to ${times(f("timeline.peak_multiplier_max"))}`, "Fri Feb 13 to Sun Feb 15", "More demand, the same people"],
        ["**DISRUPT**", `An illness cluster at Warehouse 2 (${fx("about 30%", GRID_NOTE)} of Front End out, one Pharmacy team member out per block, overtime halved), and a receiving crew shortage at Warehouse 4 (${fx("about 35%", GRID_NOTE)} of the opening stocking crew)`, "Warehouse 2: Feb 13-16. Warehouse 4: Feb 12-13", "The same demand, fewer people"],
      ], [1200, 3960, 2300, 1900], { align: ["l", "l", "l", "l"] }),
    K.H2("What we hand in, and how it's judged"),
    K.BUL(`**A presentation** of ${fx("12-15 minutes", "data pack README and case PDF p8")} with a demo of the tool, covering the diagnosis, the forecast, the recommendation and all three scenarios.`),
    K.BUL(`**The completed submission template:** the total employees for every block in every scenario, ${int(s("kpi.plan_blocks"))} rows, with ${fx("0", "data pack README: enter 0 for closed blocks")} for closed blocks.`),
    K.BUL("**A working tool** a warehouse leader could use: it takes a scenario and shows staffing, labor cost and service risk."),
    K.BUL("**Supporting analysis** showing the forecast method, the key assumptions (with ours marked) and cost and service against the draft. This report is that analysis."),
    K.P("**Plans are judged on service first, then labor cost, then feasibility.** Feasible means each block stays within the people available and at or above its minimum staff. The case fixes how labor is costed: regular staff first, then cross-trained staff the partner department isn't using, then overtime, each at its own hourly rate including benefits. The case doesn't publish its scoring formula, so we treat anything beyond that order as an assumption."),
    ...K.NOTE("Terms used throughout", [
      "**Block:** one warehouse, department, day and shift. The plan gives a total number of people for each block.",
      `**Utilization:** the hours of work a block's demand needs, divided by the hours its staff actually work. Above about ${fx("85-90%", CLIFF)}, service breaks down.`,
      "**Meets target:** the block's wait or response time is at or under its department's target.",
      "**Chance of meeting target:** our model's estimate for one block, allowing for forecast error and callouts. **Expected service** is the average of these chances across open blocks.",
      "**Capacity:** the most people a block can field: its regular staff, plus usable cross-trained staff, plus overtime.",
      "**Draft:** the manager's draft schedule for the week, which the case provides. Appendix D has a full glossary.",
    ]),
  ];
}

function chapter2() {
  const rows = (file) => int(D.dataRows(file));
  const sameDraft = () => {
    if (draft("BASE", "hours").v !== draft("PEAK", "hours").v) throw new Error("The draft's BASE and PEAK hours differ now");
    return draft("BASE", "hours");
  };
  return [
    K.H1("2", "The data"),
    K.LEAD("The case comes with six weeks of simulated history and a grid describing the planning week. Every number in this report comes from those files, through code that anyone can rerun."),
    K.H2("Sources"),
    ...K.TABLE("tab:sources", "The data pack files we use. Every table has the same grain: one row per warehouse, department, date and shift.",
      ["File", "Covers", "Rows", "What it holds"],
      [
        ["v_ShiftHistory.csv", "Jan 1 to Feb 11, 2026", rows("v_ShiftHistory.csv"), "Demand, schedules, callouts, availability, cost and service for every block"],
        ["v_PlanningWeekGrid.csv", "Feb 12-18, 2026", rows("v_PlanningWeekGrid.csv"), "Each scenario's availability, draft schedule, demand multipliers and pay rates. No demand"],
        ["PlanningWeek_BenchmarkForecast.csv", "Feb 12-18, 2026", rows("PlanningWeek_BenchmarkForecast.csv"), "The case's naive daily forecast, the floor to beat"],
        ["TEAM_SUBMISSION_TEMPLATE.csv", "Feb 12-18, 2026", rows("TEAM_SUBMISSION_TEMPLATE.csv"), "The form we fill in"],
        ["comp_LaborStandard.csv", "", rows("comp_LaborStandard.csv"), "Labor hours needed per workload unit, by department"],
        ["comp_LaborCostAssumption.csv", "", rows("comp_LaborCostAssumption.csv"), "Regular and overtime hourly rates"],
      ], [3420, 1640, 700, 3600], { align: ["l", "l", "r", "l"], size: 16 }),
    K.H2("History against the planning week"),
    K.BUL("**The planning grid has no demand.** Forecasting it is part of the task, so chapter 4 builds that forecast."),
    K.BUL("**Some columns exist only in the planning grid,** such as promotion strength and the stock-up and rebound flags. The forecast uses only what both periods share."),
    K.BUL("**Holiday labels differ.** History names the MLK weekend and the planning grid names the Presidents' Day weekend. We map both to shared categories (the weekend before a holiday, and the holiday Monday), or no model could carry the effect across."),
    K.BUL(`**Closed blocks have no demand.** History has ${int(s("kpi.closed_blocks"))} closed blocks (New Year's Day and Pharmacy's closed shifts), leaving ${int(s("kpi.open_blocks"))} open blocks. We leave closed blocks out of every fit.`),
    K.H2("Quality checks"),
    K.P("We checked the files against each other and against the data pack's own documentation before using them. All of these passed:"),
    K.BUL("Every file has the expected rows and keys, and the template's keys match the planning grid exactly."),
    K.BUL("Labor cost in history follows the documented formula exactly, and shift demand adds up exactly to daily demand."),
    K.BUL("The benchmark is exactly what the docs say: the average of the same weekday over weeks 3 to 6, in the same units as history's demand. It is daily, so it must be split into shifts."),
    K.BUL("The template's rows are sorted by shift name, not by time of day, so we always join on the keys and never on row order."),
    K.H2("What the docs don't say"),
    K.P("Reading the grid itself turned up several things the case documents leave out. Each one changes the plan."),
    K.BUL(`**DISRUPT cuts more than described.** It changes ${int(f("timeline.disrupt_changed_blocks"))} blocks. Beyond the listed cuts, the partner department's cross-trained staff also falls: Warehouse 2 Merchandising on Feb 13-16, and Warehouse 4 Front End's opening shift on Feb 12-13. So we read availability for each scenario from the grid and never type in the described cuts.`),
    K.BUL(`**The draft can't be staffed in DISRUPT.** In ${int(s("kpi.disrupt_blocks_usable_flex"))} blocks it schedules more people than are available, ${int(s("kpi.disrupt_shortfall_usable_flex"))} people in all under the case's cost rule.`),
    K.BUL(`**The draft is the same in every scenario.** It schedules the same ${dec(sameDraft(), 0)} paid hours in BASE and PEAK. In DISRUPT, only ${dec(draft("DISRUPT", "hours"), 1)} of them can actually be fielded. It ignores both the surge and the illness.`),
    K.BUL("**Promotions always fall on weekends and holidays.** In history, every Friday to Sunday and every holiday day had a promotion, and no other day did. Their effect can't be separated from the weekday and holiday effects, which already carry it."),
    K.BUL("**The data pack's customer traffic index is an output, not an input.** Its own feature list marks it \"never use as model input\", because it is computed from the answer. Using it would leak the demand we are asked to forecast."),
  ];
}

module.exports = { chapter1, chapter2 };
