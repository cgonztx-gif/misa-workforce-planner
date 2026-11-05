"""Workforce planner proof of concept: pick a scenario, and see staffing, cost, service risk and why.

planning/UI_FRAMEWORK.md explains what each part is for. Nothing here depends on exact colors or layout,
so restyle freely, then check it in a browser.
"""
from pathlib import Path

import altair as alt
import pandas as pd
import streamlit as st

from src.app_data import BOARD_COLORS, DEFAULTS, block_options, board_cells, run_scenario, verdict_text
from src.data import CSV_DIR, SCENARIOS, WAREHOUSES, open_history
from src.diagnosis import DEPT_NAMES
from src.explain import ASSUMPTIONS, SHIFT_NAMES, block_label
from src.playbook import on_the_day, pto_what_if, scenario_actions
from src.search import planning_inputs
from src.service import fit_all

st.set_page_config(page_title="Workforce Planner", page_icon=str(Path(__file__).parent / "assets" / "favicon.png"), layout="wide")
st.html(
    """<style>
    [data-testid="stMainBlockContainer"] { padding-top: 1.5rem; padding-bottom: 3rem; }
    [data-testid="stMetricValue"] { font-variant-numeric: tabular-nums; }
    </style>"""
)

INK, MUTED, GRID = "#1f2933", "#52606d", "#e4e8ec"
PLAN_COLOR, DRAFT_COLOR = "#1c5cab", "#9aa3ad"
DEPARTMENT_COLORS = {"Front End": "#2a78d6", "Merchandising": "#eb6834", "Pharmacy": "#1baf7a"}
FONT = "'Segoe UI', system-ui, -apple-system, sans-serif"
PTO_FILE = Path(__file__).parent / "outputs" / "pto_what_if.csv"

SCENARIO_TEXT = {
    "BASE": "Expected conditions for the week, including Valentine's Day and Presidents' Day.",
    "PEAK": "A promotion launch and a winter-storm advisory raise demand on Feb 13-15. Availability is the same as BASE.",
    "DISRUPT": "Illness at Warehouse 2 on Feb 13-16 and a crew shortage at Warehouse 4 on Feb 12-13. Demand is the same as BASE.",
}
SHIFT_ORDER = ["Opening", "Midday", "Evening"]
BOARD_ROWS = [f"{department}, {shift}" for department in DEPT_NAMES.values() for shift in SHIFT_ORDER]
GOALS = [0.90, 0.925, 0.95, 0.975]
WHAT_IF_DEFAULTS = {"goal": DEFAULTS["goal"], "callouts": 100, "demand": 0}
GLOSSARY = {
    "Block": "One warehouse, department, day and shift.",
    "Draft": "Management's current schedule, which rolls last month's pattern forward.",
    "Plan": "The staffing this tool recommends.",
    "Utilization": "The hours a block's demand requires, divided by the hours actually worked. Service falls off a cliff near 85-90%.",
    "Meeting target": "A wait at or under the limit: 5 minutes at checkout, 60 for replenishment, 20 in Pharmacy.",
    "Expected service": "The average predicted chance of meeting target across open blocks. It comes from our model, so it isn't a measured result.",
    "Service goal": "The chance of meeting target the plan aims for in each block.",
    "Cushion": "The people a block can lose, or the extra demand it can take, before a miss becomes the likelier outcome.",
}


def safe(text: str) -> str:
    """Stop Streamlit reading two dollar signs in a line as a math formula."""
    return text.replace("$", "\\$")


def day_label(day: pd.Timestamp) -> str:
    return f"{day:%a} {day.day}"


def table(frame: pd.DataFrame, **formats: str) -> None:
    """A sortable table. Keyword names are column names with spaces as underscores, and values are print formats."""
    config = {name.replace("_", " "): st.column_config.NumberColumn(format=form) for name, form in formats.items()}
    st.dataframe(frame, column_config=config, hide_index=True, width="stretch")


def style(chart):
    return (
        chart.configure(font=FONT)
        .configure_axis(labelColor=MUTED, titleColor=MUTED, gridColor=GRID, domainColor=GRID, tickColor=GRID, labelFontSize=12, titleFontSize=12, titleFontWeight="normal")
        .configure_legend(labelColor=INK, titleColor=MUTED, orient="top", labelFontSize=12, titleFontSize=12, titleFontWeight="normal")
        .configure_view(strokeWidth=0)
    )


