// Main slides 3-5: the diagnosis, the forecast, the engine.
const K = require("./deck_kit");
const D = require("./deck_data");
const L = require("react-icons/lu");
const { SECTION, SHIFT } = require("./slides_story");

const { T, C, M, W, TOP, BOTTOM, GAP, SIZE, text } = K;
const F = D.F;

/** Nice axis bounds for a line chart that needn't start at zero. */
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
  T.legend(s, { x: box.x, y: box.y, items: D.DEPTS.map((d) => ({ name: D.DEPT_NAME[d], role: ["front_end", "merchandising", "pharmacy"][D.DEPTS.indexOf(d)], kind: "line" })) });
  const fr = K.frame({ x: box.x - 0.05, y: box.y + 0.4, w: box.w + 0.05, h: box.h - 0.4, l: 0.72, t: 0.42, b: 0.45 });
  const n = D.cliff.labels.length, e = D.cliff.edgeIndex;
  const b = K.band(s, fr, n, e, e, C.warning_soft);
  s.addText(`The cliff: ${F.pct(D.cliff.edge, 0)} to ${F.pct(D.cliff.edge + 0.05, 0)}`, text("label", { x: b.x - 0.9, y: fr.py - 0.36, w: b.w + 1.8, h: 0.3, align: "center", color: C.warning_ink, fontFace: T.FONT_SEMIBOLD }));
  T.addLineChart(pres, s, {
    ...fr.chart, labels: D.cliff.labels, min: 0, max: 1, majorUnit: 0.25, format: "0%",
    series: D.DEPTS.map((d, i) => ({ name: D.DEPT_NAME[d], role: ["front_end", "merchandising", "pharmacy"][i], values: D.cliff.byDept[i] })),
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
      `We started with ${D.histWeeks} weeks of history, and found two things.`,
      `First, the warehouses worked about the right number of hours, within ${F.pct(k.worked_vs_req85)} of what was needed, but in the wrong places: ${F.int(k.over_hours)} hours sat above need, worth about ${F.moneyK(k.over_value, 0)}, while ${F.int(k.short_hours)} hours were missing elsewhere, and ${missed} blocks missed target.`,
      `Second, service doesn't fade, it falls off a cliff. Below ${F.pct(D.cliff.edge, 0)} utilization nearly every block meets target. Between ${F.pct(D.cliff.edge, 0)} and ${F.pct(D.cliff.edge + 0.05, 0)} it's a coin flip, about ${F.pct(D.cliff.edgeMet, 0)}. Above that, almost none do.`,
      "And it's the same in all three departments. So the job is to keep every block safely left of the cliff, counting the staff who actually show up, and to move hours before adding them.",
      "That's also why we never copied staffing levels from the old schedules: they follow manager habits, not demand.",
    ],
  });
}

