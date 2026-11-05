// Every figure the deck shows, read from outputs/ (frozen at 981069f, D-28) and the data pack's input tables.
// Nothing here is typed by hand: slides and notes format what this module returns.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "outputs");
const PACK = path.join(ROOT, "data", "team_distribution", "csv");

/** RFC 4180 CSV to objects; numeric-looking fields become numbers. */
function parseCsv(file) {
  const src = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  const num = (s) => (s !== "" && /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(s) ? Number(s) : s);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, num(r[i] ?? "")])));
}

// Formatting. The minus sign matches the app (U+2212).
const MINUS = "−";
const fixed = (n, d = 0) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const int = (n) => fixed(Math.round(n));
const sign = (n) => (n > 0 ? "+" : n < 0 ? MINUS : "");
const pct = (x, d = 1) => `${x < 0 ? MINUS : ""}${fixed(Math.abs(x) * 100, d)}%`;
const spct = (x, d = 1) => `${sign(x)}${fixed(Math.abs(x) * 100, d)}%`;
const pts = (x, d = 1) => `${sign(x)}${fixed(Math.abs(x) * 100, d)} pts`;
const money = (n) => `${n < 0 ? MINUS : ""}$${int(Math.abs(n))}`;
const moneyK = (n, d = 1) => `${n < 0 ? MINUS : ""}$${fixed(Math.abs(n) / 1000, d)}K`;
const smoneyK = (n, d = 1) => `${sign(n)}$${fixed(Math.abs(n) / 1000, d)}K`;
const sint = (n) => `${sign(n)}${int(Math.abs(n))}`;
const hrs = (n) => `${int(n)} h`;
const dt = (iso) => new Date(`${iso}T12:00:00Z`);
const wkday = (iso) => dt(iso).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
const mon = (iso) => dt(iso).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
const NB = " "; // dates never break across lines
const dayLong = (iso) => `${wkday(iso)}${NB}${mon(iso)}${NB}${dt(iso).getUTCDate()}`; // Sat Feb 14
const dayMon = (iso) => `${mon(iso)}${NB}${dt(iso).getUTCDate()}`; // Feb 14
const dayShort = (iso) => `${wkday(iso)}${NB}${dt(iso).getUTCDate()}`; // Sat 14
const span = (a, b) => (a === b ? dayMon(a) : `${dayMon(a)}–${dt(b).getUTCDate()}`); // Feb 13–16
const F = { MINUS, fixed, int, sign, pct, spct, pts, money, moneyK, smoneyK, sint, hrs, dayLong, dayMon, dayShort, wkday, span };

const S = JSON.parse(fs.readFileSync(path.join(OUT, "analysis_summary.json"), "utf8"));
const SCEN = ["BASE", "PEAK", "DISRUPT"];
const DEPTS = [38, 92, 95];
const DEPT_NAME = { 38: "Front End", 92: "Merchandising", 95: "Pharmacy" };
const by = (rows, code) => rows.find((r) => r.scenario_code === code);
const uniq = (a) => [...new Set(a)];
const sum = (a) => a.reduce((t, v) => t + v, 0);

const plan = Object.fromEntries(SCEN.map((c) => [c, by(S.plan_summary, c)]));
const draft = Object.fromEntries(SCEN.map((c) => [c, by(S.draft_summary, c)]));
const days = uniq(S.plan_by_day.map((r) => r.day_date)).sort();
const pvd = parseCsv(path.join(OUT, "plan_vs_draft.csv"));
const sub = parseCsv(path.join(OUT, "TEAM_SUBMISSION_TEMPLATE_filled.csv"));
const fdaily = parseCsv(path.join(OUT, "forecast_daily.csv"));
const expl = parseCsv(path.join(OUT, "explanations.csv"));
const goalRows = parseCsv(path.join(OUT, "goal_tradeoff.csv")).filter((r) => r.scenario_code === "BASE").sort((a, b) => a.goal - b.goal);

// Input tables from the data pack (case facts, not results).
const grid = parseCsv(path.join(PACK, "v_PlanningWeekGrid.csv"));
const metrics = parseCsv(path.join(PACK, "comp_ServiceMetricDefinition.csv"));
const rates = parseCsv(path.join(PACK, "comp_LaborCostAssumption.csv"));
const scenarios = parseCsv(path.join(PACK, "comp_Scenario.csv"));

// The calendar: holiday names and the holiday window, from the planning grid.
const gridBase = grid.filter((r) => r.scenario_code === "BASE");
const dayRow = (d) => gridBase.find((r) => r.day_date === d);
const cal = days.map((d) => ({ day: d, holiday: dayRow(d).holiday_name || "", role: dayRow(d).holiday_window_role, isHoliday: dayRow(d).is_holiday === 1 }));
const windowDays = cal.filter((c) => c.role !== "Normal").map((c) => c.day);
const holidayDay = cal.find((c) => c.isHoliday);
const valentineDay = cal.find((c) => c.holiday && !c.isHoliday);
const holidays = { window: windowDays, holiday: holidayDay, valentine: valentineDay, windowName: `${holidayDay.holiday} window` };
const warehouses = uniq(gridBase.map((r) => r.store_id)).sort((a, b) => a - b);
const ptoDays = uniq(gridBase.filter((r) => r.availability_note === "Holiday-weekend PTO requests").map((r) => r.day_date)).sort();

// Service targets by department.
const target = Object.fromEntries(DEPTS.map((d) => {
  const m = metrics.find((r) => r.dept_id === d);
  return [d, { name: m.metric_name, value: m.target_value, unit: m.unit_of_measure }];
}));

