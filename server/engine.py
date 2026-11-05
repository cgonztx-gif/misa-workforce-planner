"""Loads the inputs and service curves once, prepares all three scenarios, and caches what-if runs.

Startup runs in a background thread, so the server answers /api/health at once and the front end can
show a "preparing" screen. The heavy src/ imports also happen in that thread, so a missing data pack
becomes a clear error message instead of a crash.
"""
from __future__ import annotations

import json
import threading
import time
import traceback
from collections import OrderedDict
from dataclasses import dataclass

import pandas as pd

from server import content
from server.serialize import dumps
from src.data import CSV_DIR, ROOT

OUTPUTS = ROOT / "outputs"
SUBMISSION = OUTPUTS / "TEAM_SUBMISSION_TEMPLATE_filled.csv"
SCENARIO_CODES = ("BASE", "PEAK", "DISRUPT")
CACHE_SIZE = 48


class NotReady(Exception):
    """Raised by data lookups while the engine is still preparing, or after it failed."""


@dataclass(frozen=True)
class Settings:
    scenario: str
    goal: float = 0.95
    callouts: float = 1.0
    demand: float = 0.0
    availability: float = 0.0

    def key(self) -> tuple:
        return (self.scenario, round(self.goal, 4), round(self.callouts, 4), round(self.demand, 4), round(self.availability, 4))

    def as_dict(self) -> dict:
        _, goal, callouts, demand, availability = self.key()
        return {"scenario": self.scenario, "goal": goal, "callouts": callouts, "demand": demand, "availability": availability}


def read_output(name: str, attempts: int = 6, **kwargs):
    """Read a file in outputs/, retrying briefly in case the pipeline is rewriting it right now."""
    path = OUTPUTS / name
    for attempt in range(attempts):
        try:
            if name.endswith(".json"):
                return json.loads(path.read_text(encoding="utf-8"))
            return pd.read_csv(path, **kwargs)  # A zero-byte file mid-rewrite raises EmptyDataError, a ValueError.
        except FileNotFoundError:
            raise NotReady(f"outputs/{name} is missing. Run python -m src.pipeline from the project folder, then restart the server.")
        except (OSError, ValueError, pd.errors.ParserError) as error:
            if attempt == attempts - 1:
                raise NotReady(f"Couldn't read outputs/{name}: {error}")
            time.sleep(0.4)


# The Scenario lab's "Busier week" preset and demo step 3:10 (DELIVERABLES_PLAN.md 7.10), warmed at startup.
DEMO_WHAT_IFS = tuple(Settings(scenario, demand=0.10, callouts=1.5) for scenario in ("BASE", "PEAK", "DISRUPT"))


