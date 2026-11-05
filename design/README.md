# The shared look

`tokens.json` is the one place the Workforce Planner's look is defined. The web app, the deck, the report's charts and the notebook all read it, so they look like one product (D-26). It's a palette and a few sizes, not a design system (D-23): change any value when something looks better, then rebuild.

## The idea

A calm slate workspace held inside a dark navy frame (top bar and sidebar). White cards sit on a very light canvas. One confident color, **iris** (`#5B45DB`), marks the plan and everything you can click. The draft is always neutral gray and the benchmark is always a dashed gray line, so the plan stands out in every chart in every medium. Status colors (good, warning, risk) are reserved for state and always come with an icon and a label.

## Who reads it

| Consumer | How |
|---|---|
| Web app | `node scripts/build_tokens.mjs` writes `web/src/styles/tokens.css` (CSS variables `--wp-*`). It runs automatically before `npm run dev` and `npm run build` in `web/`. Tailwind maps the variables to utilities such as `bg-surface`, `text-ink-muted`, `border-border` |
| Report and notebook charts | `src/viz_style.py` (to be written) builds a matplotlib style from this file |
| Deck | `scripts/deck/theme.js` builds the pptxgenjs theme, text styles, card, chip and KPI tile shapes, and native chart options. Text and marks use 1 px = 1 pt, so slide text never falls under 14pt; only hairlines use pt = px x 0.75. Slide sizes are set explicitly in `theme.js` (title 32, KPI 32, hero 60, body 16, caption 12 for footers only). PowerPoint can't round chart bar ends, and the 6-4 benchmark dash becomes its "dash" preset. The warning-zone band in charts uses `warning_soft` |

## Format

Every entry is `{ "value": ..., "use": "..." }`. Colors are hex, sizes are px, unitless numbers are ratios. Scales are arrays, light to dark. Keep it flat: add a role here, not a one-off color in code.

## Color roles

| Role | Value | Use |
|---|---|---|
| canvas | `#F3F5F8` | Page background behind cards |
| surface | `#FFFFFF` | Cards, tables, charts, the drawer, white slides |
| raised | `#F7F8FA` | A panel on a card: table headers, row hover, inset callouts; callout boxes on slides |
| border / border_strong | `#E2E6EC` / `#CDD3DC` | Hairlines / control outlines |
| ink / ink_muted / ink_subtle | `#141A2E` / `#4A5468` / `#636C80` | Text: primary, secondary, captions and ticks. All pass WCAG AA (4.5:1) on surface, raised and canvas |
| accent (= plan) | `#5B45DB` | The plan, links, selection, primary buttons, focus. 6.3:1 on white |
| accent_strong / accent_soft / accent_line | `#4A35C4` / `#EEEBFD` / `#D4CEFA` | Hover, light accent wash, its border |
| draft / draft_soft | `#8A92A1` / `#E6E9EE` | The manager's draft. Gray on purpose: it fails the chroma floor by design, so it never reads as a series |
| benchmark | `#5E677A` | The case's naive forecast, dashed `6 4` |
| good / warning / risk | `#1F8A4E` / `#E0950B` / `#D2393E` | Status marks and icons, each with `_soft` (chip fill) and `_ink` (text) partners |
| dept_front_end / dept_merchandising / dept_pharmacy | `#2E90BE` / `#8E6414` / `#94408F` | Cerulean, bronze, plum. Marks only; department text stays in ink |
| navy / navy_raised / navy_border | `#131A36` / `#1F2850` / `#2C3561` | App frame, title slides, tooltips |
| navy_ink / navy_ink_muted / navy_accent | `#FFFFFF` / `#B4BCD6` / `#A79BF5` | Text and the active indicator on navy |

## Scales

- **chance** (sequential, iris, light to dark = more likely to meet the target): six stops with breaks at 80, 85, 90, 95 and 98%. Each stop names the label ink (dark or white) for a number printed on it.
- **change** (diverging, people vs the draft): bronze-orange for fewer, gray for no change, iris for more, at -3 to +3. Each stop names its label ink.
- **departments**: fixed order Front End, Merchandising, Pharmacy. Never reassigned by rank.

## Checks (run 2026-11-05 with the `dataviz` skill's `validate_palette.js`)

| Check | Result |
|---|---|
| Departments, all pairs, light, on `#FFFFFF` and `#F3F5F8` | **Pass.** Worst CVD dE 10.3 (deutan, Front End vs Pharmacy; target 8), worst normal-vision dE 20.9 (floor 15), all marks >= 3:1 |
| Departments vs status and accent | Normal-vision dE >= 14.9 for every pair. Under CVD, bronze sits close to risk and good (dE 5 to 6), which is why status always carries an icon and a label and departments never mean state |
| Accent vs Costco | Iris vs Costco blue: hue 282 vs 252 and far more saturated (normal dE 12); not red |
| chance and change ramps (`--ordinal`) | Monotone lightness, every step at least 0.06 apart, one hue per arm. The light-end contrast check fails by design: these are sequential cell fills whose light end may recede, and every cell prints its number |
| Text | ink 17.3:1, ink_muted 7.6:1, ink_subtle 4.9:1 on white and 4.5:1 on canvas, status inks >= 5.4:1 on their chips, navy_ink_muted 9.0:1 on navy |

## Type

Segoe UI: it's on every Windows laptop and in Office, so nothing downloads. The app uses Segoe UI Variable (Text for body, Display for titles and numbers). Sizes: label 14 (the floor), body 15, body_lg 16, card title 17, lead 18, section 20, page 28, KPI 30, hero 44. Tables, ticks, deltas and board cells use tabular figures.

## Charts

Horizontal solid hairline grid (`#E8EBF0`), 1px axis (`#C3C9D3`), 14px ticks and labels, 2px lines (2.5px for the plan beside draft or benchmark), 8px markers with a 2px surface ring, bars at most 24px with a 4px rounded end, bar axes from zero, never two y-axes, direct labels where they fit, navy tooltips. Shaded spans (holidays, Valentine's Day, PEAK's surge) use `chart.band` and are named in text.
