"""Render every slide of the deck to PNG and export the PDF, through PowerPoint COM (T-93).

LibreOffice and Poppler aren't on this machine (F-60), so PowerPoint does the rendering, which also
shows the real Segoe UI text widths.

    python planning/evidence/render_deck.py            # deck -> planning/evidence/deck_render/*.png + deliverables/*.pdf
    python planning/evidence/render_deck.py --no-pdf   # images only
    python planning/evidence/render_deck.py deck.pptx out_dir [width]

PowerPoint is left as it was found: if it was already running it stays open (only the deck is closed),
and if it wasn't, it is quit afterwards. The deck opens read-only and without a window.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DECK = ROOT / "deliverables" / "Costco_Workforce_Presentation.pptx"
OUT = ROOT / "planning" / "evidence" / "deck_render"


def ps_quote(p: Path) -> str:
    return "'" + str(p).replace("'", "''") + "'"


def render(deck: Path, out: Path, width: int = 1920, pdf: bool = True) -> list[Path]:
    deck, out = deck.resolve(), out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob(f"{deck.stem}-*.png"):
        old.unlink()
    height = round(width * 7.5 / 13.333)
    pdf_path = deck.with_suffix(".pdf")
    pdf_line = f"$p.SaveAs({ps_quote(pdf_path)}, 32)" if pdf else ""
    script = f"""
$ErrorActionPreference = 'Stop'
$was = [bool](Get-Process POWERPNT -ErrorAction SilentlyContinue)
$app = New-Object -ComObject PowerPoint.Application
try {{
  $p = $app.Presentations.Open({ps_quote(deck)}, -1, 0, 0)
  try {{
    $i = 1
    foreach ($s in $p.Slides) {{ $s.Export({ps_quote(out)} + '\\{deck.stem}-' + $i.ToString('00') + '.png', 'PNG', {width}, {height}); $i++ }}
    {pdf_line}
  }} finally {{ $p.Close() }}
}} finally {{
  if (-not $was -and $app.Presentations.Count -eq 0) {{ $app.Quit() }}
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($app)
}}
"""
    subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", script], check=True)
    files = sorted(out.glob(f"{deck.stem}-*.png"))
    for f in files:
        print(f)
    if pdf:
        print(pdf_path)
    return files


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    deck = Path(args[0]) if args else DECK
    out = Path(args[1]) if len(args) > 1 else OUT
    width = int(args[2]) if len(args) > 2 else 1920
    render(deck, out, width, pdf="--no-pdf" not in sys.argv)
