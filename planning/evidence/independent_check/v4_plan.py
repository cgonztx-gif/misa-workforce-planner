import pandas as pd, numpy as np
from alloc import *
pd.set_option("display.width", 220); pd.set_option("display.max_columns", 40); pd.set_option("display.max_rows", 300)
g = load_grid()
print("grid rows", len(g), g.groupby("scenario_code").size().to_dict(), "open", g.is_open.sum())
print("open by scenario", g.groupby("scenario_code").is_open.sum().to_dict())
# Scenario diffs
piv = g.pivot_table(index=["store_id", "dept_id", "day_date", "shift_code"], columns="scenario_code", values=["draft_scheduled_employees", "demand_multiplier", "available_regular_employees", "max_overtime_employees", "cross_trained_flex_employees"])
print("draft same across scenarios", (piv["draft_scheduled_employees"].nunique(axis=1) == 1).all())
print("PEAK avail diffs", (piv["available_regular_employees"]["PEAK"] != piv["available_regular_employees"]["BASE"]).sum(), (piv["max_overtime_employees"]["PEAK"] != piv["max_overtime_employees"]["BASE"]).sum(), (piv["cross_trained_flex_employees"]["PEAK"] != piv["cross_trained_flex_employees"]["BASE"]).sum())
print("DISRUPT multiplier != 1", (piv["demand_multiplier"]["DISRUPT"] != 1).sum(), "BASE !=1", (piv["demand_multiplier"]["BASE"] != 1).sum())
pm = piv["demand_multiplier"]["PEAK"]
print("PEAK mult", pm[pm != 1].groupby(level=[1, 2]).agg(["min", "max", "size"]))
print("PEAK mult dates", pm[pm != 1].index.get_level_values(2).unique())
for col in ["available_regular_employees", "max_overtime_employees", "cross_trained_flex_employees"]:
    dd = piv[col]["DISRUPT"] - piv[col]["BASE"]
    x = dd[dd != 0].reset_index().rename(columns={0: "delta"})
    print(col, "DISRUPT diffs n", len(x))
    print(x.groupby(["store_id", "dept_id", "day_date", "shift_code"]).sum().unstack("shift_code") if len(x) else "")

# draft alloc
gd = allocate(g, "draft_scheduled_employees")
gd = gd[gd.is_open == 1]
s = gd.groupby("scenario_code").agg(cost=("cost", "sum"), uncapped=("uncapped_cost", "sum"), hours=("hours", "sum"), short=("short", "sum"), blocks=("short", lambda x: (x > 0).sum()), below_min=("draft_scheduled_employees", lambda x: 0))
print(s.round(1))
print("draft closed blocks nonzero:", g[(g.is_open == 0)].draft_scheduled_employees.sum())
print(gd[gd.short > 0][["scenario_code", "store_id", "dept_id", "day_date", "shift_code", "draft_scheduled_employees", "available_regular_employees", "usable_flex", "cross_trained_flex_employees", "max_overtime_employees", "short"]])
print("draft below min", (gd.fielded < gd.min_staff).groupby(gd.scenario_code).sum().to_dict())
print(gd.groupby(["scenario_code", "department_group"]).agg(h=("hours", "sum"), c=("cost", "sum"), r=("reg", "sum"), f=("flex", "sum"), o=("ot", "sum")).round(1))

# dashboard variant: flex unlimited
v = gd.copy()
v["cap_u"] = v.available_regular_employees + v.cross_trained_flex_employees + v.max_overtime_employees
v["short_u"] = (v.draft_scheduled_employees - v.cap_u).clip(lower=0)
print("Unlimited flex shortfall", v.groupby("scenario_code").short_u.agg(["sum", lambda x: (x > 0).sum()]))
# cost with no OT cap and limited flex
print("uncapped OT cost", gd.groupby("scenario_code").uncapped_cost.sum())
# cost with unlimited flex and uncapped OT
v["r"] = np.minimum(v.draft_scheduled_employees, v.available_regular_employees)
v["fl"] = np.minimum(v.draft_scheduled_employees - v.r, v.cross_trained_flex_employees)
v["o"] = v.draft_scheduled_employees - v.r - v.fl
v["c2"] = (v.r + v.fl) * v.paid_hours * v.loaded_regular_hourly_cost + v.o * v.paid_hours * v.loaded_overtime_hourly_cost
print("unlimited flex, uncapped OT cost", v.groupby("scenario_code").c2.sum())

