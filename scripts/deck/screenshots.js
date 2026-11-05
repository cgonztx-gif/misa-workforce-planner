// The app screenshots the deck uses, in one place, so a newer app build's shots can replace them.
// Each entry: the file (1920 x 1080 from the polished app) and its callouts, as fractions of the image width and height.
// When a shot is replaced, check each callout still sits on empty space beside what it names.
const path = require("path");

const DIR = path.join(__dirname, "..", "..", "planning", "evidence", "web_screenshots", "final");

const SCREENSHOTS = {
  demo: {
    file: path.join(DIR, "drawer_1920x1080.png"),
    alt: "The Workforce Planner's Schedule page, Warehouse 1, BASE, with the block details open on Sat Feb 14, Front End, Midday",
    callouts: [
      { n: 1, x: 0.58, y: 0.028, title: "Scenario switch", text: "BASE, PEAK or DISRUPT, for one warehouse or all" },
      { n: 2, x: 0.3, y: 0.263, title: "The board", text: "Every block of the week, colored by its change from the draft" },
      { n: 3, x: 0.677, y: 0.088, title: "Block details", text: "Click a block: its reason, chance of meeting target, staff and cost" },
      { n: 4, x: 0.112, y: 0.306, title: "Scenario lab", text: "Change demand or callouts and rerun the plan live" },
    ],
  },
};

module.exports = { SCREENSHOTS };
