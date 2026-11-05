import pandas as pd, numpy as np
from alloc import *
pd.set_option("display.width", 240); pd.set_option("display.max_columns", 40); pd.set_option("display.max_rows", 300)
pv = pd.read_csv(r"C:\MISA Case\outputs\plan_vs_draft.csv", parse_dates=["day_date"])
print(len(pv), pv.groupby("scenario_code").size().to_dict())
fl = pd.read_csv(r"C:\MISA Case\outputs\TEAM_SUBMISSION_TEMPLATE_filled.csv", parse_dates=["day_date"])[KEYS + ["submitted_employees"]]
m = pv.merge(fl, on=KEYS)
print("recommended == submitted", (m.recommended == m.submitted_employees).all())
g = load_grid().merge(fl, on=KEYS)
a = allocate(g, "submitted_employees")
mm = m.merge(a[KEYS + ["usable_flex", "capacity", "reg", "flex", "ot", "cost"]], on=KEYS, suffixes=("", "_mine"))
op = mm[mm.is_open == 1]
print("usable flex mismatch", (op.usable_flex != op.usable_flex_mine).sum(), "capacity mismatch", (op.capacity != op.capacity_mine).sum(), "cost diff", (op.cost - op.cost_mine).abs().max())
f = op[op.below_service_goal == True].copy()
print("below goal per scenario", f.groupby("scenario_code").size().to_dict())
f["at_cap"] = f.recommended >= f.capacity
print("flagged not at capacity", (~f.at_cap).groupby(f.scenario_code).sum().to_dict())
f["own_exhausted"] = (f.fill_regular == f.available_regular_employees) & (f.fill_overtime == f.max_overtime_employees)
print("flagged with own reg+OT exhausted", f.own_exhausted.groupby(f.scenario_code).agg(["sum", "size"]))
print(f[~f.at_cap][["scenario_code", "store_id", "dept_id", "day_date", "shift_code", "recommended", "capacity", "chance_met"]])
print("flagged chance_met dist", f.groupby("scenario_code").chance_met.describe().round(3))
b = f[f.scenario_code == "BASE"]
print(b[["store_id", "dept_id", "day_date", "shift_code", "min_staff", "draft_scheduled_employees", "recommended", "available_regular_employees", "usable_flex", "max_overtime_employees", "planned_utilization", "chance_met", "callout_rate", "demand_sd"]].round(3).to_string())
print("BASE: chance in [.90,.95)", ((b.chance_met >= .9) & (b.chance_met < .95)).sum(), " <.90", (b.chance_met < .9).sum(), "<.80", (b.chance_met < .8).sum())
# at capacity but not flagged
print("at capacity not flagged", ((op.recommended >= op.capacity) & (op.below_service_goal != True)).groupby(op.scenario_code).sum().to_dict())
# Lenders: partner block flagged when this one borrows
op2 = op[op.dept_id.isin([38, 92])]
bor = op2[op2.fill_flex > 0][KEYS + ["fill_flex", "scenario_code", "chance_met", "below_service_goal"]].copy()
bor["p_dept"] = bor.dept_id.map({38: 92, 92: 38})
lend = bor.merge(op2[["scenario_id", "store_id", "dept_id", "day_date", "shift_code", "recommended", "available_regular_employees", "chance_met", "below_service_goal", "planned_utilization"]], left_on=["scenario_id", "store_id", "p_dept", "day_date", "shift_code"], right_on=["scenario_id", "store_id", "dept_id", "day_date", "shift_code"], suffixes=("", "_lender"))
print("borrow blocks", len(lend), "lender flagged", lend.below_service_goal_lender.sum(), "lender chance<.95", (lend.chance_met_lender < .95).sum())
print(lend[["scenario_code", "store_id", "dept_id", "day_date", "shift_code", "fill_flex", "chance_met", "chance_met_lender", "planned_utilization", "recommended", "available_regular_employees"]].round(3).to_string())
# Blocks where plan cuts below draft
c = op[op.recommended < op.draft_scheduled_employees]
print("cuts", c.groupby("scenario_code").size().to_dict())
# Does a block's plan lower chance while cutting? Plan chance < draft chance
w = op[op.chance_met < op.chance_met_draft - .005]
print("plan worse than draft (chance)", w.groupby("scenario_code").size().to_dict())
print(w[["scenario_code", "store_id", "dept_id", "day_date", "shift_code", "draft_scheduled_employees", "recommended", "chance_met", "chance_met_draft", "below_service_goal"]].round(3).to_string())
# recomputed expected service from file
print(op.groupby("scenario_code")[["chance_met", "chance_met_draft"]].mean().round(4))
print(op[op.scenario_code == "BASE"].groupby("department_group")[["chance_met", "chance_met_draft"]].mean().round(4))
# unique callout rates by date
print(op[op.scenario_code == "BASE"].groupby(["dept_id", "day_date"]).callout_rate.mean().unstack(0).round(4))
print(op[op.scenario_code == "BASE"].groupby(["dept_id", "day_date"]).demand_sd.mean().unstack(0).round(4))
# demand vs mine
print("draft people short per unfilled col", op.groupby("scenario_code").unfilled.sum().to_dict())
d = pd.read_csv("plan_both_B.csv", parse_dates=["day_date"])
x = op.merge(d[KEYS + ["wl", "p"]], on=KEYS)
x["my_dem"] = x.wl
std = x.dept_id.map({38: 1.5, 92: 1.2, 95: .165})
x["their_wl"] = x.demand * std
print("demand vs mine ratio", (x.their_wl / x.my_dem).describe().round(4).to_dict())
print("sum their wl", x[x.scenario_code == "BASE"].their_wl.sum(), "mine", x[x.scenario_code == "BASE"].my_dem.sum())
print("corr chance vs my p", x.chance_met.corr(x.p))
print("Feb 14 at capacity FE+Merch BASE", ((op.scenario_code == "BASE") & (op.day_date == "2026-02-14") & (op.dept_id != 95) & (op.recommended >= op.capacity)).sum(), "of", ((op.scenario_code == "BASE") & (op.day_date == "2026-02-14") & (op.dept_id != 95)).sum())
print("Feb 14 total chance FE+Merch", op[(op.scenario_code == "BASE") & (op.day_date == "2026-02-14") & (op.dept_id != 95)].chance_met.mean())
print("DISRUPT WH2 FE", op[(op.scenario_code == "DISRUPT") & (op.store_id == 2) & (op.dept_id == 38) & (op.day_date.between("2026-02-13", "2026-02-16"))][["day_date", "shift_code", "recommended", "capacity", "planned_utilization", "chance_met"]].round(3).to_string())
print("Merch Saturday avail plan vs history")
h = pd.read_csv(D + "v_ShiftHistory.csv", parse_dates=["day_date"])
print(h[(h.dept_id == 92) & (h.is_open == 1) & (h.day_name == "Saturday")].groupby("day_date").available_regular_employees.mean().round(2).to_dict())
print(g[(g.scenario_code == "BASE") & (g.dept_id == 92) & (g.is_open == 1)].groupby("day_date").available_regular_employees.mean().round(2).to_dict())
