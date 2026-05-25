/**
 * Historical Reconstruction Engine.
 *
 * Transactions are the source of truth; performance_snapshots are just an
 * optimization layer that may not exist for periods predating snapshot
 * capture. When a user imports historical transactions today, charts
 * incorrectly start "today" because no snapshots exist for past dates.
 *
 * This module replays the transaction ledger chronologically to derive
 * virtual snapshot points for any date range, then merges them with real
 * snapshots — preferring real snapshots when present.
 *
 * Pure / framework-agnostic.
 */
import type { Account, Transaction } from "@/hooks/use-ledger";
import { dec } from "./decimal";

export type DailyPoint = {
  date: string;            // YYYY-MM-DD
  netWorth: number;
  liquid: number;          // cash float across all accounts
  invested: number;        // cost basis (positions)
  reconstructed: boolean;  // true when derived from ledger, false from real snapshot
};

export type RealSnapshot = {
  snapshot_date: string;
  net_worth: number;
  cash_value: number;
  trading_value: number;
  crypto_value: number;
  investments_value: number;
};

const utcDay = (iso: string) => iso.slice(0, 10);
const addDay = (d: string, n = 1) => {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/**
 * Replay transactions to compute per-account cash balance and per-(account,asset)
 * quantity & cost basis on every day that had activity.
 *
 * Returns a sparse map of date → DailyPoint covering every day where state
 * changed. Callers can forward-fill across gaps as needed.
 */
export function reconstructFromLedger(
  accounts: Account[],
  txs: Transaction[],
): DailyPoint[] {
  if (txs.length === 0) return [];

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const cashByAccount = new Map<string, number>(); // base currency, sign-aware
  const qtyByPos = new Map<string, number>();      // accountId|assetId -> qty
  const costByPos = new Map<string, number>();     // accountId|assetId -> cost basis

  // current best-known asset price per asset (derived from the transactions
  // that carry asset_price); used to mark holdings to market historically.
  const lastPrice = new Map<string, number>();

  const cashKind = (acc: Account | undefined) => {
    if (!acc) return false;
    return acc.include_in_net_worth !== false && !acc.archived_at;
  };

  const sorted = [...txs]
    .filter((t) => !t.voided_at)
    .sort((a, b) => +new Date(a.execution_timestamp) - +new Date(b.execution_timestamp));

  const points: DailyPoint[] = [];
  let lastDay = "";

  const pushPoint = (day: string) => {
    let liquid = 0;
    for (const [accId, bal] of cashByAccount) {
      if (cashKind(accountById.get(accId))) liquid = dec.add(liquid, bal);
    }
    let invested = 0;
    let marketValue = 0;
    for (const [key, qty] of qtyByPos) {
      if (qty <= 0) continue;
      const [accId, assetId] = key.split("|");
      if (!cashKind(accountById.get(accId))) continue;
      invested = dec.add(invested, costByPos.get(key) ?? 0);
      const px = lastPrice.get(assetId) ?? 0;
      marketValue = dec.add(marketValue, dec.mul(qty, px));
    }
    const netWorth = dec.add(liquid, marketValue);
    points.push({ date: day, netWorth, liquid, invested, reconstructed: true });
  };

  for (const t of sorted) {
    const day = utcDay(t.execution_timestamp);
    const v = Number(t.base_value ?? t.fiat_value ?? 0);
    const fee = Number(t.fee_base_value ?? t.fee_amount ?? 0);
    const src = t.source_account_id;
    const dst = t.destination_account_id;
    const aId = t.asset_id;
    const qty = Number(t.quantity ?? 0);
    const px = Number(t.asset_price ?? (qty ? v / qty : 0));
    if (aId && px > 0) lastPrice.set(aId, px);

    const bumpCash = (accId: string | null | undefined, delta: number) => {
      if (!accId || !delta) return;
      cashByAccount.set(accId, dec.add(cashByAccount.get(accId) ?? 0, delta));
    };
    const posKey = (accId: string, asset: string) => `${accId}|${asset}`;
    const bumpPos = (accId: string, asset: string, dq: number, dc: number) => {
      const k = posKey(accId, asset);
      qtyByPos.set(k, dec.add(qtyByPos.get(k) ?? 0, dq));
      costByPos.set(k, Math.max(0, dec.add(costByPos.get(k) ?? 0, dc)));
    };

    switch (t.transaction_type) {
      case "deposit":
      case "interest":
      case "dividend":
      case "staking_reward":
      case "profit_realization":
      case "manual_adjustment":
        bumpCash(dst, v);
        break;
      case "withdrawal":
      case "fee":
        bumpCash(src, -v);
        break;
      case "transfer":
        bumpCash(src, -v);
        bumpCash(dst, v);
        if (aId && qty > 0 && src && dst) {
          // move quantity + cost basis between accounts
          const srcKey = posKey(src, aId);
          const proportion = Math.min(1, qty / Math.max(qty, qtyByPos.get(srcKey) ?? qty));
          const costMoved = dec.mul(costByPos.get(srcKey) ?? 0, proportion);
          bumpPos(src, aId, -qty, -costMoved);
          bumpPos(dst, aId, qty, costMoved);
        }
        break;
      case "buy":
      case "convert":
        if (src) bumpCash(src, -v);
        if (dst && aId) bumpPos(dst, aId, qty, v);
        break;
      case "sell":
        if (dst) bumpCash(dst, v);
        if (src && aId) {
          const k = posKey(src, aId);
          const curQ = qtyByPos.get(k) ?? 0;
          const curC = costByPos.get(k) ?? 0;
          const avg = curQ > 0 ? curC / curQ : 0;
          const costOut = dec.mul(avg, Math.min(qty, curQ));
          bumpPos(src, aId, -qty, -costOut);
        }
        break;
    }
    if (fee && src) bumpCash(src, -fee);

    if (day !== lastDay && lastDay !== "") {
      pushPoint(lastDay);
    }
    lastDay = day;
  }
  if (lastDay) pushPoint(lastDay);

  // collapse to one point per day (last write wins for that day)
  const byDay = new Map<string, DailyPoint>();
  for (const p of points) byDay.set(p.date, p);
  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Merge real snapshots and reconstructed ledger points into one continuous
 * daily series. Real snapshots win where they exist; reconstructed points
 * fill gaps before the first snapshot or between sparse snapshots.
 */
export function buildHybridTimeline(
  accounts: Account[],
  txs: Transaction[],
  snapshots: RealSnapshot[],
  opts: { forwardFill?: boolean } = {},
): DailyPoint[] {
  const reconstructed = reconstructFromLedger(accounts, txs);
  const byDay = new Map<string, DailyPoint>();

  for (const p of reconstructed) byDay.set(p.date, p);
  for (const s of snapshots) {
    byDay.set(s.snapshot_date, {
      date: s.snapshot_date,
      netWorth: Number(s.net_worth),
      liquid: Number(s.cash_value) + Number(s.trading_value),
      invested: Number(s.investments_value) + Number(s.crypto_value),
      reconstructed: false,
    });
  }

  const sorted = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  if (!opts.forwardFill || sorted.length < 2) return sorted;

  // Forward-fill between dates so the chart has continuous daily granularity.
  const out: DailyPoint[] = [];
  for (let i = 0; i < sorted.length; i++) {
    out.push(sorted[i]);
    const next = sorted[i + 1];
    if (!next) break;
    let d = addDay(sorted[i].date);
    while (d < next.date) {
      out.push({ ...sorted[i], date: d, reconstructed: true });
      d = addDay(d);
    }
  }
  return out;
}
