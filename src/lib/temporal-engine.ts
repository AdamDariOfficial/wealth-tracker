/**
 * Temporal Intelligence Engine.
 *
 * Aggregates ledger transactions into period buckets (day / week / month /
 * quarter / year) and pairs them with reconstructed portfolio state from
 * the history-reconstruction engine. Pure, framework-agnostic, decimal-safe.
 *
 * Transactions remain the single source of truth.
 */
import type { Account, Asset, Transaction } from "@/hooks/use-ledger";
import { dec } from "./decimal";
import { reconstructFromLedger, type DailyPoint } from "./history-reconstruction";

export const POS_TYPES = new Set([
  "deposit", "sell", "dividend", "interest", "staking_reward", "profit_realization",
]);
export const NEG_TYPES = new Set(["withdrawal", "fee", "buy"]);
export const NEUTRAL_TYPES = new Set(["transfer", "convert", "manual_adjustment"]);

export type PeriodKey = "day" | "week" | "month" | "quarter" | "year";

export type PeriodBucket = {
  key: string;                // canonical key, e.g. "2026-05" or "2026-W21"
  label: string;              // display label
  start: Date;
  end: Date;                  // exclusive
  inflow: number;
  outflow: number;
  net: number;
  count: number;
  txs: Transaction[];
  // intelligence
  contributions: number;      // explicit deposits to investment/exchange/broker
  trades: number;             // buy + sell count
  byAsset: Map<string, { qty: number; pnl: number; symbol: string }>;
  // streak / cadence
  activeDays: number;
};

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d: Date) => {
  const x = startOfDay(d); const w = x.getDay();
  return addDays(x, -((w + 6) % 7)); // Monday start
};
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const startOfQuarter = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
export const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export function periodBounds(view: PeriodKey, anchor: Date): { start: Date; end: Date } {
  if (view === "day")     { const s = startOfDay(anchor);     return { start: s, end: addDays(s, 1) }; }
  if (view === "week")    { const s = startOfWeek(anchor);    return { start: s, end: addDays(s, 7) }; }
  if (view === "month")   { const s = startOfMonth(anchor);   return { start: s, end: addMonths(s, 1) }; }
  if (view === "quarter") { const s = startOfQuarter(anchor); return { start: s, end: addMonths(s, 3) }; }
  /* year */               const s = startOfYear(anchor);     return { start: s, end: addMonths(s, 12) };
}

function emptyBucket(key: string, label: string, start: Date, end: Date): PeriodBucket {
  return {
    key, label, start, end,
    inflow: 0, outflow: 0, net: 0, count: 0,
    txs: [], contributions: 0, trades: 0,
    byAsset: new Map(), activeDays: 0,
  };
}

function classifyValue(t: Transaction): number {
  return Number(t.base_value ?? t.fiat_value ?? 0);
}

function ingest(b: PeriodBucket, t: Transaction, assetSym: (id: string | null) => string) {
  if (t.voided_at) return;
  const v = classifyValue(t);
  b.txs.push(t);
  b.count += 1;
  if (POS_TYPES.has(t.transaction_type)) { b.inflow += v; b.net += v; }
  else if (NEG_TYPES.has(t.transaction_type)) { b.outflow += v; b.net -= v; }
  if (t.transaction_type === "buy" || t.transaction_type === "sell") b.trades += 1;
  if (t.transaction_type === "deposit") b.contributions += v;
  if (t.asset_id) {
    const cur = b.byAsset.get(t.asset_id) ?? { qty: 0, pnl: 0, symbol: assetSym(t.asset_id) };
    cur.qty = dec.add(cur.qty, Number(t.quantity ?? 0));
    if (t.transaction_type === "sell" || t.transaction_type === "profit_realization") cur.pnl += v;
    b.byAsset.set(t.asset_id, cur);
  }
}

/** Group txs into N month buckets covering the given year. */
export function buildYearBuckets(
  year: number, txs: Transaction[], assets: Asset[],
): PeriodBucket[] {
  const sym = (id: string | null) => assets.find((a) => a.id === id)?.symbol ?? "";
  const months: PeriodBucket[] = Array.from({ length: 12 }, (_, i) => {
    const s = new Date(year, i, 1);
    const e = new Date(year, i + 1, 1);
    return emptyBucket(
      `${year}-${pad(i + 1)}`,
      s.toLocaleDateString(undefined, { month: "short" }),
      s, e,
    );
  });
  const activeDayPerMonth: Set<string>[] = Array.from({ length: 12 }, () => new Set());
  for (const t of txs) {
    const d = new Date(t.execution_timestamp);
    if (d.getFullYear() !== year) continue;
    const m = d.getMonth();
    ingest(months[m], t, sym);
    activeDayPerMonth[m].add(dayKey(d));
  }
  months.forEach((b, i) => { b.activeDays = activeDayPerMonth[i].size; });
  return months;
}

