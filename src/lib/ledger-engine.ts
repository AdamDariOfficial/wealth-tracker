/**
 * Pure ledger engine — the single source of truth for every derived
 * financial number in the app. Takes raw rows from the database and
 * returns deterministic, decimal-safe aggregates.
 *
 *   computeLedger({ accounts, assets, transactions, fxTable, baseCurrency })
 *     → { holdings, accountValue, totals, allocation }
 *
 * Rules enforced here, not in callers:
 *
 *   • Transactions are processed in chronological UTC order.
 *   • Avg-cost is tracked per (account, asset) pair.
 *   • Transfers move quantity AND cost basis between accounts (no realized
 *     P&L, no double-count of cash — `recompute_account_balance` already
 *     debits the source and credits the destination on the cash side).
 *   • Every fiat amount is normalized to `baseCurrency` via the FX table,
 *     preferring the transaction's stored `base_value` when present.
 *   • All sums use the decimal helper to avoid float drift.
 *
 * This module is framework-agnostic — no React, no Supabase imports — so it
 * can be unit-tested with synthetic ledgers.
 */
import type { Account, Asset, Transaction } from "@/hooks/use-ledger";
import { dec } from "./decimal";
import { convert, type FxTable, emptyFxTable } from "./fx";

export type EngineHolding = {
  accountId: string;
  assetId: string;
  quantity: number;
  avgCost: number;        // in baseCurrency, per unit
  costBasis: number;      // in baseCurrency
  marketValue: number;    // in baseCurrency
  unrealizedPnl: number;  // in baseCurrency
  realizedPnl: number;    // in baseCurrency, lifetime
};

export type EngineTotals = {
  netWorth: number;
  liquid: number;
  invested: number;
  realized: number;
  unrealized: number;
};

export type EngineInput = {
  accounts: Account[];
  assets: Asset[];
  transactions: Transaction[];
  fxTable?: FxTable;
  baseCurrency?: string;
};

export type EngineOutput = {
  holdings: EngineHolding[];
  /** accountId → sum of positions market value (in base currency). */
  accountValue: Map<string, number>;
  totals: EngineTotals;
  /** Per-account base-currency cash float (already trigger-maintained, but
   *  re-derived here for reconciliation). */
  computedCashByAccount: Map<string, number>;
};

const EPSILON = 1e-9;

/** Read the base-currency value of a transaction, falling back to FX-converted
 *  fiat_value when the new columns haven't been backfilled yet. */
function txBaseValue(t: Transaction, fx: FxTable, base: string): number {
  const stored = (t as any).base_value;
  const storedBaseCcy = (t as any).base_currency as string | undefined;
  if (stored != null && storedBaseCcy) {
    return convert(Number(stored), storedBaseCcy, base, fx);
  }
  // Legacy row: assume fiat_value is in the user's base currency.
  return Number(t.fiat_value || 0);
}

