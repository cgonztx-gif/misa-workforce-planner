"""Package the hand-in folder (T-95): the staffing CSV, deck, report, notebook, and the tool's source as a zip.

Run from the project root, after the team name is set (T-62) and every deliverable is rebuilt:
    python scripts/package_submission.py            # refuses while the team name is still the placeholder
    python scripts/package_submission.py --draft    # builds anyway, for a dry run

It writes submission/ (not tracked by git), and checks the CSV with validate(final=True) first. The source zip
is `git archive` of HEAD, so commit before packaging; uncommitted changes are reported and left out.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.submission import validate  # noqa: E402

OUT = ROOT / "submission"
FILES = {
    "outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv": "TEAM_SUBMISSION_TEMPLATE_filled.csv",
    "deliverables/Costco_Workforce_Presentation.pptx": "Costco_Workforce_Presentation.pptx",
    "deliverables/Costco_Workforce_Presentation.pdf": "Costco_Workforce_Presentation.pdf",
    "deliverables/Costco_Case_Analysis.docx": "Costco_Case_Analysis.docx",
    "deliverables/Costco_Case_Analysis.pdf": "Costco_Case_Analysis.pdf",
    "deliverables/Costco_Analysis_Appendix.ipynb": "Costco_Analysis_Appendix.ipynb",
    "deliverables/Costco_Analysis_Appendix.html": "Costco_Analysis_Appendix.html",
}
README = """Workforce Planner: Texas MISA Fall 2026 case competition, Costco workforce planning challenge

All data is simulated. It is not real Costco data.

Contents
  TEAM_SUBMISSION_TEMPLATE_filled.csv   The staffing plan: all 567 rows, BASE, PEAK and DISRUPT
  Costco_Workforce_Presentation.pptx    The presentation (and a PDF copy)
  Costco_Case_Analysis.docx             The written report: analysis, results and a guide to the tool (and a PDF copy)
  Costco_Analysis_Appendix.ipynb        The code appendix, with its outputs (and an HTML copy that opens in any browser)
  Workforce_Planner_source.zip          The tool and the analysis code

Run the tool (Python 3.13; no internet needed once installed)
  1. Unzip Workforce_Planner_source.zip and open a terminal in that folder
  2. python -m pip install -r requirements.txt
  3. python -m zipfile -e MISA.zip .
     python -m zipfile -e "MISA/Student Teams/Costco_Case_Competition_TEAMS.zip" data
  4. python -m server        (it opens http://localhost:8501 once ready, after about 20 seconds)
     On Windows, double-click start_app.bat instead of step 4.

README.md inside the zip has the full steps, how to rebuild every result, and what each folder holds.
"""


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--draft", action="store_true", help="build even if the team name is still the placeholder")
    args = parser.parse_args()

    csv = pd.read_csv(ROOT / "outputs" / "TEAM_SUBMISSION_TEMPLATE_filled.csv", parse_dates=["day_date"])
    problems = validate(csv, final=True)
    if problems:
        print("The staffing CSV doesn't pass the final check:", *problems, sep="\n  ")
        if not args.draft:
            print("Fix these (T-62), or rerun with --draft for a dry run.")
            return 1
        print("Continuing because of --draft.")

    missing = [source for source in FILES if not (ROOT / source).exists()]
    if missing:
        print("Missing deliverables:", *missing, sep="\n  ")
        return 1
    dirty = git("status", "--porcelain", "--untracked-files=no")
    if dirty:
        print("Uncommitted changes are left out of the source zip:", *dirty.splitlines(), sep="\n  ")

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for source, name in FILES.items():
        shutil.copy2(ROOT / source, OUT / name)
    commit = git("rev-parse", "--short", "HEAD")
    git("archive", "--format=zip", f"--output={OUT / 'Workforce_Planner_source.zip'}", "HEAD")
    (OUT / "README.txt").write_text(README + f"\nBuilt from commit {commit}.\n", encoding="utf-8")

    total = sum(path.stat().st_size for path in OUT.iterdir())
    print(f"Wrote {OUT} from commit {commit}: {len(list(OUT.iterdir()))} files, {total / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
