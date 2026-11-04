"""Reproduces every data-backed claim in planning/FINDINGS.md.

Section codes (F-01, F-02, ...) match the finding IDs in that file.
Reads straight from MISA.zip and the deck, so nothing needs extracting.
Standard library only.

Run from the project root:
    python -I planning/evidence/verify_findings.py > planning/evidence/verify_findings.output.txt
"""
import collections
import csv
import io
import re
import sys
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]
sys.stdout.reconfigure(encoding="utf-8")

PPTX_NAME = "Texas MISA Fall 2026 Case Competition.pptx"
PDF_ENTRY = "MISA/Texas MISA Fall 2026 Case Competition.pdf"
TEAMS_ENTRY = "MISA/Student Teams/Costco_Case_Competition_TEAMS.zip"

outer = zipfile.ZipFile(ROOT / "MISA.zip")
teams = zipfile.ZipFile(io.BytesIO(outer.read(TEAMS_ENTRY)))
PREFIX = "team_distribution/"


def text(path):
    return teams.read(PREFIX + path).decode("utf-8-sig")


def rows(name):
    return list(csv.DictReader(io.StringIO(text(f"csv/{name}.csv"), newline="")))


def section(code, title):
    print(f"\n=== {code}: {title} ===")


def num(r, k):
    return float(r[k] or 0)


def cap(r):
    return (
        num(r, "available_regular_employees")
        + num(r, "max_overtime_employees")
        + num(r, "cross_trained_flex_employees")
    )


grid = rows("v_PlanningWeekGrid")
hist = rows("v_ShiftHistory")
tpl = rows("TEAM_SUBMISSION_TEMPLATE")
bench = rows("PlanningWeek_BenchmarkForecast")
BLOCK = ("store_id", "dept_id", "day_date", "shift_code")
SKEY = ("scenario_id",) + BLOCK


def key(r, fields=BLOCK):
    return tuple(r[f] for f in fields)


base = {key(r): r for r in grid if r["scenario_code"] == "BASE"}
is_open = [r for r in hist if r["is_open"] == "1" and num(r, "worked_labor_hours") > 0]
DEPTS = {"38": "Front End", "92": "Merchandising", "95": "Pharmacy"}
STANDARD = {r["dept_id"]: float(r["labor_hours_per_workload_unit"]) for r in rows("comp_LaborStandard")}