export function computeLedger(input: EngineInput): EngineOutput {
  const { accounts, assets, transactions } = input;
  const fx = input.fxTable ?? emptyFxTable();
  const base = (input.baseCurrency ?? "USD").toUpperCase();

  const assetById = new Map(assets.map((a) => [a.id, a]));

  type Bucket = {
    accountId: string;
    assetId: string;
    qty: number;
    cost: number;       // base-ccy total cost basis
    realizedPnl: number;
  };
  const buckets = new Map<string, Bucket>();
  const bkey = (a: string, s: string) => `${a}::${s}`;
  const ensure = (acc: string, asset: string): Bucket => {
    const k = bkey(acc, asset);
    let b = buckets.get(k);
    if (!b) {
      b = { accountId: acc, assetId: asset, qty: 0, cost: 0, realizedPnl: 0 };
      buckets.set(k, b);
    }
    return b;
  };

  // chronological UTC order; skip voided rows defensively (the query layer
  // already filters them, but the engine is the authoritative gate).
  const sorted = [...transactions]
    .filter((t) => !(t as any).voided_at)
    .sort(
      (a, b) => +new Date(a.execution_timestamp) - +new Date(b.execution_timestamp),
    );


  const cash = new Map<string, number>();
  const addCash = (id: string | null | undefined, delta: number) => {
    if (!id) return;
    cash.set(id, dec.add(cash.get(id) ?? 0, delta));
  };

  for (const t of sorted) {
    const baseVal = txBaseValue(t, fx, base);
    const qty = Number(t.quantity || 0);
    const pxPerUnit = qty ? baseVal / qty : 0;

    switch (t.transaction_type) {
      case "deposit":
      case "interest":
      case "profit_realization":
      case "manual_adjustment":
        addCash(t.destination_account_id, baseVal);
        break;

      case "withdrawal":
      case "fee":
        addCash(t.source_account_id, -baseVal);
        break;

      case "dividend":
      case "staking_reward": {
        // Cash side
        addCash(t.destination_account_id, baseVal);
        // If tied to an asset, also a realized gain on that asset
        if (t.asset_id && t.destination_account_id) {
          const b = ensure(t.destination_account_id, t.asset_id);
          b.realizedPnl = dec.add(b.realizedPnl, baseVal);
        }
        break;
      }

      case "buy": {
        addCash(t.source_account_id, -baseVal);
        if (t.asset_id && t.destination_account_id) {
          const b = ensure(t.destination_account_id, t.asset_id);
          b.qty = dec.add(b.qty, qty);
          b.cost = dec.add(b.cost, dec.mul(qty, pxPerUnit));
        }
        break;
      }

      case "sell": {
        addCash(t.destination_account_id, baseVal);
        if (t.asset_id && t.source_account_id) {
          const b = ensure(t.source_account_id, t.asset_id);
          const avg = b.qty > EPSILON ? b.cost / b.qty : 0;
          const sold = Math.min(qty, b.qty);
          b.realizedPnl = dec.add(b.realizedPnl, dec.mul(sold, pxPerUnit - avg));
          b.cost = dec.sub(b.cost, dec.mul(sold, avg));
          b.qty = dec.sub(b.qty, sold);
        }
        break;
      }

      case "transfer": {
        // Cash side: only fires for fiat asset transfers (or when asset_id is null).
        // For asset transfers, the cash movement is the wallet→wallet of the asset
        // itself, not base-currency cash. We move quantity + cost basis between
        // accounts without touching cash to avoid double-counting net worth.
        if (!t.asset_id) {
          addCash(t.source_account_id, -baseVal);
          addCash(t.destination_account_id, baseVal);
        } else if (t.source_account_id) {
          const b = ensure(t.source_account_id, t.asset_id);
          const avg = b.qty > EPSILON ? b.cost / b.qty : 0;
          const moved = Math.min(qty, b.qty);
          b.qty = dec.sub(b.qty, moved);
          b.cost = dec.sub(b.cost, dec.mul(moved, avg));
          if (t.destination_account_id) {
            const d = ensure(t.destination_account_id, t.asset_id);
            d.qty = dec.add(d.qty, moved);
            d.cost = dec.add(d.cost, dec.mul(moved, avg));
          }
        }
        break;
      }

      case "convert":
        // Treated as sell on source side, buy on destination side — caller
        // should split into two rows. No-op here to avoid corrupting basis.
        break;

      default:
        break;
    }
  }

  // Materialize holdings
  const holdings: EngineHolding[] = [];
  const accountValue = new Map<string, number>();
  for (const b of buckets.values()) {
    const asset = assetById.get(b.assetId);
    const livePrice = Number(asset?.current_price ?? 0);
    const avg = b.qty > EPSILON ? b.cost / b.qty : 0;
    const price = livePrice > 0 ? livePrice : avg;
    const marketValue = dec.mul(b.qty, price);
    if (Math.abs(b.qty) < EPSILON && b.realizedPnl === 0) continue;
    holdings.push({
      accountId: b.accountId,
      assetId: b.assetId,
      quantity: b.qty,
      avgCost: avg,
      costBasis: b.cost,
      marketValue,
      unrealizedPnl: dec.sub(marketValue, b.cost),
      realizedPnl: b.realizedPnl,
    });
    accountValue.set(b.accountId, dec.add(accountValue.get(b.accountId) ?? 0, marketValue));
  }

  // Totals — cash side uses the DB-trigger-maintained `current_balance`
  // (already in base currency) so the displayed net worth matches the
  // ledger's authoritative balance. The engine's `computedCashByAccount`
  // is exposed separately for reconciliation.
  let netWorth = 0, liquid = 0, invested = 0, realized = 0, unrealized = 0;
  for (const acc of accounts) {
    if (!acc.include_in_net_worth || acc.archived_at) continue;
    const cashBal = Number(acc.current_balance ?? 0);
    const positions = accountValue.get(acc.id) ?? 0;
    const v = dec.add(cashBal, positions);
    netWorth = dec.add(netWorth, v);
    if (acc.type === "bank" || acc.type === "cash" || acc.type === "savings") {
      liquid = dec.add(liquid, v);
    } else {
      invested = dec.add(invested, v);
    }
  }
  for (const h of holdings) {
    realized = dec.add(realized, h.realizedPnl);
    unrealized = dec.add(unrealized, h.unrealizedPnl);
  }

  return {
    holdings,
    accountValue,
    totals: { netWorth, liquid, invested, realized, unrealized },
    computedCashByAccount: cash,
  };
}
