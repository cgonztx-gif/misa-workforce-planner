// Chapter 8: the Workforce Planner tool, with a guided tour from the app's screenshots.
// SCREENSHOTS is the one list of images. After the app's final polish, retake them with
// planning/evidence/drive_web.py and rerun the builder; keep a file name here if a new shot replaces it.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { fx } = require("./claims");
const K = require("./kit");

const SHOT_DIR = path.join(K.ROOT, "planning", "evidence", "web_screenshots");
const SIDEBAR = 236; // px: design/tokens.json shape.sidebar_width. Cropped off after the first shot to enlarge the page.
const TOPBAR = 60; // px: design/tokens.json shape.topbar_height
const DRAWER = 580; // px: the block drawer's width at 1366, kept on its own so it prints large enough to read.
const README = "README.md, Run the app";

const SCREENSHOTS = [
  { id: "overview", file: "overview_base_all_1366.png", crop: null, width: 624,
    caption: "The Overview page for BASE across all warehouses.",
    alt: "The Overview page: headline tiles against the draft, then the three scenarios side by side." },
  { id: "schedule", file: "schedule_base_wh1_1920.png", crop: { left: SIDEBAR }, width: 624,
    caption: "The weekly board for Warehouse 1 in BASE, colored by change from the draft. The shaded columns are the Presidents' Day window.",
    alt: "The Schedule page's weekly board for one warehouse, with every department, shift and day." },
  { id: "drawer", file: "schedule_drawer_feb14_fe_mid_1366.png", crop: { right: DRAWER, top: TOPBAR }, width: 400,
    caption: "The detail drawer for Warehouse 1 Front End on Saturday, Feb 14, midday: a block that can't reach the goal even with all its own staff and overtime.",
    alt: "The block drawer: draft and plan headcounts, the reason, a below-goal warning and the demand driver." },
  { id: "changes", file: "schedule_changes_disrupt_wh2_1366.png", crop: { left: SIDEBAR }, width: 624,
    caption: "The Changes list for Warehouse 2 in DISRUPT, where the draft schedules people the illness has taken out.",
    alt: "The Changes list, sorted by cost change, with below-goal and unfilled badges." },
  { id: "demand", file: "demand_1366_base_all_fold.png", crop: { left: SIDEBAR }, width: 624,
    caption: "The Demand page in BASE: our forecast against the benchmark, by day, for each department.",
    alt: "The Demand page: forecast against benchmark line charts, one per department." },
  { id: "cost", file: "cost_1366_base_all_fold.png", crop: { left: SIDEBAR }, width: 624,
    caption: "The Cost and service page, opening with BASE's totals against the draft.",
    alt: "The Cost and service page: headline tiles and the start of the scenario and department table." },
  { id: "lab", file: "lab_result_1366.png", crop: { left: SIDEBAR }, width: 624,
    caption: "A what-if on DISRUPT with more demand and more callouts than history: new totals against the submitted plan, and a map of every block that changes.",
    alt: "The Scenario lab after a what-if: totals against the submitted plan and a grid of changed blocks for each warehouse." },
  { id: "playbook", file: "playbook_1366.png", crop: { left: SIDEBAR }, width: 624,
    caption: "The Playbook page, opening with the holiday PTO test.",
    alt: "The Playbook page: the holiday PTO test with small charts." },
  { id: "methods", file: "methods_1366.png", crop: { left: SIDEBAR }, width: 624,
    caption: "The Methods page: the engine's steps, and why the plan gives totals per block.",
    alt: "The Methods page: the engine's seven steps as cards." },
];

// Crop and load every screenshot before the (synchronous) document build.
async function prepareScreens() {
  const out = {};
  for (const shot of SCREENSHOTS) {
    const file = path.join(SHOT_DIR, shot.file);
    if (!fs.existsSync(file)) throw new Error(`Missing screenshot ${shot.file}; retake it or update SCREENSHOTS in scripts/report/ch_tool.js`);
    let image = sharp(file);
    const meta = await image.metadata();
    if (shot.crop) {
      const left = shot.crop.right ? meta.width - shot.crop.right : shot.crop.left;
      const top = shot.crop.top || 0;
      image = image.extract({ left, top, width: meta.width - left, height: meta.height - top });
    }
    const data = await image.png().toBuffer();
    out[shot.id] = { data, size: K.pngSize(data), shot };
  }
  return out;
}

