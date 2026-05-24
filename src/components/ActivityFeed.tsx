import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeftRight, ShieldCheck, BarChart3, Target, Wallet, Activity as ActivityIcon,
  AlertTriangle, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivityFeed, type ActivityEvent, type ActivityKind, type ActivityFilters } from "@/hooks/use-activity-feed";
import { ActivityDrawer } from "@/components/ActivityDrawer";

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

function Row({ e, onClick }: { e: ActivityEvent; onClick: () => void }) {
  const Icon = ICON[e.kind] ?? ActivityIcon;
  const tone = TONE[e.tone ?? "neutral"];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] text-left transition-colors"
    >
      <div className={cn("h-8 w-8 rounded-lg glass-strong flex items-center justify-center shrink-0", tone)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium capitalize truncate">{e.title}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 shrink-0">{e.kind.replace("_", " ")}</span>
          {e.refs.transferGroupId && (
            <span className="text-[9px] font-mono text-cyan/70 shrink-0">↔ pair</span>
          )}
        </div>
        {e.subtitle && (
          <div className="text-xs text-muted-foreground truncate">{e.subtitle}</div>
        )}
      </div>
      <div className="text-right shrink-0">
        {e.amount != null && (
          <div className={cn("font-mono text-sm font-semibold", tone)}>
            {e.amount > 0 ? "+" : ""}{Number(e.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        )}
        <div className="text-[10px] font-mono text-muted-foreground">
          {new Date(e.at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
        </div>
      </div>
    </motion.button>
  );
}

export function ActivityFeed({
  limit, kinds, compact = false, filters,
}: {
  limit?: number;
  kinds?: ActivityKind[];
  compact?: boolean;
  /** Advanced filter set — overrides `kinds` if provided. */
  filters?: ActivityFilters;
}) {
  const merged: ActivityFilters = filters ?? { kinds };
  const events = useActivityFeed(merged);
  const [expanded, setExpanded] = useState(!compact);
  const [selected, setSelected] = useState<ActivityEvent | null>(null);

  const shown = useMemo(
    () => (expanded ? events : events.slice(0, limit ?? 6)),
    [events, expanded, limit],
  );

  if (!events.length) {
    return <div className="text-center text-xs text-muted-foreground py-6">No activity yet.</div>;
  }

  return (
    <>
      <div className="glass rounded-2xl overflow-hidden divide-y divide-border/30">
        {shown.map((e) => <Row key={e.id} e={e} onClick={() => setSelected(e)} />)}
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
      <ActivityDrawer event={selected} onClose={() => setSelected(null)} onSelect={setSelected} />
    </>
  );
}
