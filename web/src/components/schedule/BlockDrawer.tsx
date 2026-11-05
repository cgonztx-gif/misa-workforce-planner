// The block drawer: everything about one block, in its own numbers. Opened from the board,
// the Changes table or a link; the selected block lives in the URL so a refresh reopens it.
import { AlertTriangle, ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, DollarSign, Gauge, LifeBuoy, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router";
import { cn } from "../../lib/cn";
import { fmtDec1, fmtHours, fmtMoney, fmtPct, signedInt, signedMoney } from "../../lib/format";
import type { Block } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Drawer, DrawerSection } from "../ui/Drawer";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { DeltaChip } from "../ui/KpiTile";
import { tokens } from "../../styles/tokens";
import { fmtChance } from "./boardScales";
import { ServiceBars, SourcesTable, Stat } from "./drawerParts";

export interface BlockDrawerProps {
  block: Block | undefined;
  onClose: () => void;
  goal: number;
  /** Demand unit per department id, e.g. "checkout workload units". */
  demandUnit?: (deptId: number) => string | undefined;
  /** The same department and shift on the day before and after, for stepping through the week. */
  prev?: Block;
  next?: Block;
  onNavigate?: (key: string) => void;
  /** Search string carried to other pages (useView().carry). */
  carry?: string;
}

const actionTone = (b: Block) => (b.change > 0 ? "accent" : "neutral");

export function BlockDrawer({ block, onClose, goal, demandUnit, prev, next, onNavigate, carry = "" }: BlockDrawerProps) {
  const open = !!block;
  const b = block;
  const goalPct = fmtPct(goal, 0);
  // Below 1600px a 580px drawer would cover the middle of the board (Sat Feb 14 at 1366), so it narrows.
  const wide = useMediaQuery("(min-width: 1600px)");

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && onClose()}
      width={wide ? 580 : 440}
      modal={false}
      top={tokens.shape.topbar_height}
      title={b?.label ?? ""}
      description={
        b && (
          <span className="tnum">
            {b.warehouse}, {b.scenario}
            {b.start && b.end ? `, ${b.start} to ${b.end} (${b.paid_hours} paid hours)` : ""}
          </span>
        )
      }
      badges={
        b && (
          <>
            {b.is_open ? (
              b.below_goal ? (
                <Badge tone="risk" icon={<AlertTriangle />}>
                  Below the {goalPct} goal
                </Badge>
              ) : (
                <Badge tone="good" icon={<ShieldCheck />}>
                  Meets the {goalPct} goal
                </Badge>
              )
            ) : (
              <Badge tone="neutral">Closed</Badge>
            )}
            {b.is_open && <Badge tone={actionTone(b)}>{b.action}</Badge>}
            {b.at_capacity && b.is_open && <Badge tone="outline">At capacity</Badge>}
            {b.holiday && (
              <Badge tone="neutral" icon={<CalendarDays />}>
                {b.holiday}
              </Badge>
            )}
          </>
        )
      }
      footer={
        b && onNavigate ? (
          <div className="flex items-center justify-between gap-3">
            <Button size="sm" variant="ghost" icon={<ChevronLeft />} disabled={!prev} onClick={() => prev && onNavigate(prev.key)}>
              {prev ? prev.day : "First day"}
            </Button>
            <span className="text-sm text-ink-subtle">Same shift, other days</span>
            <Button size="sm" variant="ghost" disabled={!next} onClick={() => next && onNavigate(next.key)} className="flex-row-reverse">
              <ChevronRight />
              {next ? next.day : "Last day"}
            </Button>
          </div>
        ) : undefined
      }
    >
      {b && !b.is_open && (
        <DrawerSection title="Why" icon={<BookOpen />}>
          <p>{b.explanation.why}</p>
          <p className="mt-2 text-ink-subtle">Closed blocks count as 0 people in the submission.</p>
        </DrawerSection>
      )}
      {b && b.is_open && <OpenBlock b={b} goal={goal} unit={demandUnit?.(b.dept_id)} carry={carry} />}
    </Drawer>
  );
}

