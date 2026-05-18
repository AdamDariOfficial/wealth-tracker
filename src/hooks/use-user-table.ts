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
    const { error } = await (supabase as any).from(table).insert({ ...payload, user_id: user.id });
    if (error) throw error;
  };
  const update = async (id: string, payload: Record<string, any>) => {
    const { error } = await (supabase as any).from(table).update(payload).eq("id", id);
    if (error) throw error;
  };
  const remove = async (id: string) => {
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) throw error;
  };

  return { rows, loading, insert, update, remove, refresh };
}
