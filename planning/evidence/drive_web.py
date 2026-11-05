"""Browser acceptance checks for the Workforce Planner web app (T-89, DELIVERABLES_PLAN.md 7.8 and 7.10).

    python planning/evidence/drive_web.py              # everything, 3-5 minutes
    python planning/evidence/drive_web.py --no-shots   # skip the three-viewport screenshot pass

It starts its own server (python -m server --port 8611 --no-browser), runs every check in the
browser row of 7.8 and the 5-minute demo script in 7.10, stops the server, and writes
planning/evidence/drive_web.output.json. Screenshots go to planning/evidence/web_screenshots/final/.
Each check prints PASS or FAIL with what it measured; the exit code is 1 if any check fails.
Timings are measured inside the page, from the real click to the first frame that shows the result.
All data is simulated for the Texas MISA case competition and is not Costco data.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlencode, urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
EVIDENCE = ROOT / "planning" / "evidence"
# Draft 3 (planning/DRAFT3.md) writes its own shots and record, so draft 2's (web_screenshots/final and
# drive_web.output.json, tag draft-2), which the draft 2 deck and the report use, stay as they were.
SHOTS = EVIDENCE / "web_screenshots" / "draft3"
OUTPUT = EVIDENCE / "drive_web_draft3.output.json"
SUBMISSION = ROOT / "outputs" / "TEAM_SUBMISSION_TEMPLATE_filled.csv"

# 7.8's performance budgets. The demo what-if is warmed at startup, so it should answer at once.
BUDGET = {"cold_start_s": 30.0, "page_change_ms": 300, "scenario_switch_ms": 500, "what_if_new_s": 8.0, "what_if_demo_ms": 1000}
PAGES = [("overview", "Overview"), ("schedule", "Schedule"), ("demand", "Demand"), ("cost-service", "Cost and service"),
         ("scenario-lab", "Scenario lab"), ("playbook", "Playbook"), ("methods", "Methods")]
VIEWPORTS = [(1366, 768), (1440, 900), (1920, 1080)]
SCENARIOS = ("BASE", "PEAK", "DISRUPT")
DEMO_BLOCK = "BASE|1|38|2026-02-14|MID"  # 7.10 at 1:10: Sat Feb 14, Front End, Midday, Warehouse 1
DEMO_WHAT_IF = {"demand": 0.1, "callouts": 1.5}  # 7.10 at 3:10, warmed by server/engine.py
NEW_WHAT_IF = {"demand": 0.05, "callouts": 1.25}  # not warmed, so it really runs
WAREHOUSE_RADIO = {"1": "1 Medium", "2": "2 Large", "4": "4 Large", "all": "All"}

try:
    import psutil  # optional: only adds machine-load context to the timings
except ImportError:
    psutil = None

BASE = ""  # http://127.0.0.1:<port>/, set in main()
SERVER_PID = None
R: dict = {"started": datetime.now().isoformat(timespec="seconds"), "base_url": None, "budgets": BUDGET, "checks": [],
           "timings": {}, "console": {}, "requests": {"count": 0, "hosts": {}, "schemes": {}, "external": [], "failed": []},
           "demo": [], "layout": {}, "screenshots": [], "bugs": [], "notes": []}


def check(name: str, ok: bool, value, budget=None, **detail) -> bool:
    row = {"check": name, "result": "PASS" if ok else "FAIL", "value": value}
    if budget is not None:
        row["budget"] = budget
    if detail:
        row["detail"] = detail
    R["checks"].append(row)
    print(f"{row['result']}  {name}: {value}" + (f"   (budget {budget})" if budget is not None else ""), flush=True)
    return ok


class Load:
    """System CPU use and the busiest processes between start() and stop(): context for a timing,
    since other work on the laptop (builds, notebooks) slows the server's CPU-bound what-ifs."""

    def start(self) -> "Load":
        self.procs = {}
        if psutil:
            psutil.cpu_percent(None)
            for p in psutil.process_iter(["name"]):
                if p.pid == 0:  # "System Idle Process" is idle time, not load
                    continue
                try:
                    p.cpu_percent(None)
                    self.procs[p.pid] = p
                except psutil.Error:
                    pass
        return self

    def stop(self, server_pid: int | None = None) -> dict | None:
        if not psutil:
            return None
        total, busy = psutil.cpu_percent(None), []
        for pid, p in self.procs.items():
            try:
                busy.append((p.cpu_percent(None), p.info["name"] + (" = the test server" if pid == server_pid else ""), pid))
            except psutil.Error:
                pass
        busy.sort(reverse=True)
        return {"system_cpu_percent": total, "logical_cpus": psutil.cpu_count(),
                "busiest_percent_of_one_cpu": [f"{name} (pid {pid}): {cpu:.0f}" for cpu, name, pid in busy[:6]]}


# Server ------------------------------------------------------------------------------------------

def fetch(path: str, timeout: float = 60) -> tuple[bytes, dict]:
    """Body and lower-cased headers of a GET on the server under test."""
    with urllib.request.urlopen(BASE + path, timeout=timeout) as response:
        return response.read(), {k.lower(): v for k, v in response.headers.items()}


def api(path: str):
    return json.loads(fetch("api/" + path)[0])


class Server:
    """python -m server on its own port, timed from launch to /api/health ready."""

    def __init__(self, port: int):
        self.port, self.url, self.proc = port, f"http://127.0.0.1:{port}/", None
        self.log_path = Path(tempfile.gettempdir()) / f"drive_web_server_{port}.log"

    def start(self) -> dict:
        with socket.socket() as probe:
            probe.settimeout(0.5)
            if probe.connect_ex(("127.0.0.1", self.port)) == 0:
                raise SystemExit(f"Port {self.port} is already in use. Stop what's on it, or pass --port.")
        self.log = open(self.log_path, "w", encoding="utf-8")
        load, t0 = Load().start(), time.perf_counter()
        self.proc = subprocess.Popen([sys.executable, "-m", "server", "--port", str(self.port), "--no-browser"],
                                     cwd=ROOT, stdout=self.log, stderr=subprocess.STDOUT)
        listening, health, polls = None, None, []
        while time.perf_counter() - t0 < 120 and self.proc.poll() is None:
            try:
                with urllib.request.urlopen(self.url + "api/health", timeout=2) as response:
                    health = json.loads(response.read())
                listening = listening or round(time.perf_counter() - t0, 2)
                if not polls or polls[-1][1] != health.get("step"):
                    polls.append((round(time.perf_counter() - t0, 2), health.get("step")))
                if health.get("ready") or health.get("status") == "error":
                    break
            except OSError:
                pass
            time.sleep(0.2)
        self.ready_at = time.perf_counter()
        return {"ready_s": round(self.ready_at - t0, 2), "listening_s": listening, "health": health, "steps": polls,
                "exit_code": self.proc.poll(), "machine_load": load.stop(self.proc.pid)}

    def log_tail(self, n: int = 40) -> list[str]:
        try:
            return self.log_path.read_text(encoding="utf-8", errors="replace").splitlines()[-n:]
        except OSError:
            return []

    def stop(self) -> None:
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        if self.proc:
            self.log.close()


