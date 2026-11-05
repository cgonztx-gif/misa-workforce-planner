import pandas as pd, numpy as np
import statsmodels.formula.api as smf
from alloc import *
pd.set_option("display.width", 220); pd.set_option("display.max_columns", 40); pd.set_option("display.max_rows", 300)
h = pd.read_csv(D + "v_ShiftHistory.csv", parse_dates=["day_date"])
o = h[h.is_open == 1].copy()
d = o.groupby(["store_id", "dept_id", "day_date"]).agg(y=("shift_demand_units", "sum"), role=("holiday_window_role", "first")).reset_index()
d["dow"] = d.day_date.dt.day_name().str[:3]
d["wk"] = ((d.day_date - pd.Timestamp("2026-01-01")).dt.days // 7) + 1
d["ly"] = np.log(d.y)
d["win"] = d.role.replace({"Normal": "aNormal"})
d["jan20"] = (d.day_date == "2026-01-20").astype(int)
f = "ly ~ C(store_id):C(dept_id) + C(dept_id):C(dow) + C(dept_id):C(win) + C(dept_id):C(wk)"
m = smf.ols(f, d).fit()
print("residual sd", np.sqrt(m.scale), "max abs", m.resid.abs().max())
# factors re-normal
def fac(m):
    for dep in [38, 92, 95]:
        n = m.params.get(f"C(dept_id)[{dep}]:C(win)[T.aNormal]")
        ml = m.params.get(f"C(dept_id)[{dep}]:C(win)[T.Pre_MLK_Weekend]")
        nw = m.params.get(f"C(dept_id)[{dep}]:C(win)[T.Post_New_Year_Rebound]")
        print(dep, "preMLK", round(np.exp(ml - n), 3), "MLK day", round(np.exp(-n), 3), "NY rebound", round(np.exp(nw - n), 3))
fac(m)
# Jan 20 effect
m2 = smf.ols(f + " + C(dept_id):jan20", d).fit()
print("Jan 20 effect", {k: round(np.exp(v) - 1, 4) for k, v in m2.params.items() if "jan20" in k})
m3 = smf.ols(f + " + jan20", d).fit()
print("Jan 20 pooled", np.exp(m3.params["jan20"]) - 1, "se", m3.bse["jan20"])
# simple descriptive: Jan 20 vs Tue norm rel. to Jan 15 & Jan 21 same-week vs Tue/Thu/Wed of other weeks
pv = d.pivot_table(index=["store_id", "dept_id"], columns="day_date", values="y")
for w in pd.to_datetime(["2026-01-13", "2026-01-20", "2026-01-27", "2026-02-03", "2026-02-10"]):
    ratio = pv[w] / (0.5 * (pv[w - pd.Timedelta(days=5)] + pv[w + pd.Timedelta(days=1)]))
    print(w.date(), "Tue/(Thu,Wed same wk) mean", round(ratio.mean(), 4))

# T6 with week FE
tr = d[d.wk <= 2].copy()
te = d[d.day_date.isin(pd.to_datetime(["2026-01-16", "2026-01-17", "2026-01-18"]))].copy()
fw = "ly ~ C(store_id):C(dept_id) + C(dept_id):C(dow) + C(dept_id):C(win) + C(dept_id):C(wk)"
mt = smf.ols(fw, tr).fit()
print("T6 params hol", {k: round(np.exp(v), 3) for k, v in mt.params.items() if "win" in k})
preds = []
for w in [1, 2]:
    x = te.copy(); x["wk"] = w; x["win"] = "Post_New_Year_Rebound"
    preds.append(mt.predict(x).values)
te["m"] = np.exp(np.mean(preds, axis=0))
preds2 = []
x = te.copy(); x["wk"] = 2; x["win"] = "Post_New_Year_Rebound"
te["m2"] = np.exp(mt.predict(x).values)
def bench(train, test):
    out = []
    for _, row in test.iterrows():
        t = train[(train.store_id == row.store_id) & (train.dept_id == row.dept_id) & (train.dow == row.dow)].sort_values("day_date").tail(4)
        out.append(t.y.mean())
    return np.array(out)
te["b"] = bench(tr, te)
for nm in ["m", "m2", "b"]:
    te["e" + nm] = (te[nm] - te.y).abs() / te.y
print("T6 all", te[["em", "em2", "eb"]].mean().round(4).to_dict())
print(te.groupby("dept_id")[["em", "em2", "eb"]].mean().round(4))

# Block error with normal-day shares only
for w in [4, 5, 6]:
    pass
d["ok"] = 1

# correlations
print("temp-corr raw vs demand", o.groupby(["store_id", "dept_id", "day_date"]).agg(y=("shift_demand_units", "sum"), t=("temperature", "first"), p=("has_promotion", "first")).pipe(lambda s: (s.y.corr(s.t), s.y.corr(s.p))))

# Service limits and WH1 pharmacy
ls = pd.read_csv(D + "comp_LaborStandard.csv")
o = o.merge(ls[["dept_id", "labor_hours_per_workload_unit"]], on="dept_id")
o["util"] = o.shift_demand_units * o.labor_hours_per_workload_unit / o.worked_labor_hours
w1p = o[(o.store_id == 1) & (o.dept_id == 95)]
print("WH1 Rx blocks in .85-.95", ((w1p.util >= .85) & (w1p.util < .95)).sum(), "of", len(w1p), "max util", w1p.util.max())
print(w1p[w1p.util >= .8][["util", "metric_value", "met_target"]].sort_values("util").round(3).to_string())
# Fit per store x dept log-wait model: log(metric/target) ~ bs(util) simple: empirical
import statsmodels.api as sm
for (s, de), q in o.groupby(["store_id", "dept_id"]):
    # logistic with util
    X = sm.add_constant(q.util)
    try:
        l = sm.Logit(q.met_target, X).fit(disp=0, maxiter=200)
        u95 = (np.log(.95 / .05) - l.params["const"]) / l.params["util"]
        u50 = (0 - l.params["const"]) / l.params["util"]
    except Exception as e:
        u95 = u50 = np.nan
    # wait-based: fit local linear log(ratio) near .85-.95: threshold
    q2 = q[(q.util > .78) & (q.util < .95)]
    lr = np.polyfit(q2.util, np.log(q2.metric_value / q2.target_value), 1) if len(q2) > 5 else [np.nan, np.nan]
    res = np.log(q2.metric_value / q2.target_value) - np.polyval(lr, q2.util) if len(q2) > 5 else pd.Series([np.nan])
    z = 1.645
    ur = (-z * res.std() - lr[1]) / lr[0] if len(q2) > 5 else np.nan
    print(s, de, "n", len(q), "logit u95", round(u95, 3), "u50", round(u50, 3), "wait-curve u at p95", round(ur, 3), "n near", len(q2))

# Callout stats for plan: any blocks? DISRUPT etc handled in v6
