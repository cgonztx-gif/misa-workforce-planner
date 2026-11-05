// Chapter 6 (results) and chapter 7 (what a warehouse leader should do).
const { fmt, fx, derive } = require("./claims");
const K = require("./kit");
const D = require("./data");

const { pct, int, money, dec, signedPct, quote } = fmt;
const { s, f, plan, draft, costChange, byDept, gap, belowGoal, pto, SCEN, DAYS, DAY, DEPT, DEPT_IDS } = D;

// The playbook's gap sentences must agree with capacity_gaps (F-50), or the report would contradict itself.
function checkPlaybook() {
  for (const sc of SCEN) {
    for (const action of D.S.playbook.scenarios[sc].actions) {
      const m = action.match(/(\d[\d,]*)[- ]person gap across (\d+) blocks|(\d[\d,]*) people short across (\d+) blocks/);
      if (!m) continue;
      const people = Number((m[1] || m[3]).replace(",", ""));
      const blocks = Number(m[2] || m[4]);
      if (people !== gap(sc).v || blocks !== gap(sc, null, "blocks_short").v) {
        throw new Error(`${sc} playbook says ${people} people in ${blocks} blocks; capacity_gaps says ${gap(sc).v} in ${gap(sc, null, "blocks_short").v}`);
      }
    }
  }
}

