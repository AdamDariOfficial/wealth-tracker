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
  voided_at?: string | null;
  voided_reason?: string | null;
  transfer_group_id?: string | null;
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

/** Derive holdings (account+asset) from the transaction ledger.
 *  Delegates all math to the pure `computeLedger` engine — never inline
 *  aggregations elsewhere. */
export function useHoldings() {
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const { rows: txs } = useTransactions();
  const { table: fxTable } = useFxRates();
  const { profile } = useAuth();
  const baseCurrency = profile?.currency ?? "USD";

  const result = useMemo(
    () =>
      computeLedger({
        accounts,
        assets,
        transactions: txs,
        fxTable,
        baseCurrency,
      }),
    [accounts, assets, txs, fxTable, baseCurrency],
  );

  return {
    accounts,
    assets,
    txs,
    holdings: result.holdings,
    accountValue: result.accountValue,
    totals: result.totals,
    /** Engine-recomputed cash balances (for reconciliation, not display). */
    computedCashByAccount: result.computedCashByAccount,
  };
}
