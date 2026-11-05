import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface Column<T> {
  /** Unique id; also the sort key. */
  key: string;
  header: ReactNode;
  /** The raw value: used for sorting and as the default cell text. Keep it numeric for numbers. */
  value: (row: T) => string | number | boolean | null | undefined;
  /** Custom cell content (chips, badges). Defaults to value(row). */
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Default true. */
  sortable?: boolean;
  /** CSS width, e.g. "120px" or "18%". */
  width?: string;
  /** Hover text on the header. */
  title?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Initial sort column and direction. */
  initialSort?: { key: string; dir: "asc" | "desc" };
  /** Makes rows clickable (e.g. open the block drawer). */
  onRowClick?: (row: T) => void;
  /** Highlights one row, e.g. the selected block. */
  selectedKey?: string | null;
  /** Shown when rows is empty. */
  empty?: ReactNode;
  /** Scroll inside the table past this height (px), with a sticky header. */
  maxHeight?: number;
  dense?: boolean;
  /** Accessible caption (visually hidden). */
  caption?: string;
  className?: string;
}

const compare = (a: unknown, b: unknown) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b), "en", { numeric: true });
};

/** A sortable table. Click a header to sort; numbers are right-aligned in tabular figures. */
export function DataTable<T>({ columns, rows, rowKey, initialSort, onRowClick, selectedKey, empty, maxHeight, dense, caption, className }: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const out = [...rows].sort((a, b) => compare(col.value(a), col.value(b)));
    return sort.dir === "desc" ? out.reverse() : out;
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  if (!rows.length && empty) return <>{empty}</>;
  const cellPad = dense ? "px-3 py-2" : "px-4 py-2.5";

  return (
    <div className={cn("scrollbar-thin overflow-auto", className)} style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full border-separate border-spacing-0 text-base">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => {
              const sortable = col.sortable !== false;
              const active = sort?.key === col.key;
              const Icon = active ? (sort!.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
              return (
                <th
                  key={col.key}
                  scope="col"
                  title={col.title}
                  style={col.width ? { width: col.width } : undefined}
                  aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(
                    "sticky top-0 z-[1] border-b border-border bg-raised text-sm font-medium whitespace-nowrap text-ink-subtle",
                    cellPad,
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggle(col.key)}
                      className={cn("inline-flex items-center gap-1 rounded-chip hover:text-ink", active && "text-ink", col.align === "right" && "flex-row-reverse")}
                    >
                      {col.header}
                      <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const key = rowKey(row);
            const selected = selectedKey === key;
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onRowClick(row)) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-selected={onRowClick ? selected : undefined}
                className={cn(
                  "group",
                  onRowClick && "cursor-pointer outline-none focus-visible:bg-accent-soft",
                  selected ? "bg-accent-soft" : onRowClick && "hover:bg-raised",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "border-b border-border text-ink-muted",
                      cellPad,
                      col.align === "right" ? "tnum text-right" : col.align === "center" ? "text-center" : "text-left",
                    )}
                  >
                    {col.render ? col.render(row) : String(col.value(row) ?? "–")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
