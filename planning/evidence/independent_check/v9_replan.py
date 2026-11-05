"""Own rough rebuild of the plan: per-store-dept logistic + own forecast, minimal headcount for goal, three risk settings."""
import pandas as pd, numpy as np
import statsmodels.formula.api as smf
from scipy.optimize import minimize
from scipy.special import expit
from alloc import *
pd.set_option("display.width", 220); pd.set_option("display.max_columns", 40); pd.set_option("display.max_rows", 300)
rng = np.random.default_rng(11)
h = pd.read_csv(D + "v_ShiftHistory.csv", parse_dates=["day_date"])
ls = pd.read_csv(D + "comp_LaborStandard.csv")
h = h.merge(ls[["dept_id", "labor_hours_per_workload_unit"]].rename(columns={"labor_hours_per_workload_unit": "std"}), on="dept_id")
o = h[h.is_open == 1].copy()
o["util"] = o.shift_demand_units * o["std"] / o.worked_labor_hours
# Service model: log(metric/target) = store-dept curve via Gaussian: use logistic per store x dept
co = {}
for (s, dep), q in o.groupby(["store_id", "dept_id"]):
    A = np.column_stack([np.ones(len(q)), q.util.values])
    y = q.met_target.values
    lam = 1e-7
    f = lambda b: (np.logaddexp(0, A @ b) - y * (A @ b)).sum() + lam * (b ** 2).sum()
    gr = lambda b: A.T @ (expit(A @ b) - y) + 2 * lam * b
    co[(s, dep)] = minimize(f, np.zeros(2), jac=gr, method="BFGS", options={"maxiter": 3000}).x
    print(s, dep, "u95", round((np.log(19) - co[(s, dep)][0]) / co[(s, dep)][1], 3), "slope", round(co[(s, dep)][1], 1))
