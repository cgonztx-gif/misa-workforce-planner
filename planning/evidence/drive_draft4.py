"""Draft 4 honesty harness: the rendered page against the known totals (DRAFT4.md sections 6.1, 8.1, 9; qa.md
"Known totals" and "Consistency checks").

It starts its own server (python -m server --draft4 --port 8671 --no-browser), waits for /api/health to say ready,
and drives Chromium at 1440 x 900. Every check reads what the user sees: visible text, aria-labels, the tooltip
strings the page shows on hover (data-tip) and computed colours matched against the page's own legend swatches.
data-key is used only to find a cell or a row; it is never the thing checked.

Expected answers come from planning/evidence/draft4_known_totals.output.json (computed from outputs/ only, by
draft4_known_totals.py) and from outputs/*.csv read here, never from the app's code.

All data is simulated for the Texas MISA case competition; it is not Costco data.

    python planning/evidence/drive_draft4.py            # uses the existing web/dist-draft4
    python planning/evidence/drive_draft4.py --build    # runs npm run build:draft4 first

Prints PASS/FAIL per check with what it measured, writes planning/evidence/drive_draft4.output.json and
screenshots to planning/evidence/draft4/qa/, and exits 1 on any failure.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import socket
import subprocess
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
EVID = ROOT / "planning" / "evidence"
KT_PATH = EVID / "draft4_known_totals.output.json"
OUT_JSON = EVID / "drive_draft4.output.json"
SHOTS = EVID / "draft4" / "qa"
CSV_PATH = ROOT / "outputs" / "TEAM_SUBMISSION_TEMPLATE_filled.csv"
PVD_PATH = ROOT / "outputs" / "plan_vs_draft.csv"

SCENARIOS = ["BASE", "PEAK", "DISRUPT"]
SCEN_LABEL = {"BASE": "Base", "PEAK": "Peak", "DISRUPT": "Disrupt"}
SCEN_NAME = {"BASE": "Baseline planning week", "PEAK": "Promotion and winter-weather surge", "DISRUPT": "Callouts and reduced availability"}
VIEWS = ["all", "1", "2", "4"]
VIEW_RADIO = {"all": "All warehouses", "1": "Warehouse 1", "2": "Warehouse 2", "4": "Warehouse 4"}
LENSES = ["service", "below", "people", "cost"]
DEPT_NAME = {38: "Front End", 92: "Merchandising", 95: "Pharmacy"}
DEPT_ABBR = {"FE": "Front End", "Merch": "Merchandising", "Pharm": "Pharmacy"}
SHIFT_SHORT = {"OPEN": "Open", "MID": "Mid", "EVE": "Eve"}
SHIFT_NAME = {"OPEN": "Opening", "MID": "Midday", "EVE": "Evening"}
DAYS = ["2026-02-12", "2026-02-13", "2026-02-14", "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18"]
DAY_SHORT = {d: s for d, s in zip(DAYS, ["Thu 12", "Fri 13", "Sat 14", "Sun 15", "Mon 16", "Tue 17", "Wed 18"])}
DAY_LONG = {d: s for d, s in zip(DAYS, ["Thursday February 12", "Friday February 13", "Saturday February 14", "Sunday February 15",
                                        "Monday February 16", "Tuesday February 17", "Wednesday February 18"])}
MINUS = "−"

# Legend label for each known-totals tier, per lens (the user matches a cell's colour to the legend).
# One hue on the board (the user, 2026-11-05): a block that meets the goal has no fill ("Meets goal"); a block below it is
# red at three strengths by its (lowest) chance: 90-95%, 80-90%, under 80%. The known totals' w1 covers 80-95%, so the
# label splits it at 90% on the cell's own chance.
RED_LABELS = ("90–95%", "80–90%", "Under 80%")
# Sweep (2026-11-05): People and Labor cost colour every open cell by their own measure; a below-goal cell there keeps
# that colour and gets a red outline (data-alert), so the lens stays readable on the holiday days.
PEOPLE_LEGEND = {"cut": "Fewer", "same": "Same", "+1": "+1–2", "+3": "+3–5", "+6": "+6"}
COST_LEGEND = {"same": "Same", "+$1": "<$300", "+$300": "$300–800", "+$800": "$800+"}


def service_label(e: dict) -> str:
    """The legend label a cell should read as on the Service board, from the known totals."""
    t = e["tier_service"]
    if t == "closed":
        return "Closed"
    if t == "w2":
        return "Under 80%"
    if t == "w1":
        ch = e.get("lowest_chance", e.get("chance"))
        return "90–95%" if ch is not None and ch >= 0.90 else "80–90%"
    return "Meets goal"

RESULTS: list[dict] = []


def check(name: str, ok: bool, measured, expected=None) -> bool:
    RESULTS.append({"check": name, "ok": bool(ok), "measured": measured, "expected": expected})
    m = measured if isinstance(measured, str) else json.dumps(measured, ensure_ascii=False, default=str)
    if len(m) > 600:
        m = m[:600] + " ..."
    line = f"{'PASS' if ok else 'FAIL'}  {name}: {m}"
    if not ok and expected is not None:
        e = expected if isinstance(expected, str) else json.dumps(expected, ensure_ascii=False, default=str)
        line += f"  | expected {e[:600]}"
    print(line, flush=True)
    return ok


# ---- formats (DRAFT4.md 5.12, JavaScript Math.round semantics) ------------------------------------------------
def js_round(x: float) -> int:
    import math
    return math.floor(x + 0.5)


def chance_text(c, below=False, goal=0.95) -> str:
    import math
    if c is None:
        return "—"
    if c <= 0:
        return "0%"
    if c < 0.001:
        return "<0.1%"
    v = js_round(c * 1000 + 1e-6) / 10
    if below and v >= goal * 100:
        v = math.floor(c * 1000) / 10
    return f"{v:.1f}%"


def int_text(n) -> str:
    return f"{js_round(n):,}"


def signed(n) -> str:
    r = js_round(n)
    return f"+{r:,}" if r > 0 else f"{MINUS}{-r:,}" if r < 0 else "±0"


def usd(n) -> str:
    r = js_round(n)
    return f"{MINUS if r < 0 else ''}${abs(r):,}"


def signed_usd(n) -> str:
    r = js_round(n)
    return f"+${r:,}" if r > 0 else f"{MINUS}${-r:,}" if r < 0 else "±$0"


def share(v: float) -> str:
    return "0%" if v == 0 else "<0.1%" if v < 0.1 else f"{v:.1f}%" if v < 1 else f"{js_round(v)}%"


# ---- server ---------------------------------------------------------------------------------------------------
def port_listening(port: int) -> bool:
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def pids_on_port(port: int) -> set[str]:
    try:
        out = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=20).stdout
    except Exception:
        return set()
    pids = set()
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[1].endswith(f":{port}") and parts[3].upper() == "LISTENING":
            pids.add(parts[4])
    return pids


class Server:
    def __init__(self, port: int):
        self.port = port
        self.url = f"http://127.0.0.1:{port}/"
        self.proc = None
        self.log = SHOTS / "server.log"

    def start(self) -> dict:
        if port_listening(self.port):
            raise SystemExit(f"Port {self.port} is already in use; stop that server first.")
        self.logf = open(self.log, "w", encoding="utf-8")
        t0 = time.perf_counter()
        self.proc = subprocess.Popen([sys.executable, "-m", "server", "--draft4", "--port", str(self.port), "--no-browser"],
                                     cwd=ROOT, stdout=self.logf, stderr=subprocess.STDOUT)
        health = None
        while time.perf_counter() - t0 < 180:
            if self.proc.poll() is not None:
                break
            try:
                with urllib.request.urlopen(self.url + "api/health", timeout=2) as r:
                    health = json.loads(r.read())
                if health.get("ready") or health.get("status") == "error":
                    break
            except Exception:
                pass
            time.sleep(0.5)
        return {"ready_s": round(time.perf_counter() - t0, 1), "health": health}

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        for pid in pids_on_port(self.port):
            subprocess.run(["taskkill", "/PID", pid, "/T", "/F"], capture_output=True)
        try:
            self.logf.close()
        except Exception:
            pass


# ---- page readers (JavaScript run in the page; they return what is rendered) -------------------------------------
JS_PROBE = """() => {
  const out = {};
  for (const t of ['good','bad','bad-strong','muted','accent','ink']) {
    const d = document.createElement('div'); d.style.color = `var(--color-${t})`; document.body.appendChild(d);
    out[t] = getComputedStyle(d).color; d.remove();
  }
  return out;
}"""

JS_TILES = """() => [...document.querySelectorAll('[data-card=plan] [data-tile]')].map(b => {
  const inner = b.firstElementChild; const rows = [...inner.children];
  const head = rows[0]; const spans = [...head.querySelectorAll(':scope > span')];
  const delta = spans[1];
  return { kind: b.getAttribute('data-tile'), pressed: b.getAttribute('aria-pressed'),
    label: spans[0]?.innerText ?? '', delta: delta?.innerText ?? '', deltaColor: delta ? getComputedStyle(delta).color : null,
    value: rows[1]?.innerText ?? '', sub: rows[2]?.innerText ?? '', tipTitle: b.getAttribute('data-tip-title'), tip: b.getAttribute('data-tip') };
})"""

JS_LEGEND = """() => Object.fromEntries([...document.querySelectorAll('[data-card=plan] [aria-label=Legend] > span')].map(s => {
  const sw = s.querySelector('[aria-hidden]');
  return [s.innerText.trim(), sw ? {bg: getComputedStyle(sw).backgroundColor, border: getComputedStyle(sw).borderTopStyle, shadow: getComputedStyle(sw).boxShadow} : null];
}))"""

JS_CELLS = """(sel) => {
  const root = document.querySelector(sel);
  const heads = Object.fromEntries([...root.querySelectorAll('[data-day]')].map(h => { const r = h.getBoundingClientRect(); return [h.getAttribute('data-day'), {x: r.left + r.width/2, tip: h.getAttribute('data-tip')}]; }));
  const rowheads = [...root.querySelectorAll('[role=rowheader]')].map(h => { const r = h.getBoundingClientRect(); return {label: h.getAttribute('aria-label'), y: r.top + r.height/2}; });
  const cells = [...root.querySelectorAll('[role=gridcell]')].map(c => {
    const cs = getComputedStyle(c); const r = c.getBoundingClientRect();
    const numEl = [...c.querySelectorAll('span')].find(s => /^[0-9,]+$/.test(s.innerText.trim()) && getComputedStyle(s).display !== 'none' && s.offsetParent !== null && !s.className.includes('text-muted'));
    const secEl = [...c.querySelectorAll('span')].find(s => /^[+\\u2212±][0-9,]+$/.test(s.innerText.trim()) && s.offsetParent !== null);
    const pipBox = [...c.querySelectorAll('span[aria-hidden]')].find(s => s.className.includes('absolute'));
    const ncs = numEl ? getComputedStyle(numEl) : null;
    return { key: c.getAttribute('data-key'), text: numEl ? numEl.innerText.trim() : c.innerText.trim(), whole: c.innerText, aria: c.getAttribute('aria-label'), tipTitle: c.getAttribute('data-tip-title'), tip: c.getAttribute('data-tip'),
      bg: cs.backgroundColor, border: cs.borderTopStyle, shadow: cs.boxShadow,
      x: r.left + r.width/2, y: r.top + r.height/2,
      numDeco: ncs ? ncs.textDecorationLine : null, numWeight: ncs ? ncs.fontWeight : null,
      sec: secEl ? secEl.innerText.trim() : '', secDeco: secEl ? getComputedStyle(secEl).textDecorationLine + ' ' + getComputedStyle(secEl).textDecorationStyle : '',
      pips: pipBox ? pipBox.children.length : 0, alert: c.getAttribute('data-alert') === '1' };
  });
  const grid = root.querySelector('[role=grid]');
  return { heads, rowheads, cells, gridAria: grid ? grid.getAttribute('aria-label') : null };
}"""

JS_LIST = """(sel) => {
  const root = document.querySelector(sel);
  if (!root) return null;
  const rows = [...root.querySelectorAll('button[data-key]')].map(b => {
    const kids = [...b.children];
    const bar = kids[0]?.firstElementChild; const sq = kids[2];
    const chance = kids[kids.length - 2]?.innerText.trim(); const short = kids[kids.length - 1]?.innerText.trim();
    const nameBox = kids[3];
    const chip = nameBox?.children[1]?.innerText.trim() ?? '';
    const name = nameBox?.children[0]?.innerText.trim() ?? '';
    return { key: b.getAttribute('data-key'), name, chip, chance, short,
      square: sq ? getComputedStyle(sq).backgroundColor : null, bar: bar ? getComputedStyle(bar).backgroundColor : null,
      barPct: bar ? bar.getBoundingClientRect().width / kids[0].getBoundingClientRect().width * 100 : null,
      barRight: bar ? (bar.getBoundingClientRect().right - kids[0].getBoundingClientRect().left) / kids[0].getBoundingClientRect().width * 100 : null };
  });
  const h2 = root.querySelector('h2');
  const foot = root.querySelector(':scope > div > div:last-child, :scope > div:last-child');
  return { title: h2 ? h2.innerText.trim() : null, rows, text: root.innerText };
}"""

JS_RANKED = """() => {
  const root = document.querySelector('[data-card=ranked]');
  const rows = [...root.querySelectorAll('.fade-in > *')].map(r => {
    const kids = [...r.children];
    const nameBox = kids[1];
    return { name: nameBox?.children[0]?.innerText.trim() ?? '', chip: nameBox?.children[1]?.innerText.trim() ?? '',
      value: kids[2]?.innerText.trim(), aside: kids[3]?.innerText.trim(), tip: r.getAttribute('data-tip'),
      selected: r.getAttribute('aria-current') === 'true' };
  });
  const lines = root.innerText.split('\\n').map(s => s.trim()).filter(Boolean);
  return { rows, foot: lines[lines.length - 1] };
}"""


def norm_name(name: str) -> str:
    parts = [p.strip() for p in name.split("·")]
    return " · ".join(DEPT_ABBR.get(p, p) for p in parts)


def legend_of(color: dict, legend: dict) -> str | None:
    """Which legend swatch a cell's colour matches, the way a viewer reads it."""
    if color["border"] == "dashed":
        return "Closed"
    for label, sw in legend.items():
        if sw and sw["bg"] == color["bg"] and color["bg"] not in ("rgba(0, 0, 0, 0)",):
            return label
    if color["bg"] == "rgba(0, 0, 0, 0)":
        return "Same" if "Same" in legend else "Meets goal" if "Meets goal" in legend else "(no fill)"
    return None


