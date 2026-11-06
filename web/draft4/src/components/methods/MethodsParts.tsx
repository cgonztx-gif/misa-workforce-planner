import { BadgeCheck, CheckCircle2, Database, FileText, Search, Calculator, Activity, TrendingUp, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { int, pct1 } from "../../lib/format";
import type { MethodsResponse, ServiceBand } from "../../lib/types";
import { CardHead, Key } from "../StatTile";

// ---- The service cliff --------------------------------------------------------------------------------------------

interface Band {
  key: string;
  label: string;
  lo: number;
  blocks: number;
  met: number;
  byDept: { department: string; blocks: number; met: number }[];
}

/** History's blocks by worked utilization, in 5-point bands; the thin tails fold into "under 60%" and "100%+". */
function bandsOf(rows: ServiceBand[]): Band[] {
  const keyOf = (b: number) => (b < 0.6 - 1e-9 ? 0.55 : b >= 1 - 1e-9 ? 1 : b);
  const map = new Map<number, { blocks: number; met: number; dept: Map<string, { blocks: number; met: number }> }>();
  for (const r of rows) {
    const k = keyOf(r.band);
    const m = map.get(k) ?? { blocks: 0, met: 0, dept: new Map() };
    m.blocks += r.blocks;
    m.met += r.met_target * r.blocks;
    const d = m.dept.get(r.department) ?? { blocks: 0, met: 0 };
    d.blocks += r.blocks;
    d.met += r.met_target * r.blocks;
    m.dept.set(r.department, d);
    map.set(k, m);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lo, m]) => ({
      key: String(lo),
      lo,
      label: lo < 0.6 ? "<60" : lo >= 1 ? "100+" : `${Math.round(lo * 100)}`,
      blocks: m.blocks,
      met: m.met / m.blocks,
      byDept: [...m.dept.entries()].map(([department, d]) => ({ department, blocks: d.blocks, met: d.met / d.blocks })),
    }));
}

/**
 * The service cliff (F-03, deck slide 3): the share of past blocks that met their wait target, by how busy the staff
 * were. Columns meeting 95% are green; below it, the board's red tiers. The cliff between 85% and 90% is the reason the
 * plan never aims near it; the 85% line marks it.
 */
