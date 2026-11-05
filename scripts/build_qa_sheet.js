// Builds deliverables/Costco_QA_Prep.docx, the team's answers to the judges' likely questions (T-94).
// Run from the project root after the pipeline:  node scripts/build_qa_sheet.js
// Every figure is read from outputs/ (D-28), and the builder stops if the files disagree with each other.
// Typed here are only IDs, page names, the case's own dates, and the wording of the answers.
// Rebuilding replaces the file, so hand edits to the Word file are lost unless they are also made here.
const fs = require("fs");
const path = require("path");
const {
  AlignmentType, BorderStyle, Document, Footer, Packer, PageNumber, Paragraph, PositionalTab,
  PositionalTabAlignment, PositionalTabLeader, PositionalTabRelativeTo, ShadingType, Table, TableCell,
  TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType,
} = require("docx");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "outputs");
const TARGET = path.join(ROOT, "deliverables", "Costco_QA_Prep.docx");
const S = JSON.parse(fs.readFileSync(path.join(OUT, "analysis_summary.json"), "utf8"));
const TOKENS = JSON.parse(fs.readFileSync(path.join(ROOT, "design", "tokens.json"), "utf8"));
const K = S.kpi;

// The shared look (D-26): colors and the Office font from design/tokens.json.
const C = Object.fromEntries(Object.entries(TOKENS.color).map(([k, v]) => [k, v.value.replace("#", "")]));
const FONT = TOKENS.type.family_office.value;
const FONT_SEMI = `${FONT} Semibold`;

// ---------- Reading outputs ----------
function readCsv(name) {
  const text = fs.readFileSync(path.join(OUT, name), "utf8").replace(/^﻿/, "");
  const split = (line) => {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { cells.push(cell); cell = ""; } else cell += ch;
    }
    cells.push(cell);
    return cells;
  };
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = split(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(split(line).map((v, i) => [head[i], v])));
}
const need = (ok, what) => { if (!ok) throw new Error(`Outputs disagree: ${what}`); };
const by = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));
const sum = (rows, key) => rows.reduce((a, r) => a + Number(r[key]), 0);

// ---------- Formatting ----------
const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const goalPct = (x) => `${Number((x * 100).toFixed(1))}%`; // 0.925 -> 92.5%, 0.95 -> 95%
const money = (x) => `$${Math.round(x).toLocaleString("en-US")}`;
const num = (x) => Math.round(x).toLocaleString("en-US");
const hundreds = (x) => `$${(Math.round(x / 100) * 100).toLocaleString("en-US")}`;
// A gap between two shares, from the values as printed, so the sheet's own arithmetic checks out.
const points = (a, b) => ((Math.round(a * 1000) - Math.round(b * 1000)) / 10).toFixed(1);
const dayLabel = (iso) => new Date(`${iso}T12:00:00Z`)
  .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).replace(",", "");
const SHIFT = { OPEN: "opening", MID: "midday", EVE: "evening" };
const DEPT = { 38: "Front End", 92: "Merchandising", 95: "Pharmacy" };
// The case's holiday window (Presidents' Day weekend, with Valentine's Day on Feb 14).
const WINDOW = ["2026-02-13", "2026-02-14", "2026-02-15", "2026-02-16"];
const FEB14 = "2026-02-14";

// ---------- Figures ----------
const plan = by(S.plan_summary, "scenario_code");
const draft = by(S.draft_summary, "scenario_code");
const GOAL = S.service_goal;

