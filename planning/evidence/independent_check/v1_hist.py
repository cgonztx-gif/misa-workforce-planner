import pandas as pd, numpy as np
D = r"C:\MISA Case\data\team_distribution\csv\\"
h = pd.read_csv(D + "v_ShiftHistory.csv", parse_dates=["day_date"])
ls = pd.read_csv(D + "comp_LaborStandard.csv")
lc = pd.read_csv(D + "comp_LaborCostAssumption.csv")
h = h.merge(ls[["dept_id", "labor_hours_per_workload_unit"]], on="dept_id")
h = h.merge(lc[["store_id", "dept_id", "loaded_regular_hourly_cost", "loaded_overtime_hourly_cost"]], on=["store_id", "dept_id"])
print("rows", len(h), "dates", h.day_date.min(), h.day_date.max())
o = h[h.is_open == 1].copy()
print("open", len(o))
print("worked hours zero among open", (o.worked_labor_hours == 0).sum(), "met NaN", o.met_target.isna().sum())
print("met overall", o.met_target.mean())
print(o.groupby("department_group").met_target.agg(["mean", "sum", "count"]))
o["wl"] = o.shift_demand_units * o.labor_hours_per_workload_unit
o["util"] = o.wl / o.worked_labor_hours


def band(lo, hi):
    s = o[(o.util >= lo) & (o.util < hi)]
    return len(s), s.met_target.sum(), s.met_target.mean()


for lo, hi in [(0, .80), (0, .84), (.84, .85), (.84, .86), (.85, .90), (.85, .86), (.86, .88), (.88, .90), (.90, .95), (.90, 9), (.95, 1.0), (1.0, 9)]:
    print("util", lo, hi, band(lo, hi))
print("max util among met", o[o.met_target == 1].util.max())
print("min util among missed", o[o.met_target == 0].util.min())

# Table 1
o["need_h"] = o.wl / 0.85
o["need_emp"] = np.maximum(o.min_staff, np.ceil(o.need_h / o.paid_hours - 1e-9))
o["gap_emp"] = o.worked_employees - o.need_emp
o["over_h"] = o.gap_emp.clip(lower=0) * o.paid_hours
o["under_h"] = (-o.gap_emp).clip(lower=0) * o.paid_hours
o["need_hours"] = o.need_emp * o.paid_hours
o["val"] = o.over_h * o.loaded_regular_hourly_cost
o["miss"] = (o.met_target == 0).astype(int)
t = o.groupby("department_group")[["worked_labor_hours", "need_hours", "over_h", "under_h", "val", "miss"]].sum()
print(t.round(0))
print(t.sum().round(1))
print("worked vs need %", t.worked_labor_hours.sum() / t.need_hours.sum() - 1)

# hours with no-ceil need (raw)
print("raw need hours", o.groupby("department_group").need_h.sum().round(0).to_dict(), o.need_h.sum())

# Table 2
o["dtype"] = o.day_type
g = o.groupby(["store_id", "department_group", "dtype", "shift_code"]).agg(
    n=("util", "size"),
    worked=("worked_labor_hours", "sum"),
    wl=("wl", "sum"),
    util=("util", "mean"),
    met=("met_target", "mean"),
    gap_h=("gap_emp", lambda s: 0),
    over=("over_h", "sum"),
    under=("under_h", "sum"),
)
g["net"] = g.over - g.under
g["pooled_util"] = g.wl / g.worked
pd.set_option("display.width", 200)
print(g.sort_values("net").head(8).round(2))
print(g.sort_values("net").tail(8).round(2))