function chapter8(screens) {
  const used = new Set();
  const SHOT = (id) => {
    if (used.has(id)) throw new Error(`Screenshot ${id} is used twice in chapter 8`);
    used.add(id);
    const s = screens[id];
    return K.IMAGE(s.data, s.size, s.shot.width, `fig:shot_${id}`, s.shot.caption, s.shot.alt);
  };
  return [
    K.H1("8", "The Workforce Planner tool"),
    K.LEAD("The case asks for more than a dashboard: a working tool a warehouse leader could use. The Workforce Planner takes a scenario and shows staffing, labor cost and service risk, explains every recommendation, and re-plans live when conditions change."),
    K.H2("What it's for"),
    K.P("A warehouse leader uses it to answer five questions: what should we schedule this week, what will it cost, where are we at risk, why did each block change, and what should we do if conditions shift. Every number comes from the same engine that produced this report and the submission file, so the tool, the report and the submission always agree."),
    K.H2("How it's built"),
    ...K.FIG("architecture", "fig:architecture", "How the pieces fit. The engine runs once to write the saved outputs, and again on demand for live what-ifs. Everything runs on one laptop.",
      "Diagram: the case data pack feeds the Python engine, which writes saved outputs used by the report and deck, and serves the React app through a FastAPI server on the same computer.", { fill: true }),
    K.P("The engine is the Python code that does the analysis: the forecast, service curves, risk model, cost rule, search and explanations. A small FastAPI server wraps it in a web interface that the React front end calls. The server listens only on the laptop itself, and nothing loads from the internet, so the demo works with Wi-Fi off. We chose this over a dashboard tool because the analysis stays in tested Python, and the interface is a real web front end, the way such a tool would be deployed (D-24). An earlier Streamlit version remains as a fallback."),
    K.H2("How to start it"),
    K.P(`The project lives in a private GitHub repository. A teammate with access needs ${fx("Python 3.13", "README.md, Run the app")} and runs these commands from the cloned folder. Running the app needs no Node.js, because the built front end is included. The full steps are in README.md.`),
    ...K.CODE([
      "git clone https://github.com/cgonztx-gif/misa-workforce-planner.git",
      "cd misa-workforce-planner",
      "python -m venv .venv",
      ".venv\\Scripts\\activate          # Windows (Mac or Linux: source .venv/bin/activate)",
      "python -m pip install -r requirements.txt",
      "python -m zipfile -e MISA.zip .",
      "python -m zipfile -e \"MISA/Student Teams/Costco_Case_Competition_TEAMS.zip\" data",
      "python -m server                 # opens http://localhost:8501 when ready",
    ]),
    K.P(`On Windows, double-clicking start_app.bat does the last step and opens the browser. The server prepares all three scenarios when it starts, which takes ${fx("15-20 seconds", README)} behind a "preparing" screen. After that, every page and scenario switch is instant. **Before a demo, start the app a minute early.**`),
    K.H2("A guided tour"),
    K.P("The dark top bar holds the two choices that apply everywhere: the **scenario** (BASE, PEAK or DISRUPT) and the **warehouse** (all, or one). They carry across pages, and the address keeps them, so a refresh keeps the view. A \"Simulated data\" badge sits beside the logo on every page. The sidebar groups the pages into the plan, what to do when things change, and how it works."),
    K.H3("Overview: the answer"),
    ...SHOT("overview"),
    K.P("The Overview states the answer in one sentence, then shows labor cost, hours, expected service, blocks below the goal and blocks over capacity, each against the draft. Below, all three scenarios sit side by side; clicking one switches to it. Hours and expected service by day show where the week is tight, and alerts link each problem day to the Playbook."),
    K.H3("Schedule: the weekly board"),
    ...SHOT("schedule"),
    K.P("The Schedule page is the plan itself: one cell per block, with departments and shifts down the side and days across the top. Each cell shows the plan's headcount, its change from the draft, and the draft it came from. The colors can show the change from the draft, the chance of meeting target, or utilization."),
    K.P("**How to read the board.** Iris cells get more people than the draft, darker for bigger changes; bronze cells get fewer; gray cells are unchanged. A red triangle marks a block below the service goal even at capacity. Hatched cells are closed. The row under the board totals people per day."),
    K.H3("Block detail: how a recommendation explains itself"),
    ...SHOT("drawer"),
    K.P("Clicking any cell opens its detail drawer. It gives the draft and plan headcounts, the reason in plain words, the demand driver for that day, the forecast demand and the callout rate allowed for, and where the staff come from: regular, cross-trained or overtime, against what the block can field. Further down are its cost against the draft, its cushion, and the assumptions it rests on. The reason is written from a template filled with that block's own numbers, so it can't invent anything (D-08). Arrows at the bottom step through the same shift on other days."),
    K.P("The **Changes** tab lists every block that differs from the draft, with filters for added or cut blocks and for each department, and badges for blocks below the goal or with people the draft can't field.", { para: { keepNext: true } }),
    ...SHOT("changes"),
    K.H3("Demand: when it rises and falls"),
    ...SHOT("demand"),
    K.P("The Demand page shows our forecast against the case's benchmark for each department, with the holiday window and Valentine's Day shaded, and how far apart the two are. Further down, it breaks one day's demand into its parts (a normal day, the holiday effect, Valentine's Day, and the scenario's surge), shows the shift split, and lists the drivers we tested, as in chapter 4."),
    K.H3("Cost and service: what it costs and what it buys"),
    ...SHOT("cost"),
    K.P("This page sets every scenario and department against the draft in one table: labor cost, hours, expected service, blocks below the goal, overtime and cross-trained hours. Below it are the trade-offs from chapter 5: the service goal, and what the callout allowance costs."),
    K.H3("Scenario lab: running a what-if"),
    ...SHOT("lab"),
    K.P(`The Scenario lab re-plans the week live under new conditions: a different service goal, callouts as a multiple of history, demand above or below the forecast, or fewer regular staff. It reruns the forecast, the search and the risk model for every block, which takes a few seconds, then compares the new plan with the submitted one block by block. It also scores the submitted plan under the new conditions, which answers "what if we don't re-plan?". The submitted plan never changes, and **Reset** brings it back. Quick-start buttons set common cases, such as a busier week or an illness wave.`),
    K.H3("Playbook: what to do"),
    ...SHOT("playbook"),
    K.P("The Playbook holds chapter 7's actions: the holiday PTO test with its charts and table, which plan to run and when, and the rules for the day. Links jump to the Schedule with the right scenario and day selected."),
    K.H3("Methods: how it works"),
    ...SHOT("methods"),
    K.P("The Methods page explains the engine in seven steps, from the case's data to a reason for every block, and why the plan gives totals per block. It then shows how well the model holds up on data it didn't see, and lists every assumption, ours marked apart from the case's."),
    ...(() => {
      const unused = SCREENSHOTS.filter((shot) => !used.has(shot.id)).map((shot) => shot.id);
      if (unused.length) throw new Error(`Screenshots listed but not used in chapter 8: ${unused.join(", ")}`);
      return [];
    })(),
    K.H2("Exporting the plan"),
    K.P("The **Download CSV** button in the sidebar saves the completed submission template with every block in every scenario, exactly as submitted. On the Schedule page, **Export this view** saves the board's blocks for the selected scenario and warehouse, with the plan, the draft, staff sources, cost and chance of meeting target for each."),
  ];
}

module.exports = { chapter8, prepareScreens, SCREENSHOTS };