const blocks = readCsv("plan_vs_draft.csv").map((r) => ({
  ...r, open: r.is_open === "1", draftN: Number(r.draft_scheduled_employees), rec: Number(r.recommended),
  cap: Number(r.capacity), minStaff: Number(r.min_staff), chance: Number(r.chance_met),
}));
const openIn = (s) => blocks.filter((b) => b.scenario_code === s && b.open);
const baseOpen = openIn("BASE");
const added = baseOpen.filter((b) => b.rec > b.draftN).length;
const cut = baseOpen.filter((b) => b.rec < b.draftN).length;
const allOpen = blocks.filter((b) => b.open);
const allClosed = blocks.filter((b) => !b.open);
need(blocks.length === K.plan_blocks, "plan_vs_draft.csv rows against kpi.plan_blocks");
need(allOpen.every((b) => b.rec >= b.minStaff && b.rec <= b.cap), "an open block below min_staff or over capacity");
need(allClosed.every((b) => b.rec === 0), "a closed block that isn't 0");
for (const s of ["BASE", "PEAK", "DISRUPT"]) {
  need(openIn(s).filter((b) => b.below_service_goal === "True").length === plan[s].below_goal, `${s} blocks below the goal`);
}

// Feasibility: the submission file itself.
const submission = readCsv("TEAM_SUBMISSION_TEMPLATE_filled.csv");
need(submission.length === blocks.length, "submission rows against plan_vs_draft.csv");
need(S.validator_problems.length === 0, "validator problems in analysis_summary.json");

// Where capacity runs out (F-50).
const gaps = readCsv("capacity_gaps.csv");
const gapPeople = (s, day) => sum(gaps.filter((r) => r.scenario_code === s && (!day || r.day_date === day)), "gap_people");
const gapBlocks = (s) => sum(gaps.filter((r) => r.scenario_code === s), "blocks_short");
for (const s of ["BASE", "PEAK", "DISRUPT"]) need(gapBlocks(s) === plan[s].below_goal, `${s} short blocks in capacity_gaps.csv`);
const short = S.base_shortfall;
need(short.blocks === plan.BASE.below_goal, "base_shortfall.blocks");

// The DISRUPT illness blocks at Warehouse 2 (F-69).
const illness = openIn("DISRUPT").filter((b) => b.availability_note.startsWith("Illness"));
const illnessAtCap = illness.filter((b) => b.rec >= b.cap).length;

// The service goal trade-off (F-49): cost of a point of expected service between two goals.
const goals = S.goal_tradeoff.filter((r) => r.scenario_code === "BASE");
const atGoal = (x) => goals.find((r) => Math.abs(r.goal - x) < 1e-9);
const perPoint = (a, b) => (atGoal(b).cost - atGoal(a).cost) / ((atGoal(b).expected_met - atGoal(a).expected_met) * 100);
need(Math.abs(atGoal(GOAL).cost - plan.BASE.cost) < 0.01, "the 95% row of goal_tradeoff against the plan");
const steps = [[0.85, 0.9], [0.925, 0.95], [0.975, 0.99]].map(([a, b]) => ({ a, b, cost: perPoint(a, b) }));

// The allowance for risk (F-51).
const buffer = (name) => S.buffer_test.find((r) => r.scenario_code === "BASE" && r.plan.startsWith(name));
const both = buffer("Allows for both");
const fcOnly = buffer("Allows for forecast error only");
const neither = buffer("Allows for neither");
const current = buffer("Current draft");
need(Math.abs(both.cost - plan.BASE.cost) < 0.01 && Math.abs(current.cost - draft.BASE.cost) < 0.01, "buffer_test costs");
need(["BASE", "PEAK", "DISRUPT"].every((s) => {
  const n = S.buffer_test.find((r) => r.scenario_code === s && r.plan.startsWith("Allows for neither"));
  const d = S.buffer_test.find((r) => r.scenario_code === s && r.plan.startsWith("Current draft"));
  return ["met_both_risks", "met_forecast_error_only", "met_neither"].every((k) => n[k] > d[k]);
}), "moving hours alone beats the draft in every condition");
const costChange = plan.BASE.cost / draft.BASE.cost - 1;

// The forecast (F-44, F-45).
const daily = by(S.backtest_daily, "group").All;
const friMon = by(S.backtest_by_day_group, "group")["Fri-Mon"];
const weeks = S.backtest_by_week.map((r) => r.week);
const normalGap = Math.max(...S.forecast_by_day.filter((r) => !WINDOW.includes(r.day_date))
  .map((r) => Math.abs(r.model_forecast / r.benchmark - 1)));
