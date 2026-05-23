import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeftRight, ShieldCheck, BarChart3, Target, Wallet, Activity as ActivityIcon,
  AlertTriangle, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivityFeed, type ActivityEvent, type ActivityKind } from "@/hooks/use-activity-feed";

const ICON: Record<ActivityKind, typeof ActivityIcon> = {
  transaction: ArrowLeftRight,
  transfer: ArrowLeftRight,
  reconciliation: ShieldCheck,
  audit: AlertTriangle,
  weekly_report: BarChart3,
  goal: Target,
  account: Wallet,
};

const TONE: Record<string, string> = {
  positive: "text-success",
  negative: "text-destructive",
  warning: "text-amber-400",
  neutral: "text-muted-foreground",
};

function Row({ e, advanced }: { e: ActivityEvent; advanced: boolean }) {
  const Icon = ICON[e.kind] ?? ActivityIcon;
  const tone = TONE[e.tone ?? "neutral"];
  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03]"
    >
      <div className={cn("h-8 w-8 rounded-lg glass-strong flex items-center justify-center shrink-0", tone)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium capitalize">{e.title}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{e.kind.replace("_", " ")}</span>
        </div>
        {e.subtitle && (
          <div className="text-xs text-muted-foreground truncate">{e.subtitle}</div>
        )}
        {advanced && e.meta && (
          <pre className="mt-1 text-[10px] font-mono text-muted-foreground/70 whitespace-pre-wrap break-all">
            {JSON.stringify(e.meta, null, 0)}
          </pre>
        )}
      </div>
      <div className="text-right shrink-0">
        {e.amount != null && (
          <div className={cn("font-mono text-sm font-semibold", tone)}>
            {e.amount > 0 ? "+" : ""}{Number(e.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        )}
        <div className="text-[10px] font-mono text-muted-foreground">
          {new Date(e.at).toLocaleString()}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Compact, glass-styled activity stream. `compact` mode shows top N events
 * with a single "show more" toggle, `kinds` filters which event types appear.
 */
export function ActivityFeed({
  limit, kinds, compact = false, showAdvancedToggle = true,
}: {
  limit?: number;
  kinds?: ActivityKind[];
  compact?: boolean;
  showAdvancedToggle?: boolean;
}) {
  const events = useActivityFeed({ kinds });
  const [expanded, setExpanded] = useState(!compact);
  const [advanced, setAdvanced] = useState(false);
  const shown = useMemo(
    () => (expanded ? events : events.slice(0, limit ?? 6)),
    [events, expanded, limit],
  );

  if (!events.length) {
    return <div className="text-center text-xs text-muted-foreground py-6">No activity yet.</div>;
  }

  return (
    <div className="glass rounded-2xl overflow-hidden divide-y divide-border/30">
      {showAdvancedToggle && (
        <div className="flex justify-end px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <button onClick={() => setAdvanced((s) => !s)} className="hover:text-cyan">
            {advanced ? "Hide raw" : "Show raw"}
          </button>
        </div>
      )}
      {shown.map((e) => <Row key={e.id} e={e} advanced={advanced} />)}
      {compact && events.length > (limit ?? 6) && (
        <button
          onClick={() => setExpanded((s) => !s)}
          className="w-full py-2 text-xs text-muted-foreground hover:text-cyan flex items-center justify-center gap-1"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Collapse" : `Show ${events.length - (limit ?? 6)} more`}
        </button>
      )}
    </div>
  );
}
