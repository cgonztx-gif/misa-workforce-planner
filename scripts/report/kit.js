// Building blocks for the report: text with **bold** and registered claims, headings, tables, figures, notes.
// Colors and the font come from design/tokens.json (D-26). Every piece of text goes through rich(), which strips
// claim markers and records any digit that isn't a registered claim or a structural number (claims.js).
const fs = require("fs");
const path = require("path");
const {
  AlignmentType, BorderStyle, HeadingLevel, ImageRun, Paragraph, ShadingType, Table, TableCell, TableLayoutType,
  TableRow, TextRun, VerticalAlign, WidthType, PageBreak,
} = require("docx");
const { register, residualDigits, strip, CLAIM_RE } = require("./claims");

const ROOT = path.resolve(__dirname, "..", "..");
const TOKENS = JSON.parse(fs.readFileSync(path.join(ROOT, "design", "tokens.json"), "utf8"));
const C = Object.fromEntries(Object.entries(TOKENS.color).map(([k, v]) => [k, v.value.replace("#", "").toUpperCase()]));
const FONT = TOKENS.type.family_office.value; // Segoe UI
const FONT_SEMI = `${FONT} Semibold`;
const WIDTH = 9360; // 6.5 inches of text width, in DXA
const IMAGE_PX = 624; // the same 6.5 inches in docx-js image pixels (96 per inch)

const problems = [];
const labels = { figure: 0, table: 0, map: {} };
let previousMap = {};
let listInstance = 0;

function reset(map) {
  problems.length = 0;
  labels.figure = 0;
  labels.table = 0;
  labels.map = {};
  previousMap = map || {};
  listInstance = 0;
}

function check(text) {
  for (const token of residualDigits(text)) problems.push({ where: register.where, token, text: strip(text).slice(0, 160) });
}

const run = (text, opts = {}) => new TextRun({ text, font: opts.bold ? FONT_SEMI : FONT, color: C.ink, ...opts, bold: false });

// "**bold**" spans and claim markers in one string. Bold is drawn with Segoe UI Semibold, not synthetic bold.
function rich(text, base = {}) {
  check(text);
  // IDs such as A-01 or F-44 get a non-breaking hyphen, so a line never ends on "A-".
  const clean = strip(String(text)).replace(/\b([A-Z]{1,2})-(\d)/g, "$1\u2011$2").replace(/(\d)-(\d)/g, "$1\u2011$2");
  return clean.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) =>
    part.startsWith("**") ? run(part.slice(2, -2), { ...base, bold: true }) : run(part, base));
}

const P = (text, opts = {}) => new Paragraph({ children: rich(text, opts.run), spacing: { after: 140, line: 288 }, ...opts.para });
const LEAD = (text) => P(text, { run: { size: 23, color: C.ink_muted }, para: { spacing: { after: 200, line: 300 } } });
const SMALL = (text) => P(text, { run: { size: 17, color: C.ink_muted }, para: { spacing: { after: 100, line: 264 } } });

function H1(number, title, opts = {}) {
  register.where = `${number ? `${number} ` : ""}${title}`;
  check(title);
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: opts.pageBreak !== false,
    ...(opts.pageBreak === false ? { spacing: { before: 520, after: 280 } } : {}),
    children: [
      ...(number ? [new TextRun({ text: `${number} `, font: FONT_SEMI, color: C.accent })] : []),
      new TextRun({ text: title, font: FONT_SEMI }),
    ],
  });
}
function H2(title) {
  register.where = `${register.where.split(" > ")[0]} > ${strip(title)}`;
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: rich(title, { font: FONT_SEMI }) });
}
const H3 = (title) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: rich(title, { font: FONT_SEMI }) });

const BUL = (text) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: rich(text), spacing: { after: 90, line: 288 } });
function NUMS(items) {
  listInstance += 1;
  return items.map((text) => new Paragraph({ numbering: { reference: "steps", level: 0, instance: listInstance }, children: rich(text), spacing: { after: 90, line: 288 } }));
}

// Cross-references: the first pass numbers figures and tables, the second pass prints them.
function ref(label) {
  const n = previousMap[label] || labels.map[label];
  return n ? n : (label.startsWith("fig:") ? "Figure ?" : "Table ?");
}
function nextLabel(kind, label) {
  labels[kind] += 1;
  const text = `${kind === "figure" ? "Figure" : "Table"} ${labels[kind]}`;
  if (label) labels.map[label] = text;
  return text;
}

function CAPTION(kind, label, text) {
  const name = nextLabel(kind, label);
  return new Paragraph({
    keepNext: kind === "table",
    keepLines: true,
    spacing: kind === "table" ? { before: 200, after: 80, line: 264 } : { before: 60, after: 240, line: 264 },
    children: [run(`${name}. `, { size: 17, color: C.ink, bold: true }), ...rich(text, { size: 17, color: C.ink_muted })],
  });
}

const thin = (color = C.border) => ({ style: BorderStyle.SINGLE, size: 4, color });
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

