// Cover and executive summary.
const { Paragraph, Table, TableRow, TableCell, TextRun, ShadingType, BorderStyle, WidthType, TableLayoutType, VerticalAlign, HeightRule } = require("docx");
const { fmt, fx, derive } = require("./claims");
const K = require("./kit");
const D = require("./data");

const { pct, money, int, signedPct } = fmt;
const { s, plan, draft, costChange, pto, gap, SCEN } = D;
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

const NOTICE = "All data in this report is simulated for the Texas MISA case competition. It is not Costco data, and it does not represent Costco wages, staffing levels, schedules or service performance.";

function cover() {
  const t = (text, size, color, opts = {}) => new Paragraph({ spacing: { after: opts.after ?? 120, line: opts.line ?? 260 },
    children: [new TextRun({ text, font: opts.semi ? K.FONT_SEMI : K.FONT, size, color, characterSpacing: opts.spacing })] });
  const team = D.S.team_id === "TEAM_NAME" ? "Team name to be added before submission" : `Team ${D.S.team_id}`;
  const built = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  const band = new Table({
    width: { size: K.WIDTH, type: WidthType.DXA },
    columnWidths: [K.WIDTH],
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ height: { value: 6200, rule: HeightRule.ATLEAST }, children: [new TableCell({
      width: { size: K.WIDTH, type: WidthType.DXA },
      verticalAlign: VerticalAlign.BOTTOM,
      shading: { type: ShadingType.CLEAR, fill: K.C.navy, color: "auto" },
      margins: { top: 600, bottom: 600, left: 560, right: 560 },
      borders: { top: none, bottom: none, left: none, right: none },
      children: [
        t("WORKFORCE PLANNER", 18, K.C.navy_accent, { semi: true, spacing: 40, after: 360 }),
        t("Staffing the", 60, "FFFFFF", { semi: true, after: 0, line: 300 }),
        t("Presidents' Day week", 60, "FFFFFF", { semi: true, after: 240, line: 300 }),
        t("A forecast-driven labor plan for three warehouses, and the tool that runs it", 28, K.C.navy_ink_muted, { after: 480, line: 320 }),
        t("Costco workforce planning case", 21, "FFFFFF", { semi: true, after: 40 }),
        t("Texas MISA Fall 2026 case competition", 21, K.C.navy_ink_muted, { after: 0 }),
      ],
    })] })],
  });
  return [
    new Paragraph({ children: [], spacing: { after: 600 } }),
    band,
    new Paragraph({ children: [], spacing: { after: 360 } }),
    new Paragraph({ spacing: { after: 60 }, children: K.rich(team, { size: 21, bold: true }) }),
    new Paragraph({ spacing: { after: 60 }, children: K.rich(`Planning week: Thursday, Feb 12 to Wednesday, Feb 18, 2026`, { size: 20, color: K.C.ink_muted }) }),
    new Paragraph({ spacing: { after: 480 }, children: K.rich(`This version was built from the analysis on ${built}.`, { size: 20, color: K.C.ink_muted }) }),
    ...K.NOTE("Simulated data", [NOTICE], "warning"),
  ];
}

function summary() {
  const goal = pct(s("service_goal"), 0);
  const open = D.planSum({ scenario_code: "BASE", is_open: "1" }, null, "scenario_code=BASE,is_open=1");
  const last = Math.max(...D.S.pto_what_if.map((r) => r.kept_per_block));
  const ptoSave = derive("cost with no PTO kept - cost at the highest limit", pto(0, "cost").v - pto(last, "cost").v, pto(0, "cost"), pto(last, "cost"));
  const out = [
    K.H1("", "Summary", { pageBreak: true }),
    K.LEAD(`This report plans labor for one hard week, Thursday, Feb 12 to Wednesday, Feb 18, 2026, at three warehouses and under three sets of conditions. Plans are judged on service first, then labor cost, then whether they can be staffed.`),
    K.P(`**Our answer:** staff every block (one warehouse, department, day and shift) to at least a ${goal} chance of meeting its service target. We forecast demand, learn from history how service responds to workload, and allow for callouts and forecast error. Every block in every scenario stays within the staff available. In the expected week (BASE):`),
    ...K.TILES([
      { label: "Expected service", value: pct(plan("BASE", "expected_met")), sub: `Draft: ${pct(draft("BASE", "expected_met"))}`, accent: true },
      { label: "Labor cost", value: money(plan("BASE", "cost")), sub: `${signedPct(costChange("BASE"))} against the draft` },
      { label: `Blocks below the goal`, value: int(plan("BASE", "below_goal")), sub: `of ${int(open)} open; draft: ${int(draft("BASE", "below_goal"))}` },
      { label: "Blocks over capacity", value: int(plan("DISRUPT", "over_capacity")), sub: `Draft: ${int(draft("DISRUPT", "over_capacity"))} in DISRUPT` },
    ]),
    ...K.TABLE("tab:summary", "The plan against the manager's draft in each scenario. Expected service is the average chance of meeting target across open blocks, from our risk model.",
      ["Scenario", "Draft service", "Plan service", "Draft cost", "Plan cost", "Change", `Below ${goal}`],
      SCEN.map((sc) => [`**${sc}**`, pct(draft(sc, "expected_met")), `**${pct(plan(sc, "expected_met"))}**`, money(draft(sc, "cost")), money(plan(sc, "cost")),
        signedPct(costChange(sc)), int(plan(sc, "below_goal"))]),
      [1400, 1250, 1250, 1400, 1400, 1260, 1400]),
    K.P(`**Most of the gain comes from putting hours in the right places.** Only moving hours, at about the draft's cost, lifts BASE expected service from ${pct(draft("BASE", "expected_met"))} to ${pct(D.buffer("Allows for neither", "met_both_risks"))}. The rest is bought with extra holiday-weekend hours and an allowance for callouts.`),
    K.P(`**What a warehouse leader should do:**`, { para: { keepNext: true, spacing: { after: 60 } } }),
    ...K.NUMS([
      `**Run the plan that matches the week:** BASE by default, PEAK if the promotion or storm is confirmed, DISRUPT if Warehouse 2's illness or Warehouse 4's crew shortage is reported.`,
      `**Limit holiday PTO on Feb 14-16.** Keeping up to ${int(s(`pto_what_if[kept_per_block=${last}].kept_per_block`))} people per block from holiday time off cuts BASE blocks below the goal from ${int(pto(0, "blocks_below_goal"))} to ${int(pto(last, "blocks_below_goal"))} and saves ${money(ptoSave)}, as regular staff replace overtime.`,
      `**Approve overtime early and escalate the gaps.** Even at full capacity, BASE is ${int(gap("BASE"))} people short of the goal, mostly on Feb 14; PEAK is ${int(gap("PEAK"))} short and DISRUPT ${int(gap("DISRUPT"))}. Only more available people can close these gaps.`,
    ]),
    K.P(`**The forecast** matches the case's benchmark on normal days and differs around the holidays, where it applies the effects measured on the Martin Luther King Jr. (MLK) weekend. **The tool**, the Workforce Planner, runs on one laptop with no internet: it shows the plan for any scenario and warehouse, explains every block, re-plans live and exports the submission file (chapter 8).`),
  ];
  return out;
}

module.exports = { cover, summary, NOTICE };
