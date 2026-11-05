// Main slides 3-5: the diagnosis, the forecast, the engine.
const K = require("./deck_kit");
const D = require("./deck_data");
const L = require("react-icons/lu");
const { SECTION, SHIFT } = require("./slides_story");

const { T, C, M, W, TOP, BOTTOM, GAP, SIZE, text } = K;
const F = D.F;
const ROLE = ["front_end", "merchandising", "pharmacy"];

/** Nice axis bounds; pass 0 among the values to start at zero. */
function niceAxis(values, ticks = 4) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const raw = (hi - lo) / ticks, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step };
}

async function diagnosis(pres) {
  const k = D.S.kpi;
  const s = K.slide(pres, { section: SECTION, title: `Hours were about right but misplaced, and service collapses past ${F.pct(D.cliff.edge, 0)} utilization` });
  const cw = 7.73;
  const box = T.card(s, { x: M, y: TOP, w: cw, h: BOTTOM - TOP, title: "Share of blocks meeting target, by utilization", description: `${D.histWeeks} weeks of history. Each point is a 5-point band: 85% means 85 to 90%.`, name: "cliff card" });
  T.legend(s, { x: box.x, y: box.y, items: D.DEPTS.map((d, i) => ({ name: D.DEPT_NAME[d], role: ROLE[i], kind: "line" })) });
  const fr = K.frame({ x: box.x - 0.05, y: box.y + 0.4, w: box.w + 0.05, h: box.h - 0.4, l: 0.72, t: 0.42, b: 0.45 });
  const n = D.cliff.labels.length, e = D.cliff.edgeIndex;
  const b = K.band(s, fr, n, e, e, C.warning_soft);
  s.addText(`The cliff: ${F.pct(D.cliff.edge, 0)} to ${F.pct(D.cliff.edge + 0.05, 0)}`, text("label", { x: b.x - 0.9, y: fr.py - 0.36, w: b.w + 1.8, h: 0.3, align: "center", color: C.warning_ink, fontFace: T.FONT_SEMIBOLD }));
  const slot = fr.pw / n;
  s.addText("All three departments overlap", text("label", { x: fr.px + (e + 1.5) * slot, y: fr.py + fr.ph * 0.3, w: (n - e - 1.5) * slot, h: 0.3, color: C.ink_muted, wrap: false }));
  T.addLineChart(pres, s, {
    ...fr.chart, labels: D.cliff.labels, min: 0, max: 1, majorUnit: 0.25, format: "0%",
    series: D.DEPTS.map((d, i) => ({ name: D.DEPT_NAME[d], role: ROLE[i], values: D.cliff.byDept[i] })),
  });

  const rx = M + cw + GAP, rw = W - cw - GAP, th = T.KPI_MIN_H;
  const missed = D.sum(D.S.gap_value.map((g) => g.missed_blocks));
  T.kpiTile(s, { x: rx, y: TOP, w: rw, h: th, label: `Hours above need, ${D.histWeeks} weeks`, value: F.hrs(k.over_hours), icon: await K.icon(L.LuClock), chip: { label: `${F.moneyK(k.over_value, 0)} at regular rates` } });
  T.kpiTile(s, { x: rx, y: TOP + th + GAP, w: rw, h: th, label: "Hours short of need, elsewhere", value: F.hrs(k.short_hours), icon: await K.icon(L.LuUserX), chip: { label: `${F.int(missed)} blocks missed target`, tone: "risk", icon: await K.icon(L.LuTriangleAlert, C.risk_ink) } });
  const py = TOP + 2 * (th + GAP), ph = BOTTOM - py;
  K.panel(s, { x: rx, y: py, w: rw, h: ph });
  s.addImage({ data: await K.icon(L.LuShuffle, C.accent), x: rx + 0.2, y: py + 0.2, w: 0.3, h: 0.3, altText: "Move hours" });
  s.addText(`Worked hours were within ${F.pct(k.worked_vs_req85)} of need: move hours before adding them.`, text("body", { x: rx + 0.65, y: py + 0.16, w: rw - 0.85, h: ph - 0.3, color: C.ink }));
  K.notes(s, {
    id: "3", target: "1:00",
    say: [
      `We started with ${D.histWeeks} weeks of history and found two things.`,
      `First, the warehouses worked about the right hours overall, within ${F.pct(k.worked_vs_req85)} of need, but in the wrong places: ${F.int(k.over_hours)} hours above need, worth about ${F.moneyK(k.over_value, 0)}, and ${F.int(k.short_hours)} hours missing elsewhere.`,
      `Second, service doesn't fade, it falls off a cliff. Below ${F.pct(D.cliff.edge, 0)} utilization nearly every block meets target. From ${F.pct(D.cliff.edge, 0)} to ${F.pct(D.cliff.edge + 0.05, 0)}, only about ${Math.round(D.cliff.edgeMet * 10)} in 10 do. Above that, almost none.`,
      "It's the same in all three departments, which is why the lines overlap. So the job is to keep every block left of the cliff, counting the staff who actually show up, and to move hours before adding them.",
    ],
  });
}