const normalGapText = `${(Math.ceil(normalGap * 1000) / 10).toFixed(1)}%`;
const analog = by(S.analog_test, "group");
need(analog[95].model > analog[95].benchmark && analog[38].model < analog[38].benchmark && analog[92].model < analog[92].benchmark,
  "the MLK analog test's winners");

// Valentine's Day (F-52).
const uplift = S.valentine_uplift["Front End"];
need(uplift === S.valentine_uplift.Merchandising, "Valentine's uplift for Front End and Merchandising");
const valentineHigh = S.valentine_sensitivity.reduce((a, r) => (r.true_uplift > a.true_uplift ? r : a));

// Calibration (F-46, F-62 to F-65).
const calibration = by(S.service_calibration, "bin")["95-99%"];
const limits = S.service_limits.map((r) => r.u95);

// The worked example of a cut (F-39, F-72).
const ex = S.explanation_examples.cut;
const cutRow = baseOpen.find((b) => Number(b.store_id) === ex.store_id && DEPT[b.dept_id] === ex.department
  && b.shift_code === ex.shift && dayLabel(b.day_date) === ex.day);
need(cutRow && cutRow.rec < cutRow.draftN && ex.headline.includes(`${cutRow.draftN} in the draft to ${cutRow.rec}`), "the cut example");

// Holiday PTO (F-55).
const pto = S.pto_what_if;
const ptoNone = pto.find((r) => r.kept_per_block === 0);
const ptoMost = pto.reduce((a, r) => (r.kept_per_block > a.kept_per_block ? r : a));
need(ptoNone.blocks_below_goal === plan.BASE.below_goal, "pto_what_if's starting point");

