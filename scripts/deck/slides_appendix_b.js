// Appendix A4-A6: cost rule and search, assumptions, cost and service against the draft.
const K = require("./deck_kit");
const D = require("./deck_data");
const L = require("react-icons/lu");
const { SHIFT } = require("./slides_story");
const { appendix } = require("./slides_appendix");

const { T, C, M, W, TOP, BOTTOM, GAP, SIZE, text } = K;
const F = D.F;
const rate = (n) => `$${F.fixed(n, 2)}`;

async function a4(pres) {
  const s = appendix(pres, 4, "Cost follows the case's rule, and Front End and Merchandising are solved together");
  const R = D.rates, ag = 0.5, cw = (W - 2 * ag) / 3, ch = 1.75;
  const steps = [
    [L.LuUsers, "Regular staff", `First, at the loaded regular rate: ${rate(R.regular[0])} to ${rate(R.regular[1])} an hour`],
    [L.LuShuffle, "Cross-trained staff", "Next, only people the partner department isn't using in that shift, at the regular rate"],
    [L.LuClock, "Overtime", `Last, up to each block's limit: ${rate(R.overtime[0])} to ${rate(R.overtime[1])} an hour, about ${F.pct(R.otPremium, 0)} more`],
  ];
  for (const [i, [Icon, t, d]] of steps.entries()) {
    const x = M + i * (cw + ag);
    const box = T.card(s, { x, y: TOP, w: cw, h: ch, name: t });
    K.iconDot(s, { x: box.x, y: box.y, d: 0.5, icon: await K.icon(Icon, C.accent_strong), name: t });
    s.addText(t, text("cardTitle", { x: box.x + 0.65, y: box.y, w: box.w - 0.65, h: 0.5, valign: "middle" }));
    s.addText(d, text("label", { x: box.x, y: box.y + 0.62, w: box.w, h: box.h - 0.62, color: C.ink_muted }));
    if (i < 2) s.addImage({ data: await K.icon(L.LuChevronRight, C.ink_subtle), x: x + cw + (ag - 0.26) / 2, y: TOP + ch / 2 - 0.13, w: 0.26, h: 0.26, altText: "then" });
  }
  const by = TOP + ch + GAP, bh = BOTTOM - by, lw = (W - GAP) / 2;
  const left = T.card(s, { x: M, y: by, w: lw, h: bh, title: "How the search picks each shift's staffing", name: "search card" });
  const goal = F.pct(D.S.service_goal, 0);
  s.addText([
    `Highest total chance of meeting target, each block counted up to the ${goal} goal`,
    "Then the fewest hours short of need",
    "Then the lowest cost",
  ].map((t, i, a) => ({ text: t, options: { bullet: { type: "number", indent: 18 }, breakLine: i < a.length - 1, paraSpaceAfter: 6 } })), text("body", { x: left.x, y: left.y, w: left.w, h: 1.2, fontSize: SIZE.label, color: C.ink }));
  s.addText("Pairs are tried together because the two departments share cross-trained staff.", text("label", { x: left.x, y: left.y + 1.25, w: left.w, h: left.h - 1.25, color: C.ink_muted }));

  const ex = D.S.explanation_examples.short;
  const row = D.expl.find((r) => r.scenario_code === "BASE" && r.store_id === ex.store_id && r.dept_id === 38 && F.dayLong(r.day_date).replace(/ /g, " ") === ex.day && r.shift_code === ex.shift);
  const right = T.card(s, { x: M + lw + GAP, y: by, w: W - lw - GAP, h: bh, title: "One block's staff sources", name: "sources card" });
  const p = D.plan.BASE;
  K.bullets(s, [
    `Warehouse ${ex.store_id}, ${ex.department}, ${F.dayLong(row.day_date)}, ${SHIFT[ex.shift]}: ${row.draft_scheduled_employees} in the draft, ${row.recommended} in the plan. ${row.staffing}`,
    `Cost: ${row.cost_effect}`,
    `Across BASE, the plan uses ${F.int(p.overtime_hours)} h of overtime and ${F.int(p.flex_hours)} h of cross-trained staff.`,
  ], { x: right.x, y: right.y, w: right.w, h: right.h, fontSize: SIZE.label, space: 8 });
  K.notes(s, { id: "A4", target: "for Q&A", say: [
    "Cost follows the case's rule exactly: regular staff first, then cross-trained staff the partner can spare, then overtime.",
    "Front End and Merchandising share cross-trained people within a shift, so the search tries every pair of headcounts together and ranks them by service, then shortfall, then cost.",
  ] });
}

