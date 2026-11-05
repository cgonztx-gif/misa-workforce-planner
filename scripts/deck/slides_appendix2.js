// Appendix A7-A8: where capacity runs out, and the service goal and callout allowance trade-offs.
const K = require("./deck_kit");
const D = require("./deck_data");
const { appendix } = require("./slides_appendix");
const { niceAxis } = require("./slides_story2");

const { T, C, M, W, TOP, BOTTOM, GAP, SIZE, text } = K;
const F = D.F;
const ROLE = { 38: "front_end", 92: "merchandising", 95: "pharmacy" };

async function a7(pres) {
  const gaps = D.S.capacity_gaps, b = D.S.base_shortfall, k = D.S.kpi;
  const gapDays = D.uniq(gaps.map((g) => g.day_date)).sort();
  const dayTotal = (code, day) => D.sum(gaps.filter((g) => g.scenario_code === code && g.day_date === day).map((g) => g.gap_people));
  const worst = gapDays.reduce((a, d) => (D.sum(D.SCEN.map((c) => dayTotal(c, d))) > D.sum(D.SCEN.map((c) => dayTotal(c, a))) ? d : a));
  const s = appendix(pres, 7, `Capacity runs out on the holiday weekend, most of all on ${F.dayLong(worst)}`);
  T.legend(s, { x: M, y: TOP - 0.05, items: D.DEPTS.map((d) => ({ name: D.DEPT_NAME[d], role: ROLE[d], kind: "bar" })) });
  s.addText("People short of need in blocks below the goal, at full capacity", text("label", { x: M + 5.2, y: TOP - 0.05, w: W - 5.2, h: 0.3, align: "right" }));
  const ax = niceAxis([0, ...D.SCEN.flatMap((c) => gapDays.map((d) => dayTotal(c, d)))], 4);
  const cw = (W - 2 * GAP) / 3, cy = TOP + 0.4, ch = 2.8;
  D.SCEN.forEach((code, i) => {
    const rows = gaps.filter((g) => g.scenario_code === code);
    const box = T.card(s, { x: M + i * (cw + GAP), y: cy, w: cw, h: ch, title: `${code}: ${D.sum(rows.map((r) => r.gap_people))} people short`, name: `${code} gaps` });
    T.addBarChart(pres, s, {
      x: box.x - 0.05, y: box.y - 0.05, w: box.w + 0.1, h: box.h + 0.12, labels: gapDays.map(F.wkday), max: ax.max, majorUnit: ax.step,
      barGrouping: "stacked", barOverlapPct: 100, barGapWidthPct: 70, dataLabelPosition: "ctr",
      series: D.DEPTS.map((d) => ({ name: D.DEPT_NAME[d], role: ROLE[d], values: gapDays.map((day) => D.sum(rows.filter((r) => r.dept_id === d && r.day_date === day).map((r) => r.gap_people))) })),
    });
  });
  const py = cy + ch + GAP, ph = BOTTOM - py;
  K.panel(s, { x: M, y: py, w: W, h: ph });
  const sw = (W - 0.4 - 2 * 0.4) / 3;
  [
    [`${b.feb14_front_merch_at_capacity} of ${b.feb14_front_merch_blocks}`, `Front End and Merchandising blocks already at capacity on ${F.dayLong(D.holidays.valentine.day)}, BASE`],
    [F.fixed(-k.pto_fe_satsun, 1), "fewer Front End regular staff per block than on recent weekends"],
    [F.pct(b.average_chance, 0), `average chance in BASE's ${b.blocks} short blocks; ${b.near_goal_blocks} of them sit at 90 to 95%`],
  ].forEach(([v, l], i) => K.stat(s, { x: M + 0.2 + i * (sw + 0.4), y: py + 0.14, w: sw, value: v, label: l, labelH: ph - 0.8 }));
  K.notes(s, { id: "A7", target: "for Q&A", say: [
    "Where the plan stays below the goal, it's because every available regular and overtime person is already used.",
    `That's the holiday weekend, above all ${F.dayLong(worst)}, when holiday PTO takes Front End staff out. Rearranging the schedule can't fix it, which is why the playbook's first action is limiting that PTO.`,
  ] });
}

