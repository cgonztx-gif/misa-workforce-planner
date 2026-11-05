// Draft 3 appendix A6-A11: cost and service against the draft, capacity, the goal and callout trade-offs,
// validation, data notes, the submission file. A one-line title, one chart or one table, no paragraphs.
const K3 = require("./d3_kit");
const D = require("./deck_data");
const L = require("react-icons/lu");
const { appendix, ATOP } = require("./d3_appendix");

const { T, K, C, M, W, BOTTOM, LABEL, text } = K3;
const F = D.F;
const SHIFT = { OPEN: "Opening", MID: "Midday", EVE: "Evening" };
const ROLE = { 38: "front_end", 92: "merchandising", 95: "pharmacy" };

/** A compact line of facts under a slide's visual: [label, value] pairs separated by dots. */
function facts(s, pairs, y = BOTTOM - 0.36) {
  const runs = pairs.flatMap(([l, v], i) => [
    ...(i ? [{ text: "   ·   ", options: { color: C.ink_subtle } }] : []),
    { text: `${l} `, options: { color: C.ink_muted } },
    { text: v, options: { color: C.ink, fontFace: T.FONT_SEMIBOLD } },
  ]);
  s.addText(runs, text("body", { x: M, y, w: W, h: 0.36, fontSize: LABEL, valign: "bottom" }));
}

async function a6(pres) {
  const rows = [], strong = [];
  let allUp = true;
  for (const code of D.SCEN) {
    const p = D.plan[code], d = D.draft[code];
    strong.push(rows.length);
    rows.push([code, "All", F.int(d.hours), F.int(p.hours), F.moneyK(d.cost), F.moneyK(p.cost), F.spct(p.cost / d.cost - 1), F.pct(d.expected_met), F.pct(p.expected_met)]);
    for (const r of D.S.plan_by_dept.filter((x) => x.scenario_code === code)) {
      allUp = allUp && r.expected_met > r.expected_met_draft;
      rows.push(["", r.department, F.int(r.hours_draft), F.int(r.hours), F.moneyK(r.cost_draft), F.moneyK(r.cost), F.spct(r.cost / r.cost_draft - 1), F.pct(r.expected_met_draft), F.pct(r.expected_met)]);
    }
  }
  const s = appendix(pres, 6, allUp ? "Service rises in every scenario and department" : "Cost and service against the draft");
  const n = (W - 1.4 - 2.1) / 7, num = { w: n, align: "right" };
  const end = K.table(s, {
    x: M, y: ATOP, rowH: 0.35, headH: 0.62,
    cols: [{ w: 1.4 }, { w: 2.1 }, num, num, num, num, num, num, num],
    head: ["Scenario", "Department", "Hours\ndraft", "Hours\nplan", "Cost\ndraft", "Cost\nplan", "Cost\nchange", "Service\ndraft", "Service\nplan"],
    rows,
    cell: (r, c) => ({
      ...(strong.includes(r) ? { fontFace: T.FONT_SEMIBOLD, fill: { color: C.raised } } : {}),
      ...([2, 4, 7].includes(c) ? { color: C.ink_muted } : {}),
      ...(c === 8 ? { color: C.accent_strong, fontFace: T.FONT_SEMIBOLD } : {}),
    }),
  });
  const dd = D.draft.DISRUPT;
  facts(s, [["DISRUPT draft cost: fieldable staff only;", `${dd.unfilled} people in ${dd.over_capacity} blocks can't be fielded`]], end + 0.1);
  K3.notes(s, { id: "A6", target: "for Q&A", say: [
    "This is cost and service against the draft for every scenario and department, as the case asks. Expected service is the average predicted chance of meeting target across open blocks.",
    `Pharmacy needs the smallest change. Front End in DISRUPT stays furthest below the goal, at ${F.pct(D.S.plan_by_dept.find((r) => r.scenario_code === "DISRUPT" && r.dept_id === 38).expected_met)}, because illness removes the people it would need.`,
  ] });
}

