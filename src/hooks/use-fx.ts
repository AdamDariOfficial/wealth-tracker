/**
 * Loads fx_rates and keeps cached. Realtime via the centralized helper to
 * prevent the "cannot add postgres_changes callbacks after subscribe()"
 * error caused by re-subscribing a statically-named channel.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { buildFxTable, emptyFxTable, type FxRate, type FxTable } from "@/lib/fx";

export function useFxRates(): { table: FxTable; loading: boolean } {
  const { user } = useAuth();
  const [table, setTable] = useState<FxTable>(() => emptyFxTable());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("fx_rates")
      .select("base, quote, rate, as_of")
      .order("as_of", { ascending: false })
      .limit(2000);
    setTable(buildFxTable((data ?? []) as FxRate[]));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, user?.id]);

  useRealtimeSubscription({
    table: "fx_rates" as any,
    enabled: !!user,
    channelKey: "fx-rates",
    onChange: () => { void load(); },
  });

  return { table, loading };
}
