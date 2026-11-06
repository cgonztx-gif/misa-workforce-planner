import { ArrowBigUp, ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import type { ReactNode } from "react";
import { causeChip, shortOf } from "../lib/board";
import { chanceText, int, signed, signedUsd, usd } from "../lib/format";
import type { Block } from "../lib/types";
import { Bullet } from "./Bullet";
import { StaffBar } from "./StaffBar";

export const chip = "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] whitespace-nowrap";
export const iconBtn = "grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";
export const kbd = "rounded border border-line px-1.5 text-[11px] leading-[16px] text-muted";

export function TopRow({ back, onBack, onClose, info }: { back: string; onBack: () => void; onClose: () => void; info?: string }) {
  return (
    <div className="flex h-8 items-center gap-1">
      <button type="button" data-back onClick={onBack} className="-ml-1.5 inline-flex h-8 items-center gap-0.5 rounded-full pr-2.5 pl-1 text-[13px] text-muted hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
        <ChevronLeft size={16} strokeWidth={1.75} />
        {back}
      </button>
      <span className="flex-1" />
      {info && (
        <button type="button" aria-label="Why" data-tip={info} className={iconBtn}>
          <Info size={16} strokeWidth={1.75} />
        </button>
      )}
      <button type="button" aria-label="Close" data-tip="Close · Esc" onClick={onClose} className={iconBtn}>
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function Stat({ label, value, sub, below, tip, cls = "" }: { label: string; value: string; sub?: string; below?: string; tip?: string | null; cls?: string }) {
  return (
    <div className="min-w-0" data-tip={tip ?? undefined}>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 whitespace-nowrap">
        <span className={`text-[15px] font-semibold tnum ${cls}`}>{value}</span>
        {sub && <span className="text-[12px] text-muted tnum">{sub}</span>}
      </div>
      {/* A second figure gets its own muted line, so a number is never cut off. */}
      {below && <div className="text-[12px] leading-4 whitespace-nowrap text-muted tnum">{below}</div>}
    </div>
  );
}

export function StepActions({ onPrev, onNext, canPrev, canNext }: { onPrev: () => void; onNext: () => void; canPrev: boolean; canNext: boolean }) {
  return (
    <div className="mt-auto flex shrink-0 items-center justify-between gap-2 pt-4">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        data-tip="Previous · Shift+N"
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-card pr-2 pl-2.5 text-[13px] text-ink-2 hover:bg-soft disabled:opacity-40 disabled:hover:bg-card focus-visible:outline-2 focus-visible:outline-accent"
      >
        <ChevronLeft size={15} strokeWidth={1.75} />
        Previous
        <span className={`${kbd} inline-flex items-center gap-px pointer-coarse:hidden`} aria-hidden>
          <ArrowBigUp size={11} strokeWidth={1.75} />N
        </span>
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        data-tip="Next · N"
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent pr-2.5 pl-4 text-[13px] font-medium text-on-accent hover:brightness-105 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Next
        <span className="rounded border border-on-accent/30 px-1.5 text-[11px] leading-[16px] text-on-accent/80 pointer-coarse:hidden">N</span>
        <ChevronRight size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** The block detail in the slot (range-calendar "‹ Ranges" swap). Every reason lives in a tooltip. */
export function BlockDetail({ b, goal, compare, back, ptoHeadline, strip, onBack, onClose, onPrev, onNext, canPrev, canNext }: {
  b: Block;
  goal: number;
  compare: boolean;
  back: string;
  ptoHeadline?: string;
  strip?: ReactNode;
  onBack: () => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const e = b.explanation;
  const info = [e.why, e.demand_driver, e.cushion].filter(Boolean).join("\n");
  const cause = causeChip(b.availability.note);
  const causeTip = [b.availability.note, cause === "Holiday PTO" ? ptoHeadline : null].filter(Boolean).join("\n");
  const short = shortOf(b);
  const ch = b.change;
  const open = b.is_open;
  const unfilled = open ? b.draft_sources.unfilled : 0;
  // A P3 block: the draft lists people it can't field, so "−6" is not a cut; the chip's tooltip says what happened.
  const changeTip = unfilled > 0 ? `The draft lists ${int(b.draft)}, but only ${int(b.draft - unfilled)} can be fielded · the plan schedules ${int(b.plan)}` : e.headline;

  return (
    <div className="flex h-full min-h-0 flex-col fade-in" data-detail="block" data-key={b.key}>
      <TopRow back={back} onBack={onBack} onClose={onClose} info={open ? info : undefined} />
      <h3 className="mt-2 text-[15.5px] font-semibold tracking-[-.01em]">
        {b.day_short} · {b.department} · {b.shift}
      </h3>
      <div className="mt-0.5 text-[12.5px] text-muted tnum">{open ? `${b.warehouse} · ${b.start}–${b.end} · ${b.paid_hours} h` : b.warehouse}</div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {!open ? (
          <span className={`${chip} bg-ink/[.05] text-ink-2`} data-tip={b.availability.note ?? "Department closed this block"}>
            Closed
          </span>
        ) : b.below_goal ? (
          <span className={`${chip} bg-bad/12 text-ink`} data-tip={`Under a ${Math.round(goal * 100)}% chance of meeting the wait target`}>
            Below goal
          </span>
        ) : (
          <span className={`${chip} bg-good/10 text-ink`} data-tip={`At or over a ${Math.round(goal * 100)}% chance`}>
            Meets goal
          </span>
        )}
        {open && b.at_capacity && (
          <span className={`${chip} bg-ink/[.05] text-ink-2`} data-tip={`Every regular, cross-trained and overtime person available is scheduled · ${int(b.availability.capacity)}`}>
            At capacity
          </span>
        )}
        {open && cause && (
          <span className={`${chip} bg-ink/[.05] text-ink-2`} data-tip={causeTip}>
            {cause}
          </span>
        )}
      </div>

      {/* Draft → Plan */}
      <div className="mt-5 flex items-end gap-3 compact:mt-3">
        <div>
          <div className="text-[12px] text-muted">Draft</div>
          <div className={`text-[26px] leading-[1.1] font-semibold tracking-[-.02em] tnum ${open ? "text-ink-2" : "text-muted"}`}>{open ? int(b.draft) : "—"}</div>
        </div>
        <div className="pb-1 text-[18px] text-muted">→</div>
        <div>
          <div className="text-[12px] text-muted">Plan</div>
          <div className={`text-[32px] leading-[1.1] font-semibold tracking-[-.03em] tnum ${open ? "text-ink" : "text-muted"}`}>{open ? int(b.plan) : "—"}</div>
        </div>
        {open && (
          <span
            aria-label={unfilled > 0 ? changeTip : b.action}
            data-tip={changeTip}
            className={`${chip} mb-1.5 ml-1 font-medium tnum ${ch > 0 ? "bg-ink/[.07] text-ink" : ch < 0 ? "bg-soft text-ink-2" : "bg-soft text-muted"}`}
          >
            {ch === 0 ? "Same" : signed(ch)}
          </span>
        )}
        {unfilled > 0 && (
          <span className={`${chip} mb-1.5 bg-bad/12 font-medium text-ink tnum`} data-tip={`The draft schedules ${int(unfilled)} more than this block can field`}>
            Unfilled {int(unfilled)}
          </span>
        )}
      </div>

      {/* Chance */}
      <div className="mt-5 compact:mt-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[12px] font-medium text-ink-2">Chance</span>
          {open && b.below_goal && (
            <span className={`${chip} h-5 bg-bad/12 px-2 text-[11.5px] font-medium text-ink tnum`} data-tip={`Need ${int(b.need ?? 0)} · can field ${int(b.availability.capacity)}`}>
              Short {int(short)}
            </span>
          )}
          <span className="flex-1" />
          {compare && open && <span className="text-[12px] text-muted tnum">draft {chanceText(b.chance_draft, b.below_goal_draft, goal)}</span>}
          <span className={`text-[15px] font-semibold tnum ${open ? "" : "text-muted"}`}>{open ? chanceText(b.chance, b.below_goal, goal) : "—"}</span>
        </div>
        {open ? <Bullet chance={b.chance} below={b.below_goal} goal={goal} draft={compare ? b.chance_draft : null} label="Chance" /> : <div className="h-6 rounded-[5px] border border-dashed border-line-strong" />}
      </div>

      {/* Staff */}
      <div className="mt-4 compact:mt-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[12px] font-medium text-ink-2">Staff</span>
          <span className="text-[13px] text-ink-2 tnum" data-tip={open ? `Plan ${int(b.plan)} of the ${int(b.availability.capacity)} this block can field` : undefined}>
            {open ? (
              <>
                <span className="font-semibold text-ink">{int(b.plan)}</span> of {int(b.availability.capacity)}
              </>
            ) : (
              <span className="text-muted">—</span>
            )}
          </span>
        </div>
        {open ? <StaffBar b={b} compare={compare} /> : <div className="h-2.5 rounded-full border border-dashed border-line-strong" />}
      </div>

      {/* Stats */}
      <div className="mt-5 grid shrink-0 grid-cols-3 gap-3 border-t border-line pt-4 compact:mt-3 compact:pt-3">
        <Stat label="Cost" value={open ? usd(b.cost) : "—"} sub={open ? signedUsd(b.cost_change) : undefined} tip={open ? e.cost_effect : null} cls={open ? "" : "text-muted"} />
        <Stat label="Cushion" value={open && b.cushion_people != null ? int(b.cushion_people) : "—"} tip={open ? e.cushion : null} cls={open ? "" : "text-muted"} />
        <Stat
          label="Utilization"
          value={open && b.utilization != null ? `${Math.round(b.utilization * 100)}%` : "—"}
          below={compare && open && b.utilization_draft != null ? `draft ${Math.round(b.utilization_draft * 100)}%` : undefined}
          tip={open ? "Service falls off near 85–90%" : null}
          cls={open ? "" : "text-muted"}
        />
      </div>

      {strip}

      <StepActions onPrev={onPrev} onNext={onNext} canPrev={canPrev} canNext={canNext} />
    </div>
  );
}
