// Main slides 8-10: the best single action, the demo, the close.
const K = require("./deck_kit");
const D = require("./deck_data");
const L = require("react-icons/lu");
const { SECTION } = require("./slides_story");
const { niceAxis } = require("./slides_story2");
const { SCREENSHOTS } = require("./screenshots");

const { T, C, M, W, TOP, BOTTOM, GAP, SIZE, text } = K;
const F = D.F;
// The recommendation from the demo script (DELIVERABLES_PLAN 7.10): keep this many people per block from
// holiday PTO. It is a policy choice, not a computed figure; every number shown is read from its row of pto_what_if.
const KEEP = 2;

async function ptoSlide(pres) {
  const rows = D.S.pto_what_if, r0 = rows[0], rk = rows.find((r) => r.kept_per_block === KEEP);
  const s = K.slide(pres, { section: SECTION, title: "The best single action is limiting holiday PTO: service rises and cost falls" });
  const lw = 7.73;
  const box = T.card(s, { x: M, y: TOP, w: lw, h: BOTTOM - TOP, title: "Keeping people from holiday PTO, BASE", description: "The plan rerun with up to N people per block kept from holiday-weekend PTO", name: "pto card" });
  const labels = rows.map((r) => String(r.kept_per_block));
  const colors = rows.map((r) => (r.kept_per_block === KEEP ? C.accent : C.accent_line));
  const mg = 0.25, mw = (box.w - 2 * mg) / 3, mh = box.h - 0.95;
  const minis = [
    { title: "Blocks below the goal", values: rows.map((r) => r.blocks_below_goal), bar: true },
    { title: "Overtime hours", values: rows.map((r) => r.overtime_hours), bar: true },
    { title: "Expected service", values: rows.map((r) => r.expected_met), bar: false },
  ];
  minis.forEach((m, i) => {
    const x = box.x + i * (mw + mg);
    s.addText(m.title, text("label", { x, y: box.y, w: mw, h: 0.28, color: C.ink, fontFace: T.FONT_SEMIBOLD }));
    const fr = K.frame({ x: x - 0.05, y: box.y + 0.32, w: mw + 0.05, h: mh - 0.32, l: m.bar ? 0.55 : 0.78, r: 0.05, t: 0.1, b: 0.42 });
    if (m.bar) {
      const ax = niceAxis([0, ...m.values], 3);
      T.addBarChart(pres, s, { ...fr.chart, labels, max: ax.max, majorUnit: ax.step, chartColors: colors, series: [{ name: m.title, role: "plan", values: m.values }] });
    } else {
      const ax = niceAxis(m.values, 3);
      T.addLineChart(pres, s, { ...fr.chart, labels, min: ax.min, max: ax.max, majorUnit: ax.step, format: "0.0%", series: [{ name: m.title, role: "plan", values: m.values }] });
    }
  });
  s.addText(`People kept from PTO per block, 0 to ${rows[rows.length - 1].kept_per_block}. Keeping ${KEEP} per block (darker bars): ${rk.blocks_below_goal} blocks below the goal instead of ${r0.blocks_below_goal}, ${F.int(rk.overtime_hours)} h of overtime instead of ${F.int(r0.overtime_hours)}, and ${F.moneyK(r0.cost - rk.cost)} less for the week.`,
    text("label", { x: box.x, y: box.y + mh + 0.05, w: box.w, h: box.y + box.h - (box.y + mh + 0.05), color: C.ink_muted }));

  // What to do, before the week and on the day.
  const rx = M + lw + GAP, rw = W - lw - GAP;
  const act = T.card(s, { x: rx, y: TOP, w: rw, h: BOTTOM - TOP, title: "What a warehouse leader does", name: "actions card" });
  const hard = D.S.below_goal_by_day.filter((r) => r.scenario_code === "BASE").reduce((a, r) => (r.blocks > a.blocks ? r : a));
  const groups = [
    ["Before the week", L.LuCalendarCheck, [
      `Keep ${KEEP} people per block off holiday-weekend PTO`,
      "Approve the holiday weekend's overtime now, not on the day",
      `Line up outside cover for ${F.dayLong(hard.day_date)}, where capacity runs out`,
    ]],
    ["On the day", L.LuActivity, [
      "Callouts past a block's cushion: cross-trained staff, then overtime",
      "Waits past target: pull help in now, not at the next shift",
      "Traffic well below forecast: offer time off in overtime blocks first",
    ]],
  ];
  let y = act.y;
  for (const [head, Icon, items] of groups) {
    s.addImage({ data: await K.icon(Icon, C.accent), x: act.x, y: y + 0.03, w: 0.24, h: 0.24, altText: head });
    s.addText(head, text("body", { x: act.x + 0.34, y, w: act.w - 0.34, h: 0.3, color: C.ink, fontFace: T.FONT_SEMIBOLD }));
    K.bullets(s, items, { x: act.x, y: y + 0.36, w: act.w, h: 1.55, fontSize: SIZE.label, space: 6 });
    y += 2.0;
  }
  K.notes(s, {
    id: "8", target: "0:45",
    say: [
      `Where the plan still falls short, it's because every available person is already used. That happens on the holiday weekend, above all ${F.dayLong(hard.day_date)}, and the reason is holiday PTO.`,
      `So we tested the best single action: keep a few people per block from holiday PTO. Keeping ${KEEP} per block cuts the blocks below the goal from ${r0.blocks_below_goal} to ${rk.blocks_below_goal}, lifts expected service from ${F.pct(r0.expected_met)} to ${F.pct(rk.expected_met)}, and saves ${F.moneyK(r0.cost - rk.cost)}, because regular hours replace overtime. Service rises and cost falls.`,
      "On the day, the playbook gives simple triggers: what to do when callouts, waits or traffic pass a block's cushion.",
    ],
  });
}

