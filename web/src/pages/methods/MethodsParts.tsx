import { BookOpen, Check, CheckCircle2, Copy, Download, FileSpreadsheet, FileText, FlaskConical, NotebookPen, Presentation, UserX, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge, Card, LinkButton, Tooltip } from "../../components";
import { submissionCsvUrl } from "../../lib/api";
import type { MethodsAssumption } from "./types";

/** Why the plan gives a total per block rather than named shifts (gap 3 in the deliverables plan). */
export function PerBlockCard() {
  const reasons = [
    {
      icon: <FileSpreadsheet />,
      title: "The case asks for totals",
      text: "The submission template has one row per warehouse, department, day and shift, and asks for the total employees in each. That's the decision the plan answers.",
    },
    {
      icon: <UserX />,
      title: "The data has no one to name",
      text: "Availability comes as counts per block: regular staff, overtime and cross-trained staff. There are no individual employee records, skills or preferences to schedule.",
    },
    {
      icon: <Users />,
      title: "Managers fill the totals",
      text: "Each block's total comes with its split into regular, cross-trained and overtime staff, so a manager can fill it from their own roster in that order.",
    },
  ];
  return (
    <Card title="Why the plan gives a total per block, not individual shifts">
      <div className="grid gap-6 md:grid-cols-3">
        {reasons.map((r) => (
          <div key={r.title} className="flex gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-raised text-ink-muted ring-1 ring-border [&>svg]:size-[18px]">{r.icon}</span>
            <div className="min-w-0">
              <p className="font-semibold text-ink">{r.title}</p>
              <p className="mt-1 text-base leading-snug text-ink-muted">{r.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** A short status chip for one of our assumptions: "Confirmed by the user, 2026-11-04" reads "Confirmed". */
function Status({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status.toLowerCase();
  // "Proposed" means we stated it as our own judgment, not that it's unfinished.
  const word = s.startsWith("confirmed") ? "Confirmed" : s.startsWith("checked") ? "Checked" : s.startsWith("proposed") ? "Our judgment" : status;
  const good = word === "Confirmed" || word === "Checked";
  return (
    <Badge tone={good ? "good" : "neutral"} icon={good ? <CheckCircle2 /> : undefined} title={word === "Our judgment" ? "Stated as our judgment: reasoned from the data, not separately tested" : status}>
      {word}
    </Badge>
  );
}

/** Keep short ranges such as "Feb 13-16" or "weeks 3-6" on one line, so they never break at the hyphen. */
function keepRangesWhole(text: string): ReactNode {
  const parts = text.split(/((?:[A-Z][a-z]{2}|weeks?) \d{1,2}[-–]\d{1,2})/);
  return parts.length === 1 ? text : parts.map((p, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{p}</span> : p));
}

/** A file path that wraps only after a slash or underscore, never mid-word. */
function PathText({ path }: { path: string }) {
  const pieces = path.split(/(?<=[/_])/);
  return (
    <>
      {pieces.map((p, i) => (
        <span key={i}>
          {p}
          {i < pieces.length - 1 && <wbr />}
        </span>
      ))}
    </>
  );
}

function AssumptionList({ items, showStatus }: { items: MethodsAssumption[]; showStatus: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 px-5 py-3">
          <Tooltip content={a.basis ? <span><span className="font-semibold">Basis:</span> {a.basis}</span> : null} width={340}>
            <span tabIndex={0} className="mt-px h-fit shrink-0 rounded-chip bg-raised px-1.5 py-px font-mono text-sm text-ink-muted ring-1 ring-border tnum">
              {a.id}
            </span>
          </Tooltip>
          <p className="min-w-0 flex-1 text-base leading-snug text-ink-muted">{keepRangesWhole(a.text)}</p>
          {showStatus && (
            <span className="shrink-0">
              <Status status={a.status} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Our assumptions, listed apart from the case's. */
export function AssumptionsSection({ assumptions }: { assumptions: MethodsAssumption[] }) {
  const ours = assumptions.filter((a) => a.source === "ours");
  const theirs = assumptions.filter((a) => a.source !== "ours");
  // Numbers missing from our sequence (A-08) were retired, not lost: say so rather than leave a silent gap.
  const nums = ours.map((a) => Number(a.id.replace(/\D/g, ""))).filter((n) => n > 0);
  const retired = nums.length ? Array.from({ length: Math.max(...nums) }, (_, i) => i + 1).filter((n) => !nums.includes(n)).map((n) => `A-${String(n).padStart(2, "0")}`) : [];
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <Card title={`Our assumptions (${ours.length})`} description={`What we added to the case. Each is tested or stated as a judgment; hover an ID for its basis.${retired.length ? ` ${retired.join(", ")} ${retired.length === 1 ? "was" : "were"} retired.` : ""}`} padding="none">
        <AssumptionList items={ours} showStatus />
      </Card>
      <Card title={`The case's assumptions (${theirs.length})`} description="Given in the data pack. We use them as stated." padding="none">
        <AssumptionList items={theirs} showStatus={false} />
      </Card>
    </div>
  );
}

/** The simulated-data notice, on navy like the app frame. */
export function NoticeBand({ notice }: { notice: string }) {
  return (
    <div role="note" className="flex items-start gap-4 rounded-card bg-navy px-5 py-4 text-navy-ink">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-raised text-navy-accent ring-1 ring-navy-border">
        <FlaskConical className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-semibold">Simulated data</p>
        <p className="mt-0.5 text-base leading-snug text-navy-ink-muted">{notice}</p>
      </div>
    </div>
  );
}

const DOC_ICONS: [RegExp, typeof FileText][] = [
  [/\.docx$/i, FileText],
  [/\.ipynb$/i, NotebookPen],
  [/\.pptx$/i, Presentation],
  [/\.csv$/i, FileSpreadsheet],
];

function CopyPath({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the path is still selectable */
    }
  };
  return (
    <button type="button" onClick={copy} aria-label={`Copy the path ${path}`} className="inline-flex size-8 shrink-0 items-center justify-center rounded-chip text-ink-subtle hover:bg-raised hover:text-ink">
      {copied ? <Check className="size-4 text-good" aria-hidden /> : <Copy className="size-4" aria-hidden />}
    </button>
  );
}

/** Where the report, notebook, deck and plan live in the project folder. */
export function DocumentsCard({ documents }: { documents: { name: string; path: string }[] }) {
  return (
    <Card title="Where to find the rest" description="In the project folder. The report and notebook explain every step on this page in full." padding="none">
      <ul className="grid md:grid-cols-2 [&>li]:border-t [&>li]:border-border md:[&>li:nth-child(odd)]:border-r">
        {documents.map((d) => {
          const Icon = DOC_ICONS.find(([re]) => re.test(d.path))?.[1] ?? BookOpen;
          const csv = /\.csv$/i.test(d.path);
          return (
            <li key={d.path} className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{d.name}</p>
                <p className="font-mono text-sm break-words text-ink-subtle select-all">
                  <PathText path={d.path} />
                </p>
              </div>
              {csv && (
                <LinkButton href={submissionCsvUrl} download size="sm" icon={<Download />}>
                  Download
                </LinkButton>
              )}
              <CopyPath path={d.path} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
