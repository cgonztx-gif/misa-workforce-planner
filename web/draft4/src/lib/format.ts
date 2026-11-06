// Number formats (DRAFT4.md 5.12). Never NaN, Infinity, −0, 0.0%, $-0 or "1 blocks".

export const MINUS = "−";

const clean = (n: number) => (Object.is(n, -0) || !Number.isFinite(n) ? 0 : n);

/** Whole number with thousands separators: 2,710. */
export const int = (n: number) => clean(Math.round(n)).toLocaleString("en");

/** As precise as the value: 11,657.5. */
export const num1 = (n: number) => clean(n).toLocaleString("en", { maximumFractionDigits: 1 });

/** Exact money: $377,504 (negative: −$696). */
export const usd = (n: number) => {
  const r = clean(Math.round(n));
  return `${r < 0 ? MINUS : ""}$${Math.abs(r).toLocaleString("en")}`;
};

const trim1 = (s: string) => (s.endsWith(".0") ? s.slice(0, -2) : s);

/** Compact money for tiles and axes: $377.5k, $20k, $1.2M. */
export const usdCompact = (n: number) => {
  const v = clean(n);
  const a = Math.abs(v);
  const sign = v < 0 ? MINUS : "";
  if (a >= 999_950) return `${sign}$${trim1((a / 1e6).toFixed(1))}M`;
  if (a >= 1000) return `${sign}$${trim1((a / 1e3).toFixed(1))}k`;
  return `${sign}$${Math.round(a)}`;
};

/** Compact count for axes: 200, 1.5k. */
export const intCompact = (n: number) => (Math.abs(n) >= 1000 ? `${trim1((n / 1e3).toFixed(1))}k` : int(n));

/**
 * A chance or a service rate, always one decimal: 0.949875 → 95.0%, 0.94595 → 94.6%.
 * null → —, 0 → 0%, under 0.1% → <0.1%. Guard: a below-goal block never prints at or over the goal.
 */
export function chanceText(c: number | null | undefined, belowGoal = false, goal = 0.95): string {
  if (c == null || !Number.isFinite(c)) return "—";
  if (c <= 0) return "0%";
  if (c < 0.001) return "<0.1%";
  let v = Math.round(c * 1000 + 1e-6) / 10;
  if (belowGoal && v >= goal * 100) v = Math.floor(c * 1000) / 10;
  return `${v.toFixed(1)}%`;
}

/** The goal as a whole percent: 95%. */
export const goalText = (goal: number) => `${Math.round(goal * 100)}%`;

/** Signed whole number: +5, −1, ±0. */
export const signed = (n: number) => {
  const r = clean(Math.round(n));
  return r > 0 ? `+${int(r)}` : r < 0 ? `${MINUS}${int(-r)}` : "±0";
};

/** Signed money: +$696, −$1,234, ±$0. */
export const signedUsd = (n: number) => {
  const r = clean(Math.round(n));
  return r > 0 ? `+$${r.toLocaleString("en")}` : r < 0 ? `${MINUS}$${(-r).toLocaleString("en")}` : "±$0";
};

/** Points from a change in a rate: 0.271045 → +27.1 pts. */
export const pts = (d: number) => {
  const v = Math.round(clean(d) * 1000) / 10;
  return v > 0 ? `+${v.toFixed(1)} pts` : v < 0 ? `${MINUS}${(-v).toFixed(1)} pts` : "±0 pts";
};

/** Whole-percent change against a base: +13%. */
export const pctChange = (change: number, base: number) => {
  if (!base) return "";
  const r = clean(Math.round((change / base) * 100));
  return r > 0 ? `+${r}%` : r < 0 ? `${MINUS}${-r}%` : "±0%";
};

/** A tiny base reads as what it was, never a percentage. */
export const wasN = (prev: number, format: (n: number) => string = int) => `was ${format(prev)}`;

/** Share of a total, in percent (snippets.md share). */
export const share = (v: number) => (v === 0 ? "0%" : v < 0.1 ? "<0.1%" : v < 1 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`);

/** Hours, exact: 11,657.5 h. */
export const hoursExact = (n: number) => `${num1(n)} h`;

/** "1 block", "2 blocks". */
export const plural = (n: number, word: string) => `${int(n)} ${word}${Math.round(n) === 1 ? "" : "s"}`;

/** Signed compact money for a board cell: +$696, −$1.2k, ±$0. */
export const signedUsdCompact = (n: number) => {
  const r = Math.round(n);
  return r === 0 ? "±$0" : `${r > 0 ? "+" : MINUS}${usdCompact(Math.abs(r))}`;
};

/** A rate with one decimal: 0.0242 → 2.4%. */
export const pct1 = (x: number) => `${(Math.round(clean(x) * 1000) / 10).toFixed(1)}%`;

/** A signed rate with one decimal: 0.1177 → +11.8%, ±0.0% when it rounds to zero. */
export const signedPct1 = (x: number) => {
  const v = Math.round(clean(x) * 1000) / 10;
  return v > 0 ? `+${v.toFixed(1)}%` : v < 0 ? `${MINUS}${(-v).toFixed(1)}%` : "±0.0%";
};

/** Demand units: workload units, not people, so one decimal. */
export const units1 = (n: number) => clean(n).toLocaleString("en", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