# The app's number formats (web/src/lib/format.ts, boardScales.ts) --------------------------------

MINUS = "−"


def jround(x: float) -> int:  # JavaScript's Math.round
    return math.floor(x + 0.5)


def fmt_int(n) -> str:
    return f"{jround(n):,}"


def money(n) -> str:
    return (MINUS if n < 0 else "") + f"${jround(abs(n)):,}"


def hours(n) -> str:
    return f"{jround(n):,} h"


def pct(share, digits: int = 1) -> str:
    return f"{share * 100:.{digits}f}%"


def signed(n, body) -> str:
    return body(0) if abs(n) < 1e-9 else ("+" if n > 0 else MINUS) + body(abs(n))


def chance(c, below: bool, goal: float) -> str:
    if c is None:
        return "–"
    if below and jround(c * 100) >= jround(goal * 100):
        return f"{math.floor(c * 1000) / 10:.1f}%"
    return pct(c, 0)


# Browser helpers ---------------------------------------------------------------------------------

class Watch:
    """Console errors and warnings by step, and every request's host, across every page opened."""

    def __init__(self):
        self.tag, self.current = "start", None

    def page(self, browser, width: int, height: int):
        ctx = browser.new_context(viewport={"width": width, "height": height}, accept_downloads=True)
        page = ctx.new_page()
        page.on("console", lambda m: m.type in ("error", "warning") and self.log(f"{m.type}: {m.text}"))
        page.on("pageerror", lambda e: self.log(f"pageerror: {e}"))
        page.on("request", self.request)
        page.on("requestfailed", lambda r: R["requests"]["failed"].append(f"{self.tag}: {r.url} ({r.failure})"))
        self.current = page  # for a screenshot if the section crashes
        return page

    def log(self, text: str) -> None:
        R["console"].setdefault(self.tag, []).append(text)

    def request(self, req) -> None:
        u, reqs = urlparse(req.url), R["requests"]
        host = u.hostname or ""
        reqs["count"] += 1
        reqs["schemes"][u.scheme] = reqs["schemes"].get(u.scheme, 0) + 1
        if u.scheme in ("http", "https", "ws", "wss"):
            reqs["hosts"][host] = reqs["hosts"].get(host, 0) + 1
        if not (u.scheme in ("data", "blob") or host in ("127.0.0.1", "localhost")):
            reqs["external"].append(req.url)

    def errors(self, tag: str) -> list[str]:
        return R["console"].get(tag, [])


def url(page_path: str, **params) -> str:
    return f"{BASE}#/{page_path}?{urlencode({k: v for k, v in params.items() if v is not None})}"


NOT_BUSY = "!document.querySelector('[aria-busy=true]')"
TITLE_IS = "(document.querySelector('main h1')?.textContent.trim() === arg)"


def settle(page, title: str | None = None, ms: int = 400) -> None:
    if title:
        page.wait_for_function(f"arg => {TITLE_IS}", arg=title, timeout=20000)
    page.wait_for_load_state("networkidle")
    page.wait_for_function(f"() => {NOT_BUSY}", timeout=30000)
    page.wait_for_timeout(ms)


def go(page, page_path: str, title: str | None = None, ms: int = 400, **params) -> None:
    page.goto(url(page_path, **params))
    settle(page, title, ms)


ARM = "() => { window.__t0 = null; document.addEventListener('click', () => { window.__t0 ??= performance.now(); }, { capture: true, once: true }); }"


def timed(page, click, cond: str, arg=None, timeout: int = 20000) -> float:
    """Milliseconds from a real click to the first animation frame where the JS expression `cond` holds."""
    page.evaluate(ARM)
    click()
    handle = page.wait_for_function(f"arg => (window.__t0 != null && ({cond})) ? Math.max(performance.now() - window.__t0, 0.01) : false",
                                    arg=arg, timeout=timeout, polling="raf")
    return round(handle.json_value(), 1)


# A KPI tile: the card around a leaf label, with its big value (KpiTile in web/src/components/ui).
TILE_JS = """label => { const card = [...document.querySelectorAll('main span')].filter(e => !e.childElementCount && e.textContent.trim() === label)
  .map(e => e.closest('[class*=rounded-card]')).find(c => c && c.querySelector('.text-kpi'));
  return card ? { value: card.querySelector('.text-kpi').textContent.trim(), text: card.innerText } : null; }"""
TILE_COND = "((t) => !!t && t.value === arg.value)((" + TILE_JS + ")(arg.label)) && " + NOT_BUSY


# Draft 3's Overview has four tiles, with the cost compact on the card ("$377.5K", exact in the tooltip) and
# over capacity moved into the below-goal list. The Scenario lab keeps exact figures and its own labels.
OVERVIEW_TILES = ("Expected service", "Below the goal", "Labor cost", "Paid hours")
LAB_TILES = ("Labor cost", "Hours", "Expected service", "Below the goal")


def money_compact(n) -> str:
    """lib/format.ts fmtMoney(n, true): $12.3K from $10,000, $1.23M from $1,000,000."""
    a = abs(n)
    sign = MINUS if n < 0 else ""
    if a >= 1_000_000:
        return f"{sign}${a / 1_000_000:.2f}M"
    if a >= 10_000:
        return f"{sign}${a / 1000:.1f}K"
    return money(n)


def tiles(page, labels=OVERVIEW_TILES) -> dict:
    return {label: (page.evaluate(TILE_JS, label) or {}).get("value") for label in labels}