def staffing_board(cells: pd.DataFrame, days: list[str]):
    """Days across, departments and shifts down. Color shows the change from the draft, and a click explains a block."""
    limit = int(cells["limit"].iloc[0])
    picked = alt.selection_point(name="block", fields=["label"], on="click", toggle=False)
    base = alt.Chart(cells).encode(
        x=alt.X("day:N", sort=days, title=None, axis=alt.Axis(orient="top", labelAngle=0, ticks=False, domain=False, labelFontSize=13, labelPadding=8)),
        y=alt.Y("row:N", sort=BOARD_ROWS, title=None, axis=alt.Axis(labelLimit=220, ticks=False, domain=False, labelFontSize=13, labelPadding=8)),
    )
    fill = base.mark_rect(cornerRadius=5).encode(
        color=alt.Color(
            "change:Q",
            title="Change from the draft",
            scale=alt.Scale(domain=[-limit, 0, limit], range=[BOARD_COLORS["cut"], BOARD_COLORS["none"], BOARD_COLORS["add"]], interpolate="rgb"),
            legend=alt.Legend(gradientLength=220, gradientThickness=10),
        ),
        stroke=alt.condition("datum.selected", alt.value(INK), alt.value("#ffffff")),
        strokeWidth=alt.condition("datum.selected", alt.value(3), alt.value(2)),
    )
    numbers = base.mark_text(fontSize=15, fontWeight=600).encode(text="text:N", color=alt.Color("number_color:N", scale=None))
    # A clear layer on top, so that the whole cell responds, including over the number.
    clickable = base.mark_rect(fill="transparent", cursor="pointer").encode(
        tooltip=[
            alt.Tooltip("label:N", title="Block"),
            alt.Tooltip("status:N", title="Status"),
            alt.Tooltip("recommended:Q", title="Plan"),
            alt.Tooltip("draft_scheduled_employees:Q", title="Draft"),
            alt.Tooltip("change:Q", title="Change", format="+d"),
            alt.Tooltip("chance:Q", title="Chance of meeting target (%)", format=".0f"),
            alt.Tooltip("fill_regular:Q", title="Regular"),
            alt.Tooltip("fill_flex:Q", title="Cross-trained"),
            alt.Tooltip("fill_overtime:Q", title="Overtime"),
        ]
    ).add_params(picked)
    # Independent scales: the fill's color scale can't be shared with the numbers, which name their colors directly.
    return style(alt.layer(fill, numbers, clickable).resolve_scale(color="independent").properties(height=44 * len(BOARD_ROWS)))


def week_lines(frame: pd.DataFrame, days: list[str], value: str, series: str, colors: dict, y_title: str, number_format: str, y_domain=None, height=290, day_size=12):
    """Lines across the week. Hovering over a day shows every series for that day."""
    scale = alt.Scale(domain=list(colors), range=list(colors.values()))
    x = alt.X("day:N", sort=days, title=None, axis=alt.Axis(labelAngle=0, labelOverlap=False, labelFontSize=day_size, ticks=False))
    base = alt.Chart(frame).encode(
        x=x,
        y=alt.Y(f"{value}:Q", title=y_title, scale=alt.Scale(domain=y_domain) if y_domain else alt.Scale(zero=False), axis=alt.Axis(ticks=False, domain=False)),
        color=alt.Color(f"{series}:N", scale=scale, title=None),
    )
    hover = alt.selection_point(name="hover", fields=["day"], nearest=True, on="pointerover", empty=False, clear="pointerout")
    guide = (
        alt.Chart(frame)
        .transform_pivot(series, value=value, groupby=["day"])
        .mark_rule(color=MUTED)
        .encode(
            x=x,
            opacity=alt.condition(hover, alt.value(0.45), alt.value(0)),
            tooltip=[alt.Tooltip("day:N", title="Day")] + [alt.Tooltip(f"{name}:Q", title=name, format=number_format) for name in colors],
        )
        .add_params(hover)
    )
    return style(alt.layer(base.mark_line(strokeWidth=2.5), base.mark_point(filled=True, size=70, opacity=1), guide).properties(height=height))


