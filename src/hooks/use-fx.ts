/**
 * Loads fx_rates for the current user's base currency and keeps it cached
 * across renders. Subscribes to inserts so newly recorded rates propagate
 * without a manual refresh.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { buildFxTable, emptyFxTable, type FxRate, type FxTable } from "@/lib/fx";

export function useFxRates(): { table: FxTable; loading: boolean } {
  const { user } = useAuth();
  const [table, setTable] = useState<FxTable>(() => emptyFxTable());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("fx_rates")
        .select("base, quote, rate, as_of")
        .order("as_of", { ascending: false })
        .limit(2000);
      if (cancelled) return;
      setTable(buildFxTable((data ?? []) as FxRate[]));
      setLoading(false);
    };
    load();

    if (!user) return;
    const ch = supabase
      .channel("fx-rates")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "fx_rates" },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return { table, loading };
}
