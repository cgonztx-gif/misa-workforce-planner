import { AlertTriangle, CheckCircle2, Inbox, PanelRightOpen, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  chanceFill,
  changeFill,
  DataTable,
  DeltaChip,
  Drawer,
  DrawerSection,
  EmptyState,
  ErrorPanel,
  HelpTip,
  KpiRow,
  KpiTile,
  PageHeader,
  SegmentedControl,
  Skeleton,
  SwatchLabel,
  chartColors,
  DEPT_COLORS,
  type Column,
} from "../components";
import { ApiError } from "../lib/api";
import { fmtInt, fmtMoney, fmtPct, signedInt, signedMoney, signedPts } from "../lib/format";
import { tokens } from "../styles/tokens";

interface Row {
  key: string;
  block: string;
  plan: number;
  draft: number;
  chance: number;
}
const ROWS: Row[] = [
  { key: "a", block: "Sat Feb 14, Front End, Midday", plan: 14, draft: 10, chance: 0.962 },
  { key: "b", block: "Fri Feb 13, Merchandising, Opening", plan: 6, draft: 7, chance: 0.991 },
  { key: "c", block: "Mon Feb 16, Pharmacy, Evening", plan: 3, draft: 3, chance: 0.874 },
];
const COLUMNS: Column<Row>[] = [
  { key: "block", header: "Block", value: (r) => r.block },
  { key: "draft", header: "Draft", value: (r) => r.draft, align: "right" },
  { key: "plan", header: "Plan", value: (r) => r.plan, align: "right" },
  { key: "change", header: "Change", value: (r) => r.plan - r.draft, align: "right", render: (r) => <DeltaChip size="sm" value={r.plan - r.draft} format={signedInt} /> },
  { key: "chance", header: "Chance of meeting target", value: (r) => r.chance, align: "right", render: (r) => fmtPct(r.chance) },
];

/** Not in the navigation: #/kit shows every shared component, for page builders and visual checks. */
export default function KitPage() {
  const [mode, setMode] = useState<"change" | "chance" | "util">("change");
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader title="Component kit" answer="Every shared component with the tokens it uses. Not linked from the navigation." actions={<HelpTip term="Cushion" label="Glossary tip" />} />
      <KpiRow columns={4}>
        <KpiTile label="Labor cost" value={fmtMoney(376176)} delta={{ value: 47068, format: (n) => signedMoney(n, true), goodWhen: "down", suffix: "vs draft" }} sub="Draft $329.1K" help="Tooltip on the tile." />
        <KpiTile label="Expected service" tone="accent" value={fmtPct(0.958)} delta={{ value: 0.26, format: (n) => signedPts(n), goodWhen: "up", suffix: "vs draft" }} />
        <KpiTile label="Below the goal" tone="risk" icon={<AlertTriangle />} value={fmtInt(25)} delta={{ value: -109, format: signedInt, goodWhen: "down" }} onClick={() => setOpen(true)} />
        <KpiTile label="Loading" value={null} />
      </KpiRow>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Badges, chips and swatches" description="Status always carries an icon and a word.">
          <div className="flex flex-wrap gap-2">
            <Badge>Neutral</Badge>
            <Badge tone="accent" icon={<Sparkles />}>What-if</Badge>
            <Badge tone="good" icon={<CheckCircle2 />}>Meets goal</Badge>
            <Badge tone="warning" icon={<AlertTriangle />}>Thin cushion</Badge>
            <Badge tone="risk" icon={<AlertTriangle />}>Below goal</Badge>
            <Badge tone="outline">Holiday</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <DeltaChip value={3} format={signedInt} goodWhen="up" />
            <DeltaChip value={-2} format={signedInt} goodWhen="up" />
            <DeltaChip value={0} format={signedInt} />
            <DeltaChip value={1274} format={signedInt} suffix="h" />
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <SwatchLabel color={chartColors.plan}>Plan</SwatchLabel>
            <SwatchLabel color={chartColors.draft}>Draft</SwatchLabel>
            <SwatchLabel color={chartColors.benchmark} dashed>Benchmark</SwatchLabel>
            <SwatchLabel color={DEPT_COLORS[38]}>Front End</SwatchLabel>
            <SwatchLabel color={DEPT_COLORS[92]}>Merchandising</SwatchLabel>
            <SwatchLabel color={DEPT_COLORS[95]}>Pharmacy</SwatchLabel>
          </div>
        </Card>

        <Card
          title="Board scales"
          description="Cells print their number; the color is a second signal."
          actions={
            <SegmentedControl
              label="Color the board by"
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: "change", label: "Change" },
                { value: "chance", label: "Chance", description: "Chance of meeting target" },
                { value: "util", label: "Utilization" },
              ]}
            />
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {(mode === "chance" ? [0.7, 0.82, 0.87, 0.92, 0.96, 0.99] : [-3, -2, -1, 0, 1, 2, 3]).map((v) => {
              const { fill, ink } = mode === "chance" ? chanceFill(v) : changeFill(v);
              return (
                <div key={v} className="tnum flex h-11 w-14 items-center justify-center rounded-chip text-base font-semibold" style={{ background: fill, color: ink }}>
                  {mode === "chance" ? fmtPct(v, 0) : signedInt(v)}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(tokens.color)
              .filter(([k]) => ["good", "warning", "risk", "accent", "navy"].includes(k))
              .map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-2 rounded-chip border border-border px-2 py-1 text-sm text-ink-muted">
                  <span className="size-3 rounded-sm" style={{ background: v }} />
                  {k}
                </span>
              ))}
          </div>
        </Card>

        <Card title="Sortable table" padding="none" description="Click a header to sort. Click a row to open the drawer.">
          <DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.key} onRowClick={() => setOpen(true)} initialSort={{ key: "change", dir: "desc" }} />
        </Card>

        <Card title="Empty, loading and error states">
          <EmptyState icon={<Inbox />} title="Every block reaches the goal" tone="good">
            Nothing to list for this warehouse and scenario.
          </EmptyState>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ErrorPanel error={new ApiError("offline", "/api/plan", "offline")} what="the plan" />
        <ErrorPanel error={new ApiError("http", "/api/what-if", "bad", 422, "goal must be one of 0.9, 0.925, 0.95, 0.975")} what="the what-if" onRetry={() => undefined} />
      </div>

      <div className="mt-6">
        <Button variant="primary" icon={<PanelRightOpen />} onClick={() => setOpen(true)}>
          Open the drawer
        </Button>
      </div>

      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Sat Feb 14, Front End, Midday"
        description="Warehouse 1, BASE"
        badges={
          <>
            <Badge tone="accent">Add 4 people</Badge>
            <Badge tone="risk" icon={<AlertTriangle />}>Below goal</Badge>
          </>
        }
        footer={<p className="text-sm text-ink-subtle">Assumptions: A-03, C-04</p>}
      >
        <DrawerSection title="Why">Valentine's Day inside the Presidents' Day window lifts midday checkout demand well above a normal Saturday.</DrawerSection>
        <DrawerSection title="Staff sources">10 regular, 2 cross-trained from Merchandising, 2 on overtime.</DrawerSection>
        <DrawerSection title="Cost">{signedMoney(1184)} against the draft.</DrawerSection>
      </Drawer>
    </>
  );
}
