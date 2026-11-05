// The deck's look, read from design/tokens.json so slides match the app, the report and the notebook (D-26).
//
//   const T = require("./theme");
//   const pres = new pptxgen(); pres.layout = T.SLIDE.layout; pres.theme = T.FONTS;
//   const s = pres.addSlide(); s.background = { color: T.COLORS.surface };
//   s.addText("Title", T.text("title", { x: T.SLIDE.margin, y: 0.45, w: T.SLIDE.contentW, h: 0.7 }));
//   T.kpiTile(s, { x, y, w, h, label: "Weekly hours", value: "11,618" });
//   T.addBarChart(pres, s, { x, y, w, h, labels, series: [{ name: "Draft", role: "draft", values }, ...] });
//   await pres.writeFile({ fileName }); await T.applyTheme(fileName);
//
// Units: slides are inches; text and marks are points. Token sizes are CSS px, and the deck uses
// 1 px = 1 pt for text and marks (a projected slide needs the room; pt = px x 0.75 would put labels
// at 10.5pt), so labels stay at the 14pt floor. Hairlines stay hairlines (0.75pt).
// pptxgenjs mutates option objects, so every helper here builds a fresh object per call.
const fs = require("fs");
const path = require("path");

const TOKENS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "design", "tokens.json"), "utf8"));
const v = (group, name) => TOKENS[group][name].value;
const hex = (c) => String(c).replace("#", "").toUpperCase();

// Colors, no "#" (pptxgenjs corrupts the file otherwise). Every token color by its token name.
const COLORS = Object.fromEntries(Object.entries(TOKENS.color).map(([k, e]) => [k, hex(e.value)]));
const CHART = {
  grid: hex(v("chart", "grid")), axis: hex(v("chart", "axis")), tick: hex(v("chart", "tick")),
  label: hex(v("chart", "label")), band: hex(v("chart", "band")), bandNeutral: hex(v("chart", "band_neutral")),
  lineWidth: v("chart", "line_width"), lineWidthPlan: v("chart", "line_width_plan"), markerSize: v("chart", "marker_size"),
  hairline: v("shape", "border_width") * 0.75, barMaxWidth: v("chart", "bar_max_width"), barGap: v("chart", "bar_gap"),
  benchmarkDash: "dash", // PowerPoint's preset closest to the 6-4 token pattern (4:3 of the line width)
};
const DEPT_ORDER = TOKENS.scale.departments.names;
const DEPT = Object.fromEntries(TOKENS.scale.departments.order.map((k, i) => [DEPT_ORDER[i], COLORS[k]]));
const scale = (s) => ({ ...s, stops: s.stops.map(hex), label_ink: s.label_ink.map(hex) });
const SCALES = { chance: scale(TOKENS.scale.chance), change: scale(TOKENS.scale.change) };

// Series roles: plan in the accent, draft gray, benchmark dashed gray, departments in fixed hues.
const ROLE = {
  plan: COLORS.plan, draft: COLORS.draft, draft_soft: COLORS.draft_soft, benchmark: COLORS.benchmark,
  front_end: DEPT["Front End"], merchandising: DEPT.Merchandising, pharmacy: DEPT.Pharmacy,
  good: COLORS.good, warning: COLORS.warning, risk: COLORS.risk,
};
const roleColor = (role) => ROLE[role] || hex(role);

