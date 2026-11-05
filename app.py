"""Workforce planner proof of concept: pick a scenario and see staffing, cost, service risk and why."""
import altair as alt
import pandas as pd
import streamlit as st

from src.app_data import DEFAULTS, demand_view, run_scenario
from src.data import SCENARIOS, WAREHOUSES, open_history
from src.diagnosis import DEPT_NAMES
from src.explain import ASSUMPTIONS, SHIFT_NAMES, block_label
from src.playbook import on_the_day, pto_what_if, scenario_actions
from src.search import planning_inputs
from src.service import fit_all

st.set_page_config(page_title="Workforce Planner", layout="wide")

SCENARIO_TEXT = {
    "BASE": "Expected conditions for Feb 12-18, including Valentine's Day and Presidents' Day.",
    "PEAK": "A promotion launch and a winter-storm advisory raise demand on Feb 13-15. Availability is the same as BASE.",
    "DISRUPT": "Illness at Warehouse 2 on Feb 13-16 and a crew shortage at Warehouse 4 on Feb 12-13. Demand is the same as BASE.",
}
DEPT_COLORS = {"Front End": "#2a78d6", "Merchandising": "#eb6834", "Pharmacy": "#1baf7a"}
PLAN_COLOR, DRAFT_COLOR, BENCHMARK_COLOR = "#2a78d6", "#a3a29c", "#a3a29c"
WHAT_IF_DEFAULTS = {"goal": DEFAULTS["goal"], "callouts": 100, "demand": 0}
INK, MUTED, GRID = "#0b0b0b", "#52514e", "#e6e5e0"
SHIFT_ORDER = ["Opening", "Midday", "Evening"]
GOALS = [0.90, 0.925, 0.95, 0.975]
DAY_ORDER_NOTE = "Thu Feb 12 to Wed Feb 18, 2026"


def chart_config(chart: alt.Chart) -> alt.Chart:
    return (
        chart.configure_axis(labelColor=MUTED, titleColor=MUTED, gridColor=GRID, domainColor=GRID, tickColor=GRID, labelFontSize=12, titleFontSize=12)
        .configure_legend(labelColor=INK, titleColor=MUTED, orient="top", labelFontSize=12, titleFontSize=12)
        .configure_view(strokeWidth=0)
    )


@st.cache_resource(show_spinner=False)
def model():
    return fit_all(open_history()), planning_inputs()


@st.cache_data(show_spinner="Recalculating the plan...")
def scenario_result(scenario: str, goal: float, callouts: float, demand: float) -> dict:
    curves, inputs = model()
    return run_scenario(inputs, curves, scenario, goal, callouts, demand)


@st.cache_data(show_spinner=False)
def playbook_data() -> dict:
    curves, inputs = model()
    results = [scenario_result(name, **DEFAULTS)["explained"] for name in SCENARIOS]
    combined = pd.concat(results, ignore_index=True)
    return {
        "actions": scenario_actions(combined),
        "on_the_day": on_the_day(combined),
        "pto": pto_what_if(inputs, curves),
    }


def reset_what_if() -> None:
    st.session_state.update(WHAT_IF_DEFAULTS)


def plain(text: str) -> str:
    """Stop Streamlit reading dollar signs as math."""
    return text.replace("$", "\\$")


def day_label(day: pd.Timestamp) -> str:
    return f"{day:%a} {day.day}"


for key, value in WHAT_IF_DEFAULTS.items():
    st.session_state.setdefault(key, value)

# Prepare everything once, so that switching scenarios during a demo is instant (T-55).
if "prepared" not in st.session_state:
    with st.spinner("Preparing the three scenarios. This takes about 15 seconds, the first time only."):
        playbook_data()
    st.session_state["prepared"] = True

