// Draft 3 main slides 1-6: title, the week, the diagnosis (two slides), the forecast, the engine.
// One takeaway per slide: a one-line title, one visual, at most three numbers. The talk is in the notes.
const K3 = require("./d3_kit");
const D = require("./deck_data");
const L = require("react-icons/lu");

const { T, K, C, M, W, TOP, BOTTOM, GAP, LABEL, SIZE, text } = K3;
const F = D.F;
const SECTION = "The case for the plan";
const DEPT_ICON = { 38: L.LuShoppingCart, 92: L.LuPackage, 95: L.LuPill };
const METRIC = { 38: "checkout wait", 92: "replenishment response", 95: "prescription wait" };
const UNIT = { minutes: "min" };
const week = () => F.span(D.days[0], D.days[D.days.length - 1]);

/** The simulated-data badge on navy. */
async function simulatedBadge(s, x, y) {
  const str = K.SIMULATED, bw = K3.textWidth(str, LABEL) + 0.6;
  s.addShape("roundRect", { x, y, w: bw, h: 0.46, rectRadius: T.RADIUS.control, fill: { color: C.navy_raised }, line: { color: C.navy_border, width: 1 }, objectName: "simulated badge" });
  s.addImage({ data: await K.icon(L.LuFlaskConical, C.navy_accent), x: x + 0.15, y: y + 0.12, w: 0.22, h: 0.22, altText: "Simulated data" });
  s.addText(str, text("label", { x: x + 0.46, y, w: bw - 0.5, h: 0.46, fontSize: LABEL, color: C.navy_ink, valign: "middle", fontFace: T.FONT_SEMIBOLD, wrap: false }));
}

async function title(pres) {
  const s = K3.slide(pres, { layout: "D3 Title", section: SECTION, title: "Workforce Planner" });
  s.addText(`Costco holiday-week staffing  ·  ${week()}`, { placeholder: "subtitle", align: "left" });
  s.addShape("roundRect", { x: M, y: M, w: 0.46, h: 0.46, rectRadius: T.RADIUS.control, fill: { color: C.accent }, line: { type: "none" }, objectName: "app mark" });
  s.addImage({ data: await K.icon(L.LuLayoutGrid, C.on_accent), x: M + 0.1, y: M + 0.1, w: 0.26, h: 0.26, altText: "Workforce Planner mark" });
  s.addText("Texas MISA Fall 2026 Case Competition", text("body", { x: M + 0.62, y: M, w: 7, h: 0.46, fontSize: LABEL, color: C.navy_ink_muted, valign: "middle" }));
  if (D.teamName) s.addText(`Team ${D.teamName}`, text("cardTitle", { x: M, y: 4.45, w: 7, h: 0.4, color: C.navy_ink, fontSize: 22 }));
  await simulatedBadge(s, M, 5.55);

  // The board as the title's picture: Warehouse 1, BASE, change against the draft. No legend; it is a motif here.
  const bx = 8.6, g = 0.07, cw = (K3.SLIDE.w - M - bx - 6 * g) / 7, ch = 0.36, dg = 0.22;
  let y = 1.4;
  for (const dept of D.DEPTS) {
    for (const shift of ["OPEN", "MID", "EVE"]) {
      D.days.forEach((day, i) => {
        const r = D.board.find((b) => b.dept_id === dept && b.shift_code === shift && b.day_date === day);
        const v = Math.max(-3, Math.min(3, r.recommended - r.draft_scheduled_employees));
        const fill = r.is_open ? T.SCALES.change.stops[v + 3] : C.navy_raised;
        s.addShape("roundRect", { x: bx + i * (cw + g), y, w: cw, h: ch, rectRadius: T.RADIUS.chip, fill: { color: fill, transparency: r.is_open ? 12 : 0 }, line: { type: "none" }, objectName: "board cell" });
      });
      y += ch + g;
    }
    y += dg - g;
  }
  K3.notes(s, {
    id: "1", target: "0:15",
    say: [
      "Thank you for having us. Our answer to Costco's workforce planning challenge is the Workforce Planner: a staffing plan for the holiday week, and a tool that explains every number in it.",
      "Everything you'll see runs on the case's simulated data.",
    ],
  });
}