// Type. Office uses one family name; Semibold is its own family name in Office on Windows.
const FONT = v("type", "family_office");
const FONT_SEMIBOLD = `${FONT} Semibold`;
const FONTS = { headFontFace: FONT, bodyFontFace: FONT };
const SIZE = {
  caption: 12, // footers and sources only; everything a viewer must read is 14pt or more
  label: v("type", "size_label"), // 14: KPI labels, chips, chart ticks, legends, data labels
  body: v("type", "size_body_lg"), // 16
  lead: v("type", "size_lead"), // 18: the answer sentence under a title
  cardTitle: v("type", "size_title_sm") + 1, // 18
  section: v("type", "size_title") + 4, // 24
  title: Math.round(v("type", "size_page") * 1.15), // 32
  kpi: v("type", "size_kpi") + 2, // 32, the slide-title size
  hero: v("type", "size_hero") + 16, // 60
};
const STYLE = {
  title: { fontFace: FONT_SEMIBOLD, fontSize: SIZE.title, color: COLORS.ink, valign: "top" },
  subtitle: { fontFace: FONT, fontSize: SIZE.lead, color: COLORS.ink_muted, valign: "top" },
  section: { fontFace: FONT_SEMIBOLD, fontSize: SIZE.section, color: COLORS.ink, valign: "top" },
  body: { fontFace: FONT, fontSize: SIZE.body, color: COLORS.ink_muted, valign: "top", paraSpaceAfter: 6 },
  label: { fontFace: FONT, fontSize: SIZE.label, color: COLORS.ink_subtle, valign: "top" },
  caption: { fontFace: FONT, fontSize: SIZE.caption, color: COLORS.ink_subtle, valign: "bottom" },
  cardTitle: { fontFace: FONT_SEMIBOLD, fontSize: SIZE.cardTitle, color: COLORS.ink, valign: "top" },
  kpiValue: { fontFace: FONT_SEMIBOLD, fontSize: SIZE.kpi, color: COLORS.ink, valign: "top" },
  kpiLabel: { fontFace: FONT, fontSize: SIZE.label, color: COLORS.ink_subtle, valign: "top" },
  hero: { fontFace: FONT, fontSize: SIZE.hero, color: COLORS.ink, bold: true, valign: "top" },
  navyTitle: { fontFace: FONT_SEMIBOLD, fontSize: SIZE.hero, color: COLORS.navy_ink, valign: "top" },
  navyBody: { fontFace: FONT, fontSize: SIZE.lead, color: COLORS.navy_ink_muted, valign: "top" },
};
/** A fresh addText options object: text("title", { x, y, w, h }). Text boxes get margin 0 and isTextBox. */
const text = (name, extra = {}) => ({ ...STYLE[name], margin: 0, isTextBox: true, ...extra });

// Slide frame: 16:9 wide. Content slides are white; title, demo and closing slides are navy.
const px = (n) => n / 72; // token px (= deck pt) to inches
const SLIDE = { layout: "LAYOUT_WIDE", w: 13.333, h: 7.5, margin: 0.5, gutter: px(20), pad: px(20), padSm: px(16) };
SLIDE.contentW = SLIDE.w - 2 * SLIDE.margin;
SLIDE.contentH = SLIDE.h - 2 * SLIDE.margin;
const SPACE = v("shape", "space").map(px); // token spacing steps, in inches
const RADIUS = { chip: px(v("shape", "radius_chip")), control: px(v("shape", "radius_control")), card: px(v("shape", "radius_card")) };
const BACKGROUND = { content: { color: COLORS.surface }, navy: { color: COLORS.navy } };

// Theme colors for PowerPoint's pickers and any scheme color. Write them with applyTheme() after writeFile().
const THEME = {
  name: TOKENS.meta.name,
  ...FONTS,
  colors: {
    dk1: COLORS.ink, lt1: COLORS.surface, dk2: COLORS.navy, lt2: COLORS.canvas,
    accent1: COLORS.accent, accent2: COLORS.draft, accent3: DEPT["Front End"], accent4: DEPT.Merchandising,
    accent5: DEPT.Pharmacy, accent6: COLORS.good, hlink: COLORS.accent, folHlink: COLORS.accent_strong,
  },
};