# Sidebar: the inputs a warehouse leader controls.
with st.sidebar:
    st.header("Scenario")
    scenario = st.selectbox("Conditions this week", SCENARIOS, key="scenario")
    st.caption(SCENARIO_TEXT[scenario])
    warehouse = st.selectbox("Warehouse", list(WAREHOUSES), format_func=WAREHOUSES.get, key="warehouse")
    st.header("What if?")
    st.caption("These recalculate the plan. The submitted plan uses the starting values.")
    callouts = st.slider("Callouts, as a share of history", 0, 200, step=25, format="%d%%", key="callouts")
    demand = st.slider("Demand against forecast", -10, 15, step=1, format="%d%%", key="demand")
    goal = st.select_slider("Service goal", GOALS, format_func=lambda g: f"{g * 100:g}%", key="goal")
    st.button("Reset", on_click=reset_what_if, key="reset")

result = scenario_result(scenario, goal, callouts / 100, demand / 100)
explained = result["explained"]
plan_total, draft_total = result["plan_summary"], result["draft_summary"]
blocks = explained[(explained["store_id"] == warehouse)].copy()
open_blocks = blocks[blocks["is_open"] == 1].copy()
open_blocks["label"] = [block_label(row) for row in open_blocks.itertuples()]
open_blocks["department"] = open_blocks["dept_id"].map(DEPT_NAMES)
open_blocks["shift"] = open_blocks["shift_code"].map(SHIFT_NAMES)
open_blocks["day"] = open_blocks["day_date"].map(day_label)
DAYS = [day_label(day) for day in sorted(explained["day_date"].unique())]

# Header and totals for all warehouses.
st.title("Workforce Planner")
st.caption(f"Texas MISA Fall 2026 case. {DAY_ORDER_NOTE}. All data is simulated and is not Costco data.")
# A fixed slot, so that the notice appearing doesn't move the tabs or reset the open one.
notice = st.empty()
if (goal, callouts, demand) != (DEFAULTS["goal"], 100, 0):
    notice.warning("What-if view. This isn't the submitted plan, and the draft is scored under the same conditions.")

st.subheader(f"{scenario}: all three warehouses, against the current draft")
cost_col, hours_col, service_col, capacity_col, short_col = st.columns(5)
cost_change = plan_total["cost"] / draft_total["cost"] - 1
cost_col.metric("Labor cost", f"${plan_total['cost']:,.0f}", f"{cost_change * 100:+.1f}%", delta_color="off")
hours_col.metric("Labor hours", f"{plan_total['hours']:,.0f}", f"{plan_total['hours'] - draft_total['hours']:+,.0f}", delta_color="off")
service_col.metric(
    "Expected service", f"{plan_total['expected_met'] * 100:.1f}%", f"{(plan_total['expected_met'] - draft_total['expected_met']) * 100:+.1f} points",
    help="The average predicted chance of meeting target across open blocks. It is a prediction from our model.",
)
capacity_col.metric("Blocks above capacity", int(plan_total["over_capacity"]), f"Draft: {int(draft_total['over_capacity'])}", delta_color="off", delta_arrow="off")
short_col.metric(
    f"Blocks below the {goal * 100:g}% goal", int(plan_total["below_goal"]), f"Draft: {int(draft_total['below_goal'])}", delta_color="off", delta_arrow="off",
    help="A chance of meeting target below the goal, even with all of the block's own staff and overtime scheduled.",
)

staffing_tab, cost_tab, demand_tab, why_tab, playbook_tab = st.tabs(["Staffing", "Cost and service", "Demand", "Why", "Playbook"])

