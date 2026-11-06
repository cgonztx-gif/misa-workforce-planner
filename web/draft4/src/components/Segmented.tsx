import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface SegItem<T extends string> {
  value: T;
  label: ReactNode;
  /** The full name, for title (the label may be shortened by a container query). */
  title: string;
  tip?: string;
  disabled?: boolean;
}

/** components.md "Tabs inside a panel": a pill track that shrinks and truncates, never scrolls. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  className = "",
  dense = false,
}: {
  items: SegItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  /** Narrow cards: tighter items until the container reaches 26rem. */
  dense?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = items.filter((i) => !i.disabled);

  const onKey = (e: KeyboardEvent) => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const at = enabled.findIndex((i) => i.value === value);
    let next = at;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    else next = (at + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + enabled.length) % enabled.length;
    const v = enabled[next].value;
    onChange(v);
    refs.current[items.findIndex((i) => i.value === v)]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className={`inline-flex h-9 min-w-0 max-w-full items-center rounded-full bg-soft p-1 ${className}`}>
      {items.map((it, i) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={it.title}
            tabIndex={on ? 0 : -1}
            disabled={it.disabled}
            data-tip={it.tip}
            onClick={() => onChange(it.value)}
            className={`h-7 min-w-0 truncate rounded-full whitespace-nowrap ${dense ? "px-1.5 text-[12px] @min-[24rem]:px-2.5 @min-[24rem]:text-[12.5px] @min-[28rem]:px-3.5 @min-[28rem]:text-[13px]" : "px-3.5 text-[13px]"} transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-40 ${
              on ? "bg-card font-medium text-ink shadow-[var(--shadow-pill)] forced-colors:outline-2 forced-colors:outline-[Highlight]" : "text-ink-2 hover:text-ink"
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
