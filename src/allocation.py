"""The labor allocation and cost rule, in one place (D-10).

Every submitted total is filled with regular staff, then with cross-trained staff the
partner department can spare in that shift, then with overtime (README, R-25). The exact
usable-flex calculation isn't published, so this reading is an assumption (A-01, Q-03):

    usable flex = min(this row's flex, max(0, partner regular - partner submitted))
"""
from __future__ import annotations

import numpy as np
import pandas as pd

FRONT_END, MERCHANDISING, PHARMACY = 38, 92, 95
PARTNER = {FRONT_END: MERCHANDISING, MERCHANDISING: FRONT_END}
SHIFT_KEY = ["scenario_id", "store_id", "day_date", "shift_code"]


def usable_flex(flex, partner_regular, partner_submitted):
    """Cross-trained staff this block can actually borrow (A-01)."""
    spare = np.maximum(0, np.asarray(partner_regular) - np.asarray(partner_submitted))
    return np.minimum(np.asarray(flex), spare)


def allocate(submitted, regular, overtime, usable):
    """Split totals into regular, flex and overtime. Anything left over can't be fielded."""
    submitted = np.asarray(submitted)
    filled_regular = np.minimum(submitted, regular)
    remaining = submitted - filled_regular
    filled_flex = np.minimum(remaining, usable)
    remaining = remaining - filled_flex
    filled_overtime = np.minimum(remaining, overtime)
    return filled_regular, filled_flex, filled_overtime, remaining - filled_overtime


def block_cost(regular, flex, overtime, paid_hours, regular_rate, overtime_rate):
    """Flex staff cost the regular rate of the block they cover (A-10)."""
    return (np.asarray(regular) + flex) * paid_hours * regular_rate + np.asarray(overtime) * paid_hours * overtime_rate


def apply_rule(grid: pd.DataFrame, column: str) -> pd.DataFrame:
    """Apply the rule to a planning grid whose `column` holds total employees per block.

    Adds usable_flex, capacity, the three fill columns, unfilled, fielded and cost.
    Cost covers only the staff who can be fielded, which matters for the draft in DISRUPT.
    """
    result = grid.copy()
    partners = result[[*SHIFT_KEY, "dept_id", "available_regular_employees", column]].rename(
        columns={
            "dept_id": "partner_dept",
            "available_regular_employees": "partner_regular",
            column: "partner_submitted",
        }
    )
    result["partner_dept"] = result["dept_id"].map(PARTNER)
    result = result.merge(partners, on=[*SHIFT_KEY, "partner_dept"], how="left", validate="many_to_one")
    has_partner = result["partner_dept"].notna()
    result["usable_flex"] = 0
    result.loc[has_partner, "usable_flex"] = usable_flex(
        result.loc[has_partner, "cross_trained_flex_employees"],
        result.loc[has_partner, "partner_regular"],
        result.loc[has_partner, "partner_submitted"],
    ).astype(int)
    result["capacity"] = (
        result["available_regular_employees"] + result["usable_flex"] + result["max_overtime_employees"]
    )
    regular, flex, overtime, unfilled = allocate(
        result[column],
        result["available_regular_employees"],
        result["max_overtime_employees"],
        result["usable_flex"],
    )
    result["fill_regular"] = regular
    result["fill_flex"] = flex
    result["fill_overtime"] = overtime
    result["unfilled"] = unfilled
    result["fielded"] = regular + flex + overtime
    result["cost"] = block_cost(
        regular, flex, overtime, result["paid_hours"],
        result["loaded_regular_hourly_cost"], result["loaded_overtime_hourly_cost"],
    )
    result["below_min_staff"] = (result["is_open"] == 1) & (result[column] < result["min_staff"])
    result["over_capacity"] = result["unfilled"] > 0
    return result.drop(columns=["partner_dept", "partner_regular", "partner_submitted"])