def block_panel(row: pd.Series, goal: float, full: bool = False) -> None:
    """One block's recommendation and reason."""
    with st.container(border=True):
        with st.container(horizontal=True, vertical_alignment="center"):
            st.markdown(f"**{row['label']}**")
            if row["chance_met"] < goal - 0.0005:
                st.badge("Below the goal", icon=":material/error:", color="red")
            else:
                st.badge("Reaches the goal", icon=":material/check_circle:", color="green")
        st.subheader(row["headline"], anchor=False)
        st.markdown(safe(row["why"]))
        if full:
            left, right = st.columns(2)
            with left:
                st.markdown(f"**Demand**\n\n{row['demand_driver']}")
                st.markdown(f"**Staffing**\n\n{row['staffing']}")
                if isinstance(row["availability_note"], str) and row["availability_note"]:
                    st.markdown(f"**Availability**\n\n{row['availability_note']}.")
            with right:
                st.markdown(f"**Cost**\n\n{safe(row['cost_effect'])}")
                st.markdown(f"**Service**\n\n{row['service_effect']}")
                st.markdown(f"**Cushion**\n\n{row['cushion_text']}")


def reset_what_if() -> None:
    st.session_state.update(WHAT_IF_DEFAULTS)


def pick_block() -> None:
    """A click on the board selects that block on the Staffing and Why tabs."""
    points = st.session_state["board"]["selection"].get("block", [])
    if points and points[0].get("label"):
        st.session_state["why_block"] = points[0]["label"]


@st.cache_resource(show_spinner=False)
def model():
    return fit_all(open_history()), planning_inputs()


@st.cache_data(show_spinner="Recalculating the plan...", max_entries=64)
def scenario_result(scenario: str, goal: float, callouts: float, demand: float) -> dict:
    curves, inputs = model()
    return run_scenario(inputs, curves, scenario, goal, callouts, demand)


@st.cache_data(show_spinner=False)
def submitted_plan() -> dict:
    """The plan as submitted, for the parts of the app that don't change with the what-if settings."""
    curves, inputs = model()
    results = {name: scenario_result(name, **DEFAULTS) for name in SCENARIOS}
    combined = pd.concat([result["explained"] for result in results.values()], ignore_index=True)
    return {
        "actions": scenario_actions(combined),
        "on_the_day": on_the_day(combined),
        # Saved by the pipeline, since it never changes while the app runs and takes the longest to calculate.
        "pto": pd.read_csv(PTO_FILE) if PTO_FILE.exists() else pto_what_if(inputs, curves),
        "summaries": {name: (result["plan_summary"], result["draft_summary"]) for name, result in results.items()},
    }


if not (CSV_DIR / "v_ShiftHistory.csv").exists():
    st.error(
        "The case data isn't here yet. From the project folder, run these two commands, then reload this page:\n\n"
        "`python -m zipfile -e MISA.zip .`\n\n"
        '`python -m zipfile -e "MISA/Student Teams/Costco_Case_Competition_TEAMS.zip" data`',
        icon=":material/build:",
    )
    st.stop()

for key, value in {"scenario": "BASE", "warehouse": 1, **WHAT_IF_DEFAULTS}.items():
    st.session_state.setdefault(key, value)

# Prepare everything once, so that switching scenarios during a demo is instant.
if "prepared" not in st.session_state:
    with st.spinner("Preparing the three scenarios. This takes up to 20 seconds, the first time only."):
        submitted = submitted_plan()
    st.session_state["prepared"] = True
submitted = submitted_plan()

# Sidebar: what a warehouse leader controls.
with st.sidebar:
    st.subheader(":material/warehouse: Conditions", anchor=False)
    scenario = st.segmented_control("Scenario", SCENARIOS, required=True, key="scenario", width="stretch")
    st.caption(SCENARIO_TEXT[scenario])
    warehouse = st.segmented_control("Warehouse", list(WAREHOUSES), required=True, key="warehouse", width="stretch")
    st.space("small")
    st.subheader(":material/tune: What if?", anchor=False)
    callouts = st.slider("Callouts, as a share of history", 0, 200, step=25, format="%d%%", key="callouts")
    demand = st.slider("Demand against forecast", -10, 15, step=1, format="%d%%", key="demand")
    goal = st.select_slider("Service goal", GOALS, format_func=lambda g: f"{g * 100:g}%", key="goal")
    is_what_if = (goal, callouts, demand) != (WHAT_IF_DEFAULTS["goal"], WHAT_IF_DEFAULTS["callouts"], WHAT_IF_DEFAULTS["demand"])
    st.button("Reset what-if", icon=":material/restart_alt:", on_click=reset_what_if, key="reset", disabled=not is_what_if, width="stretch")
    st.space("small")
    with st.expander("What the terms mean", icon=":material/menu_book:"):
        st.markdown("\n\n".join(f"**{term}:** {meaning}" for term, meaning in GLOSSARY.items()))

