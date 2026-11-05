// Appendix A9-A11: validation and checks, data notes, the submission file.
const K = require("./deck_kit");
const D = require("./deck_data");
const L = require("react-icons/lu");
const { appendix } = require("./slides_appendix");
const { SHIFT } = require("./slides_story");

const { T, C, M, W, TOP, BOTTOM, GAP, SIZE, text } = K;
const F = D.F;

/** A grid of icon cards: items [{ icon, title, text }], cols x rows filling the content area. */
async function iconGrid(s, items, { cols, iconColor = C.accent_strong, fill = C.accent_soft }) {
  const rows = Math.ceil(items.length / cols);
  const cw = (W - (cols - 1) * GAP) / cols, ch = (BOTTOM - TOP - (rows - 1) * GAP) / rows;
  for (const [i, it] of items.entries()) {
    const x = M + (i % cols) * (cw + GAP), y = TOP + Math.floor(i / cols) * (ch + GAP);
    const box = T.card(s, { x, y, w: cw, h: ch, name: it.title });
    K.iconDot(s, { x: box.x, y: box.y, d: 0.5, icon: await K.icon(it.icon, iconColor), fill, name: it.title });
    s.addText(it.title, text("cardTitle", { x: box.x + 0.64, y: box.y, w: box.w - 0.64, h: 0.5, valign: "middle" }));
    s.addText(it.text, text("label", { x: box.x, y: box.y + 0.64, w: box.w, h: box.h - 0.64, color: C.ink_muted }));
  }
}

async function a9(pres) {
  const f = D.subFacts, P = D.plan;
  const s = appendix(pres, 9, "Every check we could run passes: the file, the costs, the search and the risk model");
  const cal = D.S.service_calibration.find((r) => r.bin === "95-99%");
  const feasible = D.SCEN.every((c) => P[c].over_capacity === 0 && P[c].below_min_staff === 0 && P[c].unfilled === 0);
  await iconGrid(s, [
    { icon: L.LuFileSpreadsheet, title: "Submission file", text: `${f.rows} rows joined on keys, whole numbers, and all ${f.closedAtZero} closed blocks at 0. Our validator reports ${D.S.validator_problems.length} problems.` },
    { icon: L.LuShieldCheck, title: "Feasible everywhere", text: `${feasible ? "All" : "Not all"} ${f.open} open blocks are within capacity and at or above minimum staff, in all three scenarios.` },
    { icon: L.LuCalculator, title: "Cost rule", text: "Rebuilt row by row from the README's rule; it matches every block and every total to the half cent." },
    { icon: L.LuSearch, title: "Search", text: "An independent brute force over every feasible pair picks the same staffing in every shift checked." },
    { icon: L.LuDices, title: "Risk math", text: "The exact chance calculation agrees with a Monte Carlo simulation of the same risks." },
    { icon: L.LuGauge, title: "Calibration", text: `Out of sample, blocks predicted at 95 to 99% met target ${F.pct(cal.observed)} of the time, against ${F.pct(cal.predicted)} predicted.` },
    { icon: L.LuMessageSquareText, title: "Explanations", text: `A test checks every number quoted in all ${f.rows} block explanations against the plan.` },
    { icon: L.LuRepeat, title: "Reproducible", text: "Rerunning the pipeline rewrites every output byte for byte; the numbers were frozen before the deck." },
  ], { cols: 4, iconColor: C.good_ink, fill: C.good_soft });
  K.notes(s, { id: "A9", target: "for Q&A", say: [
    "How we know the numbers are right: the submission file was rebuilt independently, the cost rule recomputed row by row, the search checked by brute force, the risk math by simulation, and the model's predictions against held-out history.",
    "The report's validation chapter has the details and the commands to reproduce each one.",
  ] });
}

