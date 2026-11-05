// Chapter 9 (how we checked it) and chapter 10 (assumptions and limits).
const { fmt, fx, derive } = require("./claims");
const K = require("./kit");
const D = require("./data");

const { pct, int, dec } = fmt;
const { s, callout } = D;
const A11 = "assumption A-11 (planning/ASSUMPTIONS.md)";

function chapter9() {
  const t = D.testCount();
  const cal = (bin, key) => s(`service_calibration[bin=${bin}].${key}`);
  const atCapacity = D.planSum({ is_open: "1", recommended: (v, r) => Number(v) === Number(r.capacity) }, null, "open blocks with plan = capacity");
  return [
    K.H1("9", "How we checked it"),
    K.LEAD("A plan is only as good as the work behind it. We checked the analysis in six ways, and we list what we couldn't check."),
    K.H2("Automated tests"),
    K.P(`The code has ${int(t.tests)} automated test cases in ${int(t.files)} files. They cover the cost rule, the forecast, the service curves and risk model, the search, the submission check, the explanations, the playbook, and the app and its server. All of them pass on the frozen numbers.`),
    K.H2("Independent recomputation"),
    K.P("Separate scripts rebuilt the key results without importing the code they check:"),
    K.BUL("**The analysis reproduces exactly.** Rerunning the pipeline rewrites every output file byte for byte (F-66)."),
    K.BUL(`**The submission passes an independent rebuild:** all ${int(s("kpi.plan_blocks"))} rows, joined on keys, whole numbers, closed blocks at zero, and every open block at or above minimum staff and within capacity. ${int(atCapacity)} open blocks sit exactly at capacity (F-67).`),
    K.BUL("**The search finds the best staffing under its rule.** A brute force over every feasible pair agreed with it on every shift (F-70)."),
    K.BUL("**The cost rule matches the case's README to the half cent** on every block and every total (F-71)."),
    K.BUL("**Every explanation quotes its own block's numbers.** A test checks the draft, plan, change, utilization, chance, cost and cushion in every row's text (F-72)."),
    K.BUL("**A separate recomputation from the raw files** matched every table it could rebuild. Its service model shared our structure, so its agreement supports the arithmetic, not the assumptions (F-54)."),
    K.H2("Backtests"),
    K.P(`The forecast was tested on held-out weeks (chapter 4). The service curves were tested the same way, fitting on five weeks and predicting the sixth, six times over. Their Brier score, a standard measure of how good predicted chances are (lower is better), was ${dec(s("service_brier.model"), 3)}, against ${dec(s("service_brier.base_rate"), 3)} for simply using the average rate.`),
    K.H2("Calibration: do predicted chances come true?"),
    K.P(`A chance is only useful if blocks predicted at, say, ${fx("90%", "an illustrative level, not a result")} meet target about that often. ${K.ref("fig:calibration")} groups history's blocks by their predicted chance, each predicted by a curve fitted without that block's week, and compares with what happened.`),
    ...K.FIG("calibration", "fig:calibration", "Predicted chance of meeting target against the share that met it, out of sample. Each dot is a group of blocks, labeled with its range and the number of blocks. Dots on the line mean predictions came true.",
      "Scatter of predicted against observed chance for eight groups of blocks; all lie close to the diagonal."),
    K.P(`Predictions track outcomes. Blocks predicted at ${fx("95-99%", "service_calibration bin label")} met target ${pct(cal("95-99%", "observed"))} of the time, against ${pct(cal("95-99%", "predicted"))} predicted. Blocks at ${fx("70-90%", "service_calibration bin label")} met it ${pct(cal("70-90%", "observed"))} of the time, against ${pct(cal("70-90%", "predicted"))}. The first curve ran slightly optimistic near the goal; the smooth bend fixed that (D-29). As a final check, we rescored the plan using history directly instead of the curve, and expected service agreed to within half a point (F-65).`),
    K.H2("Sensitivity"),
    K.P("We changed each judgment that could move the plan and measured the effect:"),
    K.BUL("**Valentine's Day uplift:** planning for more barely helps, because capacity binds that day (chapter 4)."),
    K.BUL("**The service goal:** each extra point costs more than the last (chapter 5)."),
    K.BUL("**The callout allowance:** worth it only if callouts happen, which history says they do (chapter 5)."),
    K.BUL("**Holiday PTO:** the strongest lever we found (chapter 7)."),
    K.BUL("**The illness callout rates in DISRUPT (A-12):** dropping them changes no staffing, because those blocks are already at capacity. Only DISRUPT's reported service moves (F-69)."),
    K.BUL("**Pharmacy's thin day-after-holiday rate (A-15):** it drives most of the Feb 17 shortfall (chapter 6)."),
    K.H2("Browser checks"),
    K.P("The tool was driven in a real browser by an automated script, through every page, all three scenarios, the block drawer and a what-if. The screenshots in chapter 8 come from that run. The checks look for errors on the page and confirm that nothing is requested from outside the laptop."),
    K.H2("What hasn't been checked"),
    K.BUL("**How judges score service.** The case gives only the order of priorities: service, then cost, then feasibility."),
    K.BUL("**The holiday forecast itself.** The planning week's true demand is hidden, and borrowing the MLK weekend for Presidents' Day is an assumption (A-05)."),
    K.BUL("**The exact cross-trained staff rule.** The case doesn't publish it; ours is our reading of the README (A-01)."),
    K.BUL("**How much holiday PTO is still open to change.** The data doesn't show it (A-16)."),
    K.BUL("**The model against real warehouses.** All data is simulated. The method would need refitting on real data before use."),
  ];
}