async function a5(pres) {
  const k = D.S.kpi;
  const ours = [
    ["A-01", "Cross-trained staff count only if the partner isn't using them", "Our reading of the README"],
    ["A-03", `Plan for callouts: ${F.pct(k.callout_rate_all)} call out, ${F.pct(k.backfill_share, 0)} of them backfilled`, "Six weeks of history"],
    ["A-05", `MLK weekend guides the ${D.holidays.windowName}`, "Same Friday-to-Monday shape"],
    ["A-06", `${D.holidays.valentine.holiday} adds ${F.pct(D.S.valentine_uplift["Front End"], 0)} for Front End and Merchandising`, "No analog; tested for sensitivity"],
    ["A-09", "History's service curve holds in the planning week", "The case says to estimate it"],
    ["A-12", "DISRUPT's illness brings January's flu-week callout rates", "Both appeared together in January"],
    ["A-13", `The goal is a ${F.pct(D.S.service_goal, 0)} chance of meeting target in each block`, "Service is judged first"],
    ["A-14", `Next week's level is the last ${D.S.level_weeks} weeks' average`, "Best in the backtest"],
    ["A-16", "Some holiday-weekend PTO can still be limited", "The data doesn't show approvals"],
  ];
  const s = appendix(pres, 5, `The plan adds ${ours.length} assumptions of our own to the case's, each with its basis`);
  const rows = [
    ...ours.map((r) => [...r, "Ours"]),
    ["", "Labor standards, wage rates, shift hours and minimum staff", "Data pack", "Case"],
    ["", "Cost order: regular, then cross-trained, then overtime", "Case, page 7, and README", "Case"],
    ["", "Scenario demand multipliers and availability", "Planning grid", "Case"],
  ];
  const end = K.table(s, {
    x: M, y: TOP, rowH: 0.345,
    cols: [{ w: 0.8 }, { w: 6.35 }, { w: 3.6 }, { w: W - 10.75, align: "center" }],
    head: ["ID", "Assumption", "Basis", "Whose"],
    rows,
    cell: (r, c) => (c === 3 ? (rows[r][3] === "Ours" ? { fill: { color: C.accent_soft }, color: C.accent_strong, fontFace: T.FONT_SEMIBOLD } : { fill: { color: C.raised }, color: C.ink_muted }) : c === 0 ? { color: C.ink_muted } : c === 2 ? { color: C.ink_muted } : {}),
  });
  s.addText("IDs match the report's list of assumptions.", text("label", { x: M, y: end + 0.08, w: W, h: 0.28, color: C.ink_muted }));
  K.notes(s, { id: "A5", target: "for Q&A", say: [
    "These are the assumptions we added, each with its basis; the case's own are at the bottom. The full list, with what happens if each is wrong, is in the report.",
    "The two that matter most are planning for callouts and the 95% goal, both confirmed with the team.",
  ] });
}

async function a6(pres) {
  const rows = [], strong = [];
  let allUp = true;
  for (const code of D.SCEN) {
    const p = D.plan[code], d = D.draft[code];
    strong.push(rows.length);
    rows.push([code, "All", F.int(d.hours), F.int(p.hours), F.moneyK(d.cost), F.moneyK(p.cost), F.spct(p.cost / d.cost - 1), F.pct(d.expected_met), F.pct(p.expected_met)]);
    for (const r of D.S.plan_by_dept.filter((x) => x.scenario_code === code)) {
      allUp = allUp && r.expected_met > r.expected_met_draft;
      rows.push(["", r.department, F.int(r.hours_draft), F.int(r.hours), F.moneyK(r.cost_draft), F.moneyK(r.cost), F.spct(r.cost / r.cost_draft - 1), F.pct(r.expected_met_draft), F.pct(r.expected_met)]);
    }
  }
  const title = allUp ? "Against the draft, the plan raises expected service in every scenario and department" : "Cost and service against the draft, by scenario and department";
  const s = appendix(pres, 6, title);
  const n = (W - 1.3 - 2.0) / 7, num = { w: n, align: "right" };
  const end = K.table(s, {
    x: M, y: TOP, rowH: 0.32, headH: 0.62,
    cols: [{ w: 1.3 }, { w: 2.0 }, num, num, num, num, num, num, num],
    head: ["Scenario", "Department", "Hours\ndraft", "Hours\nplan", "Cost\ndraft", "Cost\nplan", "Cost\nchange", "Service\ndraft", "Service\nplan"],
    rows,
    cell: (r, c) => ({
      ...(strong.includes(r) ? { fontFace: T.FONT_SEMIBOLD, fill: { color: C.raised } } : {}),
      ...([2, 4, 7].includes(c) ? { color: C.ink_muted } : {}),
      ...(c === 8 ? { color: C.accent_strong, fontFace: T.FONT_SEMIBOLD } : {}),
    }),
  });
  const dd = D.draft.DISRUPT;
  s.addText(`DISRUPT's draft cost counts only staff who can be fielded: ${dd.unfilled} people in ${dd.over_capacity} blocks can't be.`, text("label", { x: M, y: end + 0.12, w: W, h: 0.3, color: C.ink_muted }));
  K.notes(s, { id: "A6", target: "for Q&A", say: [
    "This is cost and service against the draft for every scenario and department, as the case asks. Expected service is the average predicted chance of meeting target across open blocks.",
    `Pharmacy needs the smallest change. Front End in DISRUPT stays furthest below the goal, at ${F.pct(D.S.plan_by_dept.find((r) => r.scenario_code === "DISRUPT" && r.dept_id === 38).expected_met)}, because illness removes the people it would need.`,
  ] });
}

module.exports = { SLIDES: [["A4", a4], ["A5", a5], ["A6", a6]] };
