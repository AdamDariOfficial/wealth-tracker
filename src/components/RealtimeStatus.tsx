import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wifi, WifiOff, Loader2, RefreshCw, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRealtimeStore, selectConnectionStatus, type RealtimeStatus as RT } from "@/lib/realtime-store";
import { Button } from "@/components/ui/button";

const LABEL: Record<RT, string> = {
  connected: "Live",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  disconnected: "Offline",
  syncing: "Syncing…",
};
const TONE: Record<RT, string> = {
  connected: "text-success",
  connecting: "text-muted-foreground",
  reconnecting: "text-amber-400",
  disconnected: "text-destructive",
  syncing: "text-cyan",
};

export function RealtimeStatus({
  onRefresh,
  autoScroll,
  onToggleAutoScroll,
}: {
  onRefresh?: () => void;
  autoScroll?: boolean;
  onToggleAutoScroll?: () => void;
}) {
  const status = useRealtimeStore(selectConnectionStatus);
  const pending = useRealtimeStore((s) => s.pendingNew);
  const clear = useRealtimeStore((s) => s.clearPending);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const Icon =
    status === "connected" ? Wifi
    : status === "disconnected" ? WifiOff
    : status === "reconnecting" ? RefreshCw
    : Loader2;

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md glass", TONE[status])}>
        <Icon className={cn("h-3 w-3", status !== "connected" && status !== "disconnected" && "animate-spin")} />
        <span className="font-mono">{LABEL[status]}</span>
      </div>
      {pending > 0 && (
        <motion.button
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => { clear(); onRefresh?.(); }}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan/15 text-cyan border border-cyan/30 hover:bg-cyan/25"
        >
          <Bell className="h-3 w-3" />
          <span className="font-mono">{pending} new</span>
        </motion.button>
      )}
      {onToggleAutoScroll && (
        <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={onToggleAutoScroll}>
          Auto-scroll: {autoScroll ? "ON" : "OFF"}
        </Button>
      )}
    </div>
  );
}