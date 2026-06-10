import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { useRealtimeStore } from "@/lib/realtime-store";

type TableName =
  | "investments" | "etfs" | "crypto_holdings" | "goals" | "cash_reserves"
  | "weekly_reports" | "trades"
  | "accounts" | "assets" | "transactions" | "portfolio_snapshots_v2" | "dca_plans"
  | "audit_log" | "import_batches";

/**
 * Financial-history tables are never hard-deleted. Removing a row sets the
 * appropriate soft-delete column instead so the ledger stays event-source
 * complete and the trigger-driven reconciliation reruns (it already ignores
 * voided/archived rows).
 */
const SOFT_DELETE_COLUMN: Partial<Record<TableName, string>> = {
  transactions: "voided_at",
  assets: "archived_at",
  goals: "archived_at",
  accounts: "archived_at",
};

export function useUserTable<T extends { id: string }>(
  table: TableName,
  orderBy: { col: string; asc?: boolean } = { col: "created_at", asc: false },
) {
  const { user } = useAuth();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const notifyNewItem = useRealtimeStore((s) => s.notifyNewItem);

  const softCol = SOFT_DELETE_COLUMN[table];

  const refresh = useCallback(async () => {
    if (!user) return;
    let q = (supabase as any)
      .from(table)
      .select("*")
      .eq("user_id", user.id);
    if (softCol) q = q.is(softCol, null);
    const { data } = await q.order(orderBy.col, { ascending: orderBy.asc ?? false });
    setRows((data ?? []) as T[]);
    setLoading(false);
  }, [user, table, orderBy.col, orderBy.asc, softCol]);

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

  /**
   * For ledger-relevant tables this is a SOFT delete — sets `voided_at` or
   * `archived_at`. The `tg_tx_recompute` trigger + voided-aware
   * `recompute_account_balance` keep derived balances correct automatically.
   * For non-financial tables this still hard-deletes.
   */
  const remove = async (id: string, reason?: string) => {
    const prevRows = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    let error;
    if (softCol) {
      const patch: Record<string, any> = { [softCol]: new Date().toISOString() };
      if (softCol === "voided_at" && reason) patch.voided_reason = reason;
      ({ error } = await (supabase as any).from(table).update(patch).eq("id", id));
    } else {
      ({ error } = await (supabase as any).from(table).delete().eq("id", id));
    }
    if (error) {
      setRows(prevRows);
      throw error;
    }
  };

  /** Restore a soft-deleted row (no-op for hard-delete tables). */
  const restore = async (id: string) => {
    if (!softCol) return;
    const { error } = await (supabase as any)
      .from(table).update({ [softCol]: null, voided_reason: null }).eq("id", id);
    if (error) throw error;
    await refresh();
  };

  return { rows, loading, insert, update, remove, restore, refresh };
}
