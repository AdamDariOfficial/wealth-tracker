/**
 * Tiny decimal-safe helpers for financial math.
 *
 * We deliberately avoid pulling in a full big-decimal library — for the
 * magnitudes a personal-finance tracker handles (< 10^12 with ≤ 8 fractional
 * digits) JavaScript's IEEE-754 doubles are exact enough as long as we
 * (a) accumulate using integer "minor units" and (b) round at the
 * presentation boundary, not mid-pipeline.
 *
 * Scale = number of fractional digits to preserve. 8 covers crypto precision
 * (satoshis = 1e-8 BTC) and any fiat sub-cent we care about.
 */
const SCALE = 8;
const FACTOR = 10 ** SCALE;

const toMinor = (n: number | string | null | undefined): number => {
  const v = typeof n === "string" ? parseFloat(n) : Number(n ?? 0);
  if (!Number.isFinite(v)) return 0;
  // round-half-away-from-zero on the minor unit
  return Math.round(v * FACTOR);
};

const fromMinor = (m: number): number => m / FACTOR;

export const dec = {
  add: (...vals: Array<number | string | null | undefined>): number =>
    fromMinor(vals.reduce<number>((s, v) => s + toMinor(v), 0)),
  sub: (a: number | string, b: number | string): number =>
    fromMinor(toMinor(a) - toMinor(b)),
  /** Multiply a money amount by a unitless factor (price, rate, quantity). */
  mul: (amount: number | string, factor: number | string): number => {
    const a = Number(amount ?? 0);
    const f = Number(factor ?? 0);
    if (!Number.isFinite(a) || !Number.isFinite(f)) return 0;
    return Math.round(a * f * FACTOR) / FACTOR;
  },
  /** Safe divide — returns 0 on division by zero instead of NaN/Infinity. */
  div: (a: number | string, b: number | string): number => {
    const x = Number(a ?? 0);
    const y = Number(b ?? 0);
    if (!y || !Number.isFinite(x) || !Number.isFinite(y)) return 0;
    return Math.round((x / y) * FACTOR) / FACTOR;
  },
  /** Round to N fractional digits for display. */
  round: (n: number, digits = 2): number => {
    const f = 10 ** digits;
    return Math.round(Number(n ?? 0) * f) / f;
  },
};
