// Main slides 6-7: the plan against the draft, and how it adapts to each scenario.
const K = require("./deck_kit");
const D = require("./deck_data");
const L = require("react-icons/lu");
const { SECTION } = require("./slides_story");
const { niceAxis } = require("./slides_story2");

const { T, C, M, W, TOP, BOTTOM, GAP, SIZE, text } = K;
const F = D.F;

/** Width of a legend row, as theme.legend() lays it out. */
const legendW = (items) => items.reduce((a, it) => a + (it.kind === "bar" ? 0.16 : 0.3) + 0.08 + (it.name.length * SIZE.label * 0.56) / 72 + 0.3, -0.3);

async function planSlide(pres) {
  const p = D.plan.BASE, d = D.draft.BASE, h = D.holidays;
  const s = K.slide(pres, { section: SECTION, title: `${F.pct(p.hours / d.hours - 1, 0)} more hours, placed where they're missing, lift expected service from ${F.pct(d.expected_met)} to ${F.pct(p.expected_met)}` });
  const tw = (W - 3 * GAP) / 4, th = T.KPI_MIN_H;
  const up = await K.icon(L.LuArrowUpRight, C.ink_muted), good = await K.icon(L.LuTrendingUp, C.good_ink), goodDown = await K.icon(L.LuTrendingDown, C.good_ink);
  const tiles = [
    { label: "Labor cost, BASE", icon: await K.icon(L.LuDollarSign), value: F.money(p.cost), chip: { label: `${F.smoneyK(p.cost - d.cost)} vs draft`, icon: up } },
    { label: "Paid hours", icon: await K.icon(L.LuClock), value: F.hrs(p.hours), chip: { label: `${F.sint(p.hours - d.hours)} h vs draft`, icon: up } },
    { label: "Expected service", icon: await K.icon(L.LuGauge), value: F.pct(p.expected_met), chip: { label: `${F.pts(p.expected_met - d.expected_met)} vs draft`, tone: "good", icon: good } },
    { label: "Blocks below the goal", icon: await K.icon(L.LuTriangleAlert), value: F.int(p.below_goal), chip: { label: `${F.sint(p.below_goal - d.below_goal)} vs draft`, tone: "good", icon: goodDown } },
  ];
  tiles.forEach((t, i) => T.kpiTile(s, { x: M + i * (tw + GAP), y: TOP, w: tw, h: th, ...t }));

  const rows = D.S.plan_by_day.filter((r) => r.scenario_code === "BASE").sort((a, b) => a.day_date.localeCompare(b.day_date));
  const labels = rows.map((r) => F.dayShort(r.day_date));
  const wi = D.days.indexOf(h.window[0]), wj = D.days.indexOf(h.window[h.window.length - 1]);
  const cy = TOP + th + GAP, cw = (W - GAP) / 2, chh = BOTTOM - cy;
  const charts = [
    { title: "Paid hours", legend: [{ name: "Draft", role: "draft", kind: "bar" }, { name: "Plan", role: "plan", kind: "bar" }] },
    { title: "Expected service", legend: [{ name: "Draft", role: "draft", kind: "line" }, { name: "Plan", role: "plan", kind: "line" }] },
  ];
  charts.forEach((c, i) => {
    const x = M + i * (cw + GAP);
    const box = T.card(s, { x, y: cy, w: cw, h: chh, title: c.title, name: c.title });
    T.legend(s, { x: box.x + box.w - legendW(c.legend), y: box.y - 0.5, items: c.legend });
    const fr = K.frame({ x: box.x - 0.05, y: box.y - 0.08, w: box.w + 0.1, h: box.h + 0.14, l: 0.7, r: 0.05, t: 0.08, b: 0.42 });
    K.band(s, fr, labels.length, wi, wj);
    if (i === 0) {
      const ax = niceAxis([0, ...rows.map((r) => Math.max(r.hours, r.hours_draft))], 4);
      T.addBarChart(pres, s, { ...fr.chart, labels, max: ax.max, majorUnit: ax.step, series: [{ name: "Draft", role: "draft", values: rows.map((r) => r.hours_draft) }, { name: "Plan", role: "plan", values: rows.map((r) => r.hours) }] });
    } else {
      const lo = Math.floor(Math.min(...rows.map((r) => r.expected_met_draft)) * 5) / 5;
      // The goal line is labelled directly, just under its right end.
      const gy = fr.py + (1 - (D.S.service_goal - lo) / (1 - lo)) * fr.ph;
      s.addText(`${F.pct(D.S.service_goal, 0)} goal`, text("label", { x: fr.px + fr.pw - 1.3, y: gy + 0.04, w: 1.25, h: 0.26, align: "right" }));
      T.addLineChart(pres, s, {
        ...fr.chart, labels, min: lo, max: 1, majorUnit: 0.2, format: "0%",
        series: [
          { name: "Goal", role: "benchmark", values: rows.map(() => D.S.service_goal) },
          { name: "Draft", role: "draft", values: rows.map((r) => r.expected_met_draft) },
          { name: "Plan", role: "plan", values: rows.map((r) => r.expected_met) },
        ],
      });
    }
  });
  const worst = rows.reduce((a, r) => (r.expected_met_draft < a.expected_met_draft ? r : a));
  const bt = D.S.buffer_test.filter((r) => r.scenario_code === "BASE");
  const allowance = bt.find((r) => r.plan.startsWith("Allows for both")).cost - bt.find((r) => r.plan.startsWith("Allows for forecast")).cost;
  K.notes(s, {
    id: "6", target: "1:00",
    say: [
      `This is the answer for the expected week. Against the manager's draft, the plan adds ${F.int(p.hours - d.hours)} hours, about ${F.pct(p.hours / d.hours - 1, 0)} more, for ${F.moneyK(p.cost - d.cost)} more in labor cost, or ${F.pct(p.cost / d.cost - 1)}.`,
      `Expected service, the average chance that a block meets its target, rises from ${F.pct(d.expected_met)} to ${F.pct(p.expected_met)}. Blocks below our ${F.pct(D.S.service_goal, 0)} goal fall from ${d.below_goal} to ${p.below_goal}.`,
      `The hours go where the draft runs short. The draft ignores the holiday weekend: on ${F.dayLong(worst.day_date)} its expected service is just ${F.pct(worst.expected_met_draft, 0)}. We also cut blocks that history shows are overstaffed.`,
      `Service is judged first, so we chose a ${F.pct(D.S.service_goal, 0)} goal. Each point above it costs more and more, as the appendix shows.`,
      `About ${F.moneyK(allowance)} of the extra cost is an allowance for callouts, because service depends on the people who actually show up, not the people scheduled.`,
    ],
  });
}

