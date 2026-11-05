// Appendices: output files, the submission format, how to reproduce everything, and the glossary.
const { fmt, fx } = require("./claims");
const K = require("./kit");
const D = require("./data");

const { int } = fmt;
const { s } = D;

function appendices() {
  const closed = D.planSum({ is_open: "0" }, null, "is_open=0");
  const problems = new D.Num(D.S.validator_problems.length, "analysis_summary.json:validator_problems (count)");
  return [
    K.H1("A", "Output files and fields"),
    K.P("Running the pipeline writes these files to the outputs folder. The report, the deck, the notebook and the app all read them, so they always agree."),
    ...K.TABLE("tab:outputs", "Files written by the pipeline and the chart script.",
      ["File", "What it holds"],
      [
        ["TEAM_SUBMISSION_TEMPLATE_filled.csv", "The submission: every block in every scenario, with total employees"],
        ["plan_vs_draft.csv", "Every block: demand, plan, draft, staff sources, capacity, cost, utilization, chance of meeting target, and whether it is below the goal"],
        ["explanations.csv", "Every block: the action, the reason, the demand driver, cost and service effects, the cushion and the assumptions it rests on"],
        ["capacity_gaps.csv", "People short of the goal by scenario, day and department"],
        ["goal_tradeoff.csv", "Cost and expected service at each service goal"],
        ["pto_what_if.csv", "The holiday PTO test"],
        ["forecast_daily.csv, forecast_blocks.csv", "The forecast by day and by block, with the benchmark"],
        ["service_limits.csv", "Utilization for a high, medium and even chance of meeting target, by department and warehouse"],
        ["diagnosis_*.csv", "The historical diagnosis: staffing gaps, callout rates and service by utilization"],
        ["analysis_summary.json", "Every headline figure, read by this report"],
        ["charts/*.png, charts/figure_data.json", "This report's charts, and the figures they are drawn from"],
      ], [3500, 5860], { align: ["l", "l"] }),
    K.P("The main fields of plan_vs_draft.csv: **recommended** is the plan's total employees; **draft_scheduled_employees** is the draft; **fill_regular**, **fill_flex** and **fill_overtime** split the plan by source; **capacity** is the most the block can field; **cost** follows the case's rule; **planned_utilization** and **chance_met** are the plan's utilization and chance of meeting target; **below_service_goal** flags blocks that can't reach the goal; **unfilled** counts draft staff who can't be fielded."),
    K.H1("B", "The submission format and its validation", { pageBreak: false }),
    K.P(`The submission template has ${int(s("kpi.plan_blocks"))} rows: every warehouse, department, day and shift in all three scenarios. We fill **submitted_employees** with each block's total employees, and ${fx("0", "data pack README: enter 0 for closed blocks")} for the ${int(closed)} closed blocks. Rows are joined to the plan on their keys (scenario, warehouse, department, date and shift), never by row order, because the template sorts shifts alphabetically.`),
    K.P(`Before saving, a validator checks that every row is present and matches its keys, that every value is a whole number, that closed blocks are zero, and that every open block is at or above minimum staff and within capacity. On the frozen plan it found ${int(problems)} problems. Its final mode also rejects the placeholder team name, which must be replaced before submitting:`),
    ...K.CODE([
      "# First set TEAM_ID in src/submission.py, then rebuild",
      "python -m src.pipeline",
      "# Then the final check prints Passes, or the problems it found",
      "python -c \"import pandas as pd; from src.submission import validate; print(validate(pd.read_csv('outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv', parse_dates=['day_date']), final=True) or 'Passes')\"",
    ]),
    K.H1("C", "How to reproduce everything", { pageBreak: false }),
    K.P("After the setup steps in chapter 8, these commands rebuild every result from the case's files. The pipeline takes a minute or two. The documents need Node.js and one npm install."),
    ...K.CODE([
      "python -m pytest                     # every test",
      "python -m src.pipeline               # the analysis: writes outputs/",
      "python -m src.charts                 # this report's charts: writes outputs/charts/",
      "python planning/evidence/ws1_checks.py --full    # the independent checks",
      "node scripts/build_analysis_doc.js   # this report, its claims register and its PDF",
    ]),
    K.P("Every calculated figure in this report is read from those outputs by the report's builder, never typed. The builder records each figure with the file and key it came from in planning/evidence/report_claims.json, and refuses to build if any number lacks a source. Where a figure is a fixed fact of the case, such as a service target, the register cites the case document instead."),
    K.H1("D", "Glossary", { pageBreak: false }),
    ...K.TABLE("tab:glossary", "", ["Term", "Meaning"],
      [
        ["Block", "One warehouse, department, day and shift: the unit the plan is made in."],
        ["Draft", "The manager's draft schedule for the planning week, given by the case."],
        ["Scenario", "One set of conditions for the week: BASE (expected), PEAK (more demand) or DISRUPT (fewer staff)."],
        ["Workload units", "Each department's own measure of demand. Units are never compared across departments."],
        ["Utilization", "The hours of work a block's demand needs, divided by the hours its staff actually work."],
        ["Meets target", "A block whose wait or response time is at or under its department's target."],
        ["Service curve", "How the chance of meeting target falls as utilization rises, fitted on history for each department."],
        ["The cliff", `The narrow range of utilization, near ${fx("85-90%", "F-03: the service cliff (src/diagnosis.py utilization bands)")}, where service breaks down.`],
        ["Chance of meeting target", "Our model's estimate for one block, allowing for forecast error and callouts."],
        ["Expected service", "The average chance of meeting target across open blocks."],
        ["Service goal", "The chance of meeting target the plan aims for in every block."],
        ["Callout", "A scheduled employee who doesn't come in. Backfill replaces some of them with overtime."],
        ["Cross-trained staff", "Front End and Merchandising employees who can work in the partner department in the same shift."],
        ["Capacity", "The most people a block can field: regular staff, usable cross-trained staff and overtime."],
        ["Cushion", "The people a block can lose, or the extra demand it can take, before missing target becomes likelier than not."],
        ["Benchmark", "The case's naive forecast: the average of the same weekday over the last four weeks of history."],
        ["Holiday window", "Friday to Monday around a holiday: the MLK weekend in January, the Presidents' Day weekend in the planning week."],
        ["PTO", "Paid time off. Holiday-weekend PTO requests reduce available staff on Feb 14-16."],
        ["Backtest", "Testing a forecast on past weeks it wasn't fitted on."],
        ["Brier score", "A measure of how good predicted chances are: the average squared gap between prediction and outcome. Lower is better."],
      ], [2400, 6960], { align: ["l", "l"] }),
  ];
}

module.exports = { appendices };