async function week_(pres) {
  const h = D.holidays;
  const s = K3.slide(pres, { section: SECTION, title: "One holiday week, three scenarios" });

  // The week, with the holiday window behind it and the two holidays marked under their days.
  const n = D.days.length, tg = 0.14, tw = (W - (n - 1) * tg) / n, ty = TOP + 0.5, th = 1.0;
  const wi = D.days.indexOf(h.window[0]), wj = D.days.indexOf(h.window[h.window.length - 1]);
  const wx = M + wi * (tw + tg) - 0.1, ww = (wj - wi + 1) * (tw + tg) - tg + 0.2;
  s.addShape("roundRect", { x: wx, y: TOP, w: ww, h: th + 0.62, rectRadius: T.RADIUS.card, fill: { color: T.CHART.band }, line: { type: "none" }, objectName: "holiday window" });
  s.addText(h.windowName, text("label", { x: wx, y: TOP + 0.08, w: ww, h: 0.34, fontSize: LABEL, align: "center", color: C.accent_strong, fontFace: T.FONT_SEMIBOLD }));
  D.days.forEach((day, i) => {
    const x = M + i * (tw + tg), inWin = h.window.includes(day);
    s.addShape("roundRect", { x, y: ty, w: tw, h: th, rectRadius: T.RADIUS.control, fill: { color: inWin ? C.surface : C.raised }, line: { color: inWin ? C.accent_line : C.border, width: T.CHART.hairline }, objectName: `day ${day}` });
    s.addText(F.wkday(day), text("label", { x: x + 0.18, y: ty + 0.1, w: tw - 0.3, h: 0.3, fontSize: LABEL }));
    s.addText(F.dayMon(day), text("cardTitle", { x: x + 0.18, y: ty + 0.42, w: tw - 0.3, h: 0.44, fontSize: 24 }));
  });
  const chipAt = async (day, str, Icon) => {
    const cx = M + D.days.indexOf(day) * (tw + tg) + tw / 2;
    const w = K3.textWidth(str, LABEL) + LABEL / 72 + 0.07 + 0.26;
    K3.chip(s, { x: cx - w / 2, y: ty + th + 0.2, label: str, tone: "accent", icon: await K.icon(Icon, C.accent_strong) });
  };
  await chipAt(h.valentine.day, h.valentine.holiday, L.LuHeart);
  await chipAt(h.holiday.day, h.holiday.holiday, L.LuFlag);

  // Scenarios (left) and departments with their wait targets (right).
  const y0 = 4.3, colW = (W - 0.8) / 2, rx = M + colW + 0.8, rowY = (i) => y0 + 0.52 + i * 0.66;
  K3.label(s, "Scenarios", { x: M, y: y0, w: colW, bold: true, color: C.ink });
  const peakSpan = F.span(D.peak.days[0], D.peak.days[D.peak.days.length - 1]);
  const sc = {
    BASE: "Expected week",
    PEAK: `Demand up to ${F.spct(D.peak.maxMult - 1, 0)}, ${peakSpan}`,
    DISRUPT: `Fewer staff, Warehouses ${D.disrupt.stores.map((x) => x.store).join(" and ")}`,
  };
  D.SCEN.forEach((code, i) => {
    K3.chip(s, { x: M, y: rowY(i), label: code, tone: code === "BASE" ? "accent" : "neutral" });
    s.addText(sc[code], text("body", { x: M + 1.45, y: rowY(i), w: colW - 1.45, h: 0.42, fontSize: 18, color: C.ink, valign: "middle" }));
  });
  K3.label(s, "Service targets", { x: rx, y: y0, w: colW, bold: true, color: C.ink });
  for (const [i, d] of D.DEPTS.entries()) {
    K.iconDot(s, { x: rx, y: rowY(i) - 0.04, d: 0.5, icon: await K.icon(DEPT_ICON[d], C.ink_muted), fill: C.raised, name: D.DEPT_NAME[d] });
    s.addText(D.DEPT_NAME[d], text("body", { x: rx + 0.68, y: rowY(i), w: 2.4, h: 0.42, fontSize: 18, color: C.ink, valign: "middle" }));
    const t = D.target[d];
    s.addText(`≤ ${t.value} ${UNIT[t.unit] || t.unit}`, text("body", { x: rx + 2.9, y: rowY(i), w: colW - 2.9, h: 0.42, fontSize: 18, color: C.ink, fontFace: T.FONT_SEMIBOLD, valign: "middle" }));
  }
  const wh = D.warehouses;
  K3.notes(s, {
    id: "2", target: "0:40",
    say: [
      `Costco needs one week of staffing, ${week()}, for Warehouses ${wh.slice(0, -1).join(", ")} and ${wh[wh.length - 1]} and three departments.`,
      `The week holds ${h.valentine.holiday} on ${F.dayLong(h.valentine.day)} and ${h.holiday.holiday} on ${F.dayLong(h.holiday.day)}, so the busy stretch runs from ${F.dayLong(h.window[0])} through the holiday.`,
      "We plan every block, meaning one warehouse, department, day and shift, and compare it with the managers' draft schedule.",
      `Each department has its own service target: ${D.DEPTS.map((d) => `${D.DEPT_NAME[d]} a ${METRIC[d]} of ${D.target[d].value} ${D.target[d].unit} or less`).join(", ")}.`,
      `The plan has to hold in three scenarios: the expected week, a promotion and storm surge, and an illness disruption. That's ${D.subFacts.rows} staffing decisions.`,
    ],
  });
}

