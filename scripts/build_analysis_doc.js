// Builds deliverables/Costco_Case_Analysis.docx from outputs/analysis_summary.json and outputs/charts/.
// Run from the project root, after the pipeline and charts:
//   python -m src.pipeline && python -m src.charts && node scripts/build_analysis_doc.js
// Figures come from the summary file, so they can't drift from the code. Rebuilding replaces the file,
// so hand edits to the Word file are lost unless they are also made here.
const fs = require("fs");
const path = require("path");
const {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, LevelFormat, Packer, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType,
} = require("docx");

const ROOT = path.resolve(__dirname, "..");
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "outputs", "analysis_summary.json"), "utf8"));
const RECON = JSON.parse(fs.readFileSync(path.join(ROOT, "planning", "evidence", "reconcile_dashboard.json"), "utf8"));
const CHECK_PATH = path.join(ROOT, "planning", "evidence", "independent_check.json");
const CHECK = fs.existsSync(CHECK_PATH) ? JSON.parse(fs.readFileSync(CHECK_PATH, "utf8")) : null;
const K = S.kpi;

const FONT = "Arial";
const INK = "1A1A1A";
const MUTED = "55544F";
const ACCENT = "1F4E79";
const RULE = "D0CFC9";
const HEAD_FILL = "EFEEE9";
const NOTE_FILL = "F4F7FB";
const WIDTH = 9360;

// Formatting.
const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const signedPct = (x, d = 1) => `${x >= 0 ? "+" : "-"}${Math.abs(x * 100).toFixed(d)}%`;
const money = (x) => `$${Math.round(x).toLocaleString("en-US")}`;
const moneyK = (x) => `$${Math.round(x / 1000).toLocaleString("en-US")}K`;
const num = (x, d = 0) => Number(x).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const by = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));
const DEPTS = { 38: "Front End", 92: "Merchandising", 95: "Pharmacy" };
const dept = (g) => (g === "All" ? "All departments" : DEPTS[g]);
const WH = { 1: "Warehouse 1", 2: "Warehouse 2", 4: "Warehouse 4" };
const DAY = { "2026-02-12": "Thu Feb 12", "2026-02-13": "Fri Feb 13", "2026-02-14": "Sat Feb 14", "2026-02-15": "Sun Feb 15", "2026-02-16": "Mon Feb 16", "2026-02-17": "Tue Feb 17", "2026-02-18": "Wed Feb 18" };
const SHIFT = { OPEN: "Opening", MID: "Midday", EVE: "Evening" };

// Building blocks.
const run = (text, opts = {}) => new TextRun({ text, font: FONT, color: INK, ...opts });
function rich(text, base = {}) {
  // **bold** spans inside a string.
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) =>
    part.startsWith("**") ? run(part.slice(2, -2), { ...base, bold: true }) : run(part, base));
}
const P = (text, opts = {}) => new Paragraph({ children: rich(text, opts.run), spacing: { after: 120, line: 276 }, ...opts.para });
const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text })] });
const H2 = (text, opts = {}) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text })], ...opts });
const BUL = (text) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: rich(text), spacing: { after: 80, line: 276 } });
const NUM = (text, ref = "steps") => new Paragraph({ numbering: { reference: ref, level: 0 }, children: rich(text), spacing: { after: 80, line: 276 } });
const CAPTION = (text) => new Paragraph({ children: [run(text, { size: 17, color: MUTED })], spacing: { before: 60, after: 200, line: 252 } });
const SPACER = () => new Paragraph({ children: [], spacing: { after: 120 } });

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
function FIG(name, alt) {
  const file = path.join(ROOT, "outputs", "charts", `${name}.png`);
  const size = pngSize(file);
  const width = 600;
  return new Paragraph({
    keepNext: true,
    spacing: { before: 120, after: 40 },
    children: [new ImageRun({
      type: "png",
      data: fs.readFileSync(file),
      transformation: { width, height: Math.round((width * size.height) / size.width) },
      altText: { title: name, description: alt, name },
    })],
  });
}

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
function TABLE(headers, rows, widths, opts = {}) {
  // First column is left-aligned text. The rest are right-aligned unless opts.leftAll is set.
  const total = widths.reduce((a, b) => a + b, 0);
  if (total !== WIDTH) throw new Error(`Table widths sum to ${total}`);
  const align = (i) => (i === 0 || opts.leftAll ? AlignmentType.LEFT : AlignmentType.RIGHT);
  const cell = (text, i, header) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    shading: header ? { type: ShadingType.CLEAR, fill: HEAD_FILL, color: "auto" } : undefined,
    borders: { top: noBorder, left: noBorder, right: noBorder, bottom: cellBorder },
    children: [new Paragraph({ alignment: align(i), children: rich(String(text), { size: 18, bold: header || undefined }) })],
  });
  return new Table({
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) })),
    ],
  });
}
function NOTE(lines) {
  return new Table({
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: [WIDTH],
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: [new TableCell({
      width: { size: WIDTH, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: NOTE_FILL, color: "auto" },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      borders: { top: noBorder, bottom: noBorder, right: noBorder, left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT } },
      children: lines,
    })] })],
  });
}

