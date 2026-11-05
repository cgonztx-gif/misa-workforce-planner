// Everything the report reads: the pipeline summary, the charts' figure data, output CSVs and a few counts.
// Each lookup returns a sourced Num (claims.js), so formatters can record where every printed figure came from.
const fs = require("fs");
const path = require("path");
const { Num, source, derive } = require("./claims");

const ROOT = path.resolve(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; } else if (ch === '"') quoted = false; else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const S = JSON.parse(read("outputs/analysis_summary.json"));
const F = JSON.parse(read("outputs/charts/figure_data.json"));
const PLAN = parseCsv(read("outputs/plan_vs_draft.csv"));

// Sourced lookups.
const s = source(S, "analysis_summary.json");
const f = source(F, "outputs/charts/figure_data.json");

// Sum or count a column of an outputs CSV over rows matching a filter, with the filter in the source key.
function csvSum(file, rows, filter, column, label) {
  const keep = rows.filter((r) => Object.entries(filter).every(([k, v]) => (typeof v === "function" ? v(r[k], r) : String(r[k]) === String(v))));
  const value = column ? keep.reduce((a, r) => a + Number(r[column]), 0) : keep.length;
  return new Num(value, `outputs/${file}[${label || Object.keys(filter).join(",")}]${column ? `.${column} (sum)` : " (count)"}`);
}
const planSum = (filter, column, label) => csvSum("plan_vs_draft.csv", PLAN, filter, column, label);

// Rows in each data pack file, counted here (the data pack is extracted from MISA.zip, F-02).
function dataRows(file) {
  const rel = path.join("data", "team_distribution", "csv", file);
  const rows = parseCsv(read(rel));
  return new Num(rows.length, `data pack ${file}: rows counted by the builder`);
}

// Test cases in tests/, counted by the server's own count_tests() so the report and the app's Methods page agree.
function testCount() {
  const { spawnSync } = require("child_process");
  const result = spawnSync("python", ["-c", "import json; from server.views import count_tests; print(json.dumps(count_tests()))"], { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Couldn't count the tests: ${result.stderr}`);
  const counted = JSON.parse(result.stdout.trim().split("\n").pop());
  const src = "server/views.py count_tests(): test cases in tests/, as the app's Methods page shows them";
  return { tests: new Num(counted.count, src), files: new Num(counted.files, src) };
}

const DEPT = { 38: "Front End", 92: "Merchandising", 95: "Pharmacy" };
const DEPT_IDS = [38, 92, 95];
const SCEN = ["BASE", "PEAK", "DISRUPT"];
const DAYS = ["2026-02-12", "2026-02-13", "2026-02-14", "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18"];
const DAY = { "2026-02-12": "Thu Feb 12", "2026-02-13": "Fri Feb 13", "2026-02-14": "Sat Feb 14", "2026-02-15": "Sun Feb 15",
  "2026-02-16": "Mon Feb 16", "2026-02-17": "Tue Feb 17", "2026-02-18": "Wed Feb 18" };
const SHIFT = { OPEN: "Opening", MID: "Midday", EVE: "Evening" };
const SCEN_NAME = { BASE: "Baseline planning week", PEAK: "Promotion and winter-weather surge", DISRUPT: "Callouts and reduced availability" };

// Common keys.
const plan = (sc, k) => s(`plan_summary[scenario_code=${sc}].${k}`);
const draft = (sc, k) => s(`draft_summary[scenario_code=${sc}].${k}`);
const costChange = (sc) => derive("plan cost / draft cost - 1", plan(sc, "cost").v / draft(sc, "cost").v - 1, plan(sc, "cost"), draft(sc, "cost"));
const diff = (label, a, b) => derive(label, a.v - b.v, a, b);
const goalRow = (g, k) => s(`goal_tradeoff[scenario_code=BASE,goal=${g}].${k}`);
const buffer = (name, k, sc = "BASE") => s(`buffer_test[plan=${name},scenario_code=${sc}].${k}`);
const pto = (n, k) => s(`pto_what_if[kept_per_block=${n}].${k}`);
const limit = (d, st, k = "u95") => s(`service_limits[dept_id=${d},store_id=${st}].${k}`);
const callout = (d, ctx, k = "rate") => s(`callout_rates[dept_id=${d},context=${ctx}].${k}`);
const factor = (d, w) => s(`holiday_factors[dept_id=${d},window=${w}].factor`);
const byDept = (sc, d, k) => s(`plan_by_dept[scenario_code=${sc},dept_id=${d}].${k}`);
const byDay = (sc, day, k) => s(`plan_by_day[scenario_code=${sc},day_date=${day}].${k}`);

// People short of need, by scenario and optionally by day (capacity_gaps in the summary, F-50).
function gap(sc, day, column = "gap_people") {
  const rows = S.capacity_gaps.filter((r) => r.scenario_code === sc && (!day || r.day_date === day));
  return new Num(rows.reduce((a, r) => a + r[column], 0), `analysis_summary.json:capacity_gaps[scenario_code=${sc}${day ? `,day_date=${day}` : ""}].${column} (sum)`);
}
function belowGoal(sc, day) {
  const row = S.below_goal_by_day.find((r) => r.scenario_code === sc && r.day_date === day);
  return row ? s(`below_goal_by_day[scenario_code=${sc},day_date=${day}].blocks`) : new Num(0, `analysis_summary.json:below_goal_by_day[scenario_code=${sc},day_date=${day}] (no row, so 0)`);
}

module.exports = {
  ROOT, S, F, PLAN, s, f, derive, diff, planSum, dataRows, testCount, parseCsv, DEPT, DEPT_IDS, SCEN, DAYS, DAY, SHIFT, SCEN_NAME,
  plan, draft, costChange, goalRow, buffer, pto, limit, callout, factor, byDept, byDay, gap, belowGoal, Num,
};
