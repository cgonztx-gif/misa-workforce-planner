import pandas as pd, numpy as np
import statsmodels.formula.api as smf
pd.set_option("display.width", 220); pd.set_option("display.max_columns", 40); pd.set_option("display.max_rows", 200)
D = r"C:\MISA Case\data\team_distribution\csv\\"
h = pd.read_csv(D + "v_ShiftHistory.csv", parse_dates=["day_date"])
o = h[h.is_open == 1].copy()
d = o.groupby(["store_id", "dept_id", "day_date"]).agg(y=("shift_demand_units", "sum"), daily=("daily_demand_units", "first"), role=("holiday_window_role", "first"), temp=("temperature", "first"), promo=("has_promotion", "first")).reset_index()
print("diff shift sum vs daily", (d.y - d.daily).abs().max())
d["dow"] = d.day_date.dt.day_name().str[:3]
d["wk"] = ((d.day_date - pd.Timestamp("2026-01-01")).dt.days // 7) + 1
d["ly"] = np.log(d.y)
d["win"] = d.role.replace({"Normal": "aNormal"})
print(d.groupby("role").day_date.unique().apply(lambda a: sorted(str(x)[:10] for x in a)))
print("window by date check: Jan 20 role", d[d.day_date == "2026-01-20"].role.unique())

f = "ly ~ C(store_id):C(dept_id) + C(dept_id):C(dow) + C(dept_id):C(win) + C(dept_id):C(wk)"
m = smf.ols(f, d).fit()
print("R2 full", m.rsquared, "n", len(d), "k", m.df_model)
hp = m.params[[p for p in m.params.index if "win" in p]]
print(np.exp(hp).round(3))

# R2 components
m0 = smf.ols("ly ~ C(store_id):C(dept_id) + C(dept_id):C(dow)", d).fit()
m1 = smf.ols("ly ~ C(store_id):C(dept_id) + C(dept_id):C(dow) + C(dept_id):C(win)", d).fit()
print("R2 wh+wd", m0.rsquared, "+hol", m1.rsquared, "+wk", m.rsquared)
# without New Year rebound separately
d2 = d.copy()
d2["win2"] = d2.win.replace({"Post_New_Year_Rebound": "aNormal"})
m1b = smf.ols("ly ~ C(store_id):C(dept_id) + C(dept_id):C(dow) + C(dept_id):C(win2)", d2).fit()
print("R2 hol only MLK", m1b.rsquared)
# levels
ml0 = smf.ols("y ~ C(store_id):C(dept_id) + C(dept_id):C(dow)", d).fit()
print("R2 level scale wh+wd", ml0.rsquared)
# within dept residual correlations with temp, promo
d["res"] = m0.resid
print("corr resid temp", d.res.corr(d.temp), "promo", d.res.corr(d.promo))
print("corr full resid temp", m.resid.corr(d.temp), "promo", m.resid.corr(d.promo))
print("promo variation", d.promo.describe().to_dict())
for dep, s in d.groupby("dept_id"):
    print(dep, "res-temp", round(s.res.corr(s.temp), 3), "res-promo", round(s.res.corr(s.promo), 3))

# Jan 20 vs own week: residual in model with wk and no flag
res = d.assign(res_full=m.resid)
print("Jan 20 residual by dept", res[res.day_date == "2026-01-20"].groupby("dept_id").res_full.mean().round(4).to_dict(), "all", round(res[res.day_date == "2026-01-20"].res_full.mean(), 4))
# aggregated Jan 20 vs dow expectation (model w/out week)
print("Jan 20 m1 resid", res.assign(r1=m1.resid)[res.day_date == "2026-01-20"].r1.mean())

# Week ordering
wk_tot = d.groupby(["dept_id", "wk"]).y.sum().unstack(0)
print(wk_tot.round(1))
print("week level effects dept", np.exp(m.params[[p for p in m.params.index if "wk" in p]]).round(3).to_dict())


# Backtest
def bench(train, test):
    # same weekday mean of last four available weeks
    out = []
    for (s, de, day), row in test.set_index(["store_id", "dept_id", "day_date"]).iterrows():
        tr = train[(train.store_id == s) & (train.dept_id == de) & (train.dow == row.dow)].sort_values("day_date").tail(4)
        out.append(tr.y.mean())
    return np.array(out)


def fit_loglinear(train, test, formula="ly ~ C(store_id):C(dept_id) + C(dept_id):C(dow) + C(dept_id):C(win) + C(dept_id):C(wk)"):
    tr = train.copy()
    te = test.copy()
    # win only those seen in train
    m = smf.ols(formula, tr).fit()
    wks = sorted(tr.wk.unique())[-4:]
    te["win"] = "aNormal"
    preds = []
    for w in wks:
        t2 = te.copy()
        t2["wk"] = w
        preds.append(m.predict(t2).values)
    return np.exp(np.mean(preds, axis=0))


rows = []
res_rows = []
for w in [4, 5, 6]:
    tr = d[d.wk < w]
    te = d[d.wk == w].copy()
    te["b"] = bench(tr, te)
    te["m"] = fit_loglinear(tr, te)
    res_rows.append(te)
bt = pd.concat(res_rows)
bt["eb"] = (bt.b - bt.y).abs() / bt.y
bt["em"] = (bt.m - bt.y).abs() / bt.y
print("ALL ours", bt.em.mean(), "bench", bt.eb.mean())
print(bt.groupby("dept_id")[["em", "eb"]].mean().round(4))
print(bt.groupby("wk")[["em", "eb"]].mean().round(4))
print("bias ours/bench by wk", bt.assign(bm=(bt.m / bt.y - 1), bb=(bt.b / bt.y - 1)).groupby("wk")[["bm", "bb"]].mean().round(4))
# wk 4 test contains holiday in benchmark training weeks; note
# Paired test
print("paired: share blocks ours better", (bt.em < bt.eb).mean())

# shift (block) split
shift = o[["store_id", "dept_id", "day_date", "shift_code", "shift_demand_units", "day_type"]].copy()
shift["wk"] = ((shift.day_date - pd.Timestamp("2026-01-01")).dt.days // 7) + 1
all_rows = []
for w in [4, 5, 6]:
    trs = shift[shift.wk < w]
    dtr = trs.groupby(["store_id", "dept_id", "day_date", "day_type", "shift_code"]).shift_demand_units.sum().reset_index()
    tot = dtr.groupby(["store_id", "dept_id", "day_date"]).shift_demand_units.transform("sum")
    dtr["sh"] = dtr.shift_demand_units / tot
    # mean share by dept x day_type x shift
    shr = dtr.groupby(["dept_id", "day_type", "shift_code"]).sh.mean().reset_index()
    te = shift[shift.wk == w].merge(shr, on=["dept_id", "day_type", "shift_code"])
    te = te.merge(bt[bt.wk == w][["store_id", "dept_id", "day_date", "b", "m"]], on=["store_id", "dept_id", "day_date"])
    te["pb"] = te.b * te.sh; te["pm"] = te.m * te.sh
    # benchmark's own block split: same? use same shares
    all_rows.append(te)
bb = pd.concat(all_rows)
bb["eb"] = (bb.pb - bb.shift_demand_units).abs() / bb.shift_demand_units
bb["em"] = (bb.pm - bb.shift_demand_units).abs() / bb.shift_demand_units
print("block ALL ours", bb.em.mean(), "bench", bb.eb.mean())
print(bb.groupby("dept_id")[["em", "eb"]].mean().round(4))

# Table 6: MLK weekend from weeks 1 and 2, New Year rebound as guide. Jan 1 closed. weeks 1-2 = Jan 1-14
tr = d[d.wk <= 2].copy()
te = d[d.day_date.isin(pd.to_datetime(["2026-01-16", "2026-01-17", "2026-01-18"]))].copy()
# log-linear with rebound
m2 = smf.ols("ly ~ C(store_id):C(dept_id) + C(dept_id):C(dow) + C(dept_id):C(win)", tr).fit()
print("rebound factors", np.exp(m2.params[[p for p in m2.params.index if "win" in p]]).round(3).to_dict())
te2 = te.copy(); te2["win"] = "Post_New_Year_Rebound"
te["m"] = np.exp(m2.predict(te2))
te["b"] = bench(tr, te)
te["em"] = (te.m - te.y).abs() / te.y; te["eb"] = (te.b - te.y).abs() / te.y
print("T6 all", te.em.mean(), te.eb.mean()); print(te.groupby("dept_id")[["em", "eb"]].mean().round(4))
print("T6 bias", te.assign(a=te.m / te.y - 1, c=te.b / te.y - 1).groupby("dept_id")[["a", "c"]].mean().round(4))

# Full model forecast for planning week
grid = pd.read_csv(D + "v_PlanningWeekGrid.csv", parse_dates=["day_date"])
bench_f = pd.read_csv(D + "PlanningWeek_BenchmarkForecast.csv", parse_dates=["day_date"])
print("bench roles", bench_f.groupby("day_date").holiday_window_role.first().to_dict())
pw = bench_f[["store_id", "dept_id", "day_date", "predicted_transaction_count_proxy", "holiday_window_role"]].copy()
pw["dow"] = pw.day_date.dt.day_name().str[:3]
pw["win"] = pw.holiday_window_role.map({"Normal": "aNormal", "Pre_Presidents_Day_Weekend": "Pre_MLK_Weekend", "Presidents_Day_Holiday": "MLK_Holiday"})
pw["win"] = pw.win.fillna("aNormal")
preds = []
for w in [3, 4, 5, 6]:
    t2 = pw.copy(); t2["wk"] = w
    preds.append(m.predict(t2).values)
pw["ours"] = np.exp(np.mean(preds, axis=0))
pw.to_csv("forecast_daily_mine.csv", index=False)
pw["ratio"] = pw.predicted_transaction_count_proxy / pw.ours - 1
print(pw.groupby(["dept_id", "day_date"]).agg(b=("predicted_transaction_count_proxy", "sum"), o=("ours", "sum")).assign(r=lambda x: x.b / x.o - 1).round(3))
# verify benchmark matches weeks 3-6 same weekday
chk = d[d.wk.between(3, 6)].groupby(["store_id", "dept_id", "dow"]).y.mean().reset_index()
pw2 = pw.merge(chk, on=["store_id", "dept_id", "dow"])
print("bench recon max diff", (pw2.y - pw2.predicted_transaction_count_proxy).abs().max())
