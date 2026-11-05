import pandas as pd, numpy as np
import statsmodels.formula.api as smf
from scipy.optimize import minimize
from scipy.special import expit
from alloc import *
pd.set_option("display.width", 220); pd.set_option("display.max_columns", 40); pd.set_option("display.max_rows", 300)
rng = np.random.default_rng(7)
h = pd.read_csv(D + "v_ShiftHistory.csv", parse_dates=["day_date"])
ls = pd.read_csv(D + "comp_LaborStandard.csv")
h = h.merge(ls[["dept_id", "labor_hours_per_workload_unit"]], on="dept_id")
h = h.rename(columns={"labor_hours_per_workload_unit": "std"})
o = h[h.is_open == 1].copy()
o["util"] = o.shift_demand_units * o["std"] / o.worked_labor_hours
o["wk"] = ((o.day_date - pd.Timestamp("2026-01-01")).dt.days // 7) + 1

# ---------- Service model A: logistic on util per dept; Model B: per store x dept, shrunk slopes per dept
def fit_logit(x, y, X_extra=None, lam=1e-3):
    # X_extra design matrix includes intercept(s) ; slope on util appended
    A = np.column_stack([X_extra, x])
    def nll(b):
        z = A @ b
        return (np.logaddexp(0, z) - y * z).sum() + lam * (b ** 2).sum()
    def gr(b):
        p = expit(A @ b)
        return A.T @ (p - y) + 2 * lam * b
    r = minimize(nll, np.zeros(A.shape[1]), jac=gr, method="BFGS", options={"maxiter": 2000})
    return r.x

models = {}
for dep, q in o.groupby("dept_id"):
    # A: common intercept
    b = fit_logit(q.util.values, q.met_target.values, np.ones((len(q), 1)))
    models[("A", dep)] = b
    # B: store intercepts, common slope
    stores = sorted(q.store_id.unique())
    Xs = np.column_stack([(q.store_id == s).astype(float).values for s in stores])
    b2 = fit_logit(q.util.values, q.met_target.values, Xs)
    models[("B", dep)] = (stores, b2)
    print(dep, "A intercept/slope", b.round(2), "u50", round(-b[0] / b[1], 3), "u95", round((np.log(19) - b[0]) / b[1], 3), "| B u95 by store", [(s, round((np.log(19) - b2[i]) / b2[-1], 3)) for i, s in enumerate(stores)])


def p_met(model, store, dept, util):
    util = np.asarray(util, float)
    if model == "A":
        b = models[("A", dept)]
        return expit(b[0] + b[1] * util)
    stores, b = models[("B", dept)]
    return expit(b[stores.index(store)] + b[-1] * util)


# LOWO Brier for model B
br = []
for w in range(1, 7):
    tr, te = o[o.wk != w], o[o.wk == w]
    for dep in [38, 92, 95]:
        q = tr[tr.dept_id == dep]; t = te[te.dept_id == dep]
        stores = sorted(q.store_id.unique())
        Xs = np.column_stack([(q.store_id == s).astype(float).values for s in stores])
        bb = fit_logit(q.util.values, q.met_target.values, Xs)
        Xt = np.column_stack([(t.store_id == s).astype(float).values for s in stores])
        pp = expit(Xt @ bb[:-1] + bb[-1] * t.util.values)
        base = tr.met_target.mean()
        br.append(pd.DataFrame({"p": pp, "y": t.met_target.values, "b": base}))
br = pd.concat(br)
print("LOWO Brier model B", ((br.p - br.y) ** 2).mean(), "base rate", ((br.b - br.y) ** 2).mean())
bins = pd.cut(br.p, [0, .5, .8, .95, .99, 1.0])
print(br.groupby(bins).agg(n=("y", "size"), pred=("p", "mean"), act=("y", "mean")).round(3))

# ---------- Demand: own log-linear forecast
d = o.groupby(["store_id", "dept_id", "day_date"]).agg(y=("shift_demand_units", "sum"), role=("holiday_window_role", "first")).reset_index()
d["dow"] = d.day_date.dt.day_name().str[:3]
d["wk"] = ((d.day_date - pd.Timestamp("2026-01-01")).dt.days // 7) + 1
d["ly"] = np.log(d.y)
d["win"] = d.role.replace({"Normal": "aNormal"})
m = smf.ols("ly ~ C(store_id):C(dept_id) + C(dept_id):C(dow) + C(dept_id):C(win) + C(dept_id):C(wk)", d).fit()
g = load_grid()
days = g[["store_id", "dept_id", "day_date", "holiday_window_role"]].drop_duplicates().copy()
days["dow"] = days.day_date.dt.day_name().str[:3]
days["win"] = days.holiday_window_role.map({"Normal": "aNormal", "Pre_Presidents_Day_Weekend": "Pre_MLK_Weekend", "Presidents_Day_Holiday": "MLK_Holiday"}).fillna("aNormal")
pr = []
for w in [3, 4, 5, 6]:
    x = days.copy(); x["wk"] = w
    pr.append(m.predict(x).values)
days["fc_day"] = np.exp(np.mean(pr, axis=0))
days.loc[(days.day_date == "2026-02-14") & (days.dept_id.isin([38, 92])), "fc_day"] *= 1.03
# Pharmacy Sat/Sun: exist in grid even when closed block; fine
# ---------- shift share: dept x day_type x shift x window flag
o["win_flag"] = o.holiday_window_role.isin(["Pre_MLK_Weekend", "MLK_Holiday", "Post_New_Year_Rebound"]).astype(int)
shares = o.groupby(["dept_id", "day_type", "win_flag", "shift_code"]).shift_share_of_day.mean().reset_index().rename(columns={"shift_share_of_day": "sh"})
print(shares.pivot_table(index=["dept_id", "day_type", "win_flag"], columns="shift_code", values="sh").round(3))
g["win_flag"] = g.holiday_window_role.isin(["Pre_Presidents_Day_Weekend", "Presidents_Day_Holiday"]).astype(int)
g = g.merge(days[["store_id", "dept_id", "day_date", "fc_day"]], on=["store_id", "dept_id", "day_date"], how="left")
g = g.merge(shares, on=["dept_id", "day_type", "win_flag", "shift_code"], how="left")
g["sh"] = g.sh.fillna(0)
g = g.merge(ls[["dept_id", "labor_hours_per_workload_unit"]].rename(columns={"labor_hours_per_workload_unit": "std"}), on="dept_id")
g["dem"] = g.fc_day * g.sh * g.demand_multiplier
g["wl"] = g.dem * g["std"]

fl = pd.read_csv(r"C:\MISA Case\outputs\TEAM_SUBMISSION_TEMPLATE_filled.csv", parse_dates=["day_date"])[KEYS + ["submitted_employees"]]
g = g.merge(fl, on=KEYS)
ap = allocate(g, "submitted_employees")
ad = allocate(g, "draft_scheduled_employees")

# ---------- Callout rates
flu = (o.store_id == 2) & (o.dept_id.isin([38, 95])) & (o.day_date >= "2026-01-22") & (o.day_date <= "2026-01-28")
wkdy = o[(o.is_weekend == 0) & ~flu & ~o.day_date.isin(pd.to_datetime(["2026-01-02", "2026-01-20"]))]
wknd = o[(o.is_weekend == 1) & ~flu]
r_wd = (wkdy.groupby("dept_id").callout_employees.sum() / wkdy.groupby("dept_id").scheduled_employees.sum()).to_dict()
r_we = (wknd.groupby("dept_id").callout_employees.sum() / wknd.groupby("dept_id").scheduled_employees.sum()).to_dict()
r_flu = {38: .123, 95: .107}
post = o[o.day_date.isin(pd.to_datetime(["2026-01-02", "2026-01-20"]))]
r_post = (post.groupby("dept_id").callout_employees.sum() / post.groupby("dept_id").scheduled_employees.sum()).to_dict()
print("rates", r_wd, r_we, r_post)


def cal_rate(row):
    if row.scenario_code == "DISRUPT" and row.store_id == 2 and row.dept_id in r_flu and pd.Timestamp("2026-02-13") <= row.day_date <= pd.Timestamp("2026-02-16"):
        return r_flu[row.dept_id]
    if row.day_date == pd.Timestamp("2026-02-17"):
        return r_post[row.dept_id]
    return (r_we if row.is_weekend == 1 else r_wd)[row.dept_id]


def sim(a, model="B", demand_sd=True, callouts=True, draws=4000, extra={38: .02, 92: .02, 95: .05}, base_sd=0.05):
    out = []
    a = a[a.is_open == 1]
    for row in a.itertuples():
        n = int(row.fielded)
        ph = row.paid_hours
        wl = row.wl
        if demand_sd:
            sd = base_sd
            if pd.Timestamp("2026-02-13") <= row.day_date <= pd.Timestamp("2026-02-16"):
                sd = np.sqrt(sd ** 2 + extra[row.dept_id] ** 2)
            dm = np.exp(rng.normal(0, sd, draws))
        else:
            dm = np.ones(draws)
        if callouts:
            rate = cal_rate(row)
            c = rng.binomial(n, rate, draws)
            room = max(row.max_overtime_employees - row.ot, 0)
            bf = np.minimum(rng.binomial(c, .5), room)
            w = n - c + bf
        else:
            w = np.full(draws, n)
        w = np.maximum(w, 1)
        u = wl * dm / (w * ph)
        p = p_met(model, row.store_id, row.dept_id, u)
        out.append(p.mean())
    r = a[KEYS + ["scenario_code", "department_group", "fielded", "capacity", "wl", "paid_hours", "submitted_employees", "draft_scheduled_employees", "available_regular_employees", "max_overtime_employees", "reg", "flex", "ot", "usable_flex"]].copy()
    r["p"] = out
    return r


res = {}
for model in ["A", "B"]:
    for nm, A in [("plan", ap), ("draft", ad)]:
        for cond, (ds, co) in {"both": (True, True), "fc_only": (True, False), "neither": (False, False)}.items():
            r = sim(A, model=model, demand_sd=ds, callouts=co, draws=1500)
            res[(model, nm, cond)] = r
            t = r.groupby("scenario_code").p.mean()
            print(model, nm, cond, t.round(3).to_dict())
rB = res[("B", "plan", "both")]
print("B plan both by dept BASE", rB[rB.scenario_code == "BASE"].groupby("department_group").p.mean().round(3).to_dict())
rD = res[("B", "draft", "both")]
print("B draft both by dept BASE", rD[rD.scenario_code == "BASE"].groupby("department_group").p.mean().round(3).to_dict())
print("below .95 plan (both, B)", (rB.p < .95).groupby(rB.scenario_code).sum().to_dict())
x = rB[rB.p < .95]
print(x.groupby(["scenario_code", "day_date"]).size().unstack(0))
rB.to_csv("plan_both_B.csv", index=False)
rD.to_csv("draft_both_B.csv", index=False)
# Feb 14 FE+Merch BASE
f14 = rB[(rB.scenario_code == "BASE") & (rB.day_date == "2026-02-14") & (rB.dept_id.isin([38, 92]))]
print("Feb 14 FE+Merch plan service (both) BASE", f14.p.mean(), "n", len(f14), "at capacity", (f14.submitted_employees >= f14.capacity).sum())
for up in [1 / 1.03, 1.0, 1.05 / 1.03, 1.10 / 1.03]:
    a2 = ap.copy()
    sel = (a2.day_date == "2026-02-14") & (a2.dept_id.isin([38, 92]))
    a2.loc[sel, "wl"] = a2.loc[sel, "wl"] * up
    r = sim(a2[sel & (a2.scenario_code == "BASE")], model="B", draws=3000)
    print("uplift factor", round(up * 1.03 - 1, 3), "plan service Feb14", round(r.p.mean(), 3))
# Sanity: utilization
ap2 = ap[ap.is_open == 1].copy(); ap2["u"] = ap2.wl / (ap2.fielded * ap2.paid_hours)
ad2 = ad[ad.is_open == 1].copy(); ad2["u"] = ad2.wl / (ad2.fielded * ad2.paid_hours)
print("plan util stats", ap2.groupby("scenario_code").u.describe().round(3))
print("draft util stats", ad2.groupby("scenario_code").u.describe().round(3))
print("share of blocks util>.85 plan", (ap2.u > .85).groupby(ap2.scenario_code).mean().round(3).to_dict(), "draft", (ad2.u > .85).groupby(ad2.scenario_code).mean().round(3).to_dict())
print("share of blocks util>.90 plan", (ap2.u > .90).groupby(ap2.scenario_code).mean().round(3).to_dict(), "draft", (ad2.u > .90).groupby(ad2.scenario_code).mean().round(3).to_dict())

# Quick independent 'Neither' plan: min headcount s.t. p>=.95 at forecast, within capacity (ignoring flex interplay: reg + flex_figure cap)
base = ap[(ap.scenario_code == "BASE") & (ap.is_open == 1)].copy()
ch = []
for row in base.itertuples():
    cap = int(row.available_regular_employees + row.cross_trained_flex_employees + row.max_overtime_employees)
    nn = row.min_staff
    while nn < cap and p_met("B", row.store_id, row.dept_id, row.wl / (nn * row.paid_hours)) < .95:
        nn += 1
    ch.append(nn)
base["neither_n"] = ch
b2 = allocate(base, "neither_n")
print("my 'Neither' plan cost", b2.cost.sum(), "hours", b2.hours.sum(), "over capacity", (b2.short > 0).sum())
g2 = load_grid()
print("Feb 14 fields", g2[(g2.scenario_id == 1) & (g2.store_id == 1) & (g2.dept_id == 38) & (g2.shift_code == "OPEN")][["day_date", "is_holiday", "holiday_name", "holiday_window_role", "is_pre_holiday_stockup", "is_post_holiday_rebound", "has_promotion", "promotion_index", "temperature"]])