# Staffing: where, when and how much labor is needed.
with staffing_tab:
    st.subheader(f"Recommended staff at {WAREHOUSES[warehouse]}")
    st.caption("Each cell shows total employees for the block. Color shows the change from the draft. ! marks a block below the service goal. Blank cells are closed. Hover over a cell for details.")
    cells = open_blocks.copy()
    cells["row"] = cells["department"] + ", " + cells["shift"]
    cells["text"] = cells["recommended"].astype(str) + (cells["chance_met"] < goal - 0.0005).map({True: " !", False: ""})
    cells["chance"] = (cells["chance_met"] * 100).round(0)
    row_order = [f"{DEPT_NAMES[d]}, {s}" for d in DEPT_NAMES for s in SHIFT_ORDER]
    limit = max(int(cells["change"].abs().max()), 1)
    base = alt.Chart(cells).encode(
        x=alt.X("day:N", sort=DAYS, title=None, axis=alt.Axis(orient="top", labelAngle=0)),
        y=alt.Y("row:N", sort=row_order, title=None, axis=alt.Axis(labelLimit=220)),
    )
    grid = base.mark_rect(stroke="white", strokeWidth=2, cornerRadius=4).encode(
        color=alt.Color(
            "change:Q",
            title="Change from draft",
            scale=alt.Scale(domain=[-limit, 0, limit], range=["#e34948", "#f0efec", "#2a78d6"], interpolate="rgb"),
        ),
        tooltip=[
            alt.Tooltip("label:N", title="Block"),
            alt.Tooltip("draft_scheduled_employees:Q", title="Draft"),
            alt.Tooltip("recommended:Q", title="Plan"),
            alt.Tooltip("change:Q", title="Change"),
            alt.Tooltip("chance:Q", title="Chance of meeting target (%)"),
            alt.Tooltip("fill_regular:Q", title="Regular"),
            alt.Tooltip("fill_flex:Q", title="Cross-trained"),
            alt.Tooltip("fill_overtime:Q", title="Overtime"),
        ],
    )
    labels = base.mark_text(fontSize=13).encode(
        text="text:N",
        color=alt.condition(f"abs(datum.change) >= {max(limit * 0.6, 3)}", alt.value("white"), alt.value(INK)),
    )
    st.altair_chart(chart_config((grid + labels).properties(height=430)), width="stretch")

    table = open_blocks.sort_values(["day_date", "dept_id", "shift_code"])
    table = pd.DataFrame(
        {
            "Day": table["day"],
            "Department": table["department"],
            "Shift": table["shift"],
            "Draft": table["draft_scheduled_employees"],
            "Plan": table["recommended"],
            "Change": table["change"],
            "Regular": table["fill_regular"],
            "Cross-trained": table["fill_flex"],
            "Overtime": table["fill_overtime"],
            "Chance of meeting target": table["chance_met"].map(lambda p: f"{p * 100:.0f}%"),
        }
    )
    with st.expander("See this as a table"):
        st.dataframe(table, hide_index=True, width="stretch")
    st.download_button(
        f"Download the {scenario} plan for {WAREHOUSES[warehouse]}",
        table.to_csv(index=False),
        f"plan_{scenario}_warehouse_{warehouse}.csv",
        "text/csv",
        key="download",
    )