// Lookups used in the text.
const plan = by(S.plan_summary, "scenario_code");
const draft = by(S.draft_summary, "scenario_code");
const SCEN = ["BASE", "PEAK", "DISRUPT"];
const costChange = (s) => plan[s].cost / draft[s].cost - 1;
const gapTotals = {};
for (const r of S.capacity_gaps) {
  gapTotals[r.scenario_code] = gapTotals[r.scenario_code] || { people: 0, hours: 0, blocks: 0 };
  gapTotals[r.scenario_code].people += r.gap_people;
  gapTotals[r.scenario_code].hours += r.gap_hours;
  gapTotals[r.scenario_code].blocks += r.blocks_short;
}
const gapByDay = {};
for (const r of S.capacity_gaps) {
  gapByDay[r.day_date] = gapByDay[r.day_date] || {};
  gapByDay[r.day_date][r.scenario_code] = (gapByDay[r.day_date][r.scenario_code] || 0) + r.gap_people;
}
const back = by(S.backtest_daily, "group");
const backBlock = by(S.backtest_block, "group");
const analog = by(S.analog_test, "group");
const fday = S.forecast_by_day;
const benchGap = (d, date) => {
  const r = fday.find((x) => x.dept_id === d && x.day_date === date);
  return r.benchmark / r.model_forecast - 1;
};
const fac = (d, w) => S.holiday_factors.find((r) => r.dept_id === d && r.window === w).factor;
const buffer = (planName) => S.buffer_test.find((r) => r.plan === planName && r.scenario_code === "BASE");
const BOTH = "Allows for both risks (recommended)";
const FCST = "Allows for forecast error only";
const NONE = "Allows for neither";
const goalRow = (g) => S.goal_tradeoff.find((r) => r.scenario_code === "BASE" && r.goal === g);
const limit = (d, s, key = "u95") => S.service_limits.find((r) => r.dept_id === d && r.store_id === s)[key];
const bandShare = (lo, hi) => {
  const rows = S.service_bands.filter((r) => r.band >= lo && r.band < hi);
  const blocks = rows.reduce((a, r) => a + r.blocks, 0);
  return { blocks };
};
const val = S.valentine_sensitivity;
const cal = S.service_calibration;

const body = [];

// Title.
body.push(
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: "Costco Workforce Case: Analysis" })] }),
  new Paragraph({ spacing: { after: 60 }, children: [run("Texas MISA Fall 2026. Working draft for the team, updated Wednesday, Nov 4, 2026.", { color: MUTED })] }),
  new Paragraph({
    spacing: { after: 240 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 8 } },
    children: [run("All data in this case is simulated. It is not real Costco data and must not be presented as such.", { color: MUTED, italics: true })],
  }),
);

// Short version.
body.push(H1("The short version"));
body.push(BUL(`**The hours are about right, but they are in the wrong places.** Over six weeks, worked hours came within ${pct(K.worked_vs_req85)} of what it takes to run every block at ${pct(0.85, 0)} utilization, in whole people and above minimum staff. Yet ${num(K.over_hours)} hours sat in overstaffed blocks, worth ${moneyK(K.over_value)}, while ${num(K.short_hours)} hours were missing from understaffed ones.`));
body.push(BUL(`**Service falls off a cliff.** Below ${pct(0.84, 0)} utilization, every block met its target. Between 85% and 90%, only ${pct(K.met_85_90, 0)} did. At 90% or above, almost none did (${pct(K.met_above_90)}).`));
body.push(BUL(`**The draft schedule ignores the holiday week.** It is identical in all three scenarios. Our model expects only ${pct(draft.BASE.expected_met)} of its BASE blocks to meet target, and it can't be fully staffed in ${draft.DISRUPT.over_capacity} DISRUPT blocks, where it is ${num(draft.DISRUPT.unfilled)} people short.`));
body.push(BUL(`**Our forecast differs from the benchmark only around the holiday.** On normal days the two match. For Feb 13-16 we apply the MLK weekend's effects, so the benchmark sits about ${pct(Math.abs(benchGap(38, "2026-02-14")), 0)} below us for Front End on the holiday weekend and ${pct(benchGap(95, "2026-02-16"), 0)} above us for Pharmacy on Presidents' Day. We can't prove Presidents' Day will repeat MLK, so this is our best estimate.`));
body.push(BUL(`**Our first plan lifts expected service a lot, at a real cost.** In BASE, it reaches ${pct(plan.BASE.expected_met)} of blocks meeting target against the draft's ${pct(draft.BASE.expected_met)}, for ${signedPct(costChange("BASE"))} labor cost (${money(plan.BASE.cost)} against ${money(draft.BASE.cost)}). It stays within capacity in all three scenarios.`));
const baseBelowFeb14 = S.below_goal_by_day.find((r) => r.scenario_code === "BASE" && r.day_date === "2026-02-14").blocks;
const BS = S.base_shortfall;
body.push(BUL(`**Capacity runs short around the holiday.** Even using everyone available, ${BS.blocks} BASE blocks can't reach a ${pct(S.service_goal, 0)} chance of meeting target, and their average chance is ${pct(BS.average_chance, 0)}. Of those, ${BS.holiday_blocks} fall on Feb 13-16, including ${baseBelowFeb14} on Saturday, Feb 14. This is the main problem to raise with a warehouse leader, because rearranging the schedule can't fix it. Changing availability can.`));
body.push(SPACER());
body.push(NOTE([
  new Paragraph({ spacing: { after: 80 }, children: rich("**Two calls for the team**") }),
  new Paragraph({ spacing: { after: 80, line: 276 }, children: rich(`**1. How high should the service goal be?** We used ${pct(S.service_goal, 0)}, because judging puts service first. A 90% goal would save ${money(plan.BASE.cost - goalRow(0.9).cost)} in BASE, with expected service of ${pct(goalRow(0.9).expected_met)} instead of ${pct(plan.BASE.expected_met)}. See "How high to set the service goal".`) }),
  new Paragraph({ spacing: { after: 0, line: 276 }, children: rich(`**2. Should the plan allow for callouts?** We don't know whether judges apply callouts to submitted staffing. In our model, allowing for them costs about ${moneyK(buffer(BOTH).cost - buffer(FCST).cost)} in BASE. Asking the organizers would settle this, and the question is drafted but not sent. See "What the allowance for risk costs".`) }),
]));
body.push(SPACER());

