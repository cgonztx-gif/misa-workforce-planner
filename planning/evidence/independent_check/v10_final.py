import pandas as pd, numpy as np
src = open("v9_replan.py", encoding="utf-8").read().split("rows = []")[0]
exec(src)
pd.set_option("display.width", 220)
# --- A. Dashboard $327,334 reproduction attempts
gg = allocate(load_grid(), "draft_scheduled_employees")
x = gg[(gg.scenario_code == "DISRUPT") & (gg.is_open == 1)].copy()
x["rawcap"] = x.available_regular_employees + x.cross_trained_flex_employees + x.max_overtime_employees
x["f"] = np.minimum(x.draft_scheduled_employees, x.rawcap)
x["r"] = np.minimum(x.f, x.available_regular_employees)
x["fl"] = np.minimum(x.f - x.r, x.usable_flex)
x["o"] = x.f - x.r - x.fl
print("raw-capacity fielded, usable flex, OT past limit:", ((x.r + x.fl) * x.paid_hours * x.loaded_regular_hourly_cost + x.o * x.paid_hours * x.loaded_overtime_hourly_cost).sum(), "OT past limit people", (x.o - x.max_overtime_employees).clip(lower=0).sum())

# --- B. Feb 14 features
gr = load_grid()
print(gr[(gr.scenario_id == 1) & (gr.store_id == 1) & (gr.dept_id == 38) & (gr.shift_code == "OPEN")][["day_date", "is_holiday", "holiday_name", "holiday_window_role", "is_pre_holiday_stockup", "is_post_holiday_rebound", "has_promotion", "promotion_index", "temperature"]].to_string())

# --- C. FE block error with normal-day shares only
s = o[["store_id", "dept_id", "day_date", "shift_code", "shift_demand_units", "day_type", "holiday_window_role", "shift_share_of_day"]].copy()
s["wk"] = ((s.day_date - pd.Timestamp("2026-01-01")).dt.days // 7) + 1


def bench_day(train, te):
    out = []
    for _, r in te.iterrows():
        q = train[(train.store_id == r.store_id) & (train.dept_id == r.dept_id) & (train.dow == r.dow)].sort_values("day_date").tail(4)
        out.append(q.y.mean())
    return np.array(out)


res = []
for w in [4, 5, 6]:
    tr = d[d.wk < w]; te = d[d.wk == w].copy()
    mm = smf.ols("ly ~ C(store_id):C(dept_id) + C(dept_id):C(dow) + C(dept_id):C(win) + C(dept_id):C(wk)", tr).fit()
    te["win"] = "aNormal"
    pr = [mm.predict(te.assign(wk=k)).values for k in sorted(tr.wk.unique())[-4:]]
    te["m"] = np.exp(np.mean(pr, axis=0)); te["b"] = bench_day(tr, te)
    sr = s[(s.wk < w) & (s.holiday_window_role == "Normal")].groupby(["dept_id", "day_type", "shift_code"]).shift_share_of_day.mean().reset_index().rename(columns={"shift_share_of_day": "shn"})
    srs = s[(s.wk < w) & (s.holiday_window_role == "Normal")].groupby(["store_id", "dept_id", "day_type", "shift_code"]).shift_share_of_day.mean().reset_index().rename(columns={"shift_share_of_day": "shs"})
    t = s[s.wk == w].merge(sr, on=["dept_id", "day_type", "shift_code"]).merge(srs, on=["store_id", "dept_id", "day_type", "shift_code"]).merge(te[["store_id", "dept_id", "day_date", "m", "b"]], on=["store_id", "dept_id", "day_date"])
    res.append(t)
r = pd.concat(res)
for nm, sh_ in [("dept shares", "shn"), ("store-dept shares", "shs")]:
    r["em"] = (r.m * r[sh_] - r.shift_demand_units).abs() / r.shift_demand_units
    r["eb"] = (r.b * r[sh_] - r.shift_demand_units).abs() / r.shift_demand_units
    print(nm, "ALL", round(r.em.mean(), 4), round(r.eb.mean(), 4), r.groupby("dept_id")[["em", "eb"]].mean().round(4).to_dict("index"))

# --- D. Evaluate own alt plans in three conditions (Table 11 analogue)
def evaluate(scen, nmap):
    a = allocate(g[g.scenario_code == scen].merge(nmap, on=KEYS, how="left").fillna({"n": 0}), "n")
    a = a[a.is_open == 1]
    out = {}
    zd = rng.standard_normal(DR)
    for nm, (ds, cl) in {"both": (True, True), "fc": (True, False), "none": (False, False)}.items():
        ps = []
        for r in a.itertuples():
            ps.append(pblock(r, int(r.fielded), ds, cl, r.ot, zd, None, None))
        out[nm] = round(float(np.mean(ps)), 3)
    return out, a.cost.sum()


for nm, (ds, cl) in {"Neither": (False, False), "Forecast only": (True, False), "Both": (True, True)}.items():
    rr, b = plan("BASE", .95, ds, cl)
    print(nm, rr["cost"], evaluate("BASE", b[KEYS + ["n"]]))
g["draftn"] = g.draft_scheduled_employees
print("Draft", evaluate("BASE", g[g.scenario_code == "BASE"][KEYS + ["draftn"]].rename(columns={"draftn": "n"})))
fl = pd.read_csv(r"C:\MISA Case\outputs\TEAM_SUBMISSION_TEMPLATE_filled.csv", parse_dates=["day_date"])[KEYS + ["submitted_employees"]].rename(columns={"submitted_employees": "n"})
for sc in ["BASE", "PEAK", "DISRUPT"]:
    print("Team plan", sc, evaluate(sc, fl[fl.scenario_id == {"BASE": 1, "PEAK": 2, "DISRUPT": 3}[sc]]))
    print("Draft", sc, evaluate(sc, g[g.scenario_code == sc][KEYS + ["draftn"]].rename(columns={"draftn": "n"})))

# --- E. DISRUPT callout rate in their file
pv = pd.read_csv(r"C:\MISA Case\outputs\plan_vs_draft.csv", parse_dates=["day_date"])
print(pv[(pv.scenario_code == "DISRUPT") & (pv.store_id == 2) & (pv.is_open == 1)].groupby(["dept_id", "day_date"]).callout_rate.mean().unstack(0).round(3))
# Feb 17 Rx flagged blocks at the ordinary weekday rate
print("Rx Feb 17 blocks")
for r in g[(g.scenario_code == "BASE") & (g.dept_id == 95) & (g.day_date == "2026-02-17")].itertuples():
    fl_n = pv[(pv.scenario_code == "BASE") & (pv.store_id == r.store_id) & (pv.dept_id == 95) & (pv.day_date == r.day_date) & (pv.shift_code == r.shift_code)].iloc[0]
    print(r.store_id, r.shift_code, "n", fl_n.recommended, "cap", fl_n.capacity, "chance", round(fl_n.chance_met, 3), "P(no callouts) @11%", round(.89 ** fl_n.recommended, 3), "@2.9%", round(.971 ** fl_n.recommended, 3))
