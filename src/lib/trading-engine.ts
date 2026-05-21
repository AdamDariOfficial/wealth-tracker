/**
 * Trading analytics engine.
 *
 * Pure, framework-agnostic derivation of trading-workspace metrics from
 * canonical sources (transactions ledger + immutable weekly reports +
 * broker account balances). No mutable frontend state — all callers must
 * pass already-loaded rows.
 *
 * Architectural rules (preserved here):
 *   - Capital movements (deposit/withdrawal/transfer to broker accounts)
 *     are NEVER mixed into performance series.
 *   - Performance equity curve = cumulative realized P&L from
 *     `profit_realization` ledger transactions + weekly_reports.pnl
 *     (the latter only when no posted_transaction_id, to avoid double-count).
 *   - Capital-inclusive equity curve = cumulative net flow into broker
 *     accounts + performance series.
 *   - Weekly snapshots are read-only after `finalized_at`.
 */
import { dec } from "@/lib/decimal";
import type { Account, Transaction } from "@/hooks/use-ledger";

export type WeeklyReport = {
  id: string;
  week_start: string;            // YYYY-MM-DD
  pnl: number;
  winrate: number;
  avg_rr: number;
  num_trades: number;
  max_drawdown: number;
  discipline_score: number;
  psychology_score: number;
  consistency_score: number;
  notes: string | null;
  lessons: string | null;
  is_draft: boolean;
  screenshots: string[];
  broker_account_id: string | null;
  posted_transaction_id: string | null;
  finalized_at: string | null;
};

export type EquityPoint = {
  /** ISO date (UTC day) */
  date: string;
  /** Performance-only (excludes capital flows) */
  performance: number;
  /** Performance + cumulative net capital deposited */
  total: number;
  /** Cumulative net capital flow only */
  capital: number;
};

export type CapitalMovement = {
  id: string;
  date: string;
  kind: "deposit" | "withdrawal" | "transfer_in" | "transfer_out";
  accountId: string;
  amount: number;       // signed: + inflow / - outflow into trading capital
  note: string | null;
};

export type TradingMetrics = {
  // Capital
  capitalDeposited: number;
  capitalWithdrawn: number;
  netCapital: number;
  currentCapital: number;
  // Performance
  realizedPnl: number;
  pctReturn: number;       // realizedPnl / netCapital
  // Weekly aggregates
  winRate: number;
  avgRR: number;
  maxDrawdown: number;
  totalTrades: number;
  consistencyScore: number;
  weeklyCount: number;
};

const utcDay = (iso: string) => iso.slice(0, 10);

/** Identify accounts that constitute "trading capital". */
export function isTradingAccount(a: Pick<Account, "type">): boolean {
  return a.type === "broker" || a.type === "exchange" || a.type === "investment";
}

