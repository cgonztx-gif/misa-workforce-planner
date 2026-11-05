// Builds the written report, deliverables/Costco_Case_Analysis.docx (T-92), from outputs/ and the app's screenshots.
// Run from the project root after the pipeline and charts:
//   python -m src.pipeline && python -m src.charts && node scripts/build_analysis_doc.js [--no-word]
// Every calculated figure is read from outputs/ through scripts/report/claims.js, which records its source key.
// The register goes to planning/evidence/report_claims.json, and the build fails if any printed digit lacks a source.
// After writing the .docx, Word (by COM, Windows only) fills the table of contents and exports the PDF;
// --no-word skips that. A rebuild replaces the file, so make edits here, not in Word (D-20, D-28).
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  AlignmentType, BorderStyle, Document, Footer, Header, LevelFormat, Packer, PageNumber, Paragraph, PositionalTab,
  PositionalTabAlignment, PositionalTabLeader, PositionalTabRelativeTo, TableOfContents, TextRun,
} = require("docx");
const { register } = require("./report/claims");
const K = require("./report/kit");
const { cover, summary, NOTICE } = require("./report/ch_front");
const { chapter1, chapter2 } = require("./report/ch_case");
const { chapter3, chapter4 } = require("./report/ch_history");
const { chapter5 } = require("./report/ch_method");
const { chapter6, chapter7 } = require("./report/ch_results");
const { chapter8, prepareScreens, SCREENSHOTS } = require("./report/ch_tool");
const { chapter9, chapter10 } = require("./report/ch_checks");
const { appendices } = require("./report/ch_appendix");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "deliverables", "Costco_Case_Analysis.docx");
const REGISTER = path.join(ROOT, "planning", "evidence", "report_claims.json");
const TITLE = "Staffing the Presidents' Day week";
const { C, FONT, FONT_SEMI } = K;

// What each chart is drawn from, for the register. The charts themselves are drawn by src/charts.py.
const FIGURE_SOURCES = {
  planning_timeline: ["data pack v_PlanningWeekGrid.csv", "outputs/charts/figure_data.json:timeline"],
  service_cliff: ["analysis_summary.json:service_bands"],
  staffing_gaps: ["outputs/diagnosis_staffing_gaps.csv"],
  callout_rates: ["analysis_summary.json:callout_rates"],
  holiday_factors: ["analysis_summary.json:holiday_factors"],
  backtest_error: ["analysis_summary.json:backtest_daily", "analysis_summary.json:backtest_by_day_group"],
  forecast_vs_benchmark: ["analysis_summary.json:forecast_by_day"],
  service_curves: ["analysis_summary.json:curves", "analysis_summary.json:service_bands", "analysis_summary.json:service_goal"],
  risk_example: ["analysis_summary.json:curves", "outputs/plan_vs_draft.csv", "outputs/charts/figure_data.json:risk_example"],
  allocation_example: ["outputs/plan_vs_draft.csv", "outputs/charts/figure_data.json:allocation_example"],
  goal_tradeoff: ["analysis_summary.json:goal_tradeoff", "analysis_summary.json:draft_summary"],
  plan_vs_draft: ["analysis_summary.json:plan_summary", "analysis_summary.json:draft_summary"],
  service_by_day: ["analysis_summary.json:plan_by_day"],
  hours_by_day: ["outputs/plan_vs_draft.csv", "outputs/charts/figure_data.json:hours_by_day"],
  pto_what_if: ["analysis_summary.json:pto_what_if"],
  calibration: ["analysis_summary.json:service_calibration"],
  architecture: ["a diagram, no figures"],
};

function build(screens, map) {
  K.reset(map);
  register.claims.length = 0;
  register.where = "Cover";
  const front = cover();
  const body = [
    new Paragraph({ style: "ContentsTitle", children: [new TextRun({ text: "Contents" })] }),
    new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
    ...summary(), ...chapter1(), ...chapter2(), ...chapter3(), ...chapter4(), ...chapter5(), ...chapter6(), ...chapter7(),
    ...chapter8(screens), ...chapter9(), ...chapter10(), ...appendices(),
  ];
  return { front, body, map: { ...K.labels.map } };
}

const small = (text, extra = {}) => new TextRun({ text, font: FONT, size: 15, color: C.ink_subtle, ...extra });

