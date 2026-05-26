import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  Pencil, Archive, RotateCcw, Wallet, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useAccounts, useTransactions, useAssets, useHoldings,
  type Account, type Transaction,
} from "@/hooks/use-ledger";
import { useUserTable } from "@/hooks/use-user-table";
import { useMoneyFormatter } from "@/lib/format-currency";
import { useUI } from "@/lib/ui-store";
import { ActivityFeed } from "@/components/ActivityFeed";
import { AccountFormModal } from "@/components/AccountFormModal";
import { reconstructFromLedger } from "@/lib/history-reconstruction";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/accounts/$id")({ component: AccountDetail });

type Goal = {
  id: string; name: string; target_amount: number; current_amount: number;
  target_account_id: string | null; archived_at: string | null;
};

function AccountDetail() {
  const { id } = Route.useParams();
  const { rows: accounts, update } = useAccounts();
  const { rows: txs } = useTransactions();
  const { rows: assets } = useAssets();
  const { holdings, accountValue, totals } = useHoldings();
  const { rows: goals } = useUserTable<Goal>("goals", { col: "created_at", asc: false });
  const { openTxModal } = useUI();
  const fmt = useMoneyFormatter();
  const [editOpen, setEditOpen] = useState(false);

  const account = accounts.find((a) => a.id === id);

  const acctTx = useMemo(
    () => txs.filter((t) => t.source_account_id === id || t.destination_account_id === id),
    [txs, id],
  );

  // Per-account balance evolution using the same reconstruction engine the
  // dashboard uses — never inline math.
  const series = useMemo(() => {
    if (!account) return [];
    const pts = reconstructFromLedger([account], txs);
    return pts.map((p) => ({ date: p.date, value: p.netWorth }));
  }, [account, txs]);

  // Monthly inflow / outflow distribution
  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; in: number; out: number }>();
    for (const t of acctTx) {
      if (t.voided_at) continue;
      const month = t.execution_timestamp.slice(0, 7);
      const cur = m.get(month) ?? { month, in: 0, out: 0 };
      const v = Number(t.base_value ?? t.fiat_value ?? 0);
      if (t.destination_account_id === id) cur.in += v;
      if (t.source_account_id === id) cur.out += v;
      m.set(month, cur);
    }
    return Array.from(m.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [acctTx, id]);

  if (!account) return <div className="text-muted-foreground">Account not found.</div>;

  const value = accountValue.get(id) ?? Number(account.current_balance);
  const allocation = totals.netWorth > 0 ? (value / totals.netWorth) * 100 : 0;
  const acctHoldings = holdings.filter((h) => h.accountId === id);
  const linkedGoals = goals.filter((g) => g.target_account_id === id && !g.archived_at);
  const inflows = acctTx.filter((t) => t.destination_account_id === id && !t.voided_at);
  const outflows = acctTx.filter((t) => t.source_account_id === id && !t.voided_at);
  const transferGroups = new Set(acctTx.map((t) => t.transfer_group_id).filter(Boolean));
  const counterpartIds = new Set<string>();
  for (const t of acctTx) {
    const other = t.source_account_id === id ? t.destination_account_id : t.source_account_id;
    if (other && other !== id) counterpartIds.add(other);
  }
  const counterparts = accounts.filter((a) => counterpartIds.has(a.id));
  const symbolFor = (aid: string) => assets.find((a) => a.id === aid)?.symbol ?? "—";

  const archive = async () => {
    if (!confirm(`Archive ${account.name}? Historical data is preserved.`)) return;
    try {
      await update(id, { archived_at: account.archived_at ? null : new Date().toISOString() });
      toast.success(account.archived_at ? "Account restored" : "Account archived");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/accounts" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-cyan">
          <ArrowLeft className="h-3 w-3" /> Accounts
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openTxModal({ type: "deposit", accountId: id })}>
            <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" /> Deposit
          </Button>
          <Button variant="outline" size="sm" onClick={() => openTxModal({ type: "withdrawal", accountId: id })}>
            <ArrowUpFromLine className="h-3.5 w-3.5 mr-1.5" /> Withdraw
          </Button>
          <Button variant="outline" size="sm" onClick={() => openTxModal({ type: "transfer", accountId: id })}>
            <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Transfer
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={archive}>
            {account.archived_at ? <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> : <Archive className="h-3.5 w-3.5 mr-1.5" />}
            {account.archived_at ? "Restore" : "Archive"}
          </Button>
        </div>
      </div>

      <PageHeader
        title={account.name}
        subtitle={`${account.type.replace("_", " ")} · ${account.currency}${account.provider ? ` · ${account.provider}` : ""}${account.archived_at ? " · archived" : ""}`}
      />

      {/* Overview tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-[var(--gradient-glow)] pointer-events-none" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current value</div>
            <div className="font-display text-4xl font-bold mt-2 text-gradient-cyan">{fmt(value)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {allocation.toFixed(1)}% of net worth · {acctTx.length} transactions
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Holdings</div>
          <div className="font-display text-2xl font-semibold mt-2">{acctHoldings.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Asset positions</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Transfer pairs</div>
          <div className="font-display text-2xl font-semibold mt-2">{transferGroups.size}</div>
          <div className="text-xs text-muted-foreground mt-1">{counterparts.length} linked accounts</div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/40 border border-border/40 h-10">
          <TabsTrigger value="overview" className="px-4">Overview</TabsTrigger>
          <TabsTrigger value="holdings" className="px-4">Holdings</TabsTrigger>
          <TabsTrigger value="flows" className="px-4">Flows</TabsTrigger>
          <TabsTrigger value="timeline" className="px-4">Timeline</TabsTrigger>
          <TabsTrigger value="analytics" className="px-4">Analytics</TabsTrigger>
          <TabsTrigger value="linked" className="px-4">Linked</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-4">
          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan" /> Balance evolution
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Reconstructed from the ledger — every transaction replayed chronologically.
            </p>
            {series.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-12">No movements yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="balG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(190 90% 60%)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(190 90% 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 0.3)" />
                  <XAxis dataKey="date" stroke="oklch(0.6 0 0)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="oklch(0.6 0 0)" fontSize={10} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `${(v/1000).toFixed(1)}k`} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.008 240)", border: "1px solid oklch(0.3 0.01 240)", borderRadius: 12, fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="hsl(190 90% 60%)" strokeWidth={2} fill="url(#balG)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {account.description && (
            <div className="glass rounded-2xl p-5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
              <div className="text-sm">{account.description}</div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="holdings" className="mt-6">
          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-semibold text-sm">Asset positions</h3>
            {acctHoldings.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-12">
                No asset holdings — this account only holds cash.
              </div>
            ) : (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left py-2">Asset</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Avg cost</th>
                      <th className="text-right">Cost basis</th>
                      <th className="text-right">Market value</th>
                      <th className="text-right">Unrealized P&L</th>
                      <th className="text-right">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acctHoldings.map((h) => {
                      const alloc = value > 0 ? (h.marketValue / value) * 100 : 0;
                      return (
                        <tr key={h.accountId + h.assetId} className="border-t border-white/5">
                          <td className="py-2 font-medium">{symbolFor(h.assetId)}</td>
                          <td className="text-right font-mono">{h.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                          <td className="text-right font-mono">{fmt(h.avgCost)}</td>
                          <td className="text-right font-mono text-muted-foreground">{fmt(h.costBasis)}</td>
                          <td className="text-right font-mono">{fmt(h.marketValue)}</td>
                          <td className={cn("text-right font-mono", h.unrealizedPnl >= 0 ? "text-success" : "text-destructive")}>
                            {h.unrealizedPnl >= 0 ? "+" : ""}{fmt(h.unrealizedPnl)}
                          </td>
                          <td className="text-right text-muted-foreground">{alloc.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="flows" className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FlowList title="Incoming" tone="positive" txs={inflows} accounts={accounts} fmt={fmt} accountId={id} />
            <FlowList title="Outgoing" tone="negative" txs={outflows} accounts={accounts} fmt={fmt} accountId={id} />
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <ActivityFeed filters={{ accountId: id, limit: 200 }} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6 space-y-4">
          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-semibold text-sm">Monthly flow distribution</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Inflows vs outflows over the last 12 months.</p>
            {monthly.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-12">No activity yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 0.3)" />
                  <XAxis dataKey="month" stroke="oklch(0.6 0 0)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="oklch(0.6 0 0)" fontSize={10} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `${(v/1000).toFixed(1)}k`} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.008 240)", border: "1px solid oklch(0.3 0.01 240)", borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="in" name="Inflow" fill="hsl(150 70% 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="out" name="Outflow" fill="hsl(0 70% 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total in" value={fmt(inflows.reduce((s, t) => s + Number(t.base_value ?? t.fiat_value ?? 0), 0))} tone="text-success" />
            <Stat label="Total out" value={fmt(outflows.reduce((s, t) => s + Number(t.base_value ?? t.fiat_value ?? 0), 0))} tone="text-destructive" />
            <Stat label="Velocity / month" value={`${(acctTx.length / Math.max(1, monthly.length)).toFixed(1)} tx`} />
            <Stat label="Allocation" value={`${allocation.toFixed(1)}%`} tone="text-cyan" />
          </div>
        </TabsContent>

        <TabsContent value="linked" className="mt-6 space-y-4">
          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-semibold text-sm">Linked goals</h3>
            {linkedGoals.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">No goals target this account.</div>
            ) : (
              <div className="mt-3 divide-y divide-border/30">
                {linkedGoals.map((g) => (
                  <Link key={g.id} to="/goals" className="flex justify-between py-2.5 hover:text-cyan">
                    <span className="text-sm">{g.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {fmt(g.current_amount)} / {fmt(g.target_amount)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-semibold text-sm">Counterpart accounts</h3>
            {counterparts.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">No related accounts yet.</div>
            ) : (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {counterparts.map((c) => (
                  <Link key={c.id} to="/accounts/$id" params={{ id: c.id }}
                    className="flex items-center gap-3 p-3 rounded-xl glass-strong hover:ring-1 hover:ring-cyan/40">
                    <Wallet className="h-4 w-4 text-cyan" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{c.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.type.replace("_"," ")}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AccountFormModal open={editOpen} onClose={() => setEditOpen(false)} edit={account} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("font-display font-semibold mt-1 text-base", tone)}>{value}</div>
    </div>
  );
}

function FlowList({
  title, tone, txs, accounts, fmt, accountId,
}: {
  title: string; tone: "positive" | "negative";
  txs: Transaction[]; accounts: Account[]; fmt: (n: number) => string; accountId: string;
}) {
  const acctName = (aid: string | null) => aid ? accounts.find((a) => a.id === aid)?.name ?? "—" : "—";
  const sign = tone === "positive" ? "+" : "−";
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-sm">{title}</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{txs.length}</span>
      </div>
      {txs.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-8">No {title.toLowerCase()} flows.</div>
      ) : (
        <div className="divide-y divide-border/30 max-h-[420px] overflow-y-auto">
          {txs.slice(0, 50).map((t) => {
            const counter = t.source_account_id === accountId ? acctName(t.destination_account_id) : acctName(t.source_account_id);
            const v = Number(t.base_value ?? t.fiat_value ?? 0);
            return (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <div className="text-sm capitalize">{t.transaction_type.replace(/_/g, " ")}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {counter}
                    {t.transfer_group_id && <span className="ml-2 text-cyan/70">↔ pair</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("font-mono text-sm font-semibold", tone === "positive" ? "text-success" : "text-destructive")}>
                    {sign}{fmt(v)}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {new Date(t.execution_timestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
