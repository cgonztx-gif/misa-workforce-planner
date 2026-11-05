// Draft 3 main slides 7-11: the plan against the draft, every scenario, holiday PTO, the demo, the close.
const K3 = require("./d3_kit");
const D = require("./deck_data");
const L = require("react-icons/lu");
const { SECTION } = require("./d3_story");
const { SCREENSHOTS } = require("./d3_screenshots");

const { T, K, C, M, W, TOP, BOTTOM, LABEL, text } = K3;
const F = D.F;
// The recommendation from the demo script: keep this many people per block from holiday PTO. A policy choice,
// not a computed figure (as in draft 2's slides_action.js); every number shown with it is read from pto_what_if.
const KEEP = 2;

async function plan(pres) {
  const p = D.plan.BASE, d = D.draft.BASE, h = D.holidays;
  const s = K3.slide(pres, { section: SECTION, title: `Expected service rises from ${F.pct(d.expected_met)} to ${F.pct(p.expected_met)}` });
  const rows = D.S.plan_by_day.filter((r) => r.scenario_code === "BASE").sort((a, b) => a.day_date.localeCompare(b.day_date));
  const labels = rows.map((r) => F.dayShort(r.day_date));
  const cw = 8.5;
  K3.label(s, "Expected service by day, BASE", { x: M, y: TOP, w: 4.4 });
  const items = [{ name: "Draft", role: "draft", kind: "line" }, { name: "Plan", role: "plan", kind: "line" }, { name: `${F.pct(D.S.service_goal, 0)} goal`, role: "benchmark", kind: "dash" }];
  T.legend(s, { x: M + cw - 3.95, y: TOP + 0.02, items });
  const fr = K.frame({ x: M - 0.05, y: TOP + 0.45, w: cw, h: BOTTOM - TOP - 0.45, l: 0.8, r: 0.1, t: 0.15, b: 0.5 });
  const wi = D.days.indexOf(h.window[0]), wj = D.days.indexOf(h.window[h.window.length - 1]);
  K3.band(s, fr, labels.length, wi, wj, "Holiday window");
  T.addLineChart(pres, s, {
    ...fr.chart, labels, min: 0, max: 1, majorUnit: 0.25, format: "0%", catAxisLabelFontSize: LABEL, valAxisLabelFontSize: LABEL,
    series: [
      { name: "Goal", role: "benchmark", values: rows.map(() => D.S.service_goal) },
      { name: "Draft", role: "draft", values: rows.map((r) => r.expected_met_draft) },
      { name: "Plan", role: "plan", values: rows.map((r) => r.expected_met) },
    ],
  });
  // Two numbers beside it: what it costs (a deliberate trade, so gray) and the blocks still below the goal.
  const rx = M + cw + 0.6, rw = W - cw - 0.6;
  s.addShape("line", { x: rx - 0.3, y: TOP + 0.5, w: 0, h: BOTTOM - TOP - 0.9, line: { color: C.border, width: T.CHART.hairline } });
  await K3.kpi(s, { x: rx, y: TOP + 0.45, w: rw, label: "Labor cost", value: F.moneyK(p.cost), size: 44, chip: { label: `${F.spct(p.cost / d.cost - 1)} vs draft`, tone: "neutral", dir: "up" } });
  await K3.kpi(s, { x: rx, y: TOP + 2.65, w: rw, label: "Blocks below the goal", value: F.int(p.below_goal), size: 44, chip: { label: `${F.sint(p.below_goal - d.below_goal)} vs draft`, tone: "good", dir: "down" } });
  const worst = rows.reduce((a, r) => (r.expected_met_draft < a.expected_met_draft ? r : a));
  const b = D.S.buffer_test.filter((r) => r.scenario_code === "BASE"), pick = (x) => b.find((r) => r.plan.startsWith(x));
  K3.notes(s, {
    id: "7", target: "1:00",
    say: [
      `This is the answer for the expected week. Expected service, the average modeled chance that a block meets its wait target, rises from ${F.pct(d.expected_met)} in the managers' draft to ${F.pct(p.expected_met)}.`,
      `The gain is on the holiday days, where the draft runs short: on ${F.dayLong(worst.day_date)} the draft's expected service is just ${F.pct(worst.expected_met_draft, 0)}.`,
      `It costs ${F.pct(p.cost / d.cost - 1)} more labor, and blocks below our ${F.pct(D.S.service_goal, 0)} goal fall from ${d.below_goal} to ${p.below_goal}.`,
      `Where does the extra cost go? Moving hours alone, at about the draft's cost, already lifts service to ${F.pct(pick("Allows for neither").met_both_risks)}. The rest buys buffers for forecast error and callouts, because service depends on who actually shows up.`,
    ],
  });
}