async function misplaced(pres) {
  const k = D.S.kpi;
  const s = K3.slide(pres, { section: SECTION, title: "Past schedules put hours in the wrong places" });
  // Two bars on one zero baseline: hours above need (gray, waste) and short of need (warm, the problem).
  const cw = 8.2;
  K3.label(s, `Hours against need, ${D.histWeeks} weeks of history`, { x: M, y: TOP, w: cw });
  const ax = K3.niceAxis([0, k.over_hours, k.short_hours], 4);
  s.addChart(pres.charts.BAR, [{ name: "Hours", labels: ["Short of need", "Above need"], values: [k.short_hours, k.over_hours] }], T.chartBase({
    x: M - 0.05, y: TOP + 0.45, w: cw, h: 3.9, barDir: "bar", barGrouping: "clustered", barGapWidthPct: 55,
    chartColors: [C.warning, C.draft], valAxisMinVal: 0, valAxisMaxVal: ax.max, valAxisMajorUnit: ax.step,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 28, dataLabelColor: C.ink, dataLabelFontFace: T.FONT_SEMIBOLD,
    dataLabelFormatCode: '#,##0" h"', catAxisLabelFontSize: 18, catAxisLabelColor: C.ink, valAxisHidden: true, valGridLine: { style: "none" },
  }));
  // The third number: overall, worked hours were close to need.
  const rx = M + cw + 0.6, rw = W - cw - 0.6;
  s.addShape("line", { x: rx - 0.3, y: TOP + 0.5, w: 0, h: 3.7, line: { color: C.border, width: T.CHART.hairline } });
  await K3.kpi(s, { x: rx, y: TOP + 1.3, w: rw, label: "Net, all hours vs need", value: F.spct(k.worked_vs_req85), size: 54 });
  K3.notes(s, {
    id: "3", target: "0:40",
    say: [
      `We started with ${D.histWeeks} weeks of history. Overall, the warehouses worked about the right hours: within ${F.pct(k.worked_vs_req85)} of what demand needed.`,
      `But they were in the wrong places: ${F.int(k.over_hours)} hours above need, worth about ${F.moneyK(k.over_value, 0)} at regular rates, and ${F.int(k.short_hours)} hours short of need elsewhere, where ${F.int(D.sum(D.S.gap_value.map((g) => g.missed_blocks)))} blocks missed target.`,
      "So the first move is to shift hours, before adding any.",
    ],
  });
}

