import pandas as pd, numpy as np
D = r"C:\MISA Case\data\team_distribution\csv\\"
KEYS = ["scenario_id", "store_id", "dept_id", "day_date", "shift_code"]


def load_grid():
    g = pd.read_csv(D + "v_PlanningWeekGrid.csv", parse_dates=["day_date"])
    return g


def allocate(g, col):
    """Apply README rule. col = name of the staffing column. Returns df with reg, flex, ot, fielded, short, capacity."""
    g = g.copy()
    partner = g[["scenario_id", "store_id", "dept_id", "day_date", "shift_code", "available_regular_employees", col]].copy()
    partner = partner[partner.dept_id.isin([38, 92])]
    partner["dept_id"] = partner.dept_id.map({38: 92, 92: 38})
    partner = partner.rename(columns={"available_regular_employees": "p_avail", col: "p_sub"})
    g = g.merge(partner, on=KEYS, how="left")
    g["p_avail"] = g.p_avail.fillna(0); g["p_sub"] = g.p_sub.fillna(0)
    g["spare"] = (g.p_avail - g.p_sub).clip(lower=0)
    g["usable_flex"] = np.minimum(g.cross_trained_flex_employees, g.spare)
    g["capacity"] = g.available_regular_employees + g.usable_flex + g.max_overtime_employees
    g["reg"] = np.minimum(g[col], g.available_regular_employees)
    rem = g[col] - g.reg
    g["flex"] = np.minimum(rem, g.usable_flex)
    rem = rem - g.flex
    g["ot"] = np.minimum(rem, g.max_overtime_employees)
    g["short"] = rem - g.ot
    g["fielded"] = g.reg + g.flex + g.ot
    g["hours"] = g.fielded * g.paid_hours
    g["cost"] = (g.reg + g.flex) * g.paid_hours * g.loaded_regular_hourly_cost + g.ot * g.paid_hours * g.loaded_overtime_hourly_cost
    # uncapped version
    g["uncapped_cost"] = g.cost + g.short * g.paid_hours * g.loaded_overtime_hourly_cost
    return g
