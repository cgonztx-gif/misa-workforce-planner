import { Card, deptColor, SwatchLabel, Tooltip } from "../../components";
import { fmtInt, fmtMoney, fmtPct } from "../../lib/format";
import { tokens } from "../../styles/tokens";
import type { DiagnosisResponse } from "./types";

const OVER = tokens.scale.change.stops[5];
const SHORT = tokens.scale.change.stops[1];

/** History (Jan 1 to Feb 11): too much labor costs money, too little hurts service (F-39). A diverging bar per department. */
export function HistoryCard({ diagnosis }: { diagnosis: DiagnosisResponse }) {
  const rows = diagnosis.gap_value;
  const k = diagnosis.kpi;
  const max = Math.max(...rows.flatMap((r) => [r.over_hours, r.short_hours]));
  const pct = (v: number) => `${(v / max) * 64}%`;

  return (
    <Card
      title="Why the draft needs changing: history"
      description="Six weeks of past schedules, against the hours an 85% utilization ceiling needs."
      footer={`All departments: ${fmtInt(k.over_hours)} hours above need, worth ${fmtMoney(k.over_value)}, while ${fmtInt(k.short_hours)} hours were missing elsewhere. Blocks met target ${fmtPct(k.pct_met_all)} of the time.`}
    >
      <p className="font-display text-title font-semibold leading-snug text-ink">Hours were about right in total, but in the wrong places.</p>
      <div className="mt-4 flex items-center justify-between text-sm text-ink-subtle">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-[3px]" style={{ background: SHORT }} />
          Hours short of need
        </span>
        <span className="inline-flex items-center gap-2">
          Hours above need
          <span aria-hidden className="size-3 rounded-[3px]" style={{ background: OVER }} />
        </span>
      </div>
      <div className="mt-2 space-y-3" role="table" aria-label="Hours short of and above need, by department">
        {rows.map((r) => (
          <div key={r.dept_id} role="row" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-0">
            <div role="rowheader" className="col-span-2 mb-1 flex items-center justify-between">
              <SwatchLabel color={deptColor(r.dept_id)} className="font-medium text-ink">
                {r.department}
              </SwatchLabel>
              <span className="text-sm text-ink-subtle">{fmtInt(r.missed_blocks)} blocks missed target</span>
            </div>
            <div role="cell" className="flex items-center justify-end gap-2 border-r border-border-strong pr-[2px]">
              <span className="tnum text-sm whitespace-nowrap text-ink-muted">{fmtInt(r.short_hours)} h</span>
              <Tooltip content={`${r.department}: ${fmtInt(r.short_hours)} hours short of need over six weeks, across ${fmtInt(r.blocks)} blocks.`}>
                <div tabIndex={0} className="h-5 rounded-l-[4px] outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ width: pct(r.short_hours), background: SHORT }} />
              </Tooltip>
            </div>
            <div role="cell" className="flex items-center gap-2 pl-[2px]">
              <Tooltip content={`${r.department}: ${fmtInt(r.over_hours)} hours above need, worth ${fmtMoney(r.over_value)} at loaded regular rates.`}>
                <div tabIndex={0} className="h-5 rounded-r-[4px] outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ width: pct(r.over_hours), background: OVER }} />
              </Tooltip>
              <span className="tnum text-sm whitespace-nowrap text-ink-muted">{fmtInt(r.over_hours)} h</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
