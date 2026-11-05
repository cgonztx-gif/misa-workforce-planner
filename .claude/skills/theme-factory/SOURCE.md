# Where this skill came from

Anthropic's skill for applying one color and font theme across slides, documents and pages. Copied unchanged except for adding this file.

- **Source:** `skills/theme-factory/` in https://github.com/anthropics/skills, commit `ca45fc496a3436251f191354091d557da31c15b5` (Oct 28, 2026)
- **SKILL.md SHA-256:** `7c765e6626bf61eca30224ceeb0da51ac003c7c2f1c1743ace9b3baa305ea632`
- **License:** Apache-2.0 (`LICENSE.txt`)
- **Copied:** 2026-11-05, reviewed before installing. It holds instructions, 10 preset theme files and a showcase PDF. Nothing runs by itself. See F-60 and D-25 in `planning/`.

## Using it in this project

- **Use its "Create your own theme" path, not the presets.** The deck, the Word file and the notebook must match the web app (D-26), so the theme is the app's own colors and font, taken from `design/tokens.json` once that exists.
- The presets all use DejaVu Sans, which isn't installed on this machine, so PowerPoint would substitute another font.
- The skill says to show the user its showcase and wait for a choice. The user has already chosen to match the app, so skip that step.