// Status.
body.push(H2("Where the work stands", { pageBreakBefore: true }));
body.push(TABLE(["Part", "Status", "Notes"], [
  ["Diagnosis of history", "Done", "Service, staffing gaps, callouts and cost"],
  ["Demand forecast", "First version done", "More accurate than the benchmark on held-out weeks, because it removes holiday distortion. Holiday effects themselves can't be fully tested"],
  ["Service curves and risk model", "First version done", "Checked against held-out weeks and simulation"],
  ["Staffing plan and submission CSV", "First version done", `All 567 rows pass our validator. The team name is still the placeholder ${S.team_id}`],
  ["Explanations and leader playbook", "Not started", ""],
  ["App views and demo", "Not started", "Only a placeholder app exists so far"],
  ["Deck and appendix", "Not started", "This document is the starting material"],
], [3000, 1800, 4560], { leftAll: true }));
body.push(CAPTION("This document is generated from the analysis, so its figures update when it's rebuilt. A rebuild replaces the file, so send comments or edits to whoever is running the code."));

// Case.
body.push(H1("What the case asks for"));
body.push(P("We plan labor for one week, Thursday, Feb 12 to Wednesday, Feb 18, 2026, at three warehouses, in three departments and three shifts a day. Valentine's Day falls on the Saturday and Presidents' Day on the Monday. Demand for that week isn't provided, so forecasting it is part of the task."));
body.push(P("We hand in four things: a 12-15 minute presentation with a demo, the completed staffing template with all 567 rows, a working tool a warehouse leader could use, and supporting analysis. All three scenarios are required. **Plans are judged on service first, then labor cost, then feasibility.**"));
body.push(TABLE(["Scenario", "Demand", "Availability"], [
  ["BASE", "Our forecast", "Planned availability, including holiday-weekend PTO"],
  ["PEAK", "Our forecast, raised up to 30% on Feb 13-15 for a promotion and a storm advisory", "Same as BASE"],
  ["DISRUPT", "Same as BASE", "Illness at Warehouse 2 on Feb 13-16, and a crew shortage at Warehouse 4 on Feb 12-13"],
], [1400, 3980, 3980], { leftAll: true }));
body.push(SPACER());
body.push(P("**Terms used below.** A **block** is one warehouse, department, day and shift. **Utilization** is the workload hours a block's demand requires divided by the labor hours actually worked. A block **meets target** when its service metric is at or under the limit: 5 minutes for Front End checkout, 60 minutes for Merchandising replenishment and 20 minutes for Pharmacy."));

// Diagnosis.
body.push(H1("Diagnosis: what history shows"));
body.push(P(`The six weeks from Jan 1 to Feb 11 cover ${num(K.hist_blocks)} blocks, of which ${num(K.open_blocks)} were open. Overall, ${pct(K.pct_met_all)} of open blocks met target: ${pct(K.pct_met_38)} in Front End, ${pct(K.pct_met_92)} in Merchandising and ${pct(K.pct_met_95)} in Pharmacy.`));
body.push(H2("Service falls off a cliff near 85-90% utilization"));
body.push(FIG("service_cliff", "Line chart of the share of blocks meeting target by utilization band for each department. All three stay near 100 percent below 0.85, fall to about 60 percent at 0.85 to 0.90, and reach about zero at 0.90 and above."));
body.push(CAPTION(`Figure 1. Share of historical blocks meeting target, by utilization. Bands with fewer than 3 blocks are left out. Once utilization passes about 97%, waits level off at roughly ${num(K.sat_ratio_38, 1)} times target for Front End, ${num(K.sat_ratio_92, 1)} for Merchandising and ${num(K.sat_ratio_95, 1)} for Pharmacy.`));
body.push(P("This shape drives everything else. A plan that aims right at 85% has no margin, because a small rise in demand or one callout can push a block over the edge. What counts is **worked** staff, not scheduled staff."));

body.push(H2("Total hours are close, but the mix is wrong"));
body.push(TABLE(["Department", "Worked hours", "Needed at 85%", "Hours above need", "Hours below need", "Value of excess", "Blocks missing target"],
  S.gap_value.map((r) => [r.department, num(r.worked_hours, 0), num(r.required_hours, 0), num(r.over_hours), num(r.short_hours), money(r.over_value), num(r.missed_blocks)]),
  [1860, 1250, 1250, 1250, 1250, 1250, 1250]));
