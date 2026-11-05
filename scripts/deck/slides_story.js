// Main slides 1-2: title and the challenge.
const K = require("./deck_kit");
const D = require("./deck_data");
const L = require("react-icons/lu");

const { T, C, M, W, TOP, SIZE, text } = K;
const F = D.F;
const SHIFT = { OPEN: "Opening", MID: "Midday", EVE: "Evening" };
const SHORT_METRIC = { 38: "Checkout wait", 92: "Replenishment response", 95: "Prescription wait" };
const DEPT_ICON = { 38: L.LuShoppingCart, 92: L.LuPackage, 95: L.LuPill };
const SECTION = "The case for the plan";
const week = () => F.span(D.days[0], D.days[D.days.length - 1]);

/** The simulated-data badge on navy, as in the app's header. */
async function simulatedBadge(s, x, y) {
  const label = K.SIMULATED, bw = (label.length * SIZE.label * 0.56) / 72 + 0.62;
  s.addShape("roundRect", { x, y, w: bw, h: 0.44, rectRadius: T.RADIUS.control, fill: { color: C.navy_raised }, line: { color: C.navy_border, width: 1 }, objectName: "simulated badge" });
  s.addImage({ data: await K.icon(L.LuFlaskConical, C.navy_accent), x: x + 0.14, y: y + 0.11, w: 0.22, h: 0.22, altText: "Simulated data" });
  s.addText(label, text("label", { x: x + 0.46, y, w: bw - 0.5, h: 0.44, color: C.navy_ink, valign: "middle", fontFace: T.FONT_SEMIBOLD }));
}

async function title(pres) {
  const s = K.slide(pres, { layout: "WP Title", section: SECTION, title: "Workforce Planner" });
  s.addText(`A staffing plan for Costco's holiday week, ${week()}: every block in all three scenarios, set for service first, then cost.`, { placeholder: "subtitle", align: "left" });
  s.addShape("roundRect", { x: M, y: M, w: 0.46, h: 0.46, rectRadius: T.RADIUS.control, fill: { color: C.accent }, line: { type: "none" }, objectName: "app mark" });
  s.addImage({ data: await K.icon(L.LuLayoutGrid, C.on_accent), x: M + 0.1, y: M + 0.1, w: 0.26, h: 0.26, altText: "Workforce Planner mark" });
  s.addText("Texas MISA Fall 2026 Case Competition  ·  Costco workforce planning challenge", text("body", { x: M + 0.62, y: M, w: 10, h: 0.46, color: C.navy_ink_muted, valign: "middle" }));
  if (D.teamName) s.addText(`Team ${D.teamName}`, text("cardTitle", { x: M, y: 4.95, w: 6.9, h: 0.36, color: C.navy_ink, fontSize: 20 }));
  await simulatedBadge(s, M, 5.55);

  // A hint of the board: Warehouse 1, BASE, people against the draft.
  const bx = 8.55, cw = (K.SLIDE.w - M - bx - 6 * 0.07) / 7, ch = 0.38, g = 0.07, dg = 0.2;
  let y = 1.45;
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
  s.addText("Warehouse 1, BASE: purple adds people, tan cuts, gray is unchanged, dark is closed", text("label", { x: bx, y: y + 0.12, w: K.SLIDE.w - M - bx, h: 0.56, color: C.navy_ink_muted }));
  K.notes(s, {
    id: "1", target: "0:15",
    say: [
      "Thank you for having us. Our answer to Costco's workforce planning challenge is the Workforce Planner: a staffing plan for the holiday week, and a tool that explains every number in it.",
      "Everything you'll see runs on the case's simulated data.",
    ],
  });
}

