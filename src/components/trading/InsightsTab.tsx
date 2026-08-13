import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Activity, Flame, Gauge, Sigma } from "lucide-react";
import { useTrading } from "@/hooks/use-trading";
import { useMoneyFormatter } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import { chartTooltipProps } from "@/lib/chart-style";

/**
 * Insights tab — performance analytics derived from recorded activity
 * and finalized weekly reports. Replaces the broker-terminal-style
 * trades table with consistency, distribution and drawdown views.
 *
 * NO aggregation logic lives here — everything is pulled from
 * `useTrading()` → `trading-engine`. This file is presentation only.
 */
export function InsightsTab() {
  const { metrics, equity, weekly, capital } = useTrading();
  const fmt = useMoneyFormatter();

  // PnL distribution (per finalized weekly report)
  const pnlSeries = useMemo(
    () => [...weekly]
      .filter((w) => Number(w.pnl) !== 0)
      .sort((a, b) => a.week_start.localeCompare(b.week_start))
      .map((w) => ({
        week: w.week_start.slice(5),
        pnl: Number(w.pnl),
        rr: Number(w.avg_rr ?? 0),
        winrate: Number(w.winrate ?? 0),
      })),
    [weekly],
  );

  // Drawdown trace from performance-only equity curve
  const drawdown = useMemo(() => {
    let peak = 0;
    return equity.map((p) => {
      peak = Math.max(peak, p.performance);
      const dd = peak > 0 ? ((p.performance - peak) / peak) * 100 : 0;
      return { date: p.date, dd };
    });
  }, [equity]);

  // Streaks (consecutive positive/negative weeks)
  const streaks = useMemo(() => {
    let cur = 0, best = 0, worst = 0, sign: 1 | -1 | 0 = 0;
    for (const w of pnlSeries) {
      const s: 1 | -1 | 0 = w.pnl > 0 ? 1 : w.pnl < 0 ? -1 : 0;
      if (s === 0) { cur = 0; sign = 0; continue; }
      if (s === sign) cur += 1; else { cur = 1; sign = s; }
      if (sign === 1) best = Math.max(best, cur);
      else worst = Math.max(worst, cur);
    }
    return { best, worst };
  }, [pnlSeries]);

  // Capital efficiency: realized P&L per dollar of net capital deployed
  const capitalEff = metrics.netCapital > 0
    ? (metrics.realizedPnl / metrics.netCapital) * 100
    : 0;

  // Avg weekly P&L
  const avgWeek = pnlSeries.length
    ? pnlSeries.reduce((s, w) => s + w.pnl, 0) / pnlSeries.length
    : 0;

  const tiles = [
    { l: "Capital efficiency", v: `${capitalEff.toFixed(2)}%`, c: capitalEff >= 0 ? "text-success" : "text-destructive", Icon: Gauge },
    { l: "Avg weekly P&L", v: fmt(avgWeek), c: avgWeek >= 0 ? "text-success" : "text-destructive", Icon: Sigma },
    { l: "Best green streak", v: `${streaks.best}w`, c: "text-success", Icon: Flame },
    { l: "Worst red streak", v: `${streaks.worst}w`, c: "text-destructive", Icon: TrendingDown },
    { l: "Consistency score", v: `${metrics.consistencyScore}/100`, c: "text-cyan", Icon: Activity },
    { l: "Net capital deployed", v: fmt(metrics.netCapital), Icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-display text-lg font-semibold">Performance Insights</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Derived from the ledger and finalized weekly reports — no per-trade entry needed.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map(({ l, v, c, Icon }) => (
          <motion.div key={l} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="surface-quiet p-3">
            <div className="flex items-center justify-between">
              <div className="label-muted">{l}</div>
              <Icon className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className={cn("font-display font-semibold mt-1 text-base", c)}>{v}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="surface-section p-5">
          <h3 className="font-display font-semibold text-sm">Weekly P&L distribution</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Per-week realized performance (signed).</p>
          {pnlSeries.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-16">No finalized weekly reports yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={pnlSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 0.3)" />
                <XAxis dataKey="week" stroke="oklch(0.6 0 0)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.6 0 0)" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${(v/1000).toFixed(1)}k`} />
                <Tooltip {...chartTooltipProps} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {pnlSeries.map((p, i) => (
                    <Cell key={i} fill={p.pnl >= 0 ? "hsl(150 70% 50%)" : "hsl(0 70% 55%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="surface-section p-5">
          <h3 className="font-display font-semibold text-sm">Drawdown trace</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Performance-only equity, peak-to-trough.</p>
          {drawdown.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-16">No equity curve yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={drawdown}>
                <defs>
                  <linearGradient id="dd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0 70% 55%)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(0 70% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 0.3)" />
                <XAxis dataKey="date" stroke="oklch(0.6 0 0)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.6 0 0)" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip {...chartTooltipProps} />
                <Area type="monotone" dataKey="dd" stroke="hsl(0 70% 55%)" strokeWidth={2} fill="url(#dd)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="surface-section p-5">
        <h3 className="font-display font-semibold text-sm">Capital flow vs performance</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Deposits and withdrawals against the trading book — kept separate from PnL by design.
        </p>
        {capital.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-16">No capital movements yet.</div>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead className="label-muted">
                <tr>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left">Kind</th>
                  <th className="text-right">Amount</th>
                  <th className="text-left pl-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {capital.slice(0, 12).map((c) => (
                  <tr key={c.id} className="border-t border-white/5">
                    <td className="py-2 font-mono">{c.date}</td>
                    <td className="capitalize">{c.kind.replace("_", " ")}</td>
                    <td className={cn("text-right font-mono", c.amount >= 0 ? "text-success" : "text-destructive")}>
                      {c.amount >= 0 ? "+" : ""}{fmt(c.amount)}
                    </td>
                    <td className="pl-3 text-muted-foreground truncate max-w-[260px]">{c.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
