import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Target as TargetIcon } from "lucide-react";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useUserTable } from "@/hooks/use-user-table";
import { useHoldings } from "@/hooks/use-ledger";
import { GoalFormModal, type Goal } from "@/components/GoalFormModal";
import { toast } from "sonner";

export const Route = createFileRoute("/goals")({ component: GoalsPage });

function GoalsPage() {
  const { rows, loading, remove } = useUserTable<Goal>("goals");
  const { totals, accountValue, holdings, accounts, assets } = useHoldings();
  const [open, setOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);

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

  const handleDelete = async (g: Goal) => {
    try { await remove(g.id); toast.success("Goal archived"); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Goals" subtitle="Targets computed live from your ledger — no manual updates."
        action={<Button className="bg-cyan text-background hover:bg-cyan/90" onClick={() => { setEditGoal(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New goal</Button>} />

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
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditGoal(g); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(g)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
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

      <GoalFormModal open={open} onClose={() => { setOpen(false); setEditGoal(null); }} edit={editGoal} />
    </div>
  );
}