async function a8(pres) {
  const goal = D.S.service_goal;
  const s = appendix(pres, 8, `Above a ${F.pct(goal, 0)} goal each point of service costs more, and the callout allowance buys service`);
  const rows = D.S.goal_tradeoff.filter((r) => r.scenario_code === "BASE").sort((a, b) => a.goal - b.goal);
  const lw = 6.3;
  const box = T.card(s, { x: M, y: TOP, w: lw, h: BOTTOM - TOP, title: "Service goal trade-off, BASE", description: "Each point is the full plan rebuilt for that goal", name: "goal card" });
  const labels = rows.map((r) => F.pct(r.goal, r.goal * 1000 % 10 ? 1 : 0));
  const half = (box.h - 0.1) / 2;
  const minis = [
    { t: "Labor cost for the week, $ thousands", v: rows.map((r) => r.cost / 1000), fmt: "#,##0" },
    { t: "Expected service", v: rows.map((r) => r.expected_met), fmt: "0%" },
  ];
  minis.forEach((m, i) => {
    const y = box.y + i * (half + 0.1);
    s.addText(m.t, text("label", { x: box.x, y, w: box.w, h: 0.28, color: C.ink, fontFace: T.FONT_SEMIBOLD }));
    const ax = niceAxis(m.v, 2);
    T.addLineChart(pres, s, { x: box.x - 0.05, y: y + 0.3, w: box.w + 0.05, h: half - 0.3, labels, min: ax.min, max: ax.max, majorUnit: ax.step, format: m.fmt, series: [{ name: m.t, role: "plan", values: m.v }] });
  });
  const bt = D.S.buffer_test.filter((r) => r.scenario_code === "BASE");
  const pick = (start) => bt.find((r) => r.plan.startsWith(start));
  const both = pick("Allows for both"), fc = pick("Allows for forecast"), none = pick("Allows for neither"), draft = pick("Current draft");
  const rx = M + lw + GAP, rw = W - lw - GAP;
  const card = T.card(s, { x: rx, y: TOP, w: rw, h: BOTTOM - TOP, title: "What allowing for risk buys, BASE", description: "Expected service when each risk occurs", name: "buffer card" });
  const nw = 0.88, first = card.w - nw * 4;
  const end = K.table(s, {
    x: card.x, y: card.y, rowH: 0.4, headH: 0.62, margin: [0.04, 0.06, 0.04, 0.06],
    cols: [{ w: first }, { w: nw, align: "right" }, { w: nw, align: "right" }, { w: nw, align: "right" }, { w: nw, align: "right" }],
    head: ["Plan allows for", "Cost", "Both\nrisks", "Forecast\nonly", "Neither"],
    rows: [["Both (ours)", both], ["Forecast error", fc], ["Neither", none], ["Current draft", draft]].map(([n, r]) => [n, F.moneyK(r.cost, 0), F.pct(r.met_both_risks, 0), F.pct(r.met_forecast_error_only, 0), F.pct(r.met_neither, 0)]),
    cell: (r, c) => (r === 0 ? { fontFace: T.FONT_SEMIBOLD, color: c ? C.accent_strong : C.ink } : r === 3 ? { color: C.ink_muted } : {}),
  });
  s.addText(`The callout allowance costs ${F.moneyK(both.cost - fc.cost)}. Moving hours alone, at about the draft's cost, already beats the draft under every condition.`, text("label", { x: card.x, y: end + 0.2, w: card.w, h: card.y + card.h - end - 0.2, color: C.ink_muted }));
  const g = (v) => rows.find((r) => Math.abs(r.goal - v) < 1e-9);
  K.notes(s, { id: "A8", target: "for Q&A", say: [
    `Each step up in the goal costs more than the last. From ${F.pct(rows[0].goal, 0)} to ${F.pct(goal, 0)} the plan costs ${F.moneyK(g(goal).cost - rows[0].cost)} more; from ${F.pct(goal, 0)} to ${F.pct(rows[rows.length - 1].goal, 0)} another ${F.moneyK(rows[rows.length - 1].cost - g(goal).cost)} buys only ${F.fixed((rows[rows.length - 1].expected_met - g(goal).expected_met) * 100, 1)} points.`,
    `The callout allowance costs ${F.moneyK(both.cost - fc.cost)}. If the judges don't apply callouts, that's cost without score; we planned for real conditions.`,
  ] });
}

module.exports = { SLIDES: [["A7", a7], ["A8", a8]] };