async function a7(pres) {
  const gaps = D.S.capacity_gaps, b = D.S.base_shortfall, k = D.S.kpi;
  const gapDays = D.uniq(gaps.map((g) => g.day_date)).sort();
  const dayTotal = (code, day) => D.sum(gaps.filter((g) => g.scenario_code === code && g.day_date === day).map((g) => g.gap_people));
  const worst = gapDays.reduce((a, d) => (D.sum(D.SCEN.map((c) => dayTotal(c, d))) > D.sum(D.SCEN.map((c) => dayTotal(c, a))) ? d : a));
  const s = appendix(pres, 7, `Capacity runs out on the holiday weekend, most on ${F.dayMon(worst)}`);
  K3.label(s, "People short of need at full capacity, by day", { x: M, y: ATOP, w: 6 });
  T.legend(s, { x: M + W - 5.1, y: ATOP + 0.02, items: D.DEPTS.map((d) => ({ name: D.DEPT_NAME[d], role: ROLE[d], kind: "bar" })) });
  const ax = K3.niceAxis([0, ...D.SCEN.flatMap((c) => gapDays.map((d) => dayTotal(c, d)))], 4);
  const g = 0.35, cw = (W - 2 * g) / 3, cy = ATOP + 0.6, ch = BOTTOM - cy - 0.45;
  D.SCEN.forEach((code, i) => {
    const rows = gaps.filter((r) => r.scenario_code === code), x = M + i * (cw + g);
    s.addText([
      { text: `${code}  `, options: { fontFace: T.FONT_SEMIBOLD, color: C.ink } },
      { text: `${D.sum(rows.map((r) => r.gap_people))} short`, options: { color: C.ink_muted } },
    ], text("body", { x, y: cy, w: cw, h: 0.34, fontSize: 18 }));
    T.addBarChart(pres, s, {
      x: x - 0.05, y: cy + 0.4, w: cw + 0.1, h: ch - 0.4, labels: gapDays.map(F.wkday), max: ax.max, majorUnit: ax.step,
      barGrouping: "stacked", barOverlapPct: 100, barGapWidthPct: 70, dataLabelPosition: "ctr",
      series: D.DEPTS.map((d) => ({ name: D.DEPT_NAME[d], role: ROLE[d], values: gapDays.map((day) => D.sum(rows.filter((r) => r.dept_id === d && r.day_date === day).map((r) => r.gap_people))) })),
    });
  });
  facts(s, [[`${F.dayMon(D.holidays.valentine.day)}, BASE: Front End and Merchandising at capacity`, `${b.feb14_front_merch_at_capacity} of ${b.feb14_front_merch_blocks} blocks`], ["Holiday PTO", `${F.fixed(-k.pto_fe_satsun, 1)} fewer Front End staff per block`]]);
  K3.notes(s, { id: "A7", target: "for Q&A", say: [
    "Where the plan stays below the goal, it's because every available regular and overtime person is already used.",
    `That's the holiday weekend, above all ${F.dayLong(worst)}, when holiday PTO takes Front End staff out: about ${F.fixed(-k.pto_fe_satsun, 1)} fewer regular staff per block than on recent weekends. Rearranging the schedule can't fix it, which is why the playbook's first action is limiting that PTO.`,
    `BASE's ${b.blocks} short blocks average a ${F.pct(b.average_chance, 0)} chance, and ${b.near_goal_blocks} of them sit at 90 to 95%.`,
  ] });
}

