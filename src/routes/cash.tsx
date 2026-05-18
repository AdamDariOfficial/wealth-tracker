import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/Modal";
import { useUserTable } from "@/hooks/use-user-table";
import { toast } from "sonner";

export const Route = createFileRoute("/cash")({ component: CashPage });

type Reserve = { id: string; label: string; purpose: string | null; balance: number };

function CashPage() {
  const { rows, loading, insert, update, remove } = useUserTable<Reserve>("cash_reserves");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", purpose: "", balance: 0 });
  const total = rows.reduce((s, r) => s + Number(r.balance), 0);

  const submit = async () => {
    try { await insert(form); toast.success("Reserve added"); setOpen(false); setForm({ label: "", purpose: "", balance: 0 }); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Cash Reserves" subtitle="Liquidity buffers for opportunities and emergencies."
        action={<Button className="bg-cyan text-background hover:bg-cyan/90" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add reserve</Button>} />

      <div className="glass rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-glow)] pointer-events-none" />
        <div className="relative">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Wallet className="h-3 w-3" /> Total liquidity</div>
          <div className="font-display text-5xl font-bold mt-3 text-gradient-cyan">${total.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <div className="text-muted-foreground col-span-full text-center py-8">Loading…</div>}
        {!loading && rows.length === 0 && <div className="text-muted-foreground col-span-full text-center py-12">No reserves yet.</div>}
        {rows.map((r) => (
          <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display font-semibold">{r.label}</h3>
                <div className="text-xs text-muted-foreground mt-1">{r.purpose ?? "General"}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
            <div className="font-display text-2xl font-semibold mt-4 text-cyan">${Number(r.balance).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
            <div className="flex gap-1 mt-3">
              <Button size="sm" variant="outline" onClick={() => update(r.id, { balance: Math.max(0, Number(r.balance) - 100) })}>-100</Button>
              <Button size="sm" variant="outline" onClick={() => update(r.id, { balance: Number(r.balance) + 100 })}>+100</Button>
              <Button size="sm" variant="outline" onClick={() => update(r.id, { balance: Number(r.balance) + 1000 })}>+1k</Button>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add cash reserve"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button className="bg-cyan text-background hover:bg-cyan/90" onClick={submit}>Add</Button></>}>
        <div><Label className="text-xs">Label</Label><Input value={form.label} onChange={(e) => setForm({...form,label:e.target.value})} className="mt-1" placeholder="Emergency fund" /></div>
        <div><Label className="text-xs">Purpose</Label><Input value={form.purpose} onChange={(e) => setForm({...form,purpose:e.target.value})} className="mt-1" /></div>
        <div><Label className="text-xs">Balance</Label><Input type="number" value={form.balance || ""} onChange={(e) => setForm({...form,balance:+e.target.value})} className="mt-1" /></div>
      </Modal>
    </div>
  );
}
