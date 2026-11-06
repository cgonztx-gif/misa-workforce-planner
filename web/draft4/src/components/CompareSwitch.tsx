/** The showcase's "Compare with the period before" switch: 32 × 18, accent when on, off by default. */
export function CompareSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      data-tip="Draft beside the plan · board and detail · By day always shows it"
      className="group inline-flex shrink-0 items-center gap-2.5 rounded-full text-[13.5px] text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className={`relative h-[18px] w-8 rounded-full transition-colors forced-colors:border forced-colors:border-[CanvasText] ${on ? "bg-accent forced-colors:bg-[Highlight]" : "bg-line-strong"}`}>
        <span className={`absolute top-[2px] size-[14px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/.2)] transition-[left] forced-colors:top-[1px] forced-colors:bg-[CanvasText] ${on ? "left-[16px] forced-colors:left-[15px]" : "left-[2px] forced-colors:left-[1px]"}`} />
      </span>
      <span className="whitespace-nowrap">Compare with draft</span>
    </button>
  );
}