result = scenario_result(scenario, goal, callouts / 100, demand / 100)
explained = result["explained"]
plan_total, draft_total = result["plan_summary"], result["draft_summary"]
warehouse_name = WAREHOUSES[warehouse]
blocks = explained[(explained["store_id"] == warehouse) & (explained["is_open"] == 1)].copy()
blocks["label"] = [block_label(row) for row in blocks.itertuples()]
blocks["department"] = blocks["dept_id"].map(DEPT_NAMES)
blocks["shift"] = blocks["shift_code"].map(SHIFT_NAMES)
blocks["day"] = blocks["day_date"].map(day_label)
days = [day_label(day) for day in sorted(explained["day_date"].unique())]
options = block_options(blocks)
if st.session_state.get("why_block") not in options:
    st.session_state["why_block"] = options[0]
selected_block = blocks[blocks["label"] == st.session_state["why_block"]].iloc[0]

# The answer first: what the plan does, then the figures behind it.
st.title("Workforce Planner", anchor=False)
st.caption("Staffing for Feb 12-18, 2026. Texas MISA case: all data is simulated and is not Costco data.")
# A fixed slot, so that the notice appearing doesn't move the tabs or reset the open one.
notice = st.empty()
if is_what_if:
    notice.warning("What-if view. This isn't the submitted plan, and the draft is scored under the same conditions.", icon=":material/tune:")
st.subheader(safe(verdict_text(plan_total, draft_total, goal)), anchor=False)

with st.container(border=True):
    with st.container(horizontal=True, gap="medium"):
        st.metric(f"Labor cost, {scenario}", f"${plan_total['cost']:,.0f}", f"{plan_total['cost'] / draft_total['cost'] - 1:+.1%} vs draft", delta_color="off", delta_arrow="off")
        st.metric("Labor hours", f"{plan_total['hours']:,.0f}", f"{plan_total['hours'] - draft_total['hours']:+,.0f} vs draft", delta_color="off", delta_arrow="off")
        st.metric(
            "Expected service", f"{plan_total['expected_met']:.1%}", f"{(plan_total['expected_met'] - draft_total['expected_met']) * 100:+.1f} points",
            help="The average predicted chance of meeting target across open blocks. It comes from our model, so it isn't a measured result.",
        )
        st.metric("Blocks above capacity", int(plan_total["over_capacity"]), f"Draft: {int(draft_total['over_capacity'])}", delta_color="off", delta_arrow="off")
        st.metric(
            f"Below the {goal * 100:g}% goal", int(plan_total["below_goal"]), f"Draft: {int(draft_total['below_goal'])}", delta_color="off", delta_arrow="off",
            help="A chance of meeting target below the goal, even with all of the block's own staff and overtime scheduled.",
        )

staffing_tab, cost_tab, demand_tab, why_tab, playbook_tab = st.tabs(
    [":material/calendar_view_week: Staffing", ":material/payments: Cost and service", ":material/trending_up: Demand", ":material/help: Why", ":material/checklist: Playbook"]
)

with staffing_tab:
    st.subheader(f"Recommended staff at {warehouse_name}", anchor=False)
    st.caption("Each cell is the total employees for that block, and its color shows the change from the draft. ! marks a block below the service goal, and blank cells are closed. Click any block to see why.")
    st.altair_chart(staffing_board(board_cells(blocks, goal, selected_block["label"]), days), width="stretch", key="board", on_select=pick_block, selection_mode="block")
    block_panel(selected_block, goal)
    plan_rows = blocks.sort_values(["day_date", "dept_id", "shift_code"])
    plan_table = pd.DataFrame(
        {
            "Day": plan_rows["day"],
            "Department": plan_rows["department"],
            "Shift": plan_rows["shift"],
            "Draft": plan_rows["draft_scheduled_employees"],
            "Plan": plan_rows["recommended"],
            "Change": plan_rows["change"],
            "Regular": plan_rows["fill_regular"],
            "Cross-trained": plan_rows["fill_flex"],
            "Overtime": plan_rows["fill_overtime"],
            "Chance of meeting target": plan_rows["chance_met"] * 100,
        }
    )
    with st.expander("See this as a table", icon=":material/table_rows:"):
        table(plan_table, Chance_of_meeting_target="%.0f%%")
    st.download_button(
        f"Download the {scenario} plan for {warehouse_name}", plan_table.to_csv(index=False), f"plan_{scenario}_warehouse_{warehouse}.csv", "text/csv",
        key="download", icon=":material/download:",
    )