// ---------- The questions ----------
// Each answer is one to three sentences a presenter can say aloud. **Bold** marks the figure to land.
const GROUPS = [
  { title: "The plan", items: [
    { q: "What did the draft get wrong?", src: "F-19 · F-26 · F-48",
      a: `It rolls recent habits forward: ${pct(K.draft_within1, 0)} of its blocks are within one person of the weeks 3-6 average, and it's the same schedule in all three scenarios. So hours sit in the wrong places: **${draft.BASE.below_goal} of ${baseOpen.length}** BASE blocks fall below the ${goalPct(GOAL)} goal, for **${pct(draft.BASE.expected_met)}** expected service.` },
    { q: `Why aim for a ${goalPct(GOAL)} chance in each block?`, src: "F-49 · A-13",
      a: `Service is judged first, and ${goalPct(GOAL)} is where each extra point starts to get expensive. In BASE, a point of expected service costs about ${steps.map((s, i) => `${i === steps.length - 1 ? "and " : ""}**${hundreds(s.cost)}** between the ${goalPct(s.a)} and ${goalPct(s.b)} goals`).join(", ")}.` },
    { q: `Isn't +${pct(costChange)} labor cost a lot?`, src: "F-51 · F-48",
      a: `Moving hours alone, at about the draft's cost (**${money(neither.cost)}** against ${money(draft.BASE.cost)}), already beats the draft in every condition we tested. The other **${money(Math.round(plan.BASE.cost) - Math.round(neither.cost))}** buys allowances for forecast error and callouts, which lift expected service from ${pct(neither.met_both_risks)} to **${pct(both.met_both_risks)}**.` },
    { q: "What if the judges don't apply callouts?", src: "A-03 · F-04 · F-51 · Q-02",
      a: `Then the callout allowance costs **${money(Math.round(plan.BASE.cost) - Math.round(fcOnly.cost))}** for little gain in their score: ${pct(both.met_forecast_error_only)} expected service against ${pct(fcOnly.met_forecast_error_only)} without it. We planned for real conditions, because **${pct(K.callout_rate_all)}** of scheduled staff called out in history and only ${pct(K.backfill_share, 0)} were replaced.` },
    { q: "Is the plan actually feasible?", src: "F-67 · F-70 · F-71",
      a: `Yes. All **${allOpen.length}** open blocks across the three scenarios are at or above minimum staff and within capacity under the README's staffing rule, and the ${allClosed.length} closed blocks are 0. An independent rebuild of the ${num(submission.length)}-row file finds no problems with the staffing.` },
    { q: "Why did you cut staff in some blocks?", src: "F-39 · F-72",
      a: `History shows some blocks are habitually overstaffed: **${num(K.over_hours)} hours** sat above need, worth ${money(K.over_value)}, while ${num(K.short_hours)} were missing elsewhere. In BASE the plan cuts **${cut}** blocks and adds to ${added}, and each says why: Warehouse ${ex.store_id} ${ex.department}'s ${ex.day} ${SHIFT[ex.shift]} goes from ${cutRow.draftN} to ${cutRow.rec} and keeps a **${pct(cutRow.chance, 0)}** chance.` },
    { q: "Why are some blocks still below the goal?", src: "F-50 · F-55",
      a: `Capacity runs out: every block below the goal already uses all its own regular staff and overtime. In BASE, **${short.holiday_blocks} of the ${short.blocks}** fall on the holiday weekend, Feb 13-16, and they still average an **${pct(short.average_chance, 0)}** chance, with ${short.near_goal_blocks} at 90-95%. Limiting holiday PTO is the most direct fix.` },
    { q: `Why did expected service in PEAK only reach ${pct(plan.PEAK.expected_met, 0)}?`, src: "F-50 · F-10 · F-48",
      a: `PEAK raises demand but not the staff available, so capacity runs out sooner: the plan is **${gapPeople("PEAK")} people short** of need across ${plan.PEAK.below_goal} blocks, ${gapPeople("PEAK", FEB14)} of them on Feb 14. It's still **${points(plan.PEAK.expected_met, draft.PEAK.expected_met)} points** above the draft's ${pct(draft.PEAK.expected_met)}, and the playbook says to arrange outside cover.` },
    { q: "Why does DISRUPT cost less than BASE?", src: "F-42 · F-48 · F-71",
      a: `Fewer people are available, so the plan fields about ${num(plan.BASE.hours - plan.DISRUPT.hours)} fewer hours, at ${money(plan.DISRUPT.cost)}. The draft ignores the cuts: it schedules **${K.disrupt_shortfall_usable_flex} more people than can be fielded** in ${draft.DISRUPT.over_capacity} blocks, and the plan has **${plan.DISRUPT.over_capacity}** over capacity.` },
  ] },
  { title: "The forecast", items: [
    { q: "How accurate is the forecast?", src: "F-44",
      a: `On held-out weeks ${Math.min(...weeks)}-${Math.max(...weeks)}, daily error was **${pct(daily.model)}** against the benchmark's ${pct(daily.benchmark)}. The edge comes from Friday to Monday, where the benchmark's average still carries earlier holiday days (${pct(friMon.model)} against ${pct(friMon.benchmark)}); on normal planning-week days the two agree within ${normalGapText}. So its value is that **it removes holiday distortion**; we don't claim it beats the benchmark in the planning week.` },
    { q: "How do you know Presidents' Day behaves like MLK?", src: "F-45 · A-05 · A-11",
      a: `We can't be sure, because MLK is the only holiday in the history with the same Friday-to-Monday shape. In a test, forecasting the MLK weekend with New Year's effect beat the benchmark for Front End (**${pct(analog[38].model)}** against ${pct(analog[38].benchmark)}) and Merchandising (${pct(analog[92].model)} against ${pct(analog[92].benchmark)}) but not Pharmacy, so the risk model adds extra uncertainty on Feb 13-16.` },
    { q: `Why add ${pct(uplift, 0)} for Valentine's Day?`, src: "F-52 · A-06",
      a: `There's no Valentine's Day in the history, so +${pct(uplift, 0)} for Front End and Merchandising on Feb 14 is a stated judgment call. It barely matters: even if the true lift were ${pct(valentineHigh.true_uplift, 0)}, planning for it would raise expected service there only from **${pct(valentineHigh.our_plan_expected_met)} to ${pct(valentineHigh.replanned_expected_met)}**, because ${short.feb14_front_merch_at_capacity} of the ${short.feb14_front_merch_blocks} blocks are already at capacity.` },
    { q: "What about traffic, promotions and weather?", src: "F-41 · F-61 · F-10",
      a: `Promotions fall on every Friday to Sunday and holiday in the data, so their effect can't be separated, and the weekday and holiday terms carry it. Temperature adds nothing once the weekday is known (correlation **${K.corr_temp_resid.toFixed(3)}**), and the data pack says traffic is an outcome never to use as an input. PEAK's promotion surge comes in through the case's multipliers.` },
  ] },
  { title: "The model and its checks", items: [
    { q: "Why not staff to 85% utilization, like the starter query?", src: "F-03 · F-17 · F-46",
      a: `It sits on the edge of the cliff and ignores callouts. In history, blocks at 0.85-0.90 met target only **${pct(K.met_85_90, 0)}** of the time, and above 0.90 just ${pct(K.met_above_90)}. Our limits for a ${goalPct(GOAL)} chance run from **${Math.min(...limits).toFixed(3)} to ${Math.max(...limits).toFixed(3)}** by warehouse and department and apply to staff who actually work, so the plan adds room for callouts and forecast error.` },
    { q: "How did you check the risk model?", src: "F-46 · F-62 to F-65 · D-29",
      a: `Leaving one week out at a time, its predicted chances track real outcomes: **${pct(calibration.predicted)} predicted against ${pct(calibration.observed)} observed** in the 95-99% group, and a Brier score of ${S.service_brier.model.toFixed(3)} against ${S.service_brier.base_rate.toFixed(3)} for a flat rate. When a calibration study found it ran slightly high near the goal, we switched to a smooth curve that fits better on every measure, and it agrees closely with a check against history that uses no model.` },
    { q: "How do you know the code is right?", src: "F-66 to F-72 · F-54",
      a: `The full test suite passes, and rerunning the pipeline reproduces every output byte for byte. Separate checks that import none of our code rebuild the submission, the cost rule and the search from scratch and agree on every block, and a test confirms all **${num(blocks.length)}** explanations quote their own block's numbers.` },
    { q: "What if illness is worse than DISRUPT?", src: "F-69 · F-50 · Playbook",
      a: `DISRUPT already cuts deeper than January's real flu week, and **${illnessAtCap} of its ${illness.length}** illness blocks are already at capacity, so no schedule can absorb more. The playbook says to escalate early for outside cover, and the Scenario lab cuts available staff further and replans live to show where the new gaps land.` },
  ] },
  { title: "The tool", items: [
    { q: "Why React and FastAPI?", src: "D-24",
      a: "The analysis stays in tested Python, and FastAPI serves it to a real web front end, the way a production tool would be built. It runs on one laptop and needs no internet connection, and with default settings it shows exactly the submitted plan." },
    { q: "Why totals per block instead of individual schedules?", src: "F-15 · Report ch. 5",
      a: "The submission asks for total employees per block, and the data has no individual employee records, skills or preferences. Totals are the decision a planner makes first; the scheduling system that holds those records then turns them into named shifts." },
  ] },
  { title: "Doing it for real", items: [
    { q: "What's the single most useful thing a warehouse leader can do?", src: "F-55 · A-16",
      a: `Limit holiday-weekend PTO approvals. Keeping up to ${ptoMost.kept_per_block} people per block off holiday PTO cuts BASE blocks below the goal from ${ptoNone.blocks_below_goal} to **${ptoMost.blocks_below_goal}**, lifts expected service to **${pct(ptoMost.expected_met)}**, and saves ${money(Math.round(ptoNone.cost) - Math.round(ptoMost.cost))} because regular staff replace overtime. It assumes some PTO is still open to change, which the data doesn't show.` },
    { q: "How would Costco run this for real?", src: "Report ch. 10 · D-24",
      a: "Feed it each week's demand, availability and callout data, rerun it, have warehouse leaders review the board and the blocks below the goal, then publish. The engine and the screens are already separated by an API, so a data feed and Costco's scheduling system could plug in without a rebuild." },
    { q: "What would you do with more time or data?", src: "A-05 · A-06 · A-16 · Q-02 · Q-03",
      a: "Real outcomes from a Presidents' Day and a Valentine's Day, to replace the borrowed and judged effects; employee records, to turn totals into named shifts; and how much holiday PTO is already approved. We'd also ask how callouts are scored and how shared staff are counted, and track actual waits each week to refit the service curve." },
  ] },
];

