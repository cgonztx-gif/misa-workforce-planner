import pandas as pd, numpy as np
pd.set_option("display.width", 220); pd.set_option("display.max_columns", 40); pd.set_option("display.max_rows", 200)
D = r"C:\MISA Case\data\team_distribution\csv\\"
h = pd.read_csv(D + "v_ShiftHistory.csv", parse_dates=["day_date"])
ls = pd.read_csv(D + "comp_LaborStandard.csv")
lc = pd.read_csv(D + "comp_LaborCostAssumption.csv")
h = h.merge(ls[["dept_id", "labor_hours_per_workload_unit"]], on="dept_id")
h = h.merge(lc[["store_id", "dept_id", "loaded_regular_hourly_cost", "loaded_overtime_hourly_cost"]], on=["store_id", "dept_id"])
o = h[h.is_open == 1].copy()
o["wl"] = o.shift_demand_units * o.labor_hours_per_workload_unit
o["util"] = o.wl / o.worked_labor_hours
o["need_emp"] = np.maximum(o.min_staff, np.ceil(o.wl / .85 / o.paid_hours - 1e-9))
o["gap_emp"] = o.worked_employees - o.need_emp
o["gap_h"] = o.gap_emp * o.paid_hours
o["over_h"] = o.gap_emp.clip(lower=0) * o.paid_hours
o["under_h"] = (-o.gap_emp).clip(lower=0) * o.paid_hours
o["need_hours"] = o.need_emp * o.paid_hours
o["val"] = o.over_h * o.loaded_regular_hourly_cost
print(o.groupby("department_group")[["worked_labor_hours", "need_hours", "over_h", "under_h", "val"]].sum())
g = o.groupby(["store_id", "dept_id", "day_type", "shift_code"]).agg(
    n=("util", "size"), util=("util", "mean"), met=("met_target", "mean"), gap=("gap_h", "sum"),
    over=("over_h", "sum"), under=("under_h", "sum"), wl=("wl", "sum"), wk=("worked_labor_hours", "sum"))
g["pool"] = g.wl / g.wk
print(g.sort_values("gap")[["n", "util", "pool", "met", "gap", "over", "under"]].head(9).round(3))
print(g.sort_values("gap")[["n", "util", "pool", "met", "gap", "over", "under"]].tail(9).round(3))

o["wk"] = ((o.day_date - pd.Timestamp("2026-01-01")).dt.days // 7) + 1
t = o.groupby("wk").agg(wl=("wl", "sum"), s=("scheduled_labor_hours", "sum"))
t["wl_pct"] = t.wl.pct_change(); t["s_pct"] = t.s.pct_change()
print(t.round(3))
# dept
td = o.groupby(["dept_id", "wk"]).agg(wl=("wl", "sum"), s=("scheduled_labor_hours", "sum"))
print(td.groupby(level=0).pct_change().round(3))
# deviation from mean of weeks 2-6
tt = t.loc[2:]
print("weekly level range around avg, wk2-6:", (tt.wl / tt.wl.mean() - 1).round(3).to_dict(), (tt.s / tt.s.mean() - 1).round(3).to_dict())
print("dept level", td.loc[(slice(None), slice(2, 6)), :].groupby(level=0).apply(lambda d: (d / d.mean() - 1).round(3)))

# Callouts
flu = (o.store_id == 2) & (o.dept_id.isin([38, 95])) & (o.day_date >= "2026-01-22") & (o.day_date <= "2026-01-28")
dah = o.day_date.isin(pd.to_datetime(["2026-01-02", "2026-01-20"]))
for name, sel in [("weekdays (excl flu, day-after)", (o.is_weekend == 0) & ~flu & ~dah),
                  ("weekends (excl flu)", (o.is_weekend == 1) & ~flu),
                  ("day-after", dah & ~flu), ("flu", flu)]:
    r = o[sel].groupby("dept_id").agg(c=("callout_employees", "sum"), n=("scheduled_employees", "sum"))
    r["rate"] = (r.c / r.n).round(4)
    print(name, r.to_dict("index"))
# check flu notes
print(o[o.availability_note.notna()].groupby("availability_note").agg(d0=("day_date", "min"), d1=("day_date", "max"), n=("day_date", "size")))
print(o[o.availability_note.notna()].groupby(["availability_note", "store_id", "dept_id"]).day_date.agg(["min", "max", "size"]))
# flu by date
z = o[(o.store_id == 2) & (o.dept_id.isin([38, 92, 95])) & (o.day_date >= "2026-01-15") & (o.day_date <= "2026-02-05")]
print(z.groupby(["day_date", "dept_id"]).apply(lambda s: round(s.callout_employees.sum() / s.scheduled_employees.sum(), 3)).unstack())
# weekday pharmacies
print("Pharm weekend sched", o[(o.dept_id == 95) & (o.is_weekend == 1)].groupby("day_type").scheduled_employees.sum().to_dict())
print("Weekend Pharm callouts", o[(o.dept_id == 95) & (o.is_weekend == 1)].groupby(["day_date"])[["callout_employees", "scheduled_employees"]].sum())

# Jan 20 vs own week
daily = o.groupby(["store_id", "dept_id", "day_date"]).shift_demand_units.sum().reset_index()
daily["dow"] = daily.day_date.dt.dayofweek
print("Jan 20 vs own week: see v3")
# Correlations of temp/promotion