def expected_tiles(summary: dict, lab: bool = False) -> dict:
    if lab:
        return {"Labor cost": money(summary["cost"]), "Hours": hours(summary["hours"]), "Expected service": pct(summary["expected_met"]),
                "Below the goal": fmt_int(summary["below_goal"])}
    return {"Expected service": pct(summary["expected_met"]), "Below the goal": fmt_int(summary["below_goal"]),
            "Labor cost": money_compact(summary["cost"]), "Paid hours": hours(summary["hours"])}


def shot(page, name: str, full: bool = False) -> str:
    """A viewport screenshot, or with full=True the whole page (the scrolling <main> unrolled)."""
    path = SHOTS / f"{name}.png"
    if full:
        page.evaluate("""() => { const m = document.querySelector('main'); for (const el of [m.closest('#root > div'), m.parentElement, m]) {
            el.dataset.keepStyle = el.getAttribute('style') || ''; el.style.height = 'auto'; el.style.overflow = 'visible'; } }""")
        page.wait_for_timeout(300)
    page.screenshot(path=str(path), full_page=full)
    if full:
        page.evaluate("""() => document.querySelectorAll('[data-keep-style]').forEach(el => {
            el.setAttribute('style', el.dataset.keepStyle); delete el.dataset.keepStyle; })""")
        page.wait_for_timeout(150)
    R["screenshots"].append(str(path.relative_to(ROOT)).replace("\\", "/"))
    return path.name


# What a rendered page holds, and layout trouble a screenshot might hide: page-level sideways
# scrolling, inner boxes that scroll sideways, text cut short with an ellipsis, and elements poking
# out past the right edge of the canvas without a scroller to hold them. `name` is a tag and the start of its text.
PAGE_INFO_JS = """() => { const m = document.querySelector('main'), mr = m.getBoundingClientRect(),
  name = e => e.tagName.toLowerCase() + ': ' + (e.innerText || e.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 70);
  const scrollers = [], cut = [], poking = [];
  for (const e of m.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (/(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1) scrollers.push(name(e));
    if (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) cut.push(name(e));
    const r = e.getBoundingClientRect();
    if (r.width > 0 && r.right > mr.right + 1 && cs.position !== 'fixed') {
      let held = false; for (let a = e.parentElement; a && a !== m; a = a.parentElement) { if (getComputedStyle(a).overflowX !== 'visible') { held = true; break; } }
      if (!held) poking.push(name(e));
    }
  }
  return { chars: m.innerText.length, error_panel: !!m.querySelector('[role=alert]'), charts: m.querySelectorAll('svg.recharts-surface').length,
    layout: { page_scrolls_sideways: document.documentElement.scrollWidth > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1,
              content_height: m.scrollHeight, inner_sideways_scrollers: scrollers.slice(0, 8), text_cut_with_ellipsis: cut.slice(0, 12),
              text_cut_count: cut.length, poking_past_right_edge: poking.slice(0, 8) } }; }"""


def check_pages(browser, watch: Watch, shots: bool) -> None:
    """Each page at each viewport renders with no console errors or warnings; screenshots of each, the drawer and a what-if."""
    results: dict[str, list] = {title: [] for _, title in PAGES}
    for w, h in VIEWPORTS:
        page = watch.page(browser, w, h)
        for path, title in PAGES:
            tag = watch.tag = f"page:{path}@{w}"
            try:
                go(page, path, title, ms=900, scenario="BASE", wh="all")
                info = page.evaluate(PAGE_INFO_JS)
            except Exception as error:  # noqa: BLE001 - record and carry on
                info = {"chars": 0, "error": str(error).splitlines()[0][:200]}
            R["layout"][f"{path}@{w}x{h}"] = info.get("layout") or info.get("error")
            if shots:
                shot(page, f"{path}_{w}x{h}")
                shot(page, f"{path}_{w}x{h}_full", full=True)
            errors = watch.errors(tag)
            ok = info.get("chars", 0) > 300 and not info.get("error_panel") and not errors and "error" not in info
            results[title].append((w, ok, info.get("chars", 0), errors or info.get("error")))
        if shots:
            watch.tag = f"extras@{w}"
            go(page, "schedule", "Schedule", ms=500, scenario="BASE", wh="1", block=DEMO_BLOCK)
            page.get_by_role("dialog").wait_for(timeout=10000)
            page.wait_for_timeout(500)
            shot(page, f"drawer_{w}x{h}")
            go(page, "scenario-lab", "Scenario lab", ms=600, scenario="BASE", wh="all", **DEMO_WHAT_IF)
            page.wait_for_function("() => document.querySelector('section[aria-label=\"What-if results\"]')?.textContent.includes('Calculated in')", timeout=30000)
            settle(page, ms=600)
            page.evaluate("() => { const s = document.querySelector('section[aria-label=\"What-if results\"]'), m = document.querySelector('main');"
                          " m.scrollTo({ top: s.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop - 8 }); }")
            page.wait_for_timeout(400)
            shot(page, f"whatif_result_{w}x{h}")
            shot(page, f"whatif_result_{w}x{h}_full", full=True)
        page.context.close()
    for title, rows in results.items():
        check(f"Every page: {title} renders, no console errors or warnings", all(ok for _, ok, _, _ in rows),
              ", ".join(f"{w}: {'ok' if ok else 'FAIL'} ({chars:,} chars)" for w, ok, chars, _ in rows),
              problems={str(w): p for w, ok, _, p in rows if not ok} or None)


def check_page_changes(browser, watch: Watch) -> None:
    """Sidebar clicks through all seven pages, twice: first visits fetch their data, return visits don't."""
    page = watch.page(browser, 1366, 768)
    watch.tag = "page-changes"
    go(page, "overview", "Overview", scenario="BASE", wh="all")
    rounds = {}
    for label in ("first visit", "return visit"):
        times = {}
        for path, title in PAGES[1:] + PAGES[:1]:
            link = page.locator(f"nav[aria-label=Pages] a[href^='#/{path}?']")
            times[title] = timed(page, link.click, f"{TITLE_IS} && {NOT_BUSY}", arg=title)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(300)
        rounds[label] = times
    R["timings"]["page_change_ms"] = rounds
    worst = {label: max(times.items(), key=lambda kv: kv[1]) for label, times in rounds.items()}
    check("Page changes (sidebar click to the page drawn with its data)", all(v < BUDGET["page_change_ms"] for _, v in worst.values()),
          "; ".join(f"{label}: worst {name} {ms:.0f} ms, median {sorted(rounds[label].values())[3]:.0f} ms" for label, (name, ms) in worst.items()),
          budget=f"{BUDGET['page_change_ms']} ms")
    page.context.close()