async function a10(pres) {
  const s = appendix(pres, 10, "The data is simulated, and a few of its quirks shaped the method");
  const dz = D.disrupt;
  await iconGrid(s, [
    { icon: L.LuFlaskConical, title: "Simulated data", text: "A competition dataset, not Costco data. Wage rates are mock values. Every figure in this deck comes from it." },
    { icon: L.LuUserX, title: "DISRUPT cuts more", text: `${dz.changedBlocks} blocks lose staff, including partner cross-trained staff the docs don't mention, so we read availability per scenario from the grid.` },
    { icon: L.LuCalendarDays, title: "Promotions follow the calendar", text: "Promotions run on every Friday to Sunday and holiday, so their effect can't be separated from the weekday and holiday terms." },
    { icon: L.LuBan, title: "Traffic is an outcome", text: "The data pack labels traffic_index an output, never a model input, because it would leak the answer. We left it out." },
    { icon: L.LuRepeat, title: "Holiday labels differ", text: `History names MLK weekend and the planning week names ${D.holidays.holiday.holiday}, so we mapped both to shared holiday roles.` },
    { icon: L.LuCopy, title: "One draft for all scenarios", text: `The draft schedules the same ${F.int(D.subFacts.draftPeople.BASE)} employee shifts in all three scenarios, whatever the conditions.` },
  ], { cols: 3 });
  K.notes(s, { id: "A10", target: "for Q&A", say: [
    "The data is the case's simulated dataset, not Costco's. Three quirks shaped the method: DISRUPT removes more staff than the docs say, promotions can't be separated from the calendar, and traffic is an outcome we must not use as an input.",
  ] });
}

async function a11(pres) {
  const f = D.subFacts;
  const s = appendix(pres, 11, `The submission file holds all ${f.rows} blocks, joined on keys, with closed blocks at zero`);
  const want = [
    ["BASE", 1, 38, D.holidays.valentine.day], ["BASE", 1, 95, D.holidays.valentine.day], ["DISRUPT", 2, 38, D.holidays.valentine.day],
  ];
  const pick = D.sub.filter((r) => want.some(([c, st, d, day]) => r.scenario_code === c && r.store_id === st && r.dept_id === d && r.day_date === day));
  const lw = 8.0;
  s.addText("A sample of rows, in the template's own order", text("cardTitle", { x: M, y: TOP, w: lw, h: 0.32 }));
  const end = K.table(s, {
    x: M, y: TOP + 0.42, rowH: 0.34,
    cols: [{ w: 1.25 }, { w: 1.2, align: "right" }, { w: 1.65 }, { w: 0.95 }, { w: 1.05 }, { w: 0.75, align: "right" }, { w: lw - 6.85, align: "right" }],
    head: ["Scenario", "Warehouse", "Department", "Date", "Shift", "Draft", "Submitted"],
    rows: pick.map((r) => [r.scenario_code, String(r.store_id), r.department_group, F.dayMon(r.day_date), SHIFT[r.shift_code], String(r.draft_scheduled_employees), String(r.submitted_employees)]),
    cell: (r, c) => (c === 6 ? { fontFace: T.FONT_SEMIBOLD, color: pick[r].is_open ? C.accent_strong : C.ink_subtle } : c === 5 ? { color: C.ink_muted } : {}),
  });
  s.addText(`Closed blocks show 0. "Submitted" fills the template's submitted_employees column.`, text("label", { x: M, y: end + 0.12, w: lw, h: 0.3, color: C.ink_muted }));
  const rx = M + lw + GAP, rw = W - lw - GAP;
  const card = T.card(s, { x: rx, y: TOP, w: rw, h: BOTTOM - TOP, title: "What the file holds", name: "file card" });
  K.bullets(s, [
    `${f.rows} rows: ${D.SCEN.length} scenarios of ${f.perScenario} blocks`,
    "Joined on scenario, warehouse, department, date and shift, never by row order",
    "Total employees per block, as the template asks, with no split by staff type",
    `${f.closed} closed Pharmacy blocks set to 0`,
    `Employee shifts, draft to plan: ${D.SCEN.map((c) => `${c} ${F.int(f.draftPeople[c])} to ${F.int(f.people[c])}`).join("; ")}`,
  ], { x: card.x, y: card.y, w: card.w, h: card.h, fontSize: SIZE.label, space: 8 });
  K.notes(s, { id: "A11", target: "for Q&A", say: [
    `The file is the case's template with all ${f.rows} rows, joined on its keys, total employees per block, and zero for closed blocks. It's the same file the tool exports.`,
  ], extra: D.teamName ? [] : ["Before submitting: set TEAM_ID in src/submission.py (the file still holds the placeholder team name)."] });
}

module.exports = { SLIDES: [["A9", a9], ["A10", a10], ["A11", a11]] };
