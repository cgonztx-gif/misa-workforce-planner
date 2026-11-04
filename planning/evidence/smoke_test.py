"""Checks that a locally hosted Streamlit app works on this machine with the real planning data.

Not covered: drawing in a real browser, and running with Wi-Fi off. Rehearse those by hand.
Uses plain `python`, not `python -I`, because -I hides packages in the user site.

Run from the project root:
    python planning/evidence/smoke_test.py 2>/dev/null > planning/evidence/smoke_test.output.txt
"""
import importlib.util
import io
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PORT = 8599

teams = zipfile.ZipFile(io.BytesIO(
    zipfile.ZipFile(ROOT / "MISA.zip").read("MISA/Student Teams/Costco_Case_Competition_TEAMS.zip")
))
tmp = tempfile.TemporaryDirectory()
grid = Path(tmp.name) / "v_PlanningWeekGrid.csv"
grid.write_bytes(teams.read("team_distribution/csv/v_PlanningWeekGrid.csv"))
os.environ["GRID"] = str(grid)

import altair
import pandas
import streamlit
from streamlit.testing.v1 import AppTest

print("python", sys.version.split()[0], "| streamlit", streamlit.__version__,
      "| pandas", pandas.__version__, "| altair", altair.__version__)
modules = ["numpy", "scipy", "openpyxl", "sklearn", "statsmodels", "pytest", "pulp", "ortools", "plotly", "pyodbc"]
print("available:", {m: importlib.util.find_spec(m) is not None for m in modules})

start = time.perf_counter()
at = AppTest.from_file(str(HERE / "smoke_app.py"), default_timeout=60).run()
print(f"first run {time.perf_counter() - start:.2f}s, exceptions={len(at.exception)}")
for scenario in ["BASE", "PEAK", "DISRUPT", "BASE"]:
    start = time.perf_counter()
    at.selectbox(key="sc").select(scenario).run()
    print(f"{scenario:8s} rerun {time.perf_counter() - start:.3f}s hours={at.metric[0].value} "
          f"over_capacity={at.metric[1].value} exceptions={len(at.exception)}")

server = subprocess.Popen(
    [sys.executable, "-m", "streamlit", "run", str(HERE / "smoke_app.py"),
     "--server.headless", "true", "--server.address", "localhost", "--server.port", str(PORT),
     "--browser.gatherUsageStats", "false"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
try:
    start = time.perf_counter()
    healthy = False
    while time.perf_counter() - start < 60 and not healthy:
        try:
            body = urllib.request.urlopen(f"http://localhost:{PORT}/_stcore/health", timeout=2).read()
            healthy = body.decode().strip() == "ok"
        except OSError:
            time.sleep(0.5)
    print(f"server healthy={healthy} after {time.perf_counter() - start:.1f}s")
    page = urllib.request.urlopen(f"http://localhost:{PORT}/", timeout=5).read().decode()
    urls = sorted(set(u.strip() for u in re.findall(r"https?://[^\"' )]+", page)))
    print("page bytes", len(page), "| URLs in page:", urls or "none")
finally:
    server.terminate()
    server.wait(timeout=15)
tmp.cleanup()