body.push(CAPTION(`Table 1. Six-week totals. Need is the headcount that puts a block at 85% utilization, never below minimum staff. Before rounding up to whole people and applying minimum staff, need is ${num(K.raw_need85_hours)} hours, and worked hours are ${pct(K.worked_vs_raw_need85)} above that. Excess is valued at loaded regular rates.`));
body.push(P(`Schedules barely follow volume: by department, across the five full weeks from Jan 8, weekly demand moved by up to ${pct(K.demand_index_spread, 0)} while scheduled hours moved by at most ${pct(K.hours_index_spread, 0)}. The largest gaps by block type:`));
const gapRow = (r) => [`${WH[r.store_id]} ${r.department}`, `${r.day_type} ${SHIFT[r.shift_code].toLowerCase()}`, pct(r.avg_utilization, 0), pct(r.met_target, 0), num(Math.abs(r.net_hours), 0), num(Math.abs(r.scheduled_net_hours), 0)];
body.push(TABLE(["Most understaffed", "Block type", "Avg utilization", "Met target", "Hours short, as worked", "Hours short, as scheduled"], S.worst_short.slice(0, 5).map(gapRow), [2800, 2060, 1100, 1000, 1200, 1200]));
body.push(SPACER());
body.push(TABLE(["Most overstaffed", "Block type", "Avg utilization", "Met target", "Hours over, as worked", "Hours over, as scheduled"], S.worst_over.slice(0, 5).map(gapRow), [2800, 2060, 1100, 1000, 1200, 1200]));
body.push(CAPTION("Table 2. Largest net gaps against 85% utilization over six weeks. As scheduled means before callouts and backfill. The full ranking is in outputs/diagnosis_staffing_gaps.csv."));
const wm = S.worst_short.find((r) => r.store_id === 1 && r.shift_code === "EVE" && r.dept_id === 92);
body.push(P(`Some of these are clear schedule habits. Warehouse 4 Merchandising's weekday opening crew runs at ${pct(S.worst_over[0].avg_utilization, 0)} utilization, while its weekday evening crew runs at ${pct(S.worst_short[0].avg_utilization, 0)} and meets target only ${pct(S.worst_short[0].met_target, 0)} of the time. That evening crew is ${num(Math.abs(S.worst_short[0].scheduled_net_hours), 0)} hours short before anyone calls out. Others are partly callouts: Warehouse 1 Merchandising's weekday evening gap falls from ${num(Math.abs(wm.net_hours), 0)} hours as worked to ${num(Math.abs(wm.scheduled_net_hours), 0)} as scheduled.`));

body.push(H2("Callouts are predictable"));
const coCtx = { weekday: "Weekdays", weekend: "Weekends", day_after_holiday: "Day after a holiday", flu_cluster: "Warehouse 2 flu week" };
const coRate = (d, c) => { const r = S.callout_rates.find((x) => x.dept_id === d && x.context === c); return r ? pct(r.rate) : "Not affected"; };
body.push(TABLE(["Situation", "Front End", "Merchandising", "Pharmacy"],
  Object.entries(coCtx).map(([c, label]) => [label, coRate(38, c), coRate(92, c), coRate(95, c)]), [3360, 2000, 2000, 2000]));
body.push(CAPTION(`Table 3. Callouts as a share of scheduled employees. Flu-week blocks (Warehouse 2 Front End and Pharmacy, Jan 22-28) are separated from the other rows. The day-after-holiday figures rest on just two days. Pharmacy's rates rest on few people: ${["day_after_holiday", "weekend", "flu_cluster"].map((c) => { const r = S.callout_rates.find((x) => x.dept_id === 95 && x.context === c); return `${r.callouts} of ${r.scheduled} ${coCtx[c].toLowerCase()}`; }).join(", ")}. The plan uses these rates as they are (A-15).`));
body.push(P(`Overall, ${pct(K.callout_rate_all)} of scheduled employees called out, and ${pct(K.backfill_share, 0)} of those were backfilled with overtime. When overtime capacity was already used up, none were. Blocks that lost people met target far less often: ${pct(K.met_loss_fe, 0)} against ${pct(K.met_noloss_fe, 0)} in Front End, ${pct(K.met_loss_ms, 0)} against ${pct(K.met_noloss_ms, 0)} in Merchandising, and ${pct(K.met_loss_rx, 0)} against ${pct(K.met_noloss_rx, 0)} in Pharmacy.`));

body.push(H2("Overtime is not the main cost lever"));
body.push(P(`Labor cost over the six weeks was ${money(K.labor_cost_6wk)}. Overtime was ${pct(K.ot_hours_share)} of worked hours, and its premium over regular pay came to just ${money(K.ot_premium_6wk)}, or ${pct(K.ot_premium_share)} of labor cost. Where the hours go matters far more than whether some are overtime.`));

// Forecast.
body.push(H1("Forecast: what the planning week looks like"));
body.push(H2("How the forecast works"));
body.push(P("We forecast each department's daily demand with a regression on four things, then split each day into shifts using average shares:"));
body.push(BUL("**Warehouse level:** how busy each department is at each warehouse."));
body.push(BUL("**Weekday shape:** each department's own weekly pattern. Front End peaks on Saturday, while Merchandising peaks on Monday."));
body.push(BUL("**Holiday windows:** we use the MLK weekend as the guide for Presidents' Day, because history has no other match."));
body.push(BUL("**Weekly level:** this keeps a busy week from being mistaken for a holiday effect. MLK week was the busiest of the six. A future week's level can't be known, so the forecast uses the average of the last four weeks."));
body.push(P(`Together these explain almost all of the variation: warehouse and weekday alone reach ${pct(K.r2_dow)}, and adding holidays reaches ${pct(K.r2_dow_hol)}. Temperature and promotions add nothing once the weekday is known (correlations of ${num(K.corr_temp_resid, 3)} and ${num(K.corr_promo_resid, 3)}), so we left them out. The Feb 17 post-holiday rebound flag also has no support: Jan 20, flagged the same way, ran level with its own week (within ${pct(K.rebound_extra)}).`));
body.push(TABLE(["Department", "Fri-Sun before the holiday", "Holiday Monday"], [38, 92, 95].map((d) => [DEPTS[d], `x ${num(fac(d, "pre_holiday_weekend"), 2)}`, `x ${num(fac(d, "holiday_monday"), 2)}`]), [3360, 3000, 3000]));
body.push(CAPTION("Table 4. Holiday effects estimated from the MLK window, applied to Presidents' Day. They match the factors in the data pack's own build script, so the MLK effects themselves are measured exactly. Whether Presidents' Day repeats them is the assumption."));

