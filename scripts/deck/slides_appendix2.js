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
  const s = appendix(pres, 8, "Each extra point of service costs more than the last, and the callout allowance buys service");
  // Full-precision goal trade-off (outputs/goal_tradeoff.csv), BASE: cost per added point of expected service between goals.
  const rows = D.goalRows;
  const goalLabel = (g) => F.pct(g, (g * 1000) % 10 ? 1 : 0);
  const steps = rows.slice(1).map((r, i) => ({
    label: `${goalLabel(rows[i].goal).replace("%", "")}→${goalLabel(r.goal)}`,
    perPoint: (r.cost - rows[i].cost) / ((r.expected_met - rows[i].expected_met) * 100) / 1000,
  }));
  const lw = 6.3;
  const box = T.card(s, { x: M, y: TOP, w: lw, h: BOTTOM - TOP, title: "Cost of each extra point of service, BASE", description: "Labor cost per point of expected service, $ thousands", name: "goal card" });
  const ax = niceAxis([0, ...steps.map((x) => x.perPoint)], 4);
  T.addBarChart(pres, s, {
    x: box.x - 0.05, y: box.y, w: box.w + 0.05, h: box.h - 0.62, labels: steps.map((x) => x.label), max: ax.max, majorUnit: ax.step,
    showValue: true, format: "0.0", axisFormat: "0", series: [{ name: "Cost per point", role: "plan", values: steps.map((x) => x.perPoint) }],
  });
  const g = rows.find((r) => Math.abs(r.goal - goal) < 1e-9);
  s.addText(`Our ${goalLabel(goal)} goal: ${F.moneyK(g.cost)} for ${F.pct(g.expected_met)} expected service. A ${goalLabel(rows[rows.length - 1].goal)} goal would cost ${F.moneyK(rows[rows.length - 1].cost - g.cost)} more for ${F.fixed((rows[rows.length - 1].expected_met - g.expected_met) * 100, 1)} points.`,
    text("label", { x: box.x, y: box.y + box.h - 0.56, w: box.w, h: 0.56, color: C.ink_muted }));

  const bt = D.S.buffer_test.filter((r) => r.scenario_code === "BASE");
  const pick = (start) => bt.find((r) => r.plan.startsWith(start));
  const both = pick("Allows for both"), fc = pick("Allows for forecast"), none = pick("Allows for neither"), draft = pick("Current draft");
  const rx = M + lw + GAP, rw = W - lw - GAP;
  const card = T.card(s, { x: rx, y: TOP, w: rw, h: BOTTOM - TOP, title: "What allowing for risk buys, BASE", description: "Expected service, by which risks actually occur →", name: "buffer card" });
  const nw = 0.88, first = card.w - nw * 4;
  const end = K.table(s, {
    x: card.x, y: card.y, rowH: 0.4, headH: 0.62, margin: [0.04, 0.06, 0.04, 0.06],
    cols: [{ w: first }, { w: nw, align: "right" }, { w: nw, align: "right" }, { w: nw, align: "right" }, { w: nw, align: "right" }],
    head: ["Plan allows for", "Cost", "Both\nrisks", "Forecast\nerror", "Neither"],
    rows: [["Both risks (ours)", both], ["Forecast error", fc], ["Neither", none], ["Current draft", draft]].map(([n, r]) => [n, F.moneyK(r.cost), F.pct(r.met_both_risks, 0), F.pct(r.met_forecast_error_only, 0), F.pct(r.met_neither, 0)]),
    cell: (r, c) => (r === 0 ? { fontFace: T.FONT_SEMIBOLD, color: c ? C.accent_strong : C.ink } : r === 3 ? { color: C.ink_muted } : {}),
  });
  s.addText(`The callout allowance costs ${F.moneyK(both.cost - fc.cost)}. Moving hours alone, at about the draft's cost, already beats the draft under every condition.`, text("label", { x: card.x, y: end + 0.2, w: card.w, h: card.y + card.h - end - 0.2, color: C.ink_muted }));
  K.notes(s, { id: "A8", target: "for Q&A", say: [
    `Each extra point of expected service costs more than the last: about ${F.moneyK(steps[0].perPoint * 1000)} a point from ${goalLabel(rows[0].goal)} to ${goalLabel(rows[1].goal)}, and about ${F.moneyK(steps[steps.length - 1].perPoint * 1000)} a point above ${goalLabel(rows[rows.length - 2].goal)}.`,
    `The callout allowance costs ${F.moneyK(both.cost - fc.cost)}. If the judges don't apply callouts, that's cost without score; we planned for real conditions.`,
  ] });
}

module.exports = { SLIDES: [["A7", a7], ["A8", a8]] };
