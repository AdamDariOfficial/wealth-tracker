import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, BookOpen, Upload, X, Lock, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/Modal";
import { AccountPicker } from "@/components/AccountPicker";
import { useTrading } from "@/hooks/use-trading";
import { recordWeeklyPnl, reverseTransaction } from "@/lib/ledger-actions";
import { computeConsistency, type WeeklyReport } from "@/lib/trading-engine";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

export function WeeklyTab() {
  const { user } = useAuth();
  const { accounts, weekly, weeklyApi, metrics } = useTrading();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [brokerAccountId, setBrokerAccountId] = useState("");
  const [form, setForm] = useState({
    week_start: today(), pnl: 0, winrate: 0, avg_rr: 0, num_trades: 0,
    max_drawdown: 0, discipline_score: 70, psychology_score: 70, notes: "", lessons: "", is_draft: false,
  });

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !user) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of files) {
        const ext = f.name.split(".").pop() || "png";
        const path = `${user.id}/${form.week_start}-${Date.now()}-${urls.length}.${ext}`;
        const { error } = await supabase.storage.from("weekly-screenshots").upload(path, f, { upsert: false });
        if (error) throw error;
        urls.push(path);
      }
      setScreenshots((s) => [...s, ...urls]);
      toast.success(`${urls.length} screenshot(s) uploaded`);
    } catch (err: any) { toast.error(err.message ?? "Upload failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const willPost = !!brokerAccountId && !!Number(form.pnl);
  const openConfirm = () => { if (willPost) setConfirmOpen(true); else commit(); };

  const commit = async () => {
    try {
      const consistency = computeConsistency(form);
      let posted_transaction_id: string | null = null;
      if (willPost) {
        posted_transaction_id = await recordWeeklyPnl({
          brokerAccountId, pnl: Number(form.pnl),
          ts: new Date(form.week_start).toISOString(),
          note: `Weekly P&L · ${form.week_start}`,
        });
      }
      await weeklyApi.insert({
        ...form, consistency_score: consistency, screenshots,
        broker_account_id: brokerAccountId || null, posted_transaction_id,
      } as any);
      await weeklyApi.refresh();
      toast.success(posted_transaction_id ? "Review saved · P&L posted · broker balance reconciled" : "Weekly review saved");
      setConfirmOpen(false); setOpen(false); setScreenshots([]);
    } catch (e: any) { toast.error(e.message); }
  };

  const removeReport = async (r: WeeklyReport) => {
    if (r.finalized_at) { toast.error("Report is finalized. Unlock it first."); return; }
    if (r.posted_transaction_id) { try { await reverseTransaction(r.posted_transaction_id); } catch {} }
    await weeklyApi.remove(r.id);
  };

  const toggleFinalize = async (r: WeeklyReport) => {
    try {
      await weeklyApi.update(r.id, { finalized_at: r.finalized_at ? null : new Date().toISOString() } as any);
      toast.success(r.finalized_at ? "Report unlocked" : "Report finalized — now immutable");
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
  };

  const equityCurve = weekly.slice().reverse().reduce<{ idx: number; equity: number; week: string }[]>((acc, r, i) => {
    const prev = acc[i - 1]?.equity ?? 0;
    acc.push({ idx: i + 1, equity: prev + Number(r.pnl), week: r.week_start });
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-display text-lg font-semibold">Weekly Reviews</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Finalized reports are immutable to preserve long-term analytics integrity.
          </p>
        </div>
        <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Review
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { l: "Last P&L", v: weekly[0] ? `${Number(weekly[0].pnl) >= 0 ? "+" : ""}$${Number(weekly[0].pnl).toFixed(2)}` : "—",
            c: weekly[0] && Number(weekly[0].pnl) >= 0 ? "text-success" : "text-destructive" },
          { l: "Avg Consistency", v: `${metrics.consistencyScore}/100`, c: "text-cyan" },
          { l: "Total Reviews", v: `${metrics.weeklyCount}` },
        ].map((s) => (
          <motion.div key={s.l} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className={cn("font-display text-3xl font-semibold mt-2", s.c)}>{s.v}</div>
          </motion.div>
        ))}
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4 text-cyan" /> Cumulative Weekly P&L</h3>
        {equityCurve.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No reviews yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 0.3)" />
              <XAxis dataKey="week" stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: "oklch(0.18 0.008 240)", border: "1px solid oklch(0.3 0.01 240)", borderRadius: 12, fontSize: 12 }} />
              <Line dataKey="equity" stroke="hsl(190 90% 60%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(190 90% 60%)" }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-5 font-display font-semibold">Review History</div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-y border-border/40">
            <tr>{["Week", "P&L", "Win%", "R:R", "Trades", "DD", "Disc", "Psych", "Cons", "Status", ""].map(h => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {weekly.length === 0 && <tr><td colSpan={11} className="px-5 py-12 text-center text-muted-foreground">No reviews.</td></tr>}
            {weekly.map((r) => (
              <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20">
                <td className="px-4 py-3 font-mono text-xs">{r.week_start}</td>
                <td className={cn("px-4 py-3 font-mono font-semibold", Number(r.pnl) >= 0 ? "text-success" : "text-destructive")}>{Number(r.pnl) >= 0 ? "+" : ""}${Number(r.pnl).toFixed(2)}</td>
                <td className="px-4 py-3 font-mono">{r.winrate}%</td>
                <td className="px-4 py-3 font-mono">{Number(r.avg_rr).toFixed(2)}</td>
                <td className="px-4 py-3 font-mono">{r.num_trades}</td>
                <td className="px-4 py-3 font-mono text-destructive">{r.max_drawdown}%</td>
                <td className="px-4 py-3 font-mono">{r.discipline_score}</td>
                <td className="px-4 py-3 font-mono">{r.psychology_score}</td>
                <td className="px-4 py-3 font-mono text-cyan font-semibold">{r.consistency_score}</td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="sm" onClick={() => toggleFinalize(r)} className="h-7 text-[11px]">
                    {r.finalized_at
                      ? <><Lock className="h-3 w-3 mr-1 text-cyan" /> Finalized</>
                      : <><Unlock className="h-3 w-3 mr-1 text-muted-foreground" /> Draft</>}
                  </Button>
                </td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="icon" disabled={!!r.finalized_at} onClick={() => removeReport(r)}>
                    <Trash2 className={cn("h-3.5 w-3.5", r.finalized_at ? "text-muted-foreground/40" : "text-destructive")} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New weekly review"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button className="bg-cyan text-background hover:bg-cyan/90" onClick={openConfirm}>{willPost ? "Review & post" : "Save review"}</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Week start</Label><Input type="date" value={form.week_start} onChange={(e) => setForm({...form, week_start: e.target.value})} className="mt-1" /></div>
          <div><Label className="text-xs"># Trades</Label><Input type="number" value={form.num_trades || ""} onChange={(e) => setForm({...form, num_trades: +e.target.value})} className="mt-1" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">P&L $</Label><Input type="number" step="any" value={form.pnl || ""} onChange={(e) => setForm({...form, pnl: +e.target.value})} className="mt-1" /></div>
          <div><Label className="text-xs">Max drawdown %</Label><Input type="number" step="0.1" value={form.max_drawdown || ""} onChange={(e) => setForm({...form, max_drawdown: +e.target.value})} className="mt-1" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Winrate %</Label><Input type="number" step="0.1" value={form.winrate || ""} onChange={(e) => setForm({...form, winrate: +e.target.value})} className="mt-1" /></div>
          <div><Label className="text-xs">Avg R:R</Label><Input type="number" step="0.01" value={form.avg_rr || ""} onChange={(e) => setForm({...form, avg_rr: +e.target.value})} className="mt-1" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Discipline (0–100)</Label><Input type="number" min={0} max={100} value={form.discipline_score} onChange={(e) => setForm({...form, discipline_score: +e.target.value})} className="mt-1" /></div>
          <div><Label className="text-xs">Psychology (0–100)</Label><Input type="number" min={0} max={100} value={form.psychology_score} onChange={(e) => setForm({...form, psychology_score: +e.target.value})} className="mt-1" /></div>
        </div>
        <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="mt-1" rows={2} /></div>
        <div><Label className="text-xs">Lessons</Label><Textarea value={form.lessons} onChange={(e) => setForm({...form, lessons: e.target.value})} className="mt-1" rows={2} /></div>
        <AccountPicker value={brokerAccountId} onChange={setBrokerAccountId} label="Post P&L to broker account (optional)" filter={(a) => a.type === "broker"} />
        <div>
          <Label className="text-xs">Screenshots</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {screenshots.map((path, i) => (
              <div key={i} className="relative h-16 w-16 rounded-lg glass-strong flex items-center justify-center text-[10px] font-mono text-muted-foreground">
                #{i + 1}
                <button type="button" onClick={() => setScreenshots((s) => s.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive flex items-center justify-center">
                  <X className="h-3 w-3 text-background" />
                </button>
              </div>
            ))}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onUpload} />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> {uploading ? "Uploading…" : "Add"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm weekly P&L posting"
        footer={<><Button variant="outline" onClick={() => setConfirmOpen(false)}>Back</Button>
          <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={commit}>Confirm & post</Button></>}>
        <p className="text-sm text-muted-foreground">A <span className="text-cyan font-mono">profit_realization</span> transaction will be inserted into the ledger and the broker account balance will be reconciled automatically.</p>
        <div className="glass-strong rounded-xl p-4 text-xs font-mono space-y-2 mt-2">
          <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="text-cyan">profit_realization</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">To account</span><span>{accounts.find((a) => a.id === brokerAccountId)?.name ?? brokerAccountId}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Amount</span>
            <span className={Number(form.pnl) >= 0 ? "text-success" : "text-destructive"}>
              {Number(form.pnl) >= 0 ? "+" : ""}${Number(form.pnl).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between"><span className="text-muted-foreground">Timestamp</span><span>{form.week_start}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Note</span><span>Weekly P&L · {form.week_start}</span></div>
        </div>
      </Modal>
    </div>
  );
}
