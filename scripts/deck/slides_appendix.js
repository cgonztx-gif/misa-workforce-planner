// The appendix divider and A1-A5: forecast method, forecast accuracy, service curve and risk, cost rule, assumptions.
const K = require("./deck_kit");
const D = require("./deck_data");
const L = require("react-icons/lu");

const { T, C, M, W, TOP, BOTTOM, GAP, SIZE, text } = K;
const F = D.F;
const SECTION = "Appendix";
const TOPICS = [
  "Forecast method", "Forecast accuracy and its limits", "Service curve and risk model", "Allocation and cost rule",
  "Key assumptions, ours marked", "Cost and service against the draft", "Where capacity runs out", "Service goal and callout allowance",
  "Validation and checks", "Data notes", "The submission file",
];
const tag = (i) => `Appendix A${i}  ·  ${TOPICS[i - 1]}`;
const appendix = (pres, i, title) => K.slide(pres, { layout: "WP Appendix", section: SECTION, title, tag: tag(i) });

async function divider(pres) {
  const s = K.slide(pres, { layout: "WP Title", section: SECTION, title: "Appendix" });
  s.addText("Supporting analysis for questions: the forecast method, the key assumptions, and cost and service against the draft. Each item on the right links to its slide.", { placeholder: "subtitle", align: "left" });
  const first = pres.slides.length + 1, cw = 5.0, x0 = K.SLIDE.w - M - cw;
  TOPICS.forEach((t, i) => {
    const x = x0, y = 1.0 + i * 0.47;
    s.addText([
      { text: `A${i + 1}  `, options: { color: C.navy_accent, fontFace: T.FONT_SEMIBOLD, hyperlink: { slide: first + i, tooltip: t } } },
      { text: t, options: { color: C.navy_ink, hyperlink: { slide: first + i, tooltip: t } } },
    ], text("body", { x, y, w: cw, h: 0.4, valign: "middle" }));
  });
  K.notes(s, { id: "A0", target: "for Q&A", say: ["Appendix. Jump to any item from here; each slide's footer names its appendix number."] });
}

async function a1(pres) {
  const k = D.S.kpi;
  const s = appendix(pres, 1, "The forecast is a regression on the calendar, with the holiday effect borrowed from MLK weekend");
  const steps = [
    ["Fit", "Log daily demand on warehouse, weekday, holiday window and week"],
    ["Level", `Predicted at the last ${D.S.level_weeks} weeks' average level, best in the backtest`],
    ["Holidays", `From MLK weekend, plus ${D.holidays.valentine.holiday} ${F.spct(D.S.valentine_uplift["Front End"], 0)} for two departments`],
    ["Shifts", "Days split by average shift shares, with Front End holiday shares"],
  ];
  const cw = (W - 3 * GAP) / 4, ch = 1.6;
  steps.forEach(([t, d], i) => {
    const box = T.card(s, { x: M + i * (cw + GAP), y: TOP, w: cw, h: ch, pad: K.SLIDE.padSm, name: `step ${t}` });
    s.addText([{ text: `${i + 1}  `, options: { color: C.accent } }, { text: t }], text("cardTitle", { x: box.x, y: box.y, w: box.w, h: 0.32 }));
    s.addText(d, text("label", { x: box.x, y: box.y + 0.4, w: box.w, h: box.h - 0.4, color: C.ink_muted }));
  });
  const ty = TOP + ch + GAP;
  s.addText("Demand drivers we tested", text("cardTitle", { x: M, y: ty, w: W, h: 0.32 }));
  const r2 = (v) => F.fixed(v, v > 0.9999 ? 6 : 3);
  K.table(s, {
    x: M, y: ty + 0.42, rowH: 0.38,
    cols: [{ w: 1.9 }, { w: 6.5 }, { w: W - 8.4 }],
    head: ["Driver", "What we found", "How it enters the plan"],
    rows: [
      ["Weekday", `R² ${r2(k.r2_dow)} on log daily demand with warehouse and weekday alone`, "In the model"],
      ["Holidays", `R² ${r2(k.r2_dow_hol)} with holiday windows; MLK is the only analog`, "In the model, borrowed from MLK"],
      ["Weekly level", `R² ${r2(k.r2_full)}; weekly levels ran ${F.fixed(k.week_level_min, 2)} to ${F.fixed(k.week_level_max, 2)}, with no trend`, `Last ${D.S.level_weeks} weeks' average level`],
      ["Weather", `Temperature adds nothing once weekday is known (r = ${F.MINUS}${F.fixed(Math.abs(k.corr_temp_resid), 3)})`, "Left out"],
      ["Promotions", `On every Fri–Sun and holiday, so inseparable (r = ${F.MINUS}${F.fixed(Math.abs(k.corr_promo_resid), 3)})`, "Calendar terms; PEAK's multipliers"],
      ["Traffic", "The data pack marks traffic_index an outcome: never a model input", "Left out"],
    ],
    cell: (r, c) => (c === 0 ? { fontFace: T.FONT_SEMIBOLD } : {}),
  });
  K.notes(s, { id: "A1", target: "for Q&A", say: [
    `The forecast is a regression on log daily demand. Warehouse and weekday alone explain ${F.pct(k.r2_dow)} of the variation, holidays take it to ${F.pct(k.r2_dow_hol)}, and the weekly level to almost all of it.`,
    "Weather and promotions add nothing once the calendar is known, because promotions run on every weekend and holiday. Traffic is an outcome in the data pack, so using it would leak the answer.",
  ] });
}