body.push(H2("How well it works, and where we can't tell"));
body.push(TABLE(["Department", "Our daily error", "Benchmark daily error", "Our block error", "Benchmark block error"],
  ["All", 38, 92, 95].map((g) => [dept(g), pct(back[g].model), pct(back[g].benchmark), pct(backBlock[g].model), pct(backBlock[g].benchmark)]),
  [2560, 1700, 1700, 1700, 1700]));
const wk = S.backtest_by_week;
body.push(CAPTION(`Table 5. Mean absolute percentage error on weeks 4, 5 and 6, each forecast using only earlier weeks. By week, our daily error against the benchmark's was ${wk.map((r) => `${pct(r.model)} vs ${pct(r.benchmark)}`).join(", ")}. The benchmark method here is the same-weekday average of up to the last four weeks.`));
const dg = by(S.backtest_by_day_group, "group");
body.push(P(`**What this does and doesn't show.** The edge comes from Friday to Monday, where the benchmark's average included earlier holiday days: ${pct(dg["Fri-Mon"].model)} against ${pct(dg["Fri-Mon"].benchmark)}. On Tuesday to Thursday the two nearly tie, at ${pct(dg["Tue-Thu"].model)} against ${pct(dg["Tue-Thu"].benchmark)}. So the backtest shows that we remove holiday distortion. It doesn't show that we would beat the benchmark in the planning week, where the two match on normal days and the other days are holidays.`));
body.push(P("The one test of borrowing a holiday effect is thin. We forecast the MLK weekend from weeks 1 and 2, using the New Year rebound as the guide."));
body.push(TABLE(["Department", "Our error", "Benchmark error"], ["All", 38, 92, 95].map((g) => [dept(g), pct(analog[g].model), pct(analog[g].benchmark)]), [4360, 2500, 2500]));
body.push(CAPTION("Table 6. Error on Fri-Sun, Jan 16-18, from two weeks of training data. Errors are large for both methods, partly because MLK week was unusually busy."));
body.push(P(`That's close overall: better than the benchmark for Front End and Merchandising, and worse for Pharmacy. **So the holiday forecast is our best estimate, not a proven result.** The plan allows for this by carrying extra forecast uncertainty on Feb 13-16.`));

body.push(H2("Where the forecast differs from the benchmark"));
body.push(FIG("benchmark_gap", "Line chart of the benchmark's gap against our model by day. Normal days are at zero. Front End and Merchandising are about 5 to 8 percent below zero on Friday to Sunday, and Pharmacy is about 33 percent above zero on Monday."));
body.push(CAPTION("Figure 2. The benchmark against our model, before the Valentine's Day adjustment, summed across warehouses. Below zero means the benchmark is too low. On normal days the two match, because both use the same four weeks."));
body.push(P("The benchmark averages four weeks, one of which held the MLK weekend, so it carries only a quarter of the holiday effect. That's why it runs low for Front End and Merchandising, and high for Pharmacy, whose demand falls on holidays."));

body.push(H2("Valentine's Day is a judgment call"));
body.push(P(`History has no Valentine's Day, and the data pack gives Feb 14 the same holiday features as the days around it. The case still requires us to forecast the effect, so we added ${pct(S.valentine_uplift["Front End"], 0)} for Front End and Merchandising on that Saturday, on top of the holiday weekend effect, and none for Pharmacy. The table shows how much the answer depends on that choice.`));
body.push(TABLE(["If the true uplift is", "Expected service, our plan", "Expected service, if we had planned for it", "Feb 14 cost, if we had planned for it"],
  val.map((r) => [pct(r.true_uplift, 0), pct(r.our_plan_expected_met), pct(r.replanned_expected_met), money(r.replanned_feb14_cost)]),
  [2160, 2400, 2400, 2400]));
body.push(CAPTION(`Table 7. BASE, Front End and Merchandising blocks on Feb 14 only. Our plan's cost for those blocks is ${money(val[0].our_plan_feb14_cost)}.`));
body.push(P(`**Planning for a higher uplift barely helps, because ${BS.feb14_front_merch_at_capacity} of these ${BS.feb14_front_merch_blocks} blocks are already at capacity.** The size of this assumption matters less than the shortage of available staff on that day.`));