async function scenarios(pres) {
  const s = K3.slide(pres, { section: SECTION, title: "The plan lifts service in every scenario" });
  const goal = D.S.service_goal, lo = 0.5, hi = 1.0;
  const name = { BASE: "Expected week", PEAK: "Demand surge", DISRUPT: "Short crews" };
  const lx = M, lw = 2.55, tx = M + lw + 0.35, tw = W - lw - 0.35 - 0.6;
  const xAt = (v) => tx + ((v - lo) / (hi - lo)) * tw;
  const y0 = TOP + 0.55, rh = 1.42;
  K3.label(s, "Expected service, draft to plan", { x: M, y: TOP, w: 6 });
  // Faint gridlines and ticks every 10 points, the goal dashed.
  for (let v = lo; v <= hi + 1e-9; v += 0.1) {
    s.addShape("line", { x: xAt(v), y: y0, w: 0, h: 3 * rh, line: { color: T.CHART.grid, width: T.CHART.hairline } });
    s.addText(F.pct(v, 0), text("label", { x: xAt(v) - 0.5, y: y0 + 3 * rh + 0.06, w: 1, h: 0.3, align: "center", color: T.CHART.tick }));
  }
  s.addShape("line", { x: xAt(goal), y: y0 - 0.1, w: 0, h: 3 * rh + 0.1, line: { color: C.benchmark, width: 1.5, dashType: T.CHART.benchmarkDash } });
  s.addText(`${F.pct(goal, 0)} goal`, text("label", { x: xAt(goal) - 1.2, y: y0 - 0.45, w: 1.15, h: 0.32, fontSize: LABEL, align: "right", color: C.benchmark, valign: "bottom" }));
  const warn = await K.icon(L.LuTriangleAlert, C.warning_ink);
  D.SCEN.forEach((code, i) => {
    const p = D.plan[code], d = D.draft[code], cy = y0 + i * rh + rh / 2 + 0.1;
    K3.chip(s, { x: lx, y: cy - 0.58, label: code, tone: "neutral" });
    s.addText(name[code], text("body", { x: lx, y: cy - 0.05, w: lw, h: 0.4, fontSize: 18, color: C.ink, valign: "middle" }));
    const xd = xAt(d.expected_met), xp = xAt(p.expected_met);
    s.addShape("line", { x: xd, y: cy, w: xp - xd, h: 0, line: { color: C.accent_line, width: 5 } });
    s.addShape("ellipse", { x: xd - 0.12, y: cy - 0.12, w: 0.24, h: 0.24, fill: { color: C.draft }, line: { color: C.surface, width: 1.5 }, objectName: `${code} draft` });
    s.addShape("ellipse", { x: xp - 0.15, y: cy - 0.15, w: 0.3, h: 0.3, fill: { color: C.accent }, line: { color: C.surface, width: 1.5 }, objectName: `${code} plan` });
    const dw = K3.textWidth(F.pct(d.expected_met), 18) + 0.06, pw = K3.textWidth(F.pct(p.expected_met), 22) + 0.06;
    s.addText(F.pct(d.expected_met), text("label", { x: xd - dw / 2, y: cy - 0.6, w: dw, h: 0.38, fontSize: 18, align: "center", color: C.ink_muted, valign: "middle", wrap: false, fill: { color: C.surface } }));
    s.addText(F.pct(p.expected_met), text("kpiValue", { x: xp - pw / 2, y: cy - 0.64, w: pw, h: 0.42, fontSize: 22, align: "center", color: C.accent_strong, valign: "middle", wrap: false, fill: { color: C.surface } }));
    // The one problem on this slide, flagged where it is: the draft schedules people who can't work.
    if (d.over_capacity > 0 && p.over_capacity === 0) {
      K3.chip(s, { x: xd - 0.15, y: cy + 0.24, label: `Draft: ${d.over_capacity} blocks over capacity`, tone: "warning", icon: warn, size: 14 });
    }
  });
  const P = D.plan, Dr = D.draft;
  const short = (code) => D.sum(D.S.capacity_gaps.filter((g) => g.scenario_code === code).map((g) => g.gap_people));
  K3.notes(s, {
    id: "8", target: "0:45",
    say: [
      "The plan changes with the conditions, and it lifts service in all three.",
      `In PEAK, demand jumps by up to ${F.pct(D.peak.maxMult - 1, 0)} on the holiday weekend. The plan lifts expected service from ${F.pct(Dr.PEAK.expected_met)} to ${F.pct(P.PEAK.expected_met)}.`,
      `In DISRUPT, illness takes people out. The draft still schedules ${Dr.DISRUPT.unfilled} people who aren't available, in ${Dr.DISRUPT.over_capacity} blocks. Ours schedules only people who can work, in every scenario.`,
      `Where PEAK and DISRUPT stay below the goal, every available person is already used: ${F.int(short("PEAK"))} and ${F.int(short("DISRUPT"))} people short at full capacity.`,
    ],
  });
}