function chapter10() {
  const k = (name) => s(`kpi.${name}`);
  const A = (id, text, basis, wrong, status) => [`**${id}**`, text, basis, wrong, status];
  return [
    K.H1("10", "Assumptions and limits"),
    K.LEAD("The case asks every team to identify the assumptions it adds. Ours are listed here, apart from the case's own, together with the limits of the work and how it could run for real."),
    K.H2("Assumptions we added"),
    ...K.TABLE("tab:assumptions", "Our assumptions. Proposed means reasoned but not confirmed by the organizers.",
      ["ID", "Assumption", "Why", "If it's wrong", "Status"],
      [
        A("A-01", "Usable cross-trained staff is the smaller of the block's cross-trained pool and the partner department's regular staff left over in that shift", "Our reading of the README's rule", "Plans could cost more or be flagged infeasible", "Proposed"),
        A("A-02", "Sharing follows the shift code, though the opening shift covers different hours by department", "The README says \"same shift\"", "Less sharing may be possible in opening shifts", "Proposed"),
        A("A-03", `Plans allow for callouts at historical rates (${pct(k("callout_rate_all"))} overall), with about ${pct(k("backfill_share"), 0)} replaced by overtime`, "History; the starter query lists a missing callout buffer as a weakness", "If judges ignore callouts, the allowance adds cost without credit", "Confirmed by the team"),
        A("A-04", `${fx("85%", "A-04 and the starter queries' target (F-17)")} utilization is a ceiling, not a target; each department and warehouse gets its own limit`, "The service cliff", "Too cautious adds cost; too tight misses targets", "Proposed"),
        A("A-05", "The MLK window is a fair guide to the Presidents' Day window", "The same holiday shape, Friday to Monday", "The holiday effect is misjudged", "Proposed"),
        A("A-06", `Valentine's Day adds ${pct(s("valentine_uplift.Front End"), 0)} for Front End and Merchandising on Feb 14`, "No history; a stated judgment, tested for sensitivity", "Saturday demand is misjudged, though capacity limits that day anyway", "Proposed"),
        A("A-07", "The New Year rebound gets its own effect; the flu cluster affects callouts and availability, not demand", "Demand fits almost exactly with no flu term", "The baseline forecast is skewed", "Confirmed"),
        A("A-08", "Planning-week temperature and promotion fields are taken as given", "No longer needed: the forecast doesn't use them", "No effect", "Rejected"),
        A("A-09", "The historical service curve applies to the planning week", "The case's docs say to estimate it from history", "Service risk is misjudged where utilization was rarely seen", "Proposed"),
        A("A-10", "Borrowed staff cost the regular rate of the department they cover", "The case's docs and starter query use the block's own rate", "Small cost differences", "Proposed"),
        A("A-11", `Borrowing a holiday effect adds forecast uncertainty on Feb 13-16: ${fx("2%", A11)} for Front End and Merchandising, ${fx("5%", A11)} for Pharmacy`, "The gap between the only two comparable holiday windows", "Holiday-week headroom is too small or too large", "Proposed"),
        A("A-12", `DISRUPT's illness has January's flu-week callout rates (${pct(callout(38, "flu_cluster"))} Front End, ${pct(callout(95, "flu_cluster"))} Pharmacy) on top of the staff cuts`, "Both appeared together in January", "Changes only DISRUPT's reported service, not its staffing", "Checked"),
        A("A-13", `The service goal is a ${pct(s("service_goal"), 0)} chance of meeting target in each block`, "Service is judged first, and cost per point climbs fast above it", "Cost and service move along the trade-off", "Confirmed by the team"),
        A("A-14", `A future week's demand level matches the last ${int(s("level_weeks"))} weeks' average`, "Slightly better than all weeks in the backtest", "All forecasts shift together", "Proposed"),
        A("A-15", "Callout rates by situation are used as measured, even where few people stand behind them", "Simple and traceable", "A few Pharmacy blocks are over- or under-buffered, most on Feb 17", "Proposed"),
        A("A-16", "Some holiday-weekend PTO can still be limited, up to what each block lost against recent weeks", "The grid says \"PTO requests\", but not how many are approved", "The PTO savings shrink or vanish", "Proposed"),
      ], [700, 3020, 2160, 2160, 1320], { align: ["l", "l", "l", "l", "l"], size: 15 }),
    K.H2("The case's own assumptions"),
    K.P("The case fixes these, and we use them as given (data pack docs/ASSUMPTIONS.md): labor hours per workload unit for each department, regular and overtime pay rates, shift times and paid hours, minimum staff per block, availability per scenario, the scenario multipliers, the service targets, and the benchmark's definition."),
    K.H2("Limits"),
    K.BUL("**Thin holiday evidence.** History holds one holiday weekend. The Presidents' Day forecast borrows it, and Valentine's Day has no history at all."),
    K.BUL("**Simulated data.** The demand, staffing and service relationships come from the case's simulation, not from real warehouses."),
    K.BUL("**Totals, not names.** The plan gives each block's total and its split by source. Assigning individual people stays with managers."),
    K.BUL("**One week at a time.** The search treats each shift separately, because weekly hour limits are already built into availability. A rule spanning several shifts would need a different method."),
    K.BUL("**Unknown scoring.** If judges score average waits rather than pass or fail, blocks far over the cliff would matter more than our measure suggests."),
    K.H2("How Costco could run this for real"),
    K.P("The engine and its interface are built so that a weekly cycle could replace the case's files with live data:"),
    ...K.NUMS([
      "**Feed the data weekly.** Load last week's actual demand, schedules, callouts and service, and next week's availability, holidays and planned events, in the same tables the case uses.",
      "**Rerun.** Refit the forecast's weekly level and holiday effects as more holidays build up, refit the service curves, and rerun the search. This takes minutes.",
      "**Review.** Leaders open the board, check the alerts and the blocks below the goal, decide on time-off approvals, and test known events in the Scenario lab.",
      "**Publish.** Export the block totals to the scheduling system, where managers assign people.",
      "**Learn.** Each week, compare the forecast with actual demand and predicted chances with outcomes, as in chapter 9, and investigate any drift.",
    ]),
    K.P("The server already separates the engine from the interface through a documented API, so swapping the case's CSV files for a database connection would change one layer, not the whole tool."),
  ];
}

module.exports = { chapter9, chapter10 };
