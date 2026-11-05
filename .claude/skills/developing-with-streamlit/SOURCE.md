# Where this skill came from

Streamlit's own skill for building apps, copied unchanged except for adding `LICENSE` and this file.

- **Source:** the `streamlit/.agents/skills/developing-with-streamlit/` folder of the Streamlit 1.57.0 wheel on PyPI
- **Wheel SHA-256:** `0d1d41972aeade5637dbb0e7f0eefa5312272f85304923d240a1b1f0475249c8`
- **License:** Apache-2.0. `LICENSE` is copied from `streamlit/agent-skills`, Streamlit's repository for its skills, and the wheel declares the same license.
- **Copied:** 2026-11-04, reviewed before installing. See F-58 and D-22 in `planning/`.

## Using it in this project

- The app is pinned to Streamlit 1.56.0, and this skill was written for 1.57, the first release to include it. All 65 `st.*` commands named in its UI references exist in 1.56, but check before relying on a parameter.
- **Don't use its themes in `assets/templates/themes/`.** All 12 load fonts from Google, and the demo must work with Wi-Fi off. Rerun `planning/evidence/drive_app.py` after UI changes: it reports any request that leaves the machine.
- Its app templates are examples only, and nothing runs them.

## To update it

Newer Streamlit versions include a newer copy, and `streamlit skills` installs it. That needs Streamlit 1.58 or later, so it means upgrading the app first and retesting it.