async function cliff(pres) {
  const s = K3.slide(pres, { section: SECTION, title: `Service collapses past ${F.pct(D.cliff.edge, 0)} utilization` });
  // One line for all blocks pooled (the three departments overlap), the cliff band in the warm hue.
  const keys = D.cliff.keys, LO = 0.6, HI = 1.1;
  const bandKey = (b) => Math.round(Math.min(Math.max(b, LO), HI) * 100);
  const pooled = keys.map((kk) => {
    const rs = D.S.service_bands.filter((r) => bandKey(r.band) === kk);
    return D.sum(rs.map((r) => r.blocks * r.met_target)) / D.sum(rs.map((r) => r.blocks));
  });
  K3.label(s, "Blocks meeting target, by utilization", { x: M, y: TOP, w: 8 });
  const fr = K.frame({ x: M - 0.05, y: TOP + 0.45, w: W + 0.05, h: BOTTOM - TOP - 0.85, l: 0.85, r: 0.15, t: 0.5, b: 0.5 });
  const n = D.cliff.labels.length, e = D.cliff.edgeIndex;
  const b = K.band(s, fr, n, e, n - 1, C.warning_soft);
  s.addText("The cliff", text("label", { x: b.x + 0.12, y: fr.py - 0.42, w: 2.5, h: 0.34, fontSize: LABEL, color: C.warning_ink, fontFace: T.FONT_SEMIBOLD, valign: "bottom" }));
  T.addLineChart(pres, s, {
    ...fr.chart, labels: D.cliff.labels, min: 0, max: 1, majorUnit: 0.25, format: "0%",
    catAxisLabelFontSize: LABEL, valAxisLabelFontSize: LABEL,
    series: [{ name: "All blocks", role: C.ink_muted, values: pooled }],
  });
  K3.label(s, "Utilization", { x: fr.px, y: BOTTOM - 0.32, w: fr.pw, align: "center", color: C.ink_subtle });
  K3.notes(s, {
    id: "4", target: "0:40",
    say: [
      `And when a block is short, service doesn't fade, it falls off a cliff. Below ${F.pct(D.cliff.edge, 0)} utilization nearly every block meets its wait target. From ${F.pct(D.cliff.edge, 0)} to ${F.pct(D.cliff.edge + 0.05, 0)}, only about ${Math.round(D.cliff.edgeMet * 10)} in 10 do. Above that, almost none.`,
      "It's the same in all three departments. So the job is to keep every block left of the cliff, counting the staff who actually show up, not the staff scheduled.",
    ],
  });
}

async function forecast(pres) {
  const h = D.holidays;
  const s = K3.slide(pres, { section: SECTION, title: "Demand peaks on the holiday weekend" });
  const f = D.fc.find((x) => x.dept === 38);
  const cw = 8.4;
  K3.label(s, "Front End checkout workload, units per day", { x: M, y: TOP, w: 5.6 });
  const items = [{ name: "Our forecast", role: "plan", kind: "line" }, { name: "Benchmark", role: "benchmark", kind: "dash" }];
  T.legend(s, { x: M + cw - 3.55, y: TOP + 0.02, items });
  const labels = D.days.map(F.dayShort);
  const fr = K.frame({ x: M - 0.05, y: TOP + 0.45, w: cw, h: BOTTOM - TOP - 0.45, l: 0.75, r: 0.1, t: 0.15, b: 0.5 });
  const wi = D.days.indexOf(h.window[0]), wj = D.days.indexOf(h.window[h.window.length - 1]);
  K3.band(s, fr, labels.length, wi, wj, "Holiday window");
  const ax = K3.niceAxis([0, ...f.forecast, ...f.benchmark], 4);
  T.addLineChart(pres, s, {
    ...fr.chart, labels, min: ax.min, max: ax.max, majorUnit: ax.step, format: "#,##0", catAxisLabelFontSize: LABEL, valAxisLabelFontSize: LABEL,
    series: [{ name: "Benchmark", role: "benchmark", values: f.benchmark }, { name: "Our forecast", role: "plan", values: f.forecast }],
  });
  // Two numbers: the holiday lift, and the error against the benchmark on held-out weeks.
  const rx = M + cw + 0.55, rw = W - cw - 0.55;
  const bt = D.S.backtest_daily.find((r) => r.group === "All");
  await K3.kpi(s, { x: rx, y: TOP + 0.4, w: rw, label: "Holiday-weekend lift", value: F.spct(D.factor(38, "pre_holiday_weekend") - 1, 0), size: 48 });
  s.addShape("line", { x: rx, y: TOP + 2.0, w: rw, h: 0, line: { color: C.border, width: T.CHART.hairline } });
  await K3.kpi(s, { x: rx, y: TOP + 2.3, w: rw, label: "Daily error, held-out weeks", value: F.pct(bt.model), size: 48 });
  s.addText(`vs ${F.pct(bt.benchmark)} benchmark`, text("label", { x: rx, y: TOP + 3.45, w: rw, h: 0.34, fontSize: LABEL, color: C.ink_muted }));
  K3.notes(s, {
    id: "5", target: "0:50",
    say: [
      "The planning grid has no demand, so we forecast it from the warehouse, the weekday, the holiday calendar and the weekly level.",
      `This is Front End. The weekend before ${h.holiday.holiday} lifts its demand about ${F.pct(D.factor(38, "pre_holiday_weekend") - 1, 0)}, measured on MLK weekend, the only comparable holiday in history. Merchandising rises ${F.pct(D.factor(92, "pre_holiday_weekend") - 1, 0)}. We add ${F.pct(D.S.valentine_uplift["Front End"], 0)} for ${h.valentine.holiday} as a stated judgment call, and Pharmacy dips on the holiday itself.`,
      `The case's benchmark, a flat weekday average, misses that shape. On held-out weeks our daily error was ${F.pct(bt.model)} against its ${F.pct(bt.benchmark)}, and the gain comes from Friday to Monday.`,
    ],
  });
}

