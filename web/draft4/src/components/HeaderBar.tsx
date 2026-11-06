import { Download, Info } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import type { Meta, ScenarioCode } from "../lib/types";
import { Segmented } from "./Segmented";
import { SCEN, scenarioTip } from "./Sidebar";
import { StatusPill, type Status } from "./StatusPill";

export const pillCls =
  "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-line bg-card px-3 text-[13px] text-ink-2 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent";

export function SimPill({ meta }: { meta?: Meta }) {
  return (
    <span className={pillCls} data-tip={meta?.notice ?? "All data is simulated. It is not Costco data."} tabIndex={0}>
      <Info size={13} strokeWidth={1.75} className="text-muted" />
      Simulated data
    </span>
  );
}

const CSV_URL = "/api/submission.csv";

/**
 * The hand-in file. A plain link would fail silently when the server has stopped (Chrome just cancels the
 * download), so the click fetches it first and saves the blob; a failure reaches the page's one note instead.
 */
export async function downloadCsv(onFail: (offline: boolean) => void) {
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) return onFail(false);
    const blob = await res.blob();
    const name = /filename="?([^";]+)"?/i.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "TEAM_SUBMISSION_TEMPLATE_filled.csv";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    onFail(true);
  }
}

export function CsvPill({ onFail }: { onFail: (offline: boolean) => void }) {
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    void downloadCsv(onFail);
  };
  return (
    <a href={CSV_URL} download onClick={onClick} className={`${pillCls} hover:bg-soft`} data-tip="Submission file · 567 rows · 3 scenarios">
      <Download size={14} strokeWidth={1.75} />
      CSV
    </a>
  );
}

/**
 * The header row (layout.md): title and the scenario's full name left; one pill group right. Hidden on phones.
 * Below 64rem the pill group folds onto its own row, so the scenario's name is never cut. A failed fetch puts its
 * slim note in place of the name, so it never pushes the board down.
 */
export function HeaderBar({ meta, scenario, onScenario, status, note, onCsvFail }: {
  meta?: Meta;
  scenario: ScenarioCode;
  onScenario: (s: ScenarioCode) => void;
  status: Status;
  note?: ReactNode;
  onCsvFail: (offline: boolean) => void;
}) {
  const name = meta?.scenarios.find((s) => s.code === scenario)?.name;
  return (
    <header className="hidden flex-wrap items-center gap-x-4 gap-y-2 sm:flex min-[64rem]:h-10 min-[64rem]:flex-nowrap compact:min-[64rem]:h-9">
      <div className="flex min-w-0 basis-full items-baseline gap-3 min-[64rem]:flex-1 min-[64rem]:basis-auto">
        <h1 className="shrink-0 text-[20px] font-semibold tracking-[-.015em]">Overview</h1>
        {note ? (
          <div className="min-w-0 flex-1 self-center">{note}</div>
        ) : (
          <span className="truncate text-[14px] text-muted" data-scenario-name>
            {name ?? ""}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="min-[80rem]:hidden">
          <Segmented
            label="Scenario"
            value={scenario}
            onChange={onScenario}
            items={SCEN.map((s) => ({ value: s.code, label: s.label, title: s.label, tip: scenarioTip(s.code, meta) }))}
          />
        </div>
        <StatusPill status={status} />
        <SimPill meta={meta} />
        <CsvPill onFail={onCsvFail} />
      </div>
    </header>
  );
}
