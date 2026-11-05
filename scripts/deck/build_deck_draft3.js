// Builds draft 3 of the presentation (planning/DRAFT3.md): deliverables/Costco_Workforce_Presentation_draft3.pptx.
//
//   node scripts/deck/build_deck_draft3.js          (from the repo root)
//   python planning/evidence/render_deck.py deliverables/Costco_Workforce_Presentation_draft3.pptx planning/evidence/deck_render_draft3
//
// A calmer deck than draft 2 (build_deck.js, kept as the fallback): one-line titles that state the takeaway,
// one visual and at most three numbers per main slide, and the words in the speaker notes. Every figure
// still comes from outputs/ through deck_data.js (D-28), and every color, font and size from design/tokens.json.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const K3 = require("./d3_kit");
const D = require("./deck_data");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "deliverables", "Costco_Workforce_Presentation_draft3.pptx");

const MAIN = [...require("./d3_story").SLIDES, ...require("./d3_plan").SLIDES];
const optional = (m) => (fs.existsSync(path.join(__dirname, `${m}.js`)) ? require(`./${m}`).SLIDES : []);
const APPENDIX = ["d3_appendix", "d3_appendix_b"].flatMap(optional);

/** Remove the zip's folder entries (pptxgenjs and JSZip write them): files with them can fail to open
 *  through a cloud service, as the pptx skill's validate.py warns. */
async function dropFolderEntries(file) {
  const JSZip = require(require.resolve("jszip", { paths: [path.dirname(require.resolve("pptxgenjs"))] }));
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  // Copy the file entries only into a new zip (JSZip's remove() on a folder would take its files too),
  // with createFolders off so JSZip doesn't add the parent folders back.
  const out = new JSZip();
  for (const f of Object.values(zip.files)) if (!f.dir) out.file(f.name, await f.async("nodebuffer"), { createFolders: false });
  fs.writeFileSync(file, await out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const secs = (t) => t.split(":").reduce((m, x) => m * 60 + Number(x), 0);

async function main() {
  const pres = new pptxgen();
  pres.layout = K3.SLIDE.layout;
  pres.theme = K3.T.FONTS;
  pres.title = "Workforce Planner: Costco workforce planning challenge (draft 3)";
  pres.subject = "Texas MISA Fall 2026 Case Competition. Simulated data, not real Costco data.";
  pres.author = D.teamName || "MISA case team";
  pres.company = "Texas MISA Fall 2026 Case Competition";
  K3.defineLayouts(pres);

  pres.addSection({ title: "The case for the plan" });
  for (const [, build] of MAIN) await build(pres);
  if (APPENDIX.length) pres.addSection({ title: "Appendix" });
  for (const [, build] of APPENDIX) await build(pres);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await pres.writeFile({ fileName: OUT });
  await K3.T.applyTheme(OUT);
  await dropFolderEntries(OUT);
  console.log("Wrote", OUT);
  const shot = require("./d3_screenshots").SCREENSHOTS.demo;
  console.log(`Demo slide screenshot: ${shot.which === "draft3" ? "the draft 3 app" : "the draft 2 app (no draft 3 shot yet)"}, ${path.relative(ROOT, shot.file)}`);

  const main = K3.TIMING.filter((t) => !t.id.startsWith("A"));
  const words = main.reduce((a, t) => a + t.words, 0);
  const target = main.reduce((a, t) => a + secs(t.target), 0);
  for (const t of K3.TIMING) console.log(`  slide ${t.id.padEnd(4)} target ${t.target.padStart(8)}  notes ${String(t.words).padStart(4)} words  ~${clock(t.seconds)}`);
  console.log(`Main slides: ${words} spoken words, ~${clock(Math.round((words / 130) * 60))} at 130 wpm, ~${clock(Math.round((words / K3.WPM) * 60))} at ${K3.WPM} wpm, against ${clock(target)} planned (6:00 to 7:00 allowed).`);
  if (!D.teamName) console.warn("Team name is still the placeholder: set TEAM_ID in src/submission.py, rerun the pipeline, then rebuild.");
}

main().catch((e) => { console.error(e); process.exit(1); });
