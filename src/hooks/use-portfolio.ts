import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { useHoldings, useAccounts, useAssets } from "@/hooks/use-ledger";
import { useUserTable } from "@/hooks/use-user-table";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";

export type PortfolioAggregates = {
  netWorth: number;
  invested: number;
  cashReserve: number;
  tradingCapital: number;
  tradingReserve: number;
  investmentsValue: number;
  etfsValue: number;
  cryptoValue: number;
  pnl: number;
  pnlPct: number;
  allocation: { name: string; value: number }[];
  weeklyDca: number;
};

/**
 * Single source of truth: derive every aggregate from the transaction ledger
 * (via useHoldings) + the DB-trigger-maintained account balances. Reading
 * the legacy holding tables (investments/etfs/crypto_holdings/cash_reserves)
 * caused the dashboard, accounts page and analytics to disagree.
 */
export function usePortfolio() {
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const { holdings, accountValue, totals } = useHoldings();
  const { rows: etfs } = useUserTable<{ id: string; monthly_contribution: number }>("etfs", { col: "created_at", asc: true });

  const agg = useMemo<PortfolioAggregates & { loading: boolean }>(() => {
    const assetById = new Map(assets.map((a) => [a.id, a]));

    let etfsValue = 0, cryptoValue = 0, investmentsValue = 0, costBasis = 0;
    for (const h of holdings) {
      const a = assetById.get(h.assetId);
      costBasis += h.costBasis;
      const cls = a?.asset_class;
      if (cls === "etf") etfsValue += h.marketValue;
      else if (cls === "crypto" || cls === "stablecoin") cryptoValue += h.marketValue;
      else if (cls === "stock" || cls === "commodity" || cls === "custom") investmentsValue += h.marketValue;
    }

    // Cash split: accounts marked as bank/cash/savings → cashReserve.
    // Broker/exchange/investment accounts → tradingCapital (their cash float).
    let cashReserve = 0, tradingCapital = 0;
    for (const acc of accounts) {
      if (!acc.include_in_net_worth || acc.archived_at) continue;
      const cash = Number(acc.current_balance ?? 0);
      if (acc.type === "bank" || acc.type === "cash" || acc.type === "savings") cashReserve += cash;
      else if (acc.type === "broker" || acc.type === "exchange" || acc.type === "investment") tradingCapital += cash;
      else {
        // crypto_wallet, cold_wallet, external — count as part of "invested" cash float
        tradingCapital += cash;
      }
      // positions on this account are already counted by totals.netWorth
      void accountValue;
    }

    const netWorth = totals.netWorth;
    const pnl = totals.unrealized + totals.realized;
    const pnlPct = costBasis > 0 ? (totals.unrealized / costBasis) * 100 : 0;
    const weeklyDca = etfs.reduce((s, r) => s + Number(r.monthly_contribution ?? 0) / 4, 0);

    const allocationRaw = [
      { name: "ETFs", value: etfsValue },
      { name: "Investments", value: investmentsValue },
      { name: "Crypto", value: cryptoValue },
      { name: "Trading", value: tradingCapital },
      { name: "Cash", value: cashReserve },
    ].filter((a) => a.value > 0);
    const total = allocationRaw.reduce((s, a) => s + a.value, 0) || 1;
    const allocation = allocationRaw.map((a) => ({ name: a.name, value: +(a.value / total * 100).toFixed(1) }));

    return {
      netWorth,
      invested: costBasis,
      cashReserve,
      tradingCapital,
      tradingReserve: 0,
      investmentsValue,
      etfsValue,
      cryptoValue,
      pnl,
      pnlPct,
      allocation,
      weeklyDca,
      loading: false,
    };
  }, [accounts, assets, holdings, accountValue, totals, etfs]);

  // refresh is a no-op now: subscriptions on accounts/assets/transactions drive updates.
  const refresh = useCallback(() => {}, []);
  return { ...agg, refresh };
}

export type TradingAccount = {
  user_id: string;
  balance: number;
  reserve: number;
  default_risk_pct: number;
  weekly_loss_limit_pct: number;
  max_daily_loss_pct: number;
  primary_asset: string | null;
};

export function useTradingAccount() {
  const { user } = useAuth();
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("trading_account").select("*").eq("user_id", user.id).maybeSingle();
    if (data) setAccount(data as TradingAccount);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();
    const ch = supabase.channel(`ta-${user.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "trading_account", filter: `user_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  const update = async (patch: Partial<TradingAccount>) => {
    if (!user) return;
    const { error } = await supabase.from("trading_account").update(patch).eq("user_id", user.id);
    if (error) throw error;
  };

  return { account, loading, update, refresh };
}

export type Snapshot = {
  id: string;
  snapshot_date: string;
  net_worth: number;
  cash_value: number;
  trading_value: number;
  crypto_value: number;
  investments_value: number;
};

export function useSnapshots(limit = 180) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("performance_snapshots")
      .select("*").eq("user_id", user.id)
      .order("snapshot_date", { ascending: true }).limit(limit);
    setRows((data ?? []) as Snapshot[]);
    setLoading(false);
  }, [user, limit]);

  useEffect(() => {
    if (!user) return;
    refresh();
    const ch = supabase.channel(`snap-${user.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "performance_snapshots", filter: `user_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  /** Insert today's snapshot (idempotent: replaces today's row). */
  const captureToday = async (vals: Omit<Snapshot, "id" | "snapshot_date">) => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("performance_snapshots").delete().eq("user_id", user.id).eq("snapshot_date", today);
    await supabase.from("performance_snapshots").insert({ ...vals, user_id: user.id, snapshot_date: today });
  };

  return { rows, loading, refresh, captureToday };
}
