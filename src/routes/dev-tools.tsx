import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Database, Sparkles, Trash2, CheckCircle2, AlertTriangle, RefreshCw, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { seedRealisticPortfolio, resetUserData, type SeedResult } from "@/lib/seed-data";
import { useHoldings } from "@/hooks/use-ledger";
import { useMoneyFormatter } from "@/lib/format-currency";
import { supabase } from "@/integrations/supabase/client";
import { dec } from "@/lib/decimal";

export const Route = createFileRoute("/dev-tools")({ component: DevToolsPage });

function Card({ icon: Icon, title, desc, children }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl glass-strong flex items-center justify-center text-cyan">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-display font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </motion.div>
  );
}

type ReconRow = { accountId: string; accountName: string; stored: number; computed: number; delta: number };

function DevToolsPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [lastSeed, setLastSeed] = useState<SeedResult | null>(null);
  const [reconRun, setReconRun] = useState(false);
  const fmt = useMoneyFormatter();
  const { accounts, computedCashByAccount } = useHoldings();

  // Reconciliation is derived live from the engine — no separate query.
  const recon = useMemo<ReconRow[]>(() => {
    return accounts.map((a) => {
      const stored = Number(a.current_balance ?? 0);
      const computed = computedCashByAccount.get(a.id) ?? 0;
      return {
        accountId: a.id,
        accountName: a.name,
        stored: dec.round(stored, 2),
        computed: dec.round(computed, 2),
        delta: dec.round(computed - stored, 2),
      };
    });
  }, [accounts, computedCashByAccount]);

  const drift = recon.filter((r) => Math.abs(r.delta) > 0.01);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(null); }
  };

  const onSeed = () => run("seed", async () => {
    const res = await seedRealisticPortfolio();
    setLastSeed(res);
    toast.success(`Seeded ${res.transactions} transactions across ${res.accounts} accounts`);
  });

  const onReset = () => {
    if (!confirm("This wipes all your accounts, assets and transactions. Continue?")) return;
    run("reset", async () => {
      await resetUserData();
      setLastSeed(null);
      setReconRun(false);
      toast.success("Workspace reset");
    });
  };

  const onRegenerate = () => {
    if (!confirm("Reset and regenerate a fresh test portfolio?")) return;
    run("regen", async () => {
      await resetUserData();
      const res = await seedRealisticPortfolio();
      setLastSeed(res);
      toast.success(`Regenerated: ${res.transactions} transactions`);
    });
  };

  const onCheck = () => {
    setReconRun(true);
    if (drift.length === 0) toast.success("All balances reconcile with the ledger");
    else toast.warning(`${drift.length} account(s) drift from ledger`);
  };

  const onReconcileAll = () => run("fix", async () => {
    // Call the DB recompute function for every drifting account. The function
    // is the same one the trigger uses, so this is the canonical fix.
    const targets = drift.length ? drift : recon;
    for (const r of targets) {
      const { error } = await (supabase as any).rpc("recompute_account_balance", { _account_id: r.accountId });
      if (error) throw error;
    }
    toast.success(`Reconciled ${targets.length} account(s)`);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dev Tools"
        subtitle="Seed test data, reset, and validate ledger consistency."
        action={
          <div className="flex items-center gap-2 glass rounded-xl px-3 py-2 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Not for production use
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card icon={Sparkles} title="Seed realistic portfolio"
          desc="Creates 8 accounts, 10 assets and ~220 transactions across 9 months.">
          <Button onClick={onSeed} disabled={!!busy} className="bg-cyan text-background hover:bg-cyan/90">
            {busy === "seed" ? "Seeding…" : "Generate test portfolio"}
          </Button>
          {lastSeed && (
            <div className="text-xs text-muted-foreground font-mono">
              Inserted: {lastSeed.accounts} accounts · {lastSeed.assets} assets · {lastSeed.transactions} transactions
            </div>
          )}
        </Card>

        <Card icon={RefreshCw} title="Regenerate" desc="Wipe and rebuild a fresh dataset in one step.">
          <Button variant="outline" onClick={onRegenerate} disabled={!!busy}>
            {busy === "regen" ? "Regenerating…" : "Reset & regenerate"}
          </Button>
        </Card>

        <Card icon={Trash2} title="Reset workspace"
          desc="Deletes every account, asset and transaction for your user. Profile is kept.">
          <Button variant="destructive" onClick={onReset} disabled={!!busy}>
            {busy === "reset" ? "Resetting…" : "Wipe all data"}
          </Button>
        </Card>

        <Card icon={Database} title="Reconciliation check"
          desc="Compares engine-recomputed balances with the trigger-maintained accounts.current_balance.">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCheck} disabled={!!busy}>Run consistency check</Button>
            <Button variant="outline" onClick={onReconcileAll} disabled={!!busy || (reconRun && drift.length === 0)}>
              <Wand2 className="h-3.5 w-3.5 mr-1" />
              {busy === "fix" ? "Fixing…" : drift.length ? `Reconcile ${drift.length}` : "Reconcile all"}
            </Button>
          </div>
          {reconRun && (
            <div className="rounded-lg overflow-hidden border border-border/50 mt-3">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 font-medium text-right">Stored</th>
                    <th className="px-3 py-2 font-medium text-right">Engine</th>
                    <th className="px-3 py-2 font-medium text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {recon.map((r) => {
                    const ok = Math.abs(r.delta) <= 0.01;
                    return (
                      <tr key={r.accountId} className="border-t border-border/50">
                        <td className="px-3 py-2">{r.accountName}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(r.stored)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(r.computed)}</td>
                        <td className={`px-3 py-2 text-right font-mono ${ok ? "text-success" : "text-amber-400"}`}>
                          {ok ? <CheckCircle2 className="h-3.5 w-3.5 inline" /> : fmt(r.delta)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