export function buildQuarterMonths(
  anchor: Date, txs: Transaction[], assets: Asset[],
): PeriodBucket[] {
  const qs = startOfQuarter(anchor);
  const sym = (id: string | null) => assets.find((a) => a.id === id)?.symbol ?? "";
  const arr: PeriodBucket[] = Array.from({ length: 3 }, (_, i) => {
    const s = new Date(qs.getFullYear(), qs.getMonth() + i, 1);
    const e = new Date(qs.getFullYear(), qs.getMonth() + i + 1, 1);
    return emptyBucket(
      `${s.getFullYear()}-${pad(s.getMonth() + 1)}`,
      s.toLocaleDateString(undefined, { month: "long" }),
      s, e,
    );
  });
  const seen = arr.map(() => new Set<string>());
  for (const t of txs) {
    const d = new Date(t.execution_timestamp);
    const idx = arr.findIndex((b) => d >= b.start && d < b.end);
    if (idx < 0) continue;
    ingest(arr[idx], t, sym);
    seen[idx].add(dayKey(d));
  }
  arr.forEach((b, i) => { b.activeDays = seen[i].size; });
  return arr;
}

export function buildMonthDays(
  anchor: Date, txs: Transaction[], assets: Asset[],
): PeriodBucket[] {
  const ms = startOfMonth(anchor);
  const me = addMonths(ms, 1);
  const sym = (id: string | null) => assets.find((a) => a.id === id)?.symbol ?? "";
  const days: PeriodBucket[] = [];
  for (let d = new Date(ms); d < me; d = addDays(d, 1)) {
    const s = new Date(d); const e = addDays(s, 1);
    days.push(emptyBucket(dayKey(s), String(s.getDate()), s, e));
  }
  for (const t of txs) {
    const td = new Date(t.execution_timestamp);
    if (td < ms || td >= me) continue;
    const idx = td.getDate() - 1;
    ingest(days[idx], t, sym);
    days[idx].activeDays = 1;
  }
  return days;
}

export function buildWeekDays(
  anchor: Date, txs: Transaction[], assets: Asset[],
): PeriodBucket[] {
  const ws = startOfWeek(anchor);
  const we = addDays(ws, 7);
  const sym = (id: string | null) => assets.find((a) => a.id === id)?.symbol ?? "";
  const days: PeriodBucket[] = [];
  for (let i = 0; i < 7; i++) {
    const s = addDays(ws, i); const e = addDays(s, 1);
    days.push(emptyBucket(
      dayKey(s),
      s.toLocaleDateString(undefined, { weekday: "short" }),
      s, e,
    ));
  }
  for (const t of txs) {
    const td = new Date(t.execution_timestamp);
    if (td < ws || td >= we) continue;
    const idx = Math.floor((+startOfDay(td) - +ws) / 86_400_000);
    if (idx < 0 || idx > 6) continue;
    ingest(days[idx], t, sym);
    days[idx].activeDays = 1;
  }
  return days;
}

/** Reconstruct net-worth point closest to (but ≤) the given date. */
export function netWorthAt(points: DailyPoint[], target: Date): DailyPoint | null {
  const tk = dayKey(target);
  let best: DailyPoint | null = null;
  for (const p of points) {
    if (p.date <= tk) best = p; else break;
  }
  return best;
}

/** Lightweight reconstruction wrapper. */
export function reconstruct(accounts: Account[], txs: Transaction[]): DailyPoint[] {
  return reconstructFromLedger(accounts, txs);
}

/** Years that contain at least one transaction (for the scrubber). */
export function activeYears(txs: Transaction[]): number[] {
  const set = new Set<number>();
  for (const t of txs) {
    if (t.voided_at) continue;
    set.add(new Date(t.execution_timestamp).getFullYear());
  }
  const now = new Date().getFullYear();
  set.add(now);
  return Array.from(set).sort((a, b) => a - b);
}

/** Detect simple behavioral insights from a list of period buckets. */
export function deriveInsights(periods: PeriodBucket[]): string[] {
  const out: string[] = [];
  if (periods.length === 0) return out;
  const net = periods.map((p) => p.net);
  const best = periods.reduce((a, b) => (b.net > a.net ? b : a));
  const worst = periods.reduce((a, b) => (b.net < a.net ? b : a));
  if (best.net > 0) out.push(`Strongest period: ${best.label} (+${Math.round(best.net).toLocaleString()})`);
  if (worst.net < 0) out.push(`Weakest period: ${worst.label} (${Math.round(worst.net).toLocaleString()})`);

  const active = periods.filter((p) => p.activeDays > 0).length;
  if (active && periods.length >= 4) {
    const ratio = active / periods.length;
    if (ratio >= 0.8) out.push(`High operational cadence — active in ${active}/${periods.length} periods`);
    else if (ratio <= 0.3) out.push(`Sparse activity — only ${active}/${periods.length} periods active`);
  }

  const totalTrades = periods.reduce((s, p) => s + p.trades, 0);
  const totalContrib = periods.reduce((s, p) => s + p.contributions, 0);
  if (totalContrib > 0 && periods.length >= 6) {
    const monthsWithContrib = periods.filter((p) => p.contributions > 0).length;
    if (monthsWithContrib / periods.length >= 0.6) {
      out.push(`Consistent capital deployment — contributions in ${monthsWithContrib}/${periods.length} periods`);
    }
  }
  if (totalTrades > periods.length * 3) {
    out.push(`Elevated trading frequency — ${totalTrades} executions across ${periods.length} periods`);
  }
  // streak of consecutive positive periods
  let streak = 0, maxStreak = 0;
  for (const v of net) {
    if (v > 0) { streak += 1; maxStreak = Math.max(maxStreak, streak); }
    else streak = 0;
  }
  if (maxStreak >= 3) out.push(`Positive streak of ${maxStreak} consecutive periods`);
  return out;
}