async function a2(pres) {
  const s = appendix(pres, 2, "The forecast's edge on held-out weeks comes from removing holiday distortion");
  const bd = D.S.backtest_daily.find((r) => r.group === "All"), grp = (g) => D.S.backtest_by_day_group.find((r) => r.group === g);
  const wk = D.S.backtest_by_week, bb = D.S.backtest_block.find((r) => r.group === "All");
  const cats = [["All days", bd], ["Fri–Mon", grp("Fri-Mon")], ["Tue–Thu", grp("Tue-Thu")], ["Shift blocks", bb]];
  const lw = 7.4;
  const box = T.card(s, { x: M, y: TOP, w: lw, h: BOTTOM - TOP, title: "Mean absolute error on held-out weeks", description: "Each week forecast from earlier weeks only. Lower is better.", name: "accuracy card" });
  T.legend(s, { x: box.x, y: box.y, items: [{ name: "Our forecast", role: "plan", kind: "bar" }, { name: "Benchmark", role: "benchmark", kind: "bar" }] });
  T.addBarChart(pres, s, {
    x: box.x - 0.05, y: box.y + 0.4, w: box.w + 0.05, h: box.h - 0.4, horizontal: true, showValue: true, format: "0.0%", max: 0.07, majorUnit: 0.01,
    labels: cats.map((c) => c[0]),
    series: [{ name: "Our forecast", role: "plan", values: cats.map((c) => c[1].model) }, { name: "Benchmark", role: "benchmark", values: cats.map((c) => c[1].benchmark) }],
  });
  const at = D.S.analog_test, all = at.find((r) => r.group === "All"), rx = at.find((r) => r.group === 95);
  const rx0 = M + lw + GAP, rw = W - lw - GAP;
  const lim = T.card(s, { x: rx0, y: TOP, w: rw, h: BOTTOM - TOP, title: "Limits we state", name: "limits card" });
  K.bullets(s, [
    `The held-out weeks hold no holidays, and three folds is few. By week: ${wk.map((r) => `${F.pct(r.model)} against ${F.pct(r.benchmark)}`).join(", ")}`,
    `On normal days in the planning week, the two forecasts agree within ${F.pct(D.normalGap)}`,
    `MLK weekend, the only holiday analog: ${F.pct(all.model)} error against ${F.pct(all.benchmark)}, but worse for Pharmacy (${F.pct(rx.model)} against ${F.pct(rx.benchmark)})`,
    "So we say the forecast removes holiday distortion, not that it beats the benchmark in the planning week",
  ], { x: lim.x, y: lim.y, w: lim.w, h: lim.h, fontSize: SIZE.label, space: 10 });
  K.notes(s, { id: "A2", target: "for Q&A", say: [
    `On held-out weeks, our daily error is ${F.pct(bd.model)} against ${F.pct(bd.benchmark)}. The whole gap is Friday to Monday, where the benchmark's average carries earlier holiday days. On Tuesday to Thursday they're close.`,
    "So we don't claim to beat the benchmark in the planning week, only to remove that distortion.",
  ] });
}

