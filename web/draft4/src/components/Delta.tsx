/**
 * A tile's delta: sign always shown, coloured by meaning, not by direction: "good" green (service up, below goal down),
 * "bad" red (service down, below goal up, cost up: cost is lower-is-better), grey for neutral volume (People) and tiny bases.
 * Red text is bad-strong: bad itself is 4.6:1 on the card and under 4.5:1 on the selected tile's tint.
 */
export function Delta({ text, tone }: { text: string; tone: "good" | "bad" | "grey" }) {
  if (!text) return null;
  const cls = tone === "good" ? "text-good" : tone === "bad" ? "text-bad-strong" : "text-muted";
  return <span className={`shrink-0 text-[12px] font-medium tnum ${cls}`}>{text}</span>;
}
