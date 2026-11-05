"""V-09 (T-77): every explanation quotes the numbers in outputs/plan_vs_draft.csv.

Reads only the two output files. Numbers are pulled out of the text by pattern and compared with
the block's own row, so a reworded template fails here instead of quietly quoting the wrong figure.
Percentages are compared as the text shows them, rounded to whole points.
"""
import re

import pandas as pd
import pytest

from src.data import ROOT

OUTPUTS = ROOT / "outputs"
KEY = ["scenario_code", "store_id", "dept_id", "day_date", "shift_code"]

DRAFT_PLAIN = re.compile(r"The draft's (\d+) people would run at (\d+)% utilization, with an? (\d+)% chance of meeting target\.")
DRAFT_UNFILLED = re.compile(
    r"The draft schedules (\d+) people, but only (\d+) can be fielded\. They would run at (\d+)% utilization, with an? (\d+)% chance of meeting target\."
)
SHORT = re.compile(
    r"^This block can't reach the goal\. It needs (\d+) people for a (\d+)% chance of meeting target, but the plan can only field (\d+), "
    r"using all of its own regular staff and overtime\. .+ The plan's chance is (\d+(?:\.\d)?)%\.$"
)
ADD = re.compile(r" Adding (\d+) brings it to (\d+)% utilization and an? (\d+)% chance\.$")
CUT = re.compile(r" That is more than this block needs\. With (\d+), it runs at (\d+)% utilization and still has an? (\d+)% chance\.$")
SAME = re.compile(r" That already reaches the (\d+)% goal, so there is no change\.$")
SERVICE = re.compile(r"^Chance of meeting target goes from (\d+)% in the draft to (\d+(?:\.\d)?)% in the plan\.$")
COST = re.compile(r"^\$([\d,]+), (?:the same as the draft|which is \$([\d,]+) (more|less) than the draft)\.$")
STAFFING = re.compile(r"^Filled with (\d+) regular(?:, (\d+) cross-trained)?(?:, (\d+) overtime)?\.$")
CUSHION = re.compile(r"can lose (\d+) (?:person|people), or take (\d+)% more demand\.$")
GOAL_POINTS = 95


def points(value: float) -> int:
    return int(f"{value * 100:.0f}")


def dollars(value: float) -> str:
    return f"{abs(value):,.0f}"


@pytest.fixture(scope="module")
def blocks() -> pd.DataFrame:
    explained = pd.read_csv(OUTPUTS / "explanations.csv", dtype={"day_date": str}, keep_default_na=False)
    plan = pd.read_csv(OUTPUTS / "plan_vs_draft.csv", dtype={"day_date": str})
    return explained.merge(plan, on=KEY, how="outer", suffixes=("", "_plan"), validate="one_to_one", indicator=True)


def failures(frame: pd.DataFrame, check) -> list[str]:
    found = []
    for row in frame.itertuples():
        problem = check(row)
        if problem:
            found.append(f"{row.scenario_code} {row.store_id} {row.dept_id} {row.day_date} {row.shift_code}: {problem}")
    return found


def assert_none(found: list[str]) -> None:
    assert not found, f"{len(found)} explanations disagree, for example:\n" + "\n".join(found[:5])


def test_every_block_has_exactly_one_explanation(blocks):
    assert len(blocks) == 567
    assert (blocks["_merge"] == "both").all()


def test_draft_plan_and_change_columns_match(blocks):
    assert (blocks["draft_scheduled_employees"] == blocks["draft_scheduled_employees_plan"]).all()
    assert (blocks["recommended"] == blocks["recommended_plan"]).all()
    assert (blocks["change"] == blocks["recommended"] - blocks["draft_scheduled_employees"]).all()


def test_action_matches_the_change(blocks):
    def check(row):
        if row.is_open == 0:
            expected = "Closed"
            if row.recommended != 0:
                return "closed block with staff"
        else:
            expected = f"Add {row.change}" if row.change > 0 else f"Cut {-row.change}" if row.change < 0 else "No change"
        return None if row.action == expected else f"action {row.action!r}, expected {expected!r}"

    assert_none(failures(blocks, check))


def test_closed_blocks_say_closed(blocks):
    closed = blocks[blocks["is_open"] == 0]
    assert len(closed) == 27
    assert (closed["why"] == "This department is closed in this block, so no staff are needed.").all()
    assert (closed[["staffing", "cost_effect", "service_effect", "cushion_text"]] == "").all().all()


def test_why_quotes_the_draft(blocks):
    def check(row):
        plain, unfilled = DRAFT_PLAIN.search(row.why), DRAFT_UNFILLED.search(row.why)
        if row.unfilled > 0:
            if not unfilled:
                return "draft can't be fully fielded, but the text doesn't say so"
            draft, fielded, util, chance = map(int, unfilled.groups())
            if fielded != row.draft_scheduled_employees - row.unfilled:
                return f"fielded {fielded}, expected {row.draft_scheduled_employees - row.unfilled}"
        else:
            if not plain:
                return "no draft clause"
            draft, util, chance = map(int, plain.groups())
        expected = (row.draft_scheduled_employees, points(row.planned_utilization_draft), points(row.chance_met_draft))
        return None if (draft, util, chance) == expected else f"draft clause {(draft, util, chance)}, expected {expected}"

    assert_none(failures(blocks[blocks["is_open"] == 1], check))