class Engine:
    def __init__(self):
        self.status = "idle"
        self.step = "Waiting to start"
        self.error: str | None = None
        self.seconds: float | None = None
        self.started: float | None = None
        self._done = threading.Event()
        self.warmed = threading.Event()  # Set once the demo what-ifs are cached (or warm-up gave up).
        self._thread: threading.Thread | None = None
        self._cache: OrderedDict[tuple, bytes] = OrderedDict()
        self._cache_lock = threading.Lock()
        self._run_locks: dict[tuple, threading.Lock] = {}
        self._defaults: dict[tuple, bytes] = {}  # The submitted plan per scenario, never evicted.
        self.meta: dict | None = None
        self.bytes: dict[str, bytes] = {}

    # Startup -----------------------------------------------------------------------------------

    def start(self) -> None:
        if self._thread is not None:
            return
        self.status, self.started = "preparing", time.perf_counter()
        self._thread = threading.Thread(target=self._prepare_safely, name="planner-startup", daemon=True)
        self._thread.start()

    def wait(self, timeout: float | None = None) -> bool:
        """Wait until ready or failed. True when ready."""
        self._done.wait(timeout)
        return self.status == "ready"

    def _prepare_safely(self) -> None:
        try:
            self._prepare()
            self.seconds = time.perf_counter() - self.started
            self.status, self.step = "ready", "Ready"
            threading.Thread(target=self._warm_demo_what_ifs, name="planner-warm", daemon=True).start()
        except Exception as error:  # Shown on /api/health and in every 503, so it must never escape.
            traceback.print_exc()
            self.error = str(error) if isinstance(error, NotReady) else f"Startup failed while {self.step.lower()}: {type(error).__name__}: {error}"
            self.status = "error"
        finally:
            self._done.set()

    def _prepare(self) -> None:
        self.step = "Checking the data pack"
        if not (CSV_DIR / "v_ShiftHistory.csv").exists() or not (CSV_DIR / "v_PlanningWeekGrid.csv").exists():
            raise NotReady(content.DATA_MISSING)

        self.step = "Loading the engine"
        from server import payloads, views, views_demand
        from src.app_data import DEFAULTS, run_scenario
        from src.data import load_planning_grid, open_history
        from src.explain import ASSUMPTIONS
        from src.playbook import on_the_day, scenario_actions
        from src.search import planning_inputs
        from src.service import fit_all

        self._run_scenario, self._payloads = run_scenario, payloads
        self.assumption_text = dict(ASSUMPTIONS)
        self.defaults = {**DEFAULTS, "availability": 0.0}
        self.assumptions = content.our_assumptions(self.assumption_text) + content.case_assumptions()
        self.meta = views.meta(load_planning_grid(), self.assumptions, self.defaults)
        self.bytes["meta"] = dumps(self.meta)

        self.step = "Fitting the service curves"
        self.curves = fit_all(open_history())
        self.step = "Building the planning inputs"
        self.inputs = planning_inputs()

        self.results, self.plans = {}, {}
        for code in SCENARIO_CODES:
            self.step = f"Planning {code}"
            result = run_scenario(self.inputs, self.curves, code)
            self.results[code] = result
            self.plans[code] = payloads.plan_payload(result, code, DEFAULTS["goal"], self.assumption_text)
            self.bytes[f"plan:{code}"] = dumps(self.plans[code])
            default = Settings(code)
            unchanged = {group: totals["plan"] for group, totals in self.plans[code]["totals"].items()}
            self._defaults[default.key()] = self._what_if_body(default, self.plans[code], [], unchanged, 0.0)

        self.step = "Reading the saved analysis"
        summary = read_output("analysis_summary.json")
        combined = pd.concat([result["explained"] for result in self.results.values()], ignore_index=True)
        self.bytes["compare"] = dumps(views.compare(self.plans))
        self.bytes["tradeoff"] = dumps(views.tradeoff(summary, read_output("goal_tradeoff.csv"), DEFAULTS["goal"]))
        self.bytes["playbook"] = dumps(
            views.playbook(self.results, scenario_actions(combined), on_the_day(combined), read_output("pto_what_if.csv"), read_output("capacity_gaps.csv"))
        )
        self.bytes["diagnosis"] = dumps(
            views.diagnosis(summary, read_output("diagnosis_service_bands.csv"), read_output("diagnosis_staffing_gaps.csv"), read_output("diagnosis_callout_rates.csv"))
        )
        self.bytes["methods"] = dumps(views.methods(summary, read_output("service_limits.csv"), self.assumptions))
        self.step = "Preparing the forecast"
        self.forecast = views_demand.forecast(self.inputs, self.results, summary)
        self.bytes["forecast"] = dumps(self.forecast)

    # Lookups -----------------------------------------------------------------------------------

    def health(self) -> dict:
        elapsed = None if self.started is None else time.perf_counter() - self.started
        return {
            "ready": self.status == "ready", "seconds": self.seconds, "error": self.error,
            "status": self.status, "step": self.step, "elapsed": elapsed if self.status == "preparing" else self.seconds,
        }

    def require(self, name: str) -> bytes:
        if name == "meta" and "meta" in self.bytes:
            return self.bytes["meta"]
        if self.status != "ready":
            raise NotReady(self.not_ready_message())
        return self.bytes[name]

    def not_ready_message(self) -> str:
        if self.status == "error":
            return self.error or "Startup failed."
        return f"The planner is still preparing the three scenarios ({self.step.lower()}). This takes up to 20 seconds. Try again shortly."

    def forecast_payload(self) -> dict:
        self.require("forecast")
        return self.forecast

    # What-if -----------------------------------------------------------------------------------

    def _warm_demo_what_ifs(self) -> None:
        """Run the demo script's what-if (demand +10%, callouts 150%) for each scenario once the app is ready,
        so the live demo answers from the cache. A request for the same settings meanwhile waits on the same lock."""
        try:
            for settings in DEMO_WHAT_IFS:
                try:
                    self.what_if(settings)
                except Exception:  # A failed warm-up only means the first live run computes it instead.
                    traceback.print_exc()
        finally:
            self.warmed.set()

    def what_if(self, settings: Settings) -> tuple[bytes, bool]:
        """The plan under these settings, and whether it came from the cache. Identical runs share one lock."""
        if self.status != "ready":
            raise NotReady(self.not_ready_message())
        key = settings.key()
        if key in self._defaults:
            return self._defaults[key], True
        with self._cache_lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key], True
            lock = self._run_locks.setdefault(key, threading.Lock())
        with lock:
            with self._cache_lock:
                if key in self._cache:
                    return self._cache[key], True
            body = self._compute(settings)
            with self._cache_lock:
                self._cache[key] = body
                while len(self._cache) > CACHE_SIZE:
                    self._cache.popitem(last=False)
                self._run_locks.pop(key, None)
        return body, False

    def _adjusted_inputs(self, settings: Settings) -> pd.DataFrame:
        part = self.inputs[self.inputs["scenario_code"] == settings.scenario].reset_index(drop=True)
        if settings.availability:
            regular = (part["available_regular_employees"] * (1 + settings.availability) + 0.5).astype(int).clip(lower=0)
            part = part.assign(available_regular_employees=regular)
        return part

    def _compute(self, settings: Settings) -> bytes:
        from src.app_data import adjust_inputs
        from src.data import PLAN_KEY
        from src.search import evaluate

        began = time.perf_counter()
        s = settings.as_dict()
        part = self._adjusted_inputs(settings)
        result = self._run_scenario(part, self.curves, settings.scenario, s["goal"], s["callouts"], s["demand"])
        payload = self._payloads.plan_payload(result, settings.scenario, s["goal"], self.assumption_text)
        submitted = self.plans[settings.scenario]

        # The submitted headcounts scored under the same changed conditions, for "what would happen if we didn't re-plan".
        trial = adjust_inputs(part, s["callouts"], s["demand"])
        trial = trial.merge(self.results[settings.scenario]["explained"][[*PLAN_KEY, "recommended"]], on=PLAN_KEY, validate="one_to_one")
        rescored_rows = evaluate(trial, "recommended", self.curves)
        rescored = {}
        for group in self._payloads.GROUPS:
            rows = rescored_rows if group == "all" else rescored_rows[rescored_rows["store_id"] == int(group)]
            rescored[group] = self._payloads.summary(rows, s["goal"], "recommended")
        changes = self._payloads.changes_against(payload, submitted)
        return self._what_if_body(settings, payload, changes, rescored, time.perf_counter() - began)

    def _what_if_body(self, settings: Settings, payload: dict, changes: list[dict], rescored: dict, seconds: float) -> bytes:
        submitted = self.plans[settings.scenario]
        s = settings.as_dict()
        is_default = settings.key() == Settings(settings.scenario).key()
        added = sum(row["change"] for row in changes if row["change"] > 0)
        cut = -sum(row["change"] for row in changes if row["change"] < 0)
        body = {
            **payload,
            "what_if": True,
            "is_submitted_plan": is_default and not changes,
            "label": "Submitted plan (default settings)" if is_default else "What-if: not the submitted plan",
            "settings": s,
            "defaults": self.defaults,
            "seconds": seconds,
            "changes": changes,
            "changes_summary": {"blocks": len(changes), "people_added": added, "people_cut": cut, "net": added - cut},
            "vs_submitted": self._payloads.against_submitted(payload, submitted, rescored),
        }
        return dumps(body)
