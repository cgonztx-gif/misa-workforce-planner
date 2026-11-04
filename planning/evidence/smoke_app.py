"""Minimal Streamlit page used only by smoke_test.py. It is not the proof of concept."""
import os

import altair as alt
import pandas as pd
import streamlit as st


@st.cache_data
def load(path):
    return pd.read_csv(path)


g = load(os.environ["GRID"])
sc = st.selectbox("Scenario", ["BASE", "PEAK", "DISRUPT"], key="sc")
d = g[(g.scenario_code == sc) & (g.is_open == 1)].copy()
d["cap"] = d.available_regular_employees + d.max_overtime_employees + d.cross_trained_flex_employees
st.metric("Draft labor hours", round(float(d.draft_scheduled_labor_hours.sum()), 1))
st.metric("Draft blocks over capacity", int((d.draft_scheduled_employees > d.cap).sum()))
st.altair_chart(
    alt.Chart(d).mark_rect().encode(
        x="day_date:N",
        y="shift_code:N",
        color="sum(draft_scheduled_labor_hours):Q",
        column="department_group:N",
    )
)
