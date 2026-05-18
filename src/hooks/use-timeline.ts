import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import type { Transaction } from "@/hooks/use-ledger";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { useRealtimeStore } from "@/lib/realtime-store";

export type TimelineFilters = {
  type?: string;       // "all" | tx type
  accountId?: string;  // "all" | uuid
  search?: string;     // optional fuzzy on note
};

const PAGE_SIZE = 50;

export function useTimeline(filters: TimelineFilters) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);

  const buildQuery = useCallback((from: number, to: number) => {
    let q = (supabase as any).from("transactions").select("*", { count: "exact" })
      .eq("user_id", user!.id)
      .order("execution_timestamp", { ascending: false })
      .range(from, to);
    if (filters.type && filters.type !== "all") q = q.eq("transaction_type", filters.type);
    if (filters.accountId && filters.accountId !== "all") {
      q = q.or(`source_account_id.eq.${filters.accountId},destination_account_id.eq.${filters.accountId}`);
    }
    if (filters.search) q = q.ilike("note", `%${filters.search}%`);
    return q;
  }, [user, filters.type, filters.accountId, filters.search]);

  const reset = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    pageRef.current = 0;
    const { data, count } = await buildQuery(0, PAGE_SIZE - 1);
    setRows((data ?? []) as Transaction[]);
    setHasMore((data?.length ?? 0) >= PAGE_SIZE && (count ?? 0) > PAGE_SIZE);
    setLoading(false);
  }, [user, buildQuery]);

  const loadMore = useCallback(async () => {
    if (!user || !hasMore || loading) return;
    pageRef.current += 1;
    const from = pageRef.current * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data } = await buildQuery(from, to);
    const next = (data ?? []) as Transaction[];
    setRows((prev) => [...prev, ...next]);
    setHasMore(next.length >= PAGE_SIZE);
  }, [user, hasMore, loading, buildQuery]);

  useEffect(() => { reset(); }, [reset]);

  const notifyNewItem = useRealtimeStore((s) => s.notifyNewItem);
  useRealtimeSubscription({
    table: "transactions",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user,
    channelKey: "timeline-tx",
    onChange: (payload: unknown) => {
      const ev = (payload as { eventType?: string }).eventType;
      if (ev === "INSERT") notifyNewItem();
      void reset();
    },
  });

  return { rows, loading, hasMore, loadMore, reset };
}