// headers: strings. rows: arrays of strings. widths: DXA summing to WIDTH. opts.align: "l"/"r" per column.
function TABLE(label, caption, headers, rows, widths, opts = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  if (total !== WIDTH) throw new Error(`Table "${caption.slice(0, 40)}" widths sum to ${total}`);
  const align = (i) => ((opts.align ? opts.align[i] : i === 0 ? "l" : "r") === "r" ? AlignmentType.RIGHT : AlignmentType.LEFT);
  const size = opts.size || 17;
  const cell = (text, i, kind) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 55, bottom: 55, left: 90, right: 90 },
    shading: kind === "head" ? { type: ShadingType.CLEAR, fill: C.canvas, color: "auto" }
      : kind === "total" ? { type: ShadingType.CLEAR, fill: C.raised, color: "auto" } : undefined,
    borders: { top: none, left: none, right: none, bottom: kind === "head" ? thin(C.border_strong) : thin() },
    children: [new Paragraph({ alignment: align(i), spacing: { after: 0, line: 252 },
      children: rich(String(text), kind === "head" ? { size: size - 1, color: C.ink_muted, bold: true } : { size }) })],
  });
  const totals = new Set(opts.totalRows || []);
  const table = new Table({
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, i, "head")) }),
      ...rows.map((r, j) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, totals.has(j) ? "total" : "body")) })),
    ],
  });
  return [...(caption ? [CAPTION("table", label, caption)] : []), table, new Paragraph({ children: [], spacing: { after: 160 } })];
}

// A shaded callout with a colored left rule. lines: strings.
function NOTE(title, lines, tone = "accent") {
  const fill = tone === "warning" ? C.warning_soft : C.accent_soft;
  const rule = tone === "warning" ? C.warning : C.accent;
  return [new Table({
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: [WIDTH],
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: WIDTH, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill, color: "auto" },
      margins: { top: 140, bottom: 100, left: 200, right: 200 },
      borders: { top: none, bottom: none, right: none, left: { style: BorderStyle.SINGLE, size: 24, color: rule } },
      children: [
        ...(title ? [new Paragraph({ spacing: { after: 80 }, children: rich(title, { bold: true, size: 20 }) })] : []),
        ...lines.map((text) => new Paragraph({ spacing: { after: 80, line: 276 }, children: rich(text, { size: 19 }) })),
      ],
    })] })],
  }), new Paragraph({ children: [], spacing: { after: 160 } })];
}

// A row of headline numbers: [{ value, label, sub }].
function TILES(items) {
  const w = Math.floor(WIDTH / items.length);
  const widths = items.map((_, i) => (i === items.length - 1 ? WIDTH - w * (items.length - 1) : w));
  return [new Table({
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ cantSplit: true, children: items.map((item, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: C.raised, color: "auto" },
      margins: { top: 120, bottom: 120, left: 160, right: 120 },
      borders: { top: none, bottom: none, right: { style: BorderStyle.SINGLE, size: 18, color: "FFFFFF" },
        left: i === 0 ? none : { style: BorderStyle.SINGLE, size: 18, color: "FFFFFF" } },
      children: [
        new Paragraph({ spacing: { after: 40 }, children: rich(item.label, { size: 16, color: C.ink_muted }) }),
        new Paragraph({ spacing: { after: 40 }, children: rich(item.value, { size: 34, bold: true, color: item.accent ? C.accent : C.ink }) }),
        new Paragraph({ spacing: { after: 0, line: 252 }, children: rich(item.sub, { size: 16, color: C.ink_muted }) }),
      ],
    })) })],
  }), new Paragraph({ children: [], spacing: { after: 200 } })];
}

function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// A chart from outputs/charts at its printed size (200 dpi), capped at the text width.
function FIG(name, label, caption, alt, opts = {}) {
  const data = fs.readFileSync(path.join(ROOT, "outputs", "charts", `${name}.png`));
  const size = pngSize(data);
  const width = opts.fill ? IMAGE_PX : Math.min(opts.width || IMAGE_PX, Math.round((size.width / 200) * 96));
  return IMAGE(data, size, width, label, caption, alt || name);
}

function IMAGE(data, size, width, label, caption, alt) {
  check(alt); // alt text is part of the file, so it may not carry typed figures either
  return [
    new Paragraph({
      keepNext: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
      children: [new ImageRun({ type: "png", data, transformation: { width, height: Math.round((width * size.height) / size.width) },
        altText: { title: label, description: alt, name: label } })],
    }),
    CAPTION("figure", label, caption),
  ];
}

// Commands to type, in a shaded box with a monospace font. Comment lines start with "#" and print muted.
function CODE(lines) {
  return [new Table({
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: [WIDTH],
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: WIDTH, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: C.raised, color: "auto" },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      borders: { top: thin(), bottom: thin(), left: thin(), right: thin() },
      children: lines.map((line) => {
        check(line);
        return new Paragraph({ spacing: { after: 20, line: 252 },
          children: [new TextRun({ text: strip(line), font: "Consolas", size: 17, color: line.startsWith("#") ? C.ink_subtle : C.ink })] });
      }),
    })] })],
  }), new Paragraph({ children: [], spacing: { after: 160 } })];
}

const SPACER = (after = 120) => new Paragraph({ children: [], spacing: { after } });
const BREAK = () => new Paragraph({ children: [new PageBreak()] });

module.exports = {
  ROOT, C, FONT, FONT_SEMI, WIDTH, IMAGE_PX, problems, labels, reset, rich, run, P, LEAD, SMALL, H1, H2, H3, BUL, NUMS, ref,
  CAPTION, TABLE, NOTE, TILES, FIG, IMAGE, CODE, pngSize, SPACER, BREAK, CLAIM_RE,
};
