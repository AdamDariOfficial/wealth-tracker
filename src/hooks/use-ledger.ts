import { useMemo } from "react";
import { useUserTable } from "./use-user-table";
import { useFxRates } from "./use-fx";
import { useAuth } from "@/lib/auth-store";
import { computeLedger } from "@/lib/ledger-engine";

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: "bank" | "exchange" | "broker" | "crypto_wallet" | "cold_wallet" | "cash" | "savings" | "investment" | "external";
  provider: string | null;
  currency: string;
  current_balance: number;
  icon: string | null;
  color: string | null;
  description: string | null;
  visible: boolean;
  include_in_net_worth: boolean;
  archived_at: string | null;
  created_at: string;
};

export type Asset = {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  asset_class: "fiat" | "crypto" | "etf" | "stock" | "commodity" | "forex" | "cash" | "stablecoin" | "custom";
  color: string | null;
  current_price: number;
  custom_asset: boolean;
  tracking_enabled: boolean;
};

export type Transaction = {
  id: string;
  user_id: string;
  transaction_type:
    | "deposit" | "withdrawal" | "transfer" | "buy" | "sell" | "convert"
    | "fee" | "dividend" | "interest" | "staking_reward" | "profit_realization" | "manual_adjustment";
  source_account_id: string | null;
  destination_account_id: string | null;
  asset_id: string | null;
  quantity: number;
  fiat_value: number;
  fee_amount: number;
  fee_asset_id: string | null;
  exchange_rate: number | null;
  note: string | null;
  tags: string[];
  execution_timestamp: string;
  created_at: string;
};

export type Holding = {
  accountId: string;
  assetId: string;
  quantity: number;
  avgCost: number;
  costBasis: number;
  marketValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
};

export function useAccounts() {
  return useUserTable<Account>("accounts", { col: "created_at", asc: true });
}
export function useAssets() {
  return useUserTable<Asset>("assets", { col: "symbol", asc: true });
}
export function useTransactions() {
  return useUserTable<Transaction>("transactions", { col: "execution_timestamp", asc: false });
}

/** Derive holdings (account+asset) from the transaction ledger. */
export function useHoldings() {
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const { rows: txs } = useTransactions();

  const holdings = useMemo<Holding[]>(() => {
    const map = new Map<string, Holding & { _qty: number; _cost: number }>();
    const key = (a: string, s: string) => `${a}::${s}`;

    // chronological order
    const sorted = [...txs].sort(
      (a, b) => +new Date(a.execution_timestamp) - +new Date(b.execution_timestamp),
    );

    for (const t of sorted) {
      if (!t.asset_id) continue;
      const ensure = (acc: string) => {
        const k = key(acc, t.asset_id!);
        let h = map.get(k);
        if (!h) {
          h = {
            accountId: acc, assetId: t.asset_id!,
            quantity: 0, avgCost: 0, costBasis: 0, marketValue: 0,
            unrealizedPnl: 0, realizedPnl: 0, _qty: 0, _cost: 0,
          };
          map.set(k, h);
        }
        return h;
      };

      const qty = Number(t.quantity || 0);
      const fiat = Number(t.fiat_value || 0);
      const px = qty ? fiat / qty : Number(t.exchange_rate ?? 0);

      switch (t.transaction_type) {
        case "deposit":
        case "buy":
        case "staking_reward":
        case "dividend":
        case "interest": {
          if (!t.destination_account_id) break;
          const h = ensure(t.destination_account_id);
          const newQty = h._qty + qty;
          h._cost = h._cost + (qty * px);
          h._qty = newQty;
          break;
        }
        case "withdrawal":
        case "sell": {
          if (!t.source_account_id) break;
          const h = ensure(t.source_account_id);
          const avg = h._qty ? h._cost / h._qty : 0;
          const sold = Math.min(qty, h._qty);
          h.realizedPnl += sold * (px - avg);
          h._cost -= sold * avg;
          h._qty -= sold;
          break;
        }
        case "transfer": {
          if (t.source_account_id) {
            const h = ensure(t.source_account_id);
            const avg = h._qty ? h._cost / h._qty : 0;
            const moved = Math.min(qty, h._qty);
            h._qty -= moved;
            h._cost -= moved * avg;
            if (t.destination_account_id) {
              const d = ensure(t.destination_account_id);
              d._qty += moved;
              d._cost += moved * avg;
            }
          }
          break;
        }
        case "profit_realization": {
          if (t.destination_account_id) {
            const h = ensure(t.destination_account_id);
            h.realizedPnl += fiat;
          }
          break;
        }
        default:
          break;
      }
    }

    const assetById = new Map(assets.map((a) => [a.id, a]));
    return Array.from(map.values()).map((h) => {
      const asset = assetById.get(h.assetId);
      const price = Number(asset?.current_price ?? 0) || (h._qty ? h._cost / h._qty : 0);
      const marketValue = h._qty * price;
      const avg = h._qty ? h._cost / h._qty : 0;
      return {
        ...h,
        quantity: h._qty,
        avgCost: avg,
        costBasis: h._cost,
        marketValue,
        unrealizedPnl: marketValue - h._cost,
      };
    }).filter((h) => Math.abs(h.quantity) > 1e-9 || h.realizedPnl !== 0);
  }, [accounts, assets, txs]);

  // Per-account market value (sum of holdings + zero-asset cash positions handled below)
  const accountValue = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of holdings) m.set(h.accountId, (m.get(h.accountId) ?? 0) + h.marketValue);
    return m;
  }, [holdings]);

  const totals = useMemo(() => {
    let netWorth = 0, liquid = 0, invested = 0, realized = 0, unrealized = 0;
    for (const acc of accounts) {
      if (!acc.include_in_net_worth || acc.archived_at) continue;
      // Cash side comes from the DB-recomputed account balance (ledger trigger).
      // Holdings market value is additive — buy/sell only move cash on one side
      // so the two never overlap. Avoids the previous bug where accounts holding
      // both cash and positions only counted positions.
      const cash = Number(acc.current_balance ?? 0);
      const positions = accountValue.get(acc.id) ?? 0;
      const v = cash + positions;
      netWorth += v;
      if (acc.type === "bank" || acc.type === "cash" || acc.type === "savings") liquid += v;
      else invested += v;
    }
    for (const h of holdings) {
      realized += h.realizedPnl;
      unrealized += h.unrealizedPnl;
    }
    return { netWorth, liquid, invested, realized, unrealized };
  }, [accounts, accountValue, holdings]);

  return { accounts, assets, txs, holdings, accountValue, totals };
}