def check_switches(browser, watch: Watch, plans: dict) -> None:
    """The top bar's scenario and warehouse switches change the KPIs to /api/plan's figures, fast."""
    page = watch.page(browser, 1366, 768)
    watch.tag = "switches"
    go(page, "overview", "Overview", scenario="BASE", wh="all")
    bar = page.locator("#root > div > header")
    shown = tiles(page)
    check("Overview KPIs equal /api/plan totals (BASE, all)", shown == expected_tiles(plans["BASE"]["totals"]["all"]["plan"]), shown)
    times, wrong = {}, []
    for n, scen in enumerate(("PEAK", "DISRUPT", "BASE", "PEAK", "DISRUPT", "BASE")):
        want, before = expected_tiles(plans[scen]["totals"]["all"]["plan"]), shown
        ms = timed(page, bar.get_by_role("radio", name=scen, exact=True).click, TILE_COND, arg={"label": "Labor cost", "value": want["Labor cost"]})
        shown = tiles(page)
        times[f"{n + 1}. to {scen}"] = ms
        if shown != want or shown == before:
            wrong.append({"to": scen, "shown": shown, "want": want})
    R["timings"]["scenario_switch_ms"] = times
    check("Scenario switch changes the KPIs to the API's figures", not wrong, f"{len(times)} switches, {len(wrong)} wrong", mismatches=wrong or None)
    check("Scenario switch time (click to new KPIs drawn)", max(times.values()) < BUDGET["scenario_switch_ms"],
          f"worst {max(times.values()):.0f} ms, all {list(times.values())}", budget=f"{BUDGET['scenario_switch_ms']} ms")
    times, wrong = {}, []
    for wh in ("1", "2", "4", "all"):
        want = expected_tiles(plans["BASE"]["totals"][wh]["plan"])
        ms = timed(page, bar.get_by_role("radio", name=WAREHOUSE_RADIO[wh], exact=True).click, TILE_COND, arg={"label": "Labor cost", "value": want["Labor cost"]})
        times[wh] = ms
        if tiles(page) != want:
            wrong.append({"wh": wh, "shown": tiles(page), "want": want})
    R["timings"]["warehouse_switch_ms"] = times
    check("Warehouse switch changes the KPIs to the API's figures, fast (7.5)", not wrong and max(times.values()) < BUDGET["scenario_switch_ms"],
          f"worst {max(times.values()):.0f} ms, all {list(times.values())}", budget=f"{BUDGET['scenario_switch_ms']} ms", mismatches=wrong or None)
    page.context.close()


def board_mismatches(page, plan: dict, wh: str) -> list[str]:
    """Every board cell's plan and change against /api/plan, and the set of cells against the warehouse filter."""
    cells = page.eval_on_selector_all("main [data-key]", "els => els.map(e => [e.dataset.key, e.innerText])")
    by_key = {b["key"]: b for b in plan["blocks"]}
    bad = []
    for key, text in cells:
        b = by_key.get(key)
        if b is None:
            bad.append(f"unknown cell {key}")
        elif not b["is_open"]:
            "Closed" in text or bad.append(f"{key}: closed block shows {text!r}")
        else:
            nums = re.findall(r"[+−-]?\d+", text.replace("±0", "+0"))
            got = (int(nums[0]), int(nums[1].replace(MINUS, "-"))) if len(nums) > 1 else None
            got == (b["plan"], b["change"]) or bad.append(f"{key}: shows {text!r}, API plan {b['plan']} change {b['change']}")
    want = {b["key"] for b in plan["blocks"] if wh == "all" or str(b["store_id"]) == wh}
    if {k for k, _ in cells} != want:
        bad.append(f"cells shown {len(cells)}, blocks in view {len(want)}")
    return bad


def drawer_mismatches(page, b: dict, goal: float) -> list[str]:
    """The open drawer against one /api/plan block: title, badges, hero numbers, sources, cost, service, cushion, assumptions."""
    d = page.get_by_role("dialog")
    # Draft 3 keeps each section's words in its (i) tooltip and as screen-reader text, so the explanations are
    # checked against the drawer's full text content; the figures are checked against what's visible.
    visible, title = d.inner_text(), d.locator("h2").first.inner_text().strip()
    text = visible + " " + " ".join((d.text_content() or "").split())
    miss = [] if title == b["label"] else [f"title {title!r}"]
    x = b["explanation"]
    want = [b["warehouse"], b["scenario"], x["why"]]
    if b["is_open"]:
        goal_txt = f"{goal * 100:.0f}% goal"
        want += [b["action"], x["demand_driver"] or "", x["staffing"], x["cost_effect"], x["service_effect"], x["cushion"],
                 money(b["cost_draft"]), money(b["cost"]), signed(b["cost_change"], money), hours(b["hours_draft"]), hours(b["hours"]),
                 f"{b['demand']:,.1f}", pct(b["callout_rate"]), chance(b["chance_draft"], b["below_goal_draft"], goal),
                 chance(b["chance"], b["below_goal"], goal), f"{pct(b['utilization_draft'], 0)} → {pct(b['utilization'], 0)}",
                 f"People it can lose\n{b['cushion_people']}", pct(b["cushion_demand"], 0), *[a["id"] for a in b["assumptions"]]]
        if b["need"] is not None:
            want.append(f"would take {b['need']} people; this block can field {b['availability']['capacity']}")
        if (f"Below the {goal_txt}" in text) != b["below_goal"] or (f"Meets the {goal_txt}" in text) == b["below_goal"]:
            miss.append("goal badge")
        hero = re.search(r"Draft\s+(\d+)\s+Plan\s+(\d+)", visible)
        if not hero or (int(hero[1]), int(hero[2])) != (b["draft"], b["plan"]):
            miss.append(f"draft/plan hero {hero and hero.groups()}")
        rows = {r[0]: [int(v) for v in r[2:]] for r in (row.locator("td").all_inner_texts() for row in d.locator("table tbody tr").all())}
        s, ds, av = b["sources"], b["draft_sources"], b["availability"]
        expect = {"Plan": [s["regular"], s["flex"], s["overtime"], b["plan"]], "Draft": [ds["regular"], ds["flex"], ds["overtime"], b["draft"]],
                  "Can field": [av["regular"], av["usable_flex"], av["overtime"], av["capacity"]]}
        if rows != expect:
            miss.append(f"sources table {rows} vs {expect}")
    else:
        "Closed" in text or miss.append("closed badge")
    return miss + [f"missing {w[:60]!r}" for w in want if w and w not in text]


