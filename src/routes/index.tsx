import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import {
  Wallet, TrendingUp, Briefcase, Zap, PiggyBank, Activity,
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { usePortfolio, useSnapshots } from "@/hooks/use-portfolio";
import { useUserTable } from "@/hooks/use-user-table";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Dashboard });

const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmt2 = (n: number) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ChartCard({ title, subtitle, children, className }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("glass rounded-2xl p-5", className)}
    >
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function Dashboard() {
  const { profile } = useAuth();
  const p = usePortfolio();
  const { rows: snaps, captureToday } = useSnapshots(365);
  const { rows: goals } = useUserTable<any>("goals");
  const { rows: weekly } = useUserTable<any>("weekly_reports", { col: "week_start", asc: true });

  // Capture daily snapshot on first load when aggregates change (debounced via deps).
  useEffect(() => {
    if (p.loading) return;
    if (p.netWorth === 0 && p.cashReserve === 0 && p.tradingCapital === 0) return;
    captureToday({
      net_worth: p.netWorth,
      cash_value: p.cashReserve,
      trading_value: p.tradingCapital + p.tradingReserve,
      crypto_value: p.cryptoValue,
      investments_value: p.investmentsValue + p.etfsValue,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.loading, Math.round(p.netWorth)]);

  const series = useMemo(() => {
    if (snaps.length === 0) return [{ month: "Today", value: p.netWorth, invested: p.invested }];
    return snaps.map((s) => ({
      month: new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Number(s.net_worth),
      invested: Number(s.investments_value) + Number(s.cash_value),
    }));
  }, [snaps, p.netWorth, p.invested]);

  const weeklyFlow = useMemo(() => {
    return weekly.slice(-12).map((w: any) => ({
      week: new Date(w.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount: Math.max(0, Number(w.pnl ?? 0)),
    }));
  }, [weekly]);

  const firstName = (profile?.display_name ?? "there").split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Live portfolio across every account."
        action={
          <div className="glass rounded-xl px-3 py-2 text-xs font-mono text-muted-foreground flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-cyan" />
            {new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Net Worth" value={fmt2(p.netWorth)} change={p.pnlPct} icon={Wallet} delay={0.0} accent />
        <StatCard label="Total Invested" value={fmt(p.invested)} icon={TrendingUp} delay={0.05} />
        <StatCard label="Trading Capital" value={fmt(p.tradingCapital)} icon={Briefcase} delay={0.1} />
        <StatCard label="Unrealized P&L" value={fmt2(p.pnl)} change={p.pnlPct} icon={Zap} delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Net Worth" subtitle="Daily snapshots vs invested capital" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(190 90% 60%)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(190 90% 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="inv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(155 60% 60%)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(155 60% 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 0.3)" />
              <XAxis dataKey="month" stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "oklch(0.18 0.008 240)", border: "1px solid oklch(0.3 0.01 240)", borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="invested" stroke="hsl(155 60% 60%)" strokeWidth={1.5} fill="url(#inv)" />
              <Area type="monotone" dataKey="value" stroke="hsl(190 90% 60%)" strokeWidth={2} fill="url(#nw)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Portfolio Allocation" subtitle="Live breakdown">
          {p.allocation.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-12">Add holdings to see your allocation.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={p.allocation} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                    {p.allocation.map((_, i) => <Cell key={i} fill={`var(--chart-${(i % 5) + 1})`} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.008 240)", border: "1px solid oklch(0.3 0.01 240)", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {p.allocation.map((a, i) => (
                  <div key={a.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ background: `var(--chart-${(i % 5) + 1})` }} />
                      <span className="text-muted-foreground">{a.name}</span>
                    </div>
                    <span className="font-mono font-medium">{a.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Cash Reserve" value={fmt(p.cashReserve)} icon={PiggyBank} delay={0.0} />
        <StatCard label="ETFs Value" value={fmt(p.etfsValue)} icon={TrendingUp} delay={0.05} />
        <StatCard label="Crypto Value" value={fmt(p.cryptoValue)} icon={Zap} delay={0.1} />
        <StatCard label="Weekly DCA" value={fmt(p.weeklyDca)} prefix="$" icon={Activity} delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Weekly Trading P&L" subtitle="Last 12 weekly reports">
          {weeklyFlow.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-12">No weekly reports yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 0.3)" />
                <XAxis dataKey="week" stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.008 240)", border: "1px solid oklch(0.3 0.01 240)", borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.82 0.15 210 / 0.08)" }} />
                <Bar dataKey="amount" fill="hsl(190 90% 60%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Upcoming Goals" subtitle="Closest milestones">
          {goals.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-12">No goals yet — add some in Goals.</div>
          ) : (
            <div className="space-y-3">
              {goals.slice(0, 4).map((g: any) => {
                const pct = Math.min(100, (Number(g.current_amount) / Math.max(1, Number(g.target_amount))) * 100);
                return (
                  <div key={g.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{g.name}</span>
                      <span className="font-mono text-muted-foreground">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                        className="h-full bg-gradient-to-r from-cyan to-cyan-glow rounded-full" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