async function forecast(pres) {
  const h = D.holidays;
  const s = K.slide(pres, { section: SECTION, title: "Demand peaks on the holiday weekend, and the naive benchmark misses it" });
  T.legend(s, { x: M, y: TOP - 0.05, items: [{ name: "Our forecast", role: "plan", kind: "line" }, { name: "Benchmark (case's naive forecast)", role: "benchmark", kind: "dash" }, { name: h.windowName, role: T.CHART.band, kind: "bar" }] });
  const cw = (W - 2 * GAP) / 3, cy = TOP + 0.4, chh = 2.62;
  const unit = { 38: "Checkout workload", 92: "Replenishment workload", 95: "Prescription workload" }; // the app's demand units
  const labels = D.days.map(F.wkday);
  const wi = D.days.indexOf(h.window[0]), wj = D.days.indexOf(h.window[h.window.length - 1]);
  D.fc.forEach((f, i) => {
    const x = M + i * (cw + GAP);
    const box = T.card(s, { x, y: cy, w: cw, h: chh, title: D.DEPT_NAME[f.dept], description: `${unit[f.dept]} units per day`, name: `${D.DEPT_NAME[f.dept]} forecast` });
    const ax = niceAxis([...f.forecast, ...f.benchmark], 3);
    const fr = K.frame({ x: box.x - 0.05, y: box.y - 0.05, w: box.w + 0.1, h: box.h + 0.12, l: 0.55, r: 0.02, t: 0.08, b: 0.42 });
    K.band(s, fr, labels.length, wi, wj);
    T.addLineChart(pres, s, {
      ...fr.chart, labels, min: ax.min, max: ax.max, majorUnit: ax.step, format: "#,##0",
      series: [{ name: "Benchmark", role: "benchmark", values: f.benchmark }, { name: "Our forecast", role: "plan", values: f.forecast }],
    });
  });
  // What drives it, and how good it is.
  const py = cy + chh + GAP, ph = BOTTOM - py;
  K.panel(s, { x: M, y: py, w: W, h: ph });
  const sw = (W - 0.4 - 2 * 0.4) / 3;
  const bt = D.S.backtest_daily.find((r) => r.group === "All"), fm = D.S.backtest_by_day_group.find((r) => r.group === "Fri-Mon");
  const stats = [
    [F.spct(D.factor(38, "pre_holiday_weekend") - 1, 0), `Front End, the weekend before ${h.holiday.holiday}, measured on MLK weekend. Merchandising ${F.spct(D.factor(92, "pre_holiday_weekend") - 1, 0)}.`],
    [F.spct(D.S.valentine_uplift["Front End"], 0), `${h.valentine.holiday} for Front End and Merchandising: a judgment call, with no history to measure it.`],
    [`${F.pct(bt.model)} vs ${F.pct(bt.benchmark)}`, `Daily error on held-out weeks, ours vs the benchmark. The gap is all Fri–Mon: holiday distortion in the benchmark.`],
  ];
  stats.forEach(([v, l], i) => K.stat(s, { x: M + 0.2 + i * (sw + 0.4), y: py + 0.14, w: sw, value: v, label: l, labelH: ph - 0.75 }));
  K.notes(s, {
    id: "4", target: "0:50",
    say: [
      "The planning grid has no demand, so we forecast it.",
      `Demand follows the warehouse, the weekday, the holiday calendar and the weekly level. The weekend before ${h.holiday.holiday} lifts Front End demand about ${F.pct(D.factor(38, "pre_holiday_weekend") - 1, 0)}, measured on the MLK weekend, the only comparable holiday in history. We add ${F.pct(D.S.valentine_uplift["Front End"], 0)} for ${h.valentine.holiday}, as a stated judgment call.`,
      "The case's benchmark is a plain weekday average, so it flattens that holiday peak.",
      `On held-out weeks our daily error was ${F.pct(bt.model)} against the benchmark's ${F.pct(bt.benchmark)}. To be precise about that: the whole gap comes from Friday to Monday, ${F.pct(fm.model)} against ${F.pct(fm.benchmark)}, where the benchmark's average carries holiday distortion. On normal days the two agree.`,
      "So our forecast puts the extra people on Friday to Monday, where the benchmark would leave them short.",
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
    [L.LuSearch, "Search", `Tries all staffing pairs per shift and keeps the cheapest at ${goal}`],
    [L.LuMessageSquareText, "Explain", "Every block gets its reason, staff sources, cost, risk and cushion"],
  ];
  const ag = 0.36, cw = (W - 4 * ag) / 5, ch = 2.6;
  for (const [i, [Icon, name, desc]] of steps.entries()) {
    const x = M + i * (cw + ag);
    const box = T.card(s, { x, y: TOP, w: cw, h: ch, name: `step ${name}` });
    K.iconDot(s, { x: box.x, y: box.y, icon: await K.icon(Icon, C.accent_strong), name });
    s.addText(`Step ${i + 1}`, text("label", { x: box.x + 0.7, y: box.y, w: box.w - 0.7, h: 0.56, valign: "middle" }));
    s.addText(name, text("cardTitle", { x: box.x, y: box.y + 0.72, w: box.w, h: 0.34 }));
    s.addText(desc, text("label", { x: box.x, y: box.y + 1.12, w: box.w, h: box.h - 1.12, color: C.ink_muted }));
    if (i < steps.length - 1) s.addImage({ data: await K.icon(L.LuChevronRight, C.ink_subtle), x: x + cw + (ag - 0.26) / 2, y: TOP + ch / 2 - 0.13, w: 0.26, h: 0.26, altText: "then" });
  }
  // One block, explained as the tool shows it.
  const ex = D.S.explanation_examples.added;
  const by = TOP + ch + GAP;
  const box = T.card(s, { x: M, y: by, w: W, h: BOTTOM - by, name: "example explanation" });
  const change = Number(ex.headline.match(/^(?:Add|Cut) (\d+)/)[1]);
  const cw2 = T.chip(s, { x: box.x, y: box.y, label: ex.headline.split(":")[0], tone: "accent", icon: await K.icon(L.LuArrowUpRight, C.accent_strong) });
  s.addText(`Warehouse ${ex.store_id}, ${ex.department}, ${ex.day}, ${SHIFT[ex.shift]}  ·  ${ex.headline.split(": ")[1]}`, text("cardTitle", { x: box.x + cw2 + 0.15, y: box.y - 0.01, w: box.w - cw2 - 0.15, h: 0.34 }));
  s.addText(ex.why, text("body", { x: box.x, y: box.y + 0.46, w: box.w, h: 0.56, color: C.ink }));
  s.addText(ex.cushion_text, text("label", { x: box.x, y: box.y + 1.06, w: box.w, h: 0.3, color: C.ink_muted }));
  K.notes(s, {
    id: "5", target: "0:45",
    say: [
      "Here's how the engine works, in five steps.",
      `It forecasts each block's demand. A service curve, fitted on history, turns any headcount into a chance of meeting target, counting forecast error, callouts and backfill. It costs staff the way the case does: regular first, then cross-trained, then overtime. Then it searches every Front End and Merchandising combination in each shift, because they share cross-trained people, and keeps the cheapest plan that reaches a ${goal} chance.`,
      "There's no black-box solver: every shift is checked exhaustively, so the answer is the best one under the rule.",
      `And every block explains itself. Here, Warehouse ${ex.store_id} ${ex.department} on ${ex.day} gets ${change} more people, and the reason is in its own numbers.`,
    ],
  });
}

module.exports = { diagnosis, forecast, engine, niceAxis };