def test_why_quotes_the_plan(blocks):
    def check(row):
        util, chance = points(row.planned_utilization), points(row.chance_met)
        short, add, cut, same = SHORT.search(row.why), ADD.search(row.why), CUT.search(row.why), SAME.search(row.why)
        if sum(m is not None for m in (short, add, cut, same)) != 1:
            return "text doesn't match exactly one plan clause"
        if short:
            need, goal, fielded = map(int, short.groups()[:3])
            quoted = float(short.group(4))
            ok = (
                row.below_service_goal and goal == GOAL_POINTS and fielded == row.recommended and need > row.recommended
                and quoted < GOAL_POINTS and abs(quoted - row.chance_met * 100) < 1
            )
            return None if ok else f"short clause {short.groups()} against plan {row.recommended}, {chance}%"
        if row.below_service_goal:
            return "block is below the goal, but the text doesn't say so"
        if add:
            got, expected = tuple(map(int, add.groups())), (row.change, util, chance)
            return None if row.change > 0 and got == expected else f"add clause {got}, expected {expected}"
        if cut:
            got, expected = tuple(map(int, cut.groups())), (row.recommended, util, chance)
            return None if row.change < 0 and got == expected else f"cut clause {got}, expected {expected}"
        return None if row.change == 0 and int(same.group(1)) == GOAL_POINTS else f"no-change clause with change {row.change}"

    assert_none(failures(blocks[blocks["is_open"] == 1], check))


def test_service_effect_quotes_both_chances(blocks):
    def check(row):
        match = SERVICE.match(row.service_effect)
        if not match:
            return f"unexpected text {row.service_effect!r}"
        draft, plan = int(match.group(1)), float(match.group(2))
        if row.below_service_goal and plan >= GOAL_POINTS:
            return f"below the goal, but the plan's chance reads {plan}%"
        ok = draft == points(row.chance_met_draft) and abs(plan - row.chance_met * 100) < 1
        return None if ok else f"service {(draft, plan)}, expected {(points(row.chance_met_draft), row.chance_met * 100)}"

    assert_none(failures(blocks[blocks["is_open"] == 1], check))


def test_cost_effect_quotes_both_costs(blocks):
    def check(row):
        match = COST.match(row.cost_effect)
        if not match:
            return f"unexpected text {row.cost_effect!r}"
        cost, difference, direction = match.groups()
        if cost != dollars(row.cost):
            return f"cost {cost}, expected {dollars(row.cost)}"
        gap = row.cost - row.cost_draft
        if difference is None:
            return None if abs(gap) < 0.5 else f"says same as the draft, but differs by {gap:.2f}"
        expected_direction = "more" if gap > 0 else "less"
        ok = difference == dollars(gap) and direction == expected_direction
        return None if ok else f"difference {difference} {direction}, expected {dollars(gap)} {expected_direction}"

    assert_none(failures(blocks[blocks["is_open"] == 1], check))


def test_staffing_adds_up_to_the_plan(blocks):
    def check(row):
        match = STAFFING.match(row.staffing)
        if not match:
            return f"unexpected text {row.staffing!r}"
        regular, flex, overtime = (int(x) if x else 0 for x in match.groups())
        expected = (row.fill_regular, row.fill_flex, row.fill_overtime)
        if (regular, flex, overtime) != expected:
            return f"staffing {(regular, flex, overtime)}, expected {expected}"
        return None if regular + flex + overtime == row.recommended else "fills don't add up to the plan"

    assert_none(failures(blocks[blocks["is_open"] == 1], check))


def test_cushion_text_matches_its_columns(blocks):
    def check(row):
        if row.cushion_text == "This block has no cushion: a miss is already the likelier outcome.":
            return None if row.cushion_people == 0 and row.cushion_demand == 0 else "says no cushion, but the columns have one"
        match = CUSHION.search(row.cushion_text)
        if not match:
            return f"unexpected text {row.cushion_text!r}"
        got, expected = (int(match.group(1)), int(match.group(2))), (row.cushion_people, points(row.cushion_demand))
        return None if got == expected else f"cushion {got}, expected {expected}"

    assert_none(failures(blocks[blocks["is_open"] == 1], check))


def test_articles_read_aloud_correctly(blocks):
    """"an 8%", "an 11%", "an 18%" and "an 84%", never "a 84%"."""
    wrong = re.compile(r"\ba (?:8\d?|11|18)%")
    text = blocks[["why", "service_effect", "cushion_text"]].astype(str).agg(" ".join, axis=1)
    bad = text[text.str.contains(wrong)]
    assert bad.empty, f"{len(bad)} rows, e.g. {bad.iloc[0][:160] if len(bad) else ''}"

