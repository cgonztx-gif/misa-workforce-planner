"""FastAPI routes (section 7.3 of planning/DELIVERABLES_PLAN.md). server/API.md documents each one."""
from __future__ import annotations

import io
import math
import mimetypes
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, HTMLResponse, Response
from starlette.middleware.gzip import GZipMiddleware

from server import content
from server.engine import SCENARIO_CODES, SUBMISSION, Engine, NotReady, Settings
from server.serialize import StrictJSONResponse, clean, dumps
from src.data import ROOT

DIST = ROOT / "web" / "dist"
# Windows can map .js to text/plain from the registry, and browsers refuse module scripts served that way.
for _type, _ext in [("text/javascript", ".js"), ("text/javascript", ".mjs"), ("text/css", ".css"), ("image/svg+xml", ".svg"),
                    ("application/json", ".json"), ("font/woff2", ".woff2"), ("font/woff", ".woff"), ("application/json", ".map"),
                    ("image/png", ".png"), ("image/x-icon", ".ico"), ("text/html", ".html")]:
    mimetypes.add_type(_type, _ext)

NOT_BUILT = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Workforce Planner</title><style>
:root{color-scheme:light dark;--bg:#f6f7f9;--card:#fff;--ink:#1f2933;--muted:#52606d;--line:#e4e8ec}
@media (prefers-color-scheme:dark){:root{--bg:#14181d;--card:#1c2229;--ink:#e6e9ec;--muted:#a3adb8;--line:#2c343d}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 "Segoe UI",system-ui,sans-serif}
main{max-width:640px;margin:12vh auto;padding:28px 32px;background:var(--card);border:1px solid var(--line);border-radius:12px}
h1{font-size:22px;margin:0 0 8px}p{color:var(--muted);margin:8px 0}code{display:block;margin:12px 0;padding:10px 12px;border-radius:8px;
background:var(--bg);border:1px solid var(--line);color:var(--ink);font:14px Consolas,monospace}a{color:inherit}</style></head><body><main>
<h1>Workforce Planner</h1><p>The API is running, but the front end hasn't been built yet. From the project folder, run:</p>
<code>cd web &amp;&amp; npm install &amp;&amp; npm run build</code><p>Then reload this page. The API's status is at <a href="/api/health">/api/health</a>.</p>
<p>The Streamlit fallback still works: <code>python -m streamlit run app.py --server.port 8502</code></p>
<p><small>__NOTICE__</small></p></main></body></html>""".replace("__NOTICE__", content.NOTICE)


def _bytes(body: bytes, **headers) -> Response:
    return Response(content=body, media_type="application/json", headers=headers or None)


def _invalid(name: str, message: str) -> StrictJSONResponse:
    detail = [{"loc": ["query", name], "msg": message, "type": "value_error"}]
    return StrictJSONResponse({"error": f"{name}: {message}", "detail": detail}, status_code=422)


class Invalid(Exception):
    def __init__(self, name: str, message: str):
        super().__init__(message)
        self.name, self.message = name, message


def _scenario(value: str) -> str:
    code = (value or "").strip().upper()
    if code not in SCENARIO_CODES:
        raise Invalid("scenario", f"must be one of {', '.join(SCENARIO_CODES)}")
    return code


def _number(name: str, value: float, low: float, high: float) -> float:
    if not math.isfinite(value) or value < low - 1e-9 or value > high + 1e-9:
        raise Invalid(name, f"must be between {low:g} and {high:g}")
    return float(value)


def _goal(value: float) -> float:
    for allowed in content.GOALS:
        if math.isfinite(value) and abs(value - allowed) < 1e-6:
            return allowed
    raise Invalid("goal", f"must be one of {', '.join(f'{goal:g}' for goal in content.GOALS)}")


def _store(value: str | None) -> int | str | None:
    if value is None or value == "":
        return None
    if value.strip().lower() == "all":
        return "all"
    if value.strip() not in {str(store) for store in content.WAREHOUSES}:
        raise Invalid("store", "must be 1, 2, 4 or all")
    return int(value)


def _dept(value: str | None) -> int | None:
    if value is None or value == "":
        return None
    if value.strip() not in {str(dept) for dept in content.DEPARTMENTS}:
        raise Invalid("dept", "must be 38 (Front End), 92 (Merchandising) or 95 (Pharmacy)")
    return int(value)


def create_app(engine: Engine | None = None, dist: Path | None = None, autostart: bool = True) -> FastAPI:
    engine = engine or Engine()
    dist = dist or DIST

    @asynccontextmanager
    async def lifespan(_app):
        if autostart:
            engine.start()
        yield

    app = FastAPI(title="Workforce Planner API", lifespan=lifespan, default_response_class=StrictJSONResponse, docs_url=None, redoc_url=None, openapi_url="/api/openapi.json")  # No Swagger page: it loads from a CDN, and the app must work offline.
    app.state.engine = engine
    app.add_middleware(GZipMiddleware, minimum_size=4096)

    @app.exception_handler(NotReady)
    async def not_ready(_request: Request, error: NotReady):
        health = engine.health()
        return StrictJSONResponse({**health, "error": str(error), "detail": str(error)}, status_code=503, headers={"Retry-After": "2"})

    @app.exception_handler(Invalid)
    async def invalid(_request: Request, error: Invalid):
        return _invalid(error.name, error.message)

    @app.exception_handler(RequestValidationError)
    async def bad_request(_request: Request, error: RequestValidationError):
        detail = clean(error.errors())
        names = ", ".join(str(item.get("loc", ["", "?"])[-1]) for item in detail)
        return StrictJSONResponse({"error": f"Invalid value for {names}", "detail": detail}, status_code=422)

    @app.get("/api/health")
    def health():
        return StrictJSONResponse(engine.health(), headers={"Cache-Control": "no-store"})

    @app.get("/api/meta")
    def meta():
        return _bytes(engine.require("meta"))

    @app.get("/api/plan")
    def plan(scenario: str = "BASE"):
        return _bytes(engine.require(f"plan:{_scenario(scenario)}"))

    @app.get("/api/plan.csv")
    def plan_csv(scenario: str = "BASE", store: str | None = None):
        code, wanted = _scenario(scenario), _store(store)
        engine.require(f"plan:{code}")
        rows = [b for b in engine.plans[code]["blocks"] if b["is_open"] and (wanted in (None, "all") or b["store_id"] == wanted)]
        import pandas as pd

        frame = pd.DataFrame(
            {
                "Scenario": code, "Warehouse": [b["warehouse"] for b in rows], "Date": [b["date"] for b in rows], "Day": [b["day"] for b in rows],
                "Department": [b["department"] for b in rows], "Shift": [b["shift"] for b in rows], "Draft": [b["draft"] for b in rows],
                "Plan": [b["plan"] for b in rows], "Change": [b["change"] for b in rows], "Regular": [b["sources"]["regular"] for b in rows],
                "Cross-trained": [b["sources"]["flex"] for b in rows], "Overtime": [b["sources"]["overtime"] for b in rows],
                "Chance of meeting target": [round(b["chance"], 4) for b in rows], "Below the goal": [b["below_goal"] for b in rows],
                "Cost": [round(b["cost"], 2) for b in rows],
            }
        )
        name = f"plan_{code}_{'all' if wanted in (None, 'all') else f'warehouse_{wanted}'}.csv"
        return Response(frame.to_csv(index=False), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{name}"'})

    @app.get("/api/compare")
    def compare():
        return _bytes(engine.require("compare"))

    @app.get("/api/forecast")
    def forecast(store: str | None = None, dept: str | None = None):
        wanted_store, wanted_dept = _store(store), _dept(dept)
        if wanted_store is None and wanted_dept is None:
            return _bytes(engine.require("forecast"))
        from server.views_demand import filter_forecast

        return _bytes(dumps(filter_forecast(engine.forecast_payload(), wanted_store, wanted_dept)))

    @app.get("/api/tradeoff")
    def tradeoff():
        return _bytes(engine.require("tradeoff"))

    @app.get("/api/playbook")
    def playbook():
        return _bytes(engine.require("playbook"))

    @app.get("/api/diagnosis")
    def diagnosis():
        return _bytes(engine.require("diagnosis"))

    @app.get("/api/methods")
    def methods():
        return _bytes(engine.require("methods"))

    @app.get("/api/what-if")
    def what_if(
        scenario: str = "BASE",
        goal: float = Query(0.95),
        callouts: float = Query(1.0),
        demand: float = Query(0.0),
        availability: float = Query(0.0),
    ):
        lim = content.LIMITS
        settings = Settings(
            scenario=_scenario(scenario),
            goal=_goal(goal),
            callouts=_number("callouts", callouts, lim["callouts"]["min"], lim["callouts"]["max"]),
            demand=_number("demand", demand, lim["demand"]["min"], lim["demand"]["max"]),
            availability=_number("availability", availability, lim["availability"]["min"], lim["availability"]["max"]),
        )
        began = time.perf_counter()
        body, cached = engine.what_if(settings)
        return _bytes(body, **{"X-Cache": "hit" if cached else "miss", "X-Seconds": f"{time.perf_counter() - began:.3f}"})

    @app.get("/api/submission.csv")
    def submission():
        if SUBMISSION.exists():
            for attempt in range(6):
                try:
                    body = SUBMISSION.read_bytes()
                    if body:
                        break
                except OSError:
                    pass
                time.sleep(0.4)
            else:
                raise NotReady("Couldn't read outputs/TEAM_SUBMISSION_TEMPLATE_filled.csv. Try again in a moment.")
        else:
            body = _fresh_submission(engine)
        return Response(body, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{SUBMISSION.name}"'})

    @app.get("/api/{rest:path}")
    def unknown(rest: str):
        message = f"No such endpoint: /api/{rest}. See server/API.md."
        return StrictJSONResponse({"error": message, "detail": message}, status_code=404)

    @app.get("/{path:path}", include_in_schema=False)
    def static(path: str):
        """The built front end from web/dist, or a page saying how to build it. Checked per request, so a build shows up without a restart."""
        index = dist / "index.html"
        if not index.exists():
            return HTMLResponse(NOT_BUILT)
        root = dist.resolve()
        target = (root / path).resolve() if path else index.resolve()
        if path and (root not in target.parents or not target.is_file()):
            if "." in Path(path).name:
                return Response("Not found", status_code=404, media_type="text/plain")
            target = index.resolve()  # The app uses a hash router, but plain paths still land on it.
        cache = "no-cache" if target.name == "index.html" else "public, max-age=31536000, immutable" if "assets" in target.parts else "no-cache"
        return FileResponse(target, headers={"Cache-Control": cache})

    return app


def _fresh_submission(engine: Engine) -> bytes:
    """Only when outputs/ has no filled template: build it from the engine's plan, joined on keys."""
    import pandas as pd

    from src.submission import fill_template

    engine.require("plan:BASE")
    plan = pd.concat([result["explained"] for result in engine.results.values()], ignore_index=True)
    filled = fill_template(plan)
    buffer = io.StringIO()
    frame = filled.copy()
    frame["submitted_employees"] = frame["submitted_employees"].astype("Int64")
    frame.to_csv(buffer, index=False, date_format="%Y-%m-%d")  # The same format as write_submission(), without touching outputs/.
    return buffer.getvalue().encode("utf-8")


app = create_app()