function chapter6() {
  const goal = pct(s("service_goal"), 0);
  const metric = (label, fn) => [label, ...SCEN.map(fn)];
  const hourDiff = (sc) => D.diff("plan hours - BASE plan hours", plan(sc, "hours"), plan("BASE", "hours"));
  const hb = (day, key) => f(`hours_by_day.${day}.${key}`);
  const feb14Share = derive("Feb 14 plan hours / capacity hours", hb("2026-02-14", "plan_hours").v / hb("2026-02-14", "capacity_hours").v, hb("2026-02-14", "plan_hours"), hb("2026-02-14", "capacity_hours"));
  const thuShare = derive("Feb 12 plan hours / capacity hours", hb("2026-02-12", "plan_hours").v / hb("2026-02-12", "capacity_hours").v, hb("2026-02-12", "plan_hours"), hb("2026-02-12", "capacity_hours"));
  const daysWithGaps = DAYS.filter((d) => D.S.capacity_gaps.some((r) => r.day_date === d));
  const added = D.planSum({ scenario_code: "BASE", is_open: "1", recommended: (v, r) => Number(v) > Number(r.draft_scheduled_employees) }, null, "BASE open blocks with plan > draft");
  const cut = D.planSum({ scenario_code: "BASE", is_open: "1", recommended: (v, r) => Number(v) < Number(r.draft_scheduled_employees) }, null, "BASE open blocks with plan < draft");
  const same = D.planSum({ scenario_code: "BASE", is_open: "1", recommended: (v, r) => Number(v) === Number(r.draft_scheduled_employees) }, null, "BASE open blocks with plan = draft");
  const BS = (k) => s(`base_shortfall.${k}`);
  const ex = (kind, key) => quote(D.S, `explanation_examples.${kind}.${key}`);
  const exHead = (kind) => {
    const e = D.S.explanation_examples[kind];
    return `Warehouse ${e.store_id} ${e.department}, ${e.day}, ${D.SHIFT[e.shift].toLowerCase()}`;
  };
  return [
    K.H1("6", "Results"),
    K.LEAD("This chapter compares the plan with the manager's draft in every scenario, by department and by day, and shows where even the best plan runs out of people."),
    K.H2("Each scenario against the draft"),
    ...K.TABLE("tab:results", "The plan against the draft in each scenario, for all three warehouses. Both are scored by the same risk model. Costs follow the case's rule and count only staff who can be fielded.",
      ["", "BASE", "PEAK", "DISRUPT"],
      [
        metric("Draft labor cost", (sc) => money(draft(sc, "cost"))),
        metric("Plan labor cost", (sc) => money(plan(sc, "cost"))),
        metric("Change in cost", (sc) => signedPct(costChange(sc))),
        metric("Draft paid hours", (sc) => dec(draft(sc, "hours"), 1)),
        metric("Plan paid hours", (sc) => dec(plan(sc, "hours"), 1)),
        metric("Plan overtime hours", (sc) => dec(plan(sc, "overtime_hours"), 1)),
        metric("Draft expected service", (sc) => pct(draft(sc, "expected_met"))),
        metric("**Plan expected service**", (sc) => `**${pct(plan(sc, "expected_met"))}**`),
        metric("Draft blocks over capacity", (sc) => int(draft(sc, "over_capacity"))),
        metric("Plan blocks over capacity", (sc) => int(plan(sc, "over_capacity"))),
        metric(`Plan blocks below the ${goal} goal`, (sc) => int(plan(sc, "below_goal"))),
      ], [3660, 1900, 1900, 1900], { totalRows: [7] }),
    ...K.FIG("plan_vs_draft", "fig:plan_vs_draft", `Expected share of blocks meeting target, draft against plan. The same values are in ${K.ref("tab:results")}.`,
      "Horizontal bar chart: the plan's expected service is far above the draft's in every scenario."),
    K.P(`**BASE** is the expected week. The plan adds ${dec(D.diff("plan hours - draft hours", plan("BASE", "hours"), draft("BASE", "hours")), 0)} paid hours, mostly on the holiday weekend, and lifts expected service by ${fmt.pts(D.diff("plan - draft expected service", plan("BASE", "expected_met"), draft("BASE", "expected_met")))}.`),
    K.P(`**PEAK** is the hardest week. The plan adds ${dec(hourDiff("PEAK"), 0)} hours against BASE, but the surge lands on the days when holiday time off already leaves the fewest people, so expected service reaches only ${pct(plan("PEAK", "expected_met"))}. That is still far above the draft's ${pct(draft("PEAK", "expected_met"))}.`),
    K.P(`**DISRUPT** has fewer people, not more demand. The plan uses ${dec(D.diff("BASE plan hours - DISRUPT plan hours", plan("BASE", "hours"), plan("DISRUPT", "hours")), 0)} fewer hours than BASE because they aren't available, and unlike the draft it never schedules people who can't be fielded. The draft is over capacity in ${int(draft("DISRUPT", "over_capacity"))} blocks; the plan in none.`),
    K.H2("By department, in every scenario"),
    ...K.TABLE("tab:by_dept", "Hours, cost and expected service by department, all warehouses. The full block-by-block comparison is in outputs/plan_vs_draft.csv.",
      ["Scenario", "Department", "Draft hours", "Plan hours", "Draft cost", "Plan cost", "Draft service", "Plan service"],
      SCEN.flatMap((sc) => DEPT_IDS.map((d, i) => [i === 0 ? `**${sc}**` : "", DEPT[d], dec(byDept(sc, d, "hours_draft"), 0), dec(byDept(sc, d, "hours"), 0),
        money(byDept(sc, d, "cost_draft")), money(byDept(sc, d, "cost")), pct(byDept(sc, d, "expected_met_draft")), pct(byDept(sc, d, "expected_met"))])),
      [1060, 1500, 1080, 1080, 1160, 1160, 1160, 1160], { size: 16, align: ["l", "l", "r", "r", "r", "r", "r", "r"] }),
    K.P(`Pharmacy changes least, because it needs few people and history ran it close to need. Front End takes the biggest hit in both PEAK and DISRUPT: its expected service falls to ${pct(byDept("PEAK", 38, "expected_met"))} and ${pct(byDept("DISRUPT", 38, "expected_met"))}, because the surge and the illness both land on it.`),
    K.H2("By day"),
    ...K.FIG("service_by_day", "fig:service_by_day", "Expected service by day, draft against plan, in each scenario. The dashed line is the goal and the shaded days are the Presidents' Day window. The label marks the plan's lowest day.",
      "Three small line charts by scenario: the plan stays near the goal except on the holiday weekend, dipping most on Saturday Feb 14 in PEAK; the draft falls much lower on those days."),
    K.P(`All three scenarios dip on the holiday weekend, and most on **Saturday, Feb 14**: Valentine's Day, the busiest day of the window, and a day when holiday time off leaves fewer people. In BASE, the plan uses ${pct(feb14Share, 0)} of the hours the warehouses can field that day, against ${pct(thuShare, 0)} on Thursday, Feb 12 (${K.ref("fig:hours")}).`),
    ...K.FIG("hours_by_day", "fig:hours", "BASE paid hours by day, draft against plan, with the most the warehouses could field each day (regular staff, usable cross-trained staff and overtime).",
      "Bar chart of BASE paid hours by day: the plan sits above the draft every day and comes close to the capacity line on Saturday Feb 14."),
    K.H2("Where capacity runs out"),
    K.P(`Some blocks can't reach the goal even using every regular and overtime person they have. ${K.ref("tab:gaps_by_day")} counts the extra people they would need.`, { para: { keepNext: true } }),
    ...K.TABLE("tab:gaps_by_day", `People short of the ${goal} goal, summed over the blocks below it. Every one of these blocks already uses all its own regular staff and overtime.`,
      ["Day", "BASE", "PEAK", "DISRUPT"],
      [
        ...daysWithGaps.map((d) => [DAY[d], ...SCEN.map((sc) => int(gap(sc, d)))]),
        ["**People short, all week**", ...SCEN.map((sc) => `**${int(gap(sc))}**`)],
        ["Blocks below the goal", ...SCEN.map((sc) => int(gap(sc, null, "blocks_short")))],
      ], [3660, 1900, 1900, 1900], { totalRows: [daysWithGaps.length] }),
    K.P(`**Being below the goal doesn't mean a block is expected to fail.** In BASE, the ${int(BS("blocks"))} blocks below the goal have an average chance of ${pct(BS("average_chance"), 0)}, and ${int(BS("near_goal_blocks"))} of them sit between ${fx("90%", "src/pipeline.py: base_shortfall near-goal band")} and the goal. Of these, ${int(BS("holiday_blocks"))} fall on Feb 13-16, including ${int(belowGoal("BASE", "2026-02-14"))} on Feb 14. On that day, ${int(BS("feb14_front_merch_at_capacity"))} of the ${int(BS("feb14_front_merch_blocks"))} Front End and Merchandising blocks are at capacity. This is an availability problem: rearranging the schedule can't fix it, but changing who is available can (chapter 7).`),
    K.P(`**The Feb 17 shortfall rests on thin data.** The ${int(BS("feb17_pharmacy_short"))} BASE blocks short that day are all Pharmacy, driven by its ${pct(D.callout(95, "day_after_holiday"), 0)} day-after-holiday callout rate, which rests on few people. At Pharmacy's ${pct(BS("feb17_weekday_rate"))} weekday rate, only ${int(BS("feb17_pharmacy_short_at_weekday_rate"))} of them would stay below the goal (A-15).`),
    K.H2("Where the plan adds and where it cuts"),
    K.P(`In BASE, the plan adds people to ${int(added)} open blocks, cuts ${int(cut)} and leaves ${int(same)} as the draft has them. Cuts come where history shows the draft's habit of scheduling more people than a block needs (chapter 3). Every change comes with its reason, filled in from the block's own numbers. Three examples from BASE:`),
    ...K.NOTE(`Added: ${exHead("added")}`, [`**${ex("added", "headline")}.** ${ex("added", "why")} ${ex("added", "demand_driver")} ${ex("added", "cushion_text")}`]),
    ...K.NOTE(`Cut: ${exHead("cut")}`, [`**${ex("cut", "headline")}.** ${ex("cut", "why")} ${ex("cut", "demand_driver")} ${ex("cut", "cushion_text")}`]),
    ...K.NOTE(`Short of the goal: ${exHead("short")}`, [`**${ex("short", "headline")}.** ${ex("short", "why")} ${ex("short", "demand_driver")}`], "warning"),
    K.P("The reasons for all blocks in every scenario are in outputs/explanations.csv, and the tool shows each one when a block is clicked."),
  ];
}