# Cost and service against the draft.
with cost_tab:
    st.subheader(f"Cost and service at {WAREHOUSES[warehouse]}, against the draft")
    by_day = open_blocks.groupby(["day_date", "day"], as_index=False, sort=True).agg(plan_cost=("cost", "sum"), draft_cost=("cost_draft", "sum"), plan_met=("chance_met", "mean"), draft_met=("chance_met_draft", "mean"))
    cost_long = by_day.melt(id_vars="day", value_vars=["draft_cost", "plan_cost"], var_name="schedule", value_name="cost").replace({"plan_cost": "Plan", "draft_cost": "Draft"})
    met_long = by_day.melt(id_vars="day", value_vars=["draft_met", "plan_met"], var_name="schedule", value_name="met").replace({"plan_met": "Plan", "draft_met": "Draft"})
    met_long["met"] = met_long["met"] * 100
    colors = alt.Scale(domain=["Draft", "Plan"], range=[DRAFT_COLOR, PLAN_COLOR])
    left, right = st.columns(2)
    with left:
        st.markdown("**Expected service by day**")
        points = alt.Chart(met_long).encode(
            x=alt.X("day:N", sort=DAYS, title=None, axis=alt.Axis(labelAngle=0)),
            y=alt.Y("met:Q", title="Expected blocks meeting target (%)", scale=alt.Scale(domain=[0, 100])),
            color=alt.Color("schedule:N", scale=colors, title=None),
            tooltip=[alt.Tooltip("day:N", title="Day"), alt.Tooltip("schedule:N", title="Schedule"), alt.Tooltip("met:Q", title="Expected service (%)", format=".1f")],
        )
        st.altair_chart(chart_config((points.mark_line(strokeWidth=2) + points.mark_point(filled=True, size=80, opacity=1)).properties(height=300)), width="stretch")
    with right:
        st.markdown("**Labor cost by day**")
        bars = alt.Chart(cost_long).mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4).encode(
            x=alt.X("day:N", sort=DAYS, title=None, axis=alt.Axis(labelAngle=0)),
            xOffset=alt.XOffset("schedule:N", sort=["Draft", "Plan"]),
            y=alt.Y("cost:Q", title="Labor cost ($)", axis=alt.Axis(format="$,.0f")),
            color=alt.Color("schedule:N", scale=colors, title=None),
            tooltip=[alt.Tooltip("day:N", title="Day"), alt.Tooltip("schedule:N", title="Schedule"), alt.Tooltip("cost:Q", title="Cost", format="$,.0f")],
        )
        st.altair_chart(chart_config(bars.properties(height=300)), width="stretch")

    st.markdown("**By department**")
    by_dept = open_blocks.groupby("department", as_index=False, sort=False).agg(plan_hours=("hours", "sum"), plan_cost=("cost", "sum"), draft_cost=("cost_draft", "sum"), plan_met=("chance_met", "mean"), draft_met=("chance_met_draft", "mean"))
    st.dataframe(
        pd.DataFrame(
            {
                "Department": by_dept["department"],
                "Plan hours": by_dept["plan_hours"].map("{:,.1f}".format),
                "Draft cost": by_dept["draft_cost"].map("${:,.0f}".format),
                "Plan cost": by_dept["plan_cost"].map("${:,.0f}".format),
                "Draft expected service": by_dept["draft_met"].map("{:.1%}".format),
                "Plan expected service": by_dept["plan_met"].map("{:.1%}".format),
            }
        ),
        hide_index=True,
        width="stretch",
    )

    st.markdown("**Highest service risk in this plan**")
    riskiest = open_blocks.sort_values("chance_met").head(10)
    st.dataframe(
        pd.DataFrame(
            {
                "Block": riskiest["label"],
                "Plan": riskiest["recommended"],
                "Needed for the goal": riskiest["need"],
                "Chance of missing target": (1 - riskiest["chance_met"]).map("{:.0%}".format),
                "Availability note": riskiest["availability_note"].fillna(""),
            }
        ),
        hide_index=True,
        width="stretch",
    )

# Demand: when it rises or falls, and why.
with demand_tab:
    st.subheader(f"Demand at {WAREHOUSES[warehouse]}")
    st.caption("Demand units differ by department, so each department has its own scale. The benchmark is the case's naive forecast, which ignores holidays.")
    daily = result["demand"]
    daily = daily[daily["store_id"] == warehouse].copy()
    daily["department"] = daily["dept_id"].map(DEPT_NAMES)
    daily["day"] = daily["day_date"].map(day_label)
    columns = st.columns(3)
    for column, name in zip(columns, DEPT_NAMES.values()):
        part = daily[daily["department"] == name]
        long = part.melt(id_vars=["day"], value_vars=["forecast", "benchmark"], var_name="series", value_name="units").replace({"forecast": "Our forecast", "benchmark": "Benchmark"})
        scale = alt.Scale(domain=["Benchmark", "Our forecast"], range=[BENCHMARK_COLOR, DEPT_COLORS[name]])
        encode = alt.Chart(long).encode(
            x=alt.X("day:N", sort=DAYS, title=None, axis=alt.Axis(labelAngle=0, labelOverlap=False, labelFontSize=10)),
            y=alt.Y("units:Q", title="Demand units", scale=alt.Scale(zero=False)),
            color=alt.Color("series:N", scale=scale, title=None),
            tooltip=[alt.Tooltip("day:N", title="Day"), alt.Tooltip("series:N", title="Series"), alt.Tooltip("units:Q", title="Units", format=",.1f")],
        )
        with column:
            st.markdown(f"**{name}**")
            st.altair_chart(chart_config((encode.mark_line(strokeWidth=2) + encode.mark_point(filled=True, size=70, opacity=1)).properties(height=240)), width="stretch")
    st.markdown("**What drives each day**")
    driver_dept = st.radio("Department", list(DEPT_NAMES.values()), horizontal=True, key="driver_dept", label_visibility="collapsed")
    drivers = daily[daily["department"] == driver_dept]
    st.table(
        pd.DataFrame(
            {
                "Day": drivers["day"],
                "Forecast": drivers["forecast"].map("{:,.1f}".format),
                "Against benchmark": drivers["vs_benchmark"].map("{:+.1%}".format),
                "Why": drivers["driver"],
            }
        ).set_index("Day")
    )