async function scenariosSlide(pres) {
  const s = K.slide(pres, { section: SECTION, title: "The plan adapts to each scenario, and fields every person it schedules" });
  const cw = (W - 2 * GAP) / 3, goal = D.S.service_goal;
  const name = { BASE: "The expected week", PEAK: "Promotion and storm", DISRUPT: "Illness and short crews" };
  const change = {
    BASE: "Expected demand with both holidays, as we forecast it",
    PEAK: `Demand up to ${F.spct(D.peak.maxMult - 1, 0)} on ${F.span(D.peak.days[0], D.peak.days[D.peak.days.length - 1])}; same staff as BASE`,
    DISRUPT: D.disrupt.stores.map((x) => `Warehouse ${x.store} short ${F.span(x.from, x.to)}`).join(", "),
  };
  const lo = 0.5, track = (box, v) => box.x + ((v - lo) / (1 - lo)) * box.w;
  const warn = await K.icon(L.LuTriangleAlert, C.risk_ink), check = await K.icon(L.LuCircleCheck, C.good_ink);
  D.SCEN.forEach((code, i) => {
    const p = D.plan[code], d = D.draft[code];
    const box = T.card(s, { x: M + i * (cw + GAP), y: TOP, w: cw, h: BOTTOM - TOP, name: `${code} card` });
    T.chip(s, { x: box.x, y: box.y, label: code, tone: "accent" });
    s.addText(name[code], text("cardTitle", { x: box.x, y: box.y + 0.42, w: box.w, h: 0.32 }));
    s.addText(change[code], text("label", { x: box.x, y: box.y + 0.8, w: box.w, h: 0.5, color: C.ink_muted }));
    // Expected service, draft to plan, against the goal (the app's scenario strip).
    const ty = box.y + 1.34;
    s.addText("Expected service", text("label", { x: box.x, y: ty + 0.05, w: 1.8, h: 0.3 }));
    s.addText([{ text: `${F.pct(d.expected_met)} to `, options: { color: C.ink_muted, fontSize: SIZE.label } }, { text: F.pct(p.expected_met), options: { fontFace: T.FONT_SEMIBOLD, color: C.ink, fontSize: 22 } }], text("body", { x: box.x + 1.2, y: ty - 0.02, w: box.w - 1.2, h: 0.38, align: "right", valign: "bottom" }));
    const ly = ty + 0.52;
    K.hairline(s, { x: box.x, y: ly, w: box.w, color: C.border_strong });
    s.addShape("line", { x: track(box, d.expected_met), y: ly, w: track(box, p.expected_met) - track(box, d.expected_met), h: 0, line: { color: C.accent_line, width: 3 } });
    s.addShape("line", { x: track(box, goal), y: ly - 0.13, w: 0, h: 0.26, line: { color: C.ink_subtle, width: 1, dashType: "sysDot" } });
    s.addShape("ellipse", { x: track(box, d.expected_met) - 0.08, y: ly - 0.08, w: 0.16, h: 0.16, fill: { color: C.draft }, line: { color: C.surface, width: 1.5 } });
    s.addShape("ellipse", { x: track(box, p.expected_met) - 0.09, y: ly - 0.09, w: 0.18, h: 0.18, fill: { color: C.accent }, line: { color: C.surface, width: 1.5 } });
    // The numbers, draft against plan.
    const cl = 1.75, cd = 0.75, cp = box.w - cl - cd;
    const hy = ly + 0.18;
    s.addText("Draft", text("label", { x: box.x + cl, y: hy, w: cd, h: 0.28, align: "right" }));
    s.addText("Plan", text("label", { x: box.x + cl + cd, y: hy, w: cp, h: 0.28, align: "right", color: C.accent_strong, fontFace: T.FONT_SEMIBOLD }));
    const rows = [
      ["Labor cost", F.moneyK(d.cost), F.moneyK(p.cost)],
      ["Paid hours", F.int(d.hours), F.int(p.hours)],
      ["Blocks below goal", F.int(d.below_goal), F.int(p.below_goal)],
      ["Over capacity", F.int(d.over_capacity), F.int(p.over_capacity)],
    ];
    rows.forEach(([label, dv, pv], r) => {
      const ry = hy + 0.3 + r * 0.38;
      K.hairline(s, { x: box.x, y: ry, w: box.w });
      const alarm = label === "Over capacity" && d.over_capacity > 0;
      s.addText(label, text("label", { x: box.x, y: ry, w: cl, h: 0.38, valign: "middle", color: C.ink_muted }));
      s.addText(dv, text("label", { x: box.x + cl, y: ry, w: cd, h: 0.38, align: "right", valign: "middle", color: alarm ? C.risk_ink : C.ink_subtle }));
      s.addText(pv, text("body", { x: box.x + cl + cd, y: ry, w: cp, h: 0.38, align: "right", valign: "middle", color: alarm ? C.good_ink : C.ink, fontFace: T.FONT_SEMIBOLD }));
    });
    const by = hy + 0.3 + 4 * 0.38 + 0.08;
    const hard = D.S.below_goal_by_day.filter((r) => r.scenario_code === code).reduce((a, r) => (r.blocks > a.blocks ? r : a));
    if (d.unfilled > 0) T.chip(s, { x: box.x, y: by, label: `Draft can't field ${d.unfilled} people`, tone: "risk", icon: warn });
    else T.chip(s, { x: box.x, y: by, label: `Hardest day: ${F.dayLong(hard.day_date)}`, tone: "neutral", icon: check });
  });
  const P = D.plan, Dr = D.draft;
  K.notes(s, {
    id: "7", target: "0:45",
    say: [
      "The plan changes with the conditions.",
      `In PEAK, demand jumps by up to ${F.pct(D.peak.maxMult - 1, 0)} on the holiday weekend. The plan adds ${F.int(P.PEAK.hours - P.BASE.hours)} hours over BASE and lifts expected service from ${F.pct(Dr.PEAK.expected_met)} to ${F.pct(P.PEAK.expected_met)}. It can't reach the goal everywhere, because available staff run out.`,
      `In DISRUPT, illness takes people out. The draft still schedules ${Dr.DISRUPT.unfilled} people who aren't available, across ${Dr.DISRUPT.over_capacity} blocks. Our plan schedules only people who can work: zero blocks over capacity, in every scenario, with expected service at ${F.pct(P.DISRUPT.expected_met)} against the draft's ${F.pct(Dr.DISRUPT.expected_met)}.`,
      `That's also why the DISRUPT plan costs ${F.moneyK(P.BASE.cost - P.DISRUPT.cost)} less than BASE: it can only schedule the people who are there.`,
    ],
  });
}

module.exports = { planSlide, scenariosSlide, legendW };