function chapter7() {
  checkPlaybook();
  const last = Math.max(...D.S.pto_what_if.map((r) => r.kept_per_block));
  const PB = (path) => quote(D.S, `playbook.${path}`);
  const pk = (n, key) => pto(n, key);
  return [
    K.H1("7", "What a warehouse leader should do"),
    K.LEAD("A plan is only useful if someone can act on it. This chapter turns the results into actions: one before the week, one for choosing the plan, and rules for the day itself."),
    K.H2("Before the week: limit holiday PTO"),
    K.P(`Holiday-weekend time off is the main reason Feb 14-15 run short. Front End's available regular staff falls by about ${fmt.abs(s("kpi.pto_fe_satsun"))} people per block that weekend, compared with recent weekends. We reran the BASE search keeping some of those people working, never more than each block lost against the last three normal weeks.`),
    ...K.FIG("pto_what_if", "fig:pto", "The holiday-PTO test in BASE: blocks below the goal, and labor cost, as more people per block are kept from holiday time off.",
      "Two small charts: blocks below the goal fall steeply as more people per block are kept from holiday PTO, while weekly labor cost falls slightly."),
    ...K.TABLE("tab:pto", "Each row reruns the BASE search with up to that many people per block kept from holiday PTO, at the regular rate.",
      ["People kept per block", "Employee shifts kept", "Blocks below the goal", "Expected service", "Labor cost", "Overtime hours"],
      D.S.pto_what_if.map((r) => [r.kept_per_block === 0 ? "None (the plan)" : int(pk(r.kept_per_block, "kept_per_block")), int(pk(r.kept_per_block, "people_kept")),
        int(pk(r.kept_per_block, "blocks_below_goal")), pct(pk(r.kept_per_block, "expected_met")), money(pk(r.kept_per_block, "cost")), dec(pk(r.kept_per_block, "overtime_hours"), 1)]),
      [2160, 1440, 1440, 1440, 1440, 1440]),
    K.P(`**Service rises and cost falls,** because regular staff replace overtime. Most of the gain comes from the first few people per block. At the highest limit, blocks below the goal fall from ${int(pk(0, "blocks_below_goal"))} to ${int(pk(last, "blocks_below_goal"))}, and none of those left falls on a day holiday PTO touches. **This is the strongest single action we found.** It assumes some PTO is still open to change, which the data can't show (A-16).`),
    K.H2("Which plan to run"),
    K.P("Each scenario's plan is ready in advance. These are the signs that should trigger a switch, and what to do in each case."),
    ...["BASE", "PEAK", "DISRUPT"].flatMap((sc) => [
      K.H3(`${sc}: ${D.SCEN_NAME[sc]}`),
      K.P(`**Use it when:** ${PB(`scenarios.${sc}.trigger`)}`),
      ...D.S.playbook.scenarios[sc].actions.map((_, i) => K.BUL(PB(`scenarios.${sc}.actions[${i}]`))),
    ]),
    K.H2("On the day"),
    K.P("Each block has a **cushion**: the number of people it can lose, or the extra demand it can take, before missing target becomes the likelier outcome. The tool shows each block's cushion. These rules use it."),
    ...K.TABLE("tab:on_the_day", "Rules for the day, from the playbook.", ["If", "Then"],
      D.S.playbook.on_the_day.map((_, i) => [PB(`on_the_day[${i}].trigger`), PB(`on_the_day[${i}].action`)]),
      [4160, 5200], { align: ["l", "l"] }),
  ];
}

module.exports = { chapter6, chapter7 };
