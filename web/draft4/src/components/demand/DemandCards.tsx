import { CircleCheck, CircleMinus, Scale } from "lucide-react";
import { demandOf, gapOf, MISS, type DemandSummary } from "../../lib/demand";
import { int, pct1, pctChange, pts, signedPct1, units1 } from "../../lib/format";
import type { ErrorRow, ForecastResponse, ForecastSeries, ScenarioCode } from "../../lib/types";
import type { DeptId } from "../../lib/url";
import { StatTile } from "../StatTile";

// ---- KPI strip --------------------------------------------------------------------------------------------------

const Tile = StatTile;

export function DemandTiles({ series, sum, scenario, err }: { series: ForecastSeries; sum: DemandSummary; scenario: ScenarioCode; err?: ErrorRow }) {
  const missGap = gapOf(sum.miss, scenario);
  return (
    <div className="grid grid-cols-2 border-b border-line sm:grid-cols-4" data-strip="demand">
      <Tile
        label="Week demand"
        value={int(sum.week)}
        delta={pctChange(sum.week - sum.bench, sum.bench)}
        sub={`Benchmark ${int(sum.bench)}`}
        tip={`${series.unit} over the 7 days · forecast ${units1(sum.week)} · benchmark ${units1(sum.bench)}`}
      />
      <Tile label="Peak day" value={sum.peak.day_short} sub={`${int(demandOf(sum.peak, scenario))} units${sum.peak.holiday ? ` · ${sum.peak.holiday}` : ""}`} tip={`${sum.peak.day} · ${units1(demandOf(sum.peak, scenario))} ${series.unit}`} />
      <Tile
        label="Benchmark miss"
        value={signedPct1(missGap)}
        valueCls={missGap >= MISS ? "text-bad-strong" : ""}
        sub={`${sum.miss.day_short} · benchmark ${missGap >= 0 ? "low" : "high"}`}
        tip={missGap >= 0 ? "The largest gap this week: the benchmark sits under the forecast, so a plan built on it would staff too few" : "The largest gap this week: the benchmark sits over the forecast, so a plan built on it would staff too many"}
      />
      {err ? (
        <Tile
          label="Forecast error"
          short="Error"
          value={pct1(err.model)}
          delta={pts(err.model - err.benchmark)}
          tone={err.model < err.benchmark ? "good" : "bad"}
          sub={`Benchmark ${pct1(err.benchmark)}`}
          tip={`Mean daily error on held-out normal weeks (${int(err.rows)} days), ${err.department ?? "all departments"} · lower is better`}
        />
      ) : (
        <Tile label="Forecast error" value="—" sub="" />
      )}
    </div>
  );
}

// ---- Backtest error -----------------------------------------------------------------------------------------------

/** Paired slim bars per group (forecast ink, benchmark dashed grey) on one 0-based scale: lower is better. */
export function AccuracyCard({ data, dept }: { data: ForecastResponse; dept: DeptId }) {
  const byDept = data.backtest.daily;
  const byDays = data.backtest.by_day_group.filter((r) => r.group === "Fri-Mon" || r.group === "Tue-Thu");
  const all = [...byDept, ...byDays];
  const max = Math.max(...all.map((r) => Math.max(r.model, r.benchmark))) * 1.1;
  const w = (v: number) => `${(v / max) * 100}%`;
  const name = (r: ErrorRow) => (r.department ?? String(r.group)).replace("-", "–").replace("All departments", "All");

  const Row = ({ r, on }: { r: ErrorRow; on: boolean }) => (
    <div
      className={`grid grid-cols-[112px_1fr] items-center gap-3 rounded-[10px] px-3 py-2 ${on ? "bg-accent/[.07] ring-1 ring-accent/25 ring-inset" : ""}`}
      data-row={String(r.group)}
      data-tip={`${int(r.rows)} held-out days · forecast ${pct1(r.model)} · benchmark ${pct1(r.benchmark)}`}
    >
      <span className={`truncate text-[13.5px] ${on ? "font-medium text-ink" : "text-ink-2"}`}>{name(r)}</span>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="relative h-2.5 flex-1 rounded-full bg-line/60">
            <span className="absolute inset-y-0 left-0 rounded-full bg-ink/75" style={{ width: w(r.model) }} />
          </span>
          <span className="w-11 text-right text-[13px] font-semibold tnum">{pct1(r.model)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative h-2.5 flex-1 rounded-full bg-line/60">
            <span className="absolute inset-y-0 left-0 rounded-full border-[1.5px] border-dashed border-series-grey bg-series-grey/15" style={{ width: w(r.benchmark) }} />
          </span>
          <span className="w-11 text-right text-[13px] text-muted tnum">{pct1(r.benchmark)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col" data-card-body="accuracy">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15.5px] font-semibold tracking-[-.01em]">Forecast error</h2>
          <div className="mt-0.5 text-[12.5px] text-muted" data-tip={data.accuracy.limit}>
            Held-out weeks · lower is better
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4 pt-1 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-3 rounded-full bg-ink/75" />
            Forecast
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-3 rounded-full border-[1.5px] border-dashed border-series-grey bg-series-grey/15" />
            Benchmark
          </span>
        </div>
      </div>
      <div className="mt-4 text-[12px] font-medium text-ink-2">By department</div>
      <div className="mt-1 flex flex-col">
        {byDept.map((r) => (
          <Row key={String(r.group)} r={r} on={r.group === dept} />
        ))}
      </div>
      <div className="mt-3 text-[12px] font-medium text-ink-2">By days of the week</div>
      <div className="mt-1 flex flex-col">
        {byDays.map((r) => (
          <Row key={String(r.group)} r={r} on={false} />
        ))}
      </div>
    </div>
  );
}

// ---- Drivers tested ---------------------------------------------------------------------------------------------

const useChip = (use: string) =>
  use.startsWith("In the model")
    ? { text: "In the model", cls: "bg-ink/[.08] text-ink", Icon: CircleCheck }
    : use.startsWith("Adds")
      ? { text: "Judgment", cls: "bg-ink/[.05] text-ink-2", Icon: Scale }
      : { text: "Left out", cls: "bg-transparent text-muted ring-1 ring-inset ring-line-strong", Icon: CircleMinus };

export function DriversCard({ data }: { data: ForecastResponse }) {
  const rows = [...data.drivers_tested].sort((a, b) => order(a.use) - order(b.use));
  return (
    <div className="flex h-full flex-col" data-card-body="drivers">
      <h2 className="text-[15.5px] font-semibold tracking-[-.01em]">Drivers tested</h2>
      <div className="mt-0.5 text-[12.5px] text-muted">
        {rows.filter((r) => r.use.startsWith("In the model")).length} in the model · {rows.length} tested
      </div>
      <div className="mt-3 flex flex-col">
        {rows.map((r) => {
          const c = useChip(r.use);
          return (
            <div key={r.driver} className="flex h-11 items-center gap-3 border-b border-line px-1 last:border-b-0" data-driver={r.driver} data-tip-title={r.driver} data-tip={[r.tested, r.found, r.use].join("\n")}>
              <span className="flex-1 truncate text-[13.5px] text-ink-2">{r.driver}</span>
              <span className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] ${c.cls}`}>
                <c.Icon size={13} strokeWidth={1.9} aria-hidden />
                {c.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const order = (use: string) => (use.startsWith("In the model") ? 0 : use.startsWith("Adds") ? 1 : 2);