async function forecast(pres) {
  const h = D.holidays;
  const s = K.slide(pres, { section: SECTION, title: "Our forecast carries the holiday-weekend peak that a flat weekday average leaves out" });
  T.legend(s, { x: M, y: TOP - 0.05, items: [{ name: "Our forecast", role: "plan", kind: "line" }, { name: "Benchmark: the case's flat weekday average", role: "benchmark", kind: "dash" }] });
  const cw = (W - 2 * GAP) / 3, cy = TOP + 0.4, chh = 2.62;
  const unit = { 38: "Checkout workload", 92: "Replenishment workload", 95: "Prescription workload" }; // the app's demand units
  const head = { 38: "Front End", 92: "Merchandising", 95: "Pharmacy: holiday dip" };
  const labels = D.days.map(F.wkday);
  const wi = D.days.indexOf(h.window[0]), wj = D.days.indexOf(h.window[h.window.length - 1]);
  D.fc.forEach((f, i) => {
    const x = M + i * (cw + GAP);
    const box = T.card(s, { x, y: cy, w: cw, h: chh, title: head[f.dept], description: `${unit[f.dept]} units per day`, name: `${D.DEPT_NAME[f.dept]} forecast` });
    const ax = niceAxis([0, ...f.forecast, ...f.benchmark], 3); // every department from zero
    const fr = K.frame({ x: box.x - 0.05, y: box.y - 0.05, w: box.w + 0.1, h: box.h + 0.12, l: 0.55, r: 0.02, t: 0.08, b: 0.42 });
    K.band(s, fr, labels.length, wi, wj, K.BAND, "Holidays");
    T.addLineChart(pres, s, {
      ...fr.chart, labels, min: ax.min, max: ax.max, majorUnit: ax.step, format: "#,##0",
      series: [{ name: "Benchmark", role: "benchmark", values: f.benchmark }, { name: "Our forecast", role: "plan", values: f.forecast }],
    });
  });
  const py = cy + chh + GAP, ph = BOTTOM - py;
  K.panel(s, { x: M, y: py, w: W, h: ph });
  const sw = (W - 0.4 - 2 * 0.4) / 3;
  const bt = D.S.backtest_daily.find((r) => r.group === "All");
  const stats = [
    [F.spct(D.factor(38, "pre_holiday_weekend") - 1, 0), `Front End, the weekend before ${h.holiday.holiday}, measured on MLK weekend. Merchandising ${F.spct(D.factor(92, "pre_holiday_weekend") - 1, 0)}.`],
    [F.spct(D.S.valentine_uplift["Front End"], 0), `${h.valentine.holiday} for Front End and Merchandising: a judgment call, with no history to measure it.`],
    [`${F.pct(bt.model)} vs ${F.pct(bt.benchmark)}`, "Daily error on held-out weeks, ours vs the benchmark. The gain comes from Fri–Mon."],
  ];
  stats.forEach(([v, l], i) => K.stat(s, { x: M + 0.2 + i * (sw + 0.4), y: py + 0.14, w: sw, value: v, label: l, labelH: ph - 0.75 }));
  K.notes(s, {
    id: "4", target: "0:50",
    say: [
      "The planning grid has no demand, so we forecast it from the warehouse, the weekday, the holiday calendar and the weekly level.",
      `The weekend before ${h.holiday.holiday} lifts Front End demand about ${F.pct(D.factor(38, "pre_holiday_weekend") - 1, 0)}, measured on MLK weekend, the only comparable holiday in history. We add ${F.pct(D.S.valentine_uplift["Front End"], 0)} for ${h.valentine.holiday} as a stated judgment call. Pharmacy goes the other way and dips on the holiday.`,
      `The case's benchmark, a flat weekday average, misses that shape. On held-out weeks our daily error was ${F.pct(bt.model)} against its ${F.pct(bt.benchmark)}, and the gain comes from Friday to Monday.`,
    ],
  });
}

