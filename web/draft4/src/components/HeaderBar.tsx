import { Download, FlaskConical, Info, Menu, RotateCcw } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import type { Meta, ScenarioCode } from "../lib/types";
import { Segmented } from "./Segmented";
import { SCEN, scenarioTip } from "./Sidebar";
import { Spinner, StatusPill, type Status } from "./StatusPill";

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

export function CsvPill({ onFail, whatIf = false }: { onFail: (offline: boolean) => void; whatIf?: boolean }) {
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    void downloadCsv(onFail);
  };
  return (
    <a href={CSV_URL} download onClick={onClick} className={`${pillCls} hover:bg-soft`} data-tip={whatIf ? "The submitted file, not this what-if · 567 rows · 3 scenarios" : "Submission file · 567 rows · 3 scenarios"}>
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
export interface WhatIfHeader {
  chips: { key: string; text: string }[];
  busy: boolean;
  /** The submitted plan's numbers are what the board shows until the first re-plan lands. */
  showing: boolean;
  onReset: () => void;
}

/**
 * In a what-if, the green "Submitted plan" pill gives way to a dashed What-if pill (never mistaken for the hand-in),
 * with Reset beside it; the changed settings sit next to the scenario's name, so a screenshot says what was changed.
 */
function WhatIfPills({ w }: { w: WhatIfHeader }) {
  return (
    <>
      <span
        className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-dashed border-accent/60 bg-accent/[.07] px-3 text-[13px] font-medium whitespace-nowrap text-ink"
        data-status="whatif"
        tabIndex={0}
        data-tip={`Not the submitted plan · ${w.chips.map((c) => c.text).join(" · ")}
Re-planned by the same engine under these conditions · the CSV stays the submitted file`}
        aria-live="polite"
      >
        {w.busy ? <Spinner /> : <FlaskConical size={14} strokeWidth={1.9} className="text-accent" />}
        {w.busy ? "Re-planning" : "What-if"}
      </span>
      <button type="button" onClick={w.onReset} className={`${pillCls} hover:bg-soft`} data-tip="Back to the submitted plan" data-header-reset>
        <RotateCcw size={13} strokeWidth={1.9} />
        Reset
      </button>
    </>
  );
}

export function HeaderBar({ meta, scenario, onScenario, status, note, onCsvFail, title = "Overview", whatIf, onMenu }: {
  meta?: Meta;
  scenario: ScenarioCode;
  onScenario: (s: ScenarioCode) => void;
  status: Status;
  note?: ReactNode;
  onCsvFail: (offline: boolean) => void;
  title?: string;
  whatIf?: WhatIfHeader | null;
  /** Below 80rem (no sidebar): opens the menu sheet, the way to the other pages. */
  onMenu?: () => void;
}) {
  const name = meta?.scenarios.find((s) => s.code === scenario)?.name;
  return (
    <header className="hidden flex-wrap items-center gap-x-4 gap-y-2 sm:flex min-[64rem]:h-10 min-[64rem]:flex-nowrap compact:min-[64rem]:h-9">
      <div className="flex min-w-0 basis-full items-baseline gap-3 min-[64rem]:flex-1 min-[64rem]:basis-auto">
        <h1 className="shrink-0 text-[20px] font-semibold tracking-[-.015em]">{title}</h1>
        {note ? (
          <div className="min-w-0 flex-1 self-center">{note}</div>
        ) : (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-[14px] text-muted" data-scenario-name>
              {name ?? ""}
            </span>
            {whatIf && (
              <span className="flex min-w-0 shrink items-center gap-1.5 self-center overflow-hidden" data-whatif-chips>
                {whatIf.chips.map((c) => (
                  <span key={c.key} className="inline-flex h-6 shrink-0 items-center rounded-full bg-accent/[.09] px-2.5 text-[12px] font-medium whitespace-nowrap text-ink tnum">
                    {c.text}
                  </span>
                ))}
              </span>
            )}
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
        {whatIf && status.kind === "ready" ? <WhatIfPills w={whatIf} /> : <StatusPill status={status} />}
        <SimPill meta={meta} />
        <CsvPill onFail={onCsvFail} whatIf={!!whatIf} />
        {onMenu && (
          <button type="button" onClick={onMenu} aria-haspopup="dialog" data-menu-button className={`${pillCls} hover:bg-soft min-[80rem]:hidden`} data-tip="Pages, scenario, warehouse">
            <Menu size={14} strokeWidth={1.75} />
            Menu
          </button>
        )}
      </div>
    </header>
  );
}
