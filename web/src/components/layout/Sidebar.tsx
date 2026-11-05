import { BookOpenCheck, CalendarRange, Download, FlaskConical, LayoutDashboard, Scale, TrendingUp, Workflow, type LucideIcon } from "lucide-react";
import { NavLink } from "react-router";
import { submissionCsvUrl } from "../../lib/api";
import { cn } from "../../lib/cn";
import { PAGES, useView, type PageDef } from "../../lib/view";

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  schedule: CalendarRange,
  demand: TrendingUp,
  "cost-service": Scale,
  "scenario-lab": FlaskConical,
  playbook: BookOpenCheck,
  methods: Workflow,
};

const GROUPS: { id: PageDef["group"]; label: string }[] = [
  { id: "plan", label: "The plan" },
  { id: "respond", label: "When things change" },
  { id: "reference", label: "How it works" },
];

/** Navy sidebar: navigation to the seven pages, carrying scenario and warehouse along. */
export function Sidebar() {
  const { carry } = useView();
  return (
    <nav aria-label="Pages" className="flex w-[236px] shrink-0 flex-col bg-navy px-3 pt-3 pb-4">
      <div className="flex-1 space-y-5">
        {GROUPS.map((group) => (
          <div key={group.id}>
            <p className="px-3 pb-1.5 text-sm text-navy-ink-muted/80">{group.label}</p>
            <ul className="space-y-0.5">
              {PAGES.filter((p) => p.group === group.id).map((page) => {
                const Icon = ICONS[page.path];
                return (
                  <li key={page.path}>
                    <NavLink
                      to={`/${page.path}${carry}`}
                      className={({ isActive }) =>
                        cn(
                          "group relative flex h-10 items-center gap-3 rounded-control px-3 text-base font-medium transition-colors",
                          isActive ? "bg-navy-raised text-navy-ink" : "text-navy-ink-muted hover:bg-navy-raised/60 hover:text-navy-ink",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span aria-hidden className="absolute inset-y-2 -left-3 w-[3px] rounded-r bg-navy-accent" />}
                          <Icon className={cn("size-[18px] shrink-0", isActive ? "text-navy-accent" : "text-navy-ink-muted group-hover:text-navy-ink")} aria-hidden />
                          {page.label}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-card border border-navy-border p-3.5">
        <p className="text-sm font-medium text-navy-ink">Submitted plan</p>
        <p className="mt-0.5 text-sm leading-snug text-navy-ink-muted">567 rows (3 scenarios × 189 blocks), ready to submit.</p>
        <a
          href={submissionCsvUrl}
          download
          className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-control bg-navy-raised text-sm font-medium text-navy-ink ring-1 ring-navy-border hover:bg-navy-border"
        >
          <Download className="size-4" aria-hidden />
          Download CSV
        </a>
      </div>
    </nav>
  );
}