async function challenge(pres) {
  const h = D.holidays;
  const s = K.slide(pres, { section: SECTION, title: `The holiday week needs staffing that holds service through ${h.valentine.holiday} and ${h.holiday.holiday}` });
  // Week timeline with the holiday window.
  const n = D.days.length, tg = 0.12, tw = (W - (n - 1) * tg) / n, ty = TOP + 0.38, th = 0.8;
  const wi = D.days.indexOf(h.window[0]), wj = D.days.indexOf(h.window[h.window.length - 1]);
  const wx = M + wi * (tw + tg) - 0.1, ww = (wj - wi + 1) * (tw + tg) - tg + 0.2;
  s.addShape("roundRect", { x: wx, y: TOP - 0.05, w: ww, h: th + 0.55, rectRadius: T.RADIUS.card, fill: { color: T.CHART.band }, line: { type: "none" }, objectName: "holiday window" });
  s.addText(h.windowName, text("label", { x: wx, y: TOP, w: ww, h: 0.3, align: "center", color: C.accent_strong, fontFace: T.FONT_SEMIBOLD }));
  D.days.forEach((day, i) => {
    const x = M + i * (tw + tg), inWin = h.window.includes(day);
    s.addShape("roundRect", { x, y: ty, w: tw, h: th, rectRadius: T.RADIUS.control, fill: { color: inWin ? C.surface : C.raised }, line: { color: inWin ? C.accent_line : C.border, width: T.CHART.hairline }, objectName: `day ${day}` });
    s.addText(F.wkday(day), text("label", { x: x + 0.16, y: ty + 0.08, w: tw - 0.3, h: 0.26 }));
    s.addText(F.dayMon(day), text("cardTitle", { x: x + 0.16, y: ty + 0.36, w: tw - 0.3, h: 0.38, fontSize: 22 }));
  });
  const chipAt = async (day, label, Icon) => {
    const i = D.days.indexOf(day), cx = M + i * (tw + tg) + tw / 2;
    const w = (label.length * SIZE.label * 0.56) / 72 + 0.2 + 2 * K.px(9);
    T.chip(s, { x: cx - w / 2, y: ty + th + 0.13, label, tone: "accent", icon: await K.icon(Icon, C.accent_strong) });
  };
  await chipAt(h.valentine.day, h.valentine.holiday, L.LuHeart);
  await chipAt(h.holiday.day, h.holiday.holiday, L.LuFlag);

  // What a block is.
  const wh = D.warehouses;
  s.addText([
    { text: "A block ", options: { fontFace: T.FONT_SEMIBOLD, color: C.ink } },
    { text: `is one warehouse, department, day and shift: ${D.subFacts.perScenario} per scenario across Warehouses ${wh.slice(0, -1).join(", ")} and ${wh[wh.length - 1]}, each compared with the managers' draft schedule.` },
  ], text("body", { x: M, y: 3.48, w: W, h: 0.6, color: C.ink_muted }));

  // Scenarios (left) and departments (right).
  const y0 = 4.2, colW = (W - 0.5) / 2, rx = M + colW + 0.5, chipW = 1.12, rowY = (i) => y0 + 0.46 + i * 0.66;
  s.addText("Three scenarios, one plan each", text("cardTitle", { x: M, y: y0, w: colW, h: 0.34 }));
  const sc = {
    BASE: ["Baseline planning week", "Expected demand, with both holidays"],
    PEAK: ["Promotion and winter-weather surge", `Demand up to ${F.spct(D.peak.maxMult - 1, 0)} on ${F.span(D.peak.days[0], D.peak.days[D.peak.days.length - 1])}, same staff`],
    DISRUPT: ["Callouts and reduced availability", `Fewer staff at Warehouses ${D.disrupt.stores.map((x) => x.store).join(" and ")}, ${F.span(D.disrupt.stores.map((x) => x.from).sort()[0], D.disrupt.stores.map((x) => x.to).sort().pop())}`],
  };
  D.SCEN.forEach((code, i) => {
    T.chip(s, { x: M, y: rowY(i), label: code, tone: code === "BASE" ? "accent" : "neutral" });
    s.addText(sc[code][0], text("body", { x: M + chipW, y: rowY(i) - 0.02, w: colW - chipW, h: 0.3, color: C.ink, fontFace: T.FONT_SEMIBOLD }));
    s.addText(sc[code][1], text("label", { x: M + chipW, y: rowY(i) + 0.28, w: colW - chipW, h: 0.28, color: C.ink_muted }));
  });
  s.addText("Three departments, each with its own service target", text("cardTitle", { x: rx, y: y0, w: colW, h: 0.34 }));
  const why = { 38: "what members feel first", 92: "keeps products on the shelves", 95: "a health service members rely on" };
  for (const [i, d] of D.DEPTS.entries()) {
    K.iconDot(s, { x: rx, y: rowY(i) - 0.03, d: 0.52, icon: await K.icon(DEPT_ICON[d], T.DEPT[D.DEPT_NAME[d]]), fill: C.raised, name: D.DEPT_NAME[d] });
    const t = D.target[d];
    s.addText([
      { text: D.DEPT_NAME[d], options: { fontFace: T.FONT_SEMIBOLD, color: C.ink } },
      { text: `   ${why[d]}`, options: { color: C.ink_subtle, fontSize: SIZE.label } },
    ], text("body", { x: rx + 0.7, y: rowY(i) - 0.02, w: colW - 0.7, h: 0.3 }));
    s.addText(`${SHORT_METRIC[d]} of ${t.value} ${t.unit} or less`, text("label", { x: rx + 0.7, y: rowY(i) + 0.28, w: colW - 0.7, h: 0.28, color: C.ink_muted }));
  }
  K.notes(s, {
    id: "2", target: "0:40",
    say: [
      `Costco needs one week of staffing, ${week()}, for three warehouses and three departments.`,
      `The week holds ${h.valentine.holiday} on ${F.dayLong(h.valentine.day)} and ${h.holiday.holiday} on ${F.dayLong(h.holiday.day)}, so the busy stretch runs from ${F.dayLong(h.window[0])} through the holiday.`,
      "We plan every block, meaning one warehouse, department, day and shift, and compare it with the managers' draft schedule. Each department has its own wait target.",
      `The plan has to hold in three scenarios: the expected week, a promotion and storm surge, and an illness disruption. That's ${D.subFacts.rows} staffing decisions.`,
    ],
  });
}

module.exports = { title, challenge, simulatedBadge, SECTION, SHIFT, SHORT_METRIC, DEPT_ICON };