/** Write THEME's colors and name into a deck pptxgenjs wrote (it hard-codes Office's palette). */
async function applyTheme(deckPath, theme = THEME) {
  const JSZip = require(require.resolve("jszip", { paths: [path.dirname(require.resolve("pptxgenjs"))] }));
  const zip = await JSZip.loadAsync(fs.readFileSync(deckPath));
  const part = "ppt/theme/theme1.xml";
  const slots = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
  const name = theme.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const scheme = `<a:clrScheme name="${name}">` + slots.map((k) => `<a:${k}><a:srgbClr val="${theme.colors[k]}"/></a:${k}>`).join("") + "</a:clrScheme>";
  const xml = (await zip.file(part).async("string"))
    .replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, () => scheme)
    .replace(/(<a:(?:theme|fontScheme)\b[^>]*?\bname=")[^"]*"/g, (_, head) => `${head}${name}"`);
  zip.file(part, xml);
  fs.writeFileSync(deckPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

/** A Lucide (or any react-icons) icon as PNG data for addImage({ data }). Color without "#". */
async function iconPng(Icon, color = COLORS.ink_subtle, size = 256) {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const sharp = require("sharp");
  const svg = renderToStaticMarkup(React.createElement(Icon, { color: `#${hex(color)}`, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

// Shapes that match the app: white card, 1px border, 12px radius, 20px padding. -------------------
const cardShadow = () => ({ type: "outer", color: COLORS.ink, opacity: 0.06, blur: 3, offset: 1, angle: 90 });
const TONES = {
  neutral: [COLORS.raised, COLORS.ink_muted, COLORS.border], accent: [COLORS.accent_soft, COLORS.accent_strong, COLORS.accent_line],
  good: [COLORS.good_soft, COLORS.good_ink, null], warning: [COLORS.warning_soft, COLORS.warning_ink, null],
  risk: [COLORS.risk_soft, COLORS.risk_ink, null],
};
const textWidth = (s, size) => (String(s).length * size * 0.56) / 72; // Segoe UI estimate, inches, with slack

/** A card; returns the content box inside its padding, below the title and description and above the footer. */
function card(slide, { x, y, w, h, title, description, footer, pad = SLIDE.pad, fill = COLORS.surface, name = "card" }) {
  slide.addShape("roundRect", { x, y, w, h, rectRadius: RADIUS.card, fill: { color: fill }, line: { color: COLORS.border, width: CHART.hairline }, shadow: cardShadow(), objectName: name });
  let top = y + pad;
  let end = y + h - pad;
  if (title) { slide.addText(title, text("cardTitle", { x: x + pad, y: top, w: w - 2 * pad, h: 0.32 })); top += 0.34; }
  if (description) { slide.addText(description, text("label", { x: x + pad, y: top, w: w - 2 * pad, h: 0.26 })); top += 0.28; }
  if (title || description) top += px(12);
  if (footer) { end -= 0.26; slide.addText(footer, text("label", { x: x + pad, y: end, w: w - 2 * pad, h: 0.26, valign: "bottom" })); end -= px(8); }
  return { x: x + pad, y: top, w: w - 2 * pad, h: end - top };
}

/** A status or tag chip like the app's Badge. tone: neutral | accent | good | warning | risk. Returns its width. */
function chip(slide, { x, y, label, tone = "neutral", icon }) {
  const [fill, ink, line] = TONES[tone];
  const iconW = icon ? 0.2 : 0;
  const w = textWidth(label, SIZE.label) + iconW + 2 * px(9), h = 0.32;
  slide.addShape("roundRect", { x, y, w, h, rectRadius: RADIUS.chip, fill: { color: fill }, line: line ? { color: line, width: CHART.hairline } : { type: "none" } });
  if (icon) slide.addImage({ data: icon, x: x + px(9), y: y + (h - 0.16) / 2, w: 0.16, h: 0.16, altText: `${tone} icon` });
  slide.addText(label, text("label", { x: x + px(9) + iconW, y, w: w - 2 * px(9) - iconW, h, color: ink, valign: "middle", wrap: false }));
  return w;
}

/** A KPI tile (the app's small card padding): label and icon on top, the value, then a chip or a note under it.
 *  Needs h >= KPI_MIN_H inches. icon is iconPng() data. chip: { label, tone, icon }. */
const KPI_MIN_H = 2 * SLIDE.padSm + 0.86 + 0.32;
function kpiTile(slide, { x, y, w, h, label, value, note, chip: chipOpts, icon }) {
  const box = card(slide, { x, y, w, h, pad: SLIDE.padSm, name: `kpi ${label}` });
  slide.addText(label, text("kpiLabel", { x: box.x, y: box.y, w: box.w - (icon ? 0.4 : 0), h: 0.26 }));
  if (icon) slide.addImage({ data: icon, x: box.x + box.w - 0.26, y: box.y, w: 0.26, h: 0.26, altText: `${label} icon` });
  slide.addText(value, text("kpiValue", { x: box.x, y: box.y + 0.29, w: box.w, h: 0.52 }));
  const bottom = box.y + 0.86; // a fixed step under the value; extra height stays below, as in the app
  if (chipOpts) chip(slide, { x: box.x, y: bottom, ...chipOpts });
  else if (note) slide.addText(note, text("label", { x: box.x, y: bottom, w: box.w, h: 0.32, color: COLORS.ink_muted, valign: "middle" }));
}

/** A legend row like the app's: swatch or line key, then the name. items: [{ name, role, kind: "bar"|"line"|"dash" }]. */
function legend(slide, { x, y, items }) {
  let at = x;
  for (const it of items) {
    const color = roleColor(it.role);
    if (it.kind === "bar") slide.addShape("roundRect", { x: at, y: y + 0.07, w: 0.16, h: 0.16, rectRadius: px(3), fill: { color }, line: { type: "none" } });
    else slide.addShape("line", { x: at, y: y + 0.15, w: 0.3, h: 0, line: { color, width: it.role === "plan" ? CHART.lineWidthPlan : CHART.lineWidth, dashType: it.kind === "dash" ? CHART.benchmarkDash : "solid" } });
    const keyW = it.kind === "bar" ? 0.16 : 0.3;
    const w = textWidth(it.name, SIZE.label);
    slide.addText(it.name, text("label", { x: at + keyW + 0.08, y, w, h: 0.3, color: COLORS.ink_muted, valign: "middle", wrap: false }));
    at += keyW + 0.08 + w + 0.3;
  }
  return at - x;
}

// Native, editable charts. -------------------------------------------------------------------------
/** Options every chart shares: token axis, grid and label colors and sizes; no chart legend (use legend()). */
function chartBase({ x, y, w, h, format = "#,##0", axisFormat = format, ...rest } = {}) {
  return {
    x, y, w, h, showLegend: false, showTitle: false,
    chartArea: { fill: { color: COLORS.surface } }, plotArea: { fill: { color: COLORS.surface } },
    catAxisLabelColor: CHART.tick, catAxisLabelFontFace: FONT, catAxisLabelFontSize: SIZE.label,
    valAxisLabelColor: CHART.tick, valAxisLabelFontFace: FONT, valAxisLabelFontSize: SIZE.label, valAxisLabelFormatCode: axisFormat,
    catAxisLineShow: true, catAxisLineColor: CHART.axis, catAxisLineSize: CHART.hairline, valAxisLineShow: false,
    catAxisMajorTickMark: "none", valAxisMajorTickMark: "none",
    valGridLine: { color: CHART.grid, size: CHART.hairline, style: "solid" }, catGridLine: { style: "none" },
    dataLabelColor: CHART.label, dataLabelFontFace: FONT, dataLabelFontSize: SIZE.label, dataLabelFormatCode: format,
    legendFontFace: FONT, legendFontSize: SIZE.label, legendColor: COLORS.ink_muted,
    ...rest,
  };
}

/** Bar or column options. The value axis always starts at 0 (F-60); bars are capped near 24pt thick with a 2pt gap.
 *  PowerPoint draws horizontal bars bottom-up; addBarChart() reverses the data so they read top-down. */
function barChartOpts({ roles, categories, horizontal = false, showValue = false, max, majorUnit, ...rest }) {
  const plotPt = ((horizontal ? rest.h - 0.45 : rest.w - 0.85) * 72) / categories;
  const k = roles.length;
  const bar = Math.min(CHART.barMaxWidth, (plotPt * 0.72) / k);
  return chartBase({
    barDir: horizontal ? "bar" : "col", barGrouping: "clustered", chartColors: roles.map(roleColor),
    barGapWidthPct: Math.max(20, Math.min(500, Math.round(((plotPt - k * bar) / bar) * 100))),
    barOverlapPct: k > 1 ? -Math.round((CHART.barGap / bar) * 100) : 0,
    valAxisMinVal: 0, valAxisMaxVal: max, valAxisMajorUnit: majorUnit,
    showValue, dataLabelPosition: "outEnd",
    ...rest,
  });
}

/** Line options for one set of series that share a style: 2pt lines (2.5 for the plan), 8pt markers with a 2px white ring. */
function lineChartOpts({ roles, plan = false, dashed = false, markers = true, min, max, majorUnit, ...rest }) {
  return chartBase({
    chartColors: roles.map(roleColor), lineSize: plan ? CHART.lineWidthPlan : CHART.lineWidth,
    lineDash: dashed ? CHART.benchmarkDash : "solid", lineDataSymbol: markers ? "circle" : "none",
    lineDataSymbolSize: CHART.markerSize, lineDataSymbolLineColor: COLORS.surface, lineDataSymbolLineSize: 1.5,
    valAxisMinVal: min, valAxisMaxVal: max, valAxisMajorUnit: majorUnit,
    ...rest,
  });
}

/** Add a bar or column chart. series: [{ name, values, role }], all on the same labels. */
function addBarChart(pres, slide, { labels, series, ...opts }) {
  // Horizontal: PowerPoint puts the first category and first series at the bottom, so feed both reversed
  // (reversing the axis instead moves the value axis to the top).
  const flip = (a) => (opts.horizontal ? [...a].reverse() : a);
  const ordered = flip(series);
  const data = ordered.map((s) => ({ name: s.name, labels: flip(labels), values: flip(s.values) }));
  slide.addChart(pres.charts.BAR, data, barChartOpts({ roles: ordered.map((s) => s.role), categories: labels.length, ...opts }));
}

/** Add a line chart where the plan is thicker and the benchmark dashed: one chart, one line type per style.
 *  series: [{ name, values, role }]. Per-type options carry only color, width, dash and marker shape: pptxgenjs
 *  converts lineDataSymbolLineSize to EMU on the top-level options only, so a per-type copy is written raw
 *  (w="1.5") and PowerPoint calls the file corrupt, while the pptx skill's validate.py passes it. */
function addLineChart(pres, slide, { labels, series, markers = true, ...opts }) {
  const groups = [["plan", { plan: true }], ["benchmark", { dashed: true, markers: false }], ["other", {}]];
  const pick = (g) => series.filter((s) => (g === "other" ? !["plan", "benchmark"].includes(s.role) : s.role === g));
  const types = groups.filter(([g]) => pick(g).length).reverse().map(([g, style]) => {
    const own = lineChartOpts({ roles: pick(g).map((s) => s.role), markers, ...style });
    const options = { chartColors: own.chartColors, lineSize: own.lineSize, lineDash: own.lineDash, lineDataSymbol: own.lineDataSymbol };
    return { type: pres.charts.LINE, data: pick(g).map((s) => ({ name: s.name, labels, values: s.values })), options };
  });
  slide.addChart(types, lineChartOpts({ roles: [], markers, ...opts }));
}

module.exports = {
  TOKENS, COLORS, CHART, DEPT, DEPT_ORDER, SCALES, ROLE, roleColor, hex,
  FONT, FONT_SEMIBOLD, FONTS, SIZE, STYLE, text, SLIDE, SPACE, RADIUS, BACKGROUND, px, THEME, applyTheme, iconPng,
  card, chip, kpiTile, KPI_MIN_H, legend, chartBase, barChartOpts, lineChartOpts, addBarChart, addLineChart,
};
