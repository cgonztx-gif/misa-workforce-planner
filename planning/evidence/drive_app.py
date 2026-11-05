"""Check the real app in Chrome: start it cold, time it, click every tab, switch scenarios and run a what-if.

Backs up F-56. Not part of the app, so Playwright isn't in requirements.txt. It uses the Chrome already
installed on the machine, so no browser download is needed. Run from the project root:

    python -m pip install playwright==1.64.1
    python -W ignore planning/evidence/drive_app.py

It starts its own server on port 8502. It writes
planning/evidence/drive_app.output.json and screenshots to planning/evidence/app_screenshots/.
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = Path(__file__).parent
SHOTS = EVIDENCE / "app_screenshots"
PORT = "8502"  # Not the usual 8501, so that this can run while a copy of the app is open.
URL = f"http://localhost:{PORT}"
results: dict = {}
CHART_BOX = """() => {
    const shown = [...document.querySelectorAll('[data-testid="stVegaLiteChart"] svg.marks')]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 300 && r.height > 200)[0];
    return shown && {x: shown.x, y: shown.y, width: shown.width, height: shown.height};
}"""


def wait_for_server() -> float:
    start = time.time()
    while time.time() - start < 90:
        try:
            if urllib.request.urlopen(f"{URL}/_stcore/health", timeout=2).read() == b"ok":
                return time.time() - start
        except OSError:
            time.sleep(0.5)
    raise SystemExit("The server did not start")


def wait_idle(page) -> None:
    """Wait until Streamlit has finished rerunning."""
    page.wait_for_timeout(200)
    page.wait_for_function("() => !document.querySelector('[data-testid=\"stStatusWidget\"]')", timeout=120000)
    page.wait_for_timeout(200)


def pick(page, option: str) -> None:
    """Click a button in the sidebar's scenario or warehouse controls."""
    page.locator('[data-testid="stSidebar"] button').filter(has_text=re.compile(f"^{option}$")).first.click()


def open_tab(page, name: str) -> None:
    page.get_by_role("tab", name=name).first.click()
    wait_idle(page)


