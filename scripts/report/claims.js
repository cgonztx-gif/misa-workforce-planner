// The claims register (V-10). Every figure the report prints goes through a formatter here, which needs a
// sourced value, so a typed number can't slip in: the text check in kit.js fails the build on any digit that
// isn't inside a registered claim or a structural pattern (dates, IDs, file names, figure numbers).
//
//   const n = S("plan_summary[scenario_code=BASE].cost")   // a value with its source key
//   money(n)                                              // "$377,504", recorded with that key
//   fx("5 minutes", "Case PDF p7")                        // a fixed case fact, recorded with its citation
//   derive("plan cost / draft cost - 1", a.v / b.v - 1, a, b)
const OPEN = "";
const MID = "";
const CLOSE = "";
const CLAIM_RE = /(\d+)([^]*)/g;

const register = { claims: [], where: "Front matter" };

class Num {
  constructor(v, src) {
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`Not a finite number from ${src}: ${v}`);
    if (!src) throw new Error(`A value without a source: ${v}`);
    this.v = v;
    this.src = src;
  }
}

// Paths: "kpi.r2_dow", "plan_summary[scenario_code=BASE].cost", "callout_rates[dept_id=95,context=weekday].rate".
function resolve(root, path) {
  let node = root;
  for (const part of path.match(/[^.[\]]+(\[[^\]]+\])?/g)) {
    const m = part.match(/^([^[]+)(?:\[([^\]]+)\])?$/);
    node = node[m[1]];
    if (node === undefined) throw new Error(`No ${m[1]} in path ${path}`);
    if (m[2] && /^\d+$/.test(m[2])) {
      node = node[Number(m[2])];
      if (node === undefined) throw new Error(`No row ${m[2]} in ${path}`);
    } else if (m[2]) {
      const tests = m[2].split(",").map((t) => t.split("="));
      const found = node.filter((row) => tests.every(([k, v]) => String(row[k]) === v));
      if (found.length !== 1) throw new Error(`${found.length} rows match ${part} in ${path}`);
      node = found[0];
    }
  }
  return node;
}

function source(root, prefix) {
  return (path) => new Num(Number(resolve(root, path)), `${prefix}:${path}`);
}

function derive(label, value, ...inputs) {
  if (!inputs.length || inputs.some((n) => !(n instanceof Num))) throw new Error(`derive(${label}) needs sourced inputs`);
  return new Num(value, `derived (${label}) from ${inputs.map((n) => n.src).join(" ; ")}`);
}

function record(text, kind, value, src) {
  const id = register.claims.length;
  register.claims.push({ id, text, kind, value, source: src, where: register.where });
  return `${OPEN}${id}${MID}${text}${CLOSE}`;
}

function need(n, name) {
  if (!(n instanceof Num)) throw new Error(`${name}() needs a sourced value, got ${JSON.stringify(n)}`);
  return n;
}

// Python's percent formatting rounds the exact decimal of the stored value; JS's x * 100 can land just under a
// half (0.0415 * 100 = 4.1499...), so clean the product first to match the app and the notebook.
const scaled = (x, k) => Number((x * k).toPrecision(12));
const group = (x, d) => Number(x).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const minus = (s) => s.replace(/^-/, "−");

const fmt = {
  pct: (n, d = 1) => record(`${scaled(need(n, "pct").v, 100).toFixed(d)}%`, "data", n.v, n.src),
  signedPct: (n, d = 1) => {
    const t = scaled(need(n, "signedPct").v, 100).toFixed(d);
    return record(`${n.v >= 0 ? "+" : "−"}${t.replace("-", "")}%`, "data", n.v, n.src);
  },
  pts: (n, d = 1) => record(`${scaled(need(n, "pts").v, 100).toFixed(d)} points`, "data", n.v, n.src),
  money: (n) => record(minus(`$${group(Math.round(need(n, "money").v), 0)}`).replace("$−", "−$"), "data", n.v, n.src),
  moneyK: (n, d = 0) => record(`$${group(need(n, "moneyK").v / 1000, d)}K`, "data", n.v, n.src),
  int: (n) => record(minus(group(Math.round(need(n, "int").v), 0)), "data", n.v, n.src),
  abs: (n) => record(group(Math.abs(Math.round(need(n, "abs").v)), 0), "data", n.v, n.src),
  dec: (n, d = 1) => record(minus(group(need(n, "dec").v, d)), "data", n.v, n.src),
  times: (n, d = 2) => record(`x${need(n, "times").v.toFixed(d)}`, "data", n.v, n.src),
  effect: (n, d = 0) => {
    // A factor as a change against normal: 1.12 -> "+12%".
    const t = scaled(need(n, "effect").v - 1, 100);
    return record(`${t >= 0 ? "+" : "−"}${Math.abs(t).toFixed(d)}%`, "data", n.v, n.src);
  },
  // Engine text from analysis_summary.json (playbook and explanations), quoted whole with its key.
  quote: (root, path, prefix = "analysis_summary.json") => {
    const text = resolve(root, path);
    if (typeof text !== "string") throw new Error(`${path} isn't text`);
    return record(text, "engine text", null, `${prefix}:${path}`);
  },
};

function fx(text, citation) {
  if (!citation) throw new Error(`fx("${text}") needs a citation`);
  return record(text, "fixed", null, citation);
}

// Structural numbers that aren't figures: dates, IDs, warehouse names, cross-references, file names, times.
const STRUCTURAL = [
  /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,? (?:(?:Jan|Feb|Nov|Dec)[a-z]* )?\d{1,2}\b/g,
  /\b(?:Jan|Feb|Nov|Dec)[a-z]* \d{1,2}(?:(?: to |-|–)(?:(?:Jan|Feb)[a-z]* )?\d{1,2})?(?:, \d{4})?/g,
  /\b20\d\d\b/g,
  /\b[A-Z]{1,2}-\d{1,3}\b/g,
  /\bWarehouses? \d(?:(?:, | and | to )\d)*/g,
  /\bW[124]\b/g,
  /\b(?:Figure|Table|Chapter|chapter|[Ss]ection|[Ss]tep|[Ww]eeks?|[Pp]age|Appendix)s? \d+(?:\.\d+)?(?:(?: and | to |-|, )\d+)*/g,
  /\bM\d\b/g,
  /\S*[\\/_]\S*/g,
  /\S+\.(?:csv|py|js|mjs|json|sql|md|docx|pdf|png|bat|txt|xlsx)\b/g,
  /\blocalhost:\d+/g,
  /\b\d{1,2}:\d{2}\b/g,
];

function residualDigits(text) {
  let rest = text.replace(CLAIM_RE, " ");
  for (const re of STRUCTURAL) rest = rest.replace(re, " ");
  return rest.match(/[^\s]*\d[^\s]*/g) || [];
}

function strip(text) {
  return text.replace(CLAIM_RE, "$2");
}

module.exports = { Num, resolve, source, derive, fmt, fx, register, residualDigits, strip, CLAIM_RE };