def check_board_and_drawer(browser, watch: Watch, plans: dict) -> None:
    """Board cells equal /api/plan; clicking a cell opens the drawer on that block with the API's numbers."""
    page = watch.page(browser, 1366, 768)
    watch.tag = "board-drawer"
    bad = {}
    for scen in SCENARIOS:
        for wh in ("1", "2", "4", "all"):
            go(page, "schedule", "Schedule", ms=150, scenario=scen, wh=wh)
            found = board_mismatches(page, plans[scen], wh)
            if found:
                bad[f"{scen} {wh}"] = found[:4]
    check("Schedule board cells equal /api/plan (3 scenarios x 4 warehouse views)", not bad, f"{12 - len(bad)} of 12 views match", mismatches=bad or None)
    closed = next(b for b in plans["PEAK"]["blocks"] if not b["is_open"])
    picks = [DEMO_BLOCK, plans["DISRUPT"]["totals"]["all"]["largest_changes"][0], closed["key"],
             next(b["key"] for b in plans["PEAK"]["blocks"] if b["is_open"] and b["below_goal"] and b["store_id"] == 4)]
    results, times = {}, {}
    for key in picks:
        scen, store = key.split("|")[:2]
        b = {x["key"]: x for x in plans[scen]["blocks"]}[key]
        go(page, "schedule", "Schedule", ms=200, scenario=scen, wh=store)
        cell = page.locator(f"main [data-key='{key}']")
        times[key] = timed(page, cell.click, "document.querySelector('[role=dialog] h2')?.textContent.trim() === arg", arg=b["label"])
        page.wait_for_timeout(500)
        in_url = unquote(page.url).split("block=")[-1].split("&")[0] == key
        results[key] = drawer_mismatches(page, b, plans[scen]["goal"]) + ([] if in_url else [f"URL block param: {page.url}"])
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
    R["timings"]["drawer_open_ms"] = times
    for key, miss in results.items():
        check(f"Board cell opens the drawer with /api/plan's numbers: {key}", not miss, "all fields match" if not miss else f"{len(miss)} mismatches",
              open_ms=times[key], mismatches=miss or None)
    page.context.close()


def set_slider(page, name: str, target: float, step: float) -> str:
    """Move a Radix slider with the arrow keys, as a presenter would, and return its spoken value."""
    s = page.get_by_role("slider", name=name)
    s.focus()
    n = round((target - float(s.get_attribute("aria-valuenow"))) / step)
    for _ in range(abs(n)):
        page.keyboard.press("ArrowRight" if n > 0 else "ArrowLeft")
    return s.get_attribute("aria-valuetext")


# Results are done once the run has started (the previous results went stale or the progress state
# showed: __started), the URL holds the new settings, and fresh results with their run time are drawn.
RESULTS_JS = "document.querySelector('section[aria-label=\"What-if results\"]')"
RESULTS_DONE = ("window.__started && location.hash.includes('demand=' + arg.demand) && location.hash.includes('callouts=' + arg.callouts) && (() => {"
                f" const s = {RESULTS_JS}; return !!s && s.textContent.includes('Calculated in') && !document.querySelector('main [role=status]'); }})() && " + NOT_BUSY)
WATCH_STATUS = ("() => { window.__saw = false; window.__started = false; window.__obs = new MutationObserver(() => {"
                " const busy = !!document.querySelector('main [role=status]'); if (busy) window.__saw = true;"
                f" if (busy || !({RESULTS_JS}?.textContent.includes('Calculated in'))) window.__started = true; }});"
                " window.__obs.observe(document.body, { subtree: true, childList: true, characterData: true }); }")


def run_what_if(page, settings: dict, log: list) -> dict:
    """Set the lab's sliders, click Run, and time it to the results drawn. Returns timing, cache header and slider values."""
    spoken = [set_slider(page, "Demand against forecast", settings["demand"], 0.01),
              set_slider(page, "Callouts, as a multiple of history", settings["callouts"], 0.25)]
    page.evaluate(WATCH_STATUS)
    n, load = len(log), Load().start()
    ms = timed(page, page.get_by_role("button", name="Run what-if").click, RESULTS_DONE, arg={k: str(v) for k, v in settings.items()}, timeout=60000)
    machine = load.stop(SERVER_PID)
    saw_progress = page.evaluate("() => { window.__obs.disconnect(); return window.__saw; }")
    page.wait_for_timeout(900)  # the smooth scroll to the results
    calls = log[n:]
    return {"ms": ms, "sliders": spoken, "progress_shown": saw_progress, "api": calls[-1] if calls else None, "url": unquote(page.url),
            "machine_load": machine}


