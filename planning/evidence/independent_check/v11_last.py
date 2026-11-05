import pandas as pd, numpy as np
import statsmodels.formula.api as smf
from alloc import *
pd.set_option("display.width", 220); pd.set_option("display.max_columns", 40); pd.set_option("display.max_rows", 300)
h = pd.read_csv(D + "v_ShiftHistory.csv", parse_dates=["day_date"])
ls = pd.read_csv(D + "comp_LaborStandard.csv")
h = h.merge(ls[["dept_id", "labor_hours_per_workload_unit"]].rename(columns={"labor_hours_per_workload_unit": "std"}), on="dept_id")
o = h[h.is_open == 1].copy()
d = o.groupby(["store_id", "dept_id", "day_date"]).agg(y=("shift_demand_units", "sum"), role=("holiday_window_role", "first")).reset_index()
d["dow"] = d.day_date.dt.day_name().str[:3]; d["wk"] = ((d.day_date - pd.Timestamp("2026-01-01")).dt.days // 7) + 1
d["ly"] = np.log(d.y); d["win"] = d.role.replace({"Normal": "aNormal"})
rows = []
for w in [4, 5, 6]:
    tr = d[d.wk < w]; te = d[d.wk == w].copy()
    mm = smf.ols("ly ~ C(store_id):C(dept_id) + C(dept_id):C(dow) + C(dept_id):C(win) + C(dept_id):C(wk)", tr).fit()
    te["win"] = "aNormal"
    te["m"] = np.exp(np.mean([mm.predict(te.assign(wk=k)).values for k in sorted(tr.wk.unique())[-4:]], axis=0))
    out = []
    win_days = []
    for _, r in te.iterrows():
        q = tr[(tr.store_id == r.store_id) & (tr.dept_id == r.dept_id) & (tr.dow == r.dow)].sort_values("day_date").tail(4)
        out.append(q.y.mean()); win_days.append((q.role != "Normal").sum())
    te["b"] = out; te["hol_in_window"] = win_days
    rows.append(te)
b = pd.concat(rows)
b["em"] = (b.m - b.y).abs() / b.y; b["eb"] = (b.b - b.y).abs() / b.y
b["grp"] = np.where(b.hol_in_window > 0, "bench window holds holiday days", "clean window")
print(b.groupby("grp")[["em", "eb"]].agg(["mean", "size"]).round(4))
print(b.groupby(["wk", "grp"])[["em", "eb"]].mean().round(4))
print(b.groupby("dow")[["em", "eb", "hol_in_window"]].mean().round(4))
print("forecast-vs-benchmark gap on clean days", ((b.m / b.b - 1).abs()[b.hol_in_window == 0]).describe().round(4).to_dict())

# Scheduled vs worked gap in Table 2 blocks
o["wl"] = o.shift_demand_units * o["std"]
o["need"] = np.maximum(o.min_staff, np.ceil(o.wl / .85 / o.paid_hours - 1e-9))
o["gap_w"] = (o.worked_employees - o.need) * o.paid_hours
o["gap_s"] = (o.scheduled_employees - o.need) * o.paid_hours
t = o.groupby(["store_id", "dept_id", "day_type", "shift_code"]).agg(n=("need", "size"), gap_w=("gap_w", "sum"), gap_s=("gap_s", "sum"), util=("wl", "sum"), wh=("worked_labor_hours", "sum"), sh=("scheduled_labor_hours", "sum"))
t["sched_util"] = t.util / t.sh
print(t.sort_values("gap_w").head(6)[["n", "gap_w", "gap_s", "sched_util"]].round(3))
print(t.sort_values("gap_w").tail(5)[["n", "gap_w", "gap_s", "sched_util"]].round(3))
print("overall sched gap", o.gap_s.sum(), "worked gap", o.gap_w.sum())
# Plan utilization vs limits
pv = pd.read_csv(r"C:\MISA Case\outputs\plan_vs_draft.csv")
sl = pd.read_csv(r"C:\MISA Case\outputs\service_limits.csv")
op = pv[pv.is_open == 1].merge(sl, on=["store_id", "dept_id"])
print("not flagged and util >= u95", ((op.below_service_goal != True) & (op.planned_utilization >= op.u95)).groupby(op.scenario_code).sum().to_dict())
print("flagged share", op.groupby("scenario_code").below_service_goal.sum().to_dict())
# Rx Feb 17 flagged at weekday callout rate 2.9%
from math import comb
for nm, n, u in [("W1 EVE", 5, .553), ("W1 OPEN", 4, .734), ("W4 MID", 6, .603)]:
    for rate in [.1098, .029]:
        # max callouts tolerated keeping util <= ~.85; no OT left to backfill at capacity
        p = sum(comb(n, c) * rate ** c * (1 - rate) ** (n - c) for c in range(n + 1) if u * n / (n - c or 1) <= .86)
        print(nm, rate, round(p, 3))
