/** A tile's delta: sign always shown, coloured by meaning (or grey for volume and the deliberate cost trade). */
export function Delta({ text, tone }: { text: string; tone: "up" | "down" | "grey" }) {
  if (!text) return null;
  const cls = tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted";
  return <span className={`shrink-0 text-[12px] font-medium tnum ${cls}`}>{text}</span>;
}