with cost_tab:
    st.subheader("All three scenarios, as submitted", anchor=False)
    table(
        pd.DataFrame(
            [
                {
                    "Scenario": name,
                    "Draft cost": draft["cost"],
                    "Plan cost": plan["cost"],
                    "Draft expected service": draft["expected_met"] * 100,
                    "Plan expected service": plan["expected_met"] * 100,
                    "Blocks below the goal": int(plan["below_goal"]),
                    "Draft blocks above capacity": int(draft["over_capacity"]),
                }
                for name, (plan, draft) in submitted["summaries"].items()
            ]
        ),
        Draft_cost="$%,.0f", Plan_cost="$%,.0f", Draft_expected_service="%.1f%%", Plan_expected_service="%.1f%%",
    )
    st.subheader(f"{warehouse_name}, day by day", anchor=False)
    by_day = blocks.groupby(["day_date", "day"], as_index=False).agg(Plan_cost=("cost", "sum"), Draft_cost=("cost_draft", "sum"), Plan_met=("chance_met", "mean"), Draft_met=("chance_met_draft", "mean"))
    service_long = by_day.melt(id_vars="day", value_vars=["Draft_met", "Plan_met"], var_name="schedule", value_name="met")
    service_long["schedule"] = service_long["schedule"].map({"Draft_met": "Draft", "Plan_met": "Plan"})
    service_long["met"] = service_long["met"] * 100
    cost_long = by_day.melt(id_vars="day", value_vars=["Draft_cost", "Plan_cost"], var_name="schedule", value_name="cost")
    cost_long["schedule"] = cost_long["schedule"].map({"Draft_cost": "Draft", "Plan_cost": "Plan"})
    schedule_colors = {"Draft": DRAFT_COLOR, "Plan": PLAN_COLOR}
    left, right = st.columns(2)
    with left:
        st.markdown("**Expected service**")
        st.altair_chart(week_lines(service_long, days, "met", "schedule", schedule_colors, "Blocks expected to meet target (%)", ".1f", [0, 100]), width="stretch")
    with right:
        st.markdown("**Labor cost**")
        bars = (
            alt.Chart(cost_long)
            .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
            .encode(
                x=alt.X("day:N", sort=days, title=None, axis=alt.Axis(labelAngle=0, ticks=False)),
                xOffset=alt.XOffset("schedule:N", sort=["Draft", "Plan"]),
                y=alt.Y("cost:Q", title="Labor cost ($)", axis=alt.Axis(format="$,.0f", ticks=False, domain=False)),
                color=alt.Color("schedule:N", scale=alt.Scale(domain=list(schedule_colors), range=list(schedule_colors.values())), title=None),
                tooltip=[alt.Tooltip("day:N", title="Day"), alt.Tooltip("schedule:N", title="Schedule"), alt.Tooltip("cost:Q", title="Cost", format="$,.0f")],
            )
        )
        st.altair_chart(style(bars.properties(height=290)), width="stretch")
    st.markdown("**By department**")
    by_department = blocks.groupby("department", as_index=False, sort=False).agg(hours=("hours", "sum"), plan_cost=("cost", "sum"), draft_cost=("cost_draft", "sum"), plan_met=("chance_met", "mean"), draft_met=("chance_met_draft", "mean"))
    table(
        pd.DataFrame(
            {
                "Department": by_department["department"],
                "Plan hours": by_department["hours"],
                "Draft cost": by_department["draft_cost"],
                "Plan cost": by_department["plan_cost"],
                "Draft expected service": by_department["draft_met"] * 100,
                "Plan expected service": by_department["plan_met"] * 100,
            }
        ),
        Plan_hours="%,.1f", Draft_cost="$%,.0f", Plan_cost="$%,.0f", Draft_expected_service="%.1f%%", Plan_expected_service="%.1f%%",
    )
    st.markdown("**Blocks below the goal**")
    short = blocks[blocks["chance_met"] < goal - 0.0005].sort_values("chance_met").head(10)
    if short.empty:
        st.success(f"Every block at {warehouse_name} reaches the goal.", icon=":material/check_circle:")
    else:
        table(
            pd.DataFrame(
                {
                    "Block": short["label"],
                    "Plan": short["recommended"],
                    "Needed for the goal": short["need"],
                    "Chance of missing target": (1 - short["chance_met"]) * 100,
                    "Availability note": short["availability_note"].fillna(""),
                }
            ),
            Chance_of_missing_target="%.0f%%",
        )