function OpenBlock({ b, goal, unit, carry }: { b: Block; goal: number; unit?: string; carry: string }) {
  const goalPct = fmtPct(goal, 0);
  return (
    <>
      {/* The action: draft to plan, and the reason. */}
      <section className="border-b border-border pb-5">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-sm text-ink-subtle">Draft</div>
            <div className="tnum font-display text-[34px] leading-none font-semibold text-ink-muted">{b.draft}</div>
          </div>
          <ArrowRight className="mt-4 size-5 text-ink-subtle" aria-hidden />
          <div>
            <div className="text-sm font-medium text-accent-strong">Plan</div>
            <div className="tnum font-display text-[34px] leading-none font-semibold text-ink">{b.plan}</div>
          </div>
          <div className="mt-4 ml-1">
            <DeltaChip value={b.change} format={signedInt} goodWhen="neutral" suffix={b.change === 1 || b.change === -1 ? "person" : "people"} />
          </div>
        </div>
        <p className="tnum mt-3 flex flex-wrap items-baseline gap-x-2 text-base text-ink-muted">
          <span>Chance of meeting target</span>
          <span>{fmtChance(b.chance_draft, b.below_goal_draft, goal)}</span>
          <ArrowRight className="size-3.5 self-center text-ink-subtle" aria-hidden />
          <span className={cn("font-semibold", b.below_goal ? "text-risk-ink" : "text-ink")}>{fmtChance(b.chance, b.below_goal, goal)}</span>
          <span className="text-ink-subtle">(goal {goalPct})</span>
        </p>
        <p className="mt-4 text-body-lg leading-relaxed text-ink">{b.explanation.why}</p>
        {b.below_goal && (
          <Link
            to={`/playbook${carry}`}
            className="mt-3 inline-flex items-center gap-1.5 text-base font-semibold text-risk-ink underline-offset-4 hover:underline"
          >
            What to do on the day: see the Playbook
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </section>

      <DrawerSection title="Demand driver" icon={<TrendingUp />}>
        <p>{b.explanation.demand_driver ?? "No driver recorded for this block."}</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Stat label="Forecast demand" value={fmtDec1(b.demand)} sub={unit ? unit : undefined} />
          <Stat
            label="Callouts allowed for"
            value={fmtPct(b.callout_rate, 1)}
            sub={b.callout_context ? `${b.callout_context.replace(/_/g, " ")} rate` : undefined}
          />
        </div>
        {b.demand_multiplier !== 1 && (
          <p className="tnum mt-2 text-sm text-ink-subtle">
            Scenario multiplier x{b.demand_multiplier.toFixed(2)}: {b.adjustment_reason}.
          </p>
        )}
      </DrawerSection>

      <DrawerSection title="Staff sources" icon={<Users />}>
        <p>{b.explanation.staffing}</p>
        <SourcesTable block={b} />
        {b.availability.note && <p className="mt-2 text-sm text-ink-subtle">Availability: {b.availability.note}.</p>}
      </DrawerSection>

      <DrawerSection title="Cost effect" icon={<DollarSign />}>
        <p>{b.explanation.cost_effect}</p>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <Stat label="Draft" value={fmtMoney(b.cost_draft)} sub={fmtHours(b.hours_draft)} tone="muted" />
          <Stat label="Plan" value={fmtMoney(b.cost)} sub={fmtHours(b.hours)} tone="accent" />
          <Stat label="Change" value={signedMoney(b.cost_change)} sub={`${signedInt(b.hours - b.hours_draft)} h`} />
        </div>
      </DrawerSection>

      <DrawerSection title="Service effect" icon={<Gauge />}>
        <p>{b.explanation.service_effect}</p>
        <ServiceBars block={b} goal={goal} />
        <p className="tnum text-sm text-ink-subtle">
          Utilization {fmtPct(b.utilization_draft, 0)} in the draft, {fmtPct(b.utilization, 0)} in the plan.
          {b.need != null && ` A ${goalPct} chance would take ${b.need} people; this block can field ${b.availability.capacity}.`}
        </p>
      </DrawerSection>

      <DrawerSection title="Cushion" icon={<LifeBuoy />}>
        <p>{b.explanation.cushion}</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Stat label="People it can lose" value={b.cushion_people ?? "–"} />
          <Stat label="Extra demand it can take" value={fmtPct(b.cushion_demand, 0)} />
        </div>
      </DrawerSection>

      <DrawerSection title="Assumptions behind it" icon={<BookOpen />}>
        {b.assumptions.length ? (
          <ul className="space-y-2">
            {b.assumptions.map((a) => (
              <li key={a.id} className="flex gap-2.5">
                <span className="tnum mt-0.5 shrink-0 self-start rounded-chip bg-raised px-1.5 text-sm font-medium text-ink-muted ring-1 ring-border">{a.id}</span>
                <span>{a.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No assumptions apply.</p>
        )}
        <Link to={`/methods${carry}`} className="mt-3 inline-block text-sm font-medium text-accent hover:text-accent-strong">
          All assumptions, ours and the case's, on the Methods page
        </Link>
      </DrawerSection>
    </>
  );
}
