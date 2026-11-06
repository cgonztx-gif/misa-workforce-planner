/** 0 and evenly spaced round ticks covering max: 0, 500, 1k, 1.5k (steps of 1, 2, 2.5 or 5 × 10^n). snippets.md. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => +(i * step).toFixed(10));
}