section("F-01", "Source versions and the scenario conflict")
pptx = zipfile.ZipFile(ROOT / PPTX_NAME)
core = pptx.read("docProps/core.xml").decode()
slides = [n for n in pptx.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
print("pptx modified:", re.search(r"<dcterms:modified[^>]*>([^<]+)", core).group(1), "| slides:", len(slides))
print("pdf zip timestamp:", outer.getinfo(PDF_ENTRY).date_time)
pptx_text = " ".join(pptx.read(n).decode("utf-8", "ignore") for n in slides)
print("pptx contains 'at least one changed-condition scenario':", "at least one changed-condition scenario" in pptx_text)
print("README contains 'All three scenarios (BASE, PEAK and DISRUPT) are required':",
      "All three scenarios (BASE, PEAK and DISRUPT) are required" in text("README.md"))

section("F-02", "Row counts and template alignment")
print("v_ShiftHistory", len(hist), "| v_PlanningWeekGrid", len(grid), "| template", len(tpl), "| benchmark", len(bench))
print("comp_FactShiftAvailability", len(rows("comp_FactShiftAvailability")),
      "| comp_FactShiftSchedule", len(rows("comp_FactShiftSchedule")))
print("history dates:", min(r["day_date"] for r in hist), "to", max(r["day_date"] for r in hist))
print("planning dates:", min(r["day_date"] for r in grid), "to", max(r["day_date"] for r in grid))
grid_by_skey = {key(r, SKEY): r for r in grid}
print("template keys == grid keys:", {key(r, SKEY) for r in tpl} == set(grid_by_skey))
print("template draft values differing from grid:",
      sum(grid_by_skey[key(r, SKEY)]["draft_scheduled_employees"] != r["draft_scheduled_employees"] for r in tpl))

section("F-03", "Service against utilization (utilization = demand x standard / worked hours)")
for dept, name in DEPTS.items():
    data = sorted(
        (float(r["shift_demand_units"]) * STANDARD[dept] / float(r["worked_labor_hours"]),
         float(r["metric_value"]), int(float(r["met_target"])))
        for r in is_open if r["dept_id"] == dept
    )
    print(f"{name}: blocks={len(data)} overall met={100 * sum(x[2] for x in data) / len(data):.1f}% "
          f"max utilization={data[-1][0]:.2f}")
    for lo, hi in ((0, .6), (.6, .7), (.7, .8), (.8, .85), (.85, .9), (.9, .95), (.95, 1), (1, 99)):
        band = [x for x in data if lo <= x[0] < hi]
        if band:
            print(f"  {lo:.2f}-{hi:.2f} blocks={len(band):3d} met={100 * sum(x[2] for x in band) / len(band):5.1f}% "
                  f"avg metric={sum(x[1] for x in band) / len(band):6.1f} min")
    for label, test in (("below 0.85", lambda u: u < .85), ("0.85-0.90", lambda u: .85 <= u < .9), ("0.90+", lambda u: u >= .9)):
        band = [x for x in data if test(x[0])]
        print(f"  summary {label}: blocks={len(band)} met={100 * sum(x[2] for x in band) / len(band):.1f}%")

section("F-04", "Callouts and backfill in history")
sched = sum(num(r, "scheduled_employees") for r in is_open)
calls = sum(num(r, "callout_employees") for r in is_open)
back = sum(num(r, "backfill_employees") for r in is_open)
print(f"callout rate={100 * calls / sched:.2f}% of scheduled | backfilled={100 * back / calls:.1f}% of callouts")

section("F-05", "labor_cost is reproduced by the documented formula")
rates = {(r["store_id"], r["dept_id"]): r for r in rows("comp_LaborCostAssumption")}
err = max(
    abs(num(r, "labor_cost")
        - num(r, "worked_regular_hours") * float(rates[(r["store_id"], r["dept_id"])]["loaded_regular_hourly_cost"])
        - num(r, "worked_overtime_hours") * float(rates[(r["store_id"], r["dept_id"])]["loaded_overtime_hourly_cost"]))
    for r in hist
)
print(f"max absolute error={err:.4f}")

section("F-06", "Shift demand sums to daily demand")
days = collections.defaultdict(list)
for r in hist:
    days[key(r, ("store_id", "dept_id", "day_date"))].append(r)
dev = max(abs(sum(num(x, "shift_demand_units") for x in v) - num(v[0], "daily_demand_units")) for v in days.values())
print(f"daily rows={len(days)} | open daily rows={sum(num(v[0], 'daily_demand_units') > 0 for v in days.values())} | max deviation={dev:.4f}")

section("F-07", "Benchmark equals the same-weekday mean of weeks 3-6, in the same units as daily demand")
start = date(2026, 1, 1)
worst = 0.0
for b in bench:
    target = date.fromisoformat(b["day_date"])
    vals = [
        num(v[0], "daily_demand_units")
        for k, v in days.items()
        if k[0] == b["store_id"] and k[1] == b["dept_id"]
        and date.fromisoformat(k[2]).weekday() == target.weekday()
        and 3 <= (date.fromisoformat(k[2]) - start).days // 7 + 1 <= 6
    ]
    worst = max(worst, abs(sum(vals) / len(vals) - float(b["predicted_transaction_count_proxy"])))
print(f"rows checked={len(bench)} | grain unique store/dept/date={len({key(b, ('store_id', 'dept_id', 'day_date')) for b in bench})} | max deviation={worst:.4f}")

section("F-08", "DISRUPT availability changes against BASE (regular, overtime, flex)")
FIELDS = ("available_regular_employees", "max_overtime_employees", "cross_trained_flex_employees")
for r in sorted((r for r in grid if r["scenario_code"] == "DISRUPT"), key=lambda r: key(r)):
    b = base[key(r)]
    if any(b[f] != r[f] for f in FIELDS):
        change = " ".join(f"{b[f]}->{r[f]}" for f in FIELDS)
        print(f"WH{r['store_id']} {DEPTS[r['dept_id']]:13s} {r['day_date']} {r['shift_code']:4s} {change} | draft {r['draft_scheduled_employees']}")

section("F-09", "Draft schedule above capacity, by scenario")
over = [r for r in grid if r["is_open"] == "1" and num(r, "draft_scheduled_employees") > cap(r)]
print(dict(collections.Counter(r["scenario_code"] for r in over)))
for r in sorted(over, key=lambda r: key(r)):
    print(f"{r['scenario_code']} WH{r['store_id']} {DEPTS[r['dept_id']]:13s} {r['day_date']} {r['shift_code']:4s} draft={r['draft_scheduled_employees']} capacity={cap(r):.0f}")
print("draft below min_staff:", sum(num(r, "draft_scheduled_employees") < num(r, "min_staff") for r in grid if r["is_open"] == "1"))

section("F-10", "PEAK changes demand only")
peak = [r for r in grid if r["scenario_code"] == "PEAK"]
print("PEAK availability rows differing from BASE:", sum(any(base[key(r)][f] != r[f] for f in FIELDS) for r in peak))
ranges = collections.defaultdict(list)
for r in peak:
    if float(r["demand_multiplier"]) != 1:
        ranges[(r["day_date"], r["store_id"], DEPTS[r["dept_id"]])].append(float(r["demand_multiplier"]))
for k in sorted(ranges):
    print(f"{k[0]} WH{k[1]} {k[2]:13s} multiplier {min(ranges[k]):.2f}-{max(ranges[k]):.2f}")
for code in ("BASE", "PEAK", "DISRUPT"):
    vals = [float(r["demand_multiplier"]) for r in grid if r["scenario_code"] == code]
    print(f"{code}: multiplier range {min(vals):.2f}-{max(vals):.2f}")

section("F-11", "min_staff is reachable without flex")
short = [r for r in grid if r["is_open"] == "1" and
         num(r, "available_regular_employees") + num(r, "max_overtime_employees") < num(r, "min_staff")]
print("open blocks where regular + overtime < min_staff:", len(short))

section("F-12", "Columns present in only one of the two main views")
print("planning grid only:", sorted(set(grid[0]) - set(hist[0])))
print("history only:", sorted(set(hist[0]) - set(grid[0])))

section("F-13", "Holiday labels and calendar")
print("history:")
for d, role, closed in sorted({(r["day_date"], r["holiday_window_role"], r["is_costco_closed"]) for r in hist if r["holiday_window_role"] != "Normal"}):
    print(f"  {d} {role} closed={closed}")
print("planning week (date, day, day_type, holiday, role, stockup, rebound, has_promotion, promotion_index):")
for row in sorted({(r["day_date"], r["day_name"], r["day_type"], r["holiday_name"], r["holiday_window_role"],
                    r["is_pre_holiday_stockup"], r["is_post_holiday_rebound"], r["has_promotion"], r["promotion_index"])
                   for r in grid if r["scenario_code"] == "BASE" and r["store_id"] == "1" and r["dept_id"] == "38"}):
    print(" ", row)

section("F-14", "Closed blocks")
print("history closed blocks:", sum(r["is_open"] == "0" for r in hist),
      "| open blocks with a NULL metric:", sum(r["is_open"] == "1" and r["metric_value"] == "" for r in hist))
print("template closed rows:", sum(r["is_open"] == "0" for r in tpl),
      collections.Counter((r["day_name"], r["shift_code"]) for r in tpl if r["is_open"] == "0" and r["scenario_id"] == "1" and r["store_id"] == "1"))

section("F-15", "Submission template")
print("first three shift codes:", [r["shift_code"] for r in tpl[:3]])
print("team_id values:", sorted({r["team_id"] for r in tpl}))
print("rows with submitted_employees already filled:", sum(bool(r["submitted_employees"]) for r in tpl))

section("F-16", "Where the daily core tables live")
names = [n for n in teams.namelist() if n.endswith(".csv")]
headers = {n: next(csv.reader(io.StringIO(teams.read(n).decode("utf-8-sig")))) for n in names}
for col in ("promotion_index", "traffic_index", "markdown1", "fuel_price", "predicted_traffic_index"):
    print(f"{col}: in CSV headers of", sorted(Path(n).name for n, h in headers.items() if col in h))
for script in ("02_Load_Core_Data.sql", "04_Load_Shift_Planning_Data.sql"):
    sql = text(f"sql/{script}")
    print(script, "loads FactDailyFeatures:", "INSERT INTO [API].[FactDailyFeatures]" in sql,
          "| partition train:", "N'train'" in sql, "| test:", "N'test'" in sql or "'test'" in sql)
print("database name:", sorted(set(re.findall(r"CREATE DATABASE \[(\w+)\]", text("sql/01_Create_Database.sql")))))

section("F-17", "Weaknesses the starter query Q5 declares")
q5 = text("sql/06_Example_Queries.sql")
print(" ".join(re.search(r"Known simplifications.*?department\.", q5, re.S).group(0).split()))
print("default target_util in the starter queries:", sorted(set(re.findall(r"CAST\((0\.\d+) AS DECIMAL\(4,2\)\) AS \[target_util\]", q5))))

section("F-18", "Flex pool sizes in the planning grid (min-max per block)")
for dept, name in DEPTS.items():
    vals = [num(r, "cross_trained_flex_employees") for r in grid if r["dept_id"] == dept]
    print(f"{name}: {min(vals):.0f}-{max(vals):.0f}")

section("F-19", "Draft schedule does not vary by scenario")
per = collections.defaultdict(set)
for r in grid:
    per[key(r)].add(r["draft_scheduled_employees"])
print("blocks whose draft differs between scenarios:", sum(len(v) > 1 for v in per.values()))
for code in ("BASE", "PEAK", "DISRUPT"):
    print(f"{code}: draft labor hours={sum(num(r, 'draft_scheduled_labor_hours') for r in grid if r['scenario_code'] == code):.1f}")

section("F-20", "Paid hours per open block")
vals = [float(r["paid_hours"]) for r in rows("comp_ShiftDefinition") if r["is_open"] == "1"]
print(f"min={min(vals)} max={max(vals)}")