with demand_tab:
    st.subheader(f"Demand at {warehouse_name}", anchor=False)
    st.caption("Demand units differ by department, so each has its own scale. The benchmark is the case's naive forecast, which ignores holidays.")
    daily = result["demand"]
    daily = daily[daily["store_id"] == warehouse].copy()
    daily["department"] = daily["dept_id"].map(DEPT_NAMES)
    daily["day"] = daily["day_date"].map(day_label)
    for column, name in zip(st.columns(3), DEPT_NAMES.values()):
        long = daily[daily["department"] == name].melt(id_vars="day", value_vars=["forecast", "benchmark"], var_name="series", value_name="units")
        long["series"] = long["series"].map({"forecast": "Our forecast", "benchmark": "Benchmark"})
        with column:
            st.markdown(f"**{name}**")
            st.altair_chart(week_lines(long, days, "units", "series", {"Benchmark": DRAFT_COLOR, "Our forecast": DEPARTMENT_COLORS[name]}, "Demand units", ",.1f", height=240, day_size=10), width="stretch")
    st.markdown("**What drives each day**")
    driver_department = st.segmented_control("Department", list(DEPT_NAMES.values()), default="Front End", required=True, key="driver_department", label_visibility="collapsed")
    drivers = daily[daily["department"] == driver_department]
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

with why_tab:
    st.subheader("Why this recommendation", anchor=False)
    action_by_label = dict(zip(blocks["label"], blocks["action"]))
    st.selectbox(f"Block at {warehouse_name}, largest changes first", options, format_func=lambda label: f"{label}: {action_by_label[label]}", key="why_block")
    block_panel(selected_block, goal, full=True)
    with st.expander("Assumptions behind this recommendation", icon=":material/fact_check:"):
        st.markdown("\n".join(f"- **{item}:** {ASSUMPTIONS[item]}" for item in selected_block["assumption_ids"]))

with playbook_tab:
    actions = submitted["actions"][scenario]
    st.subheader(f"What to do: {scenario}", anchor=False)
    st.caption("These are for the plan as submitted, so they don't change with the what-if settings.")
    st.markdown(f"**Use this plan when:** {actions['trigger']}")
    st.markdown("\n".join(f"- {safe(action)}" for action in actions["actions"]))
    st.subheader("Before the week: limit holiday PTO", anchor=False)
    pto = submitted["pto"]
    st.markdown(
        f"Holiday PTO is a main cause of the Feb 14-16 shortage. In BASE, {int(pto.iloc[0]['blocks_below_goal'])} blocks can't reach the goal as things stand. "
        "This shows what happens if the warehouses keep some of those people working, never more than each block lost against recent weeks. "
        "Cost falls because regular staff replace overtime. The data doesn't show how much PTO is already approved, so this assumes some of it can still be limited."
    )
    table(
        pd.DataFrame(
            {
                "Limit on people kept per block": pto["kept_per_block"],
                "Employee shifts kept": pto["people_kept"],
                "Blocks below the goal": pto["blocks_below_goal"],
                "Expected service": pto["expected_met"] * 100,
                "Labor cost": pto["cost"],
                "Overtime hours": pto["overtime_hours"],
            }
        ),
        Expected_service="%.1f%%", Labor_cost="$%,.0f", Overtime_hours="%,.0f",
    )
    st.subheader("On the day", anchor=False)
    st.markdown("\n".join(f"- **If:** {rule['trigger']}  \n  **Then:** {rule['action']}" for rule in submitted["on_the_day"]))
    st.subheader(f"Tightest blocks at {warehouse_name}", anchor=False)
    tightest = blocks.sort_values(["cushion_people", "cushion_demand"]).head(8)
    table(
        pd.DataFrame(
            {
                "Block": tightest["label"],
                "Plan": tightest["recommended"],
                "People it can lose": tightest["cushion_people"],
                "Extra demand it can take": tightest["cushion_demand"] * 100,
            }
        ),
        Extra_demand_it_can_take="%.0f%%",
    )
