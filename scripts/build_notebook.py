"""Build the code appendix (T-91): notebooks/appendix.py -> deliverables/Costco_Analysis_Appendix.ipynb and .html.

Run it from anywhere with:  python scripts/build_notebook.py

1. Reads the percent-format script (cells start with `# %%`, prose cells with `# %% [markdown]`).
2. Writes a notebook with nbformat and runs it in place with nbclient (kernel python3, working
   directory = the repository root), so the saved outputs are the ones this run produced.
3. Fails if any cell errors or writes to stderr, which is where warnings land (D-28: no warnings in
   the outputs), and saves the notebook either way so a failure can be read.
4. Exports HTML with nbconvert, and removes the CDN scripts nbconvert adds (require.js, MathJax and
   the mermaid loader). The notebook uses none of them, so the page reads the same offline (F-60),
   and without MathJax a pair of dollar amounts can never turn into math.

Add --html-only to re-export the saved notebook without running it again.
"""
from __future__ import annotations

import argparse
import asyncio
import re
import sys
import time
from pathlib import Path

import nbformat
from nbclient import NotebookClient
from nbclient.exceptions import CellExecutionError
from nbconvert import HTMLExporter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "notebooks" / "appendix.py"
OUT_DIR = ROOT / "deliverables"
NOTEBOOK = OUT_DIR / "Costco_Analysis_Appendix.ipynb"
HTML = OUT_DIR / "Costco_Analysis_Appendix.html"
CELL = re.compile(r"^# %%(?P<rest>.*)$")


def read_cells(path: Path) -> list:
    """Split a percent-format script into notebook cells. Text before the first marker is skipped."""
    cells, kind, lines = [], None, []

    def flush():
        while lines and not lines[-1].strip():
            lines.pop()
        while lines and not lines[0].strip():
            lines.pop(0)
        if kind == "markdown":
            text = "\n".join(re.sub(r"^# ?", "", line) if line.startswith("#") else line for line in lines)
            cells.append(nbformat.v4.new_markdown_cell(text))
        elif kind == "code" and lines:
            cells.append(nbformat.v4.new_code_cell("\n".join(lines)))

    for line in path.read_text(encoding="utf-8").splitlines():
        match = CELL.match(line)
        if match:
            flush()
            kind, lines = ("markdown" if "[markdown]" in match["rest"] else "code"), []
        elif kind is not None:
            lines.append(line)
    flush()
    return cells


def build_notebook() -> nbformat.NotebookNode:
    nb = nbformat.v4.new_notebook()
    nb.cells = read_cells(SOURCE)
    nb.metadata["kernelspec"] = {"name": "python3", "display_name": "Python 3 (ipykernel)", "language": "python"}
    nb.metadata["language_info"] = {"name": "python"}
    return nb


def stderr_cells(nb: nbformat.NotebookNode) -> list[str]:
    """Cells whose outputs include stderr or an error, with the first line of each."""
    found = []
    for index, cell in enumerate(nb.cells):
        for output in cell.get("outputs", []):
            if output.get("output_type") == "error" or (output.get("output_type") == "stream" and output.get("name") == "stderr"):
                text = output.get("text") or output.get("evalue", "")
                found.append(f"cell {index}: {str(text).strip().splitlines()[0] if str(text).strip() else '(empty)'}")
    return found


def export_html(nb: nbformat.NotebookNode) -> str:
    exporter = HTMLExporter(template_name="lab")
    body, _ = exporter.from_notebook_node(nb, resources={"metadata": {"name": "Costco Analysis Appendix"}})
    # nbconvert's only remote references: require.js and MathJax (F-60). Remove both.
    body = re.sub(r'<script[^>]*src="https?://[^"]*require[^"]*"[^>]*>\s*</script>\s*', "", body)
    body = re.sub(r"<!-- Load mathjax -->.*?<!-- End of mathjax configuration -->\s*", "", body, flags=re.S)
    body = re.sub(r'<script[^>]*src="https?://[^"]*mathjax[^"]*"[^>]*>\s*</script>\s*', "", body, flags=re.I)
    # The lab template's mermaid loader only fetches from a CDN when a diagram exists; there are none, so drop it.
    body = re.sub(r'<script type="module">(?:(?!</script>).)*?cdnjs\.cloudflare\.com/ajax/libs/mermaid.*?</script>\s*'
                  r"(?:<!-- End of mermaid configuration -->)?", "", body, flags=re.S)
    # Long code lines wrap instead of hiding past the right edge on a laptop screen.
    wrap = ("<style>.jp-InputArea-editor .highlight pre{white-space:pre-wrap;overflow-wrap:anywhere}"
            ".jp-OutputArea-output pre{white-space:pre-wrap}</style>\n")
    body = body.replace("</head>", wrap + "</head>", 1)
    remote = sorted(set(re.findall(r'(?:src|href)="(https?://[^"]+)"', body)))
    if remote:
        print("Remote references left in the HTML (links only, nothing loads):", *remote, sep="\n  ")
    return body


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--timeout", type=int, default=1800, help="seconds allowed per cell")
    parser.add_argument("--html-only", action="store_true", help="re-export the saved notebook's HTML without running it")
    args = parser.parse_args()
    if args.html_only:
        nb = nbformat.read(NOTEBOOK, as_version=4)
        HTML.write_text(export_html(nb), encoding="utf-8")
        print(f"Wrote {HTML.relative_to(ROOT)} from the saved notebook ({HTML.stat().st_size / 1e6:.1f} MB)")
        return 1 if stderr_cells(nb) else 0
    if sys.platform == "win32":
        # pyzmq warns that the Proactor loop lacks add_reader; the selector loop avoids it (F-60).
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    OUT_DIR.mkdir(exist_ok=True)
    nb = build_notebook()
    print(f"Read {len(nb.cells)} cells from {SOURCE.relative_to(ROOT)}")
    client = NotebookClient(nb, timeout=args.timeout, kernel_name="python3", resources={"metadata": {"path": str(ROOT)}})
    start = time.time()
    failed = False
    try:
        client.execute()
    except CellExecutionError as error:
        failed = True
        print("A cell failed:\n", str(error)[:3000])
    elapsed = time.time() - start
    nbformat.write(nb, NOTEBOOK)
    print(f"Ran in {elapsed:.0f} s and wrote {NOTEBOOK.relative_to(ROOT)}")

    problems = stderr_cells(nb)
    if problems:
        print("Cells with stderr or errors:", *problems, sep="\n  ")
    HTML.write_text(export_html(nb), encoding="utf-8")
    print(f"Wrote {HTML.relative_to(ROOT)} ({HTML.stat().st_size / 1e6:.1f} MB)")
    return 1 if failed or problems else 0


if __name__ == "__main__":
    sys.exit(main())
