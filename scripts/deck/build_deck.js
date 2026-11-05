// Builds the presentation (T-93): deliverables/Costco_Workforce_Presentation.pptx.
//
//   node scripts/deck/build_deck.js          (from the repo root)
//
// Every figure comes from outputs/ (frozen at 981069f, D-28) through deck_data.js, and every color, font and
// size from design/tokens.json through theme.js (D-26). Slides: 10 main slides, then the appendix A1-A11.
// Render and check with: python planning/evidence/render_deck.py
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const K = require("./deck_kit");
const D = require("./deck_data");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "deliverables", "Costco_Workforce_Presentation.pptx");

const MAIN = [
  ["title", require("./slides_story").title],
  ["challenge", require("./slides_story").challenge],
  ["diagnosis", require("./slides_story2").diagnosis],
  ["forecast", require("./slides_story2").forecast],
  ["engine", require("./slides_story2").engine],
  ["plan", require("./slides_plan").planSlide],
  ["scenarios", require("./slides_plan").scenariosSlide],
  ...require("./slides_action").SLIDES,
];
const optional = (m) => (fs.existsSync(path.join(__dirname, `${m}.js`)) ? require(`./${m}`).SLIDES : []);
const APPENDIX = ["slides_appendix", "slides_appendix_b", "slides_appendix2", "slides_appendix3"].flatMap(optional);

const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

async function main() {
  const pres = new pptxgen();
  pres.layout = K.SLIDE.layout;
  pres.theme = K.T.FONTS;
  pres.title = "Workforce Planner: Costco workforce planning challenge";
  pres.subject = "Texas MISA Fall 2026 Case Competition. Simulated data, not real Costco data.";
  pres.author = D.teamName || "MISA case team";
  pres.company = "Texas MISA Fall 2026 Case Competition";
  K.defineLayouts(pres);

  pres.addSection({ title: "The case for the plan" });
  for (const [, build] of MAIN) await build(pres);
  pres.addSection({ title: "Appendix" });
  for (const [, build] of APPENDIX) await build(pres);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await pres.writeFile({ fileName: OUT });
  await K.T.applyTheme(OUT);
  console.log("Wrote", OUT);

  // Speaking time from the notes, at 150 words a minute.
  const main = K.TIMING.filter((t) => !t.id.startsWith("A"));
  const total = main.reduce((a, t) => a + t.seconds, 0);
  const target = main.reduce((a, t) => a + t.target.split(":").reduce((m, s) => m * 60 + Number(s), 0), 0);
  for (const t of K.TIMING) console.log(`  slide ${t.id.padEnd(9)} target ${t.target.padStart(5)}  notes ${String(t.words).padStart(4)} words  ~${clock(t.seconds)}`);
  console.log(`Main slides: ~${clock(total)} spoken against ${clock(target)} planned (6:00 to 7:00 allowed).`);
  if (!D.teamName) console.warn("Team name is still the placeholder: set TEAM_ID in src/submission.py, rerun the pipeline, then rebuild.");
}

main().catch((e) => { console.error(e); process.exit(1); });
