# Where this skill came from

Anthropic's skill for testing local web apps with Playwright. Copied unchanged except for adding this file.

- **Source:** `skills/webapp-testing/` in https://github.com/anthropics/skills, commit `ca45fc496a3436251f191354091d557da31c15b5` (Oct 28, 2026)
- **SKILL.md SHA-256:** `8bc27790f6e6dfc2bfa6692326d4518baacf6a31dcc646d963c729adad2f7e34`
- **License:** Apache-2.0 (`LICENSE.txt`)
- **Copied:** 2026-11-05, reviewed before installing. It holds instructions, one helper (`scripts/with_server.py`, which starts the server commands you give it, waits for the port, runs your test, then stops them) and three examples. It has no hooks or MCP servers and makes no network calls. See F-60 and D-25 in `planning/`.

## Using it in this project

- It drives the new web app (D-24) in headless Chromium. Playwright 1.64.1 and its Chromium build are installed (`requirements-dev.txt`).
- The examples write to Linux paths such as `/tmp` and `/mnt/user-data/outputs`. On this machine, save screenshots under `planning/evidence/` or the session scratchpad instead.
- `with_server.py` runs its server commands through the shell, so only pass it commands from this repository.
