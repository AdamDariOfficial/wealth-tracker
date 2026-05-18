import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { useRealtimeStore } from "@/lib/realtime-store";

type TableName =
  | "investments" | "etfs" | "crypto_holdings" | "goals" | "cash_reserves"
  | "weekly_reports" | "trades"
  | "accounts" | "assets" | "transactions" | "portfolio_snapshots_v2" | "dca_plans"
  | "audit_log";

export function useUserTable<T extends { id: string }>(
  table: TableName,
  orderBy: { col: string; asc?: boolean } = { col: "created_at", asc: false },
) {
  const { user } = useAuth();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const notifyNewItem = useRealtimeStore((s) => s.notifyNewItem);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from(table)
      .select("*")
      .eq("user_id", user.id)
      .order(orderBy.col, { ascending: orderBy.asc ?? false });
    setRows((data ?? []) as T[]);
    setLoading(false);
  }, [user, table, orderBy.col, orderBy.asc]);

  useEffect(() => {
    if (!user) return;
    refresh();
  }, [user, refresh]);

  useRealtimeSubscription({
    table,
    filter: user ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user,
    channelKey: `${table}-user`,
    onChange: (payload: unknown) => {
      if (table === "transactions" || table === "audit_log") {
        const ev = (payload as { eventType?: string }).eventType;
        if (ev === "INSERT") notifyNewItem();
      }
      void refresh();
    },
  });

  const insert = async (payload: Record<string, any>) => {
    if (!user) return;
    // Optimistic insert — instantly add a temp row so dashboard/holdings/charts
    // recompute without waiting for the round-trip. Realtime subscription will
    // reconcile with the real row when it lands.
    const tempId = `__optim_${Math.random().toString(36).slice(2)}`;
    const optimistic = {
      id: tempId,
      user_id: user.id,
      created_at: new Date().toISOString(),
      ...payload,
    } as unknown as T;
    setRows((prev) => [optimistic, ...prev]);
    try {
      const { data, error } = await (supabase as any)
        .from(table).insert({ ...payload, user_id: user.id }).select("*").single();
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === tempId ? (data as T) : r)));
    } catch (e) {
      setRows((prev) => prev.filter((r) => r.id !== tempId));
      throw e;
    }
  };
  const update = async (id: string, payload: Record<string, any>) => {
    const prevRows = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? ({ ...r, ...payload } as T) : r)));
    const { error } = await (supabase as any).from(table).update(payload).eq("id", id);
    if (error) {
      setRows(prevRows);
      throw error;
    }
  };
  const remove = async (id: string) => {
    const prevRows = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) {
      setRows(prevRows);
      throw error;
    }
  };

  return { rows, loading, insert, update, remove, refresh };
}
