import pandas as pd, numpy as np
from alloc import *
pd.set_option("display.width", 220); pd.set_option("display.max_columns", 40); pd.set_option("display.max_rows", 300)
g = load_grid()
g = g[g.is_open == 1].copy()
# Dashboard cost variants for draft in DISRUPT
g["sub"] = g.draft_scheduled_employees
d = g[g.scenario_code == "DISRUPT"].copy()
d["reg"] = np.minimum(d["sub"], d.available_regular_employees)
d["fl"] = np.minimum(d["sub"] - d.reg, d.cross_trained_flex_employees)
d["otc"] = np.minimum(d["sub"] - d.reg - d.fl, d.max_overtime_employees)
d["otu"] = d["sub"] - d.reg - d.fl
c = lambda r, f, o: ((r + f) * d.paid_hours * d.loaded_regular_hourly_cost + o * d.paid_hours * d.loaded_overtime_hourly_cost).sum()
print("unlimited flex, OT capped", c(d.reg, d.fl, d.otc))
print("unlimited flex, OT uncapped", c(d.reg, d.fl, d.otu))
print("no flex at all, OT capped", c(d.reg, 0 * d.fl, np.minimum(d["sub"] - d.reg, d.max_overtime_employees)))
print("no flex, OT uncapped", c(d.reg, 0 * d.fl, d["sub"] - d.reg))
# limited flex with OT capped already = 326367; limited flex using partner spare computed
print("hours unlimited flex OT capped", ((d.reg + d.fl + d.otc) * d.paid_hours).sum())
# short blocks hours valued
print("people short unlimited", (d["sub"] - d.reg - d.fl - d.otc).sum())