async function demoSlide(pres) {
  const shot = SCREENSHOTS.demo;
  const s = K.slide(pres, { layout: "WP Dark", section: SECTION, title: "The Workforce Planner: what you're about to see" });
  const fw = 8.3, fx = M + W - fw, iw = fw - 0.16, ih = (iw * 1080) / 1920, fh = ih + 0.16;
  s.addShape("roundRect", { x: fx, y: TOP, w: fw, h: fh, rectRadius: T.RADIUS.card, fill: { color: C.navy_raised }, line: { color: C.navy_border, width: 1 }, shadow: { type: "outer", color: "000000", opacity: 0.35, blur: 12, offset: 4, angle: 90 }, objectName: "screenshot frame" });
  s.addImage({ path: shot.file, x: fx + 0.08, y: TOP + 0.08, w: iw, h: ih, altText: shot.alt });
  const lx = M, lw = fx - M - 0.4;
  shot.callouts.forEach((c, i) => {
    K.marker(s, { x: fx + 0.08 + c.x * iw, y: TOP + 0.08 + c.y * ih, n: c.n, ring: C.on_accent });
    const y = TOP + 0.05 + i * 1.08;
    K.marker(s, { x: lx + 0.19, y: y + 0.19, n: c.n, ring: C.navy });
    s.addText(c.title, text("cardTitle", { x: lx + 0.55, y, w: lw - 0.55, h: 0.34, color: C.navy_ink }));
    s.addText(c.text, text("label", { x: lx + 0.55, y: y + 0.36, w: lw - 0.55, h: 0.6, color: C.navy_ink_muted }));
  });
  const cy = TOP + 0.05 + 4 * 1.08 + 0.1;
  s.addShape("roundRect", { x: lx, y: cy, w: 2.55, h: 0.42, rectRadius: T.RADIUS.control, fill: { color: C.navy_raised }, line: { color: C.navy_border, width: 1 }, objectName: "demo badge" });
  s.addImage({ data: await K.icon(L.LuPlay, C.navy_accent), x: lx + 0.14, y: cy + 0.1, w: 0.22, h: 0.22, altText: "Live demo" });
  s.addText("Live demo, 5 minutes", text("label", { x: lx + 0.46, y: cy, w: 2.05, h: 0.42, color: C.navy_ink, valign: "middle", fontFace: T.FONT_SEMIBOLD }));
  K.notes(s, {
    id: "9", target: "0:10",
    say: ["Now let's open the tool. Watch four things: the scenario switch, the board, the why drawer, and the Scenario lab."],
    extra: [
      "Demo script (5:00, DELIVERABLES_PLAN 7.10): 0:00 Overview, BASE, all warehouses. 0:40 Schedule, Warehouse 1, point at the holiday weekend.",
      "1:10 Click Sat Feb 14, Front End, Midday. 1:50 Switch to PEAK, then DISRUPT at Warehouse 2. 2:40 Demand page.",
      "3:10 Scenario lab: demand +10%, callouts 150%, Run. 4:00 Playbook: holiday PTO. 4:40 Schedule, Export.",
      "Open the app once before presenting so the first load isn't in front of the judges.",
    ],
  });
}