async function a3(pres) {
  const s = appendix(pres, 3, "A service curve fitted on history gives each block its chance of meeting target");
  const cal = D.S.service_calibration, lw = 7.3;
  const box = T.card(s, { x: M, y: TOP, w: lw, h: BOTTOM - TOP, title: "Predicted against observed, out of sample", description: "Blocks grouped by predicted chance of meeting target, in %", name: "calibration card" });
  T.legend(s, { x: box.x, y: box.y, items: [{ name: "Predicted", role: "plan", kind: "bar" }, { name: "Observed", role: "benchmark", kind: "bar" }] });
  T.addBarChart(pres, s, {
    x: box.x - 0.05, y: box.y + 0.4, w: box.w + 0.05, h: box.h - 0.4, max: 1, majorUnit: 0.25, format: "0%",
    labels: cal.map((r) => r.bin.replace("%", "").replace("-", "–")),
    series: [{ name: "Predicted", role: "plan", values: cal.map((r) => r.predicted) }, { name: "Observed", role: "benchmark", values: cal.map((r) => r.observed) }],
  });
  const rx = M + lw + GAP, rw = W - lw - GAP;
  s.addText(`Utilization for a ${F.pct(D.S.service_goal, 0)} chance`, text("cardTitle", { x: rx, y: TOP, w: rw, h: 0.32 }));
  const lim = (d, st) => F.pct(D.S.service_limits.find((r) => r.dept_id === d && r.store_id === st).u95, 1);
  const end = K.table(s, {
    x: rx, y: TOP + 0.42, rowH: 0.36,
    cols: [{ w: rw - 3 * 1.05 }, { w: 1.05, align: "right" }, { w: 1.05, align: "right" }, { w: 1.05, align: "right" }],
    head: ["Department", "W1", "W2", "W4"],
    rows: D.DEPTS.map((d) => [D.DEPT_NAME[d], lim(d, 1), lim(d, 2), lim(d, 4)]),
  });
  s.addText("What each chance allows for", text("cardTitle", { x: rx, y: end + 0.3, w: rw, h: 0.32 }));
  const sd = (d) => F.pct(D.S.forecast_sd.find((r) => r.dept_id === d).sd);
  K.bullets(s, [
    `Forecast error: ${sd(38)}, ${sd(92)} and ${sd(95)} by department, more on holiday days`,
    "Callouts by department and situation, with backfill while overtime lasts",
    "The curve's own scatter, with a smooth bend near the cliff (D-29)",
    `Calculated exactly, and checked against simulation. Brier score ${F.fixed(D.S.service_brier.model, 3)}, against ${F.fixed(D.S.service_brier.base_rate, 3)} for a flat rate`,
  ], { x: rx, y: end + 0.72, w: rw, h: BOTTOM - end - 0.72, fontSize: SIZE.label, space: 6 });
  K.notes(s, { id: "A3", target: "for Q&A", say: [
    "For each department we fit the service metric against utilization, with a smooth bend where the cliff starts, and the scatter around it.",
    `A block's chance then counts forecast error, callouts and backfill. Out of sample, predicted chances track what happened: Brier ${F.fixed(D.S.service_brier.model, 3)} against ${F.fixed(D.S.service_brier.base_rate, 3)} for a flat rate.`,
  ] });
}

module.exports = { SLIDES: [["divider", divider], ["A1", a1], ["A2", a2], ["A3", a3]], tag, appendix, TOPICS, SECTION };
