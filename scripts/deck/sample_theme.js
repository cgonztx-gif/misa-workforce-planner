// The deck half of the shared-look check (T-79, D-26): one slide built only from theme.js.
// Same chart as planning/evidence/look_samples/sample_chart.py (plan vs draft hours by day, BASE),
// drawn as a native PowerPoint chart, beside three KPI tiles with Lucide icons.
//
//   node scripts/deck/sample_theme.js        (from the repo root; writes planning/evidence/look_samples/sample_theme.pptx)
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const { LuClock, LuCircleCheck, LuWallet, LuTrendingUp } = require("react-icons/lu");
const T = require("./theme");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "planning", "evidence", "look_samples", "sample_theme.pptx");
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "outputs", "analysis_summary.json"), "utf8"));

const base = (rows) => rows.find((r) => r.scenario_code === "BASE");
const plan = base(S.plan_summary);
const draft = base(S.draft_summary);
const days = S.plan_by_day.filter((r) => r.scenario_code === "BASE").sort((a, b) => a.day_date.localeCompare(b.day_date));
const dayLabel = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${d.getUTCDate()}`;
};
const int = (n) => Math.round(n).toLocaleString("en-US");
const signed = (n, unit = "") => `${n >= 0 ? "+" : "−"}${unit}${int(Math.abs(n))}`;

async function main() {
  const pres = new pptxgen();
  pres.layout = T.SLIDE.layout;
  pres.theme = T.FONTS;
  pres.title = "Shared look sample";
  const { margin: M, contentW: W } = T.SLIDE;

  const slide = pres.addSlide();
  slide.background = T.BACKGROUND.content;
  slide.addText("The plan adds hours where the draft runs short", T.text("title", { x: M, y: M, w: W, h: 0.55 }));
  slide.addText("BASE scenario, Thu Feb 12 to Wed Feb 18. The plan in iris, the manager's draft in gray.", T.text("subtitle", { x: M, y: 1.1, w: W, h: 0.3 }));

  // KPI column.
  const top = 1.62, bottom = T.SLIDE.h - M, gap = T.SPACE[3]; // 16px between cards
  const tileW = 3.7, tileH = (bottom - top - 2 * gap) / 3;
  const [clock, check, wallet, up] = await Promise.all([
    T.iconPng(LuClock, T.COLORS.ink_subtle), T.iconPng(LuCircleCheck, T.COLORS.ink_subtle),
    T.iconPng(LuWallet, T.COLORS.ink_subtle), T.iconPng(LuTrendingUp, T.COLORS.good_ink),
  ]);
  const tiles = [
    { label: "Hours for the week", icon: clock, value: int(plan.hours), chip: { label: `${signed(plan.hours - draft.hours)} vs draft` } },
    { label: "Expected blocks meeting target", icon: check, value: `${(plan.expected_met * 100).toFixed(1)}%`,
      chip: { label: `+${((plan.expected_met - draft.expected_met) * 100).toFixed(1)} pts vs draft`, tone: "good", icon: up } },
    { label: "Labor cost for the week", icon: wallet, value: `$${int(plan.cost / 1000)}K`, chip: { label: `${signed((plan.cost - draft.cost) / 1000, "$")}K vs draft` } },
  ];
  tiles.forEach((t, i) => T.kpiTile(slide, { x: M, y: top + i * (tileH + gap), w: tileW, h: tileH, ...t }));

  // Chart card.
  const cardX = M + tileW + gap;
  const box = T.card(slide, { x: cardX, y: top, w: T.SLIDE.w - M - cardX, h: bottom - top, title: "Hours by day, BASE", footer: "Simulated data, not real Costco data. Figures from outputs/analysis_summary.json.", name: "chart card" });
  T.legend(slide, { x: box.x, y: box.y, items: [{ name: "Draft", role: "draft", kind: "bar" }, { name: "Plan", role: "plan", kind: "bar" }] });
  T.addBarChart(pres, slide, {
    x: box.x - 0.08, y: box.y + 0.42, w: box.w + 0.08, h: box.h - 0.42,
    labels: days.map((d) => dayLabel(d.day_date)),
    series: [{ name: "Draft", role: "draft", values: days.map((d) => d.hours_draft) }, { name: "Plan", role: "plan", values: days.map((d) => d.hours) }],
    max: 2000, majorUnit: 500,
  });

  slide.addNotes("Sample slide for the shared look (T-79). Every color, font and size comes from design/tokens.json through scripts/deck/theme.js.");

  await pres.writeFile({ fileName: OUT });
  await T.applyTheme(OUT);
  console.log("Wrote", OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
