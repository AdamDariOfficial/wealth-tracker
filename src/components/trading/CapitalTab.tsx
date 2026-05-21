import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, Shield, Calculator, AlertTriangle, TrendingDown, ArrowDownLeft, ArrowUpRight, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useTradingAccount } from "@/hooks/use-portfolio";
import { useTrading } from "@/hooks/use-trading";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CapitalTab() {
  const { account, update } = useTradingAccount();
  const { accounts, capital, metrics } = useTrading();
  const [form, setForm] = useState({
    reserve: 0, default_risk_pct: 1, weekly_loss_limit_pct: 5, max_daily_loss_pct: 2, primary_asset: "",
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account && !dirty) {
      setForm({
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
    try { await update(form); toast.success("Risk parameters updated"); setDirty(false); }
    catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(false); }
  };

  // Position sizer
  const [entry, setEntry] = useState(100);
  const [sl, setSL] = useState(98);
  const riskAmount = (metrics.currentCapital * form.default_risk_pct) / 100;
  const stopDist = Math.abs(entry - sl);
  const positionSize = stopDist > 0 ? riskAmount / stopDist : 0;

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-6 lg:col-span-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-[var(--gradient-glow)] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Briefcase className="h-3 w-3" /> Risk Parameters
              </div>
              {dirty && (
                <Button size="sm" onClick={save} disabled={saving} className="bg-cyan text-background hover:bg-cyan/90">
                  <Save className="h-3 w-3 mr-1" />{saving ? "Saving…" : "Save"}
                </Button>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Capital is derived from broker / exchange / investment accounts. Edit balances in
              <span className="text-foreground"> Liquidity & Accounts</span> — balances reconcile from the ledger automatically.
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { l: "Deposited", v: metrics.capitalDeposited, c: "text-success" },
          { l: "Withdrawn", v: metrics.capitalWithdrawn, c: "text-destructive" },
          { l: "Net Capital", v: metrics.netCapital, c: "text-cyan" },
        ].map((s) => (
          <div key={s.l} className="glass rounded-2xl p-5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className={cn("font-display text-2xl font-semibold mt-2", s.c)}>${s.v.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-5 font-display font-semibold">Capital Movements</div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-y border-border/40">
            <tr>{["Date", "Type", "Account", "Amount", "Note"].map((h) => <th key={h} className="text-left font-medium px-5 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {capital.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">No capital flows yet.</td></tr>
            )}
            {capital.slice().reverse().map((m) => (
              <tr key={m.id} className="border-b border-border/30 hover:bg-muted/20">
                <td className="px-5 py-3 font-mono text-xs">{m.date}</td>
                <td className="px-5 py-3">
                  <span className={cn("inline-flex items-center gap-1 text-xs", m.amount >= 0 ? "text-success" : "text-destructive")}>
                    {m.amount >= 0 ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                    {m.kind.replace("_", " ")}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs">{accountById.get(m.accountId)?.name ?? "—"}</td>
                <td className={cn("px-5 py-3 font-mono font-semibold", m.amount >= 0 ? "text-success" : "text-destructive")}>
                  {m.amount >= 0 ? "+" : ""}${Math.abs(m.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{m.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