def check_what_if(browser, watch: Watch, plans: dict, plan_hashes: dict, server: Server) -> None:
    """Demo settings answer from the warm cache; new settings finish in under 8 s; Reset restores the submitted plan."""
    page = watch.page(browser, 1366, 768)
    watch.tag = "what-if"
    log: list = []
    page.on("response", lambda r: "/api/what-if" in r.url and log.append({"status": r.status, "x-cache": r.headers.get("x-cache"), "x-seconds": r.headers.get("x-seconds")}))
    go(page, "scenario-lab", "Scenario lab", scenario="BASE", wh="all")
    after_ready = round(time.perf_counter() - server.ready_at, 1)
    demo = run_what_if(page, DEMO_WHAT_IF, log)
    want = api("what-if?" + urlencode({"scenario": "BASE", **DEMO_WHAT_IF}))["vs_submitted"]["all"]["what_if"]
    shown, expect = tiles(page, LAB_TILES), expected_tiles(want, lab=True)
    R["timings"]["what_if_demo"] = {**demo, "seconds_after_server_ready": after_ready}
    cache = (demo["api"] or {}).get("x-cache")
    check("What-if, demo settings (demand +10%, callouts 150%): warm and fast", demo["ms"] < BUDGET["what_if_demo_ms"] and cache == "hit",
          f"{demo['ms']:.0f} ms click to results, X-Cache {cache}, sliders {demo['sliders']}, run {after_ready} s after ready",
          budget=f"{BUDGET['what_if_demo_ms']} ms and a cache hit")
    check("What-if KPI tiles equal /api/what-if", shown == expect, shown, expected=expect)
    shot(page, "whatif_demo_run_1366x768")
    # The server warms the demo what-if for each scenario after it's ready, one after another. A request for
    # the same settings waits on the same lock, so once all three answer, the warm-up is over and a new run
    # has the CPU to itself, as it will at 3:10 in the demo.
    warm: dict = {"passes": []}
    for _ in range(5):  # Ask for all three until one pass is all hits.
        one = {}
        for scen in SCENARIOS:
            t0 = time.perf_counter()
            _, head = fetch("api/what-if?" + urlencode({"scenario": scen, **DEMO_WHAT_IF}), timeout=120)
            one[scen] = {"x-cache": head.get("x-cache"), "x-seconds": head.get("x-seconds"), "waited_s": round(time.perf_counter() - t0, 2)}
        warm["passes"].append(one)
        if all(v["x-cache"] == "hit" for v in one.values()):
            break
    warm["warm_up_over_s_after_ready"] = round(time.perf_counter() - server.ready_at, 1)
    R["timings"]["warm_up"] = warm
    new = run_what_if(page, NEW_WHAT_IF, log)
    R["timings"]["what_if_new"] = {**new, "seconds_after_server_ready": round(time.perf_counter() - server.ready_at, 1)}
    api_new = new["api"] or {}
    check("What-if, new settings (demand +5%, callouts 125%) finish in time", new["ms"] < BUDGET["what_if_new_s"] * 1000 and api_new.get("x-cache") == "miss",
          f"{new['ms'] / 1000:.2f} s click to results, server {api_new.get('x-seconds')} s, X-Cache {api_new.get('x-cache')}, progress state shown {new['progress_shown']}, "
          f"system CPU {(new['machine_load'] or {}).get('system_cpu_percent')}% meanwhile",
          budget=f"{BUDGET['what_if_new_s']:.0f} s")
    page.get_by_role("button", name="Reset to submitted plan").click()
    page.wait_for_function("() => !document.querySelector('section[aria-label=\"What-if results\"]')", timeout=10000)
    page.wait_for_timeout(400)
    sliders = [page.get_by_role("slider", name=n).get_attribute("aria-valuenow") for n in ("Demand against forecast", "Callouts, as a multiple of history")]
    badge = page.locator("main header").get_by_text("Submitted plan", exact=True).count() == 1
    clean_url = not re.search(r"[?&](demand|callouts|goal|availability)=", page.url)
    shot(page, "whatif_after_reset_1366x768")
    unchanged = {s: hashlib.sha256(fetch(f"api/plan?scenario={s}")[0]).hexdigest() == plan_hashes[s] for s in SCENARIOS}
    go(page, "overview", "Overview", scenario="BASE", wh="all")
    overview_ok = tiles(page) == expected_tiles(plans["BASE"]["totals"]["all"]["plan"])
    check("Reset restores the submitted plan", all([float(sliders[0]) == 0, float(sliders[1]) == 1, badge, clean_url, all(unchanged.values()), overview_ok]),
          f"sliders {sliders}, 'Submitted plan' badge {badge}, URL clean {clean_url}, /api/plan unchanged {all(unchanged.values())}, Overview KPIs = submitted {overview_ok}")
    page.context.close()


def check_export(browser, watch: Watch) -> None:
    """The exported submission CSV passes validate() and is byte-identical to outputs/."""
    import pandas as pd
    from src.submission import validate

    page = watch.page(browser, 1366, 768)
    watch.tag = "export"
    go(page, "schedule", "Schedule", scenario="BASE", wh="all")
    reference = SUBMISSION.read_bytes()
    for name, link in (("Schedule's Download submission CSV", page.get_by_role("link", name="Download submission CSV")),
                       ("sidebar's Download CSV", page.locator("nav[aria-label=Pages] a[download]"))):
        with page.expect_download() as download:
            link.click()
        data = Path(download.value.path()).read_bytes()
        filled = pd.read_csv(io.BytesIO(data), parse_dates=["day_date"])
        problems, final = validate(filled), validate(filled, final=True)
        ok = data == reference and problems == [] and all("placeholder" in p for p in final)
        check(f"Export: {name} passes validate() and equals outputs/", ok,
              f"{download.value.suggested_filename}, {len(data):,} bytes, {len(filled)} rows, byte-identical {data == reference}, "
              f"validate() {problems}, validate(final=True) {final}")
    page.context.close()


def demo_step(clock: str, what: str, fn) -> bool:
    t0 = time.perf_counter()
    try:
        ok, observed = fn()
    except Exception as error:  # noqa: BLE001 - a broken step is a finding, not a crash
        ok, observed = False, f"crashed: {type(error).__name__}: {str(error).splitlines()[0][:200]}"
    R["demo"].append({"at": clock, "step": what, "ok": bool(ok), "observed": observed, "seconds": round(time.perf_counter() - t0, 2)})
    print(f"    demo {clock} {'ok  ' if ok else 'FAIL'} {what}: {observed}", flush=True)
    return bool(ok)