async function a8(pres) {
  const goal = D.S.service_goal;
  const s = appendix(pres, 8, "Each extra point of service costs more than the last");
  const rows = D.goalRows;
  const goalLabel = (g) => F.pct(g, (g * 1000) % 10 ? 1 : 0);
  const steps = rows.slice(1).map((r, i) => ({
    label: `${goalLabel(rows[i].goal).replace("%", "")}→${goalLabel(r.goal)}`,
    perPoint: (r.cost - rows[i].cost) / ((r.expected_met - rows[i].expected_met) * 100) / 1000,
  }));
  const lw = 6.6;
  K3.label(s, "Labor cost per point of expected service, $K, BASE", { x: M, y: ATOP, w: lw });
  const ax = K3.niceAxis([0, ...steps.map((x) => x.perPoint)], 4);
  T.addBarChart(pres, s, {
    x: M - 0.05, y: ATOP + 0.45, w: lw, h: BOTTOM - ATOP - 0.45, labels: steps.map((x) => x.label), max: ax.max, majorUnit: ax.step,
    showValue: true, format: "0.0", axisFormat: "0", catAxisLabelFontSize: LABEL, valAxisLabelFontSize: LABEL,
    chartColors: steps.map((x) => (x.label.endsWith(goalLabel(goal)) ? C.accent : C.accent_line)),
    series: [{ name: "Cost per point", role: "plan", values: steps.map((x) => x.perPoint) }],
  });
  const bt = D.S.buffer_test.filter((r) => r.scenario_code === "BASE");
  const pick = (start) => bt.find((r) => r.plan.startsWith(start));
  const both = pick("Allows for both"), fc = pick("Allows for forecast"), none = pick("Allows for neither"), draft = pick("Current draft");
  const rx = M + lw + 0.5, rw = W - lw - 0.5;
  K3.label(s, "Expected service if these risks occur, BASE", { x: rx, y: ATOP, w: rw });
  const nw = 0.86, first = rw - nw * 4;
  K.table(s, {
    x: rx, y: ATOP + 0.5, rowH: 0.46, headH: 0.62, margin: [0.04, 0.06, 0.04, 0.06],
    cols: [{ w: first }, { w: nw, align: "right" }, { w: nw, align: "right" }, { w: nw, align: "right" }, { w: nw, align: "right" }],
    head: ["Plan allows for", "Cost", "Both\nrisks", "Forecast\nerror", "Neither"],
    rows: [["Both risks (ours)", both], ["Forecast error", fc], ["Neither", none], ["Current draft", draft]].map(([n, r]) => [n, F.moneyK(r.cost), F.pct(r.met_both_risks, 0), F.pct(r.met_forecast_error_only, 0), F.pct(r.met_neither, 0)]),
    cell: (r, c) => (r === 0 ? { fontFace: T.FONT_SEMIBOLD, color: c ? C.accent_strong : C.ink } : r === 3 ? { color: C.ink_muted } : {}),
  });
  const g = rows.find((r) => Math.abs(r.goal - goal) < 1e-9), top = rows[rows.length - 1];
  K3.notes(s, { id: "A8", target: "for Q&A", say: [
    `Each extra point of expected service costs more than the last: about ${F.moneyK(steps[0].perPoint * 1000)} a point from ${goalLabel(rows[0].goal)} to ${goalLabel(rows[1].goal)}, and about ${F.moneyK(steps[steps.length - 1].perPoint * 1000)} a point above ${goalLabel(rows[rows.length - 2].goal)}.`,
    `Our ${goalLabel(goal)} goal costs ${F.moneyK(g.cost)} for ${F.pct(g.expected_met)} expected service. A ${goalLabel(top.goal)} goal would cost ${F.moneyK(top.cost - g.cost)} more for ${F.fixed((top.expected_met - g.expected_met) * 100, 1)} points.`,
    `On the right, the callout allowance costs ${F.moneyK(both.cost - fc.cost)}. Moving hours alone, at about the draft's cost, already beats the draft under every condition. If the judges don't apply callouts, the allowance is cost without score; we planned for real conditions.`,
  ] });
}

async function a9(pres) {
  const f = D.subFacts, P = D.plan;
  const s = appendix(pres, 9, "Every check we could run passes");
  const cal = D.S.service_calibration.find((r) => r.bin === "95-99%");
  const feasible = D.SCEN.every((c) => P[c].over_capacity === 0 && P[c].below_min_staff === 0 && P[c].unfilled === 0);
  const ok = await K.icon(L.LuCircleCheck, C.good_ink);
  const rows = [
    ["Submission file", `${f.rows} rows on keys  ·  ${f.closedAtZero} closed at 0  ·  ${D.S.validator_problems.length} validator problems`],
    ["Feasibility", `${feasible ? "All" : "Not all"} ${f.open} open blocks within capacity and at or above minimum`],
    ["Cost rule", "Rebuilt row by row: every block and total to the half cent"],
    ["Search", "Independent brute force: same staffing in every shift checked"],
    ["Risk math", "Exact chance = Monte Carlo simulation"],
    ["Calibration", `Predicted 95–99%: met ${F.pct(cal.observed)} (predicted ${F.pct(cal.predicted)})`],
    ["Explanations", `Every quoted number tested, all ${f.rows} blocks`],
    ["Reproducible", "Pipeline rerun rewrites every output byte for byte"],
  ];
  const rh = 0.56, y0 = ATOP;
  rows.forEach(([name, fact], i) => {
    const y = y0 + i * rh;
    if (i) s.addShape("line", { x: M, y, w: W, h: 0, line: { color: C.border, width: T.CHART.hairline } });
    s.addImage({ data: ok, x: M, y: y + (rh - 0.28) / 2, w: 0.28, h: 0.28, altText: "Passes" });
    s.addText(name, text("body", { x: M + 0.5, y, w: 2.6, h: rh, fontSize: 18, color: C.ink, fontFace: T.FONT_SEMIBOLD, valign: "middle" }));
    s.addText(fact, text("body", { x: M + 3.2, y, w: W - 3.2, h: rh, fontSize: 18, color: C.ink_muted, valign: "middle" }));
  });
  K3.notes(s, { id: "A9", target: "for Q&A", say: [
    "How we know the numbers are right: the submission file was rebuilt independently, the cost rule recomputed row by row, the search checked by brute force, the risk math by simulation, and the model's predictions against held-out history.",
    "The report's validation chapter has the details and the commands to reproduce each one.",
  ] });
}

