/**
 * FX engine. Converts amounts between currencies using a cached snapshot of
 * the `fx_rates` table. All rates are stored as (base, quote) → rate, meaning
 * `1 unit of base = rate units of quote`. Fallback chain:
 *
 *   1. direct rate    (from → to)
 *   2. inverse rate   (to   → from), use 1/rate
 *   3. triangulate via USD
 *   4. identity (1:1) if currencies match
 *   5. otherwise return the input amount unchanged and flag (caller decides)
 *
 * The engine is intentionally synchronous so the React render pipeline can
 * call `convert()` from memoized selectors without async cascades. Loading
 * the rate table is a separate step (see `useFxRates`).
 */
import { dec } from "./decimal";

export type FxRate = {
  base: string;
  quote: string;
  rate: number;
  as_of: string; // ISO timestamp
};

export type FxTable = {
  /** key = `${base}:${quote}` → most recent rate. */
  byPair: Map<string, FxRate>;
};

export const emptyFxTable = (): FxTable => ({ byPair: new Map() });

export function buildFxTable(rows: FxRate[]): FxTable {
  const byPair = new Map<string, FxRate>();
  // rows can come in any order — keep the newest per pair.
  for (const r of rows) {
    const key = `${r.base}:${r.quote}`;
    const prev = byPair.get(key);
    if (!prev || +new Date(r.as_of) > +new Date(prev.as_of)) byPair.set(key, r);
  }
  return { byPair };
}

const lookup = (t: FxTable, base: string, quote: string): number | null => {
  if (base === quote) return 1;
  const direct = t.byPair.get(`${base}:${quote}`);
  if (direct) return Number(direct.rate);
  const inverse = t.byPair.get(`${quote}:${base}`);
  if (inverse && Number(inverse.rate) > 0) return 1 / Number(inverse.rate);
  return null;
};

/**
 * Convert `amount` from `from` to `to`. Returns the converted amount.
 * If no rate is known, falls back to returning `amount` unchanged — the
 * caller can decide whether to surface a "missing rate" warning.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  table: FxTable,
): number {
  if (!amount) return 0;
  const f = (from || "USD").toUpperCase();
  const t = (to || "USD").toUpperCase();
  if (f === t) return amount;

  const direct = lookup(table, f, t);
  if (direct != null) return dec.mul(amount, direct);

  // Triangulate via USD
  const fToUsd = lookup(table, f, "USD");
  const usdToT = lookup(table, "USD", t);
  if (fToUsd != null && usdToT != null) {
    return dec.mul(dec.mul(amount, fToUsd), usdToT);
  }

  return amount; // best effort: unchanged
}

/** Return true if a conversion would actually require a rate lookup. */
export const needsConversion = (a: string, b: string) =>
  (a || "USD").toUpperCase() !== (b || "USD").toUpperCase();
