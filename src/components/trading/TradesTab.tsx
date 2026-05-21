import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/Modal";
import { useUserTable } from "@/hooks/use-user-table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Trade = {
  id: string;
  trade_date: string;
  asset: string;
  direction: "Long" | "Short";
  entry: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  pnl: number;
  rr: number | null;
  rating: number;
  setup: string | null;
  session: string | null;
  notes: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);
const blank = {
  trade_date: today(), asset: "", direction: "Long" as const,
  entry: 0, stop_loss: 0, take_profit: 0, pnl: 0, rr: 0, rating: 3,
  setup: "", session: "", notes: "",
};

export function TradesTab() {
  const { rows, insert, remove } = useUserTable<Trade>("trades", { col: "trade_date", asc: false });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);

  const stats = useMemo(() => {
    if (rows.length === 0) return { wins: 0, losses: 0, winRate: 0, totalPnl: 0, avgRR: 0 };
    const wins = rows.filter((r) => Number(r.pnl) > 0).length;
    const losses = rows.filter((r) => Number(r.pnl) < 0).length;
    const totalPnl = rows.reduce((s, r) => s + Number(r.pnl ?? 0), 0);
    const avgRR = rows.reduce((s, r) => s + Number(r.rr ?? 0), 0) / rows.length;
    return { wins, losses, winRate: (wins / rows.length) * 100, totalPnl, avgRR };
  }, [rows]);

  const save = async () => {
    try {
      await insert(form as any);
      toast.success("Trade logged");
      setOpen(false);
      setForm(blank);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-display text-lg font-semibold">Trade Journal</h2>
          <p className="text-xs text-muted-foreground mt-1">Per-trade execution log. Individual entries — aggregates roll up to weekly reviews.</p>
        </div>
        <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Log Trade
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: "Total P&L", v: `${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl.toFixed(2)}`, c: stats.totalPnl >= 0 ? "text-success" : "text-destructive" },
          { l: "Win Rate", v: `${stats.winRate.toFixed(1)}%` },
          { l: "Avg R:R", v: stats.avgRR.toFixed(2), c: "text-cyan" },
          { l: "Trades", v: `${rows.length}` },
        ].map((s) => (
          <div key={s.l} className="glass rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className={cn("font-display text-2xl font-semibold mt-1", s.c)}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-y border-border/40">
            <tr>{["Date", "Asset", "Side", "Entry", "SL", "TP", "P&L", "R:R", "Setup", ""].map((h) => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={10} className="px-5 py-12 text-center text-muted-foreground">No trades logged yet.</td></tr>}
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-border/30 hover:bg-muted/20">
                <td className="px-4 py-3 font-mono text-xs">{t.trade_date}</td>
                <td className="px-4 py-3 font-medium">{t.asset}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded", t.direction === "Long" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>{t.direction}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{t.entry ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.stop_loss ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.take_profit ?? "—"}</td>
                <td className={cn("px-4 py-3 font-mono font-semibold", Number(t.pnl) >= 0 ? "text-success" : "text-destructive")}>{Number(t.pnl) >= 0 ? "+" : ""}${Number(t.pnl).toFixed(2)}</td>
                <td className="px-4 py-3 font-mono">{Number(t.rr ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{t.setup ?? "—"}</td>
                <td className="px-4 py-3"><Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Log a trade"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button className="bg-cyan text-background hover:bg-cyan/90" onClick={save}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Date</Label><Input type="date" value={form.trade_date} onChange={(e) => setForm({ ...form, trade_date: e.target.value })} className="mt-1" /></div>
          <div><Label className="text-xs">Asset</Label><Input value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })} placeholder="ES, BTC, AAPL…" className="mt-1" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Direction</Label>
            <select className="mt-1 w-full h-9 rounded-md bg-background border border-input px-2 text-sm"
              value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as "Long" | "Short" })}>
              <option>Long</option><option>Short</option>
            </select>
          </div>
          <div><Label className="text-xs">Setup</Label><Input value={form.setup} onChange={(e) => setForm({ ...form, setup: e.target.value })} className="mt-1" /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label className="text-xs">Entry</Label><Input type="number" step="any" value={form.entry || ""} onChange={(e) => setForm({ ...form, entry: +e.target.value })} className="mt-1" /></div>
          <div><Label className="text-xs">Stop Loss</Label><Input type="number" step="any" value={form.stop_loss || ""} onChange={(e) => setForm({ ...form, stop_loss: +e.target.value })} className="mt-1" /></div>
          <div><Label className="text-xs">Take Profit</Label><Input type="number" step="any" value={form.take_profit || ""} onChange={(e) => setForm({ ...form, take_profit: +e.target.value })} className="mt-1" /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label className="text-xs">P&L</Label><Input type="number" step="any" value={form.pnl || ""} onChange={(e) => setForm({ ...form, pnl: +e.target.value })} className="mt-1" /></div>
          <div><Label className="text-xs">R:R</Label><Input type="number" step="0.01" value={form.rr || ""} onChange={(e) => setForm({ ...form, rr: +e.target.value })} className="mt-1" /></div>
          <div><Label className="text-xs">Rating</Label><Input type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm({ ...form, rating: +e.target.value })} className="mt-1" /></div>
        </div>
        <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1" /></div>
      </Modal>
    </div>
  );
}