# ---- the run ----------------------------------------------------------------------------------------------------
class Run:
    def __init__(self, page, base_url: str, kt: dict, csvrows: dict, pvd: dict):
        self.page, self.url, self.kt, self.csv, self.pvd = page, base_url, kt, csvrows, pvd
        self.colors = {}
        self.legend_service = None
        self.warm_bg = {}

    # navigation through the UI (the demo path)
    def wait_board(self):
        self.page.wait_for_selector("[data-card=plan] [role=gridcell]", timeout=30000)
        self.page.wait_for_timeout(250)

    def scenario(self, s):
        self.page.click(f'aside nav[aria-label=Scenario] button:has-text("{SCEN_LABEL[s]}")')
        self.page.wait_for_function("(n) => document.querySelector('header, main').innerText.includes(n)", arg=SCEN_NAME[s])
        self.page.wait_for_timeout(300)

    def view(self, wk):
        self.page.click(f'[data-card=plan] [role=radiogroup][aria-label=Warehouse] [role=radio][aria-label="{VIEW_RADIO[wk]}"]')
        self.page.wait_for_timeout(250)

    def lens(self, lens):
        self.page.click(f"[data-card=plan] [data-tile={lens}]")
        self.page.wait_for_timeout(200)

    def compare(self, on: bool):
        sw = self.page.locator("[data-card=plan] [role=switch]")
        if (sw.get_attribute("aria-checked") == "true") != on:
            sw.click()
            self.page.wait_for_timeout(300)

    def clear(self):
        self.page.keyboard.press("Escape")
        self.page.wait_for_timeout(200)
        self.page.mouse.move(2, 2)

    def tiles(self):
        return {t["kind"]: t for t in self.page.evaluate(JS_TILES)}

    def cells(self):
        return self.page.evaluate(JS_CELLS, "[data-card=plan]")

    def body_text(self):
        return self.page.evaluate("() => document.querySelector('main').innerText")

    # ---- checks per scenario x view ----
    def check_view(self, s, wk):
        kv = self.kt["scenarios"][s]["views"][wk]
        tag = f"{s} {VIEW_RADIO[wk]}"
        # Tiles
        tiles = self.tiles()
        bad = []
        measured = {}
        for k in ["service", "below", "people", "cost"]:
            t, e = tiles[k], kv["tiles"][k]
            measured[k] = f"{t['value']} | {t['sub']} | {t['delta']}"
            if t["value"] != e["value_text"]:
                bad.append(f"{k} value {t['value']!r} != {e['value_text']!r}")
            if t["sub"] != e["draft_text"]:
                bad.append(f"{k} draft line {t['sub']!r} != {e['draft_text']!r}")
            if t["delta"] != e["delta_text"]:
                bad.append(f"{k} delta {t['delta']!r} != {e['delta_text']!r}")
            # Recolour (2026-11-05): green = good, red = bad. The known totals still mark the Labor cost delta grey (the old
            # "deliberate trade" rule); cost is lower-is-better (components.md "Delta badge"), so on a meaningful base a rise
            # is expected red and a fall green. Every other tile keeps the known colour.
            want_tone = e["delta_colour"]
            if k == "cost" and want_tone == "grey" and not e["delta_text"].startswith(("was", "±")) and e["delta"]:
                want_tone = "down" if e["delta"] > 0 else "up"
            # Red delta text is bad-strong (bad is under 4.5:1 on the selected tile's tint; DRAFT4.md 4).
            want = {"up": self.colors["good"], "down": self.colors["bad-strong"], "grey": self.colors["muted"]}[want_tone]
            if t["deltaColor"] != want:
                bad.append(f"{k} delta colour {t['deltaColor']} != {want_tone} {want}")
        check(f"{tag}: four tiles (value, draft line, delta, delta colour)", not bad, bad or measured)

        # Tile tooltips: exact values agree with the tiles
        tb = []
        st = tiles["service"]
        exact = kv["tiles"]["service"]["tooltip_exact"].split(" · ")
        if st["tipTitle"] != exact[0] or exact[1] not in (st["tip"] or ""):
            tb.append(f"service tip {st['tipTitle']!r} / {st['tip']!r} vs {exact}")
        # The page reads chances at the API's 6 decimals, so the lowest block is the worst block's text at that precision.
        lowest = kv["worst_block"]["chance_text"]
        if lowest and f"Lowest block {lowest}" not in (st["tip"] or ""):
            tb.append(f"service tip lowest block {st['tip']!r} vs {lowest}")
        bt = tiles["below"]
        be = kv["tiles"]["below"]["tooltip_exact"].split(" · ")
        if bt["tipTitle"] != be[0] or be[1] not in (bt["tip"] or ""):
            tb.append(f"below tip {bt['tipTitle']!r} / {bt['tip']!r} vs {be}")
        pt, pe = tiles["people"], kv["tiles"]["people"]
        for frag in [pe["tooltip_hours"], f"{pe['tooltip_overtime'].replace(' h', '')} overtime", f"{pe['over_capacity']} over capacity"]:
            if frag not in (pt["tip"] or ""):
                tb.append(f"people tip lacks {frag!r}: {pt['tip']!r}")
        ct, ce = tiles["cost"], kv["tiles"]["cost"]
        if ct["tipTitle"] != ce["value_exact"] or ce["draft_exact"] not in (ct["tip"] or "") or ce["delta_exact"] not in (ct["tip"] or ""):
            tb.append(f"cost tip {ct['tipTitle']!r} / {ct['tip']!r} vs {ce['value_exact']}, {ce['draft_exact']}, {ce['delta_exact']}")
        pts_txt = kv["tiles"]["service"]["delta_text"].lstrip("+").replace(" pts", "")
        if f"buys {pts_txt} points" not in (ct["tip"] or ""):
            tb.append(f"cost tip points {ct['tip']!r} vs {pts_txt}")
        check(f"{tag}: tile tooltips carry the exact values", not tb, tb or "service, below, people, cost tips agree")

        # Board cells (service lens)
        board = self.cells()
        self.check_board(tag, s, wk, kv, board, tiles)
        # Below goal list
        self.check_list(tag, s, wk, kv)
        # By day titles (all lenses). The ranked breakdown card was removed (the user, 2026-11-05).
        self.check_byday_and_lenses(tag, s, wk, kv)
        check(f"{tag}: the breakdown card is gone", self.page.locator("[data-card=ranked]").count() == 0, "no [data-card=ranked]")
        # Number hygiene
        txt = self.body_text()
        tips = " ".join(self.page.evaluate("() => [...document.querySelectorAll('[data-tip],[data-tip-title],[aria-label]')].map(e => (e.getAttribute('data-tip')||'')+' '+(e.getAttribute('data-tip-title')||'')+' '+(e.getAttribute('aria-label')||''))"))
        hits = [m.group(0) for m in re.finditer(r"NaN|Infinity|\bundefined\b|\bnull\b|" + MINUS + r"0(?![\d.,])|(?<![\d.])0\.0%|\$-0|-\$0|\b1 (blocks|people|warehouses)\b", txt + " " + tips)]
        check(f"{tag}: no NaN / Infinity / −0 / 0.0% / $-0 / '1 blocks' / undefined in text, tips or labels", not hits, hits or "none")

    def check_board(self, tag, s, wk, kv, board, tiles):
        cells = board["cells"]
        check(f"{tag}: board has 63 cells", len(cells) == 63, len(cells), 63)
        exp = {c["key"]: c for c in kv["cells"]}
        by_key = {c["key"]: c for c in cells}
        missing = [k for k in exp if k not in by_key]
        if missing:
            check(f"{tag}: every expected cell is on the board", False, missing[:5])
            return
        nb, cb, pb, ab, posb = [], [], [], [], []
        counts = defaultdict(int)
        total = 0
        for k, e in exp.items():
            c = by_key[k]
            # number (rendered text)
            num = c["text"].split("\n")[0].strip()
            if num != e["display_number"]:
                nb.append(f"{k}: shows {num!r}, expected {e['display_number']!r}")
            if e["is_open"]:
                total += int(num.replace(",", "")) if num.replace(",", "").isdigit() else 0
            # colour, matched to the legend the user sees
            tier = e["tier_service"]
            want = service_label(e)
            got = legend_of(c, self.legend)
            counts[got] += 1
            if got != want:
                cb.append(f"{k}: colour reads as {got!r}, expected {want!r} (chance {e.get('chance_text') or e.get('lowest_chance_text')})")
            if tier in ("w1", "w2"):
                if "underline" not in (c["numDeco"] or ""):
                    cb.append(f"{k}: warm number not underlined")
                if tier == "w2" and int(c["numWeight"] or 0) < 700:
                    cb.append(f"{k}: far-below number weight {c['numWeight']}")
            elif e["is_open"] and "underline" in (c["numDeco"] or ""):
                cb.append(f"{k}: healthy number underlined")
            # pips (All)
            if wk == "all":
                if c["pips"] != e["below_count_pips"]:
                    pb.append(f"{k}: {c['pips']} pips, expected {e['below_count_pips']}")
            # aria-label: context first, then the numbers the user would hear
            a = c["aria"] or ""
            where = f"{'All warehouses' if wk == 'all' else VIEW_RADIO[wk]}, {DAY_LONG[e['date']]}, {DEPT_NAME[e['dept_id']]}, {SHIFT_NAME[e['shift_code']]}"
            if not a.startswith(where):
                ab.append(f"{k}: aria starts {a[:80]!r}, expected {where!r}")
            if not e["is_open"]:
                if "closed" not in a:
                    ab.append(f"{k}: closed cell aria {a!r}")
            else:
                if f": {int_text(e['plan'])} people" not in a:
                    ab.append(f"{k}: aria people {a!r} vs {e['plan']}")
                ch = e["change"]
                vs = f"{int_text(ch)} more than the draft" if ch > 0 else f"{int_text(-ch)} fewer than the draft" if ch < 0 else "same as the draft"
                if vs not in a:
                    ab.append(f"{k}: aria change {a!r} vs {vs!r}")
                if wk == "all":
                    if f"lowest chance {e['lowest_chance_text']}" not in a:
                        ab.append(f"{k}: aria lowest chance {a!r} vs {e['lowest_chance_text']}")
                    n = e["below_count_pips"]
                    phrase = f"{n} warehouse{'s' if n != 1 else ''} below goal"
                    if (n > 0) != (phrase in a):
                        ab.append(f"{k}: aria below count {a!r} vs {n}")
                    # tooltip per warehouse lines
                    for w in e["warehouses"]:
                        line = f"W{w['store_id']} {int_text(w['plan'])} · {w['chance_text']}{' · below' if w['below'] else ''}"
                        if line not in (c["tip"] or "").split("\n"):
                            ab.append(f"{k}: tooltip lacks {line!r}")
                else:
                    if f"{e['chance_text']} chance" not in a:
                        ab.append(f"{k}: aria chance {a!r} vs {e['chance_text']}")
                    if e["below"]:
                        if f"below goal, {e['short']} short" not in a:
                            ab.append(f"{k}: aria short {a!r} vs {e['short']}")
                    elif "below goal" in a:
                        ab.append(f"{k}: healthy cell says below goal: {a!r}")
                    if c["tipTitle"] != f"{int_text(e['plan'])} people":
                        ab.append(f"{k}: tooltip title {c['tipTitle']!r}")
                    if f"Chance {e['chance_text']} · goal 95%" not in (c["tip"] or ""):
                        ab.append(f"{k}: tooltip chance {c['tip']!r}")
            # position: under its day's column header, in its department/shift row
            hx = board["heads"][e["date"]]["x"]
            if abs(c["x"] - hx) > 6:
                posb.append(f"{k}: x {c['x']:.0f} vs column {hx:.0f}")
            rh = [r for r in board["rowheads"] if r["label"] == f"{DEPT_NAME[e['dept_id']]}, {SHIFT_NAME[e['shift_code']]}"]
            if not rh or abs(rh[0]["y"] - c["y"]) > 6:
                posb.append(f"{k}: y {c['y']:.0f} vs row {rh[0]['y'] if rh else None}")
        check(f"{tag}: every cell's number (rendered text)", not nb, nb[:8] or f"63 of 63 agree; open cells sum {total:,}")
        check(f"{tag}: board numbers sum to the People tile and the known total", total == kv["board_sum"] and tiles["people"]["value"] == f"{total:,}",
              f"board {total:,}, People tile {tiles['people']['value']}", f"{kv['board_sum']:,}")
        check(f"{tag}: every cell's colour matches its legend swatch (warm / healthy tiers / closed)", not cb, cb[:8] or dict(counts))
        warm = sum(counts.get(x, 0) for x in RED_LABELS)
        check(f"{tag}: warm cells", warm == kv["warm_cells"], warm, kv["warm_cells"])
        if wk == "all":
            check(f"{tag}: pips (warehouses below goal per cell)", not pb, pb[:8] or "all 63 agree")
        check(f"{tag}: every cell's aria-label and tooltip (context, people, change, chance, short)", not ab, ab[:8] or "all 63 agree")
        check(f"{tag}: every cell sits under its day and in its department/shift row", not posb, posb[:5] or "all 63 placed")
        # closed cells
        closed = sorted(c["key"] for c in cells if c["text"] == "—" and c["border"] == "dashed")
        exp_closed = sorted(kv["closed_cells"]) if wk == "all" else sorted(k for k, e in exp.items() if not e["is_open"])
        check(f"{tag}: closed cells are dashed '—'", closed == exp_closed, closed, exp_closed)
        # worst block: the only dark-red (bad-strong) ring
        down = self.colors["bad-strong"]
        ringed = [c["key"] for c in cells if down in (c["shadow"] or "")]
        wb = kv["worst_block"]
        want = wb["all_cell_key"] if wk == "all" else wb["key"]
        check(f"{tag}: the single dark-red-ringed cell is the worst block", ringed == [want], ringed, [want])
        wc = by_key.get(want)
        if wc:
            phrase = "holds the worst block in view" if wk == "all" else "worst block in view"
            check(f"{tag}: worst cell says so in its aria-label and tooltip", phrase in (wc["aria"] or "") and "Worst block in view" in (wc["tip"] or ""),
                  {"aria": wc["aria"], "tip_has_rule": "Worst block in view" in (wc["tip"] or "")})
        # grid aria-label against the tiles
        ga = board["gridAria"] or ""
        t = kv["tiles"]
        most = kv["by_day_titles"]["below"].split(" / ")[1].split(" · ")[0]
        ties = kv["by_day_titles"]["ties"].get("below_worst", [most])
        okg = f"{t['people']['value_text']} people" in ga and f"{t['below']['value']} blocks below goal" in ga and any(f"most on {d}" in ga for d in ties)
        check(f"{tag}: grid aria-label agrees with the tiles", okg, ga, f"{t['people']['value_text']} people, {t['below']['value']} blocks below goal, most on {'/'.join(ties)}")
        # column header tooltips agree with the column the user sees
        hb = []
        for i, d in enumerate(DAYS):
            tip = board["heads"][d]["tip"] or ""
            col = [by_key[k] for k, e in exp.items() if e["date"] == d]
            colsum = sum(int(c["text"].split("\n")[0].replace(",", "")) for c in col if c["text"].split("\n")[0].replace(",", "").isdigit())
            exp_total = kv["board_day_totals"][i]
            if f"{colsum:,} people" not in tip or colsum != exp_total:
                hb.append(f"{d}: column sums {colsum:,}, known {exp_total:,}, tooltip {tip!r}")
            nbelow = kv["by_day"][i]["plan"]["below_goal"]
            if wk == "all":
                shown = sum(c["pips"] for c in col)
            else:
                shown = sum(1 for c in col if legend_of(c, self.legend) in RED_LABELS)
            phrase = f"{nbelow} block{'s' if nbelow != 1 else ''} below goal"
            if phrase not in tip or shown != nbelow:
                hb.append(f"{d}: tooltip {tip!r}, marks on the column {shown}, known {nbelow}")
        check(f"{tag}: column header tooltips (people, below goal) agree with the column", not hb, hb[:4] or "7 of 7 agree")

    def check_list(self, tag, s, wk, kv):
        lst = self.page.evaluate(JS_LIST, "[data-card=slot]")
        exp = kv["below_goal_list"]
        bad = []
        rows = lst["rows"] if lst else []
        if not rows:
            check(f"{tag}: Below goal list rows", False, "no rows")
            return
        for i, r in enumerate(rows):
            e = exp[i] if i < len(exp) else None
            name = norm_name(r["name"]) + (f" · {r['chip']}" if r["chip"] else "")
            if e is None:
                bad.append(f"row {i + 1} extra: {name}")
                continue
            if name != e["name"] or r["chance"] != e["chance_text"] or r["short"] != str(e["short"]):
                bad.append(f"row {i + 1}: {name} {r['chance']} {r['short']} vs {e['name']} {e['chance_text']} {e['short']}")
            want_sq = self.colors["bad-strong"] if e["is_worst"] else self.colors["bad"]
            if r["square"] != want_sq or r["bar"] != want_sq:
                bad.append(f"row {i + 1}: square {r['square']} bar {r['bar']} vs {'bad-strong' if e['is_worst'] else 'bad'}")
            # fix round 2 (vis-1): the bar is the gap to the goal, from the chance to the 95% tick, so the worst row is longest
            gap = max(0.0, 95.0 - e["chance"] * 100)
            if r["barPct"] is not None and (abs(r["barPct"] - max(0.9, gap)) > 1.5 or abs(r["barRight"] - 95.0) > 1.0):
                bad.append(f"row {i + 1}: bar {r['barPct']:.1f}% ending at {r['barRight']:.1f}% vs gap {gap:.1f}% ending at 95%")
        foot = re.search(r"(\d+) of (\d+)\s*$", lst["text"].strip())
        foot_txt = foot.group(0) if foot else None
        if not foot or int(foot.group(1)) != len(rows) or int(foot.group(2)) != len(exp):
            bad.append(f"footnote {foot_txt!r} vs '{len(rows)} of {len(exp)}'")
        tip = self.page.get_attribute("[data-card=plan] [data-tile=service]", "data-tip") or ""
        if f"Lowest block {rows[0]['chance']}" not in tip:
            bad.append(f"top row {rows[0]['chance']} vs Service tooltip {tip.splitlines()[-1]!r}")
        check(f"{tag}: Below goal list (order, name, chance, short, dark red only on the worst, red on the rest, bar = gap to goal, footnote; top = 'Lowest block')", not bad,
              bad[:6] or f"{len(rows)} rows shown, footnote {foot_txt!r}, top {rows[0]['name']} {rows[0]['chance']}")
        # expanded list = the full ranked list
        self.page.click('[data-card=slot] button[aria-label="All below-goal blocks"]')
        self.page.wait_for_selector("[data-list=expanded]")
        full = self.page.evaluate(JS_LIST, "[data-list=expanded]")
        self.page.keyboard.press("Escape")
        self.page.wait_for_timeout(250)
        fb = []
        frows = full["rows"]
        if len(frows) != len(exp):
            fb.append(f"{len(frows)} rows vs {len(exp)}")
        for i, (r, e) in enumerate(zip(frows, exp)):
            name = r["name"] + (f" · {r['chip']}" if r["chip"] else "")
            if name != e["name"] or r["chance"] != e["chance_text"] or r["short"] != str(e["short"]):
                fb.append(f"row {i + 1}: {name} {r['chance']} {r['short']} vs {e['name']} {e['chance_text']} {e['short']}")
        tsum = sum(int(r["short"]) for r in frows if r["short"].isdigit())
        if tsum != kv["total_short_p1"]:
            fb.append(f"total short {tsum} vs {kv['total_short_p1']}")
        check(f"{tag}: expanded Below goal list = the full ranked list (count = tile, total short)", not fb, fb[:6] or f"{len(frows)} rows, total short {tsum}")

    def check_byday_and_lenses(self, tag, s, wk, kv):
        bad = []
        legend_bad = []
        unlisted = set()
        for lens in LENSES:
            self.lens(lens)
            lines = [x.strip() for x in self.page.inner_text("[data-card=byday]").split("\n") if x.strip()]
            title = f"{lines[0]} / {lines[1]}"
            want = kv["by_day_titles"][lens]
            tie_key = {"service": "service_lowest", "below": "below_worst", "people": "people_busiest"}.get(lens)
            ties = kv["by_day_titles"]["ties"].get(tie_key, []) if tie_key else []
            alts = {want} | {want.split(" / ")[0] + " / " + d + " · " + want.split(" · ")[-1] for d in ties}
            # DRAFT4.md 5.12 writes compact money as $377.5k and $20k: a trailing ".0" is dropped ($23.0k -> $23k).
            alts |= {re.sub(r"\.0k$", "k", a) for a in alts}
            if title not in alts:
                bad.append(f"{lens}: {title!r} vs {want!r}")
            if lens == "service":
                aria = self.page.get_attribute("[data-card=byday] [data-plot][aria-label]", "aria-label") or ""
                lo = want.split(" / ")[1].replace(" · ", " ")
                if f"lowest {lo}" not in aria or f"highest {kv['by_day_titles']['service_highest']}" not in aria:
                    bad.append(f"service aria {aria!r}")
            # the board under this lens: every colour has a swatch in the legend shown, and the tiers are the known ones.
            # DRAFT4.md 5.6: the warm tiers override every lens, so a below-goal cell expects its warm tier.
            if lens in ("people", "cost", "below"):
                legend = self.page.evaluate(JS_LEGEND)
                board = self.cells()
                exp = {c["key"]: c for c in kv["cells"]}
                for c in board["cells"]:
                    e = exp.get(c["key"])
                    if not e:
                        continue
                    got = legend_of(c, legend)
                    ts = e["tier_service"]
                    if lens in ("people", "cost") and c["alert"] != (ts in ("w1", "w2")):
                        legend_bad.append(f"{lens} {c['key']}: red outline {c['alert']}, below goal {ts in ('w1', 'w2')}")
                    if ts == "closed" or (lens == "below" and ts in ("w1", "w2")):
                        want_l = service_label(e)
                    elif lens == "below":
                        if got in ("Same", "(no fill)", "Meets goal"):
                            continue
                        want_l = "(no fill)"
                    else:
                        tier = e["tier_people" if lens == "people" else "tier_cost"]
                        want_l = (PEOPLE_LEGEND if lens == "people" else COST_LEGEND)[tier]
                    if got is None:
                        # a colour the legend on screen doesn't list; say which swatch it is elsewhere on the page
                        alias = legend_of(c, self.legend)
                        unlisted.add(f"{lens}: {alias or c['bg']}")
                        if alias == want_l:
                            continue
                    if got != want_l:
                        detail = ""
                        if wk == "all" and lens in ("people", "cost"):
                            m = e["change" if lens == "people" else "cost_change"]
                            detail = f" (sum {m:+.2f})"
                        legend_bad.append(f"{lens} {c['key']}: colour reads {got!r}, expected {want_l!r}{detail}")
        self.lens("service")
        check(f"{tag}: By day title for each lens (and the service chart's aria-label)", not bad, bad or "service, below, people, cost agree")
        check(f"{tag}: every colour on the board under People / Cost / Below goal has a swatch in the legend shown", not unlisted,
              sorted(unlisted) or "all listed")
        uniq = sorted(set(x.split(": ", 1)[1].split(" (")[0] for x in legend_bad))
        check(f"{tag}: People / Cost / Below goal lens colours match the known tier (red fill on Below goal, red outline on People / Cost)", not legend_bad,
              (f"{len(legend_bad)} cells; kinds: {uniq[:4]}; e.g. {legend_bad[:4]}") if legend_bad else "all cells agree")

    def check_ranked(self, tag, s, wk, kv, tiles):
        def tab(label):
            self.page.click(f'[data-card=ranked] [role=radio][aria-label="{label}"]')
            self.page.wait_for_timeout(200)
            return self.page.evaluate(JS_RANKED)
        bad = []
        # Changes
        r = tab("Changes")
        blocks = {}
        for w in ["1", "2", "4"]:
            for c in self.kt["scenarios"][s]["views"][w]["cells"]:
                blocks[c["key"]] = c
        keys = kv["largest_changes_first10"][:7]
        for i, (row, k) in enumerate(zip(r["rows"], keys)):
            b = blocks[k]
            name = f"{DAY_SHORT[b['date']]} · {DEPT_NAME[b['dept_id']]} · {SHIFT_SHORT[b['shift_code']]}"
            got = norm_name(row["name"])
            if got != name or (wk == "all" and row["chip"] != f"W{b['store_id']}") or row["value"] != signed(b["change"]) or row["aside"] != f"{b['draft']} → {b['plan']}":
                bad.append(f"Changes row {i + 1}: {got} {row['chip']} {row['value']} {row['aside']} vs {name} W{b['store_id']} {signed(b['change'])} {b['draft']} → {b['plan']}")
        if len(r["rows"]) != min(7, len(kv["largest_changes_first10"])):
            bad.append(f"Changes shows {len(r['rows'])} rows")
        top = kv["largest_change_top"]
        if r["rows"] and (r["rows"][0]["value"] != top["change_text"] or r["rows"][0]["aside"] != top["draft_to_plan"]):
            bad.append(f"Changes top {r['rows'][0]} vs {top}")
        # Departments
        r = tab("Departments")
        dsum = 0
        for row, d in zip(r["rows"], kv["departments"]):
            chip = str(d["below_goal"]) if d["below_goal"] > 0 else ""
            if row["name"] != d["department"] or row["value"] != d["employees_text"] or row["aside"] != d["share_text"] or row["chip"] != chip:
                bad.append(f"Departments {row} vs {d}")
            if d["cost_text"] not in (row["tip"] or ""):
                bad.append(f"Departments tip {row['tip']!r} vs {d['cost_text']}")
            dsum += int(row["value"].replace(",", ""))
        people = kv["tiles"]["people"]["value"]
        if dsum != people or r["foot"] != f"of {people:,} people":
            bad.append(f"Departments sum {dsum} / foot {r['foot']!r} vs People {people:,}")
        # Warehouses (All only)
        if wk == "all":
            r = tab("Warehouses")
            wsum = 0
            for row, w in zip(r["rows"], ["1", "2", "4"]):
                wt = self.kt["scenarios"][s]["views"][w]["tiles"]
                e_people = wt["people"]["value"]
                chip = str(wt["below"]["value"]) if wt["below"]["value"] > 0 else ""
                if not row["name"].startswith(f"Warehouse {w}") or row["value"] != f"{e_people:,}" or row["aside"] != share(100 * e_people / people) or row["chip"] != chip:
                    bad.append(f"Warehouses {row} vs W{w} {e_people:,} {share(100 * e_people / people)} chip {chip}")
                if f"service {wt['service']['value_text']}" not in (row["tip"] or "") or wt["cost"]["value_text"] not in (row["tip"] or ""):
                    bad.append(f"Warehouses tip {row['tip']!r} vs {wt['service']['value_text']} {wt['cost']['value_text']}")
                wsum += int(row["value"].replace(",", ""))
            if wsum != people:
                bad.append(f"Warehouses sum {wsum} vs {people}")
        else:
            labels = self.page.evaluate("() => [...document.querySelectorAll('[data-card=ranked] [role=radio]')].map(e => e.getAttribute('aria-label'))")
            if "Warehouses" in labels:
                bad.append("Warehouses tab shown in a single-warehouse view")
        # Scenarios
        r = tab("Scenarios")
        for row, sc in zip(r["rows"], SCENARIOS):
            st = self.kt["scenarios"][sc]["views"][wk]["tiles"]
            if row["name"] != SCEN_LABEL[sc] or row["value"] != st["service"]["value_text"] or row["aside"] != st["cost"]["value_text"] or row["selected"] != (sc == s):
                bad.append(f"Scenarios {row['name']} {row['value']} {row['aside']} sel={row['selected']} vs {SCEN_LABEL[sc]} {st['service']['value_text']} {st['cost']['value_text']} sel={sc == s}")
            if f"Below goal {st['below']['value']} · People {st['people']['value_text']}" not in (row["tip"] or ""):
                bad.append(f"Scenarios tip {row['tip']!r}")
        cur = [row for row in r["rows"] if row["selected"]]
        if cur and (cur[0]["value"] != tiles["service"]["value"] or cur[0]["aside"] != tiles["cost"]["value"]):
            bad.append(f"Scenarios current row {cur[0]['value']} {cur[0]['aside']} vs tiles {tiles['service']['value']} {tiles['cost']['value']}")
        tab("Changes")
        check(f"{tag}: ranked card rows (Changes, Departments, Warehouses, Scenarios) and their sums", not bad, bad[:6] or "all tabs agree")

        # Sidebar scenario tooltip vs the tiles
        tip = self.page.get_attribute(f'aside nav[aria-label=Scenario] button:has-text("{SCEN_LABEL[s]}")', "data-tip") or ""
        want = f"Service {tiles['service']['value']} · Below goal {tiles['below']['value']}"
        check(f"{tag}: sidebar scenario tooltip agrees with the tiles", want in tip, tip.split("\n")[-1], want)

    # ---- detail panel ----
    def detail_text(self):
        return self.page.inner_text("[data-card=slot] [data-detail]")

    def check_block_detail(self, s, key, why, compare=False):
        """Open a block from its single-warehouse board cell and compare the detail with the known cell and plan_vs_draft.csv."""
        store = key.split("|")[1]
        self.view(store)
        kv = self.kt["scenarios"][s]["views"][store]
        e = next(c for c in kv["cells"] if c["key"] == key)
        p = self.pvd[tuple(key.split("|"))]
        self.compare(compare)
        self.page.click(f'[data-card=plan] [role=gridcell][data-key="{key}"]')
        self.page.wait_for_selector(f'[data-card=slot] [data-detail=block][data-key="{key}"]')
        self.page.wait_for_timeout(250)
        t = self.detail_text()
        lines = [x.strip() for x in t.split("\n") if x.strip()]
        bad = []
        cap = int(p["capacity"])
        title = f"{DAY_SHORT[e['date']]} · {DEPT_NAME[e['dept_id']]} · {SHIFT_NAME[e['shift_code']]}"
        if title not in lines:
            bad.append(f"title missing {title!r}")
        if not any(x.startswith(f"Warehouse {store} · ") for x in lines):
            bad.append("warehouse sub-line missing")
        m = re.search(r"Draft\n(\S+)\n→\nPlan\n(\S+)\n(\S+)", "\n".join(lines))
        if not m:
            bad.append("no Draft → Plan block")
        else:
            chip = "Same" if e["change"] == 0 else signed(e["change"])
            if m.group(1) != int_text(e["draft"]) or m.group(2) != int_text(e["plan"]) or m.group(3) != chip:
                bad.append(f"draft/plan/change {m.groups()} vs {e['draft']} {e['plan']} {chip}")
        m = re.search(r"Chance\n(?:(Short \d+)\n)?(?:(draft \S+)\n)?(\S+%|—)", "\n".join(lines))
        if not m:
            bad.append("no Chance row")
        else:
            if m.group(3) != e["chance_text"]:
                bad.append(f"chance {m.group(3)} vs {e['chance_text']}")
            if e["below"]:
                if m.group(1) != f"Short {e['short']}":
                    bad.append(f"short chip {m.group(1)} vs Short {e['short']}")
            elif m.group(1):
                bad.append(f"healthy block shows {m.group(1)}")
            if compare:
                cd = float(p["chance_met_draft"])
                want = f"draft {chance_text(round(cd, 6))}"
                if m.group(2) != want:
                    bad.append(f"compare draft chance {m.group(2)} vs {want}")
        chips = [x for x in ("Below goal", "Meets goal") if x in lines[3:8]]
        if chips != (["Below goal"] if e["below"] else ["Meets goal"]):
            bad.append(f"status chip {chips}")
        if f"{int_text(e['plan'])} of {cap}" not in lines:
            bad.append(f"staff line missing '{e['plan']} of {cap}'")
        parts = [(n, int(p[f])) for n, f in (("Regular", "fill_regular"), ("Cross-trained", "fill_flex"), ("Overtime", "fill_overtime"))]
        # Sweep: the staff key draws a swatch per part, so its text is the parts in order, one after another.
        src = " · ".join(f"{n} {v}" for n, v in parts if v > 0)
        flat = " ".join(" ".join(lines).split())
        if " ".join(f"{n} {v}" for n, v in parts if v > 0) not in flat:
            bad.append(f"sources line missing {src!r}")
        if e["below"]:
            if f"need {e['short'] + e['plan']}" not in lines:
                bad.append(f"need tick label missing 'need {e['short'] + e['plan']}'")
        m = re.search(r"Cost\n(\S+)\n(\S+)", "\n".join(lines))
        if not m or m.group(1) != e["cost_text"] or m.group(2) != e["cost_change_text"]:
            bad.append(f"cost {m.groups() if m else None} vs {e['cost_text']} {e['cost_change_text']}")
        util = js_round(float(p["planned_utilization"]) * 100)
        m = re.search(r"Utilization\n(\S+)", "\n".join(lines))
        if not m or m.group(1) != f"{util}%":
            bad.append(f"utilization {m.group(1) if m else None} vs {util}%")
        if compare:
            un = int(p["unfilled"])
            if un > 0 and f"Unfilled {un}" not in lines:
                bad.append(f"P3 block lacks 'Unfilled {un}'")
            if un == 0 and any(x.startswith("Unfilled") for x in lines):
                bad.append("Unfilled chip on a block the draft can field")
        check(f"{s}: detail of {key} ({why}{', Compare on' if compare else ''})", not bad, bad or " | ".join(lines[2:30]))
        self.clear()
        self.compare(False)
        return lines

    def check_all_detail(self, s, all_key, why):
        self.view("all")
        kv = self.kt["scenarios"][s]["views"]["all"]
        e = next(c for c in kv["cells"] if c["key"] == all_key)
        self.page.click(f'[data-card=plan] [role=gridcell][data-key="{all_key}"]')
        self.page.wait_for_selector(f'[data-card=slot] [data-detail=all][data-key="{all_key}"]')
        self.page.wait_for_timeout(250)
        rows = self.page.evaluate("""() => [...document.querySelectorAll('[data-card=slot] [data-detail=all] button[data-key]')].map(b => b.innerText.split('\\n').map(s=>s.trim()).filter(Boolean))""")
        foot = self.page.evaluate("""() => { const d = [...document.querySelectorAll('[data-card=slot] [data-detail=all] div')].find(x => x.className.includes('border-t')); return d ? d.innerText.split('\\n').map(s=>s.trim()).filter(Boolean) : null; }""")
        bad = []
        for r, w in zip(rows, e["warehouses"]):
            want = [f"Warehouse {w['store_id']}", int_text(w["draft"]), int_text(w["plan"]), signed(w["change"]), w["chance_text"]]
            if r != want:
                bad.append(f"{r} vs {want}")
        wantf = ["All", int_text(e["draft"]), int_text(e["plan"]), signed(e["change"])]
        if foot != wantf:
            bad.append(f"sum row {foot} vs {wantf}")
        check(f"{s}: All-cell detail of {all_key} ({why})", not bad, bad or {"rows": rows, "sum": foot})
        self.clear()

    def check_compare(self, s, wk):
        kv = self.kt["scenarios"][s]["views"][wk]
        tag = f"{s} {VIEW_RADIO[wk]}"
        before = self.tiles()
        self.compare(True)
        board = self.cells()
        exp = {c["key"]: c for c in kv["cells"]}
        bad, p3 = [], []
        for c in board["cells"]:
            e = exp.get(c["key"])
            if not e or not e["is_open"]:
                continue
            want = e["change_text"]
            if not want and e.get("p3_draft_unfilled", 0) > 0:
                want = "±0"  # a draft-unfilled cell with no net change still carries its dashed mark on ±0
            if c["sec"] != want:
                bad.append(f"{c['key']}: shows {c['sec']!r}, expected {want!r}")
            if "dashed" in c["secDeco"] and "underline" in c["secDeco"]:
                p3.append(c["key"])
            num = c["text"].split("\n")[0]
            if num != e["display_number"]:
                bad.append(f"{c['key']}: number changed to {num!r} with Compare on")
        if wk == "all":
            exp_p3_all = sorted(k for k, e in exp.items() if e.get("p3_draft_unfilled", 0) > 0)
        else:
            exp_p3_all = sorted(k for k in kv["p3_draft_over_capacity"]["keys"])
        check(f"{tag} Compare on: every cell's draft difference (+N / −N, ±0 only on a draft-unfilled cell, none when equal) and the number unchanged",
              not bad, bad[:6] or "all open cells agree")
        hidden_p3 = sorted(set(exp_p3_all) - set(p3))
        check(f"{tag} Compare on: dashed warm underline on exactly the draft-unfilled (P3) cells", sorted(p3) == exp_p3_all,
              {"marked": len(p3), "p3_in_view": len(exp_p3_all), "p3_without_a_visible_mark": hidden_p3}, {"marked": len(exp_p3_all)})
        if exp_p3_all:
            check(f"{tag} Compare on: every P3 cell carries a visible mark", not hidden_p3,
                  hidden_p3 or f"{len(exp_p3_all)} of {len(exp_p3_all)} marked")
        legend = self.page.inner_text("[data-card=byday]")
        after = self.tiles()
        same = all(before[k]["value"] == after[k]["value"] and before[k]["sub"] == after[k]["sub"] for k in before)
        check(f"{tag} Compare on: chart legend adds Draft, tiles unchanged", "Draft" in legend.split("\n")[:6] and same,
              {"chart_head": legend.split("\n")[:4], "tiles_unchanged": same})
        # Below goal tile tooltip mentions the P3 fact in DISRUPT
        tip = after["below"]["tip"] or ""
        p3k = kv["p3_draft_over_capacity"]
        if p3k["blocks"] > 0:
            want = f"Draft can't field {p3k['people']} people in {p3k['blocks']} block{'s' if p3k['blocks'] != 1 else ''}"
            check(f"{tag}: Below goal tooltip states the P3 fact", want in tip, tip.split("\n")[-1], want)
        self.compare(False)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8671)
    ap.add_argument("--build", action="store_true")
    args = ap.parse_args()
    SHOTS.mkdir(parents=True, exist_ok=True)
    sys.stdout.reconfigure(encoding="utf-8")

    if args.build:
        r = subprocess.run("npm run build:draft4", cwd=ROOT / "web", shell=True, capture_output=True, text=True)
        check("npm run build:draft4", r.returncode == 0, (r.stdout + r.stderr)[-400:])

    kt = json.loads(KT_PATH.read_text(encoding="utf-8"))
    csv_bytes = CSV_PATH.read_bytes()
    sub = list(csv.DictReader(io.StringIO(csv_bytes.decode("utf-8-sig"))))
    subk = {(r["scenario_code"], r["store_id"], r["dept_id"], r["day_date"], r["shift_code"]): int(r["submitted_employees"]) for r in sub}
    pvd = {}
    with open(PVD_PATH, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            pvd[(r["scenario_code"], r["store_id"], r["dept_id"], r["day_date"], r["shift_code"])] = r

    server = Server(args.port)
    from playwright.sync_api import sync_playwright
    t_start = time.time()
    try:
        info = server.start()
        check("server --draft4 ready", bool(info["health"] and info["health"].get("ready")), info)
        if not (info["health"] and info["health"].get("ready")):
            return finish(1, t_start)
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
            page = ctx.new_page()
            requests, console = [], []
            page.on("request", lambda r: requests.append(r.url))
            page.on("console", lambda m: console.append({"type": m.type, "text": m.text}) if m.type in ("error", "warning") else None)
            page.on("pageerror", lambda e: console.append({"type": "pageerror", "text": str(e)}))
            run = Run(page, server.url, kt, subk, pvd)

            # ---- default view (no hash) = the submitted plan ----
            page.goto(server.url)
            run.wait_board()
            page.wait_for_timeout(800)
            run.colors = page.evaluate(JS_PROBE)
            run.legend = page.evaluate(JS_LEGEND)
            page.screenshot(path=str(SHOTS / "default-1440x900.png"))
            state = {
                "hash": page.evaluate("location.hash"),
                "scenario": page.evaluate("() => [...document.querySelectorAll('aside nav[aria-label=Scenario] button')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.innerText.split('\\n')[0])"),
                "warehouse": page.evaluate("() => [...document.querySelectorAll('[aria-label=Warehouse] [role=radio]')].filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.innerText)"),
                "lens": page.evaluate("() => [...document.querySelectorAll('[data-tile]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.getAttribute('data-tile'))"),
                "compare": page.get_attribute("[data-card=plan] [role=switch]", "aria-checked"),
                "detail_open": page.query_selector("[data-card=slot] [data-detail]") is not None,
                "status": page.inner_text("main").split("\n")[:6],
            }
            okd = state["scenario"] == ["Base"] and state["warehouse"] == ["All"] and state["lens"] == ["service"] and state["compare"] == "false" and not state["detail_open"]
            check("Default view (no hash): Base, All, Service lens, Compare off, nothing selected", okd, state)
            check("Default view: 'Submitted plan' pill shown", "Submitted plan" in page.inner_text("main"), "Submitted plan" in page.inner_text("main"))
            # cells = submitted_employees (All: sum over 3 warehouses), joined on keys
            board = run.cells()
            mism = []
            total = 0
            for c in board["cells"]:
                _, dept, date, shift = c["key"].split("|")
                want = sum(subk[("BASE", st, dept, date, shift)] for st in ("1", "2", "4"))
                num = c["text"].split("\n")[0]
                got = int(num.replace(",", "")) if num.replace(",", "").isdigit() else 0
                total += got
                if got != want:
                    mism.append(f"{c['key']}: {num} vs CSV {want}")
            check("Default view: every All cell = Σ submitted_employees in the CSV (joined on keys)", not mism and total == 2710,
                  mism[:6] or f"63 cells, sum {total:,}; CSV BASE sum {sum(v for k, v in subk.items() if k[0] == 'BASE'):,}")

            # ---- every scenario x view ----
            for s in SCENARIOS:
                run.scenario(s)
                for wk in VIEWS:
                    run.view(wk)
                    run.clear()
                    if wk != "all":
                        board = run.cells()
                        mm = [c["key"] for c in board["cells"] if (c["text"].split("\n")[0].replace(",", "") or "0") != str(subk[tuple(c["key"].split("|"))]) and not (c["text"] == "—" and subk[tuple(c["key"].split("|"))] == 0)]
                        check(f"{s} {VIEW_RADIO[wk]}: every cell = submitted_employees (CSV joined on keys; closed = 0)", not mm, mm[:6] or "63 of 63")
                    run.check_view(s, wk)
                    run.check_compare(s, wk)
                    if (s, wk) in (("BASE", "all"), ("PEAK", "all"), ("DISRUPT", "2")):
                        page.screenshot(path=str(SHOTS / f"{s.lower()}-{wk}-1440x900.png"))

                # detail panels: the worst block and two others, per scenario
                kv = kt["scenarios"][s]["views"]["all"]
                worst = kv["worst_block"]["key"]
                second = kv["below_goal_list"][1]["key"]
                healthy = next(c["key"] for c in kt["scenarios"][s]["views"]["2"]["cells"] if c["is_open"] and not c["below"])
                run.check_block_detail(s, worst, "worst block")
                if s == "BASE":
                    page.click(f'[data-card=plan] [role=gridcell][data-key="{worst}"]')
                    page.wait_for_timeout(300)
                    page.screenshot(path=str(SHOTS / "base-worst-detail-1440x900.png"))
                    run.clear()
                run.check_block_detail(s, second, "second in the list")
                run.check_block_detail(s, healthy, "a healthy block")
                run.check_block_detail(s, worst, "worst block", compare=True)
                p3 = kv["p3_draft_over_capacity"]["keys"]
                if p3:
                    run.check_block_detail(s, p3[0], "a draft-unfilled (P3) block", compare=True)
                    run.check_block_detail(s, p3[-1], "a draft-unfilled (P3) block", compare=True)
                run.check_all_detail(s, kv["worst_block"]["all_cell_key"], "the worst block's cell")
                run.check_all_detail(s, "all|92|2026-02-14|OPEN", "Merchandising Sat 14 Open")
                run.check_all_detail(s, "all|38|2026-02-12|OPEN", "a healthy cell")

            # ---- edge cases (DRAFT4.md 9.3) ----
            for edge in kt["edges"]:
                s, store, dept, date, shift = edge["key"].split("|")
                run.scenario(s)
                run.view(store)
                run.clear()
                c = next(x for x in run.cells()["cells"] if x["key"] == edge["key"])
                got = legend_of(c, run.legend)
                want_leg = service_label(edge)
                aria = c["aria"] or ""
                ok = got == want_leg and f"{edge['expected_text']} chance" in aria and (("below goal" in aria) == edge["expected_below"])
                check(f"Edge {edge['key']} on the board: {edge['expected_text']}, {'below goal' if edge['expected_below'] else 'not below goal'}", ok,
                      {"colour": got, "aria": aria}, {"colour": want_leg, "text": edge["expected_text"], "below": edge["expected_below"]})
                page.click('[data-card=slot] button[aria-label="All below-goal blocks"]')
                page.wait_for_selector("[data-list=expanded]")
                inlist = page.query_selector(f'[data-list=expanded] button[data-key="{edge["key"]}"]')
                row = inlist.inner_text().split("\n") if inlist else None
                page.keyboard.press("Escape")
                page.wait_for_timeout(200)
                check(f"Edge {edge['key']}: {'in' if edge['expected_below'] else 'not in'} the Below goal list", (inlist is not None) == edge["expected_below"] and (not inlist or edge["expected_text"] in row),
                      row or "not listed")
                run.check_block_detail(s, edge["key"], f"edge {edge['expected_text']}")
            run.scenario("BASE")
            run.view("all")

            # ---- hash state restores on reload ----
            run.scenario("PEAK")
            run.view("2")
            run.lens("cost")
            run.compare(True)
            sel = kt["scenarios"]["PEAK"]["views"]["2"]["worst_block"]["key"]
            page.click(f'[data-card=plan] [role=gridcell][data-key="{sel}"]')
            page.wait_for_timeout(400)
            h = page.evaluate("location.hash")
            before = page.inner_text("main")
            page.reload()
            run.wait_board()
            page.wait_for_timeout(800)
            after_state = {
                "hash": page.evaluate("location.hash"),
                "scenario": page.evaluate("() => [...document.querySelectorAll('aside nav[aria-label=Scenario] button')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.innerText.split('\\n')[0])"),
                "warehouse": page.evaluate("() => [...document.querySelectorAll('[aria-label=Warehouse] [role=radio]')].filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.getAttribute('aria-label'))"),
                "lens": page.evaluate("() => [...document.querySelectorAll('[data-tile]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.getAttribute('data-tile'))"),
                "compare": page.get_attribute("[data-card=plan] [role=switch]", "aria-checked"),
                "detail": page.get_attribute("[data-card=slot] [data-detail]", "data-key"),
                "header": SCEN_NAME["PEAK"] in page.inner_text("main"),
            }
            same_text = page.inner_text("main") == before
            ok = after_state["scenario"] == ["Peak"] and after_state["warehouse"] == ["Warehouse 2"] and after_state["lens"] == ["cost"] and after_state["compare"] == "true" and after_state["detail"] == sel and after_state["header"]
            check("Hash state restores on reload (Peak, W2, Labor cost lens, Compare on, worst block open)", ok and same_text, {"hash_before": h, **after_state, "same_visible_text": same_text})
            page.screenshot(path=str(SHOTS / "restored-peak-w2-cost-compare-1440x900.png"))
            run.clear()
            run.compare(False)
            run.lens("service")
            run.scenario("BASE")
            run.view("all")

            # ---- CSV download = the hand-in file, byte for byte ----
            link = page.locator('main a[href*="submission.csv"]:visible').first
            with page.expect_download() as dl:
                link.click()
            path = dl.value.path()
            got = Path(path).read_bytes()
            check("CSV button downloads a file byte-identical to outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv", got == csv_bytes,
                  {"bytes": len(got), "expected_bytes": len(csv_bytes), "suggested_name": dl.value.suggested_filename, "rows": got.decode('utf-8-sig').count('\n') - 1})

            # ---- evidence shots for the two board findings ----
            run.scenario("DISRUPT")
            run.view("all")
            run.compare(True)
            page.mouse.move(2, 2)
            page.locator("[data-card=plan]").screenshot(path=str(SHOTS / "disrupt-all-compare-plan-card.png"))
            run.compare(False)
            run.scenario("BASE")
            run.lens("people")
            page.mouse.move(2, 2)
            page.locator("[data-card=plan]").screenshot(path=str(SHOTS / "base-all-people-lens-plan-card.png"))
            run.lens("service")

            # ---- the projector: the same numbers at 1366 x 768 (browser viewport 1366 x 657) ----
            for vw, vh in ((1366, 657), (1366, 768)):
                page.set_viewport_size({"width": vw, "height": vh})
                page.goto(server.url + "#s=BASE&w=all&l=service&c=0")
                run.wait_board()
                page.wait_for_timeout(600)
                tiles = run.tiles()
                lst = page.evaluate(JS_LIST, "[data-card=slot]")
                foot = re.search(r"(\d+) of (\d+)\s*$", lst["text"].strip())
                clipped = page.evaluate("""() => { const s = document.querySelector('[data-card=slot]').getBoundingClientRect();
                    return [...document.querySelectorAll('[data-card=slot] button[data-key]')].filter(b => b.getBoundingClientRect().bottom > s.bottom + 0.5).length; }""")
                kvb = kt["scenarios"]["BASE"]["views"]["all"]
                ok = all(tiles[k]["value"] == kvb["tiles"][k]["value_text"] for k in tiles) and foot and int(foot.group(1)) == len(lst["rows"]) and int(foot.group(2)) == 25 and not clipped
                check(f"{vw}x{vh}: tiles, list rows and the 'N of 25' footnote agree; no list row cut off", bool(ok),
                      {"tiles": [tiles[k]["value"] for k in tiles], "rows": len(lst["rows"]), "footnote": foot.group(0) if foot else None, "rows_cut_off": clipped})
                page.screenshot(path=str(SHOTS / f"base-all-{vw}x{vh}.png"))
            page.set_viewport_size({"width": 1440, "height": 900})

            # ---- what-if on the Overview (D-33) ----
            check_whatif(page, server.url, run, kt, requests)

            # ---- the other pages (T-99) ----
            check_pages(page, server.url, run, kt)

            # ---- fixture: empty list, P3 mark, P2 tie-break (DRAFT4.md 1.1) ----
            check_fixture(ctx, server.url, run)

            # ---- offline and console ----
            hosts = sorted({urlparse(u).hostname or urlparse(u).scheme for u in requests})
            outside = [u for u in requests if not (u.startswith("http://127.0.0.1:") or u.startswith("data:") or u.startswith("blob:"))]
            check("No request leaves 127.0.0.1", not outside, {"requests": len(requests), "hosts": hosts, "outside": outside[:5]})
            check("No console errors or warnings", not console, console[:8] or "none")
            browser.close()
    finally:
        server.stop()
    return finish(0, t_start)


def api_json(url: str, path: str, timeout: float = 90):
    with urllib.request.urlopen(url + path, timeout=timeout) as r:
        return json.loads(r.read())


def check_whatif(page, url, run, kt, requests):
    """What-if on the Overview (D-33, DRAFT4.md 14). The page against independent fetches of /api/what-if and /api/plan.

    These figures come from the live engine, not from outputs/, so this is a consistency check: what the page shows in a
    what-if is exactly what the API returns, re-based on the submitted plan; Reset returns the known totals exactly."""
    wi_reqs = [u for u in requests if "/api/what-if" in u]
    check("What-if: the default view and the views checked so far never call /api/what-if", not wi_reqs, wi_reqs[:3] or "none")

    kv = kt["scenarios"]["BASE"]["views"]["all"]
    page.goto(url + "#s=BASE&w=all&l=service&c=0")
    run.wait_board()
    page.wait_for_timeout(500)
    ready = '[data-card=plan][data-whatif="1"]:not([data-busy])'

    def tiles_vs(tag, api, settings_text):
        vs = api["vs_submitted"]["all"]
        w, s, r = vs["what_if"], vs["submitted"], vs["submitted_rescored"]
        t = run.tiles()
        bad = []
        if t["people"]["value"] != int_text(w["employees"]) or t["people"]["sub"] != f"Submitted {int_text(s['employees'])}":
            bad.append(f"People {t['people']['value']!r} / {t['people']['sub']!r} vs {w['employees']} / submitted {s['employees']}")
        if t["below"]["value"] != int_text(w["below_goal"]) or t["below"]["sub"] != f"Submitted {int_text(s['below_goal'])}":
            bad.append(f"Below goal {t['below']['value']!r} / {t['below']['sub']!r} vs {w['below_goal']} / submitted {s['below_goal']}")
        if t["service"]["value"] != chance_text(w["expected_met"]) or t["service"]["sub"] != f"Submitted {chance_text(s['expected_met'])}":
            bad.append(f"Service {t['service']['value']!r} / {t['service']['sub']!r} vs {w['expected_met']} / submitted {s['expected_met']}")
        if t["cost"]["tipTitle"] != usd(w["cost"]):
            bad.append(f"Labor cost tip title {t['cost']['tipTitle']!r} vs {usd(w['cost'])}")
        if f"Without re-planning {chance_text(r['expected_met'])}" not in (t["service"]["tip"] or ""):
            bad.append(f"Service tip lacks 'Without re-planning {chance_text(r['expected_met'])}': {t['service']['tip']!r}")
        if f"Without re-planning {int_text(r['below_goal'])}" not in (t["below"]["tip"] or ""):
            bad.append(f"Below goal tip lacks 'Without re-planning {int_text(r['below_goal'])}'")
        # the submitted side of every tile is the known total of the default view
        for k in ("service", "below", "people"):
            if t[k]["sub"] != f"Submitted {kv['tiles'][k]['value_text']}":
                bad.append(f"{k} baseline {t[k]['sub']!r} vs known total {kv['tiles'][k]['value_text']}")
        board = run.cells()
        total = sum(int(c["text"].replace(",", "")) for c in board["cells"] if c["text"].replace(",", "").isdigit())
        if total != w["employees"]:
            bad.append(f"board sums to {total:,}, what-if {w['employees']:,}")
        hdr = page.inner_text("header")
        for chip in settings_text:
            if chip not in hdr:
                bad.append(f"header lacks the chip {chip!r}")
        if not page.query_selector('header [data-status="whatif"]') or page.query_selector('header [data-status="ready"]'):
            bad.append("header: What-if pill missing or Submitted plan pill still shown")
        check(f"What-if {tag}: tiles, baselines, 'without re-planning' tips, board sum and header agree with /api/what-if",
              not bad, bad or {k: t[k]["value"] for k in t})

    # 1. A preset (the one the server warms at startup)
    page.click('[data-adjust="adjust"] [data-preset="busier"]')
    page.wait_for_selector(ready, timeout=120000)
    page.wait_for_timeout(400)
    h = page.evaluate("location.hash")
    check("What-if preset 'Busier week': the hash carries co=1.5 and dm=0.1", "co=1.5" in h and "dm=0.1" in h, h)
    api = api_json(url, "api/what-if?scenario=BASE&goal=0.95&callouts=1.5&demand=0.1&availability=0")
    tiles_vs("Busier week (BASE, All)", api, ["Demand +10%", "Callouts 1.5×"])
    page.screenshot(path=str(SHOTS / "whatif-busier-1440x900.png"))

    # 2. Compare with submitted: every open cell's secondary = what-if minus submitted, summed over its warehouses
    run.compare(True)
    by_cell = defaultdict(int)
    for c in api["changes"]:
        by_cell[f"all|{c['dept_id']}|{c['date']}|{c['shift_code']}"] += c["change"]
    board = run.cells()
    bad = []
    for c in board["cells"]:
        if not c["text"].replace(",", "").isdigit():
            continue
        want = signed(by_cell[c["key"]]) if by_cell.get(c["key"]) else ""
        if c["sec"] != want:
            bad.append(f"{c['key']}: shows {c['sec']!r}, expected {want!r}")
    label = page.inner_text("[data-card=plan] [role=switch]")
    check("What-if, Compare on: the switch reads 'Compare with submitted' and each cell shows its change against the submitted plan",
          not bad and label.strip() == "Compare with submitted", bad[:6] or {"switch": label, "cells": len(board["cells"])})
    run.compare(False)

    # 3. A slider, by keyboard: one step, applied by itself after it rests
    page.focus('[data-adjust="adjust"] [data-thumb="callouts"]')
    page.keyboard.press("ArrowRight")
    page.wait_for_selector("[data-card=plan][data-busy]", timeout=5000)
    page.wait_for_selector(ready, timeout=120000)
    page.wait_for_timeout(400)
    h = page.evaluate("location.hash")
    api2 = api_json(url, "api/what-if?scenario=BASE&goal=0.95&callouts=1.75&demand=0.1&availability=0")
    check("What-if slider: one ArrowRight on Callouts re-plans by itself (hash co=1.75)", "co=1.75" in h, h)
    tiles_vs("Callouts 1.75× (BASE, All)", api2, ["Demand +10%", "Callouts 1.75×"])

    # 4. The goal: the legend's first red step follows it
    page.click('[data-adjust="adjust"] [data-goal="0.975"]')
    page.wait_for_selector(ready, timeout=120000)
    page.wait_for_timeout(400)
    legend = page.evaluate(JS_LEGEND)
    tip = run.tiles()["service"]["tip"] or ""
    check("What-if goal 97.5%: the legend reads 90–97.5% and the Service tip names the 97.5% goal",
          "90–97.5%" in legend and "Goal 97.5% per block" in tip, {"legend": list(legend), "tip": tip.split("\n")[1] if "\n" in tip else tip})

    # 5. Reset: the submitted plan again, exactly
    page.click("[data-header-reset]")
    page.wait_for_timeout(600)
    t = run.tiles()
    h = page.evaluate("location.hash")
    ok = (all(t[k]["value"] == kv["tiles"][k]["value_text"] for k in ("service", "below", "people"))
          and t["people"]["sub"].startswith("Draft ") and page.query_selector('header [data-status="ready"]') is not None
          and not any(x in h for x in ("co=", "dm=", "g=", "av=")) and page.query_selector("[data-card=plan][data-whatif]") is None)
    check("What-if Reset: the known totals, Draft baselines, the Submitted plan pill and a clean hash return", ok,
          {"tiles": {k: t[k]["value"] for k in t}, "sub": t["people"]["sub"], "hash": h})


def usd_compact(n: float) -> str:
    """lib/format.ts usdCompact: $377.5k, $20k, $1.2M (a trailing .0 dropped)."""
    a = abs(n)
    sign = MINUS if n < 0 else ""
    if a >= 999_950:
        s = f"{a / 1e6:.1f}".removesuffix(".0")
        return f"{sign}${s}M"
    if a >= 1000:
        s = f"{a / 1e3:.1f}".removesuffix(".0")
        return f"{sign}${s}k"
    return f"{sign}${js_round(a)}"


def check_pages(page, url, run, kt):
    """The Cost and service, Playbook and Methods pages (T-99, DRAFT4.md 15-17) against independent API fetches."""
    tradeoff = api_json(url, "api/tradeoff")
    playbook = api_json(url, "api/playbook")
    methods = api_json(url, "api/methods")
    diagnosis = api_json(url, "api/diagnosis")
    plan = api_json(url, "api/plan?scenario=BASE")

    def stiles():
        return page.evaluate("""() => Object.fromEntries([...document.querySelectorAll('[data-strip] [data-tile]')].map(t => {
            const rows = [...t.firstElementChild.children]; return [t.getAttribute('data-tile'), {value: rows[1]?.innerText ?? '', sub: rows[2]?.innerText ?? '',
            delta: rows[0] && rows[0].children.length > 1 ? rows[0].lastElementChild.innerText : '', tipTitle: t.getAttribute('data-tip-title')}]; }))""")

    # ---- navigation: the sidebar's Pages switch pages and write p= ----
    page.goto(url + "#s=BASE&w=all&l=service&c=0")
    run.wait_board()
    page.click('aside nav[aria-label=Pages] [data-page="cost"]')
    page.wait_for_selector("[data-page=cost] [data-strip=cost]", timeout=30000)
    h = page.evaluate("location.hash")
    check("Pages: the sidebar opens Cost and service (p=cost) and the header names it",
          "p=cost" in h and page.inner_text("header h1").strip() == "Cost and service", {"hash": h, "h1": page.inner_text("header h1")})

    # ---- Cost and service ----
    page.wait_for_timeout(500)
    T = plan["totals"]["all"]
    t = stiles()
    pts_sel = tradeoff["goals"]["BASE"]
    sel_i = next(i for i, p in enumerate(pts_sel) if p["selected"])
    bad = []
    if t["cost"]["tipTitle"] != usd(T["plan"]["cost"]) or t["cost"]["sub"] != f"Draft {usd_compact(T['draft']['cost'])}":
        bad.append(f"Labor cost {t['cost']} vs {usd(T['plan']['cost'])} / draft {usd_compact(T['draft']['cost'])}")
    if t["service"]["value"] != chance_text(T["plan"]["expected_met"]) or t["service"]["sub"] != f"Draft {chance_text(T['draft']['expected_met'])}":
        bad.append(f"Service {t['service']}")
    if t["perpoint"]["value"] != usd_compact(pts_sel[sel_i]["cost_per_point"]) or not t["perpoint"]["sub"].startswith(f"Next point {usd_compact(pts_sel[sel_i + 1]['cost_per_point'])}"):
        bad.append(f"Cost per point {t['perpoint']} vs {usd_compact(pts_sel[sel_i]['cost_per_point'])}, next {usd_compact(pts_sel[sel_i + 1]['cost_per_point'])}")
    if t["overtime"]["value"] != f"{int_text(T['plan']['overtime_hours'])} h":
        bad.append(f"Overtime {t['overtime']['value']!r} vs {T['plan']['overtime_hours']}")
    steps = page.evaluate("() => [...document.querySelectorAll('[data-chart=goalsteps] [data-step]')].map(s => ({goal: s.getAttribute('data-step'), sel: s.getAttribute('data-selected'), text: s.innerText}))")
    want_steps = [p for p in pts_sel if p["cost_per_point"] is not None]
    if [s["goal"] for s in steps] != [str(p["goal"]) for p in want_steps] or [s["goal"] for s in steps if s["sel"]] != ["0.95"]:
        bad.append(f"goal steps {[(s['goal'], s['sel']) for s in steps]}")
    for s, p in zip(steps, want_steps):
        if usd_compact(p["cost_per_point"]) not in s["text"]:
            bad.append(f"step {p['goal']}: {s['text']!r} lacks {usd_compact(p['cost_per_point'])}")
    plans = [p for p in tradeoff["callout_allowance"]["plans"] if p["scenario_code"] == "BASE"]
    cells = page.evaluate("() => [...document.querySelectorAll('[data-table=allowance] [data-plan]')].map(r => [...r.children].slice(2).map(c => c.innerText.trim()))")
    want_cells = [[chance_text(p["met_both_risks"]), chance_text(p["met_forecast_error_only"]), chance_text(p["met_neither"])] for p in plans]
    if cells != want_cells:
        bad.append(f"allowance {cells} vs {want_cells}")
    hist = page.inner_text("[data-card-body=history]")
    if f"{int_text(diagnosis['kpi']['short_hours'])} h" not in hist or f"{int_text(diagnosis['kpi']['over_hours'])} h" not in hist:
        bad.append("history KPIs")
    check("Cost and service (BASE, All): tiles, the goal steps (95% selected), the callout allowance and history agree with the API",
          not bad, bad or {k: t[k]["value"] for k in t})
    page.screenshot(path=str(SHOTS / "page-cost-1440x900.png"))
    # the scenario rows switch the scenario
    page.click('[data-list=scenarios] [data-scenario="PEAK"]')
    page.wait_for_function("(n) => document.querySelector('header').innerText.includes(n)", arg=SCEN_NAME["PEAK"])
    page.wait_for_timeout(600)
    t2 = stiles()
    pk = kt["scenarios"]["PEAK"]["views"]["all"]["tiles"]["service"]["value_text"]
    check("Cost and service: a scenario row switches the scenario (Peak's service tile)", t2["service"]["value"] == pk, {"service": t2["service"]["value"], "want": pk})
    page.click('aside nav[aria-label=Scenario] button:has-text("Base")')
    page.wait_for_timeout(500)

    # ---- Playbook ----
    page.click('aside nav[aria-label=Pages] [data-page="playbook"]')
    page.wait_for_selector("[data-page=playbook] [data-strip=pto]", timeout=30000)
    page.wait_for_timeout(500)
    rows = playbook["pto"]["rows"]
    t = stiles()
    top, r0 = rows[-1], rows[0]
    bad = []
    if t["below"]["value"] != int_text(top["blocks_below_goal"]) or t["below"]["sub"] != f"Submitted {int_text(r0['blocks_below_goal'])}":
        bad.append(f"Below goal {t['below']} vs {top['blocks_below_goal']}")
    if t["service"]["value"] != chance_text(top["expected_met"]) or t["kept"]["value"] != int_text(top["people_kept"]):
        bad.append(f"Service/kept {t['service']['value']} {t['kept']['value']}")
    if t["cost"]["tipTitle"] != usd(top["cost"]):
        bad.append(f"Cost {t['cost']['tipTitle']} vs {usd(top['cost'])}")
    page.click('[data-chart=pto] [data-level="0"]')
    page.wait_for_timeout(300)
    t0 = stiles()
    if t0["below"]["value"] != int_text(r0["blocks_below_goal"]) or t0["kept"]["value"] != "0" or t0["below"]["delta"]:
        bad.append(f"level 0: {t0['below']} kept {t0['kept']['value']}")
    tight = playbook["tightest"]["BASE"]["all"]
    lst = page.evaluate("() => [...document.querySelectorAll('[data-card-body=tightest] button[data-key]')].map(b => b.getAttribute('data-key'))")
    if lst != [x["key"] for x in tight]:
        bad.append(f"least cushion {lst[:3]} vs {[x['key'] for x in tight][:3]}")
    gaps = sum(g["gap_people"] for g in playbook["capacity_gaps"] if g["scenario_code"] == "BASE")
    if f"{int_text(gaps)} people" not in page.inner_text("[data-card-body=gaps]"):
        bad.append(f"people short total {gaps}")
    steps_n = page.evaluate("() => document.querySelectorAll('[data-detail=play] [data-actions] li').length")
    if steps_n != len(playbook["scenarios"]["BASE"]["actions"]):
        bad.append(f"plan steps {steps_n}")
    check("Playbook (BASE): the PTO lever drives the tiles (level 5 and level 0), the steps, least cushion and people short agree with the API",
          not bad, bad or {k: t[k]["value"] for k in t})
    page.screenshot(path=str(SHOTS / "page-playbook-1440x900.png"))
    # a least-cushion row opens that block on the Overview
    first = tight[0]["key"]
    page.click(f'[data-card-body=tightest] button[data-key="{first}"]')
    page.wait_for_selector(f'[data-card=slot] [data-detail=block][data-key="{first}"]', timeout=15000)
    h = page.evaluate("location.hash")
    check("Playbook: a least-cushion row opens its block on the Overview", "p=" not in h and f"b={first.split('|', 1)[1]}" in h, h)

    # ---- Methods ----
    page.click('aside nav[aria-label=Pages] [data-page="methods"]')
    page.wait_for_selector("[data-page=methods] [data-strip=methods]", timeout=30000)
    page.wait_for_timeout(500)
    t = stiles()
    allrow = next(r for r in methods["forecast"]["backtest_daily"] if r["group"] == "All")
    bad = []
    if t["forecast"]["value"] != f"{js_round(allrow['model'] * 1000) / 10:.1f}%" or t["brier"]["value"] != f"{methods['service']['brier']['model']:.3f}":
        bad.append(f"forecast/brier {t['forecast']['value']} {t['brier']['value']}")
    if t["submission"]["value"] != ("Passes" if not methods["plan"]["validator_problems"] else str(len(methods["plan"]["validator_problems"]))):
        bad.append(f"submission {t['submission']['value']}")
    if t["tests"]["value"] != int_text(methods["tests"]["count"]):
        bad.append(f"tests {t['tests']['value']}")
    # the cliff: blocks and the met share per band, folded as the page folds them, from /api/diagnosis
    agg = defaultdict(lambda: [0, 0.0])
    for b in diagnosis["service_bands"]:
        k = 0.55 if b["band"] < 0.6 - 1e-9 else 1.0 if b["band"] >= 1 - 1e-9 else round(b["band"], 2)
        agg[k][0] += b["blocks"]
        agg[k][1] += b["met_target"] * b["blocks"]
    bands = page.evaluate("() => [...document.querySelectorAll('[data-chart=cliff] [data-band]')].map(b => [b.getAttribute('data-band'), Number(b.getAttribute('data-met')), b.innerText])")
    want = [(k, m / n, n) for k, (n, m) in sorted(agg.items())]
    if len(bands) != len(want) or any(abs(b[1] - w[1]) > 1e-4 or int_text(w[2]) not in b[2] for b, w in zip(bands, want)):
        bad.append(f"cliff {[(b[0], b[1]) for b in bands]} vs {[(w[0], round(w[1], 4)) for w in want]}")
    steps_n = page.evaluate("() => document.querySelectorAll('[data-detail=engine] [data-step]').length")
    if steps_n != len(methods["engine"]):
        bad.append(f"engine steps {steps_n}")
    ours = sum(1 for a in methods["assumptions"] if a["source"] == "ours")
    tabs = page.inner_text("[data-card-body=assumptions] [role=tablist]")
    if f"Ours {ours}" not in tabs or f"Case {len(methods['assumptions']) - ours}" not in tabs:
        bad.append(f"assumption tabs {tabs!r}")
    check("Methods: trust tiles, the service cliff (per band), the engine steps and the assumption counts agree with the API",
          not bad, bad or {k: t[k]["value"] for k in t})
    page.screenshot(path=str(SHOTS / "page-methods-1440x900.png"))
    page.goto(url + "#s=BASE&w=all&l=service&c=0")
    run.wait_board()


def check_fixture(ctx, url, run):
    """The live BASE payload, edited so the empty list, P3 and the P2 tie-break trigger (served with page.route)."""
    raw = urllib.request.urlopen(url + "api/plan?scenario=BASE", timeout=20).read()
    plan = json.loads(raw)
    # W2 has no block below goal
    for b in plan["blocks"]:
        if str(b["store_id"]) == "2":
            b["below_goal"] = False
    plan["totals"]["2"]["plan"]["below_goal"] = 0
    # one P3 block in W1
    p3 = next(b for b in plan["blocks"] if b["key"] == "BASE|1|92|2026-02-13|OPEN")
    p3["draft_sources"]["unfilled"] = 6
    # P2 tie: two 0% blocks in W4, the second with the larger need − plan
    a = next(b for b in plan["blocks"] if b["key"] == "BASE|4|38|2026-02-12|OPEN")
    z = next(b for b in plan["blocks"] if b["key"] == "BASE|4|38|2026-02-18|EVE")
    for b, need in ((a, a["plan"] + 2), (z, z["plan"] + 9)):
        b["chance"] = 0.0
        b["below_goal"] = True
        b["need"] = need
    (SHOTS / "plan_fixture.json").write_text(json.dumps(plan), encoding="utf-8")
    page = ctx.new_page()
    page.route("**/api/plan?scenario=BASE", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(plan)))
    page.goto(url + "#s=BASE&w=2&l=service&c=0")
    page.wait_for_selector("[data-card=plan] [role=gridcell]")
    page.wait_for_timeout(600)
    run2 = Run(page, url, run.kt, run.csv, run.pvd)
    run2.colors, run2.legend = run.colors, run.legend
    cells = run2.cells()["cells"]
    warm = [c["key"] for c in cells if legend_of(c, run.legend) in RED_LABELS]
    lst = page.evaluate(JS_LIST, "[data-card=slot]")
    check("Fixture W2: 0 warm cells and the list reads 'Closest to goal'", not warm and lst["title"] == "Closest to goal",
          {"warm": len(warm), "title": lst["title"], "rows": len(lst["rows"]), "tile": page.inner_text("[data-tile=below]").split("\n")})
    page.screenshot(path=str(SHOTS / "fixture-w2-closest-1440x900.png"))
    page.click('[aria-label=Warehouse] [role=radio][aria-label="Warehouse 4"]')
    page.wait_for_timeout(300)
    cells = run2.cells()["cells"]
    ringed = [c["key"] for c in cells if run.colors["bad-strong"] in (c["shadow"] or "")]
    lst = page.evaluate(JS_LIST, "[data-card=slot]")
    check("Fixture W4: the P2 tie-break picks the larger-shortfall 0% block", ringed == [z["key"]] and lst["rows"][0]["key"] == z["key"],
          {"ringed": ringed, "list_top": lst["rows"][0]["key"]}, z["key"])
    page.click('[aria-label=Warehouse] [role=radio][aria-label="Warehouse 1"]')
    page.click("[data-card=plan] [role=switch]")
    page.wait_for_timeout(300)
    c = next(x for x in run2.cells()["cells"] if x["key"] == p3["key"])
    page.click(f'[data-card=plan] [role=gridcell][data-key="{p3["key"]}"]')
    page.wait_for_timeout(300)
    t = page.inner_text("[data-card=slot] [data-detail]")
    check("Fixture P3: dashed underline with Compare on (when the cell has a difference) and 'Unfilled 6' in the detail",
          "Unfilled 6" in t and ("dashed" in c["secDeco"] or c["sec"] == ""), {"secondary": c["sec"], "decoration": c["secDeco"], "unfilled_chip": "Unfilled 6" in t})
    page.close()


def finish(code: int, t0: float) -> int:
    fails = [r for r in RESULTS if not r["ok"]]
    out = {
        "about": "drive_draft4.py: the rendered draft 4 page against planning/evidence/draft4_known_totals.output.json and outputs/*.csv. Simulated data, not Costco data.",
        "run_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "seconds": round(time.time() - t0, 1),
        "viewport": "1440x900",
        "passed": len(RESULTS) - len(fails),
        "failed": len(fails),
        "failures": [r["check"] for r in fails],
        "results": RESULTS,
    }
    OUT_JSON.write_text(json.dumps(out, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
    print(f"\n{len(RESULTS) - len(fails)} passed, {len(fails)} failed. Wrote {OUT_JSON}")
    return 1 if fails or code else 0


if __name__ == "__main__":
    sys.exit(main())