async function engine(pres) {
  const s = K.slide(pres, { section: SECTION, title: "Our engine turns a forecast into a staffing plan that explains itself" });
  const goal = F.pct(D.S.service_goal, 0);
  const steps = [
    [L.LuTrendingUp, "Forecast", "Regression on warehouse, weekday, holidays and weekly level"],
    [L.LuGauge, "Service risk", "Chance of meeting target, allowing for callouts and forecast error"],
    [L.LuCalculator, "Cost rule", "Regular staff, then spare cross-trained staff, then overtime"],
    [L.LuSearch, "Search", "Every staffing pair per shift, ranked by service, shortfall, then cost"],
    [L.LuMessageSquareText, "Explain", "Every block gets its reason, staff sources, cost, risk and cushion"],
  ];
  const ag = 0.36, cw = (W - 4 * ag) / 5, ch = 2.5, pad = K.SLIDE.padSm;
  for (const [i, [Icon, name, desc]] of steps.entries()) {
    const x = M + i * (cw + ag);
    const box = T.card(s, { x, y: TOP, w: cw, h: ch, pad, name: `step ${name}` });
    K.iconDot(s, { x: box.x, y: box.y, icon: await K.icon(Icon, C.accent_strong), name });
    s.addText(`Step ${i + 1}`, text("label", { x: box.x + 0.7, y: box.y, w: box.w - 0.7, h: 0.56, valign: "middle" }));
    s.addText(name, text("cardTitle", { x: box.x, y: box.y + 0.66, w: box.w, h: 0.34 }));
    s.addText(desc, text("label", { x: box.x, y: box.y + 1.04, w: box.w, h: box.h - 1.04, color: C.ink_muted }));
    if (i < steps.length - 1) s.addImage({ data: await K.icon(L.LuChevronRight, C.ink_subtle), x: x + cw + (ag - 0.26) / 2, y: TOP + ch / 2 - 0.13, w: 0.26, h: 0.26, altText: "then" });
  }
  // One block, explained as the tool shows it, and the assumptions it rests on.
  const ex = D.S.explanation_examples.added;
  const by = TOP + ch + GAP, bh = BOTTOM - by, lw = 7.73;
  const box = T.card(s, { x: M, y: by, w: lw, h: bh, pad, name: "example explanation" });
  const cw2 = T.chip(s, { x: box.x, y: box.y, label: ex.headline.split(":")[0], tone: "accent", icon: await K.icon(L.LuArrowUpRight, C.accent_strong) });
  s.addText(`Warehouse ${ex.store_id}, ${ex.department}, ${ex.day}, ${SHIFT[ex.shift]}`, text("cardTitle", { x: box.x + cw2 + 0.15, y: box.y - 0.01, w: box.w - cw2 - 0.15, h: 0.34 }));
  s.addText(ex.why, text("body", { x: box.x, y: box.y + 0.46, w: box.w, h: 0.82, color: C.ink }));
  s.addText(ex.cushion_text, text("label", { x: box.x, y: box.y + 1.3, w: box.w, h: 0.28, color: C.ink_muted }));
  const k = D.S.kpi;
  const ab = T.card(s, { x: M + lw + GAP, y: by, w: W - lw - GAP, h: bh, pad, name: "key assumptions" });
  s.addText([{ text: "Key assumptions", options: { fontFace: T.FONT_SEMIBOLD, color: C.ink } }, { text: "   full list: A5", options: { color: C.ink_subtle, fontSize: SIZE.label } }], text("body", { x: ab.x, y: ab.y, w: ab.w, h: 0.3 }));
  K.bullets(s, [
    `A ${goal} chance per block is the goal`,
    `Past callout rates, ${F.pct(k.backfill_share, 0)} backfilled`,
    "MLK weekend as the holiday analog",
    `${D.holidays.valentine.holiday} ${F.spct(D.S.valentine_uplift["Front End"], 0)}, a judgment call`,
  ], { x: ab.x, y: ab.y + 0.38, w: ab.w, h: ab.h - 0.38, fontSize: SIZE.label, space: 3, color: C.ink });
  const change = Number(ex.headline.match(/^(?:Add|Cut) (\d+)/)[1]);
  K.notes(s, {
    id: "5", target: "0:45",
    say: [
      "The engine runs in five steps. It forecasts each block's demand. A service curve fitted on history turns any headcount into a chance of meeting target, after callouts and forecast error.",
      `It costs staff the case's way: regular, then cross-trained, then overtime. Then it tries every Front End and Merchandising pair in each shift, because they share cross-trained people, and keeps the best plan that reaches a ${goal} chance.`,
      `Every block explains itself: here, Warehouse ${ex.store_id} ${ex.department} on ${ex.day} gets ${change} more people, with the reason in its own numbers. The key assumptions are on the right; the full list is in the appendix.`,
    ],
  });
}

module.exports = { diagnosis, forecast, engine, niceAxis };
