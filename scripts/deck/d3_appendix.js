// Draft 3 appendix: the divider and A1-A5 (forecast method, accuracy, service curve, cost rule, assumptions).
// For questions, so a slide may hold a table, but no paragraphs: a one-line title, one chart or one table.
const K3 = require("./d3_kit");
const D = require("./deck_data");
const L = require("react-icons/lu");

const { T, K, C, M, W, TOP, BOTTOM, LABEL, text } = K3;
const F = D.F;
const SECTION = "Appendix";
const TOPICS = [
  "Forecast method", "Forecast accuracy and its limits", "Service curve and risk model", "Allocation and cost rule",
  "Key assumptions, ours marked", "Cost and service against the draft", "Where capacity runs out", "Service goal and callout allowance",
  "Validation and checks", "Data notes", "The submission file",
];
const tag = (i) => `Appendix A${i}  ·  ${TOPICS[i - 1]}`;
const appendix = (pres, i, title) => K3.slide(pres, { layout: "D3 Appendix", section: SECTION, title, tag: tag(i) });
const ATOP = TOP - 0.05;

async function divider(pres) {
  const s = K3.slide(pres, { layout: "D3 Title", section: SECTION, title: "Appendix" });
  s.addText("For questions", { placeholder: "subtitle", align: "left" });
  const first = pres.slides.length + 1, cw = 5.2, x0 = K3.SLIDE.w - M - cw;
  TOPICS.forEach((t, i) => {
    s.addText([
      { text: `A${i + 1}  `, options: { color: C.navy_accent, fontFace: T.FONT_SEMIBOLD, hyperlink: { slide: first + i, tooltip: t } } },
      { text: t, options: { color: C.navy_ink, hyperlink: { slide: first + i, tooltip: t } } },
    ], text("body", { x: x0, y: 0.95 + i * 0.49, w: cw, h: 0.42, fontSize: 18, valign: "middle" }));
  });
  K3.notes(s, { id: "A0", target: "for Q&A", say: ["Appendix. Jump to any item from here; each slide's footer names its appendix number."] });
}

async function a1(pres) {
  const k = D.S.kpi;
  const s = appendix(pres, 1, "The forecast is a regression on the calendar");
  const r2 = (v) => F.fixed(v, 3);
  const bt = D.S.backtest_daily.find((r) => r.group === "All");
  const uplift = F.spct(D.S.valentine_uplift["Front End"], 0);
  K.table(s, {
    x: M, y: ATOP, rowH: 0.52, headH: 0.46, fontSize: 16,
    cols: [{ w: 2.4 }, { w: 5.4 }, { w: W - 7.8 }],
    head: ["Driver", "Evidence", "In the plan"],
    rows: [
      ["Weekday", `In-sample R² ${r2(k.r2_dow)}, with warehouse`, "In the model"],
      ["Holidays", `R² ${r2(k.r2_dow_hol)} with holiday windows`, "Borrowed from MLK weekend"],
      ["Weekly level", `Held-out error ${F.pct(bt.model)}; levels ${F.fixed(k.week_level_min, 2)} to ${F.fixed(k.week_level_max, 2)}`, `Last ${D.S.level_weeks} weeks' average`],
      [D.holidays.valentine.holiday, "No history to measure", `${uplift}, Front End and Merchandising`],
      ["Weather", `r = ${F.MINUS}${F.fixed(Math.abs(k.corr_temp_resid), 3)} after weekday`, "Left out"],
      ["Promotions", `On every Fri–Sun and holiday (r = ${F.MINUS}${F.fixed(Math.abs(k.corr_promo_resid), 3)})`, "Calendar terms; PEAK's multipliers"],
      ["Traffic", "An outcome in the data pack", "Left out"],
    ],
    cell: (r, c) => (c === 0 ? { fontFace: T.FONT_SEMIBOLD } : c === 2 ? { color: C.ink_muted } : {}),
  });
  K3.notes(s, { id: "A1", target: "for Q&A", say: [
    `The forecast is a regression on log daily demand. Warehouse and weekday alone explain ${F.pct(k.r2_dow)} of the variation, holidays take it to ${F.pct(k.r2_dow_hol)}, and the weekly level to almost all of it.`,
    `It predicts at the last ${D.S.level_weeks} weeks' average level, which did best in the backtest, borrows the holiday effect from MLK weekend, and splits days into shifts by average shift shares, with Front End's own holiday shares.`,
    "Weather and promotions add nothing once the calendar is known, because promotions run on every weekend and holiday. Traffic is an outcome in the data pack, so using it would leak the answer.",
  ] });
}

