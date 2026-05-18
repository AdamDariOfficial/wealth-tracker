import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";

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

const ZERO: PortfolioAggregates = {
  netWorth: 0, invested: 0, cashReserve: 0, tradingCapital: 0, tradingReserve: 0,
  investmentsValue: 0, etfsValue: 0, cryptoValue: 0, pnl: 0, pnlPct: 0,
  allocation: [], weeklyDca: 0,
};

export function usePortfolio() {
  const { user } = useAuth();
  const [agg, setAgg] = useState<PortfolioAggregates>(ZERO);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [inv, etf, cry, cash, ta] = await Promise.all([
      supabase.from("investments").select("quantity,avg_cost,current_price").eq("user_id", user.id),
      supabase.from("etfs").select("quantity,avg_cost,current_price,monthly_contribution").eq("user_id", user.id),
      supabase.from("crypto_holdings").select("quantity,avg_cost,current_price").eq("user_id", user.id),
      supabase.from("cash_reserves").select("balance").eq("user_id", user.id),
      supabase.from("trading_account").select("balance,reserve").eq("user_id", user.id).maybeSingle(),
    ]);

    const sum = (rows: any[] | null, k: "value" | "cost") =>
      (rows ?? []).reduce((s, r) => s + Number(r.quantity ?? 0) * Number(k === "value" ? r.current_price : r.avg_cost), 0);

    const invVal = sum(inv.data, "value");
    const etfVal = sum(etf.data, "value");
    const cryVal = sum(cry.data, "value");
    const investmentsValue = invVal;
    const etfsValue = etfVal;
    const cryptoValue = cryVal;

    const invCost = sum(inv.data, "cost") + sum(etf.data, "cost") + sum(cry.data, "cost");
    const totalAssetsValue = invVal + etfVal + cryVal;
    const cashReserve = (cash.data ?? []).reduce((s, r) => s + Number(r.balance ?? 0), 0);
    const tradingCapital = Number(ta.data?.balance ?? 0);
    const tradingReserve = Number(ta.data?.reserve ?? 0);
    const netWorth = totalAssetsValue + cashReserve + tradingCapital + tradingReserve;
    const pnl = totalAssetsValue - invCost;
    const pnlPct = invCost > 0 ? (pnl / invCost) * 100 : 0;
    const weeklyDca = (etf.data ?? []).reduce((s, r) => s + Number(r.monthly_contribution ?? 0) / 4, 0);

    const allocation = [
      { name: "ETFs", value: etfVal },
      { name: "Investments", value: invVal },
      { name: "Crypto", value: cryVal },
      { name: "Trading", value: tradingCapital + tradingReserve },
      { name: "Cash", value: cashReserve },
    ].filter((a) => a.value > 0);
    const total = allocation.reduce((s, a) => s + a.value, 0) || 1;
    const allocationPct = allocation.map((a) => ({ name: a.name, value: +(a.value / total * 100).toFixed(1) }));

    setAgg({
      netWorth, invested: invCost, cashReserve, tradingCapital, tradingReserve,
      investmentsValue, etfsValue, cryptoValue, pnl, pnlPct,
      allocation: allocationPct, weeklyDca,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();
    const tables = ["investments", "etfs", "crypto_holdings", "cash_reserves", "trading_account"];
    const channels = tables.map((t) =>
      supabase.channel(`agg-${t}-${user.id}`)
        .on("postgres_changes" as any, { event: "*", schema: "public", table: t, filter: `user_id=eq.${user.id}` }, () => refresh())
        .subscribe()
    );
    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [user, refresh]);

  return { ...agg, loading, refresh };
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
