// Chapter 5: from demand to staff (service curve, risk, allocation and cost, the search, the goal).
const { fmt, fx, derive } = require("./claims");
const K = require("./kit");
const D = require("./data");

const { pct, int, money, dec, signedPct, pts } = fmt;
const { s, f, plan, draft, goalRow, buffer, limit, DEPT, DEPT_IDS, DAY, SHIFT } = D;
const BOTH = "Allows for both risks (recommended)";
const FCST = "Allows for forecast error only";
const NONE = "Allows for neither";

function chapter5() {
  const goal = pct(s("service_goal"), 0);
  const u95 = DEPT_IDS.flatMap((d) => [1, 2, 4].map((w) => limit(d, w)));
  const lo = derive("lowest u95", Math.min(...u95.map((n) => n.v)), ...u95);
  const hi = derive("highest u95", Math.max(...u95.map((n) => n.v)), ...u95);
  const r = (key) => f(`risk_example.${key}`);
  const a = (key) => f(`allocation_example.${key}`);
  const ex = D.F.allocation_example;
  const sh = (i, key) => f(`allocation_example.shift[${i}].${key}`);
  const partnerFree = derive("partner regular available - partner plan", sh(1, "available_regular_employees").v - sh(1, "recommended").v, sh(1, "available_regular_employees"), sh(1, "recommended"));
  const hours = (n) => derive("people x paid hours", n.v * a("paid_hours").v, n, a("paid_hours"));
  const regCost = derive("(regular + cross-trained) x paid hours x regular rate", (a("fill_regular").v + a("fill_flex").v) * a("paid_hours").v * a("regular_rate").v, a("fill_regular"), a("fill_flex"), a("paid_hours"), a("regular_rate"));
  const otCost = derive("overtime x paid hours x overtime rate", a("fill_overtime").v * a("paid_hours").v * a("overtime_rate").v, a("fill_overtime"), a("paid_hours"), a("overtime_rate"));
  if (Math.abs(regCost.v + otCost.v - ex.cost) > 0.01) throw new Error("The allocation example's cost no longer adds up");
  const shiftsPerScenario = D.planSum({ scenario_code: "BASE", dept_id: "38" }, null, "scenario_code=BASE,dept_id=38");
  const step = (lo2, hi2) => derive(`cost at ${hi2} - cost at ${lo2}`, goalRow(hi2, "cost").v - goalRow(lo2, "cost").v, goalRow(hi2, "cost"), goalRow(lo2, "cost"));
  const gain = (lo2, hi2) => derive(`service at ${hi2} - service at ${lo2}`, goalRow(hi2, "expected_met").v - goalRow(lo2, "expected_met").v, goalRow(hi2, "expected_met"), goalRow(lo2, "expected_met"));
  const allowance = derive("cost allowing for both risks - forecast error only", buffer(BOTH, "cost").v - buffer(FCST, "cost").v, buffer(BOTH, "cost"), buffer(FCST, "cost"));
  const bufRow = (name, label) => [label, money(buffer(name, "cost")), pct(buffer(name, "met_both_risks")), pct(buffer(name, "met_forecast_error_only")), pct(buffer(name, "met_neither"))];
  return [
    K.H1("5", "From demand to staff"),
    K.LEAD("A forecast says how much work is coming. This chapter turns it into a number of people for every block: how service responds to workload, how much risk to allow for, how staff are costed, and how the plan picks the best staffing in each shift."),
    K.H2("The service curve"),
    K.P("For each department, we fitted a curve to every historical block: how far its wait or response time ran above or below target at each level of utilization. The curve rises slowly, bends sharply upward near the cliff, then flattens once waits stop getting worse. Each warehouse gets its own starting level, because they break at slightly different points. Outcomes scatter around the curve, and the size of that scatter turns the curve into a chance of meeting target."),
    ...K.FIG("service_curves", "fig:curves", `The fitted chance of meeting target at each utilization, one line per warehouse, with history's observed share in five-point bands. The dashed line is the service goal, and the shaded band is the cliff, ${fx("85-90%", "F-03: the service cliff (src/diagnosis.py utilization bands)")} utilization.`,
      "Three panels, one per department: the fitted chance of meeting target stays near certain at low utilization and falls to near zero across the cliff, closely following the observed shares."),
    K.P(`Using each block's measured wait, rather than only whether it passed, matters because few blocks sit right at the cliff. Our first curve bent at a sharp corner. A calibration study found it slightly optimistic near the goal, mostly in Front End (F-62), and showed that a smooth bend fits better on every measure (F-64). We switched to the smooth bend before freezing the numbers (D-29). That moved the service limits below by less than one point of utilization and added one person to some blocks.`),
    ...K.TABLE("tab:limits", `Utilization at which a block has a ${fx("95%", "service_limits.csv, column u95")} chance of meeting target, before allowing for forecast error and callouts.`,
      ["Department", "Warehouse 1", "Warehouse 2", "Warehouse 4"],
      DEPT_IDS.map((d) => [DEPT[d], ...[1, 2, 4].map((w) => pct(limit(d, w)))]),
      [3360, 2000, 2000, 2000]),
    K.P(`So a high chance of meeting target needs utilization at or below about ${pct(lo, 0)} to ${pct(hi, 0)}, depending on the department and warehouse. **${fx("85%", "A-04 and the starter queries' target (F-17)")} utilization is a ceiling, not a target (A-04).** The starter queries in the data pack aim right at it, which leaves no room for anything to go wrong.`),
    K.H2("Allowing for risk"),
    K.P(`Three things can push a block over the cliff on the day: demand above forecast, callouts that aren't replaced, and the scatter around the curve. For each block and each possible headcount, the risk model adds up all three. Forecast error comes from the held-out tests in chapter 4. Callouts come at the historical rate for the department and situation: weekday, weekend, the day after a holiday, or illness. About ${pct(s("kpi.backfill_share"), 0)} of callouts are replaced with overtime, but only while the block has overtime room left. A simulation of ${fx("200,000", "src/risk.py: monte_carlo_chance draws")} random draws checks the calculation, and a test keeps the two within half a point.`),
    ...K.FIG("risk_example", "fig:risk", `One block's chance of meeting target at each headcount: Warehouse 2 Front End, ${DAY[D.F.risk_example.day_date]}, ${SHIFT[D.F.risk_example.shift_code].toLowerCase()}, in BASE. Each line adds one more risk. The plan takes the smallest headcount whose chance on the darkest line reaches the goal.`,
      "Line chart of the chance of meeting target against people scheduled for one block. The draft's headcount gives almost no chance and the plan's reaches the goal. Each added risk shifts the curve to the right."),
    K.P(`With the draft's ${int(r("draft"))} people, this block would run at ${pct(r("utilization_draft"), 0)} utilization and almost certainly miss its target. Looking only at the curve and its scatter, ${int(r("need.curve"))} people would reach the goal. Allowing for forecast error raises that to ${int(r("need.forecast"))}, and allowing for callouts to ${int(r("need.both"))}. The plan schedules ${int(r("plan"))}, for a ${pct(r("chance_plan.both"), 0)} chance at ${pct(r("utilization_plan"), 0)} utilization. Ignoring risk would leave this block on the edge of the cliff.`),
    K.H2("Allocating and costing staff"),
    K.P("The case fixes how a block's people are filled and paid. Regular staff come first. Then come cross-trained staff from the partner department, but only those the partner isn't already using in that shift. Overtime comes last. Regular and cross-trained staff are paid the regular hourly rate, and overtime the overtime rate. A block can't field more than its capacity, and a plan that tries is infeasible."),
    ...K.FIG("allocation_example", "fig:allocation", `How one block is filled: Warehouse 1 Merchandising, ${DAY[ex.day_date]}, ${SHIFT[ex.shift_code].toLowerCase()}, in BASE. The plan uses every person the block can field.`,
      "Stacked bars for one block: what it can field by source, what the plan uses (all of it), and what the draft uses (no overtime)."),
    ...K.TABLE("tab:allocation", `The cost of that block under the case's rule. Its partner, Front End, plans ${int(sh(1, "recommended"))} of its ${int(sh(1, "available_regular_employees"))} regular staff in the same shift, so ${int(partnerFree)} are free to cross over.`,
      ["Source", "People", "Paid hours", "Hourly rate", "Cost"],
      [
        ["Regular staff", int(a("fill_regular")), dec(hours(a("fill_regular")), 0), `$${dec(a("regular_rate"), 2)}`, money(derive("regular x hours x rate", a("fill_regular").v * a("paid_hours").v * a("regular_rate").v, a("fill_regular"), a("paid_hours"), a("regular_rate")))],
        ["Cross-trained, from Front End", int(a("fill_flex")), dec(hours(a("fill_flex")), 0), `$${dec(a("regular_rate"), 2)}`, money(derive("flex x hours x regular rate", a("fill_flex").v * a("paid_hours").v * a("regular_rate").v, a("fill_flex"), a("paid_hours"), a("regular_rate")))],
        ["Overtime", int(a("fill_overtime")), dec(hours(a("fill_overtime")), 0), `$${dec(a("overtime_rate"), 2)}`, money(otCost)],
        ["**Block total**", `**${int(a("plan"))}**`, `**${dec(hours(a("plan")), 0)}**`, "", `**${money(a("cost"))}**`],
      ], [3160, 1300, 1500, 1600, 1800], { totalRows: [3] }),
    K.H2("The search"),
    K.P(`For each block, the search looks for the smallest headcount that reaches a ${goal} chance of meeting target. Front End and Merchandising share cross-trained staff in the same shift, so the search solves the two together. In each shift it tries every feasible pair of headcounts, applies the cost rule to both, and keeps the best pair in this order:`),
    ...K.NUMS([
      `**Service first:** the highest total chance of meeting target across the two departments, counting no block above the goal.`,
      "**Then shortfall:** the fewest hours short of what the goal would need, where capacity runs out.",
      "**Then cost:** the cheapest pair.",
    ]),
    K.P(`Pharmacy has no cross-trained staff, so it is solved on its own. A department only lends people it doesn't need itself (D-17); without that rule, the search cut the busiest blocks to lend their staff, which no warehouse leader would accept. With ${int(shiftsPerScenario)} shifts per scenario, trying every pair takes seconds, so no optimization solver is needed, and the answer is exact under the case's own cost rule and the real service curve (D-06).`),
    K.P(`In the example shift, Front End needs only ${int(sh(1, "recommended"))} people for a ${pct(sh(1, "chance_met"), 0)} chance, which frees ${int(partnerFree)} cross-trained staff. Merchandising takes both and fills its last ${int(a("fill_overtime"))} places with overtime, for a ${pct(sh(0, "chance_met"), 0)} chance. Without the cross-trained staff, it would need ${int(a("fill_flex"))} more overtime places it doesn't have.`),
    K.H2("Why a total per block, not individual shifts"),
    K.BUL("**The case asks for totals.** The submission template has one row per warehouse, department, day and shift, and asks for the total number of employees in each. That is the decision the plan answers."),
    K.BUL("**The data has no one to name.** Availability comes as counts per block: regular staff, overtime and cross-trained staff. There are no individual employee records, skills or preferences to build personal schedules from."),
    K.BUL("**Managers can fill the totals from their own roster.** Each block's total comes with its split into regular, cross-trained and overtime staff, in the order the case's rule fills them."),
    K.H2(`Choosing the ${goal} goal`),
    K.P(`The goal is one setting, and the plan can be rebuilt at any other in minutes. Raising it buys service at a rising price (${K.ref("fig:goal")}). Going from ${pct(s("goal_tradeoff[scenario_code=BASE,goal=0.925].goal"), 1)} to ${goal} adds ${money(step(0.925, 0.95))} for ${pts(gain(0.925, 0.95))} of expected service. Going from ${pct(s("goal_tradeoff[scenario_code=BASE,goal=0.975].goal"), 1)} to ${pct(s("goal_tradeoff[scenario_code=BASE,goal=0.99].goal"), 0)} adds ${money(step(0.975, 0.99))} for just ${pts(gain(0.975, 0.99))}. Service is judged first, so we chose ${goal}: high enough to protect service, below the point where each extra point gets very expensive (A-13).`),
    ...K.TABLE("tab:goal", "Cost and expected service in BASE at each service goal. More blocks fall short of a higher goal, because capacity stays fixed.",
      ["Service goal", "Labor cost", "Against the draft", "Expected service", "Blocks below the goal"],
      D.S.goal_tradeoff.filter((row) => row.scenario_code === "BASE").map((row) => {
        const g = (k) => goalRow(row.goal, k);
        return [`${pct(g("goal"), Math.round(row.goal * 1000) % 10 ? 1 : 0)}${row.goal === D.S.service_goal ? " (chosen)" : ""}`, money(g("cost")),
          signedPct(derive("cost / draft cost - 1", g("cost").v / draft("BASE", "cost").v - 1, g("cost"), draft("BASE", "cost"))), pct(g("expected_met")), int(g("below_goal"))];
      }), [1960, 1850, 1850, 1850, 1850], { totalRows: D.S.goal_tradeoff.filter((row) => row.scenario_code === "BASE").map((row, i) => (row.goal === D.S.service_goal ? i : -1)).filter((i) => i >= 0) }),
    ...K.FIG("goal_tradeoff", "fig:goal", "BASE labor cost against expected service at each service goal, with the draft for comparison. Each extra point of service costs more than the last.",
      "Line chart: expected service rises with the service goal while cost rises faster at the top; the draft sits far below and to the left."),
    K.H2("What the allowance for callouts costs"),
    K.P("The case doesn't say whether judges apply callouts to submitted staffing. So we built three plans, each allowing for a different set of risks, and scored each one under three sets of conditions.", { para: { keepNext: true } }),
    ...K.TABLE("tab:buffer", "Three BASE plans, scored under each set of conditions. Service is expected service across open blocks.",
      ["Plan allows for", "Labor cost", "If both risks happen", "Forecast error, no callouts", "Neither"],
      [bufRow(BOTH, "**Both risks (our plan)**"), bufRow(FCST, "Forecast error only"), bufRow(NONE, "Neither"), bufRow("Current draft", "The current draft")],
      [2760, 1500, 1700, 1800, 1600], { totalRows: [0] }),
    K.P(`**The "Neither" row is a finding of its own.** Just moving hours to where they are needed, at about the draft's cost, beats the draft under every set of conditions. The allowance for callouts costs ${money(allowance)}. If judges ignore callouts, it gains little (${pct(buffer(FCST, "met_forecast_error_only"))} to ${pct(buffer(BOTH, "met_forecast_error_only"))}). If they apply them, it lifts expected service from ${pct(buffer(FCST, "met_both_risks"))} to ${pct(buffer(BOTH, "met_both_risks"))}. Service is judged first and history shows callouts are real, so we plan for them (A-03).`),
  ];
}

module.exports = { chapter5 };
