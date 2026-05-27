import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/format-percent";

interface Props {
  label: string;
  value: string;
  change?: number;
  icon?: LucideIcon;
  prefix?: string;
  delay?: number;
  accent?: boolean;
}

export function StatCard({ label, value, change, icon: Icon, prefix = "$", delay = 0, accent }: Props) {
  const positive = (change ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        "glass rounded-2xl p-5 relative overflow-hidden group transition-all hover:border-cyan/30",
        accent && "ring-1 ring-cyan/20"
      )}
    >
      <div className="absolute inset-0 bg-[var(--gradient-glow)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="flex items-start justify-between relative">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="mt-2 font-display text-2xl font-semibold tracking-tight">
            {prefix}{value}
          </div>
          {change !== undefined && (
            <div className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium",
              positive ? "text-success" : "text-destructive")}>
              {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              <span className="tabular-nums">{formatPct(change, { digits: 2, sign: true, compact: true })}</span>
              <span className="text-muted-foreground ml-1 font-normal">vs last month</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="h-9 w-9 rounded-xl glass-strong flex items-center justify-center text-cyan">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