d = o.groupby(["store_id", "dept_id", "day_date"]).agg(y=("shift_demand_units", "sum"), role=("holiday_window_role", "first")).reset_index()
d["dow"] = d.day_date.dt.day_name().str[:3]; d["wk"] = ((d.day_date - pd.Timestamp("2026-01-01")).dt.days // 7) + 1
d["ly"] = np.log(d.y); d["win"] = d.role.replace({"Normal": "aNormal"})
m = smf.ols("ly ~ C(store_id):C(dept_id) + C(dept_id):C(dow) + C(dept_id):C(win) + C(dept_id):C(wk)", d).fit()
g = load_grid()
days = g[["store_id", "dept_id", "day_date", "holiday_window_role"]].drop_duplicates().copy()
days["dow"] = days.day_date.dt.day_name().str[:3]
days["win"] = days.holiday_window_role.map({"Normal": "aNormal", "Pre_Presidents_Day_Weekend": "Pre_MLK_Weekend", "Presidents_Day_Holiday": "MLK_Holiday"}).fillna("aNormal")
pr = [m.predict(days.assign(wk=w)).values for w in [3, 4, 5, 6]]
days["fc_day"] = np.exp(np.mean(pr, axis=0))
days.loc[(days.day_date == "2026-02-14") & (days.dept_id.isin([38, 92])), "fc_day"] *= 1.03
o["win_flag"] = o.holiday_window_role.isin(["Pre_MLK_Weekend", "MLK_Holiday", "Post_New_Year_Rebound"]).astype(int)
sh = o.groupby(["dept_id", "day_type", "win_flag", "shift_code"]).shift_share_of_day.mean().reset_index().rename(columns={"shift_share_of_day": "sh"})
g["win_flag"] = g.holiday_window_role.isin(["Pre_Presidents_Day_Weekend", "Presidents_Day_Holiday"]).astype(int)
g = g.merge(days[["store_id", "dept_id", "day_date", "fc_day"]], on=["store_id", "dept_id", "day_date"], how="left").merge(sh, on=["dept_id", "day_type", "win_flag", "shift_code"], how="left")
g["sh"] = g.sh.fillna(0)
g = g.merge(ls[["dept_id", "labor_hours_per_workload_unit"]].rename(columns={"labor_hours_per_workload_unit": "std"}), on="dept_id")
g["wl"] = g.fc_day * g.sh * g.demand_multiplier * g["std"]
flu = (o.store_id == 2) & (o.dept_id.isin([38, 95])) & (o.day_date >= "2026-01-22") & (o.day_date <= "2026-01-28")
post_d = pd.to_datetime(["2026-01-02", "2026-01-20"])
wd = o[(o.is_weekend == 0) & ~flu & ~o.day_date.isin(post_d)]; we = o[(o.is_weekend == 1) & ~flu]; po = o[o.day_date.isin(post_d)]
rt = lambda s: (s.groupby("dept_id").callout_employees.sum() / s.groupby("dept_id").scheduled_employees.sum()).to_dict()
r_wd, r_we, r_po = rt(wd), rt(we), rt(po)
r_flu = {38: .123, 95: .107}


def rate(r):
    if r.scenario_code == "DISRUPT" and r.store_id == 2 and r.dept_id in r_flu and pd.Timestamp("2026-02-13") <= r.day_date <= pd.Timestamp("2026-02-16"):
        return r_flu[r.dept_id]
    if r.day_date == pd.Timestamp("2026-02-17"):
        return r_po[r.dept_id]
    return (r_we if r.is_weekend == 1 else r_wd)[r.dept_id]


DR = 1500
extra = {38: .02, 92: .02, 95: .05}


def pblock(r, n, ds, cl, ot_used, zd, unif1, unif2):
    if n <= 0:
        return 0.
    sd = 0.0557
    if pd.Timestamp("2026-02-13") <= r.day_date <= pd.Timestamp("2026-02-16"):
        sd = np.sqrt(sd ** 2 + extra[r.dept_id] ** 2)
    dm = np.exp(zd * sd) if ds else 1.0
    if cl:
        c = rng.binomial(n, rate(r), DR)
        bf = np.minimum(rng.binomial(c, .5), max(r.max_overtime_employees - ot_used, 0))
        w = np.maximum(n - c + bf, 1)
    else:
        w = n
    u = r.wl * dm / (w * r.paid_hours)
    b = co[(r.store_id, r.dept_id)]
    return float(expit(b[0] + b[1] * u).mean())


def plan(scen, goal, ds, cl):
    b = g[(g.scenario_code == scen) & (g.is_open == 1)].copy()
    zd = rng.standard_normal(DR)
    ns, shorts = [], []
    for r in b.itertuples():
        hard = int(r.available_regular_employees + r.cross_trained_flex_employees + r.max_overtime_employees)
        n = int(r.min_staff)
        short = 0
        while True:
            ot = max(n - r.available_regular_employees - r.cross_trained_flex_employees, 0)
            p = pblock(r, n, ds, cl, ot, zd, None, None)
            if p >= goal:
                break
            n += 1
            if n > hard + 80:
                break
        need = n
        ns.append(need)
    b["need"] = ns
    # resolve flex: partner spare
    b["n"] = b.need
    # cap by own reg + OT first, then flex if partner has spare (one pass)
    b["own_cap"] = b.available_regular_employees + b.max_overtime_employees
    k = ["store_id", "day_date", "shift_code"]
    pa = b[b.dept_id.isin([38, 92])][k + ["dept_id", "available_regular_employees", "need"]].copy()
    pa["dept_id"] = pa.dept_id.map({38: 92, 92: 38})
    pa = pa.rename(columns={"available_regular_employees": "pav", "need": "pneed"})
    b = b.merge(pa, on=k + ["dept_id"], how="left")
    b["spare"] = (b.pav.fillna(0) - b.pneed.fillna(0)).clip(lower=0)
    b["cap"] = b.own_cap + np.minimum(b.cross_trained_flex_employees, b.spare)
    b["n"] = np.minimum(b.need, b.cap)
    b["n"] = np.maximum(b.n, b.min_staff)
    gg = allocate(g[g.scenario_code == scen].merge(b[KEYS + ["n"]], on=KEYS, how="left").fillna({"n": 0}), "n")
    gg = gg[gg.is_open == 1]
    short = (b.need - b.n).clip(lower=0)
    return dict(scen=scen, goal=goal, ds=ds, cl=cl, cost=round(gg.cost.sum()), hours=gg.hours.sum(), over=int((gg.short > 0).sum()), blocks_short=int((short > 0).sum()), people_short=int(short.sum())), b.assign(short_p=short)


rows = []
for scen, goal, ds, cl in [("BASE", .95, False, False), ("BASE", .95, True, False), ("BASE", .95, True, True), ("BASE", .90, True, True), ("BASE", .85, True, True), ("BASE", .99, True, True), ("PEAK", .95, True, True), ("DISRUPT", .95, True, True)]:
    r, b = plan(scen, goal, ds, cl)
    rows.append(r)
    print(r)
    if goal == .95 and ds and cl:
        print(b.groupby("day_date").agg(p=("short_p", "sum"), bl=("short_p", lambda s: (s > 0).sum())).T.to_string())
print(pd.DataFrame(rows))
