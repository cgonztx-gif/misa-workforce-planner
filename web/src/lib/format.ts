// Number formatting used across pages. Every figure on screen goes through one of these,
// so units, signs and rounding read the same everywhere.

const MINUS = "−"; // a true minus sign, same width as +

const int0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 1,284 */
export const fmtInt = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "–" : int0.format(Math.round(n)));

/** $412,880, or $412.9K / $1.24M with compact=true */
export function fmtMoney(n: number | null | undefined, compact = false): string {
  if (n == null || Number.isNaN(n)) return "–";
  const abs = Math.abs(n);
  const sign = n < 0 ? MINUS : "";
  if (compact && abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (compact && abs >= 10_000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${int0.format(Math.round(abs))}`;
}

/** 0.957 -> "95.7%" (digits=1) or "96%" (digits=0) */
export function fmtPct(share: number | null | undefined, digits = 1): string {
  if (share == null || Number.isNaN(share)) return "–";
  return `${(share * 100).toFixed(digits)}%`;
}

/** 12,345 h */
export const fmtHours = (n: number | null | undefined) => (n == null ? "–" : `${int0.format(Math.round(n))} h`);

/** 0.83 -> "0.83" */
export const fmtRatio = (n: number | null | undefined) => (n == null ? "–" : n.toFixed(2));

export const fmtDec1 = (n: number | null | undefined) => (n == null ? "–" : dec1.format(n));

/** Prefix a sign: +3, −2, 0. `body` formats the absolute value. */
export function signed(n: number | null | undefined, body: (abs: number) => string = (a) => fmtInt(a)): string {
  if (n == null || Number.isNaN(n)) return "–";
  if (Math.abs(n) < 1e-9) return body(0);
  return `${n > 0 ? "+" : MINUS}${body(Math.abs(n))}`;
}

/** Signed formatters for DeltaChip and tables. */
export const signedInt = (n: number | null | undefined) => signed(n, fmtInt);
export const signedMoney = (n: number | null | undefined, compact = false) => signed(n, (a) => fmtMoney(a, compact));
export const signedHours = (n: number | null | undefined) => signed(n, fmtHours);
/** Percentage-point change: 0.256 -> "+25.6 pts" */
export const signedPts = (share: number | null | undefined, digits = 1) =>
  signed(share == null ? null : share * 100, (a) => `${a.toFixed(digits)} pts`);
/** Relative change: 0.14 -> "+14%" */
export const signedPct = (share: number | null | undefined, digits = 0) =>
  signed(share == null ? null : share * 100, (a) => `${a.toFixed(digits)}%`);

/** "2026-02-14" -> "Sat Feb 14" without timezone drift. */
export function fmtDate(iso: string, withWeekday = true): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    ...(withWeekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
  });
}

export const plural = (n: number, one: string, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`;