// ---------- Layout ----------
const PAGE = { width: 12240, height: 15840 }; // US Letter, DXA
const MARGIN = { top: 640, bottom: 640, left: 864, right: 864 };
const WIDTH = PAGE.width - MARGIN.left - MARGIN.right;
const Q_COL = 2820;
const PAD = { top: 44, bottom: 52 };
const SIZE = { kicker: 15, title: 30, body: 18, question: 18, small: 14, big: 28 }; // half-points

const run = (text, o = {}) => new TextRun({ text, font: o.semi ? FONT_SEMI : FONT, size: o.size || SIZE.body,
  color: o.color || C.ink, characterSpacing: o.spacing });
function rich(text, o = {}) {
  // **x** prints x in semibold ink, so the figure to say stands out from the muted sentence.
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) => (part.startsWith("**")
    ? run(part.slice(2, -2), { ...o, semi: true, color: C.ink }) : run(part, o)));
}
const para = (children, o = {}) => new Paragraph({ children, spacing: { before: 0, after: 0, line: 240, ...o.spacing }, ...o.para });
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const hairline = { style: BorderStyle.SINGLE, size: 4, color: C.border };
const noBorders = { top: none, bottom: none, left: none, right: none };

function cell(children, width, o = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: o.align || VerticalAlign.TOP,
    margins: o.margins || { ...PAD, left: 0, right: 140 },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    borders: o.borders || { ...noBorders, bottom: hairline },
    children,
  });
}
const table = (rows, widths) => new Table({ width: { size: WIDTH, type: WidthType.DXA }, columnWidths: widths,
  layout: TableLayoutType.FIXED, borders: { ...noBorders, insideHorizontal: none, insideVertical: none }, rows });

