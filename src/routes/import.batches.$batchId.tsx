import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, RotateCcw, Search, X, CheckCircle2, AlertTriangle,
  ArrowDownToLine, ArrowUpFromLine, Repeat, TrendingUp, TrendingDown,
  Target, Wallet, Coins, ExternalLink, FileText, ShieldCheck, Copy,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useAssets } from "@/hooks/use-ledger";
import { useUserTable } from "@/hooks/use-user-table";
import { useAuth } from "@/lib/auth-store";
import { formatMoney } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import { RollbackDialog } from "@/components/import/RollbackDialog";
import type { ImportRowRecord } from "@/lib/import-engine";

export const Route = createFileRoute("/import/batches/$batchId")({ component: BatchReport });

type Batch = {
  id: string;
  label: string | null;
  created_at: string;
  imported_count: number;
  error_count: number;
  source_text: string;
  errors: any;
  summary: any;
  rolled_back_at: string | null;
};

type GoalRow = { id: string; name: string };

function BatchReport() {
  const { batchId } = Route.useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const ccy = profile?.currency ?? "USD";
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const { rows: goals } = useUserTable<GoalRow>("goals", { col: "name", asc: true });

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all"|"committed"|"skipped"|"errors">("all");
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [batchId]);
  async function refresh() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("import_batches").select("*").eq("id", batchId).single();
    if (error) toast.error(error.message);
    setBatch(data ?? null);
    setLoading(false);
  }

  const rows: ImportRowRecord[] = useMemo(() => batch?.summary?.row_records ?? [], [batch]);
  const summary = batch?.summary ?? {};
  const acctById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  const filtered = useMemo(() => {
    let out = rows;
    if (kindFilter !== "all") out = out.filter((r) => r.kind === kindFilter);
    if (statusFilter === "committed") out = out.filter((r) => !r.skipped && !r.error);
    else if (statusFilter === "skipped") out = out.filter((r) => r.skipped);
    else if (statusFilter === "errors") out = out.filter((r) => r.error);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) =>
        r.raw.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.category ?? "").toLowerCase().includes(q),
      );
    }
    return out;
  }, [rows, kindFilter, statusFilter, search]);

  const counts = useMemo(() => {
    let committed = 0, skipped = 0, errored = 0;
    for (const r of rows) {
      if (r.error) errored++;
      else if (r.skipped) skipped++;
      else committed++;
    }
    return { committed, skipped, errored };
  }, [rows]);

  const opsBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.skipped || r.error) continue;
      map.set(r.kind, (map.get(r.kind) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const accountImpact = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.skipped || r.error || !r.accountId) continue;
      const sign = r.kind === "deposit" || r.kind === "sell" ? +1 :
                   r.kind === "expense" || r.kind === "buy" ? -1 : 0;
      if (sign) map.set(r.accountId, (map.get(r.accountId) ?? 0) + sign * r.amount);
    }
    return Array.from(map.entries()).map(([id, delta]) => ({
      id, delta,
      name: acctById.get(id)?.name ?? "Unknown account",
    })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [rows, acctById]);

  const assetImpact = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.skipped || r.error || !r.assetId) continue;
      if (r.kind === "buy" || r.kind === "asset_open") map.set(r.assetId, (map.get(r.assetId) ?? 0) + 1);
      if (r.kind === "sell") map.set(r.assetId, (map.get(r.assetId) ?? 0) - 1);
    }
    return Array.from(map.entries()).map(([id, n]) => ({
      id, n,
      symbol: assetById.get(id)?.symbol ?? "?",
    }));
  }, [rows, assetById]);

  const rollbackEvents: any[] = summary.rollback_events ?? [];

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading batch…</div>;
  }
  if (!batch) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-sm">Batch not found.</div>
        <Link to="/import" className="text-cyan text-xs underline">← Back to Import</Link>
      </div>
    );
  }

  const importedAt = summary.imported_at ?? batch.created_at;
  const health = summary.healthScore ?? summary.health?.score;
  const tier   = summary.healthTier ?? summary.health?.tier;

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.label || `Import receipt · ${new Date(importedAt).toLocaleString()}`}
        subtitle={
          batch.rolled_back_at
            ? `Rolled back on ${new Date(batch.rolled_back_at).toLocaleString()} — all financial history preserved via voided_at`
            : `Import committed on ${new Date(importedAt).toLocaleString()}`
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/import" })}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
            {!batch.rolled_back_at && (
              <Button size="sm" onClick={() => { setSelectedRows(new Set()); setRollbackOpen(true); }}
                className="bg-warning text-background hover:bg-warning/90">
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Rollback…
              </Button>
            )}
          </div>
        }
      />

      {/* HEADLINE CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ReceiptStat label="Rows imported" value={String(batch.imported_count)} icon={<CheckCircle2 className="h-3.5 w-3.5 text-success" />} />
        <ReceiptStat label="Skipped"       value={String(counts.skipped + (summary.duplicates_skipped ?? 0))} tone="muted" />
        <ReceiptStat label="Errors"        value={String(batch.error_count)} tone={batch.error_count ? "destructive" : "muted"} icon={batch.error_count ? <AlertTriangle className="h-3.5 w-3.5" /> : undefined} />
        <ReceiptStat label="Health at commit" value={health != null ? `${health}/100` : "—"} tone={tier === "excellent" || tier === "good" ? "success" : tier === "review" ? "warning" : tier ? "destructive" : "muted"} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
      </div>

      {/* FLOW + ENTITIES + BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass p-4 space-y-3">
          <div className="text-sm font-semibold">Cash flow</div>
          <div className="grid grid-cols-3 gap-2">
            <ReceiptStat label="Inflow"  value={formatMoney(Number(summary.inflow ?? 0), { currency: ccy })} tone="success" />
            <ReceiptStat label="Outflow" value={formatMoney(Number(summary.outflow ?? 0), { currency: ccy })} tone="destructive" />
            <ReceiptStat label="Net"     value={formatMoney(Number(summary.net ?? 0), { currency: ccy })} tone={Number(summary.net ?? 0) >= 0 ? "success" : "destructive"} />
          </div>
          <FlowBar inflow={Number(summary.inflow ?? 0)} outflow={Number(summary.outflow ?? 0)} />
        </Card>

        <Card className="glass p-4 space-y-3">
          <div className="text-sm font-semibold">Operations</div>
          {opsBreakdown.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4">No committed operations.</div>
          ) : (
            <div className="space-y-1.5">
              {opsBreakdown.map(([k, n]) => (
                <OpBar key={k} kind={k} n={n} total={counts.committed} />
              ))}
            </div>
          )}
        </Card>

        <Card className="glass p-4 space-y-3">
          <div className="text-sm font-semibold">Entities created</div>
          <div className="grid grid-cols-3 gap-2">
            <ReceiptStat label="Accounts" value={String(summary.created_accounts ?? 0)} icon={<Wallet className="h-3.5 w-3.5" />} />
            <ReceiptStat label="Assets"   value={String(summary.created_assets ?? 0)} icon={<Coins className="h-3.5 w-3.5" />} />
            <ReceiptStat label="Goals"    value={String(summary.created_goals ?? 0)} icon={<Target className="h-3.5 w-3.5" />} />
          </div>
          <div className="text-[11px] text-muted-foreground">
            {summary.duplicates_skipped ? `${summary.duplicates_skipped} duplicate row${summary.duplicates_skipped === 1 ? "" : "s"} skipped. ` : ""}
            Every created record is archivable via rollback if unused elsewhere.
          </div>
        </Card>
      </div>

      {/* ACCOUNT & ASSET IMPACT */}
      {(accountImpact.length > 0 || assetImpact.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accountImpact.length > 0 && (
            <Card className="glass p-4 space-y-2">
              <div className="text-sm font-semibold">Account impact</div>
              {accountImpact.map((a) => <ImpactBar key={a.id} name={a.name} value={a.delta} ccy={ccy} max={Math.max(...accountImpact.map((x) => Math.abs(x.delta)))} />)}
            </Card>
          )}
          {assetImpact.length > 0 && (
            <Card className="glass p-4 space-y-2">
              <div className="text-sm font-semibold">Asset activity</div>
              <div className="flex flex-wrap gap-1.5">
                {assetImpact.map((a) => (
                  <Badge key={a.id} variant="outline" className="text-[11px]">
                    {a.symbol} {a.n > 0 ? `+${a.n}` : a.n} op{Math.abs(a.n) === 1 ? "" : "s"}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ROLLBACK EVENTS */}
      {rollbackEvents.length > 0 && (
        <Card className="glass p-4 space-y-2">
          <div className="text-sm font-semibold flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-warning" /> Rollback history ({rollbackEvents.length})
          </div>
          <div className="space-y-1.5">
            {rollbackEvents.map((ev, i) => (
              <div key={i} className="text-[11px] flex items-center justify-between gap-2 border-t border-border/30 pt-1.5">
                <span className="text-muted-foreground">{new Date(ev.at).toLocaleString()}</span>
                <span>Scope <span className="font-medium">{ev.scope?.mode}</span></span>
                <span className="font-mono">{ev.voidedTx} voided · {(ev.archivedAssets + ev.archivedGoals + ev.archivedAccounts) || 0} archived</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* PER-ROW DETAIL */}
      <Card className="glass p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan" /> Batch detail
            <span className="text-xs text-muted-foreground font-normal">({filtered.length} of {rows.length})</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rows…"
                className="h-7 pl-7 pr-7 text-xs w-44" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-7 px-2 rounded-md bg-card/60 border border-border/40 text-xs">
              <option value="all">Any status</option>
              <option value="committed">Committed</option>
              <option value="skipped">Skipped</option>
              <option value="errors">Errors</option>
            </select>
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}
              className="h-7 px-2 rounded-md bg-card/60 border border-border/40 text-xs">
              <option value="all">Any kind</option>
              <option value="deposit">Deposits</option>
              <option value="expense">Expenses</option>
              <option value="transfer">Transfers</option>
              <option value="buy">Buys</option>
              <option value="sell">Sells</option>
              <option value="goal_contribution">Goal +</option>
              <option value="goal_create">Goal create</option>
              <option value="account_open">Account open</option>
              <option value="asset_open">Asset open</option>
            </select>
            {selectedRows.size > 0 && !batch.rolled_back_at && (
              <Button size="sm" variant="outline"
                onClick={() => setRollbackOpen(true)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Rollback {selectedRows.size} row{selectedRows.size === 1 ? "" : "s"}
              </Button>
            )}
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 w-6"></th>
                <th className="px-3 py-2 text-left">Line</th>
                <th className="px-3 py-2 text-left">Kind</th>
                <th className="px-3 py-2 text-left">Original</th>
                <th className="px-3 py-2 text-left">Committed record</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <RowLine key={r.lineNo} r={r} ccy={ccy}
                  acct={r.accountId ? acctById.get(r.accountId)?.name : null}
                  asset={r.assetId ? assetById.get(r.assetId)?.symbol : null}
                  goal={r.goalId ? goalById.get(r.goalId)?.name : null}
                  selected={selectedRows.has(r.lineNo)}
                  onToggle={() => setSelectedRows((p) => {
                    const n = new Set(p); n.has(r.lineNo) ? n.delete(r.lineNo) : n.add(r.lineNo); return n;
                  })}
                  eligible={!r.skipped && !r.error && r.txIds.length > 0 && !batch.rolled_back_at}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border/40">
          {filtered.map((r) => (
            <RowCard key={r.lineNo} r={r} ccy={ccy}
              acct={r.accountId ? acctById.get(r.accountId)?.name : null}
              asset={r.assetId ? assetById.get(r.assetId)?.symbol : null}
              goal={r.goalId ? goalById.get(r.goalId)?.name : null}
              selected={selectedRows.has(r.lineNo)}
              onToggle={() => setSelectedRows((p) => {
                const n = new Set(p); n.has(r.lineNo) ? n.delete(r.lineNo) : n.add(r.lineNo); return n;
              })}
              eligible={!r.skipped && !r.error && r.txIds.length > 0 && !batch.rolled_back_at}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground">No rows match these filters.</div>
        )}
      </Card>

      {/* SOURCE */}
      <Card className="glass p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" /> Original source text
          </div>
          <Button size="sm" variant="ghost"
            onClick={() => { void navigator.clipboard.writeText(batch.source_text); toast.success("Copied source"); }}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copy
          </Button>
        </div>
        <pre className="text-[11px] font-mono bg-card/40 border border-border/30 rounded-md p-3 whitespace-pre-wrap max-h-64 overflow-auto">
          {batch.source_text}
        </pre>
      </Card>

      <RollbackDialog
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        batchId={batch.id}
        ccy={ccy}
        preselectedRows={selectedRows.size ? Array.from(selectedRows) : undefined}
        onDone={() => { setSelectedRows(new Set()); void refresh(); }}
      />
    </div>
  );
}

// ---------- small helpers ----------

function kindIcon(kind: string) {
  switch (kind) {
    case "deposit": return <ArrowDownToLine className="h-3 w-3 text-success" />;
    case "expense": return <ArrowUpFromLine className="h-3 w-3 text-destructive" />;
    case "transfer": return <Repeat className="h-3 w-3 text-cyan" />;
    case "buy": return <TrendingUp className="h-3 w-3 text-success" />;
    case "sell": return <TrendingDown className="h-3 w-3 text-warning" />;
    case "goal_contribution":
    case "goal_create": return <Target className="h-3 w-3 text-cyan" />;
    case "account_open": return <Wallet className="h-3 w-3 text-muted-foreground" />;
    case "asset_open": return <Coins className="h-3 w-3 text-muted-foreground" />;
    default: return <AlertTriangle className="h-3 w-3 text-warning" />;
  }
}

function rowStatus(r: ImportRowRecord) {
  if (r.error)   return <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Error</Badge>;
  if (r.skipped) return <Badge className="text-[10px] bg-muted text-muted-foreground border-border/40">Skipped · {r.skippedReason ?? ""}</Badge>;
  if (r.txIds.length) return <Badge className="text-[10px] bg-success/15 text-success border-success/30"><CheckCircle2 className="h-3 w-3 mr-1" />Committed</Badge>;
  return <Badge variant="outline" className="text-[10px]">Applied</Badge>;
}

function committedLabel(r: ImportRowRecord, acct: string|null|undefined, asset: string|null|undefined, goal: string|null|undefined) {
  const parts: string[] = [];
  if (acct)  parts.push(acct);
  if (asset) parts.push(asset);
  if (goal)  parts.push(`Goal: ${goal}`);
  if (r.transferGroupId) parts.push(`pair ${r.transferGroupId.slice(0, 6)}…`);
  if (r.txIds.length) parts.push(`${r.txIds.length} tx`);
  return parts.join(" · ") || "—";
}

function RowLine({ r, ccy, acct, asset, goal, selected, onToggle, eligible }: {
  r: ImportRowRecord; ccy: string; acct: string|null|undefined; asset: string|null|undefined; goal: string|null|undefined;
  selected: boolean; onToggle: () => void; eligible: boolean;
}) {
  const tone = r.error ? "bg-destructive/5" : r.skipped ? "bg-muted/20" : "";
  return (
    <tr className={cn("border-t border-border/30", tone)}>
      <td className="px-3 py-2">
        <input type="checkbox" disabled={!eligible} checked={selected} onChange={onToggle}
          className="accent-cyan disabled:opacity-30" />
      </td>
      <td className="px-3 py-2 text-muted-foreground font-mono">{r.lineNo}</td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1.5">{kindIcon(r.kind)}<span className="capitalize">{r.kind.replace("_", " ")}</span></span>
      </td>
      <td className="px-3 py-2 max-w-[300px] truncate font-mono text-[11px] text-muted-foreground">{r.raw}</td>
      <td className="px-3 py-2 max-w-[240px] truncate">
        {committedLabel(r, acct, asset, goal)}
        {r.txIds[0] && (
          <Link to="/transactions" search={{ q: r.txIds[0] } as any} className="ml-1.5 inline-flex items-center text-cyan hover:underline text-[10px]">
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {r.kind === "goal_create" ? "—" : formatMoney(r.amount, { currency: ccy })}
      </td>
      <td className="px-3 py-2">{rowStatus(r)}</td>
    </tr>
  );
}

function RowCard({ r, ccy, acct, asset, goal, selected, onToggle, eligible }: {
  r: ImportRowRecord; ccy: string; acct: string|null|undefined; asset: string|null|undefined; goal: string|null|undefined;
  selected: boolean; onToggle: () => void; eligible: boolean;
}) {
  const tone = r.error ? "bg-destructive/5" : r.skipped ? "bg-muted/20" : "";
  return (
    <div className={cn("p-3 space-y-1.5", tone)}>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" disabled={!eligible} checked={selected} onChange={onToggle}
            className="accent-cyan disabled:opacity-30" />
          {kindIcon(r.kind)} <span className="capitalize font-medium">{r.kind.replace("_", " ")}</span>
          <span className="text-muted-foreground font-mono text-[10px]">L{r.lineNo}</span>
        </label>
        <span className="font-mono text-xs">{r.kind === "goal_create" ? "" : formatMoney(r.amount, { currency: ccy })}</span>
      </div>
      <div className="font-mono text-[11px] text-muted-foreground truncate">{r.raw}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] truncate">{committedLabel(r, acct, asset, goal)}</span>
        {rowStatus(r)}
      </div>
      {r.error && <div className="text-[11px] text-destructive">{r.error}</div>}
    </div>
  );
}

function ReceiptStat({ label, value, tone, icon }: {
  label: string; value: string;
  tone?: "success" | "destructive" | "warning" | "muted";
  icon?: React.ReactNode;
}) {
  const color =
    tone === "success" ? "text-success" :
    tone === "destructive" ? "text-destructive" :
    tone === "warning" ? "text-warning" :
    tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <Card className="glass p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={cn("font-mono text-lg font-semibold tabular-nums mt-1", color)}>{value}</div>
    </Card>
  );
}

function FlowBar({ inflow, outflow }: { inflow: number; outflow: number }) {
  const total = Math.max(1, inflow + outflow);
  const inPct = (inflow / total) * 100;
  return (
    <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden flex">
      <div className="bg-success" style={{ width: `${inPct}%` }} />
      <div className="bg-destructive" style={{ width: `${100 - inPct}%` }} />
    </div>
  );
}

function OpBar({ kind, n, total }: { kind: string; n: number; total: number }) {
  const pct = total > 0 ? (n / total) * 100 : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="capitalize flex items-center gap-1.5">{kindIcon(kind)}{kind.replace("_", " ")}</span>
        <span className="font-mono tabular-nums">{n}</span>
      </div>
      <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
        <div className="h-full bg-cyan" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ImpactBar({ name, value, ccy, max }: { name: string; value: number; ccy: string; max: number }) {
  const pct = max > 0 ? (Math.abs(value) / max) * 100 : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="truncate">{name}</span>
        <span className={cn("font-mono tabular-nums", value >= 0 ? "text-success" : "text-destructive")}>
          {value >= 0 ? "+" : ""}{formatMoney(value, { currency: ccy })}
        </span>
      </div>
      <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
        <div className={cn("h-full", value >= 0 ? "bg-success" : "bg-destructive")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