# Submission checks
bl = pd.read_csv(D + "TEAM_SUBMISSION_TEMPLATE.csv", parse_dates=False, dtype=str, keep_default_na=False)
fl = pd.read_csv(r"C:\MISA Case\outputs\TEAM_SUBMISSION_TEMPLATE_filled.csv", dtype=str, keep_default_na=False)
print("rows", len(bl), len(fl))
print("columns identical", list(bl.columns) == list(fl.columns), list(fl.columns))
kc = ["scenario_id", "scenario_code", "store_id", "dept_id", "department_group", "day_date", "day_name", "shift_code", "is_open", "min_staff", "draft_scheduled_employees", "team_id"]
for c in kc:
    if c in bl.columns:
        print(c, "identical row-by-row", (bl[c].values == fl[c].values).all())
print("submitted blank in blank template", (bl.submitted_employees == "").all(), "blank in filled", (fl.submitted_employees == "").sum())
print("non-integer values", fl.submitted_employees[~fl.submitted_employees.str.fullmatch(r"\d+")].unique()[:10])
fl["sub"] = fl.submitted_employees.astype(int)
for c in ["scenario_id", "store_id", "dept_id", "is_open", "min_staff", "draft_scheduled_employees"]:
    fl[c] = fl[c].astype(int)
fl["day_date"] = pd.to_datetime(fl.day_date)
print("key unique", fl.duplicated(["scenario_id", "store_id", "dept_id", "day_date", "shift_code"]).sum())
m = g.merge(fl[KEYS + ["sub", "is_open", "min_staff", "draft_scheduled_employees"]], on=KEYS, how="outer", suffixes=("", "_t"), indicator=True)
print(m._merge.value_counts().to_dict())
print("template is_open vs grid", (m.is_open != m.is_open_t).sum(), "min_staff (open only)", ((m.min_staff != m.min_staff_t) & (m.is_open == 1)).sum(), "draft", (m.draft_scheduled_employees != m.draft_scheduled_employees_t).sum())
print("closed nonzero", ((m.is_open == 0) & (m["sub"] != 0)).sum(), "closed count", (m.is_open == 0).sum())
a = allocate(m, "sub")
op = a[a.is_open == 1]
print("below min", (op["sub"] < op.min_staff).groupby(op.scenario_code).sum().to_dict())
print("over capacity", (op.short > 0).groupby(op.scenario_code).sum().to_dict(), op[op.short > 0][["scenario_code", "store_id", "dept_id", "day_date", "shift_code", "sub", "capacity"]])
r = op.groupby("scenario_code").agg(cost=("cost", "sum"), hours=("hours", "sum"), sub=("sub", "sum"), reg=("reg", "sum"), flex=("flex", "sum"), ot=("ot", "sum"), at_cap=("short", "size"))
print(r.round(1))
op = op.copy()
op["at_capacity"] = op["sub"] >= op.capacity
print("at capacity", op.groupby("scenario_code").at_capacity.sum().to_dict())
print(op.groupby(["scenario_code", "day_date"]).at_capacity.sum().unstack(0))
print(op.groupby(["scenario_code", "department_group"]).agg(cost=("cost", "sum"), hours=("hours", "sum"), reg=("reg", "sum"), flex=("flex", "sum"), ot=("ot", "sum")).round(1))
print("Feb 14 BASE FE+Merch cost", op[(op.scenario_code == "BASE") & (op.day_date == "2026-02-14") & (op.dept_id.isin([38, 92]))].cost.sum())
print("Team id values", fl.team_id.unique())
# Plan below draft
op["delta"] = op["sub"] - op.draft_scheduled_employees
print(op.groupby("scenario_code").delta.describe().round(2))
print("cuts vs adds", op.groupby("scenario_code").delta.agg(lambda x: x[x < 0].sum()), op.groupby("scenario_code").delta.agg(lambda x: x[x > 0].sum()))

# Does PTO fall by ~4 per block on FE weekend? compare with recent weekends
h = pd.read_csv(D + "v_ShiftHistory.csv", parse_dates=["day_date"])
fe = h[(h.dept_id == 38) & (h.is_weekend == 1) & (h.is_open == 1)]
# recent weekends: weeks 3-6 and non-holiday
bs = g[(g.scenario_code == "BASE") & (g.dept_id == 38) & (g.is_open == 1)]
print("FE avail reg by date (plan)", bs.groupby(["day_date"]).available_regular_employees.mean().round(2).to_dict())
for dn in ["Saturday", "Sunday"]:
    hh = fe[(fe.day_name == dn)]
    print(dn, "hist avg by date", hh.groupby("day_date").available_regular_employees.mean().round(2).to_dict())
for dn in ["Friday", "Monday"]:
    hh = h[(h.dept_id == 38) & (h.is_open == 1) & (h.day_name == dn)]
    print(dn, "hist avg by date", hh.groupby("day_date").available_regular_employees.mean().round(2).to_dict())
print("availability notes in plan", g[g.scenario_code == "BASE"].groupby(["availability_note", "day_date"]).size())