async function a10(pres) {
  const s = appendix(pres, 10, "Simulated data, and the quirks that shaped the method");
  const dz = D.disrupt;
  const rows = [
    [L.LuFlaskConical, "Simulated data", "Not Costco data; mock wage rates"],
    [L.LuUserX, "DISRUPT cuts more", `${dz.changedBlocks} of ${D.subFacts.perScenario} blocks, cross-trained staff too: read from the grid`],
    [L.LuCalendarDays, "Promotions follow the calendar", "Every Friday to Sunday and holiday: not separable"],
    [L.LuBan, "Traffic is an outcome", "Never a model input"],
    [L.LuRepeat, "Holiday labels differ", `MLK and ${D.holidays.holiday.holiday} mapped to shared roles`],
    [L.LuCopy, "One draft for all scenarios", `The same ${F.int(D.subFacts.draftPeople.BASE)} employee shifts in each`],
  ];
  const rh = 0.74, y0 = ATOP;
  for (const [i, [Icon, name, fact]] of rows.entries()) {
    const y = y0 + i * rh;
    if (i) s.addShape("line", { x: M, y, w: W, h: 0, line: { color: C.border, width: T.CHART.hairline } });
    K.iconDot(s, { x: M, y: y + (rh - 0.5) / 2, d: 0.5, icon: await K.icon(Icon, C.ink_muted), fill: C.raised, name });
    s.addText(name, text("body", { x: M + 0.75, y, w: 4.2, h: rh, fontSize: 18, color: C.ink, fontFace: T.FONT_SEMIBOLD, valign: "middle" }));
    s.addText(fact, text("body", { x: M + 5.0, y, w: W - 5.0, h: rh, fontSize: 18, color: C.ink_muted, valign: "middle" }));
  }
  K3.notes(s, { id: "A10", target: "for Q&A", say: [
    "The data is the case's simulated dataset, not Costco's. Three quirks shaped the method: DISRUPT removes more staff than the docs say, including cross-trained staff, promotions can't be separated from the calendar, and traffic is an outcome we must not use as an input.",
    `History names MLK weekend and the planning week names ${D.holidays.holiday.holiday}, so we mapped both to shared holiday roles. And the draft schedules the same people in all three scenarios, whatever the conditions.`,
  ] });
}

async function a11(pres) {
  const f = D.subFacts;
  const s = appendix(pres, 11, `The submission file: all ${f.rows} blocks, joined on keys`);
  const want = [["BASE", 1, 38, D.holidays.valentine.day], ["BASE", 1, 95, D.holidays.valentine.day], ["DISRUPT", 2, 38, D.holidays.valentine.day]];
  const pick = D.sub.filter((r) => want.some(([c, st, d, day]) => r.scenario_code === c && r.store_id === st && r.dept_id === d && r.day_date === day));
  K3.label(s, "A sample of rows, in the template's order", { x: M, y: ATOP, w: 8 });
  const cols = [{ w: 1.6 }, { w: 1.5, align: "right" }, { w: 2.2 }, { w: 1.3 }, { w: 1.5 }, { w: 1.4, align: "right" }, { w: W - 9.5, align: "right" }];
  K.table(s, {
    x: M, y: ATOP + 0.45, rowH: 0.35, fontSize: 14,
    cols,
    head: ["Scenario", "Warehouse", "Department", "Date", "Shift", "Draft", "Submitted"],
    rows: pick.map((r) => [r.scenario_code, String(r.store_id), r.department_group, F.dayMon(r.day_date), SHIFT[r.shift_code], String(r.draft_scheduled_employees), String(r.submitted_employees)]),
    cell: (r, c) => (c === 6 ? { fontFace: T.FONT_SEMIBOLD, color: pick[r].is_open ? C.accent_strong : C.ink_subtle } : c === 5 ? { color: C.ink_muted } : {}),
  });
  facts(s, [["Rows", `${f.rows} = ${D.SCEN.length} × ${f.perScenario}`], ["Closed", `${f.closed} at 0`], ["Value", "total employees per block"]]);
  K3.notes(s, { id: "A11", target: "for Q&A", say: [
    `The file is the case's template with all ${f.rows} rows, joined on scenario, warehouse, department, date and shift, never by row order. It holds total employees per block, as the template asks, and zero for the ${f.closed} closed Pharmacy blocks. It's the same file the tool exports.`,
    `Employee shifts, draft to plan: ${D.SCEN.map((c) => `${c} ${F.int(f.draftPeople[c])} to ${F.int(f.people[c])}`).join("; ")}.`,
  ] });
}

module.exports = { SLIDES: [["A6", a6], ["A7", a7], ["A8", a8], ["A9", a9], ["A10", a10], ["A11", a11]] };
