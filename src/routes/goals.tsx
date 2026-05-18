import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Trash2, Target as TargetIcon } from "lucide-react";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Modal } from "@/components/Modal";
import { useUserTable } from "@/hooks/use-user-table";
import { useHoldings } from "@/hooks/use-ledger";
import { AccountPicker } from "@/components/AccountPicker";
import { AssetPicker } from "@/components/AssetPicker";
import { toast } from "sonner";

export const Route = createFileRoute("/goals")({ component: GoalsPage });

type GoalKind = "net_worth" | "liquid" | "account_balance" | "asset_quantity" | "asset_value" | "custom";
type Goal = {
  id: string; name: string; category: string | null; target_amount: number;
  current_amount: number; target_date: string | null;
  kind: GoalKind; target_account_id?: string | null; target_asset_id?: string | null; target_quantity?: number | null;
};

function GoalsPage() {
  const { rows, loading, insert, remove } = useUserTable<Goal>("goals");
  const { totals, accountValue, holdings, accounts, assets } = useHoldings();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "general", kind: "net_worth" as GoalKind,
    target_amount: 0, target_quantity: 0, target_account_id: "", target_asset_id: "", target_date: "",
  });

  const computeProgress = useMemo(() => (g: Goal) => {
    switch (g.kind) {
      case "net_worth": return { current: totals.netWorth, target: Number(g.target_amount), unit: "$" };
      case "liquid":    return { current: totals.liquid, target: Number(g.target_amount), unit: "$" };
      case "account_balance": {
        const acc = accounts.find((a) => a.id === g.target_account_id);
        const v = acc ? (accountValue.get(acc.id) ?? Number(acc.current_balance ?? 0)) : 0;
        return { current: v, target: Number(g.target_amount), unit: "$" };
      }
      case "asset_quantity": {
        const qty = holdings.filter((h) => h.assetId === g.target_asset_id).reduce((s, h) => s + h.quantity, 0);
        const a = assets.find((x) => x.id === g.target_asset_id);
        return { current: qty, target: Number(g.target_quantity ?? 0), unit: a?.symbol ?? "" };
      }
      case "asset_value": {
        const v = holdings.filter((h) => h.assetId === g.target_asset_id).reduce((s, h) => s + h.marketValue, 0);
        return { current: v, target: Number(g.target_amount), unit: "$" };
      }
      default: return { current: Number(g.current_amount), target: Number(g.target_amount), unit: "$" };
    }
  }, [totals, accountValue, holdings, accounts, assets]);

  const submit = async () => {
    try {
      await insert({
        name: form.name, category: form.category, kind: form.kind,
        target_amount: form.target_amount, target_quantity: form.target_quantity || null,
        target_account_id: form.target_account_id || null, target_asset_id: form.target_asset_id || null,
        target_date: form.target_date || null, current_amount: 0,
      });
      toast.success("Goal created"); setOpen(false);
      setForm({ name: "", category: "general", kind: "net_worth", target_amount: 0, target_quantity: 0, target_account_id: "", target_asset_id: "", target_date: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Goals" subtitle="Targets computed live from your ledger — no manual updates."
        action={<Button className="bg-cyan text-background hover:bg-cyan/90" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New goal</Button>} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <div className="text-muted-foreground col-span-full text-center py-12">Loading…</div>}
        {!loading && rows.length === 0 && <div className="text-muted-foreground col-span-full text-center py-12">No goals yet.</div>}
        {rows.map((g) => {
          const { current, target, unit } = computeProgress(g);
          const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
          return (
            <motion.div key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <TargetIcon className="h-4 w-4 text-cyan" />
                    <h3 className="font-display font-semibold">{g.name}</h3>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 capitalize">{g.kind.replace("_"," ")}{g.target_date ? ` · by ${g.target_date}` : ""}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(g.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="font-display text-2xl font-semibold">{unit === "$" ? `$${current.toLocaleString(undefined,{maximumFractionDigits:2})}` : `${current.toFixed(4)} ${unit}`}</span>
                <span className="text-xs text-muted-foreground font-mono">/ {unit === "$" ? `$${target.toLocaleString()}` : `${target} ${unit}`}</span>
              </div>
              <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className="h-full bg-gradient-to-r from-cyan to-cyan-glow rounded-full" />
              </div>
              <div className="text-xs font-mono text-muted-foreground mt-2">{pct.toFixed(0)}%</div>
            </motion.div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New goal"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button className="bg-cyan text-background hover:bg-cyan/90" onClick={submit}>Create</Button></>}>
        <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} className="mt-1" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Goal type</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as GoalKind })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="net_worth">Net worth target</SelectItem>
                <SelectItem value="liquid">Liquid cash reserve</SelectItem>
                <SelectItem value="account_balance">Specific account balance</SelectItem>
                <SelectItem value="asset_quantity">Asset quantity (e.g. 1 BTC)</SelectItem>
                <SelectItem value="asset_value">Asset market value ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Target date</Label><Input type="date" value={form.target_date} onChange={(e) => setForm({...form,target_date:e.target.value})} className="mt-1" /></div>
        </div>
        {form.kind === "account_balance" && <AccountPicker value={form.target_account_id} onChange={(v) => setForm({...form, target_account_id: v})} label="Account" />}
        {(form.kind === "asset_quantity" || form.kind === "asset_value") && <AssetPicker value={form.target_asset_id} onChange={(v) => setForm({...form, target_asset_id: v})} assetClass="crypto" />}
        {form.kind === "asset_quantity" ? (
          <div><Label className="text-xs">Target quantity</Label><Input type="number" step="any" value={form.target_quantity || ""} onChange={(e) => setForm({...form, target_quantity: +e.target.value})} className="mt-1" /></div>
        ) : (
          <div><Label className="text-xs">Target amount ($)</Label><Input type="number" value={form.target_amount || ""} onChange={(e) => setForm({...form, target_amount: +e.target.value})} className="mt-1" /></div>
        )}
      </Modal>
    </div>
  );
}
