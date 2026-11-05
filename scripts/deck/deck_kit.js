// Slide frames and small pieces the deck composes, all built on theme.js (D-26).
// Layouts (pptxgenjs calls them masters): WP Title and WP Dark on navy, WP Content and WP Appendix on white.
const T = require("./theme");

const { COLORS: C, SLIDE, SIZE, text, px } = T;
const M = SLIDE.margin;
const W = SLIDE.contentW;
const TOP = 1.75; // content top, under a two-line title
const BOTTOM = 6.6; // content bottom, above the footer
const GAP = 0.3; // between cards
const FOOT_Y = 6.74;
const SIMULATED = "Simulated data, not real Costco data";

function defineLayouts(pres) {
  const title = (color, extra = {}) => ({
    placeholder: {
      options: { name: "title", type: "title", x: M, y: M, w: W, h: 1.1, fontFace: T.FONT_SEMIBOLD, fontSize: SIZE.title, color, align: "left", valign: "top", margin: 0, ...extra },
      text: "",
    },
  });
  const footer = (color) => ({ text: { text: SIMULATED, options: { x: M, y: FOOT_Y, w: 5, h: 0.26, fontFace: T.FONT, fontSize: SIZE.caption, color, valign: "bottom", margin: 0 } } });
  const number = (color) => ({ x: SLIDE.w - M - 1, y: FOOT_Y, w: 1, h: 0.26, fontFace: T.FONT, fontSize: SIZE.caption, color, align: "right", valign: "bottom", margin: 0 });

  pres.defineSlideMaster({
    title: "WP Title", background: { color: C.navy },
    objects: [
      title(C.navy_ink, { y: 2.2, w: 7.3, h: 1.1, fontSize: SIZE.hero }),
      { placeholder: { options: { name: "subtitle", type: "body", x: M, y: 3.45, w: 6.9, h: 1.3, fontFace: T.FONT, fontSize: 20, color: C.navy_ink_muted, valign: "top", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({ title: "WP Dark", background: { color: C.navy }, objects: [title(C.navy_ink), footer(C.navy_ink_muted)], slideNumber: number(C.navy_ink_muted) });
  pres.defineSlideMaster({ title: "WP Content", background: { color: C.surface }, objects: [title(C.ink), footer(C.ink_subtle)], slideNumber: number(C.ink_subtle) });
  pres.defineSlideMaster({
    title: "WP Appendix", background: { color: C.surface },
    objects: [
      title(C.ink), footer(C.ink_subtle),
      { placeholder: { options: { name: "tag", type: "body", x: SLIDE.w - M - 6, y: FOOT_Y, w: 6, h: 0.26, fontFace: T.FONT, fontSize: SIZE.caption, color: C.ink_subtle, align: "right", valign: "bottom", margin: 0 }, text: "" } },
    ],
  });
}

// Speaker notes, with the spoken part kept for the timing estimate (150 words a minute).
const TIMING = [];
function notes(slide, { id, target, say, extra = [] }) {
  const spoken = say.join(" ");
  const words = spoken.split(/\s+/).filter(Boolean).length;
  TIMING.push({ id, target, words, seconds: Math.round((words / 150) * 60) });
  slide.addNotes([`Target time: ${target}.`, "", ...say, ...(extra.length ? ["", ...extra] : [])].join("\n"));
}

/** A new slide on a layout, with its title filled through the placeholder. */
function slide(pres, { layout = "WP Content", section, title, tag }) {
  const s = pres.addSlide({ masterName: layout, sectionTitle: section });
  if (title) s.addText(title, { placeholder: "title", align: "left" });
  if (tag) s.addText(tag, { placeholder: "tag", align: "right" });
  return s;
}

/** A plot area placed by hand (inches inside the chart frame), so shapes can sit behind given categories. */
function frame({ x, y, w, h, l = 0.75, r = 0.1, t = 0.12, b = 0.45 }) {
  const fr = { x, y, w, h, px: x + l, py: y + t, pw: w - l - r, ph: h - t - b };
  fr.layout = { x: l / w, y: t / h, w: fr.pw / w, h: fr.ph / h };
  fr.chart = { x, y, w, h, layout: { ...fr.layout }, chartArea: { fill: { color: null } }, plotArea: { fill: { color: null } } };
  return fr;
}
/** A shaded span behind categories i0..i1 of n (PowerPoint centres each category in an equal slot). */
function band(slide, fr, n, i0, i1, color = T.CHART.band) {
  const slot = fr.pw / n;
  slide.addShape("rect", { x: fr.px + i0 * slot, y: fr.py, w: (i1 - i0 + 1) * slot, h: fr.ph, fill: { color }, line: { type: "none" }, objectName: "band" });
  return { x: fr.px + i0 * slot, w: (i1 - i0 + 1) * slot };
}

/** A numbered marker: filled circle with a white number. */
function marker(s, { x, y, n, d = 0.38, fill = C.accent, color = C.on_accent, ring = C.surface }) {
  s.addShape("ellipse", { x: x - d / 2, y: y - d / 2, w: d, h: d, fill: { color: fill }, line: { color: ring, width: 1.5 }, objectName: `marker ${n}` });
  s.addText(String(n), text("label", { x: x - d / 2, y: y - d / 2, w: d, h: d, align: "center", valign: "middle", color, fontFace: T.FONT_SEMIBOLD }));
}

/** An icon in a soft circle, the app's way of marking a heading. */
function iconDot(s, { x, y, d = 0.56, icon, fill = C.accent_soft, name = "icon" }) {
  s.addShape("ellipse", { x, y, w: d, h: d, fill: { color: fill }, line: { type: "none" }, objectName: `${name} dot` });
  const i = d * 0.5;
  s.addImage({ data: icon, x: x + (d - i) / 2, y: y + (d - i) / 2, w: i, h: i, altText: name });
}

/** A bulleted list; items are strings or { text, bold } runs arrays. */
function bullets(s, items, { x, y, w, h, fontSize = SIZE.body, color = C.ink_muted, space = 8, bulletColor = C.accent }) {
  const runs = items.map((it, i) => ({
    text: it,
    options: { bullet: { indent: 16, color: bulletColor }, breakLine: i < items.length - 1, paraSpaceAfter: space },
  }));
  s.addText(runs, text("body", { x, y, w, h, fontSize, color, paraSpaceAfter: space }));
}

/** A big number with its label under it (no card), for strips and the closing slide. */
function stat(s, { x, y, w, value, label, valueColor = C.ink, labelColor = C.ink_muted, size = SIZE.kpi, labelH = 0.62 }) {
  const vh = (size * 1.25) / 72;
  s.addText(value, text("kpiValue", { x, y, w, h: vh, fontSize: size, color: valueColor }));
  s.addText(label, text("body", { x, y: y + vh + 0.04, w, h: labelH, fontSize: SIZE.label, color: labelColor }));
}

/** A raised callout panel (the app's inset callout). */
function panel(s, { x, y, w, h, fill = C.raised, line = C.border, name = "panel" }) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: T.RADIUS.control, fill: { color: fill }, line: { color: line, width: T.CHART.hairline }, objectName: name });
}

/** A rule between rows. */
const hairline = (s, { x, y, w, color = C.border }) => s.addShape("line", { x, y, w, h: 0, line: { color, width: T.CHART.hairline } });

/** A native table in the app's style: raised header, hairline rules, 14pt text.
 *  cols: [{ w, align }]; head: strings; rows: arrays of strings; cell(r, c) returns extra cell options. */
function table(s, { x, y, cols, head, rows, rowH = 0.36, headH = rowH, fontSize = SIZE.label, margin = [0.04, 0.1, 0.04, 0.1], cell = () => ({}) }) {
  const rule = () => [{ type: "none" }, { type: "none" }, { type: "solid", pt: T.CHART.hairline, color: C.border }, { type: "none" }];
  const mk = (t, c, opts) => ({ text: t, options: { align: cols[c].align || "left", border: rule(), ...opts } });
  const data = [
    head.map((t, c) => mk(t, c, { fill: { color: C.raised }, color: C.ink_muted, fontFace: T.FONT_SEMIBOLD })),
    ...rows.map((r, ri) => r.map((t, c) => mk(t, c, { color: C.ink, fill: { color: C.surface }, ...cell(ri, c) }))),
  ];
  s.addTable(data, {
    x, y, w: cols.reduce((a, c) => a + c.w, 0), colW: cols.map((c) => c.w), rowH: [headH, ...rows.map(() => rowH)],
    fontFace: T.FONT, fontSize, valign: "middle", margin, autoPage: false,
  });
  return y + headH + rows.length * rowH;
}

// Icons: rendered once per (icon, color).
const cache = new Map();
async function icon(Icon, color = C.ink_subtle) {
  const k = `${Icon.name}|${color}`;
  if (!cache.has(k)) cache.set(k, await T.iconPng(Icon, color));
  return cache.get(k);
}

module.exports = { T, C, SLIDE, SIZE, text, px, M, W, TOP, BOTTOM, GAP, SIMULATED, defineLayouts, slide, notes, TIMING, frame, band, marker, iconDot, bullets, stat, panel, hairline, icon, table };
