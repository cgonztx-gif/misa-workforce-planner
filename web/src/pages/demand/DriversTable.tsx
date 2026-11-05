import { Ban, CheckCircle2, MinusCircle, Shuffle } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Card, type Tone } from "../../components";
import { cn } from "../../lib/cn";
import type { DriverRow, ForecastResponse } from "./types";

type Status = "model" | "scenario" | "carried" | "left_out" | "not_used";
const STATUS: Record<Status, { label: string; tone: Tone; icon: ReactNode }> = {
  model: { label: "In the forecast", tone: "accent", icon: <CheckCircle2 /> },
  carried: { label: "Carried by other terms", tone: "neutral", icon: <Shuffle /> },
  scenario: { label: "Through PEAK's multipliers", tone: "neutral", icon: <Shuffle /> },
  left_out: { label: "Left out", tone: "outline", icon: <MinusCircle /> },
  not_used: { label: "Never used", tone: "outline", icon: <Ban /> },
};

interface Line {
  name?: string;
  tested: ReactNode;
  found: ReactNode;
  use: ReactNode;
  status: Status;
}
interface Group {
  driver: string;
  lines: Line[];
}

const fromApi = (row: DriverRow | undefined, status: Status, extra?: { found?: string; use?: string; name?: string }): Line | null =>
  row
    ? {
        name: extra?.name,
        tested: row.tested,
        found: extra?.found ? `${row.found} ${extra.found}` : row.found,
        use: extra?.use ? `${row.use} ${extra.use}` : row.use,
        status,
      }
    : null;

/**
 * Every demand driver the case names (p3), with what we tested, found and did. The tested/found/use
 * wording and every figure come from /api/forecast's drivers_tested and holiday_factors. Rows the API
 * doesn't carry (warehouse size, department activity) are described here without new numbers.
 */
export function DriversTable({ data, windowLabel }: { data: ForecastResponse; windowLabel: string }) {
  const by = new Map(data.drivers_tested.map((d) => [d.driver, d]));
  const factor = (dept: number, window: string) => data.holiday_factors.find((h) => h.dept_id === dept && h.window === window)?.factor;
  const fmtF = (f: number | undefined) => (f == null ? "–" : `x${f.toFixed(2)}`);
  const fit = by.get("Weekday pattern")?.found.match(/\d+(?:\.\d+)?%/)?.[0];
  const groups: Group[] = [
    { driver: "Day of the week", lines: [fromApi(by.get("Weekday pattern"), "model")] },
    { driver: "Customer traffic", lines: [fromApi(by.get("Customer traffic"), "not_used")] },
    {
      driver: "Holidays",
      lines: [
        fromApi(by.get("Holiday windows"), "model", { name: "Holiday windows" }),
        fromApi(by.get("Valentine's Day"), "model", { name: "Valentine's Day" }),
        fromApi(by.get("Post-holiday rebound"), "left_out", { name: "Post-holiday rebound" }),
      ],
    },
    {
      driver: "Promotions",
      lines: [
        fromApi(by.get("Promotions"), "carried", {
          found: "History has a promotion on every Friday to Sunday and every holiday-window day, so its effect can't be separated from those days.",
          use: `The weekday and holiday terms already carry it, and the planning week's promotions fall on ${windowLabel}, the same pattern as MLK's.`,
        }),
      ],
    },
    { driver: "Weather", lines: [fromApi(by.get("Temperature (weather)"), "scenario")] },
    {
      driver: "Warehouse size",
      lines: [
        {
          tested: "A level for each warehouse, in the forecast and on each department's service curve",
          found: `Warehouses differ in level and in how service responds to load.${fit ? ` Warehouse and weekday together explain ${fit} of the variation in log daily demand.` : ""}`,
          use: "In the forecast and the service curves. The warehouse switch at the top shows each one.",
          status: "model",
        },
      ],
    },
    {
      driver: "Department activity",
      lines: [
        {
          tested: "Each department on its own: forecast, weekday shape, holiday factors, labor standard, service curve and shift shares",
          found: (
            <>
              Departments move differently. On the holiday Monday, Front End runs {fmtF(factor(38, "holiday_monday"))} a normal day, Merchandising {fmtF(factor(92, "holiday_monday"))} and Pharmacy{" "}
              {fmtF(factor(95, "holiday_monday"))}.
            </>
          ),
          use: "Each department is forecast and staffed separately, in its own workload units.",
          status: "model",
        },
      ],
    },
  ].map((g) => ({ ...g, lines: g.lines.filter((l): l is Line => l !== null) }));
  const also = fromApi(by.get("Weekly level"), "model", { name: "Weekly level" });

  const head = "sticky top-0 border-b border-border bg-raised px-4 py-2.5 text-left text-sm font-medium text-ink-subtle";
  const cell = "border-b border-border px-4 py-3 align-top text-base leading-snug text-ink-muted";
  const renderLine = (driver: string, l: Line, i: number, n: number) => (
    <tr key={`${driver}-${i}`}>
      {i === 0 && (
        <th scope="row" rowSpan={n} className={cn(cell, "bg-surface text-left font-semibold text-ink")}>
          {driver}
        </th>
      )}
      <td className={cell}>
        {l.name && <span className="mb-0.5 block text-sm font-semibold text-ink">{l.name}</span>}
        {l.tested}
      </td>
      <td className={cn(cell, "tnum")}>{l.found}</td>
      <td className={cell}>
        <Badge tone={STATUS[l.status].tone} icon={STATUS[l.status].icon} className="mb-1.5">
          {STATUS[l.status].label}
        </Badge>
        <span className="block">{l.use}</span>
      </td>
    </tr>
  );

  return (
    <Card
      title="Drivers we tested"
      description="Every demand driver the case names, what we tested, what we found, and how it enters the plan."
      padding="none"
      footer="Figures come from the six weeks of simulated history (Jan 1 to Feb 11)."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-separate border-spacing-0">
          <colgroup>
            <col style={{ width: "15%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "30%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className={head}>Driver the case names</th>
              <th className={head}>What we tested</th>
              <th className={head}>What we found</th>
              <th className={head}>How it enters the plan</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => g.lines.map((l, i) => renderLine(g.driver, l, i, g.lines.length)))}
            {also && (
              <>
                <tr>
                  <td colSpan={4} className="border-b border-border bg-raised px-4 py-2 text-sm font-medium text-ink-subtle">
                    Also tested
                  </td>
                </tr>
                {renderLine("Weekly level", { ...also, name: undefined }, 0, 1)}
              </>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