async function engine(pres) {
  const s = K3.slide(pres, { section: SECTION, title: "Five steps from forecast to plan" });
  const steps = [
    [L.LuTrendingUp, "Forecast", "Demand per block"],
    [L.LuGauge, "Service risk", "Chance of meeting target"],
    [L.LuCalculator, "Cost rule", "Regular, flex, overtime"],
    [L.LuSearch, "Search", "Every staffing pair"],
    [L.LuMessageSquareText, "Explain", "A reason per block"],
  ];
  const cw = W / 5, d = 1.3, cy = TOP + 1.6;
  // A quiet line joins the steps; the circles sit on it.
  s.addShape("line", { x: M + cw / 2, y: cy + d / 2, w: W - cw, h: 0, line: { color: C.accent_line, width: 2 } });
  for (const [i, [Icon, name, desc]] of steps.entries()) {
    const cx = M + i * cw + cw / 2;
    s.addShape("ellipse", { x: cx - d / 2, y: cy, w: d, h: d, fill: { color: C.accent_soft }, line: { color: C.surface, width: 6 }, objectName: `${name} dot` });
    const is = d * 0.44;
    s.addImage({ data: await K.icon(Icon, C.accent_strong), x: cx - is / 2, y: cy + (d - is) / 2, w: is, h: is, altText: name });
    s.addText(String(i + 1), text("label", { x: cx - cw / 2, y: cy - 0.5, w: cw, h: 0.32, fontSize: LABEL, align: "center", color: C.ink_subtle }));
    s.addText(name, text("cardTitle", { x: cx - cw / 2, y: cy + d + 0.3, w: cw, h: 0.42, fontSize: 22, align: "center" }));
    s.addText(desc, text("body", { x: cx - cw / 2 + 0.1, y: cy + d + 0.78, w: cw - 0.2, h: 0.36, fontSize: 18, align: "center", color: C.ink_muted }));
  }
  const goal = F.pct(D.S.service_goal, 0);
  const ex = D.S.explanation_examples.added;
  K3.notes(s, {
    id: "6", target: "0:45",
    say: [
      "The engine runs in five steps. It forecasts each block's demand. A service curve fitted on history turns any headcount into a chance of meeting target, after callouts and forecast error.",
      `It costs staff the case's way: regular, then cross-trained, then overtime. Then it tries every Front End and Merchandising pair in each shift, because they share cross-trained people, and keeps the best one: the highest chance of meeting target, counted up to the ${goal} goal, then the fewest hours short, then the lowest cost.`,
      `And every block explains itself. For example, Warehouse ${ex.store_id} ${ex.department} on ${ex.day} gets ${ex.headline.match(/^(?:Add|Cut) (\d+)/)[1]} more people, with the reason in its own numbers. You'll see that in the demo.`,
    ],
  });
}

module.exports = { SLIDES: [["title", title], ["week", week_], ["misplaced", misplaced], ["cliff", cliff], ["forecast", forecast], ["engine", engine]], SECTION, simulatedBadge };