// The heading block, with the simulated-data line first.
const header = [
  para([run("Q&A PREP  ·  COSTCO WORKFORCE PLANNING  ·  TEXAS MISA FALL 2026", { semi: true, size: SIZE.kicker, color: C.accent, spacing: 12 })],
    { spacing: { after: 40 } }),
  para([run("Answers for the judges' questions", { semi: true, size: SIZE.title })], { spacing: { after: 100 } }),
  table([new TableRow({ children: [cell([para([
    run("Simulated data. ", { semi: true, size: SIZE.small + 2, color: C.accent_strong }),
    run("Every figure comes from the case's simulated data pack, not real Costco data, and is read from outputs/ when this sheet is built. Judging order: service, then labor cost, then feasibility. Answer in a breath, then offer the backup slide or the app page.",
      { size: SIZE.small + 2, color: C.accent_strong }),
  ])], WIDTH, { fill: C.accent_soft, margins: { top: 70, bottom: 70, left: 140, right: 140 },
    borders: { ...noBorders, left: { style: BorderStyle.SINGLE, size: 18, color: C.accent } } })] })], [WIDTH]),
];

// Four numbers worth knowing by heart.
// [big number, what it is, the draft's figure]
const TILES = [
  [pct(plan.BASE.expected_met), "Expected service, BASE", `Draft ${pct(draft.BASE.expected_met)}`],
  [`+${pct(costChange)}`, `Labor cost, BASE: ${money(plan.BASE.cost)}`, `Draft ${money(draft.BASE.cost)}`],
  [`${pct(plan.PEAK.expected_met)} / ${pct(plan.DISRUPT.expected_met)}`, "Expected service, PEAK / DISRUPT",
    `Draft ${pct(draft.PEAK.expected_met)} / ${pct(draft.DISRUPT.expected_met)}`],
  [String(plan.DISRUPT.over_capacity), "Blocks over capacity, DISRUPT", `Draft ${draft.DISRUPT.over_capacity}`],
];
const tileWidth = Math.floor(WIDTH / TILES.length);
const tileWidths = TILES.map((_, i) => (i === TILES.length - 1 ? WIDTH - tileWidth * (TILES.length - 1) : tileWidth));
const tiles = table([new TableRow({ cantSplit: true, children: TILES.map(([big, label, was], i) => cell([
  para([run(big, { semi: true, size: SIZE.big, color: C.accent })], { spacing: { line: 240 } }),
  para([run(label, { semi: true, size: SIZE.small + 1, color: C.ink })], { spacing: { before: 10 } }),
  para([run(was, { size: SIZE.small + 1, color: C.ink_subtle })]),
], tileWidths[i], { fill: C.raised, margins: { top: 60, bottom: 70, left: 140, right: 100 },
  borders: { ...noBorders, left: i ? { style: BorderStyle.SINGLE, size: 12, color: C.surface } : none } })) })], tileWidths);

