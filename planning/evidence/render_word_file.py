"""Export the team's Word file to PDF through Word, then render each page as an image to look at.

This machine has Word, but no LibreOffice, Pandoc or Poppler (F-57). Windows only, and not part of the app:

    python -m pip install pypdfium2==5.14.0
    python planning/evidence/render_word_file.py <empty output folder>
"""
import subprocess
import sys
from pathlib import Path

import pypdfium2

DOCUMENT = Path(__file__).resolve().parents[2] / "deliverables" / "Costco_Case_Analysis.docx"


def main(folder: str) -> None:
    out = Path(folder).resolve()
    out.mkdir(parents=True, exist_ok=True)
    pdf = out / "analysis.pdf"
    script = (
        "$w = New-Object -ComObject Word.Application; $w.Visible = $false; "
        f"$d = $w.Documents.Open('{DOCUMENT}', $false, $true); "
        f"$d.ExportAsFixedFormat('{pdf}', 17); $d.Close(0); $w.Quit()"
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", script], check=True)
    document = pypdfium2.PdfDocument(pdf)
    for index in range(len(document)):
        document[index].render(scale=1.15).to_pil().save(out / f"page-{index + 1:02d}.png")
    print(f"{len(document)} pages in {out}")


if __name__ == "__main__":
    main(sys.argv[1])