# Why: the reason and assumptions for any block.
with why_tab:
    st.subheader("Why this recommendation")
    ordered = open_blocks.assign(size=open_blocks["change"].abs()).sort_values(["size", "day_date"], ascending=[False, True])
    choice = st.selectbox(
        f"Block at {WAREHOUSES[warehouse]}, largest changes first",
        ordered["label"].tolist(),
        format_func=lambda label: f"{label}: {ordered.loc[ordered['label'] == label, 'action'].iloc[0]}",
        key="why_block",
    )
    row = ordered[ordered["label"] == choice].iloc[0]
    st.markdown(f"### {row['headline']}")
    st.write(plain(row["why"]))
    left, right = st.columns(2)
    with left:
        st.markdown("**Demand**")
        st.write(row["demand_driver"])
        st.markdown("**Staffing**")
        st.write(row["staffing"])
        if isinstance(row["availability_note"], str) and row["availability_note"]:
            st.markdown("**Availability**")
            st.write(row["availability_note"] + ".")
    with right:
        st.markdown("**Cost**")
        st.write(plain(row["cost_effect"]))
        st.markdown("**Service**")
        st.write(row["service_effect"])
        st.markdown("**Cushion**")
        st.write(row["cushion_text"])
    with st.expander("Assumptions behind this recommendation"):
        for assumption in row["assumption_ids"]:
            st.markdown(f"- **{assumption}:** {ASSUMPTIONS[assumption]}")

# Playbook: what to do when conditions shift.
with playbook_tab:
    data = playbook_data()
    actions = data["actions"][scenario]
    st.subheader(f"Playbook: {scenario}")
    st.caption("Actions are for the plan as submitted, so they don't change with the what-if settings.")
    st.markdown(f"**Use this plan when:** {actions['trigger']}")
    for action in actions["actions"]:
        st.markdown(f"- {plain(action)}")

    st.markdown("#### Before the week: limit holiday PTO")
    pto = data["pto"]
    no_change = pto.iloc[0]
    st.write(
        f"Holiday PTO is a main cause of the Feb 14-16 shortage. In BASE, {int(no_change['blocks_below_goal'])} blocks can't reach the goal as things stand. "
        "This shows what happens if the warehouses keep some of those people working, never more than each block lost to PTO against recent weeks. "
        "Cost falls because regular staff replace overtime. The data doesn't show how much PTO is already approved, so this assumes some of it can still be limited."
    )
    st.dataframe(
        pd.DataFrame(
            {
                "Limit on people kept per block": pto["kept_per_block"],
                "Employee shifts kept": pto["people_kept"],
                "Blocks below the goal": pto["blocks_below_goal"],
                "Expected service": pto["expected_met"].map("{:.1%}".format),
                "Labor cost": pto["cost"].map("${:,.0f}".format),
                "Overtime hours": pto["overtime_hours"].map("{:,.0f}".format),
            }
        ),
        hide_index=True,
        width="stretch",
    )

    st.markdown("#### On the day")
    for rule in data["on_the_day"]:
        st.markdown(f"- **If:** {rule['trigger']}  \n**Then:** {rule['action']}")

    st.markdown(f"#### Tightest blocks at {WAREHOUSES[warehouse]}")
    tightest = open_blocks[open_blocks["chance_met"] >= 0].sort_values(["cushion_people", "cushion_demand"]).head(8)
    st.dataframe(
        pd.DataFrame(
            {
                "Block": tightest["label"],
                "Plan": tightest["recommended"],
                "People it can lose": tightest["cushion_people"],
                "Extra demand it can take": tightest["cushion_demand"].map("{:.0%}".format),
            }
        ),
        hide_index=True,
        width="stretch",
    )
