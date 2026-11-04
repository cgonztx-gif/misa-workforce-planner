"""Workforce planner proof of concept. Placeholder: shows the current draft schedule only."""
import streamlit as st

from src.data import SCENARIOS, capacity, load_planning_grid

st.set_page_config(page_title="Workforce Planner", layout="wide")
st.title("Workforce Planner")
st.caption("Texas MISA Fall 2026 case. All data is simulated and is not Costco data.")


@st.cache_data
def planning_grid():
    return load_planning_grid()


scenario = st.selectbox("Scenario", SCENARIOS, key="scenario")
grid = planning_grid()
blocks = grid[(grid["scenario_code"] == scenario) & (grid["is_open"] == 1)]

st.subheader("Current draft schedule")
hours, over = st.columns(2)
hours.metric("Draft labor hours", f"{blocks['draft_scheduled_labor_hours'].sum():,.0f}")
over.metric(
    "Blocks over capacity",
    int((blocks["draft_scheduled_employees"] > capacity(blocks)).sum()),
)
st.info("The forecast, staffing recommendation, cost and service risk views are still to be built.")
