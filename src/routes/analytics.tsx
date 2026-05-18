import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis, BarChart, Bar, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { TrendingUp, Activity, Gauge, Target, Award, Brain } from "lucide-react";
import { useSnapshots, usePortfolio } from "@/hooks/use-portfolio";
import { useUserTable } from "@/hooks/use-user-table";

export const Route = createFileRoute("/analytics")({ component: Analytics });

function Analytics() {
  const { rows: snaps } = useSnapshots(365);
  const { rows: weekly } = useUserTable<any>("weekly_reports", { col: "week_start", asc: true });
  const portfolio = usePortfolio();

  const series = useMemo(() => snaps.map((s) => ({
    m: new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: Number(s.net_worth),
    bench: Number(s.investments_value) + Number(s.cash_value),
  })), [snaps]);

  // Returns by snapshot diffs
  const monthlyReturns = useMemo(() => {
    if (snaps.length < 2) return [];
    const byMonth = new Map<string, { first: number; last: number }>();
    snaps.forEach((s) => {
      const key = s.snapshot_date.slice(0, 7);
      const cur = byMonth.get(key);
      if (!cur) byMonth.set(key, { first: Number(s.net_worth), last: Number(s.net_worth) });
      else cur.last = Number(s.net_worth);
    });
    return Array.from(byMonth.entries()).slice(-12).map(([k, v]) => ({
      m: new Date(k + "-01").toLocaleDateString("en-US", { month: "short" }),
      r: v.first ? +(((v.last - v.first) / v.first) * 100).toFixed(2) : 0,
    }));
  }, [snaps]);

  // Risk metrics from snapshots
  const cagr = useMemo(() => {
    if (snaps.length < 2) return 0;
    const first = Number(snaps[0].net_worth);
    const last = Number(snaps[snaps.length - 1].net_worth);
    if (!first) return 0;
    const days = Math.max(1, (new Date(snaps[snaps.length - 1].snapshot_date).getTime() - new Date(snaps[0].snapshot_date).getTime()) / 86400000);
    return (Math.pow(last / first, 365 / days) - 1) * 100;
  }, [snaps]);

  const sharpe = useMemo(() => {
    if (snaps.length < 3) return 0;
    const returns: number[] = [];
    for (let i = 1; i < snaps.length; i++) {
      const a = Number(snaps[i - 1].net_worth);
      const b = Number(snaps[i].net_worth);
      if (a > 0) returns.push((b - a) / a);
    }
    if (returns.length === 0) return 0;
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const std = Math.sqrt(variance);
    return std > 0 ? (mean / std) * Math.sqrt(252) : 0;
  }, [snaps]);

  const maxDD = useMemo(() => {
    let peak = 0, dd = 0;
    snaps.forEach((s) => {
      const v = Number(s.net_worth);
      peak = Math.max(peak, v);
      if (peak > 0) dd = Math.max(dd, (peak - v) / peak);
    });
    return dd * 100;
  }, [snaps]);

  // Trading psychology aggregates
  const psych = useMemo(() => {
    if (weekly.length === 0) return { discipline: 0, psychology: 0, consistency: 0, avgRR: 0, winrate: 0 };
    const n = weekly.length;
    return {
      discipline: weekly.reduce((s, w: any) => s + Number(w.discipline_score ?? 0), 0) / n,
      psychology: weekly.reduce((s, w: any) => s + Number(w.psychology_score ?? 0), 0) / n,
      consistency: weekly.reduce((s, w: any) => s + Number(w.consistency_score ?? 0), 0) / n,
      avgRR: weekly.reduce((s, w: any) => s + Number(w.avg_rr ?? 0), 0) / n,
      winrate: weekly.reduce((s, w: any) => s + Number(w.winrate ?? 0), 0) / n,
    };
  }, [weekly]);

  const radar = [
    { metric: "Discipline",   v: psych.discipline },
    { metric: "Psychology",   v: psych.psychology },
    { metric: "Consistency",  v: psych.consistency },
    { metric: "Win Rate",     v: psych.winrate },
    { metric: "Avg R:R x10",  v: Math.min(100, psych.avgRR * 10) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Live KPIs across portfolio performance, risk and trading psychology." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="CAGR" value={`${cagr.toFixed(1)}%`} prefix="" icon={TrendingUp} accent />
        <StatCard label="Sharpe Ratio" value={sharpe.toFixed(2)} prefix="" icon={Gauge} delay={0.05} />
        <StatCard label="Max Drawdown" value={`${maxDD.toFixed(1)}%`} prefix="" icon={Activity} delay={0.1} />
        <StatCard label="Net Worth" value={portfolio.netWorth.toLocaleString("en-US", { maximumFractionDigits: 0 })} prefix="$" icon={Target} delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Net Worth vs Cost Basis</h3>
          {series.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-16">Not enough snapshots yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="p1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(190 90% 60%)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(190 90% 60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="p2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(280 70% 65%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(280 70% 65%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 0.3)" />
                <XAxis dataKey="m" stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.008 240)", border: "1px solid oklch(0.3 0.01 240)", borderRadius: 12, fontSize: 12 }} />
                <Area dataKey="bench" stroke="hsl(280 70% 65%)" strokeWidth={1.5} fill="url(#p2)" />
                <Area dataKey="value" stroke="hsl(190 90% 60%)" strokeWidth={2} fill="url(#p1)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><Brain className="h-4 w-4 text-cyan" /> Trading Profile</h3>
          {weekly.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-16">Submit a weekly review to populate.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radar}>
                <PolarGrid stroke="oklch(0.3 0.01 240 / 0.4)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "oklch(0.7 0 0)", fontSize: 10 }} />
                <Radar dataKey="v" stroke="hsl(190 90% 60%)" fill="hsl(190 90% 60%)" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Avg Win Rate" value={`${psych.winrate.toFixed(1)}%`} prefix="" icon={Award} />
        <StatCard label="Avg R:R" value={psych.avgRR.toFixed(2)} prefix="" icon={Target} delay={0.05} />
        <StatCard label="Discipline" value={`${psych.discipline.toFixed(0)}/100`} prefix="" icon={Gauge} delay={0.1} />
        <StatCard label="Consistency" value={`${psych.consistency.toFixed(0)}/100`} prefix="" icon={Activity} delay={0.15} />
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-display font-semibold mb-4">Monthly Returns (%)</h3>
        {monthlyReturns.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-12">Not enough snapshots.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyReturns}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 0.3)" />
              <XAxis dataKey="m" stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "oklch(0.18 0.008 240)", border: "1px solid oklch(0.3 0.01 240)", borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.82 0.15 210 / 0.08)" }} />
              <Bar dataKey="r" radius={[6, 6, 0, 0]} fill="hsl(190 90% 60%)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
