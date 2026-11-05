# Draft 3: a calmer deck and app

On Thu Nov 5 the user said the deck and the web app are much too cluttered, with too many words and too much on each screen. They asked for a third draft built on the `dashboard-design` skill (installed in `~/.claude/skills/dashboard-design`, from github.com/abdiraimov-otabek/dashboard-design-skill), with the current versions kept as the fallback. **Every page and slide should have one obvious message.**

The numbers stay as they are. This is presentation work only, on top of `numbers-freeze` (D-28). Every figure still comes from `outputs/` through the API or `deck_data.js`.

## The fallback (draft 2)

| What | Draft 2, the fallback | Draft 3, the new version |
|---|---|---|
| Git | Tag `draft-2` (commit 20a7bcc) | `main` |
| App | `web/dist-draft2`, started with `python -m server --draft2` or `start_app_draft2.bat` | `web/dist`, started with `python -m server` or `start_app.bat` |
| Deck | `deliverables/Costco_Workforce_Presentation.pptx` and `.pdf` (copies in `deliverables/archive/*_draft2.*`) | `deliverables/Costco_Workforce_Presentation_draft3.pptx` and `.pdf`, built by `node scripts/deck/build_deck_draft3.js` |

The draft 2 deck builder (`build_deck.js`) still works and is unchanged. Packaging (`scripts/package_submission.py`) still takes the draft 2 deck until the team picks draft 3.

## Principles (from the skill, adapted)

1. **One question per screen, answered at first glance.** Each page and slide names its question, and three to six numbers answer it. In 3 seconds a reader should get the answer without hovering or reading a paragraph.
2. **Wordless.** On screen: names, numbers, units, a one- or two-word baseline ("vs draft"), legend labels, button verbs and one- or two-word chips. Explanations go in tooltips (app) or speaker notes (deck). The target is zero sentences outside tooltips, empty states and the block drawer's single reason line. Deck titles are the only exception: one line, a short claim of 4 to 8 words.
3. **Quiet.** Draft and other series are gray, the plan is the one accent (iris), and warm color (amber, then red) appears only on a problem: a block below the goal, or over capacity. Department hues appear only where departments are being told apart, never as decoration.
4. **Say it once.** A number appears once as a claim on each screen. No card repeats a KPI tile.
5. **Attention lives on the data.** A block below the goal is flagged where it sits (on the board, on the day), with its action beside it, not restated in a sentence elsewhere.
6. **Compared to what?** Every headline number has one baseline, the managers' draft, shown as a delta with "vs draft". Cost rising is the deliberate trade, so its delta is gray, not red (stated in the tooltip).
7. **Fewer, larger things.** At most 4 KPI tiles, one main chart per page, and detail below the fold. In the deck: one visual and at most three numbers per main slide.
8. **Heatmap tiers grow toward the problem.** On the board, small changes are pale, large ones medium, and below-goal blocks carry the only warm mark, so the eye lands on the risk, not on a wall of purple.

## The app, page by page

| Page | The one question | The numbers that answer it | Problem flagged on the data | Action beside it |
|---|---|---|---|---|
| Overview | Does the plan meet service this week, and what's still at risk? | Expected service, blocks below the goal, labor cost, hours, each vs draft | Days with blocks below the goal (ranked bars) | Open that day on the Schedule |
| Schedule | How many people go in each block, and where is the risk? | Headcount and change per block; people added and blocks below the goal per warehouse | Below-goal blocks: warm ring and icon on the cell | Click: the block drawer |
| Demand | When does demand rise, and what does the benchmark miss? | Forecast vs benchmark by day per department; peak gap; forecast error 2.4% vs 4.1% | The holiday days where the benchmark is low | Pick a day: its waterfall |
| Cost and service | What does the service gain cost? | Cost, service, cost per point; every scenario and department | Blocks still below the goal, with reason | Open the block |
| Scenario lab | What if conditions change? | Settings, then cost, service and below-goal changes vs the submitted plan | Blocks that drop below the goal | Reset |
| Playbook | What should a warehouse leader do? | PTO kept per block against blocks below the goal, service and cost | Tightest blocks (least cushion) | The rule for the day |
| Methods | How does it work, and can we trust it? | 7 steps; backtest error, Brier score, test count | | Report and notebook |

## The deck, slide by slide

Each main slide: a one-line title that states the takeaway, one visual, at most three numbers, and everything else in the speaker notes. The appendix answers questions and may hold a table, but no paragraphs.

| # | Title (the takeaway) | The one visual |
|---|---|---|
| 1 | Workforce Planner | Title, one line of subtitle, simulated-data chip |
| 2 | One holiday week, three scenarios | The week with the two holidays marked; three scenario chips; three departments with their wait targets as numbers |
| 3 | Service collapses past 85% utilization | The cliff chart, large, one annotation |
| 4 | The draft puts hours in the wrong places | Two numbers: hours above need, hours short of need |
| 5 | Demand peaks on the holiday weekend | Forecast vs benchmark by day; one number for the forecast error |
| 6 | Five steps from forecast to plan | Five icons with two-word labels |
| 7 | Service: 68.5% to 95.6% | Expected service by day, draft vs plan, goal line; three KPIs |
| 8 | The plan holds in every scenario | Draft to plan dumbbells for BASE, PEAK, DISRUPT |
| 9 | Limit holiday PTO | Blocks below the goal by PTO kept; the three gains as numbers |
| 10 | The demo | App screenshot with four numbered labels |
| 11 | Close | Three numbers, one line of recommendation, what we hand over |

The titles above are the intent; the builder reads every figure from `outputs/`.

## Checks

- **Words audit:** count sentences on each rendered page and slide (outside tooltips, notes and empty states). Target zero.
- **Salience test:** look at each screenshot or slide for one second. The eye must land on the answer or the problem.
- **Same numbers:** the app with default settings still shows exactly the submitted plan (`tests/test_api.py`), and `drive_web.py` passes on draft 3.
- Screenshots at 1366, 1440 and 1920 wide, looked at, not only generated. Deck slides rendered through PowerPoint and looked at.

## Status (Thu Nov 5, night)

**Built, not yet the team's pick.** Both drafts run, and the numbers are the frozen ones.

- **App (T-96):** all seven pages and the block drawer are redone. Run on rendered pages at 1440 wide, the words audit finds 0 sentences on Overview, Schedule, Demand, Cost and service, Scenario lab and Playbook. Methods keeps its assumptions list and the simulated-data notice (D-31). What changed:
  - **Overview:** four tiles, with over capacity moved into the below-goal list. One service-by-day chart. A below-goal list for all seven days, so healthy days read as a gray 0. Compact scenario tiles, and the six largest changes.
  - **Schedule:** cells on one line ("27 +4"). Pale tiers grow toward the problem, so the red below-goal marker is the loudest mark. The Warehouse 1 board now fits on one screen at 1440 × 900.
  - **Block drawer:** the reason in at most three sentences, with the rest under "More". Every section is figures, with its words in the (i).
  - **Demand, Cost and service, Lab, Playbook and Methods:** every paragraph and footer moved into its card's (i). Playbook actions show their first clause, with the full text on hover. The callout table and the board use the same chance tiers.
- **Deck (T-97):** 11 main slides with one-line titles and 12 appendix slides. Main-slide words fell from 999 to 284, and the notes run about 6:26 at 140 words a minute.
- **Consistency:** the Playbook's PTO summary shows keeping 2 per block against none, the figures on the deck's slide 9 and in the demo script.
- **Left:** the team picks draft 2 or 3. If they pick draft 3, point `scripts/package_submission.py` at the draft 3 deck. The report still shows draft 2 screenshots.
