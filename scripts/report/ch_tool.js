// Chapter 8: the Workforce Planner tool, with a guided tour from the app's screenshots.
// SCREENSHOTS is the one list of images: the post-polish set in planning/evidence/web_screenshots/final/
// at 1366x768, which prints legibly. To refresh, retake them with planning/evidence/drive_web.py, check the
// crops and captions here still match, and rerun the builder.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { fx } = require("./claims");
const K = require("./kit");

const SHOT_DIR = path.join(K.ROOT, "planning", "evidence", "web_screenshots");
const SIDEBAR = 236; // px: design/tokens.json shape.sidebar_width. Cropped off after the first shot to enlarge the page.
const TOPBAR = 60; // px: design/tokens.json shape.topbar_height
const DRAWER = 436; // px: the block drawer's width at 1366 (440) less its left border, kept on its own so it prints large enough to read.
const BOARD = 1140; // px: in the full-page schedule shot, the header plus Warehouse 1's whole board.
const README = "README.md, Run the app";

const SCREENSHOTS = [
  { id: "overview", file: "final/overview_1366x768.png", crop: null, width: 624,
    caption: "The Overview page for BASE across all warehouses. Each scenario card runs from the draft's expected service (gray) to the plan's (iris), against the dotted per-block goal.",
    alt: "The Overview page: headline tiles against the draft, then the three scenarios side by side as dumbbells on a full scale." },
  { id: "schedule", file: "final/schedule_1366x768_full.png", crop: { left: SIDEBAR, height: BOARD }, width: 560,
    caption: "The Schedule page in BASE for all warehouses, showing Warehouse 1's section of the board, colored by change from the draft. The shaded columns are the Presidents' Day window.",
    alt: "The Schedule page: a headline counting people added and cut, the color legend, and Warehouse 1's weekly board with every department, shift and day." },
  { id: "drawer", file: "final/drawer_1366x768.png", crop: { right: DRAWER, top: TOPBAR }, width: 360,
    caption: "The detail drawer for Warehouse 1 Front End on Saturday, Feb 14, midday: a block that can't reach the goal even with all its own staff and overtime.",
    alt: "The block drawer: draft and plan headcounts, the chance of meeting target against the goal, the reason, a link to what to do on the day, and the demand driver." },
  { id: "disrupt", file: "final/demo_8_export_1366x768.png", crop: { left: SIDEBAR }, width: 624,
    caption: "DISRUPT at Warehouse 2: the illness forces cuts, and a badge marks each block where the draft schedules more people than can be fielded.",
    alt: "The Schedule page for DISRUPT at Warehouse 2, with bronze cells for cuts and badges for blocks where the draft is over capacity." },
  { id: "demand", file: "final/demand_1366x768.png", crop: { left: SIDEBAR }, width: 624,
    caption: "The Demand page in BASE: our forecast against the benchmark, by day, for each department.",
    alt: "The Demand page: forecast against benchmark line charts, one per department." },
  { id: "cost", file: "final/cost-service_1366x768.png", crop: { left: SIDEBAR }, width: 624,
    caption: "The Cost and service page, opening with BASE's totals against the draft.",
    alt: "The Cost and service page: headline tiles and the start of the scenario and department table." },
  { id: "lab", file: "final/whatif_result_1366x768.png", crop: { left: SIDEBAR }, width: 624,
    caption: "A what-if on BASE with more demand and more callouts than history. Each tile compares the re-planned week with the submitted plan kept as it is under the same conditions.",
    alt: "The Scenario lab after a what-if: totals against the submitted plan if kept as submitted, and a grid of changed blocks for each warehouse." },
  { id: "playbook", file: "final/playbook_1366x768.png", crop: { left: SIDEBAR }, width: 624,
    caption: "The Playbook page, opening with the holiday PTO test, labeled BASE across all warehouses.",
    alt: "The Playbook page: the holiday PTO test with small charts." },
  { id: "methods", file: "final/methods_1366x768.png", crop: { left: SIDEBAR }, width: 624,
    caption: "The Methods page: the engine's seven steps, from the case's data to a reason for every block.",
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
      const height = Math.min(shot.crop.height || meta.height, meta.height) - top;
      image = image.extract({ left, top, width: meta.width - left, height });
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
    K.P("The dark top bar holds the two choices that apply everywhere: the **scenario** (BASE, PEAK or DISRUPT) and the **warehouse** (all, or WH1, WH2 or WH4, each with its size). They carry across pages, and the address keeps them, so a refresh keeps the view. A \"Simulated data\" badge sits beside the logo on every page. The sidebar groups the pages into the plan, what to do when things change, and how it works, and its Download CSV button saves the submission from anywhere."),
    K.H3("Overview: the answer"),
    ...SHOT("overview"),
    K.P("The Overview states the answer in one sentence, then shows labor cost, hours, expected service, blocks below the goal and blocks over capacity, each against the draft. The expected service tile defines itself: the average chance a block meets its wait target. Below, a card for each scenario runs from the draft's expected service to the plan's on a full scale, with the per-block goal marked; clicking a card switches to that scenario. Further down, hours and expected service by day show where the week is tight, and alerts link each problem day to the Playbook."),
    K.H3("Schedule: the weekly board"),
    ...SHOT("schedule"),
    K.P("The Schedule page is the plan itself. Its headline counts the people the plan adds and cuts against the draft, the net change, and the blocks that stay below the goal. The board has one cell per block, with departments and shifts down the side and days across the top; with all warehouses selected, each warehouse gets its own section. Each cell shows the plan's headcount, its change from the draft, and the draft it came from. The colors can show the change from the draft, the chance of meeting target, or utilization."),
    K.P("**How to read the board.** Iris cells get more people than the draft, darker for bigger changes, up to three or more; bronze cells get fewer, down to three or fewer; gray cells are unchanged. A red triangle marks a block below the service goal even at capacity. Hatched cells are closed. The row under each board totals people per day."),
    K.H3("Block detail: how a recommendation explains itself"),
    ...SHOT("drawer"),
    K.P("Clicking any cell opens its detail drawer. It gives the draft and plan headcounts, and the chance of meeting target under each, against the goal. Then comes the reason in plain words. For a block that can't reach the goal, a single link leads to what to do on the day in the Playbook. Below that are the demand driver, the forecast demand and the callout rate allowed for, and where the staff come from: regular, cross-trained or overtime, against what the block can field. Further down are its cost against the draft, its cushion, and the assumptions it rests on. The reason is written from a template filled with that block's own numbers, so it can't invent anything (D-08). Arrows at the bottom step through the same shift on other days."),
    K.P("Switching scenario or warehouse redraws the board. In DISRUPT at Warehouse 2, the illness forces cuts, and a badge marks every block where the draft schedules more people than can be fielded. The **Changes** tab lists every block that differs from the draft, with filters for added or cut blocks and for each department.", { para: { keepNext: true } }),
    ...SHOT("disrupt"),
    K.H3("Demand: when it rises and falls"),
    ...SHOT("demand"),
    K.P("The Demand page shows our forecast against the case's benchmark for each department, with the holiday window and Valentine's Day shaded, and how far apart the two are. Further down, it breaks one day's demand into its parts (a normal day, the holiday effect, Valentine's Day, and the scenario's surge), shows the shift split, and lists the drivers we tested, as in chapter 4."),
    K.H3("Cost and service: what it costs and what it buys"),
    ...SHOT("cost"),
    K.P("This page sets every scenario and department against the draft in one table: labor cost, hours, expected service, blocks below the goal, overtime and cross-trained hours. Cost changes are shown in neutral gray, because spending more is neither good nor bad on its own. Below the table, the blocks below the goal are listed ten at a time, with a link to show them all, followed by the trade-offs from chapter 5: the service goal, and what the callout allowance costs."),
    K.H3("Scenario lab: running a what-if"),
    ...SHOT("lab"),
    K.P(`The Scenario lab re-plans the week live under new conditions: a different service goal, callouts as a multiple of history, demand above or below the forecast, or fewer regular staff. It reruns the forecast, the search and the risk model for every block, which takes a few seconds. Each tile then compares the re-planned week with the submitted plan kept as it is under the same conditions, labeled "If kept as submitted", which answers "what if we don't re-plan?". A map shows every block that changes. The submitted plan itself never changes, and **Reset** brings it back. Quick-start buttons set common cases, such as a busier week or an illness wave.`),
    K.H3("Playbook: what to do"),
    ...SHOT("playbook"),
    K.P("The Playbook holds chapter 7's actions and follows the scenario and warehouse chosen in the top bar. It opens with the holiday PTO test, which is always run on BASE across all warehouses and says so, then shows which plan to run and when, and the rules for the day. Links jump to the Schedule with the right scenario and day selected."),
    K.H3("Methods: how it works"),
    ...SHOT("methods"),
    K.P("The Methods page explains the engine in seven steps, from the case's data to a reason for every block, and why the plan gives totals per block. It then shows how well the model holds up on data it didn't see, and lists every assumption, with ours marked \"Our judgment\" apart from the case's own."),
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