// What each scenario changes, measured from the grid.
const peakRows = grid.filter((r) => r.scenario_code === "PEAK" && r.demand_multiplier > 1);
const peak = { maxMult: Math.max(...peakRows.map((r) => r.demand_multiplier)), days: uniq(peakRows.map((r) => r.day_date)).sort() };
const key = (r) => [r.store_id, r.dept_id, r.day_date, r.shift_code].join("|");
const baseByKey = new Map(gridBase.map((r) => [key(r), r]));
const availCols = ["available_regular_employees", "max_overtime_employees", "cross_trained_flex_employees"];
const cut = grid.filter((r) => r.scenario_code === "DISRUPT" && availCols.some((c) => r[c] !== baseByKey.get(key(r))[c]));
const cutStores = uniq(cut.map((r) => r.store_id)).sort();
const disrupt = {
  changedBlocks: cut.length,
  stores: cutStores.map((s) => {
    const ds = uniq(cut.filter((r) => r.store_id === s).map((r) => r.day_date)).sort();
    return { store: s, from: ds[0], to: ds[ds.length - 1] };
  }),
};

// The board hint on the title slide: Warehouse 1, BASE, change vs the draft.
const board = pvd.filter((r) => r.scenario_code === "BASE" && r.store_id === 1);

// History diagnosis (slide 3): share of blocks meeting target by utilization band, folded at the ends.
const LO = 0.6, HI = 1.1;
const bandKey = (b) => Math.round(Math.min(Math.max(b, LO), HI) * 100);
const bandKeys = uniq(S.service_bands.map((r) => bandKey(r.band))).sort((a, b) => a - b);
const cliff = {
  labels: bandKeys.map((k) => (k === LO * 100 ? `≤${k}%` : k === HI * 100 ? `${k}%+` : `${k}%`)),
  keys: bandKeys,
  byDept: DEPTS.map((d) => bandKeys.map((k) => {
    const rs = S.service_bands.filter((r) => r.dept_id === d && bandKey(r.band) === k);
    const n = sum(rs.map((r) => r.blocks));
    return n ? sum(rs.map((r) => r.blocks * r.met_target)) / n : null;
  })),
};
// The cliff edge: the first band where fewer than 95% of all blocks met target.
const allMet = bandKeys.map((k) => {
  const rs = S.service_bands.filter((r) => bandKey(r.band) === k);
  return sum(rs.map((r) => r.blocks * r.met_target)) / sum(rs.map((r) => r.blocks));
});
cliff.edgeIndex = allMet.findIndex((m) => m < 0.95);
cliff.edge = bandKeys[cliff.edgeIndex] / 100;
cliff.edgeMet = allMet[cliff.edgeIndex];
cliff.nextMet = allMet[cliff.edgeIndex + 1];

// Forecast (slide 4, A1, A2).
const fc = DEPTS.map((d) => {
  const rows = S.forecast_by_day.filter((r) => r.dept_id === d).sort((a, b) => a.day_date.localeCompare(b.day_date));
  return { dept: d, forecast: rows.map((r) => r.daily_forecast), benchmark: rows.map((r) => r.benchmark) };
});
const factor = (d, w) => S.holiday_factors.find((r) => r.dept_id === d && r.window === w).factor;
const normalDays = cal.filter((c) => c.role === "Normal").map((c) => c.day);
const normalGap = Math.max(...normalDays.map((day) => {
  const rs = S.forecast_by_day.filter((r) => r.day_date === day);
  return Math.abs(sum(rs.map((r) => r.daily_forecast)) / sum(rs.map((r) => r.benchmark)) - 1);
}));
const histWeeks = Math.round(S.kpi.hist_blocks / 27 / 7);

// Submission and validation facts (A9, A11).
const subFacts = {
  rows: sub.length,
  perScenario: sub.length / SCEN.length,
  closed: sub.filter((r) => r.is_open === 0).length,
  closedAtZero: sub.filter((r) => r.is_open === 0 && r.submitted_employees === 0).length,
  open: sub.filter((r) => r.is_open === 1).length,
  atOrAboveMin: pvd.filter((r) => r.is_open === 1 && r.recommended >= r.min_staff).length,
  withinCapacity: pvd.filter((r) => r.is_open === 1 && r.recommended <= r.capacity).length,
  atCapacity: pvd.filter((r) => r.is_open === 1 && r.recommended === r.capacity).length,
  people: Object.fromEntries(SCEN.map((c) => [c, sum(sub.filter((r) => r.scenario_code === c).map((r) => r.submitted_employees))])),
  draftPeople: Object.fromEntries(SCEN.map((c) => [c, sum(sub.filter((r) => r.scenario_code === c).map((r) => r.draft_scheduled_employees))])),
  team: sub[0].team_id,
};
const rateRange = (col) => [Math.min(...rates.map((r) => r[col])), Math.max(...rates.map((r) => r[col]))];
const otPremium = sum(rates.map((r) => r.loaded_overtime_hourly_cost / r.loaded_regular_hourly_cost - 1)) / rates.length;

module.exports = {
  F, S, SCEN, DEPTS, DEPT_NAME, plan, draft, days, cal, holidays, ptoDays, target, peak, disrupt, scenarios,
  board, cliff, fc, factor, normalGap, histWeeks, subFacts, sub, pvd, expl, fdaily, goalRows, warehouses,
  rates: { regular: rateRange("loaded_regular_hourly_cost"), overtime: rateRange("loaded_overtime_hourly_cost"), otPremium },
  teamName: S.team_id && S.team_id !== "TEAM_NAME" ? S.team_id : null,
  sum, uniq,
};