def run_demo(browser, watch: Watch, plans: dict) -> None:
    """The 5-minute demo script in 7.10, clicked through end to end at 1366 x 768, the smallest projector size."""
    page = watch.page(browser, 1366, 768)
    watch.tag = "demo"
    log: list = []
    page.on("response", lambda r: "/api/what-if" in r.url and log.append({"status": r.status, "x-cache": r.headers.get("x-cache"), "x-seconds": r.headers.get("x-seconds")}))
    bar = page.locator("#root > div > header")
    nav = lambda path: page.locator(f"nav[aria-label=Pages] a[href^='#/{path}?']")  # noqa: E731
    block = lambda scen, key: next(b for b in plans[scen]["blocks"] if b["key"] == key)  # noqa: E731
    answer = lambda: page.locator("main header p").first.inner_text()  # noqa: E731
    base, goal = plans["BASE"]["totals"]["all"], plans["BASE"]["goal"]
    t_start = time.perf_counter()

    def overview():
        page.goto(BASE)
        settle(page, "Overview", 700)
        shot(page, "demo_1_overview_1366x768")
        more = base["change"]["hours"] / base["draft"]["hours"]
        says = f"{more:.1%} more hours, expected service {base['draft']['expected_met']:.1%} to {base['plan']['expected_met']:.1%}"
        draft_met, plan_met = base["draft"]["expected_met"], base["plan"]["expected_met"]
        if (f"{more:.0%}", f"{draft_met:.0%}", f"{plan_met:.0%}") != ("14%", "70%", "96%"):
            R["notes"].append(f"Demo script 0:00 says '14% more hours ... take expected service from 70% to 96%'. The app's BASE plan adds "
                              f"{base['change']['hours']:,} hours to the draft's {base['draft']['hours']:,}: {more:.1%} (employees "
                              f"+{base['change']['employees'] / base['draft']['employees']:.1%}), and service goes from {draft_met:.1%} to {plan_met:.1%}.")
        ok = tiles(page) == expected_tiles(base["plan"]) and answer() == base["verdict"] and "#/overview" in page.url
        return ok, f"KPIs equal the API and the verdict shows; the app says {says}"

    def schedule_wh1():
        nav("schedule").click()
        settle(page, "Schedule")
        ms = timed(page, bar.get_by_role("radio", name="1 Medium", exact=True).click,
                   f"!!document.querySelector(\"main [data-key^='BASE|1|']\") && !document.querySelector(\"main [data-key^='BASE|2|']\") && {NOT_BUSY}")
        page.wait_for_timeout(300)
        shot(page, "demo_2_schedule_wh1_1366x768")
        bad = board_mismatches(page, plans["BASE"], "1")
        wh1 = [b for b in plans["BASE"]["blocks"] if b["store_id"] == 1 and b["is_open"]]
        window = [b for b in wh1 if "2026-02-13" <= b["date"] <= "2026-02-16"]
        others = [b for b in wh1 if b not in window]
        return not bad and "wh=1" in page.url, (f"warehouse switch {ms:.0f} ms, board equals the API; blocks with people added: "
                                                f"{sum(b['change'] > 0 for b in window)} of {len(window)} on Feb 13-16, {sum(b['change'] > 0 for b in others)} of {len(others)} on other days")

    def click_cell():
        b = block("BASE", DEMO_BLOCK)
        ms = timed(page, page.locator(f"main [data-key='{DEMO_BLOCK}']").click, "document.querySelector('[role=dialog] h2')?.textContent.trim() === arg", arg=b["label"])
        page.wait_for_timeout(500)
        shot(page, "demo_3_drawer_1366x768")
        miss = drawer_mismatches(page, b, goal)
        return not miss, f"drawer open in {ms:.0f} ms, " + ("every field equals /api/plan" if not miss else f"mismatches {miss[:3]}")

    def switch():
        peak_key = DEMO_BLOCK.replace("BASE", "PEAK", 1)
        ms1 = timed(page, bar.get_by_role("radio", name="PEAK", exact=True).click,
                    f"!!document.querySelector(\"main [data-key='{peak_key}']\") && !!document.querySelector('[role=dialog]')?.innerText.includes('PEAK') && {NOT_BUSY}")
        page.wait_for_timeout(400)
        shot(page, "demo_4a_peak_drawer_1366x768")
        miss = drawer_mismatches(page, block("PEAK", peak_key), goal)
        ms2 = timed(page, bar.get_by_role("radio", name="DISRUPT", exact=True).click, f"!!document.querySelector(\"main [data-key^='DISRUPT|1|']\") && {NOT_BUSY}")
        ms3 = timed(page, bar.get_by_role("radio", name="2 Large", exact=True).click, f"!!document.querySelector(\"main [data-key^='DISRUPT|2|']\") && {NOT_BUSY}")
        page.wait_for_timeout(500)
        shot(page, "demo_4b_disrupt_wh2_1366x768")
        dialog = page.get_by_role("dialog")
        drawer_now = (dialog.locator("h2").first.inner_text() + " | " + dialog.locator("p").first.inner_text()) if dialog.count() else "closed"
        bad = board_mismatches(page, plans["DISRUPT"], "2")
        fe = [(block("BASE", d["key"].replace("DISRUPT", "BASE", 1)), d) for d in plans["DISRUPT"]["blocks"]
              if d["store_id"] == 2 and d["dept_id"] == 38 and d["is_open"] and "2026-02-13" <= d["date"] <= "2026-02-16"]
        fewer = sum(d["availability"]["regular"] < b["availability"]["regular"] for b, d in fe)
        moved = sum(d["plan"] != b["plan"] for b, d in fe)
        R["timings"]["demo_switch_ms"] = {"PEAK (drawer open)": ms1, "DISRUPT": ms2, "Warehouse 2": ms3}
        ok = not miss and not bad and "scenario=DISRUPT" in page.url and "wh=2" in page.url
        return ok, (f"PEAK {ms1:.0f} ms with the drawer following ({'matches the API' if not miss else miss[:2]}), DISRUPT {ms2:.0f} ms, Warehouse 2 {ms3:.0f} ms, "
                    f"board equals the API; drawer after the warehouse switch: {drawer_now!r}; Front End at Warehouse 2 on Feb 13-16: "
                    f"{fewer} of {len(fe)} blocks have fewer regular staff than BASE, {moved} get a different plan")

    def demand():
        ms = timed(page, nav("demand").click, f"{TITLE_IS} && {NOT_BUSY}", arg="Demand")
        settle(page, "Demand", 700)
        shot(page, "demo_5_demand_1366x768")
        charts = page.locator("main svg.recharts-surface").count()
        return charts > 0, f"opened in {ms:.0f} ms with {charts} charts; answer {answer()[:140]!r}"

    def lab():
        nav("scenario-lab").click()
        settle(page, "Scenario lab")
        r = run_what_if(page, DEMO_WHAT_IF, log)
        shot(page, "demo_6_whatif_1366x768")
        cache = (r["api"] or {}).get("x-cache")
        return r["ms"] < BUDGET["what_if_demo_ms"] and cache == "hit", f"DISRUPT at Warehouse 2: {r['ms']:.0f} ms, X-Cache {cache}, sliders {r['sliders']}; answer {answer()[:160]!r}"

    def playbook():
        nav("playbook").click()
        settle(page, "Playbook", 700)
        pto = api("playbook")["pto"]
        text = page.locator("main").inner_text()
        shot(page, "demo_7_playbook_1366x768")
        rows = {r["kept_per_block"]: r for r in pto["rows"]}
        two, zero = rows.get(2), rows.get(0)
        holds = bool(two and zero and two["expected_met"] > zero["expected_met"] and two["cost"] < zero["cost"])
        if "2 people" not in pto["headline"]:
            R["notes"].append(f"Demo script 4:00 says 'keep 2 people per block from holiday PTO'. The Playbook's headline says: {pto['headline']}")
        return pto["headline"] in text, (f"PTO card and headline shown: {pto['headline']!r}. At 2 kept per block, service "
                                         f"{pct(zero['expected_met'])} to {pct(two['expected_met'])}, cost {money(zero['cost'])} to {money(two['cost'])}: "
                                         f"{'rises and falls as the script says' if holds else 'does not match the script'}")

    def export():
        nav("schedule").click()
        settle(page, "Schedule")
        with page.expect_download() as download:
            page.get_by_role("link", name="Download submission CSV").click()
        same = Path(download.value.path()).read_bytes() == SUBMISSION.read_bytes()
        shot(page, "demo_8_export_1366x768")
        return same, f"{download.value.suggested_filename}, byte-identical to outputs/: {same}"

    steps = [("0:00", "Overview, BASE, all warehouses", overview), ("0:40", "Schedule, Warehouse 1", schedule_wh1),
             ("1:10", "Click Sat Feb 14, Front End, Midday", click_cell), ("1:50", "Switch to PEAK, then DISRUPT at Warehouse 2", switch),
             ("2:40", "Demand page", demand), ("3:10", "Scenario lab: demand +10%, callouts 150%, Run", lab),
             ("4:00", "Playbook: holiday PTO", playbook), ("4:40", "Schedule, Export", export)]
    done = [demo_step(clock, what, fn) for clock, what, fn in steps]
    check("Demo script (7.10) runs end to end", all(done), f"{sum(done)} of {len(done)} steps ok, {time.perf_counter() - t_start:.1f} s of clicking",
          failed=[s["at"] + " " + s["step"] for s in R["demo"] if not s["ok"]] or None)
    page.context.close()