async function pto(pres) {
  const rows = D.S.pto_what_if, r0 = rows[0], rk = rows.find((r) => r.kept_per_block === KEEP);
  const s = K3.slide(pres, { section: SECTION, title: "Limiting holiday PTO lifts service and cuts cost" });
  const cw = 7.7;
  K3.label(s, "Blocks below the goal, BASE", { x: M, y: TOP, w: cw });
  const ax = K3.niceAxis([0, ...rows.map((r) => r.blocks_below_goal)], 4);
  T.addBarChart(pres, s, {
    x: M - 0.05, y: TOP + 0.45, w: cw, h: BOTTOM - TOP - 0.95, labels: rows.map((r) => String(r.kept_per_block)),
    max: ax.max, majorUnit: ax.step, showValue: true, dataLabelFontSize: 18, catAxisLabelFontSize: LABEL, valAxisLabelFontSize: LABEL,
    chartColors: rows.map((r) => (r.kept_per_block === KEEP ? C.accent : C.accent_line)),
    series: [{ name: "Blocks below the goal", role: "plan", values: rows.map((r) => r.blocks_below_goal) }],
  });
  K3.label(s, "People kept from holiday PTO, per block", { x: M + 0.6, y: BOTTOM - 0.38, w: cw - 0.6, align: "center", color: C.ink_subtle });
  // Three numbers: keeping KEEP per block against keeping none.
  const rx = M + cw + 0.6, rw = W - cw - 0.6;
  s.addShape("line", { x: rx - 0.3, y: TOP + 0.5, w: 0, h: BOTTOM - TOP - 0.9, line: { color: C.border, width: T.CHART.hairline } });
  K3.label(s, `Keeping ${KEEP} per block, vs none`, { x: rx, y: TOP, w: rw, bold: true, color: C.ink });
  const stats = [
    [F.sint(rk.blocks_below_goal - r0.blocks_below_goal), "Blocks below the goal"],
    [F.pts(rk.expected_met - r0.expected_met), "Expected service"],
    [F.smoneyK(rk.cost - r0.cost), "Labor cost, week"],
  ];
  for (const [i, [v, l]] of stats.entries()) await K3.kpi(s, { x: rx, y: TOP + 0.55 + i * 1.45, w: rw, label: l, value: v, size: 40 });
  const hard = D.S.below_goal_by_day.filter((r) => r.scenario_code === "BASE").reduce((a, r) => (r.blocks > a.blocks ? r : a));
  K3.notes(s, {
    id: "9", target: "0:50",
    say: [
      `The blocks that stay below the goal peak on ${F.dayLong(hard.day_date)}, and the cause is holiday PTO: Front End has about ${F.fixed(-D.S.kpi.pto_fe_satsun, 0)} fewer regular staff per block than on recent weekends.`,
      `So we tested the best single action: keep a few people per block from holiday-weekend PTO. Keeping ${KEEP} per block cuts the blocks below the goal from ${r0.blocks_below_goal} to ${rk.blocks_below_goal}, lifts expected service to ${F.pct(rk.expected_met)}, and saves ${F.moneyK(r0.cost - rk.cost)}, because regular hours replace overtime.`,
      `Before the week, a leader limits that PTO, approves the holiday weekend's overtime now, and lines up extra cover for ${F.dayLong(hard.day_date)}. On the day, the playbook gives simple triggers for callouts, waits and traffic. You'll see it in the tool.`,
    ],
  });
}