// Plan.
body.push(H1("The first staffing plan"));
body.push(H2("How the plan is built"));
body.push(NUM("**Forecast demand** for each block, and apply the scenario's multiplier."));
body.push(NUM("**Estimate the chance of meeting target** at each possible headcount. This combines the service curve with three risks: demand above forecast, callouts that aren't backfilled, and the scatter seen in history."));
body.push(NUM(`**Choose the cheapest staffing** that reaches a ${pct(S.service_goal, 0)} chance in each block, using the case's cost rule: regular staff first, then cross-trained staff the partner department can spare, then overtime.`));
body.push(NUM("**Where capacity falls short,** staff as close to the need as possible and flag the block."));
body.push(P(`Front End and Merchandising are solved together in each shift, because they share cross-trained staff. A department only lends staff it doesn't need itself. Without that rule, the search cut the most overloaded departments to lend their people elsewhere, which looks good on paper but no warehouse leader would accept.`));
body.push(P(`Warehouses differ in where service breaks. A 95% chance of meeting target needs utilization at or below ${pct(limit(38, 2), 0)} for Warehouse 2 Front End, for example, against ${pct(limit(38, 1), 0)} for Warehouse 1 Front End. Where capacity allows, each block's plan runs below its limit, to leave room for callouts and forecast error.`));

body.push(H2("Results against the draft"));
body.push(TABLE(["", "BASE", "PEAK", "DISRUPT"], [
  ["Draft cost", ...SCEN.map((s) => money(draft[s].cost))],
  ["Plan cost", ...SCEN.map((s) => money(plan[s].cost))],
  ["Change in cost", ...SCEN.map((s) => signedPct(costChange(s)))],
  ["Draft hours", ...SCEN.map((s) => num(draft[s].hours, 1))],
  ["Plan hours", ...SCEN.map((s) => num(plan[s].hours, 1))],
  ["Draft expected service", ...SCEN.map((s) => pct(draft[s].expected_met))],
  ["**Plan expected service**", ...SCEN.map((s) => `**${pct(plan[s].expected_met)}**`)],
  ["Draft blocks above capacity", ...SCEN.map((s) => num(draft[s].over_capacity))],
  ["Plan blocks above capacity", ...SCEN.map((s) => num(plan[s].over_capacity))],
  [`Plan blocks below the ${pct(S.service_goal, 0)} goal`, ...SCEN.map((s) => num(plan[s].below_goal))],
], [3660, 1900, 1900, 1900]));
body.push(CAPTION("Table 8. Expected service is the average chance of meeting target across open blocks, from our risk model, so it is a prediction and not a measured result. Costs follow the case's rule and count only staff who can actually be fielded."));
body.push(FIG("plan_vs_draft", "Bar chart comparing expected blocks meeting target for the current draft and our first plan in the BASE, PEAK and DISRUPT scenarios. Our plan is higher in all three."));
body.push(CAPTION("Figure 3. Expected share of blocks meeting target. The same values are in Table 8."));
const pd = S.plan_by_dept.filter((r) => r.scenario_code === "BASE");
body.push(TABLE(["BASE, by department", "Draft hours", "Plan hours", "Draft cost", "Plan cost", "Draft service", "Plan service"],
  pd.map((r) => [r.department, num(r.hours_draft, 1), num(r.hours, 1), money(r.cost_draft), money(r.cost), pct(r.expected_met_draft), pct(r.expected_met)]),
  [2160, 1200, 1200, 1200, 1200, 1200, 1200]));
body.push(CAPTION("Table 9. The full block-by-block comparison is in outputs/plan_vs_draft.csv."));

body.push(H2("Where capacity runs out"));
const gapDays = Object.keys(gapByDay).sort();
body.push(TABLE(["People short of need", "BASE", "PEAK", "DISRUPT"], [
  ...gapDays.map((d) => [DAY[d], ...SCEN.map((s) => num(gapByDay[d][s] || 0))]),
  ["**Total people short**", ...SCEN.map((s) => `**${num(gapTotals[s].people)}**`)],
  ["Blocks affected", ...SCEN.map((s) => num(gapTotals[s].blocks))],
], [3660, 1900, 1900, 1900]));
body.push(CAPTION(`Table 10. People beyond capacity needed to reach the ${pct(S.service_goal, 0)} goal, summed across blocks. A block in this table already uses all of its own regular staff and overtime. Being short of the goal doesn't mean a block is expected to fail: in BASE, the average chance in these blocks is ${pct(BS.average_chance, 0)}, and ${BS.near_goal_blocks} of the ${BS.blocks} sit between 90% and 95%.`));
body.push(P(`**Feb 14 is the pinch point in every scenario,** because holiday-weekend PTO cuts availability just as demand peaks. Front End's available regular staff falls by about 4 to 5 people per block that weekend, compared with recent weekends. This points to actions beyond the schedule, which the playbook should cover: limiting PTO approvals for that Saturday, or arranging extra cover ahead of time.`));
body.push(P(`In DISRUPT, the illness cluster leaves Warehouse 2 Front End far short of need. A plan can't solve that alone, so the deck should say plainly what the leader should expect and do.`));
body.push(P(`**The Feb 17 row rests on thin data.** Those ${BS.feb17_pharmacy_short} BASE blocks are all Pharmacy, and they come from the ${pct(S.callout_rates.find((x) => x.dept_id === 95 && x.context === "day_after_holiday").rate, 0)} day-after-holiday callout rate. At Pharmacy's ${pct(BS.feb17_weekday_rate)} weekday rate, only ${BS.feb17_pharmacy_short_at_weekday_rate} of them would stay below the goal.`));

body.push(H2("What the allowance for risk costs"));
body.push(P("We don't know how judges score a plan (the case doesn't publish its scorer), so we built three plans and scored each one three ways. All use the BASE scenario and the same service goal."));
const bufRow = (name, label) => { const r = buffer(name); return [label, money(r.cost), pct(r.met_both_risks), pct(r.met_forecast_error_only), pct(r.met_neither)]; };
body.push(TABLE(["Plan allows for", "Cost", "Service if both risks happen", "Service with forecast error, no callouts", "Service with neither"],
  [bufRow(BOTH, "**Both risks (recommended)**"), bufRow(FCST, "Forecast error only"), bufRow(NONE, "Neither"), bufRow("Current draft", "Current draft, for comparison")], [2760, 1500, 1700, 1800, 1600]));