function document(front, body) {
  const heading = (id, name, size, color, before, after, level, extra = {}) => ({
    id, name, basedOn: "Normal", next: "Normal", quickFormat: true,
    run: { font: FONT_SEMI, size, color },
    paragraph: { spacing: { before, after, line: 264 }, keepNext: true, keepLines: true, outlineLevel: level, ...extra },
  });
  return new Document({
    creator: "Texas MISA team",
    title: TITLE,
    description: `Costco workforce planning case report. ${NOTICE}`,
    styles: {
      default: { document: { run: { font: FONT, size: 20, color: C.ink } } },
      paragraphStyles: [
        heading("Heading1", "Heading 1", 40, C.navy, 0, 280, 0, { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent_line, space: 10 } } }),
        heading("Heading2", "Heading 2", 26, C.ink, 340, 120, 1),
        heading("Heading3", "Heading 3", 22, C.ink, 240, 80, 2),
        { id: "ContentsTitle", name: "Contents Title", basedOn: "Normal", next: "Normal", run: { font: FONT_SEMI, size: 40, color: C.navy },
          paragraph: { spacing: { after: 280 }, pageBreakBefore: true, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent_line, space: 10 } } } },
        { id: "TOC1", name: "toc 1", basedOn: "Normal", next: "Normal", run: { font: FONT_SEMI, size: 21, color: C.ink },
          paragraph: { spacing: { before: 140, after: 40 }, tabStops: [{ type: "right", position: 9350, leader: "dot" }] } },
        { id: "TOC2", name: "toc 2", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 19, color: C.ink_muted },
          paragraph: { spacing: { before: 0, after: 30 }, indent: { left: 400 }, tabStops: [{ type: "right", position: 9350, leader: "dot" }] } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 240 } }, run: { color: C.accent } } }] },
        { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 300 } }, run: { font: FONT_SEMI, color: C.accent } } }] },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1300, left: 1440, right: 1440 } } },
        headers: { default: new Header({ children: [new Paragraph({ children: [] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ children: [] })] }) },
        children: front,
      },
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1300, left: 1440, right: 1440, header: 640, footer: 560 },
          pageNumbers: { start: 1 } } },
        headers: { default: new Header({ children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.border, space: 6 } },
          children: [small("WORKFORCE PLANNER", { font: FONT_SEMI, color: C.accent, characterSpacing: 20 }),
            new TextRun({ children: [new PositionalTab({ alignment: PositionalTabAlignment.RIGHT, relativeTo: PositionalTabRelativeTo.MARGIN, leader: PositionalTabLeader.NONE })] }),
            small(TITLE)],
        })] }) },
        footers: { default: new Footer({ children: [new Paragraph({
          children: [small("Simulated data for the Texas MISA case competition. Not Costco data."),
            new TextRun({ children: [new PositionalTab({ alignment: PositionalTabAlignment.RIGHT, relativeTo: PositionalTabRelativeTo.MARGIN, leader: PositionalTabLeader.NONE })] }),
            small("Page "), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15, color: C.ink_subtle })],
        })] }) },
        children: body,
      },
    ],
  });
}

function writeRegister(problems) {
  const claims = register.claims;
  const byKind = claims.reduce((a, c) => ({ ...a, [c.kind]: (a[c.kind] || 0) + 1 }), {});
  const sources = [...new Set(claims.map((c) => c.source))];
  const report = {
    document: path.relative(ROOT, OUT).replace(/\\/g, "/"),
    built: new Date().toISOString(),
    rule: "Every printed figure is a registered claim with a source key; any other digit must be structural (a date, ID, file name or cross-reference). The build fails otherwise.",
    passed: problems.length === 0,
    counts: { claims: claims.length, ...byKind, distinct_sources: sources.length, unsourced: problems.length },
    unsourced: problems,
    figures: Object.fromEntries(Object.entries(FIGURE_SOURCES).map(([k, v]) => [`outputs/charts/${k}.png`, v])),
    screenshots: SCREENSHOTS.map((s) => `planning/evidence/web_screenshots/${s.file}`),
    claims,
  };
  fs.writeFileSync(REGISTER, `${JSON.stringify(report, null, 1)}\n`);
  return report;
}

async function main() {
  const screens = await prepareScreens();
  const first = build(screens, null);
  const { front, body } = build(screens, first.map);
  const problems = [...K.problems];
  const report = writeRegister(problems);
  if (problems.length) {
    console.error(`Unsourced figures (${problems.length}). Nothing was written except the register:`);
    for (const p of problems) console.error(`  [${p.where}] "${p.token}" in: ${p.text}`);
    process.exit(1);
  }
  const buffer = await Packer.toBuffer(document(front, body));
  try {
    fs.writeFileSync(OUT, buffer);
  } catch (error) {
    console.error(`Could not write ${OUT}. Is it open in Word? ${error.message}`);
    process.exit(1);
  }
  console.log(`Wrote ${OUT} (${buffer.length} bytes). Claims: ${report.counts.claims}, all sourced. Register: ${path.relative(ROOT, REGISTER)}`);
  if (!process.argv.includes("--no-word") && process.platform === "win32") {
    const result = spawnSync("python", [path.join(__dirname, "report", "finish_in_word.py")], { stdio: "inherit", cwd: ROOT });
    if (result.status !== 0) {
      console.error("Word couldn't finish the file (contents and PDF). The .docx is written; rerun, or open it and update the contents.");
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