async function closeSlide(pres) {
  const p = D.plan.BASE, d = D.draft.BASE;
  const maxOver = Math.max(...D.SCEN.map((c) => D.plan[c].over_capacity));
  const worstDraft = D.SCEN.reduce((a, c) => (D.draft[c].over_capacity > D.draft[a].over_capacity ? c : a));
  const s = K.slide(pres, { layout: "WP Dark", section: SECTION, title: `Service up ${F.fixed((p.expected_met - d.expected_met) * 100, 1)} points for ${F.pct(p.cost / d.cost - 1)} more labor, and every person scheduled can work` });
  const sw = (W - 2 * GAP) / 3;
  const stats = [
    [F.pts(p.expected_met - d.expected_met), `Expected service, BASE: ${F.pct(d.expected_met)} in the draft, ${F.pct(p.expected_met)} in the plan`],
    [F.spct(p.cost / d.cost - 1), `Labor cost, BASE: ${F.moneyK(d.cost)} in the draft, ${F.moneyK(p.cost)} in the plan`],
    [F.int(maxOver), `Blocks over capacity in any scenario. The draft has ${D.draft[worstDraft].over_capacity} in ${worstDraft}.`],
  ];
  stats.forEach(([v, l], i) => K.stat(s, { x: M + i * (sw + GAP), y: TOP + 0.05, w: sw, value: v, label: l, size: 54, valueColor: C.navy_ink, labelColor: C.navy_ink_muted, labelH: 0.6 }));
  K.hairline(s, { x: M, y: 4.05, w: W, color: C.navy_border });
  s.addText("What we hand over", text("cardTitle", { x: M, y: 4.3, w: W, h: 0.34, color: C.navy_ink }));
  const items = [
    [L.LuFileSpreadsheet, "Staffing plan", `All ${D.subFacts.rows} blocks, three scenarios, in the case's template`],
    [L.LuLayoutDashboard, "Workforce Planner", "The tool you just saw, running on one laptop"],
    [L.LuFileText, "Report", "Method, assumptions and results, for any reader"],
    [L.LuNotebookPen, "Notebook", "The analysis code, run top to bottom"],
  ];
  const iw = (W - 3 * GAP) / 4;
  for (const [i, [Icon, name, desc]] of items.entries()) {
    const x = M + i * (iw + GAP), y = 4.85;
    K.iconDot(s, { x, y, d: 0.52, icon: await K.icon(Icon, C.navy_accent), fill: C.navy_raised, name });
    s.addText(name, text("body", { x: x + 0.66, y: y - 0.02, w: iw - 0.66, h: 0.3, color: C.navy_ink, fontFace: T.FONT_SEMIBOLD }));
    s.addText(desc, text("label", { x: x + 0.66, y: y + 0.3, w: iw - 0.66, h: 0.66, color: C.navy_ink_muted }));
  }
  K.notes(s, {
    id: "10", target: "0:20",
    say: [
      `To close: expected service up ${F.fixed((p.expected_met - d.expected_met) * 100, 0)} points, for ${F.pct(p.cost / d.cost - 1, 0)} more labor, with no one scheduled who can't work, in any scenario.`,
      "We hand over the staffing file, the tool, the report and the notebook. Thank you. We're happy to take questions.",
    ],
  });
}

module.exports = { SLIDES: [["pto", ptoSlide], ["demo", demoSlide], ["close", closeSlide]], KEEP };
