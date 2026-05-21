import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Sparkles, Target as TargetIcon } from "lucide-react";
import { useTrading } from "@/hooks/use-trading";
import { EquityCurveCard } from "./EquityCurveCard";
import { cn } from "@/lib/utils";

const phases = [
  { name: "Build",        target: 10000 },
  { name: "Scaling",      target: 25000 },
  { name: "Professional", target: 100000 },
];

export function OverviewTab() {
  const { metrics, equity } = useTrading();

  const stats: { l: string; v: string; c?: string }[] = [
    { l: "Realized P&L", v: `${metrics.realizedPnl >= 0 ? "+" : ""}$${metrics.realizedPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      c: metrics.realizedPnl >= 0 ? "text-success" : "text-destructive" },
    { l: "% Return on Capital", v: `${metrics.pctReturn.toFixed(2)}%`,
      c: metrics.pctReturn >= 0 ? "text-success" : "text-destructive" },
    { l: "Win Rate", v: `${metrics.winRate.toFixed(1)}%` },
    { l: "Avg R:R", v: metrics.avgRR.toFixed(2), c: "text-cyan" },
    { l: "Max Drawdown", v: `${metrics.maxDrawdown.toFixed(1)}%`, c: "text-destructive" },
    { l: "Total Trades", v: `${metrics.totalTrades}` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-6 relative overflow-hidden lg:col-span-2">
          <div className="absolute inset-0 bg-[var(--gradient-glow)] pointer-events-none" />
          <div className="relative">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Current Trading Capital</div>
            <div className="font-display text-5xl font-bold mt-3 text-gradient-cyan">
              ${metrics.currentCapital.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className={cn("mt-1 text-sm flex items-center gap-1", metrics.realizedPnl >= 0 ? "text-success" : "text-destructive")}>
              {metrics.realizedPnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {metrics.realizedPnl >= 0 ? "+" : ""}${metrics.realizedPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} performance ·
              {" "}net capital ${metrics.netCapital.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stats.map((s) => (
                <div key={s.l} className="glass-strong rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
                  <div className={cn("font-display font-semibold mt-1 text-lg", s.c)}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[var(--gradient-glow)] pointer-events-none" />
          <div className="relative">
            <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-3 w-3" /> Consistency
            </div>
            <div className="font-display text-6xl font-bold mt-3 text-gradient-cyan">
              {metrics.consistencyScore}<span className="text-2xl text-muted-foreground">/100</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Aggregate of discipline, psychology, drawdown stability and execution across {metrics.weeklyCount} reviews.
            </div>
          </div>
        </motion.div>
      </div>

      <EquityCurveCard data={equity} />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5">
        <h3 className="font-display font-semibold flex items-center gap-2"><TargetIcon className="h-4 w-4 text-cyan" /> Capital Phases</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {phases.map((p, idx) => {
            const pct = Math.min(100, (metrics.currentCapital / p.target) * 100);
            const active = metrics.currentCapital < p.target && (idx === 0 || metrics.currentCapital >= phases[idx - 1].target);
            return (
              <div key={p.name} className={cn("glass-strong rounded-xl p-4", active && "ring-1 ring-cyan/40")}>
                <div className="flex justify-between items-baseline">
                  <div className="font-display font-semibold">{p.name}</div>
                  <div className="text-xs font-mono text-muted-foreground">${p.target.toLocaleString()}</div>
                </div>
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }}
                    className="h-full rounded-full" style={{ background: `var(--chart-${idx + 1})` }} />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                  {metrics.currentCapital >= p.target && <span className="text-success">Achieved</span>}
                  {active && <span className="text-cyan">In progress</span>}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
