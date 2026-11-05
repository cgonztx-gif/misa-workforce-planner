# Open questions

## For the organizers (T-05)

On hold: the user chose on 2026-11-04 not to send these for now, and nothing has been sent. Come back to them by Thursday.

Ready to send:

> Hi, we have a few questions on the Costco case ahead of Saturday's submission:
>
> 1. What exact time on Saturday is the submission due, and when do teams present?
> 2. How is service performance scored? Does judging apply callouts or random variation to the staffing we submit?
> 3. How exactly is usable cross-trained staff calculated? Does it follow `shift_code` (OPEN, MID, EVE), even though those shifts cover different clock hours in Front End and Merchandising?
> 4. Do we hand in the tool itself, and if so, how? How should the deck and CSV be submitted?
> 5. Can the demo be recorded? The README says live, and the PDF says live or recorded.

| ID | Question | Why it matters | Affects | Status | Answer |
|---|---|---|---|---|---|
| Q-01 | What are the submission deadline and the presentation date and time? The docs say only "November 2026". | Nothing can be scheduled without it | T-06, all milestones | Answered | Submission is due by the morning of Saturday, 2026-11-07 (user, 2026-11-03). The exact time and presentation date moved to Q-11. |
| Q-11 | What exact time on Saturday is the submission due, and when do teams present? | Sets how much of Saturday morning is usable, and when the demo must be ready | D-14, T-63, T-65 | Partly answered | **Submission is due Saturday, Nov 7, 2026 at 7:00 AM** (user, 2026-11-05). The presentation slot is still unknown. Saturday morning is too early to use, so everything must be finished Friday night (D-14). |
| Q-02 | How is service performance scored? Does judging apply callouts or random variation to submitted staffing? | Decides whether a callout buffer earns credit or only adds cost. Worth about $23,000 in BASE in our model (F-51) | A-03, T-33 | Open | The organizers haven't been asked. The user chose to plan as if judges apply callouts (2026-11-04, A-03), so an answer could only save cost. |
| Q-03 | What is the exact usable cross-trained staff calculation, and does it follow `shift_code` despite the different clock hours? | Plans could cost more than expected or be flagged infeasible | A-01, A-02, A-10, T-30 | Open | |
| Q-04 | Must the tool itself be handed in? If so, how? Also, how are the deck and CSV submitted? | Decides how much packaging is needed | D-02, T-56 | Open | |
| Q-05 | Can the demo be recorded? The README says live, and the PDF says live or recorded. | Decides whether a recording can be the main demo or only a backup | T-63, T-64 | Open | |

## For the team

| ID | Question | Why it matters | Affects | Status | Answer |
|---|---|---|---|---|---|
| Q-06 | Who is on the team, who knows Python, and who will maintain and present the tool? | Could outweigh the technical fit of the stack, and sets task owners | D-03, T-04, `PLAN.md` | Answered | A team of 4. The user has the main Python and coding experience. Tasks stay general, not per person, for now (D-15). Who presents isn't decided. (User, 2026-11-03) |
| Q-07 | What is the team name? | Goes in `team_id` on all 567 rows | T-35, T-62 | Open | Not known yet. Use the placeholder `TEAM_NAME` for now (user, 2026-11-04). On 2026-11-05 the user said again to leave it as the placeholder. The final validator rejects it, so the real name is still needed before submitting. To change it, edit `TEAM_ID` in `src/submission.py` and rerun the pipeline. |
| Q-08 | Should this folder use git? It isn't a repository yet. | Sets how the team shares work and tracks changes | T-08 | Answered | Yes (user, 2026-11-04). See D-16. |
| Q-09 | Is the proposed stack confirmed: Python, Streamlit, pandas, statsmodels, SciPy and exhaustive search? | Must be settled before scaffolding | D-03 to D-09, T-04 | Answered | Confirmed as described (user, 2026-11-03). On 2026-11-05 the user chose React with a FastAPI layer for the rebuilt web tool (D-24). |
| Q-12 | How is the presentation slot split? | Sets the deck's length and the demo script | R-01, R-02, R-32, T-65, T-93 | Answered | "6-7 min presentation, 5 minutes live demo, and 3-4 minutes of questions, as we are limited to 15 minutes max" (user, 2026-11-05). The demo is live, with a recording as backup (T-64). Q-05 stays open for the organizers. |
| Q-13 | Has anyone edited `deliverables/Costco_Case_Analysis.docx` by hand since it was built on Nov 4? | Rewriting the report (T-92) replaces the file. Word had it open on 2026-11-05 | T-92, D-20 | Answered | No hand edits (user, 2026-11-05). Git also shows the file unchanged since its commit. A copy is archived at `deliverables/archive/Costco_Case_Analysis_2026-11-04.docx`, so T-92 can rebuild freely. |
| Q-14 | What should the tool be called? | Goes in the app's header, the deck and the report | T-81, T-93 | Open | Default: "Workforce Planner". Avoid real product names and anything resembling Costco branding. |

## Housekeeping (not part of the case)

| ID | Question | Why it matters | Affects | Status | Answer |
|---|---|---|---|---|---|
| Q-10 | Should the Codex settings be imported? `~/.codex/config.toml` exists and hasn't been read. To import, reply `/import`, then `/import --yes=<digest>` using the digest from that output, or run `claude import` in a terminal. | Only if those settings are wanted in Claude Code | None | Open | |
