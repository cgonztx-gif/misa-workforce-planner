import { useBase } from "../lib/base";
import { int, signed, signedUsd, signedUsdCompact, usd, usdCompact } from "../lib/format";
import type { GroupTotals } from "../lib/types";
import { CardHead, Key } from "./StatTile";

/**
 * Where the cost goes (the user, 2026-11-05): the Overview's labor cost taken apart, by department and by where the
 * hours come from, against the baseline in view (the draft, or the submitted plan in a what-if), so an adjustment
 * shows how it moves the money, not only how much. The Labor cost tile carries the judgement (its red rise); here
 * the changes are grey magnitudes, so the breakdown explains rather than shouts (say it once).
 */
export function CostBreakdown({ T }: { T: GroupTotals }) {
  const B = useBase();
  const total = T.plan.cost || 1;
  const dCost = (T.change.cost ?? T.plan.cost - T.draft.cost) || 0;
  const sources = [
    { key: "regular", label: "Regular", cls: "bg-ink/80", plan: T.plan.regular_hours, base: T.draft.regular_hours, tip: "Regular staff, at the regular rate · used first" },
    { key: "flex", label: "Cross-trained", cls: "bg-ink/55", plan: T.plan.flex_hours, base: T.draft.flex_hours, tip: "Cross-trained staff the partner department can spare, at the regular rate · used second" },
    { key: "overtime", label: "Overtime", cls: "bg-ink/30", plan: T.plan.overtime_hours, base: T.draft.overtime_hours, tip: "Overtime, about 32% more per hour · used last" },
  ];
  const maxH = Math.max(T.plan.hours, T.draft.hours) || 1;
  const stack = (which: "plan" | "base") => (
    <div className="flex h-3 gap-[2px]" style={{ width: `${(100 * (which === "plan" ? T.plan.hours : T.draft.hours)) / maxH}%` }}>
      {sources.map((s) =>
        s[which] > 0 ? <span key={s.key} className={`h-full min-w-[3px] rounded-full ${which === "plan" ? s.cls : "bg-series-grey/70"}`} style={{ flex: s[which] }} data-tip={`${which === "plan" ? B.Plan : B.Word} · ${s.label} ${int(s[which])} h`} /> : null,
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col" data-card-body="costbreakdown">
      <CardHead
        title="Where the cost goes"
        sub={`${B.Plan} vs ${B.word}`}
        right={
          <span className="text-right leading-tight" data-tip={`${B.Word} ${usd(T.draft.cost)} · ${signedUsd(dCost)}`}>
            <span className="block text-[15px] font-semibold text-ink tnum">{usdCompact(T.plan.cost)}</span>
            <span className="block text-[12px] text-muted tnum">{signedUsdCompact(dCost)}</span>
          </span>
        }
      />

      {/* By department */}
      <div className="mt-4 flex px-1 text-[12px] text-muted">
        <span className="flex-1 font-medium text-ink-2">Departments</span>
        <span className="w-[4.5rem] text-right">Cost</span>
        <span className="w-[4.5rem] text-right" data-tip={`Against the ${B.word}`}>Change</span>
      </div>
      <div className="mt-1 flex flex-col" data-list="cost-departments">
        {T.by_department.map((d) => {
          const ch = d.plan.cost - d.draft.cost;
          return (
            <div
              key={d.dept_id}
              data-dept={d.dept_id}
              data-cost={Math.round(d.plan.cost)}
              data-change={Math.round(ch)}
              className="relative flex h-11 items-center px-1 pb-1.5 text-[13.5px]"
              data-tip-title={d.department}
              data-tip={`${B.Word} ${usd(d.draft.cost)} → ${B.Plan.toLowerCase()} ${usd(d.plan.cost)} · ${signedUsd(ch)}\n${int(d.draft.hours)} → ${int(d.plan.hours)} h · overtime ${int(d.draft.overtime_hours)} → ${int(d.plan.overtime_hours)} h\n${((100 * d.plan.cost) / total).toFixed(0)}% of the cost`}
            >
              <span aria-hidden className="absolute inset-x-1 bottom-[5px] h-[3px] overflow-hidden rounded-full bg-line/70">
                <span className="absolute inset-y-0 left-0 rounded-full bg-ink/45" style={{ width: `${(100 * d.plan.cost) / total}%` }} />
              </span>
              <span className="relative min-w-0 flex-1 truncate text-ink-2">{d.department}</span>
              <span className="relative w-[4.5rem] text-right font-semibold tnum">{usdCompact(d.plan.cost)}</span>
              <span className="relative w-[4.5rem] text-right text-[12.5px] text-ink-2 tnum">{signedUsdCompact(ch)}</span>
            </div>
          );
        })}
      </div>

      {/* By source of hours */}
      <div className="mt-auto pt-5" data-list="cost-sources">
        <div className="mb-2 flex items-center justify-between text-[12px] text-muted">
          <span className="font-medium text-ink-2">Hours by source</span>
          <span className="tnum" data-tip={`${B.Word} ${int(T.draft.hours)} h · ${B.Plan.toLowerCase()} ${int(T.plan.hours)} h`}>
            {int(T.draft.hours)} → <span className="font-semibold text-ink">{int(T.plan.hours)} h</span>
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11.5px] text-muted">{B.Plan}</span>
            <div className="min-w-0 flex-1">{stack("plan")}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11.5px] text-muted">{B.Word}</span>
            <div className="min-w-0 flex-1">{stack("base")}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-col">
          {sources.map((s) => (
            <div key={s.key} data-source={s.key} data-hours={s.plan} className="flex h-8 items-center gap-2 border-b border-line text-[13px] last:border-b-0" data-tip={s.tip}>
              <Key swatch={`h-2.5 w-3 rounded-full ${s.cls}`} label={<span className="text-ink-2">{s.label}</span>} />
              <span className="flex-1" />
              <span className="w-16 text-right font-semibold tnum">{int(s.plan)} h</span>
              <span className="w-[4.5rem] text-right text-[12.5px] text-ink-2 tnum">{signed(s.plan - s.base)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
