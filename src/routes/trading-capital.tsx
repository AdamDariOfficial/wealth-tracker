import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Briefcase, Shield, Calculator, AlertTriangle, Target as TargetIcon, TrendingDown, TrendingUp, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { useTradingAccount, useSnapshots } from "@/hooks/use-portfolio";
import { useUserTable } from "@/hooks/use-user-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trading-capital")({ component: TradingCapital });

const phases = [
  { name: "Build",        target: 10000 },
  { name: "Scaling",      target: 25000 },
  { name: "Professional", target: 100000 },
];

function TradingCapital() {
  const { account, update } = useTradingAccount();
  const { rows: weekly } = useUserTable<any>("weekly_reports", { col: "week_start", asc: true });
  const { rows: snaps } = useSnapshots(60);

  const [form, setForm] = useState({
    balance: 0, reserve: 0, default_risk_pct: 1, weekly_loss_limit_pct: 5, max_daily_loss_pct: 2, primary_asset: "",
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account && !dirty) {
      setForm({
        balance: Number(account.balance ?? 0),
        reserve: Number(account.reserve ?? 0),
        default_risk_pct: Number(account.default_risk_pct ?? 1),
        weekly_loss_limit_pct: Number(account.weekly_loss_limit_pct ?? 5),
        max_daily_loss_pct: Number(account.max_daily_loss_pct ?? 2),
        primary_asset: account.primary_asset ?? "",
      });
    }
  }, [account, dirty]);

  const set = (patch: Partial<typeof form>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try { await update(form); toast.success("Trading account updated"); setDirty(false); }
    catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(false); }
  };

  // Position sizer
  const [entry, setEntry] = useState(100);
  const [sl, setSL] = useState(98);
  const riskAmount = (form.balance * form.default_risk_pct) / 100;
  const stopDist = Math.abs(entry - sl);
  const positionSize = stopDist > 0 ? riskAmount / stopDist : 0;

  const equityCurve = useMemo(() => {
    if (snaps.length > 0) {
      return snaps.map((s) => ({ day: new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), equity: Number(s.trading_value) }));
    }
    let eq = form.balance;
    return weekly.slice(-20).map((w: any) => ({ day: new Date(w.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" }), equity: (eq += Number(w.pnl ?? 0)) }));
  }, [snaps, weekly, form.balance]);

  const totalPnl = weekly.reduce((s, w: any) => s + Number(w.pnl ?? 0), 0);
  const trades = weekly.reduce((s, w: any) => s + Number(w.num_trades ?? 0), 0);
  const avgRR = weekly.length ? (weekly.reduce((s, w: any) => s + Number(w.avg_rr ?? 0), 0) / weekly.length) : 0;
  const winRate = weekly.length ? (weekly.reduce((s, w: any) => s + Number(w.winrate ?? 0), 0) / weekly.length) : 0;
  const maxDD = weekly.reduce((m, w: any) => Math.max(m, Number(w.max_drawdown ?? 0)), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Trading Capital" subtitle="Risk-managed capital allocation, scaling phases and growth tracking."
        action={dirty && <Button onClick={save} disabled={saving} className="bg-cyan text-background hover:bg-cyan/90"><Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save changes"}</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-6 lg:col-span-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-[var(--gradient-glow)] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Briefcase className="h-3 w-3" /> Active Trading Capital
            </div>
            <div className="font-display text-5xl font-bold mt-3 text-gradient-cyan">${form.balance.toLocaleString()}</div>
            <div className={cn("mt-1 text-sm flex items-center gap-1", totalPnl >= 0 ? "text-success" : "text-destructive")}>
              {totalPnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()} cumulative · {weekly.length} weekly reports
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance ($)</Label>
                <Input type="number" value={form.balance} onChange={(e) => set({ balance: +e.target.value })} className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Reserve ($)</Label>
                <Input type="number" value={form.reserve} onChange={(e) => set({ reserve: +e.target.value })} className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Primary asset</Label>
                <Input value={form.primary_asset} onChange={(e) => set({ primary_asset: e.target.value })} placeholder="ES, NQ…" className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" /> Default risk %</Label>
                <Input type="number" step="0.1" value={form.default_risk_pct} onChange={(e) => set({ default_risk_pct: +e.target.value })} className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Daily loss %</Label>
                <Input type="number" step="0.1" value={form.max_daily_loss_pct} onChange={(e) => set({ max_daily_loss_pct: +e.target.value })} className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Weekly limit %</Label>
                <Input type="number" step="0.1" value={form.weekly_loss_limit_pct} onChange={(e) => set({ weekly_loss_limit_pct: +e.target.value })} className="mt-1 font-mono" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-5">
          <h3 className="font-display font-semibold flex items-center gap-2"><Calculator className="h-4 w-4 text-cyan" /> Position Size</h3>
          <div className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Risk %</Label><Input type="number" step="0.1" value={form.default_risk_pct} onChange={(e) => set({ default_risk_pct: +e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Risk $</Label><Input value={`$${riskAmount.toFixed(2)}`} disabled className="mt-1 font-mono" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Entry</Label><Input type="number" value={entry} onChange={(e) => setEntry(+e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Stop Loss</Label><Input type="number" value={sl} onChange={(e) => setSL(+e.target.value)} className="mt-1" /></div>
            </div>
            <div className="glass-strong rounded-xl p-3 mt-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Position size</div>
              <div className="font-display font-semibold text-cyan text-xl mt-1">{positionSize.toFixed(2)} units</div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5">
        <h3 className="font-display font-semibold flex items-center gap-2"><TargetIcon className="h-4 w-4 text-cyan" /> Capital Phases</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {phases.map((p, idx) => {
            const pct = Math.min(100, (form.balance / p.target) * 100);
            const active = form.balance < p.target && (idx === 0 || form.balance >= phases[idx - 1].target);
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
                  {form.balance >= p.target && <span className="text-success">Achieved</span>}
                  {active && <span className="text-cyan">In progress</span>}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Capital Growth</h3>
          {equityCurve.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-12">No history yet. Snapshots build over time.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 0.3)" />
                <XAxis dataKey="day" stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.008 240)", border: "1px solid oklch(0.3 0.01 240)", borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="equity" stroke="hsl(190 90% 60%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-semibold mb-4">Risk Metrics</h3>
          <div className="space-y-3">
            {[
              { l: "Win Rate", v: `${winRate.toFixed(1)}%`, c: "text-success" },
              { l: "Avg R:R", v: avgRR.toFixed(2), c: "text-cyan" },
              { l: "Cumulative P&L", v: `$${totalPnl.toLocaleString()}`, c: totalPnl >= 0 ? "text-success" : "text-destructive" },
              { l: "Max Drawdown", v: `${maxDD.toFixed(1)}%`, c: "text-destructive" },
              { l: "Total Trades", v: `${trades}`, c: "" },
            ].map((m) => (
              <div key={m.l} className="flex justify-between items-center pb-2 border-b border-border/30 last:border-0">
                <span className="text-sm text-muted-foreground">{m.l}</span>
                <span className={cn("font-mono font-semibold", m.c)}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