def drive(page) -> None:
    console_errors: list[str] = []
    external: set[str] = set()
    page.on("console", lambda m: console_errors.append(m.text[:300]) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append("pageerror: " + str(e)[:300]))
    page.on("request", lambda r: external.add(r.url[:120]) if not r.url.startswith((URL, "data:", "blob:", "ws://localhost")) else None)

    start = time.time()
    page.goto(URL)
    page.get_by_text("Labor cost").first.wait_for(timeout=180000)
    wait_idle(page)
    results["first_page_seconds"] = round(time.time() - start, 2)
    page.wait_for_function(f"({CHART_BOX})()", timeout=30000)
    page.wait_for_timeout(500)
    page.screenshot(path=SHOTS / "1_staffing_base.png")

    # Hover over a cell in the staffing chart.
    box = page.evaluate(CHART_BOX)
    page.mouse.move(box["x"] + box["width"] * 0.55, box["y"] + box["height"] * 0.6)
    page.wait_for_timeout(200)
    page.mouse.move(box["x"] + box["width"] * 0.55 + 3, box["y"] + box["height"] * 0.6 + 3)
    page.wait_for_timeout(800)
    tooltip = page.locator("#vg-tooltip-element")
    results["tooltip_on_hover"] = tooltip.inner_text().replace("\n", " ")[:200] if tooltip.count() else "none found"
    page.screenshot(path=SHOTS / "2_staffing_tooltip.png")
    page.mouse.move(5, 5)

    for index, name in enumerate(["Cost and service", "Demand", "Why", "Playbook"], start=3):
        begin = time.time()
        open_tab(page, name)
        results[f"tab_{name}_seconds"] = round(time.time() - begin, 2)
        page.screenshot(path=SHOTS / f"{index}_{name.lower().replace(' ', '_')}_base.png")
    open_tab(page, "Staffing")

    for scenario, cost in (("PEAK", "$387,092"), ("DISRUPT", "$365,321"), ("BASE", "$376,176")):
        begin = time.time()
        pick(page, scenario)
        page.get_by_text(cost).first.wait_for(timeout=120000)
        wait_idle(page)
        results[f"switch_to_{scenario}_seconds"] = round(time.time() - begin, 2)
        if scenario == "DISRUPT":
            pick(page, "2")
            wait_idle(page)
            page.screenshot(path=SHOTS / "7_staffing_disrupt_warehouse_2.png")
            pick(page, "1")
            wait_idle(page)

    # A what-if from another tab: demand 5% above forecast. That tab should stay open, and the button should return to the submitted plan.
    open_tab(page, "Cost and service")
    begin = time.time()
    slider = page.locator('[data-testid="stSlider"]').filter(has_text="Demand against forecast").locator('[role="slider"]')
    slider.focus()
    for _ in range(5):
        page.keyboard.press("ArrowRight")
    page.get_by_text("What-if view").first.wait_for(timeout=120000)
    wait_idle(page)
    results["what_if_seconds"] = round(time.time() - begin, 2)
    results["what_if_cost"] = page.locator('[data-testid="stMetricValue"]').first.inner_text()
    page.screenshot(path=SHOTS / "8_what_if.png")
    results["open_tab_during_what_if"] = page.locator('button[role="tab"][aria-selected="true"]').first.inner_text()
    page.get_by_role("button", name="Reset what-if").click()
    page.get_by_text("$376,176").first.wait_for(timeout=120000)
    wait_idle(page)
    results["warning_gone_after_reset"] = page.get_by_text("What-if view").count() == 0

    # Click a board cell, on its number, and check that the panel below switches to that block.
    open_tab(page, "Staffing")
    before = page.locator("h3").filter(has_text=re.compile("in the draft to|No change:")).first.inner_text()
    box = page.evaluate(CHART_BOX)
    page.mouse.click(box["x"] + box["width"] * 0.42, box["y"] + box["height"] * 0.30)
    wait_idle(page)
    page.wait_for_timeout(500)
    results["panel_before_click"] = before
    results["panel_after_click"] = page.locator("h3").filter(has_text=re.compile("in the draft to|No change:")).first.inner_text()
    page.screenshot(path=SHOTS / "9_block_clicked.png")
    open_tab(page, "Why")
    results["why_tab_after_click"] = page.locator('[data-testid="stSelectbox"]').filter(has_text="largest changes first").first.inner_text().replace("\n", " ")[:90]
    open_tab(page, "Staffing")

    # The Why tab: choose another block.
    open_tab(page, "Why")
    box = page.locator('[data-testid="stSelectbox"]').filter(has_text="largest changes first").first
    box.locator('[data-baseweb="select"]').click()
    page.locator('[role="option"]').nth(2).click()
    wait_idle(page)
    results["why_headline"] = page.locator("h3").filter(has_text=re.compile("in the draft to|No change:")).first.inner_text()
    results["font_in_use"] = page.evaluate("() => getComputedStyle(document.querySelector('h1')).fontFamily")[:60]

    results["exceptions_on_page"] = page.locator('[data-testid="stException"]').count()
    results["console_errors"] = console_errors[:8]
    results["requests_off_this_machine"] = sorted(external)


def main() -> None:
    SHOTS.mkdir(exist_ok=True)
    server = subprocess.Popen(
        [sys.executable, "-m", "streamlit", "run", "app.py", "--server.port", PORT],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        results["server_health_seconds"] = round(wait_for_server(), 2)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="chrome", headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1500})
            drive(page)
            # The size of a typical laptop or projector, which is what judges will see first.
            page.set_viewport_size({"width": 1366, "height": 768})
            page.wait_for_timeout(800)
            page.screenshot(path=SHOTS / "10_laptop_size.png")
            browser.close()
    finally:
        # On Windows, Python can run through a launcher, so end the whole process tree.
        if os.name == "nt":
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(server.pid)], capture_output=True)
        else:
            server.terminate()
    (EVIDENCE / "drive_app.output.json").write_text(json.dumps(results, indent=1), encoding="utf-8")
    print(json.dumps(results, indent=1))


if __name__ == "__main__":
    main()