# week to week
o["wk"] = ((o.day_date - pd.Timestamp("2026-01-01")).dt.days // 7) + 1
w = o.groupby("wk").agg(d=("shift_demand_units", "sum"), s=("scheduled_labor_hours", "sum"))
print(w)
# dept week
wd = o.groupby(["department_group", "wk"]).agg(wl=("wl", "sum"), s=("scheduled_labor_hours", "sum")).unstack(0)
print(wd.round(0))
print("pct change", wd.pct_change().round(3))
# excluding week 1
ow = o[o.wk > 1]
wsd = ow.groupby(["store_id", "dept_id", "wk"]).agg(d=("shift_demand_units", "sum"), s=("scheduled_labor_hours", "sum"))
pc = wsd.groupby(level=[0, 1]).pct_change().dropna()
print("store-dept week-to-week max abs", pc.abs().max().to_dict())
wd2 = ow.groupby(["dept_id", "wk"]).agg(d=("shift_demand_units", "sum"), s=("scheduled_labor_hours", "sum"))
pc2 = wd2.groupby(level=0).pct_change().dropna()
print("dept week-to-week max abs (wk 2+)", pc2.abs().max().to_dict())
print(pc2.round(3))

# Table 3 callouts
o["flu"] = (o.store_id == 2) & (o.dept_id.isin([38, 95])) & (o.day_date >= "2026-01-22") & (o.day_date <= "2026-01-28")
print("callout overall", o.callout_employees.sum(), o.scheduled_employees.sum(), o.callout_employees.sum() / o.scheduled_employees.sum())
print("backfill share", o.backfill_employees.sum() / o.callout_employees.sum())
print("holiday roles", h[h.day_date.dt.day_name() != ""].groupby("holiday_window_role").day_date.unique().apply(lambda a: [str(x)[:10] for x in a]).to_dict())
# day after holiday: find by role
roles = o.holiday_window_role.unique()
print(roles)
o["post"] = o.holiday_window_role.str.contains("Post|Rebound|rebound|After", regex=True)
print(o[o.post].day_date.unique())
for name, sel in [
    ("weekday excl flu & post", (o.is_weekend == 0) & (~o.flu) & (~o.post)),
    ("weekend excl flu & post", (o.is_weekend == 1) & (~o.flu) & (~o.post)),
    ("post excl flu", o.post & ~o.flu),
    ("flu", o.flu),
]:
    s = o[sel]
    r = s.groupby("department_group").agg(c=("callout_employees", "sum"), n=("scheduled_employees", "sum"))
    r["rate"] = r.c / r.n
    print(name, r.round(4).to_dict("index"))

# Day after holiday candidates: Jan 2 and Jan 20
for dd in ["2026-01-02", "2026-01-20"]:
    s = o[o.day_date == dd]
    print(dd, s.holiday_window_role.unique(), s.groupby("department_group").agg(c=("callout_employees", "sum"), n=("scheduled_employees", "sum")).to_dict("index"))
s = o[o.day_date.isin(pd.to_datetime(["2026-01-02", "2026-01-20"]))]
r = s.groupby("department_group").agg(c=("callout_employees", "sum"), n=("scheduled_employees", "sum"))
r["rate"] = r.c / r.n
print("Jan2+Jan20", r)

# Lost people
o["lost"] = o.worked_employees < o.scheduled_employees
print(o.groupby(["department_group", "lost"]).met_target.agg(["mean", "count"]).round(3))
o["cal"] = o.callout_employees > 0
print(o.groupby(["department_group", "cal"]).met_target.agg(["mean", "count"]).round(3))

# Backfill when overtime capacity used up
o["ot_room"] = o.max_overtime_employees - (o.scheduled_employees - o.available_regular_employees).clip(lower=0)
print("callouts/backfills by OT room==0 or less")
for nm, sel in [("room<=0", o.ot_room <= 0), ("room>0", o.ot_room > 0)]:
    s = o[sel]
    print(nm, len(s), s.callout_employees.sum(), s.backfill_employees.sum())
print("sched-beyond-regular & max", (o.scheduled_employees > o.available_regular_employees).sum())
print("worked OT > max OT", (o.worked_overtime_employees > o.max_overtime_employees).sum())

# overtime
print("labor cost", o.labor_cost.sum(), h.labor_cost.sum())
print("OT share hours", o.worked_overtime_hours.sum() / o.worked_labor_hours.sum())
prem = (o.worked_overtime_hours * (o.loaded_overtime_hourly_cost - o.loaded_regular_hourly_cost)).sum()
print("OT premium", prem, prem / o.labor_cost.sum())
print("labor_cost recon", (o.worked_regular_hours * o.loaded_regular_hourly_cost + o.worked_overtime_hours * o.loaded_overtime_hourly_cost).sum())

# Waits level off
o["ratio"] = o.metric_value / o.target_value
print("ratio util>=.97", o[o.util >= .97].groupby("department_group").ratio.agg(["median", "mean", "count"]).round(2))
print("ratio util>=1.05", o[o.util >= 1.05].groupby("department_group").ratio.agg(["median", "mean", "count"]).round(2))
