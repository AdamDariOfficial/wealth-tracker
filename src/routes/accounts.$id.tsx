import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAccounts, useTransactions, useAssets, useHoldings } from "@/hooks/use-ledger";
import { TransactionModal } from "@/components/TransactionModal";

export const Route = createFileRoute("/accounts/$id")({ component: AccountDetail });

const TYPE_FLOW: Record<string, "in" | "out" | "neutral"> = {
  deposit: "in", dividend: "in", interest: "in", staking_reward: "in", profit_realization: "in", buy: "in",
  withdrawal: "out", fee: "out", sell: "out",
  transfer: "neutral", convert: "neutral", manual_adjustment: "neutral",
};

function AccountDetail() {
  const { id } = Route.useParams();
  const { rows: accounts } = useAccounts();
  const { rows: txs } = useTransactions();
  const { rows: assets } = useAssets();
  const { accountValue } = useHoldings();
  const [open, setOpen] = useState(false);

  const account = accounts.find((a) => a.id === id);
  const acctTx = useMemo(
    () => txs.filter((t) => t.source_account_id === id || t.destination_account_id === id),
    [txs, id],
  );

  const series = useMemo(() => {
    const sorted = [...acctTx].sort((a, b) => +new Date(a.execution_timestamp) - +new Date(b.execution_timestamp));
    let bal = 0;
    return sorted.map((t) => {
      const flow = TYPE_FLOW[t.transaction_type];
      const v = Number(t.fiat_value || 0);
      if (t.destination_account_id === id) bal += v;
      if (t.source_account_id === id) bal -= v;
      return { ts: new Date(t.execution_timestamp).toLocaleString(), value: bal };
    });
  }, [acctTx, id]);

  if (!account) return <div className="text-muted-foreground">Account not found.</div>;
  const symbolFor = (aid: string | null) => aid ? assets.find((a) => a.id === aid)?.symbol ?? "—" : "—";
  const acctName = (aid: string | null) => aid ? accounts.find((a) => a.id === aid)?.name ?? "—" : "—";
  const value = accountValue.get(id) ?? Number(account.current_balance);

  return (
    <div className="space-y-6">
      <Link to="/accounts" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-cyan"><ArrowLeft className="h-3 w-3" /> Accounts</Link>
      <PageHeader title={account.name} subtitle={`${account.type.replace("_", " ")} · ${account.currency}`}
        action={<Button className="bg-cyan text-background hover:bg-cyan/90" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Transaction</Button>} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-6 md:col-span-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Current value</div>
          <div className="font-display text-4xl font-bold mt-3 text-gradient-cyan">${value.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
          <div className="text-xs text-muted-foreground mt-2">{acctTx.length} transactions</div>
        </div>
        <div className="glass rounded-2xl p-5 md:col-span-2">
          <h3 className="font-display font-semibold mb-3">Balance history</h3>
          {series.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-12">No movements yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(190 90% 60%)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(190 90% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 0.3)" />
                <XAxis dataKey="ts" stroke="oklch(0.6 0 0)" fontSize={10} tickLine={false} axisLine={false} hide />
                <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.008 240)", border: "1px solid oklch(0.3 0.01 240)", borderRadius: 12, fontSize: 12 }} />
                <Area dataKey="value" stroke="hsl(190 90% 60%)" strokeWidth={2} fill="url(#bal)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-display font-semibold mb-4">Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground text-[11px] uppercase tracking-wider">
              <tr><th className="text-left py-2">When</th><th className="text-left">Type</th><th className="text-left">Asset</th><th className="text-right">Qty</th><th className="text-right">Fiat</th><th className="text-left pl-3">Counterparty</th><th className="text-left">Note</th></tr>
            </thead>
            <tbody>
              {acctTx.map((t) => {
                const flow = TYPE_FLOW[t.transaction_type];
                const counter = t.source_account_id === id ? acctName(t.destination_account_id) : acctName(t.source_account_id);
                return (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="py-2">{new Date(t.execution_timestamp).toLocaleString()}</td>
                    <td><span className={flow === "in" ? "text-success" : flow === "out" ? "text-destructive" : "text-muted-foreground"}>{t.transaction_type}</span></td>
                    <td>{symbolFor(t.asset_id)}</td>
                    <td className="text-right font-mono">{Number(t.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                    <td className="text-right font-mono">${Number(t.fiat_value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="pl-3 text-muted-foreground">{counter}</td>
                    <td className="text-muted-foreground">{t.note}</td>
                  </tr>
                );
              })}
              {acctTx.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No transactions.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <TransactionModal open={open} onClose={() => setOpen(false)} defaultAccountId={id} />
    </div>
  );
}