body.push(CAPTION("Table 11. BASE scenario. Service is the expected share of blocks meeting target under each set of conditions."));
body.push(P(`**The "Neither" row is a useful result on its own.** Just moving hours to where they are needed, at about the draft's cost, lifts expected service in every column: from ${pct(buffer("Current draft").met_both_risks)} to ${pct(buffer(NONE).met_both_risks)} with both risks, and from ${pct(buffer("Current draft").met_neither)} to ${pct(buffer(NONE).met_neither)} with neither. The rest of the improvement is bought with extra hours.`));
body.push(P(`In our model, the allowance for callouts costs about ${moneyK(buffer(BOTH).cost - buffer(FCST).cost)}. If judges ignore callouts, it buys little (${pct(buffer(FCST).met_forecast_error_only)} to ${pct(buffer(BOTH).met_forecast_error_only)}). If they apply them, it buys a lot (${pct(buffer(FCST).met_both_risks)} to ${pct(buffer(BOTH).met_both_risks)}). Since service is judged first and history shows callouts are real, we kept it.`));

body.push(H2("How high to set the service goal"));
body.push(FIG("goal_tradeoff", "Line chart of BASE labor cost against expected service for service goals from 85 to 99 percent, with the current draft shown far below and to the left. Service gains flatten as cost rises."));
body.push(CAPTION("Figure 4. Cost against expected service in BASE. Each extra point of service costs more than the last."));
body.push(TABLE(["Service goal", "Cost", "Change from draft", "Expected service", "Blocks below goal"],
  S.goal_tradeoff.filter((r) => r.scenario_code === "BASE").map((r) => [`${r.goal * 100 % 1 ? (r.goal * 100).toFixed(1) : (r.goal * 100).toFixed(0)}%${r.goal === S.service_goal ? " (chosen)" : ""}`, money(r.cost), signedPct(r.cost / draft.BASE.cost - 1), pct(r.expected_met), num(r.below_goal)]),
  [2360, 1750, 1750, 1750, 1750]));
body.push(CAPTION("Table 12. BASE scenario. More blocks fall below a higher goal because capacity stays fixed."));
body.push(P(`We chose ${pct(S.service_goal, 0)} as a starting point. Going from 92.5% to 95% adds ${money(goalRow(0.95).cost - goalRow(0.925).cost)} for ${((goalRow(0.95).expected_met - goalRow(0.925).expected_met) * 100).toFixed(1)} points of expected service, while going from 97.5% to 99% adds ${money(goalRow(0.99).cost - goalRow(0.975).cost)} for only ${((goalRow(0.99).expected_met - goalRow(0.975).expected_met) * 100).toFixed(1)}. This is one setting, so changing it takes minutes.`));

// Verification.
body.push(H1("How we checked this"));
body.push(BUL(`**Rebuilt the Nov 2 EDA dashboard from the raw CSVs.** Of its ${RECON.calculated} calculated headline figures, we reproduced ${RECON.matched}, which includes the 29-person shortfall we then correct below. The other ${RECON.differ} are explained below. Its full tables for hours, service bands, holiday factors, callouts and capacity also matched.`));
body.push(BUL(`**Tested forecasts on held-out weeks,** and service curves by leaving out one week at a time. The curves' Brier score was ${num(S.service_brier.model, 3)} against ${num(S.service_brier.base_rate, 3)} for simply using the average rate, where lower is better.`));
const c9599 = cal.find((r) => r.bin === "95-99%");
body.push(BUL(`**Checked the predicted chances against what happened.** Blocks predicted at 95-99% met target ${pct(c9599.observed)} of the time, against ${pct(c9599.predicted)} predicted. So our expected service may run a little high near the goal.`));
body.push(BUL("**Checked the risk calculation against a direct simulation.** This caught a real error in our first version, which is now fixed, and a test keeps it from returning."));
body.push(BUL("**Wrote automated tests** for the allocation rule, forecast, risk model, search and submission validator."));
if (CHECK) body.push(BUL(CHECK.summary));
body.push(H2("Corrections to the dashboard"));
body.push(BUL(`**DISRUPT shortfall.** The dashboard says the draft is 29 people short. Limiting cross-trained staff to what the partner department can spare, as the case's rule says, makes it **${num(K.disrupt_shortfall_usable_flex)}**, still across 12 blocks. The draft's DISRUPT cost is ${money(K.draft_cost_disrupt)}, not $327,334, because the dashboard also let overtime run past its limit.`));
body.push(BUL(`**Warehouse 1 Pharmacy.** The dashboard's 95% limit of 0.908 rests on only ${RECON.pharmacy_w1_blocks_near_cliff} blocks between 0.85 and 0.95 utilization. Our curve, which uses every block's measured wait, gives ${num(limit(95, 1), 3)}. Don't quote the 0.908 figure.`));
body.push(BUL("**Three correlation figures and one noise figure** couldn't be reproduced, because their exact definitions aren't recorded. The page doesn't use the correlations. The noise figure of about 4% holds up under the groupings we tried. We don't rely on any of them."));
body.push(H2("What hasn't been checked"));
body.push(BUL("How judges actually score service. We have only the order of priorities."));
body.push(BUL("The model's assumptions. The separate check's service model had the same basic structure as ours, so its agreement supports the arithmetic, not the assumptions."));
body.push(BUL("The holiday forecast itself, since the true planning-week demand is hidden. The MLK analog is an assumption."));
body.push(BUL("The exact cross-trained staff rule, which isn't published. Ours is our reading of the README."));

