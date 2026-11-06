"""Start the Workforce Planner: python -m server [--port 8501] [--no-browser] [--draft2 | --draft4]

--draft2 serves the frozen draft 2 front end (web/dist-draft2) instead of draft 3 (web/dist), as the fallback.
--draft4 serves draft 4, the one-page overview (web/dist-draft4, planning/DRAFT4.md).

Serves the API and the built front end on 127.0.0.1 only. The three scenarios are prepared in the
background, and the browser opens once they're ready (or once startup fails, so the error shows).
"""
from __future__ import annotations

import argparse
import socket
import sys
import threading
import time
import webbrowser

HOST = "127.0.0.1"


def port_in_use(port: int) -> bool:
    """True if something already listens on the port, or it can't be bound."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.5)
        if probe.connect_ex((HOST, port)) == 0:
            return True
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            probe.bind((HOST, port))
        except OSError:
            return True
    return False


def open_when_ready(engine, url: str, port: int) -> None:
    engine.wait()
    for _ in range(100):  # The server itself is listening within a second or two of starting.
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.settimeout(0.3)
            if probe.connect_ex((HOST, port)) == 0:
                break
        time.sleep(0.1)
    webbrowser.open(url)


def report_when_ready(engine, url: str) -> None:
    engine.wait()
    if engine.status == "ready":
        print(f"Ready in {engine.seconds:.1f} s. Open {url}", flush=True)
    else:
        print(f"Startup failed: {engine.error}", flush=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m server", description="Serve the Workforce Planner on this computer only.")
    parser.add_argument("--port", type=int, default=8501, help="Port to serve on (default 8501).")
    parser.add_argument("--no-browser", action="store_true", help="Don't open the browser once it's ready.")
    parser.add_argument("--draft2", action="store_true", help="Serve the draft 2 front end (web/dist-draft2), the fallback for draft 3.")
    parser.add_argument("--draft4", action="store_true", help="Serve draft 4, the one-page overview (web/dist-draft4).")
    args = parser.parse_args(argv)

    if port_in_use(args.port):
        print(
            f"Port {args.port} is already in use. Close whatever is using it, usually an earlier Workforce Planner window "
            f"or the Streamlit app, then try again. Or pick another port: python -m server --port {args.port + 100}",
            file=sys.stderr,
        )
        return 1

    import uvicorn

    from server.api import ROOT, create_app

    if args.draft2 and args.draft4:
        parser.error("pick one of --draft2 and --draft4")
    draft = "draft2" if args.draft2 else "draft4" if args.draft4 else None
    app = create_app(dist=ROOT / "web" / f"dist-{draft}") if draft else create_app()
    engine = app.state.engine
    url = f"http://localhost:{args.port}/"
    label = {"draft2": " (draft 2 fallback)", "draft4": " (draft 4)"}.get(draft or "", "")
    print(f"Workforce Planner{label}: preparing the three scenarios (about 15 seconds). Serving {url}  (Ctrl+C to stop)", flush=True)
    engine.start()  # Before uvicorn, so preparing overlaps with server start. The lifespan's start() is then a no-op.
    threading.Thread(target=report_when_ready, args=(engine, url), daemon=True).start()
    if not args.no_browser:
        threading.Thread(target=open_when_ready, args=(engine, url, args.port), daemon=True).start()
    uvicorn.run(app, host=HOST, port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":
    sys.exit(main())