async function a2(pres) {
  const s = appendix(pres, 2, "The forecast's edge comes from Friday to Monday");
  const bd = D.S.backtest_daily.find((r) => r.group === "All"), grp = (g) => D.S.backtest_by_day_group.find((r) => r.group === g);
  const bb = D.S.backtest_block.find((r) => r.group === "All");
  const cats = [["All days", bd], ["Fri–Mon", grp("Fri-Mon")], ["Tue–Thu", grp("Tue-Thu")], ["Shift blocks", bb]];
  K3.label(s, "Mean absolute error, held-out weeks", { x: M, y: ATOP, w: 6 });
  T.legend(s, { x: M + W - 3.4, y: ATOP + 0.02, items: [{ name: "Our forecast", role: "plan", kind: "bar" }, { name: "Benchmark", role: "benchmark", kind: "bar" }] });
  T.addBarChart(pres, s, {
    x: M - 0.05, y: ATOP + 0.45, w: W + 0.05, h: BOTTOM - ATOP - 0.45, horizontal: true, showValue: true, format: "0.0%", max: 0.07, majorUnit: 0.01,
    catAxisLabelFontSize: LABEL, valAxisLabelFontSize: LABEL, dataLabelFontSize: LABEL,
    labels: cats.map((c) => c[0]),
    series: [{ name: "Our forecast", role: "plan", values: cats.map((c) => c[1].model) }, { name: "Benchmark", role: "benchmark", values: cats.map((c) => c[1].benchmark) }],
  });
  const wk = D.S.backtest_by_week, at = D.S.analog_test, all = at.find((r) => r.group === "All"), rx = at.find((r) => r.group === 95);
  K3.notes(s, { id: "A2", target: "for Q&A", say: [
    `On held-out weeks, our daily error is ${F.pct(bd.model)} against ${F.pct(bd.benchmark)}. The whole gap is Friday to Monday, where the benchmark's average carries earlier holiday days. On Tuesday to Thursday they're close.`,
    `Limits we state: the three test weeks hold no holidays, and three is few (by week: ${wk.map((r) => `${F.pct(r.model)} against ${F.pct(r.benchmark)}`).join(", ")}). On normal days in the planning week the two forecasts agree within ${F.pct(D.normalGap)}.`,
    `On MLK weekend, the only holiday analog, the error is ${F.pct(all.model)} against ${F.pct(all.benchmark)}, but worse for Pharmacy (${F.pct(rx.model)} against ${F.pct(rx.benchmark)}). So we say the forecast removes holiday distortion, not that it beats the benchmark in the planning week.`,
  ] });
}