function groupBlock(group, index) {
  const heading = para([
    run(`${index + 1}  `, { semi: true, size: 21, color: C.accent }),
    run(group.title, { semi: true, size: 21, color: C.ink }),
  ], { spacing: { before: 150, after: 20 }, para: { keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.accent_line, space: 3 } } } });
  const rows = group.items.map((item) => new TableRow({ cantSplit: true, children: [
    cell([
      para([run(item.q, { semi: true, size: SIZE.question })]),
      para([run(item.src, { size: SIZE.small, color: C.ink_subtle })], { spacing: { before: 24 } }),
    ], Q_COL),
    cell([para(rich(item.a, { color: C.ink_muted }))], WIDTH - Q_COL, { margins: { ...PAD, left: 60, right: 0 } }),
  ] }));
  return [heading, table(rows, [Q_COL, WIDTH - Q_COL])];
}

const footer = new Footer({ children: [para([
  run("Simulated data, not real Costco data  ·  Rebuild with node scripts/build_qa_sheet.js  ·  IDs refer to planning/",
    { size: SIZE.small, color: C.ink_subtle }),
  new TextRun({ children: [new PositionalTab({ alignment: PositionalTabAlignment.RIGHT,
    relativeTo: PositionalTabRelativeTo.MARGIN, leader: PositionalTabLeader.NONE })], font: FONT, size: SIZE.small }),
  new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], font: FONT, size: SIZE.small, color: C.ink_subtle }),
])] });

const doc = new Document({
  creator: "MISA case team",
  title: "Costco Q&A prep (simulated data)",
  description: "Answers to the judges' likely questions, built from outputs/ (T-94).",
  styles: { default: { document: { run: { font: FONT, size: SIZE.body, color: C.ink } } } },
  sections: [{
    properties: { page: { size: PAGE, margin: { ...MARGIN, header: 360, footer: 360 } } },
    footers: { default: footer },
    children: [
      ...header,
      para([], { spacing: { after: 110 } }),
      tiles,
      ...GROUPS.flatMap(groupBlock),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(TARGET, buffer);
  const count = GROUPS.reduce((a, g) => a + g.items.length, 0);
  console.log(`Wrote ${path.relative(ROOT, TARGET)}: ${count} questions in ${GROUPS.length} groups`);
});