/** Extract capital movements affecting trading accounts. */
export function extractCapitalMovements(
  txs: Transaction[],
  accounts: Account[],
): CapitalMovement[] {
  const tradingIds = new Set(accounts.filter(isTradingAccount).map((a) => a.id));
  const out: CapitalMovement[] = [];
  for (const t of txs) {
    if (t.voided_at) continue;
    const amount = Number(t.base_value ?? t.fiat_value ?? 0);
    if (!amount) continue;
    const dst = t.destination_account_id;
    const src = t.source_account_id;

    if (t.transaction_type === "deposit" && dst && tradingIds.has(dst)) {
      out.push({ id: t.id, date: utcDay(t.execution_timestamp), kind: "deposit", accountId: dst, amount, note: t.note });
    } else if (t.transaction_type === "withdrawal" && src && tradingIds.has(src)) {
      out.push({ id: t.id, date: utcDay(t.execution_timestamp), kind: "withdrawal", accountId: src, amount: -amount, note: t.note });
    } else if (t.transaction_type === "transfer") {
      const dstTrading = !!dst && tradingIds.has(dst);
      const srcTrading = !!src && tradingIds.has(src);
      // Only count if one side is trading and the other isn't (pure capital flow).
      if (dstTrading && !srcTrading) {
        out.push({ id: t.id, date: utcDay(t.execution_timestamp), kind: "transfer_in", accountId: dst!, amount, note: t.note });
      } else if (srcTrading && !dstTrading) {
        out.push({ id: t.id, date: utcDay(t.execution_timestamp), kind: "transfer_out", accountId: src!, amount: -amount, note: t.note });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Extract realized P&L events from the ledger (profit_realization). */
export function extractRealizedPnlEvents(
  txs: Transaction[],
  accounts: Account[],
): { date: string; amount: number; txId: string }[] {
  const tradingIds = new Set(accounts.filter(isTradingAccount).map((a) => a.id));
  const out: { date: string; amount: number; txId: string }[] = [];
  for (const t of txs) {
    if (t.voided_at) continue;
    if (t.transaction_type !== "profit_realization") continue;
    const acc = t.destination_account_id ?? t.source_account_id;
    if (!acc || !tradingIds.has(acc)) continue;
    out.push({
      date: utcDay(t.execution_timestamp),
      amount: Number(t.base_value ?? t.fiat_value ?? 0),
      txId: t.id,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Build equity curve.
 * - Performance series: cumulative sum of realized P&L (ledger) + weekly P&L
 *   rows that are NOT already represented as posted transactions.
 * - Capital series: cumulative net capital flow.
 * - Total = capital + performance.
 */
export function buildEquityCurve(
  txs: Transaction[],
  accounts: Account[],
  weekly: WeeklyReport[],
): EquityPoint[] {
  const realized = extractRealizedPnlEvents(txs, accounts);
  const capital = extractCapitalMovements(txs, accounts);
  const weeklyPerf = weekly
    .filter((w) => !w.posted_transaction_id && Number(w.pnl) !== 0)
    .map((w) => ({ date: w.week_start, amount: Number(w.pnl) }));

  const byDate = new Map<string, { perf: number; cap: number }>();
  const bump = (date: string, perf = 0, cap = 0) => {
    const v = byDate.get(date) ?? { perf: 0, cap: 0 };
    v.perf = dec.add(v.perf, perf);
    v.cap = dec.add(v.cap, cap);
    byDate.set(date, v);
  };
  for (const e of realized)    bump(e.date, e.amount, 0);
  for (const e of weeklyPerf)  bump(e.date, e.amount, 0);
  for (const e of capital)     bump(e.date, 0, e.amount);

  const dates = Array.from(byDate.keys()).sort();
  const out: EquityPoint[] = [];
  let perf = 0, cap = 0;
  for (const d of dates) {
    const v = byDate.get(d)!;
    perf = dec.add(perf, v.perf);
    cap = dec.add(cap, v.cap);
    out.push({ date: d, performance: perf, capital: cap, total: dec.add(perf, cap) });
  }
  return out;
}

export function computeTradingMetrics(
  txs: Transaction[],
  accounts: Account[],
  weekly: WeeklyReport[],
): TradingMetrics {
  const tradingAccounts = accounts.filter(isTradingAccount);
  const currentCapital = tradingAccounts.reduce((s, a) => dec.add(s, Number(a.current_balance ?? 0)), 0);

  const moves = extractCapitalMovements(txs, accounts);
  let capitalDeposited = 0, capitalWithdrawn = 0;
  for (const m of moves) {
    if (m.amount > 0) capitalDeposited = dec.add(capitalDeposited, m.amount);
    else capitalWithdrawn = dec.add(capitalWithdrawn, -m.amount);
  }
  const netCapital = dec.add(capitalDeposited, -capitalWithdrawn);

  const realized = extractRealizedPnlEvents(txs, accounts)
    .reduce((s, e) => dec.add(s, e.amount), 0);
  const weeklyUnpostedPnl = weekly
    .filter((w) => !w.posted_transaction_id)
    .reduce((s, w) => dec.add(s, Number(w.pnl ?? 0)), 0);
  const realizedPnl = dec.add(realized, weeklyUnpostedPnl);

  const pctReturn = netCapital > 0 ? (realizedPnl / netCapital) * 100 : 0;

  const w = weekly;
  const winRate = w.length ? w.reduce((s, r) => s + Number(r.winrate ?? 0), 0) / w.length : 0;
  const avgRR = w.length ? w.reduce((s, r) => s + Number(r.avg_rr ?? 0), 0) / w.length : 0;
  const maxDrawdown = w.reduce((m, r) => Math.max(m, Number(r.max_drawdown ?? 0)), 0);
  const totalTrades = w.reduce((s, r) => s + Number(r.num_trades ?? 0), 0);
  const consistencyScore = w.length
    ? Math.round(w.reduce((s, r) => s + Number(r.consistency_score ?? 0), 0) / w.length)
    : 0;

  return {
    capitalDeposited,
    capitalWithdrawn,
    netCapital,
    currentCapital,
    realizedPnl,
    pctReturn,
    winRate,
    avgRR,
    maxDrawdown,
    totalTrades,
    consistencyScore,
    weeklyCount: w.length,
  };
}

/** Consistency formula (used when authoring a new weekly report). */
export function computeConsistency(r: {
  discipline_score: number;
  psychology_score: number;
  max_drawdown: number;
  winrate: number;
}): number {
  const ddPenalty = Math.min(40, Math.abs(r.max_drawdown));
  const base = (r.discipline_score + r.psychology_score) / 2;
  const winBonus = Math.min(20, r.winrate / 5);
  return Math.max(0, Math.min(100, Math.round(base + winBonus - ddPenalty / 2)));
}