async function a3(pres) {
  const s = appendix(pres, 3, "Predicted chances match what happened");
  const cal = D.S.service_calibration;
  K3.label(s, "Blocks meeting target, out of sample, by predicted chance", { x: M, y: ATOP, w: 7.5 });
  T.legend(s, { x: M + W - 3.1, y: ATOP + 0.02, items: [{ name: "Predicted", role: "plan", kind: "bar" }, { name: "Observed", role: "benchmark", kind: "bar" }] });
  T.addBarChart(pres, s, {
    x: M - 0.05, y: ATOP + 0.45, w: W + 0.05, h: BOTTOM - ATOP - 0.95, max: 1, majorUnit: 0.25, format: "0%",
    catAxisLabelFontSize: LABEL, valAxisLabelFontSize: LABEL,
    labels: cal.map((r) => r.bin.replace("-", "–")),
    series: [{ name: "Predicted", role: "plan", values: cal.map((r) => r.predicted) }, { name: "Observed", role: "benchmark", values: cal.map((r) => r.observed) }],
  });
  const B = D.S.service_brier;
  s.addText([
    { text: "Brier score  ", options: { color: C.ink_muted } },
    { text: F.fixed(B.model, 3), options: { color: C.ink, fontFace: T.FONT_SEMIBOLD } },
    { text: `   vs ${F.fixed(B.base_rate, 3)} for a flat rate  ·  lower is better`, options: { color: C.ink_muted } },
  ], text("body", { x: M, y: BOTTOM - 0.36, w: W, h: 0.36, fontSize: LABEL, valign: "bottom" }));
  const sd = (d) => F.pct(D.S.forecast_sd.find((r) => r.dept_id === d).sd);
  const lim = (d, st) => F.pct(D.S.service_limits.find((r) => r.dept_id === d && r.store_id === st).u95, 1);
  K3.notes(s, { id: "A3", target: "for Q&A", say: [
    "For each department we fit the service metric against utilization, with a smooth bend where the cliff starts, and the scatter around it.",
    `A block's chance then counts forecast error (${sd(38)}, ${sd(92)} and ${sd(95)} by department, more on holiday days), callouts by department and situation, and backfill while overtime lasts. The calculation is exact and checked by simulation.`,
    `Out of sample, predicted chances track what happened: Brier ${F.fixed(B.model, 3)} against ${F.fixed(B.base_rate, 3)} for a flat rate. At Warehouse 1, a ${F.pct(D.S.service_goal, 0)} chance needs utilization at or below about ${D.DEPTS.map((d) => `${lim(d, 1)} for ${D.DEPT_NAME[d]}`).join(", ")}.`,
  ] });
}

async function a4(pres) {
  const s = appendix(pres, 4, "Cost follows the case's rule, solved per shift");
  const R = D.rates, rate = (n) => `$${F.fixed(n, 2)}`;
  const steps = [
    [L.LuUsers, "Regular staff", `${rate(R.regular[0])}–${rate(R.regular[1])} / h`],
    [L.LuShuffle, "Cross-trained", "Partner's spare staff"],
    [L.LuClock, "Overtime", `${rate(R.overtime[0])}–${rate(R.overtime[1])} / h`],
  ];
  const goal = F.pct(D.S.service_goal, 0);
  const search = [[L.LuGauge, "Highest chance", `Up to the ${goal} goal`], [L.LuUserX, "Fewest hours short", "Of need"], [L.LuDollarSign, "Lowest cost", "In the case's cost order"]];
  const row = async (items, y, head) => {
    K3.label(s, head, { x: M, y, w: W, bold: true, color: C.ink });
    const cw = W / 3, d = 0.7;
    for (const [i, [Icon, name, fact]] of items.entries()) {
      const x = M + i * cw;
      K.iconDot(s, { x, y: y + 0.55, d, icon: await K.icon(Icon, C.accent_strong), name });
      s.addText(`${i + 1}  ${name}`, text("cardTitle", { x: x + d + 0.25, y: y + 0.55, w: cw - d - 0.35, h: 0.38, fontSize: 20 }));
      s.addText(fact, text("body", { x: x + d + 0.25, y: y + 0.95, w: cw - d - 0.35, h: 0.34, fontSize: LABEL, color: C.ink_muted }));
      if (i < items.length - 1) s.addImage({ data: await K.icon(L.LuChevronRight, C.ink_subtle), x: x + cw - 0.4, y: y + 0.55 + d / 2 - 0.13, w: 0.26, h: 0.26, altText: "then" });
    }
  };
  await row(steps, ATOP, "Cost order");
  s.addShape("line", { x: M, y: ATOP + 1.75, w: W, h: 0, line: { color: C.border, width: T.CHART.hairline } });
  await row(search, ATOP + 2.0, "Search order, Front End and Merchandising together");
  const p = D.plan.BASE;
  s.addText([
    { text: "BASE  ", options: { color: C.ink_muted } },
    { text: `${F.int(p.overtime_hours)} h overtime  ·  ${F.int(p.flex_hours)} h cross-trained`, options: { color: C.ink } },
  ], text("body", { x: M, y: BOTTOM - 0.36, w: W, h: 0.36, fontSize: LABEL, valign: "bottom" }));
  K3.notes(s, { id: "A4", target: "for Q&A", say: [
    `Cost follows the case's rule exactly: regular staff first, then cross-trained staff the partner department isn't using in that shift, at the regular rate, then overtime up to each block's limit, about ${F.pct(R.otPremium, 0)} more an hour.`,
    `Front End and Merchandising share cross-trained people within a shift, so the search tries every pair of headcounts together and ranks them by the highest total chance of meeting target, each block counted up to the ${goal} goal, then the fewest hours short of need, then the lowest cost.`,
  ] });
}

