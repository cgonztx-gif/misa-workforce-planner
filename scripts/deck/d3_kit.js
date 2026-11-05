// Draft 3 of the deck (planning/DRAFT3.md): the frame and small pieces for a calmer deck.
// One-line titles, so content starts higher; no cards around charts; big numbers with a one-word baseline.
// Built on theme.js and deck_kit.js (D-26) without changing them, so the draft 2 builder is untouched.
const T = require("./theme");
const K = require("./deck_kit");

const { COLORS: C, SLIDE, SIZE, text } = T;
const M = SLIDE.margin;
const W = SLIDE.contentW;
const TITLE_Y = 0.48;
const TITLE_SIZE = 36;
const TOP = 1.55; // content top, under a one-line title
const BOTTOM = 6.55; // content bottom, above the footer
const GAP = 0.4;
const FOOT_Y = 6.86;
const LABEL = 16; // the smallest text a viewer needs on a main slide (chart ticks stay at the 14pt floor)

function defineLayouts(pres) {
  const title = (color, extra = {}) => ({
    placeholder: {
      options: { name: "title", type: "title", x: M, y: TITLE_Y, w: W, h: 0.7, fontFace: T.FONT_SEMIBOLD, fontSize: TITLE_SIZE, color, align: "left", valign: "top", margin: 0, fit: "none", ...extra },
      text: "",
    },
  });
  const footer = (color) => ({ text: { text: K.SIMULATED, options: { x: M, y: FOOT_Y, w: 5, h: 0.24, fontFace: T.FONT, fontSize: SIZE.caption, color, valign: "bottom", margin: 0 } } });
  const number = (color) => ({ x: SLIDE.w - M - 1, y: FOOT_Y, w: 1, h: 0.24, fontFace: T.FONT, fontSize: SIZE.caption, color, align: "right", valign: "bottom", margin: 0 });

  pres.defineSlideMaster({
    title: "D3 Title", background: { color: C.navy },
    objects: [
      title(C.navy_ink, { y: 2.35, w: 7.3, h: 1.05, fontSize: SIZE.hero }),
      { placeholder: { options: { name: "subtitle", type: "body", x: M, y: 3.5, w: 7.3, h: 0.5, fontFace: T.FONT, fontSize: 22, color: C.navy_ink_muted, valign: "top", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({ title: "D3 Dark", background: { color: C.navy }, objects: [title(C.navy_ink), footer(C.navy_ink_muted)], slideNumber: number(C.navy_ink_muted) });
  pres.defineSlideMaster({ title: "D3 Content", background: { color: C.surface }, objects: [title(C.ink), footer(C.ink_subtle)], slideNumber: number(C.ink_subtle) });
  pres.defineSlideMaster({
    title: "D3 Appendix", background: { color: C.surface },
    objects: [
      title(C.ink, { fontSize: 30 }), footer(C.ink_subtle),
      { placeholder: { options: { name: "tag", type: "body", x: SLIDE.w - M - 6, y: FOOT_Y, w: 6, h: 0.24, fontFace: T.FONT, fontSize: SIZE.caption, color: C.ink_subtle, align: "right", valign: "bottom", margin: 0 }, text: "" } },
    ],
  });
}

/** A new slide on a draft 3 layout, its title through the placeholder. */
function slide(pres, { layout = "D3 Content", section, title, tag }) {
  const s = pres.addSlide({ masterName: layout, sectionTitle: section });
  if (title) s.addText(title, { placeholder: "title", align: "left" });
  if (tag) s.addText(tag, { placeholder: "tag", align: "right" });
  return s;
}

// Speaker notes: the words that used to sit on the slides. The spoken part is timed at 140 words a minute.
const WPM = 140;
const TIMING = [];
function notes(s, { id, target, say, extra = [] }) {
  const spoken = say.join(" ");
  const words = spoken.split(/\s+/).filter(Boolean).length;
  TIMING.push({ id, target, words, seconds: Math.round((words / WPM) * 60) });
  s.addNotes([`Target time: ${target}.`, "", ...say, ...(extra.length ? ["", ...extra] : [])].join("\n"));
}

/** A small muted label above a chart or a group: what is measured, in a few words. */
function label(s, str, { x, y, w, h = 0.32, color = C.ink_muted, size = LABEL, bold = false, align = "left" }) {
  s.addText(str, text("label", { x, y, w, h, fontSize: size, color, align, fontFace: bold ? T.FONT_SEMIBOLD : T.FONT, valign: "bottom", wrap: false }));
}

// Chip tones, as theme.js's chip() but with a size: [fill, ink, line].
const TONES = {
  neutral: [C.raised, C.ink_muted, C.border], accent: [C.accent_soft, C.accent_strong, C.accent_line],
  good: [C.good_soft, C.good_ink, null], warning: [C.warning_soft, C.warning_ink, null], risk: [C.risk_soft, C.risk_ink, null],
  navy: [C.navy_raised, C.navy_ink, C.navy_border],
};
const textWidth = (str, size) => (String(str).length * size * 0.56) / 72; // Segoe UI estimate, inches, with slack

/** A chip: optional icon, then a short label. Returns its width. */
function chip(s, { x, y, label: str, tone = "neutral", icon, size = LABEL }) {
  const [fill, ink, line] = TONES[tone];
  const h = (size * 1.9) / 72, iconS = size / 72, pad = 0.13;
  const iconW = icon ? iconS + 0.07 : 0;
  const w = textWidth(str, size) + iconW + 2 * pad;
  s.addShape("roundRect", { x, y, w, h, rectRadius: T.RADIUS.chip, fill: { color: fill }, line: line ? { color: line, width: T.CHART.hairline } : { type: "none" }, objectName: `chip ${str}` });
  if (icon) s.addImage({ data: icon, x: x + pad, y: y + (h - iconS) / 2, w: iconS, h: iconS, altText: `${tone} icon` });
  s.addText(str, text("label", { x: x + pad + iconW, y, w: w - 2 * pad - iconW, h, fontSize: size, color: ink, valign: "middle", wrap: false }));
  return w;
}

/** A delta chip: an arrow and "+27.1 pts vs draft". tone: good | neutral | warning | risk. dir: up | down. */
async function delta(s, { x, y, label: str, tone = "neutral", dir = "up", size = LABEL }) {
  const L = require("react-icons/lu");
  const ink = TONES[tone][1];
  const Icon = dir === "up" ? L.LuArrowUpRight : L.LuArrowDownRight;
  return chip(s, { x, y, label: str, tone, size, icon: await K.icon(Icon, ink) });
}

/** A KPI with no card: muted label, big number, then a delta chip with its one-word baseline. Returns its height. */
async function kpi(s, { x, y, w, label: str, value, size = 48, chip, valueColor = C.ink, labelColor = C.ink_muted }) {
  s.addText(str, text("label", { x, y, w, h: 0.32, fontSize: LABEL, color: labelColor, valign: "bottom" }));
  const vh = (size * 1.2) / 72;
  s.addText(value, text("kpiValue", { x, y: y + 0.36, w, h: vh, fontSize: size, color: valueColor, valign: "middle" }));
  if (chip) await delta(s, { x, y: y + 0.42 + vh, ...chip });
  return 0.42 + vh + (chip ? 0.46 : 0);
}

/** The holiday-window shade behind categories i0..i1 of n: pale neutral gray, since it is context, not data.
 *  Its label sits inside, along the bottom, in muted ink. */
function band(s, fr, n, i0, i1, str) {
  const slot = fr.pw / n, x = fr.px + i0 * slot, w = (i1 - i0 + 1) * slot;
  s.addShape("rect", { x, y: fr.py, w, h: fr.ph, fill: { color: C.draft_soft, transparency: 25 }, line: { type: "none" }, objectName: "band" });
  if (str) s.addText(str, text("label", { x: x + 0.08, y: fr.py + fr.ph - 0.34, w: w - 0.1, h: 0.3, fontSize: 14, color: C.ink_muted, valign: "bottom", wrap: false }));
  return { x, w };
}

/** Nice axis bounds; pass 0 among the values to start at zero. */
function niceAxis(values, ticks = 4) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const raw = (hi - lo) / ticks, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st >= raw);
  return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step };
}

module.exports = { T, K, C, SLIDE, SIZE, text, M, W, TOP, BOTTOM, GAP, LABEL, TITLE_SIZE, WPM, defineLayouts, slide, notes, TIMING, label, chip, delta, kpi, band, niceAxis, textWidth };