async function demo(pres) {
  const shot = SCREENSHOTS.demo;
  const s = K3.slide(pres, { layout: "D3 Dark", section: SECTION, title: "Live demo: the Workforce Planner" });
  const iw = 8.85, ih = (iw * 1080) / 1920, fx = M + W - iw - 0.16, fy = TOP - 0.05;
  s.addShape("roundRect", { x: fx, y: fy, w: iw + 0.16, h: ih + 0.16, rectRadius: T.RADIUS.card, fill: { color: C.navy_raised }, line: { color: C.navy_border, width: 1 }, shadow: { type: "outer", color: "000000", opacity: 0.35, blur: 12, offset: 4, angle: 90 }, objectName: "screenshot frame" });
  s.addImage({ path: shot.file, x: fx + 0.08, y: fy + 0.08, w: iw, h: ih, altText: shot.alt });
  const lw = fx - M - 0.3;
  shot.callouts.forEach((c, i) => {
    K.marker(s, { x: fx + 0.08 + c.x * iw, y: fy + 0.08 + c.y * ih, n: c.n, d: 0.42, ring: C.on_accent });
    const y = TOP + 0.3 + i * 0.9;
    K.marker(s, { x: M + 0.21, y: y + 0.21, n: c.n, d: 0.42, ring: C.navy });
    s.addText(c.title, text("cardTitle", { x: M + 0.6, y, w: lw - 0.6, h: 0.42, fontSize: 20, color: C.navy_ink, valign: "middle" }));
  });
  const by = TOP + 0.3 + 4 * 0.9 + 0.2;
  K3.chip(s, { x: M, y: by, label: "5 minutes", tone: "navy", icon: await K.icon(L.LuPlay, C.navy_accent) });
  K3.notes(s, {
    id: "10", target: "0:10",
    say: ["Now let's open the tool. Watch four things: the scenario switch, the board, the block details, and the Scenario lab."],
    extra: [
      "[Not spoken] Demo, 5 minutes: 0:00 Overview, BASE, all warehouses. 0:40 Schedule, Warehouse 1: point at the holiday weekend. 1:10 Click Sat Feb 14, Front End, Midday.",
      "1:50 Switch to PEAK, then DISRUPT at Warehouse 2. 2:40 Demand page. 3:10 Scenario lab: demand +10%, callouts 150%, Run. 4:00 Playbook: holiday PTO. 4:40 Schedule, Download CSV.",
    ],
  });
}

async function close(pres) {
  const p = D.plan.BASE, d = D.draft.BASE;
  const maxOver = Math.max(...D.SCEN.map((c) => D.plan[c].over_capacity));
  const worstDraft = D.SCEN.reduce((a, c) => (D.draft[c].over_capacity > D.draft[a].over_capacity ? c : a));
  const s = K3.slide(pres, { layout: "D3 Dark", section: SECTION, title: "Adopt the plan and limit holiday PTO" });
  const sw = W / 3;
  [
    [F.pts(p.expected_met - d.expected_met), "Expected service, BASE"],
    [F.spct(p.cost / d.cost - 1), "Labor cost, BASE"],
    [F.int(maxOver), "Blocks over capacity, any scenario"],
  ].forEach(([v, l], i) => {
    const x = M + i * sw;
    s.addText(v, text("kpiValue", { x, y: TOP + 0.15, w: sw - 0.3, h: 1.05, fontSize: 66, color: C.navy_ink, valign: "middle" }));
    s.addText(l, text("label", { x, y: TOP + 1.25, w: sw - 0.3, h: 0.36, fontSize: 18, color: C.navy_ink_muted }));
  });
  s.addShape("line", { x: M, y: 4.05, w: W, h: 0, line: { color: C.navy_border, width: 1 } });
  K3.label(s, "What we hand over", { x: M, y: 4.35, w: 6, color: C.navy_ink_muted });
  const items = [
    [L.LuFileSpreadsheet, "Staffing CSV"],
    [L.LuLayoutDashboard, "Workforce Planner"],
    [L.LuFileText, "Report"],
    [L.LuNotebookPen, "Notebook"],
  ];
  const iw = W / 4;
  for (const [i, [Icon, nm]] of items.entries()) {
    const x = M + i * iw, y = 4.95;
    K.iconDot(s, { x, y, d: 0.62, icon: await K.icon(Icon, C.navy_accent), fill: C.navy_raised, name: nm });
    s.addText(nm, text("body", { x: x + 0.76, y, w: iw - 0.76, h: 0.62, fontSize: 18, color: C.navy_ink, fontFace: T.FONT_SEMIBOLD, valign: "middle", wrap: false }));
  }
  if (D.teamName) s.addText(`Team ${D.teamName}`, text("label", { x: K3.SLIDE.w - M - 6, y: 6.2, w: 6, h: 0.3, align: "right", color: C.navy_ink_muted }));
  K3.notes(s, {
    id: "11", target: "0:20",
    say: [
      `To close: expected service up ${F.fixed((p.expected_met - d.expected_met) * 100, 0)} points for ${F.pct(p.cost / d.cost - 1)} more labor, with no one scheduled who can't work. The draft has ${D.draft[worstDraft].over_capacity} blocks over capacity in ${worstDraft}; the plan has none.`,
      `We recommend adopting the plan, keeping people off holiday-weekend PTO, and pre-approving holiday-weekend overtime. We hand over the staffing file with all ${D.subFacts.rows} blocks, the tool, the report and the notebook. Thank you; we're happy to take questions.`,
    ],
  });
}

module.exports = { SLIDES: [["plan", plan], ["scenarios", scenarios], ["pto", pto], ["demo", demo], ["close", close]], KEEP };