async function a5(pres) {
  const k = D.S.kpi;
  const ours = [
    ["A-01", "Cross-trained staff count only if the partner isn't using them", "Our reading of the README"],
    ["A-03", `Plan for callouts: ${F.pct(k.callout_rate_all)} call out, ${F.pct(k.backfill_share, 0)} backfilled`, "Six weeks of history"],
    ["A-05", `MLK weekend guides the ${D.holidays.windowName}`, "Same Friday-to-Monday shape"],
    ["A-06", `${D.holidays.valentine.holiday} ${F.spct(D.S.valentine_uplift["Front End"], 0)}, Front End and Merchandising`, "No analog; tested"],
    ["A-09", "History's service curve holds in the planning week", "The case says to estimate it"],
    ["A-12", "DISRUPT's illness brings flu-week callout rates", "Seen together in January"],
    ["A-13", `Goal: a ${F.pct(D.S.service_goal, 0)} chance in each block`, "Service is judged first"],
    ["A-14", `Next week's level: last ${D.S.level_weeks} weeks' average`, "Best in the backtest"],
    ["A-16", "Some holiday-weekend PTO can still be limited", "Approvals aren't in the data"],
  ];
  const s = appendix(pres, 5, `${ours.length} assumptions of our own, each with its basis`);
  const rows = [
    ...ours.map((r) => [...r, "Ours"]),
    ["", "Labor standards, wages, shift hours, minimum staff", "Data pack", "Case"],
    ["", "Cost order: regular, cross-trained, overtime", "Case, page 7; README", "Case"],
    ["", "Scenario demand and availability", "Planning grid", "Case"],
  ];
  K.table(s, {
    x: M, y: ATOP, rowH: 0.37,
    cols: [{ w: 0.85 }, { w: 6.6 }, { w: 3.6 }, { w: W - 11.05, align: "center" }],
    head: ["ID", "Assumption", "Basis", "Whose"],
    rows,
    cell: (r, c) => (c === 3 ? (rows[r][3] === "Ours" ? { fill: { color: C.accent_soft }, color: C.accent_strong, fontFace: T.FONT_SEMIBOLD } : { fill: { color: C.raised }, color: C.ink_muted }) : c === 0 || c === 2 ? { color: C.ink_muted } : {}),
  });
  K3.notes(s, { id: "A5", target: "for Q&A", say: [
    "These are the assumptions we added, each with its basis; the case's own are at the bottom. IDs match the report's list, which also says what happens if each is wrong.",
    "The two that matter most are planning for callouts and the 95% goal, both confirmed with the team.",
  ] });
}

module.exports = { SLIDES: [["divider", divider], ["A1", a1], ["A2", a2], ["A3", a3], ["A4", a4], ["A5", a5]], appendix, ATOP, TOPICS };