// Assumptions.
body.push(H1("Assumptions we added"));
body.push(P("The case asks us to identify any assumptions of our own. These are proposed unless noted, and any of them could change."));
body.push(TABLE(["ID", "Assumption", "If it's wrong"], [
  ["A-01", "Usable cross-trained staff is the smaller of the row's flex figure and what the partner department has left over after filling its own total from regular staff", "Plans could cost more or be flagged infeasible"],
  ["A-02", "Sharing follows the shift code, even though Opening covers different clock hours by department", "Less flex may be available in Opening blocks"],
  ["A-03", "Plans should allow for callouts, using historical rates, with about half backfilled", "If judges ignore callouts, this adds cost without earning credit"],
  ["A-04", "85% utilization is a ceiling, not a target", "Too cautious adds cost; too tight misses targets"],
  ["A-05", "The MLK window is a fair guide to the Presidents' Day window", "The holiday effect is misjudged"],
  ["A-06", `Valentine's Day adds ${pct(S.valentine_uplift["Front End"], 0)} for Front End and Merchandising on Feb 14, as a stated judgment`, "Saturday demand is misjudged, though capacity limits that day anyway"],
  ["A-07", "The Jan 2-4 rebound gets its own effect, and the flu cluster affects callouts rather than demand. Confirmed: demand fits exactly with no separate flu term", "The baseline forecast is skewed"],
  ["A-08", "Planning-week temperature and promotion fields are accepted as given. We ended up not using them", "No effect on this version"],
  ["A-09", "The historical service curve applies to the planning week", "Service risk is misjudged"],
  ["A-10", "Borrowed staff are costed at the regular rate of the department they cover", "Small cost differences"],
  ["A-11", "Borrowing a holiday effect adds forecast uncertainty on Feb 13-16: 2% for Front End and Merchandising, 5% for Pharmacy", "Holiday-week headroom is too small or too large"],
  ["A-12", "DISRUPT's illness cluster has January's flu-week callout rates, on top of the availability cuts", "DISRUPT plans at Warehouse 2 are over- or under-buffered"],
  ["A-13", `The service goal is a ${pct(S.service_goal, 0)} chance of meeting target in each block`, "Cost and service move along the trade-off above"],
  ["A-14", "A future week's demand level matches the average of the last four weeks. Weekly levels have ranged about 5% either way", "All forecasts shift together"],
  ["A-15", "Callout rates by situation are used as measured, even where few people stand behind them, as with Pharmacy", "A few Pharmacy blocks are over- or under-buffered, most visibly on Feb 17"],
], [760, 5100, 3500], { leftAll: true }));
body.push(SPACER());

// Next.
body.push(H1("Open items and what's next"));
body.push(H2("Waiting on someone"));
body.push(BUL("**Organizer questions, on hold.** Nothing has been sent. We still need the exact Saturday deadline and how to hand everything in, so we should come back to this by Thursday. The answer on scoring callouts also settles the second call above."));
body.push(BUL(`**Team name.** The CSV uses the placeholder ${S.team_id}, which must be replaced before submitting.`));
body.push(BUL("**Service goal and callout allowance.** The two calls for the team at the top of this document."));
body.push(H2("Still to build"));
body.push(BUL("**App:** scenario selector, staffing, cost and risk views, a demand view, and a \"why this recommendation\" panel."));
body.push(BUL("**Explanations:** a reason for every changed block."));
body.push(BUL("**Leader playbook:** what to do when demand or staffing shifts, especially on Feb 14 and in the Warehouse 2 illness case."));
body.push(BUL("**Deck and appendix:** 12-15 minutes covering diagnosis, forecast, recommendation and all three scenarios, with a demo."));
body.push(BUL("**Rehearsal and backup:** run the demo in a real browser with Wi-Fi off, record a backup, and time the full presentation."));
body.push(H2("Work that doesn't need coding"));
body.push(BUL("Outline the deck from the sections above. The diagnosis and scenario stories are ready to use."));
body.push(BUL("Draft the leader playbook, using the capacity table and the scenario descriptions."));
body.push(BUL("Challenge the assumptions above, especially Valentine's Day, and question anything that doesn't make business sense."));
body.push(H2("Where everything is"));
body.push(BUL("**Submission CSV:** outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv"));
body.push(BUL("**Block-by-block comparison:** outputs/plan_vs_draft.csv"));
body.push(BUL("**Plans, decisions and findings:** the planning folder"));

const doc = new Document({
  creator: "Texas MISA team",
  title: "Costco Workforce Case: Analysis",
  description: "Working analysis for the Texas MISA Fall 2026 case. All data is simulated.",
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: INK } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 44, bold: true, color: ACCENT }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 30, bold: true, color: ACCENT }, paragraph: { spacing: { before: 360, after: 120 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 23, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 80 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] },
      { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 300 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, bottom: 1200, left: 1440, right: 1440 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [run("Simulated data, not real Costco data. Working draft. Page ", { size: 16, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: MUTED })],
      })] }),
    },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  const out = path.join(ROOT, "deliverables", "Costco_Case_Analysis.docx");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buffer);
  console.log(`Wrote ${out} (${buffer.length} bytes)`);
});