export function Cliff({ rows, notes }: { rows: ServiceBand[]; notes?: string }) {
  const bands = bandsOf(rows);
  const fill = (m: number) => (m >= 0.95 ? "bg-good/70" : m >= 0.9 ? "bg-tier-low" : m >= 0.5 ? "bg-tier-mid" : "bg-tier-far");
  const cap = (m: number) => (m >= 0.95 ? "bg-good" : "bg-bad");
  const cliffAt = bands.findIndex((b) => b.lo >= 0.85 - 1e-9);
  return (
    <div data-chart="cliff">
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[12px] text-muted">
        <Key swatch="h-3 w-3 rounded-[3px] bg-good/70" label="95%+ met" />
        <Key swatch="h-3 w-3 rounded-[3px] bg-tier-mid" label="Below 95%" />
        <Key swatch="h-3 w-[2px] bg-ink/60" label="85% utilization" tip="Above it, past blocks rarely met their target" />
      </div>
      {/* Room above the plot for the 100% labels, so they never touch the legend. */}
      <div className="mt-8 flex">
        <div className="relative w-10 shrink-0" aria-hidden>
          <div className="relative h-[340px] compact:h-[210px]">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <span key={t} className="absolute right-2 translate-y-1/2 text-[11.5px] text-muted tnum" style={{ bottom: `${t * 100}%` }}>
                {Math.round(t * 100)}%
              </span>
            ))}
          </div>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[340px] compact:h-[210px]" aria-hidden>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <span key={t} className={`absolute inset-x-0 h-px ${t === 0 ? "bg-line-strong" : "bg-line"}`} style={{ bottom: `${t * 100}%` }} />
            ))}
          </div>
          <div className="relative grid gap-1.5" style={{ gridTemplateColumns: `repeat(${bands.length}, minmax(0, 1fr))` }} role="list" aria-label="Share of past blocks meeting target, by worked utilization">
            {bands.map((b, i) => (
              <div
                key={b.key}
                role="listitem"
                tabIndex={0}
                data-band={b.label}
                data-met={b.met.toFixed(4)}
                data-tip-title={`${pct1(b.met)} met target`}
                data-tip={[`Utilization ${b.label === "<60" ? "under 60%" : b.label === "100+" ? "100% or more" : `${b.label}–${Math.round(b.lo * 100) + 5}%`} · ${int(b.blocks)} blocks`, ...b.byDept.map((d) => `${d.department} ${pct1(d.met)} of ${int(d.blocks)}`)].join("\n")}
                className="relative flex flex-col rounded-[10px] pb-2 outline-none hover:bg-soft/50 focus-visible:ring-2 focus-visible:ring-accent"
              >
                {i === cliffAt && <span aria-hidden className="absolute top-0 -left-[4px] h-[340px] w-[2px] rounded-full bg-ink/60 compact:h-[210px]" />}
                <div className="relative h-[340px] compact:h-[210px]">
                  <span className={`absolute inset-x-0 text-center text-[12.5px] font-semibold tnum ${b.met >= 0.95 ? "text-ink-2" : "text-ink"}`} style={{ bottom: `calc(${b.met * 100}% + 6px)` }}>
                    {Math.round(b.met * 100)}%
                  </span>
                  <span className={`absolute inset-x-[16%] bottom-0 overflow-hidden rounded-t-[5px] ${fill(b.met)}`} style={{ height: `max(${b.met > 0 ? 3 : 0}px, ${b.met * 100}%)` }}>
                    <span className={`absolute inset-x-0 top-0 h-[3px] ${cap(b.met)}`} />
                  </span>
                </div>
                <div className="mt-2 flex flex-col items-center leading-tight">
                  <span className="text-[12.5px] font-medium text-ink-2 tnum">{b.label}</span>
                  <span className="text-[11px] text-muted tnum">{int(b.blocks)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11.5px] text-muted" data-tip={notes}>
            <span>Worked utilization, % · blocks</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Slot: the engine ------------------------------------------------------------------------------------------------

const STEP_ICON = [Database, TrendingUp, Activity, Calculator, BadgeCheck, Search, MessageSquareText];

/** The engine's seven steps as a numbered vertical path; each step's line is the API's own sentence. */
export function EngineSteps({ steps }: { steps: MethodsResponse["engine"] }) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-detail="engine">
      <CardHead title="How the engine works" sub="Python on the case's CSVs · no optimization solver" />
      <ol className="mt-4 flex flex-col">
        {steps.map((s, i) => {
          const Icon = STEP_ICON[i] ?? CheckCircle2;
          const last = i === steps.length - 1;
          return (
            <li key={s.step} className="relative flex gap-3 pb-4 last:pb-0" data-step={s.step}>
              {!last && <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-px bg-line-strong" />}
              <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-soft text-ink-2 ring-1 ring-line">
                <Icon size={15} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 pt-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] text-muted tnum">{i + 1}</span>
                  <span className="text-[13.5px] font-semibold text-ink">{s.step}</span>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{s.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---- Calibration --------------------------------------------------------------------------------------------------

/**
 * A reliability diagram: each bin's predicted chance (x) against the share that really met target (y), on the diagonal
 * when the model is honest. Dot area follows the bin's block count; the Brier scores sit above it.
 */
export function Calibration({ cal, brier }: { cal: MethodsResponse["service"]["calibration"]; brier: MethodsResponse["service"]["brier"] }) {
  const W = 300;
  const H = 220;
  const pad = { l: 36, r: 10, t: 10, b: 28 };
  const x = (v: number) => pad.l + v * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - v * (H - pad.t - pad.b);
  const maxN = Math.max(...cal.map((c) => c.blocks));
  const r = (n: number) => 3 + 9 * Math.sqrt(n / maxN);
  return (
    <div className="flex h-full flex-col" data-card-body="calibration">
      <CardHead title="Are its chances honest?" sub="Held-out blocks · predicted against what happened" />
      <div className="mt-4 flex items-baseline gap-6">
        <div data-tip="Mean squared gap between each predicted chance and what happened, on held-out weeks · lower is better">
          <div className="text-[12px] text-muted">Brier score</div>
          <div className="text-[22px] leading-tight font-semibold tracking-[-.02em] tnum">{brier.model.toFixed(3)}</div>
        </div>
        <div data-tip="What always predicting the average rate would score">
          <div className="text-[12px] text-muted">Average-rate guess</div>
          <div className="text-[22px] leading-tight font-semibold tracking-[-.02em] text-ink-2 tnum">{brier.base_rate.toFixed(3)}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,13rem)]">
      <div className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[360px]" role="img" aria-label={`Calibration: ${cal.map((c) => `${c.bin} predicted ${pct1(c.predicted)}, observed ${pct1(c.observed)}`).join("; ")}`}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--color-muted)">
              {t * 100}%
            </text>
            <text x={x(t)} y={H - 10} textAnchor="middle" fontSize="10.5" fill="var(--color-muted)">
              {t * 100}%
            </text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--color-ink)" strokeOpacity="0.35" strokeDasharray="4 4" />
        {cal.map((c) => (
          <circle key={c.bin} cx={x(c.predicted)} cy={y(c.observed)} r={r(c.blocks)} fill="var(--color-ink)" fillOpacity="0.55" stroke="var(--color-card)" strokeWidth="1.5">
            <title>{`${c.bin}: predicted ${pct1(c.predicted)}, observed ${pct1(c.observed)}, ${int(c.blocks)} blocks`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex max-w-[360px] justify-between text-[11.5px] text-muted">
        <span>Predicted chance →</span>
        <span>dot size = blocks</span>
      </div>
      </div>
      {/* The bins as numbers: predicted against what happened, and how many blocks. */}
      <div className="text-[12.5px]" role="table" aria-label="Calibration bins">
        <div className="flex border-b border-line pb-1 text-[11.5px] text-muted" role="row">
          <span className="flex-1">Chance</span>
          <span className="w-12 text-right">Real</span>
          <span className="w-12 text-right">Blocks</span>
        </div>
        {cal.map((c) => (
          <div key={c.bin} className="flex h-7 items-center border-b border-line/70 last:border-b-0 tnum" role="row" data-tip={`Predicted ${pct1(c.predicted)} · observed ${pct1(c.observed)}`}>
            <span className="flex-1 text-ink-2">{c.bin}</span>
            <span className="w-12 text-right font-medium">{Math.round(c.observed * 100)}%</span>
            <span className="w-12 text-right text-muted">{int(c.blocks)}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

// ---- Utilization limits -------------------------------------------------------------------------------------------

/** The utilization each department can run at in each warehouse and still hold a 95% chance (the service curve's u95). */
export function Limits({ limits }: { limits: MethodsResponse["service"]["limits"] }) {
  const depts = [...new Set(limits.map((l) => l.department))];
  const whs = [...new Set(limits.map((l) => l.warehouse))];
  const vals = limits.map((l) => l.u95);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const tint = (v: number) => {
    const t = (v - lo) / (hi - lo || 1);
    return t > 0.66 ? "bg-tier-m3" : t > 0.33 ? "bg-tier-m2" : "bg-tier-m1";
  };
  return (
    <div className="flex h-full flex-col" data-card-body="limits">
      <CardHead
        title="How busy a block can run"
        sub="Utilization that still holds a 95% chance"
        right={
          <>
            <Key swatch="h-3 w-4 rounded-[4px] bg-tier-m1" label="Lower" />
            <Key swatch="h-3 w-4 rounded-[4px] bg-tier-m3" label="Higher" />
          </>
        }
      />
      <div className="mt-4 grid gap-[5px]" style={{ gridTemplateColumns: `120px repeat(${whs.length}, minmax(0, 1fr))` }} role="table" aria-label="Utilization limit at a 95% chance">
        <span />
        {whs.map((w) => (
          <span key={w} className="pb-1 text-center text-[12px] text-muted" role="columnheader">
            {w.replace("Warehouse ", "W")}
          </span>
        ))}
        {depts.map((d) => (
          <div key={d} className="contents" role="row">
            <span className="flex items-center text-[12.5px] font-semibold text-ink-2" role="rowheader">
              {d}
            </span>
            {whs.map((w) => {
              const l = limits.find((x) => x.department === d && x.warehouse === w);
              return l ? (
                <span
                  key={w}
                  role="cell"
                  tabIndex={0}
                  data-tip-title={`${pct1(l.u95)} for a 95% chance`}
                  data-tip={`${d} · ${w}\n90% chance at ${pct1(l.u90)} · 50% at ${pct1(l.u50)}`}
                  className={`grid h-10 place-items-center rounded-[9px] text-[14px] font-semibold text-ink tnum outline-none focus-visible:ring-2 focus-visible:ring-accent ${tint(l.u95)}`}
                >
                  {pct1(l.u95)}
                </span>
              ) : (
                <span key={w} />
              );
            })}
          </div>
        ))}
      </div>
      {/* Every limit sits just around 85%: the cliff the plan stays under. */}
      <div className="mt-auto pt-5" data-limits-strip>
        <div className="mb-1.5 flex items-baseline justify-between text-[12px] text-muted">
          <span className="font-medium text-ink-2">All nine, on one scale</span>
          <span className="tnum">
            {pct1(lo)} – {pct1(hi)}
          </span>
        </div>
        <div className="relative h-8">
          <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-line/70" />
          <span className="absolute top-1 bottom-1 w-[2px] bg-ink/50" style={{ left: "50%" }} />
          {limits.map((l) => (
            <span
              key={`${l.dept_id}-${l.store_id}`}
              className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/70 ring-2 ring-card"
              style={{ left: `${((l.u95 - 0.8) / 0.1) * 100}%` }}
              data-tip={`${l.department} · ${l.warehouse} · ${pct1(l.u95)}`}
            />
          ))}
        </div>
        <div className="relative h-4 text-[11px] text-muted tnum">
          <span className="absolute left-0">80%</span>
          <span className="absolute left-1/2 -translate-x-1/2">85%</span>
          <span className="absolute right-0">90%</span>
        </div>
      </div>
    </div>
  );
}

// ---- Independent checks --------------------------------------------------------------------------------------------

/** Independent checks behind the numbers, each a finding with a way to reproduce it (planning/FINDINGS.md). */
const CHECKS: { label: string; text: string; ref: string }[] = [
  { label: "Rerun is byte for byte", text: "Rerunning the analysis rewrites every output file byte for byte.", ref: "F-66" },
  { label: "Submission rebuilt independently", text: "Joined on keys, closed blocks at 0, every block within capacity and at or above minimum staff.", ref: "F-67" },
  { label: "Brute force picks the same plan", text: "An independent brute force over every feasible staffing pair picks the same answer as the search.", ref: "F-70" },
  { label: "Costs rebuilt without our code", text: "Costs rebuilt row by row from the README's rule, without our code, match the plan's.", ref: "F-71" },
  { label: "Every explanation quotes its block", text: "Every explanation quotes its own block's numbers, checked by a test on every row.", ref: "F-72" },
  { label: "Risk math matches simulation", text: "The exact risk calculation agrees with a Monte Carlo simulation.", ref: "F-47" },
  { label: "Expected service matches history", text: "Expected service agrees with history when the model is set aside.", ref: "F-65" },
];

export function Checks() {
  return (
    <div className="flex h-full flex-col" data-card-body="checks">
      <CardHead title="Independent checks" sub={`${CHECKS.length} checks · each reproducible`} />
      <div className="mt-3 flex flex-col">
        {CHECKS.map((c) => (
          <div key={c.ref} tabIndex={0} data-tip={c.text} data-check={c.ref} className="flex h-10 items-center gap-3 border-b border-line px-1 outline-none last:border-b-0 focus-visible:bg-soft">
            <CheckCircle2 size={16} strokeWidth={1.9} className="shrink-0 text-good" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-2">{c.label}</span>
            <span className="shrink-0 font-mono text-[11.5px] text-muted">{c.ref}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Assumptions ------------------------------------------------------------------------------------------------------

/** The case asks for assumptions to be identified clearly: ours and the case's own, apart, each with its status. */
export function Assumptions({ items }: { items: MethodsResponse["assumptions"] }) {
  const ours = items.filter((a) => a.source === "ours");
  const cases = items.filter((a) => a.source !== "ours");
  const [tab, setTab] = useState<"ours" | "case">("ours");
  const list = tab === "ours" ? ours : cases;
  const chip = (st?: string) =>
    !st ? null : /confirmed|checked/i.test(st) ? "bg-good/12 text-ink" : /given/i.test(st) ? "bg-ink/[.06] text-ink-2" : "ring-1 ring-inset ring-line-strong text-muted";
  return (
    <div className="flex h-full flex-col" data-card-body="assumptions">
      <CardHead
        title="What it assumes"
        sub="Ours apart from the case's own"
        right={
          <div className="inline-flex rounded-full bg-soft p-0.5" role="tablist" aria-label="Assumptions">
            {(
              [
                ["ours", `Ours ${ours.length}`],
                ["case", `Case ${cases.length}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`h-7 rounded-full px-3 text-[12.5px] tnum transition-colors focus-visible:outline-2 focus-visible:outline-accent ${tab === id ? "bg-card font-medium text-ink shadow-[var(--shadow-pill)]" : "text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      <div className="mt-3 flex max-h-[520px] flex-col overflow-y-auto pr-1" role="list" data-list="assumptions">
        {list.map((a) => (
          <div
            key={a.id}
            role="listitem"
            tabIndex={0}
            data-assumption={a.id}
            data-tip={[a.detail, a.basis ? `Basis: ${a.basis}` : null].filter(Boolean).join("\n") || undefined}
            className="flex gap-3 border-b border-line py-2.5 outline-none last:border-b-0 focus-visible:bg-soft"
          >
            <span className="mt-[1px] shrink-0 font-mono text-[11.5px] text-muted">{a.id}</span>
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink-2">{a.text}</span>
            {a.status && <span className={`mt-[1px] inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] whitespace-nowrap ${chip(a.status)}`}>{a.status.replace(/, 2026-\d\d-\d\d$/, "").replace("Confirmed by the user", "Confirmed").replace("Given by the case", "Given")}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Documents and the notice ----------------------------------------------------------------------------------------

export function Documents({ docs, notice }: { docs: MethodsResponse["documents"]; notice: string }) {
  return (
    <div className="flex h-full flex-col" data-card-body="documents">
      <CardHead title="Documents" sub="Simulated data · not Costco data" subTip={notice} />
      <div className="mt-3 flex flex-col">
        {docs.map((d) => (
          <div key={d.path} className="flex h-10 items-center gap-3 border-b border-line px-1 last:border-b-0" data-tip={d.path} tabIndex={0}>
            <FileText size={15} strokeWidth={1.8} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-2">{d.name}</span>
            <span className="shrink-0 font-mono text-[11px] text-muted">{d.path.split(".").pop()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
