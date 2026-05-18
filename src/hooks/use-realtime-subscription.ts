import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeStore } from "@/lib/realtime-store";

/**
 * Centralized realtime subscription helper.
 *
 * Fixes the recurring "cannot add postgres_changes callbacks after
 * subscribe()" error which was caused by two things:
 *   1. React StrictMode (and any double-mount) re-running the effect with the
 *      same channel name. supabase-js v2 keys channels by name, so the second
 *      `supabase.channel(name)` returned the already-subscribed instance and
 *      calling `.on()` on it threw.
 *   2. Channels not being torn down before being recreated.
 *
 * We solve both: every mount gets a unique channel name and we always
 * `removeChannel` on cleanup, before the next effect can run.
 */
let channelCounter = 0;

type Options = {
  table: string;
  filter?: string;
  enabled?: boolean;
  onChange: (payload: unknown) => void;
  channelKey?: string; // used as part of the unique name for debugging
};

export function useRealtimeSubscription({
  table,
  filter,
  enabled = true,
  onChange,
  channelKey,
}: Options) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  const setChannel = useRealtimeStore((s) => s.setChannel);
  const removeChannelStatus = useRealtimeStore((s) => s.removeChannel);

  useEffect(() => {
    if (!enabled) return;

    channelCounter += 1;
    const name = `rt-${channelKey ?? table}-${channelCounter}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    setChannel(name, "connecting");

    // IMPORTANT: register the listener BEFORE calling subscribe().
    const channel = supabase
      .channel(name)
      .on(
        // supabase-js v2 typings for postgres_changes are awkward; cast.
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        } as never,
        (payload: unknown) => cbRef.current(payload),
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") setChannel(name, "connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setChannel(name, "reconnecting");
        else if (status === "CLOSED") setChannel(name, "disconnected");
      });

    return () => {
      supabase.removeChannel(channel);
      removeChannelStatus(name);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, enabled, channelKey]);
}