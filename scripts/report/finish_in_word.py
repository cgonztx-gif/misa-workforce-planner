"""Finish the report in Word: fill the table of contents and page numbers, save, and export the PDF.

docx-js writes the contents as a field that only Word can fill, so the builder calls this after writing the
.docx (Windows with Word only; skip with --no-word). It starts its own hidden Word, which it always quits.

    python scripts/report/finish_in_word.py
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCX = ROOT / "deliverables" / "Costco_Case_Analysis.docx"
PDF = DOCX.with_suffix(".pdf")

SCRIPT = f"""
$ErrorActionPreference = 'Stop'
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {{
    $d = $w.Documents.Open('{DOCX}', $false, $false)
    foreach ($t in $d.TablesOfContents) {{ $t.Update() }}
    $d.Repaginate()
    foreach ($t in $d.TablesOfContents) {{ $t.UpdatePageNumbers() }}
    $d.Save()
    $d.ExportAsFixedFormat('{PDF}', 17, $false, 0, 0, 0, 0, 0, $true, $true, 1)
    Write-Output ("Pages: " + $d.ComputeStatistics(2))
    $d.Close(0)
}} finally {{
    $w.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
}}
"""


def main() -> int:
    if not DOCX.exists():
        print(f"No {DOCX}", file=sys.stderr)
        return 1
    result = subprocess.run(["powershell", "-NoProfile", "-Command", SCRIPT], capture_output=True, text=True, timeout=300)
    print(result.stdout.strip())
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        return result.returncode
    print(f"Updated the contents in {DOCX.name} and exported {PDF.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
