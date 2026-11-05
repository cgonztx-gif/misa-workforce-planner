// The app screenshot on the draft 3 demo slide, and its numbered labels (1-3 words each).
// It prefers the draft 3 app's shot and falls back to the draft 2 shot until that exists.
// Callout x and y are fractions of the image width and height; each marker sits on empty space beside
// what it names. When the draft 3 shot lands, check the markers on the rendered slide and move them here.
const fs = require("fs");
const path = require("path");

const SHOTS = path.join(__dirname, "..", "..", "planning", "evidence", "web_screenshots");
const DRAFT3 = path.join(SHOTS, "draft3", "drawer_1920x1080.png");
const DRAFT2 = path.join(SHOTS, "final", "drawer_1920x1080.png");

const ALT = "The Workforce Planner's Schedule page, Warehouse 1, BASE, with the block details open on Sat Feb 14, Front End, Midday";
const VARIANTS = {
  draft3: {
    file: DRAFT3,
    callouts: [
      { n: 1, x: 0.58, y: 0.028, title: "Scenario switch" },
      { n: 2, x: 0.3, y: 0.263, title: "The board" },
      { n: 3, x: 0.677, y: 0.088, title: "Block details" },
      { n: 4, x: 0.112, y: 0.306, title: "Scenario lab" },
    ],
  },
  draft2: {
    file: DRAFT2,
    callouts: [
      { n: 1, x: 0.58, y: 0.028, title: "Scenario switch" },
      { n: 2, x: 0.3, y: 0.263, title: "The board" },
      { n: 3, x: 0.677, y: 0.088, title: "Block details" },
      { n: 4, x: 0.112, y: 0.306, title: "Scenario lab" },
    ],
  },
};

const which = fs.existsSync(DRAFT3) ? "draft3" : "draft2";
const SCREENSHOTS = { demo: { ...VARIANTS[which], alt: ALT, which } };

module.exports = { SCREENSHOTS, VARIANTS };
