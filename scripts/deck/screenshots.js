// The app screenshots the deck uses, in one place, so the final polished app's shots can replace them.
// Each entry: the file (1920 x 1080 from drive_web.py) and its callouts, as fractions of the image width and height.
// When a shot is replaced, check each callout still sits on empty space beside what it names.
const path = require("path");

const DIR = path.join(__dirname, "..", "..", "planning", "evidence", "web_screenshots");

const SCREENSHOTS = {
  demo: {
    file: path.join(DIR, "schedule_drawer_feb14_fe_mid_1920.png"),
    alt: "The Workforce Planner's Schedule page, Warehouse 1, BASE, with the Why drawer open on Sat Feb 14, Front End, Midday",
    callouts: [
      { n: 1, x: 0.61, y: 0.028, title: "Scenario switch", text: "BASE, PEAK or DISRUPT, for one warehouse or all" },
      { n: 2, x: 0.151, y: 0.555, title: "The board", text: "Every block of the week, colored by its change from the draft" },
      { n: 3, x: 0.673, y: 0.1, title: "Why drawer", text: "Each block's reason, staff sources, cost, risk and cushion" },
      { n: 4, x: 0.112, y: 0.306, title: "Scenario lab", text: "Change demand or callouts and rerun the plan live" },
    ],
  },
};

module.exports = { SCREENSHOTS };
