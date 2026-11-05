# UI guide

**The goal is an app that looks good and makes the story easy to follow in a live demo.** It's being built once, for this competition, so this is direction, not a design system. The colors, layout, spacing and wording below are the current choices, and any of them can change whenever something looks better. No test checks them (D-23).

## The only real limits

These matter because the case or the demo depends on them. Everything else is a matter of taste.

| Limit | Why |
|---|---|
| Show scenario input, staffing, labor cost, service risk, reasons and what to do | The case requires them (see "Screen by screen") |
| Numbers come from the calculations, and the default view is the submitted plan | A test compares the app's defaults with the submission CSV |
| The simulated-data label stays visible | The case requires it (R-30), and a test checks it |
| It works with Wi-Fi off | The demo can't depend on the internet, so no fonts or themes from the web. This rules out all 12 ready-made themes in the Streamlit skill |
| It doesn't look like official Costco material | This is a student entry using simulated data, so no Costco logo or brand look |

## Who it's for

| Who | What they need |
|---|---|
| Judges, watching for about 2 minutes | To see in seconds that this is more than a dashboard: it recommends, explains and responds |
| A warehouse leader | Where, when and how much labor is needed, why, and what to do when things change |
| Teammates | To drive the demo confidently, and to take screenshots for the deck |

## The look right now

**The idea: a weekly shift board.** A warehouse leader already thinks in a wall schedule, with days across and shifts down. So the staffing board is the one bold element, and everything around it stays calm.

| Element | Current choice |
|---|---|
| Background | White, with a soft gray-blue sidebar (`#f1f4f6`) |
| Text | Dark slate (`#1f2933`), with gray-blue for quieter text (`#52606d`) |
| Accent and plan | Deep blue (`#1c5cab`) |
| Draft and benchmark | Gray (`#9aa3ad`), so the plan stands out |
| Board colors | Orange (`#eb6834`) for fewer people than the draft, blue (`#2a78d6`) for more, and pale gray for no change |
| Departments | Front End blue, Merchandising orange, Pharmacy green. These passed the color-blind check |
| Font | Segoe UI, already on Windows, so it works offline |
| Shape | Soft 8px corners, one bordered summary band, and few other boxes |

To change these, edit `.streamlit/config.toml` for the theme, and the constants at the top of `app.py` and `src/app_data.py` for chart colors. The Word file's charts in `src/charts.py` are separate.

## Screen by screen

The top of the page always gives the answer first: one or two plain sentences on what the plan does, then a summary band comparing it with the draft.

```text
+-----------+--------------------------------------------------+
| Scenario  | Workforce Planner                                |
| Warehouse | Simulated-data label                             |
|           | [What-if notice, only when active]               |
| What if?  | The answer, in a sentence or two                 |
|  sliders  | Cost | Hours | Service | Capacity | Below goal   |
|  reset    +--------------------------------------------------+
|           | Staffing | Cost and service | Demand | Why | ... |
| Terms     | The chosen tab                                   |
+-----------+--------------------------------------------------+
```

| Tab | What it does | Requirements |
|---|---|---|
| Sidebar | Picks the scenario and warehouse. Sliders change callouts, demand and the service goal, and recalculate the plan | R-04, R-13, R-20 |
| Staffing | The weekly board. Clicking a block shows why it changed. Has a table version and a download | R-11, R-17, R-18, R-21 |
| Cost and service | All three scenarios side by side, then the warehouse day by day and by department, and its blocks below the goal | R-04, R-12, R-19 |
| Demand | Our forecast against the benchmark for each department, and what drives each day | R-09, R-16 |
| Why | Any block's full reason: demand, staffing, availability, cost, service, cushion and assumptions | R-14, R-22 |
| Playbook | When to use this scenario's plan, what to do, the holiday PTO test, rules for the day and the tightest blocks | R-20, R-23 |

## How it behaves

| Situation | What happens |
|---|---|
| First load | A spinner, for up to 20 seconds. **Open the app once before presenting** |
| Switching scenario or warehouse | Under about a second, and the same tab and block stay selected, so comparing is easy |
| Moving a what-if slider | Recalculates in about 2 to 5 seconds, and a notice says this isn't the submitted plan. The open tab stays open, and Reset what-if returns to the plan |
| Clicking a board cell | The cell gets an outline, the panel below explains it, and the Why tab moves to the same block |
| A block below the goal | A ! on the board, a red badge in the panel, and a line in the blocks-below-the-goal table |
| Every block reaches the goal | The table is replaced by a short confirmation |
| Case data not extracted | The app says so and gives the two commands that fix it |

## A two-minute demo

1. **Start on BASE, Warehouse 1.** Read the answer at the top, then point at the deep blue on the holiday weekend: the draft ignored it.
2. **Click a block on Saturday.** The tool says why, in plain words, using its own numbers.
3. **Switch to PEAK, then DISRUPT at Warehouse 2.** The plan changes with the conditions, and the orange shows illness cutting Front End.
4. **Move the demand slider up.** The plan recalculates live, which shows this is more than a dashboard.
5. **Open the Playbook.** Finish on the holiday PTO table: limiting PTO improves service and lowers cost.

This is a starting point for the rehearsal (T-63, T-65). Time it and adjust it.

## Writing on screen

- Say the answer first, and use plain words a warehouse leader would use.
- Use sentence case, and name things the way the case does: BASE, PEAK, DISRUPT, Front End, Merchandising, Pharmacy.
- Say "Expected service" and make clear that it's a prediction.
- Pass generated text with dollar amounts through `safe()` in `app.py`, or two dollar signs in a line render as a math formula. A test checks this.

## Charts and tables

The `dataviz` skill covers charts. In short: every chart has a hover readout, color is never the only signal (numbers and a ! appear on the board, and tables sit alongside), and numbers in tables stay numeric so columns sort properly.

## Changing the UI

Everything is in `app.py`, with testable helpers in `src/app_data.py`. Streamlit's guidance is to keep an app this size in one file, and a one-time build doesn't need more structure.

Three skills help, and they load in Claude Code sessions (D-22): `developing-with-streamlit` for layout and behavior, `frontend-design` for visual direction and wording, and `dataviz` for charts.

Change whatever looks better, then check it the way people will see it:

```bash
python -m pytest tests/test_app.py
python -W ignore planning/evidence/drive_app.py
```

The second command drives the app in Chrome and saves screenshots to `planning/evidence/app_screenshots/`. **Look at them, including `10_laptop_size.png`,** which shows what a projector-sized screen sees. Its results also list any request that left the computer, which should be none. Tests can't see visual problems: a blank chart and garbled dollar amounts both passed the tests and only showed up in a browser (F-56, F-59).

## Before the demo

- [ ] Open the app once, so the slow first load is out of the way.
- [ ] Try it with Wi-Fi off (T-63).
- [ ] Check it on the actual laptop and projector.
- [ ] Reset any what-if settings, and start on BASE, Warehouse 1.
- [ ] Have the backup recording ready (T-64).