def check_offline_and_console() -> None:
    reqs = R["requests"]
    check("Offline: no request leaves localhost", not reqs["external"] and set(reqs["hosts"]) <= {"127.0.0.1", "localhost"},
          f"{reqs['count']:,} requests; hosts {reqs['hosts']}; schemes {reqs['schemes']}; external {len(reqs['external'])}",
          external=reqs["external"][:20] or None)
    noisy = {tag: msgs for tag, msgs in R["console"].items() if msgs}
    check("No console errors or warnings in any step", not noisy, f"{sum(map(len, noisy.values()))} messages in {len(noisy)} steps",
          messages={tag: msgs[:5] for tag, msgs in noisy.items()} or None)


def main() -> int:
    global BASE, SERVER_PID
    parser = argparse.ArgumentParser(description="Browser acceptance checks for the Workforce Planner (T-89).")
    parser.add_argument("--port", type=int, default=8611, help="Port for the server this script starts (default 8611; never 8501).")
    parser.add_argument("--no-shots", action="store_true", help="Skip the three-viewport screenshot pass.")
    args = parser.parse_args()
    SHOTS.mkdir(parents=True, exist_ok=True)
    server = Server(args.port)
    try:
        cold = server.start()
        BASE = R["base_url"] = server.url
        SERVER_PID = server.proc.pid
        R["timings"]["cold_start"] = cold
        health = cold["health"] or {}
        ready = bool(health.get("ready"))
        check("Cold start: launch to /api/health ready", ready and cold["ready_s"] < BUDGET["cold_start_s"],
              f"{cold['ready_s']} s (listening after {cold['listening_s']} s; the server's own prepare time {health.get('seconds')} s; "
              f"system CPU {(cold['machine_load'] or {}).get('system_cpu_percent')}% meanwhile)",
              budget=f"{BUDGET['cold_start_s']:.0f} s")
        if not ready:
            R["notes"].append({"server_log_tail": server.log_tail()})
            return 1
        plans = {s: api(f"plan?scenario={s}") for s in SCENARIOS}
        hashes = {s: hashlib.sha256(fetch(f"api/plan?scenario={s}")[0]).hexdigest() for s in SCENARIOS}
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            watch = Watch()
            sections = [("Page changes", lambda: check_page_changes(browser, watch)),
                        ("Scenario and warehouse switches", lambda: check_switches(browser, watch, plans)),
                        ("Board and drawer", lambda: check_board_and_drawer(browser, watch, plans)),
                        ("What-if", lambda: check_what_if(browser, watch, plans, hashes, server)),
                        ("Export", lambda: check_export(browser, watch)),
                        ("Demo script", lambda: run_demo(browser, watch, plans)),
                        ("Every page and screenshots", lambda: check_pages(browser, watch, not args.no_shots))]
            for name, run in sections:
                print(f"\n== {name}", flush=True)
                try:
                    run()
                except Exception as error:  # noqa: BLE001 - one broken section mustn't hide the rest
                    picture = None
                    try:
                        picture = shot(watch.current, "crash_" + re.sub(r"\W+", "_", name.lower()))
                        watch.current.context.close()
                    except Exception:  # noqa: BLE001 - the page may already be gone
                        pass
                    check(f"{name}: ran to the end", False, f"{type(error).__name__}: {str(error).splitlines()[0][:300]}",
                          step=watch.tag, url=getattr(watch.current, "url", None), screenshot=picture)
            browser.close()
        print("\n== Offline and console", flush=True)
        check_offline_and_console()
    finally:
        server.stop()
        failed = [c["check"] for c in R["checks"] if c["result"] == "FAIL"]
        R["finished"] = datetime.now().isoformat(timespec="seconds")
        R["summary"] = {"passed": len(R["checks"]) - len(failed), "failed": len(failed), "failed_checks": failed}
        OUTPUT.write_text(json.dumps(R, indent=1, ensure_ascii=False), encoding="utf-8")
        print(f"\n{R['summary']['passed']} passed, {len(failed)} failed. Results: {OUTPUT.relative_to(ROOT)}", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
