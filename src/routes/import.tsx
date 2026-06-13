import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText, Play, RotateCcw, AlertTriangle, CheckCircle2, ArrowDownToLine,
  ArrowUpFromLine, Repeat, History, Sparkles, Wrench, Link2, Plus,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAccounts, useTransactions } from "@/hooks/use-ledger";
import { useUserTable } from "@/hooks/use-user-table";
import {
  parseImportText, groupAccountIssues,
  type ParsedEntry, type AccountIssue, type ImportAlias,
} from "@/lib/import-parser";
import { executeImport, rollbackImport } from "@/lib/import-engine";
import { formatMoney } from "@/lib/format-currency";
const formatCurrency = (v: number, currency: string) => formatMoney(v, { currency });
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { IssueResolveModal, type ResolveResult } from "@/components/import/IssueResolveModal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/import")({
  component: ImportPage,
});

type ImportBatch = {
  id: string;
  source_text: string;
  imported_count: number;
  error_count: number;
  errors: any;
  summary: any;
  label: string | null;
  created_at: string;
  rolled_back_at: string | null;
};

const EXAMPLE = `Lunedì 11/05/26 00:00
+240 contanti, pizzeria
+370 contanti, altro

Lunedì 18/05/26 00:00
+240 contanti, pizzeria

Domenica 31/05/26 12:00
30 contanti -> Isy bank
-105 Isy bank, Auto radio + accessori, Car`;

function ImportPage() {
  const { profile } = useAuth();
  const ccy = profile?.currency ?? "USD";
  const { rows: accounts } = useAccounts();
  const { rows: existingTx } = useTransactions();
  const { rows: batches, refresh: refreshBatches } = useUserTable<ImportBatch>("import_batches", {
    col: "created_at", asc: false,
  });

  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [aliases, setAliases] = useState<ImportAlias[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [resolveIssue, setResolveIssue] = useState<AccountIssue | null>(null);
  const [defaultAccountId, setDefaultAccountId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("import.defaultAccountId") ?? "";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (defaultAccountId) window.localStorage.setItem("import.defaultAccountId", defaultAccountId);
      else window.localStorage.removeItem("import.defaultAccountId");
    }
  }, [defaultAccountId]);
  const [lastResult, setLastResult] = useState<{
    imported: number; failed: number; createdAccounts: number; aliasesAdded: number;
    inflow: number; outflow: number; net: number;
  } | null>(null);

  // Load aliases on mount + when accounts change.
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await (supabase as any)
        .from("import_aliases")
        .select("alias,entity_type,entity_id")
        .eq("user_id", u.user.id);
      setAliases(data ?? []);
    })();
  }, []);

  async function refreshAliases() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await (supabase as any)
      .from("import_aliases")
      .select("alias,entity_type,entity_id")
      .eq("user_id", u.user.id);
    setAliases(data ?? []);
  }

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    return parseImportText({
      text,
      accounts,
      aliases,
      ignoredAccounts: ignored,
      defaultAccountId: defaultAccountId || undefined,
      existingTransactions: existingTx.map((t) => ({
        id: t.id,
        execution_timestamp: t.execution_timestamp,
        fiat_value: Number(t.fiat_value),
        source_account_id: t.source_account_id,
        destination_account_id: t.destination_account_id,
        note: t.note,
      })),
    });
  }, [text, accounts, existingTx, aliases, ignored, defaultAccountId]);

  const issues = useMemo<AccountIssue[]>(
    () => parsed ? groupAccountIssues(parsed.entries, accounts) : [],
    [parsed, accounts],
  );

  const counts = useMemo(() => {
    if (!parsed) return { ready: 0, warning: 0, error: 0 };
    let r = 0, w = 0, e = 0;
    for (const x of parsed.entries) {
      if (x.severity === "error") e++;
      else if (x.severity === "warning") w++;
      else r++;
    }
    return { ready: r, warning: w, error: e };
  }, [parsed]);

  const canImport =
    parsed &&
    parsed.entries.length > 0 &&
    parsed.entries.some((x) => x.severity !== "error");

  function handleResolved(r: ResolveResult) {
    if (r.kind === "ignored") {
      setIgnored((prev) => prev.includes(r.alias) ? prev : [...prev, r.alias]);
    } else if (r.accountId) {
      // optimistic alias add; refresh from DB to confirm
      setAliases((prev) => {
        const filtered = prev.filter((a) => !(a.entity_type === "account" && a.alias.toLowerCase() === r.alias));
        return [...filtered, { alias: r.alias, entity_type: "account", entity_id: r.accountId! }];
      });
      refreshAliases();
    }
  }

  async function handleImport() {
    if (!parsed) return;
    setIsImporting(true);
    const before = { accounts: accounts.length, aliases: aliases.length };
    try {
      const res = await executeImport({
        sourceText: text,
        entries: parsed.entries,
        summary: parsed.summary,
        label: label || undefined,
        skipDuplicates,
      });
      setLastResult({
        imported: res.imported,
        failed: res.failed,
        createdAccounts: Math.max(0, accounts.length - before.accounts),
        aliasesAdded: Math.max(0, aliases.length - before.aliases),
        inflow: parsed.summary.inflow,
        outflow: parsed.summary.outflow,
        net: parsed.summary.net,
      });
      toast.success(`Imported ${res.imported} entries${res.failed ? ` (${res.failed} failed)` : ""}`);
      setText("");
      setLabel("");
      await refreshBatches();
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleRollback(id: string) {
    if (!confirm("Roll back this import batch? All transactions created by it will be voided.")) return;
    try {
      const r = await rollbackImport(id);
      toast.success(`Rolled back ${r.voided} transactions`);
      await refreshBatches();
    } catch (e: any) {
      toast.error(e?.message ?? "Rollback failed");
    }
  }

  // Map raw normalized → issue for inline row Fix button
  const issueByNorm = useMemo(() => {
    const m = new Map<string, AccountIssue>();
    for (const i of issues) m.set(i.normalized, i);
    return m;
  }, [issues]);

  function rowIssue(e: ParsedEntry): AccountIssue | null {
    const raw = e.unresolvedAccounts[0];
    if (!raw) return null;
    return issueByNorm.get(raw.toLowerCase().trim()) ?? issueByNorm.get(normLoose(raw)) ?? null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Data"
        subtitle="Paste raw financial notes — they’re parsed deterministically into ledger entries. No AI."
        action={
          <Button variant="outline" size="sm" onClick={() => setText(EXAMPLE)}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Load example
          </Button>
        }
      />

      {/* POST-IMPORT SUMMARY */}
      {lastResult && (
        <Card className="glass p-4 border-success/30">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-success" /> Import completed
              </div>
              <div className="text-xs text-muted-foreground">
                {lastResult.imported} transaction{lastResult.imported === 1 ? "" : "s"} imported
                {lastResult.failed > 0 && ` · ${lastResult.failed} failed`}
                {lastResult.createdAccounts > 0 && ` · ${lastResult.createdAccounts} new account${lastResult.createdAccounts === 1 ? "" : "s"}`}
                {lastResult.aliasesAdded > 0 && ` · ${lastResult.aliasesAdded} alias${lastResult.aliasesAdded === 1 ? "" : "es"} added`}
              </div>
            </div>
            <div className="flex gap-3 text-xs font-mono">
              <span className="text-success">+{formatCurrency(lastResult.inflow, ccy)}</span>
              <span className="text-destructive">−{formatCurrency(lastResult.outflow, ccy)}</span>
              <span className={lastResult.net >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                = {formatCurrency(lastResult.net, ccy)}
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setLastResult(null)}>Dismiss</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* INPUT */}
        <Card className="glass p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-cyan" /> Raw text
            </div>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Batch label (optional)"
              className="h-8 max-w-[200px] text-xs"
            />
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <label className="text-muted-foreground uppercase tracking-wider text-[10px] shrink-0">Default account</label>
            <select
              value={defaultAccountId}
              onChange={(e) => setDefaultAccountId(e.target.value)}
              className="flex-1 h-8 px-2 rounded-md bg-card/60 border border-border/40 text-xs"
            >
              <option value="">— none (require explicit account) —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            className="font-mono text-xs min-h-[320px] resize-y"
            spellCheck={false}
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="accent-cyan"
              />
              Skip likely duplicates
            </label>
            <div className="flex items-center gap-2">
              {parsed && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-success/10 text-success">
                    <CheckCircle2 className="h-3 w-3" />{counts.ready}
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                    {counts.warning}
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-3 w-3" />{counts.error}
                  </span>
                </div>
              )}
              <Button onClick={handleImport} disabled={!canImport || isImporting} size="sm">
                <Play className="h-3.5 w-3.5 mr-1.5" />
                {isImporting ? "Importing…" : counts.error > 0 ? `Import ${counts.ready + counts.warning} ready` : "Confirm import"}
              </Button>
            </div>
          </div>
        </Card>

        {/* SUMMARY */}
        <Card className="glass p-4">
          {!parsed ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Paste text on the left to preview parsed entries.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm font-semibold">Summary</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Total" value={parsed.summary.total.toString()} />
                <Stat label="Deposits" value={parsed.summary.deposits.toString()} tone="success" />
                <Stat label="Expenses" value={parsed.summary.expenses.toString()} tone="destructive" />
                <Stat label="Transfers" value={parsed.summary.transfers.toString()} tone="cyan" />
                <Stat label="Ready" value={counts.ready.toString()} tone="success" />
                <Stat label="Blocking" value={counts.error.toString()} tone={counts.error ? "destructive" : "muted"} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Inflow" value={formatCurrency(parsed.summary.inflow, ccy)} tone="success" />
                <Stat label="Outflow" value={formatCurrency(parsed.summary.outflow, ccy)} tone="destructive" />
                <Stat label="Net" value={formatCurrency(parsed.summary.net, ccy)} tone={parsed.summary.net >= 0 ? "success" : "destructive"} />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ISSUES PANEL */}
      {issues.length > 0 && (
        <Card className="glass p-0 overflow-hidden border-destructive/30">
          <div className="px-4 py-3 border-b border-border/40 text-sm font-semibold flex items-center justify-between bg-destructive/5">
            <span className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-destructive" />
              Issues to resolve ({issues.length})
            </span>
            <span className="text-[11px] text-muted-foreground font-normal">
              Resolving once fixes every affected row. Mappings are remembered for future imports.
            </span>
          </div>
          <div className="divide-y divide-border/30">
            {issues.map((iss) => (
              <div key={iss.normalized} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-destructive">Unknown account</div>
                  <div className="font-mono text-sm truncate">"{iss.raw}"</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {iss.lineNos.length} row{iss.lineNos.length === 1 ? "" : "s"} affected
                    {iss.suggestions[0] && (
                      <> · best match <span className="text-cyan">{iss.suggestions[0].name}</span> ({Math.round(iss.suggestions[0].score * 100)}%)</>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {iss.suggestions[0] && (
                    <Button
                      size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => setResolveIssue(iss)}
                    >
                      <Link2 className="h-3 w-3 mr-1" />Map
                    </Button>
                  )}
                  <Button
                    size="sm" className="text-xs h-7 bg-cyan text-background hover:bg-cyan/90"
                    onClick={() => setResolveIssue(iss)}
                  >
                    <Plus className="h-3 w-3 mr-1" />Resolve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* PREVIEW */}
      {parsed && parsed.entries.length > 0 && (
        <Card className="glass p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 text-sm font-semibold flex items-center justify-between">
            <span>Preview ({parsed.entries.length})</span>
            <span className="text-xs text-muted-foreground font-normal">
              Review every row before confirming
            </span>
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Account(s)</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.entries.map((e, i) => (
                  <EntryRow key={i} e={e} ccy={ccy} issue={rowIssue(e)} onFix={setResolveIssue} />
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border/40">
            {parsed.entries.map((e, i) => (
              <EntryCard key={i} e={e} ccy={ccy} issue={rowIssue(e)} onFix={setResolveIssue} />
            ))}
          </div>
        </Card>
      )}

      {/* HISTORY */}
      <Card className="glass p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <History className="h-4 w-4 text-cyan" /> Import history
        </div>
        {batches.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">No imports yet.</div>
        ) : (
          <div className="space-y-2">
            {batches.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 bg-card/40">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {b.label || `Import · ${new Date(b.created_at).toLocaleString()}`}
                    {b.rolled_back_at && (
                      <Badge variant="outline" className="ml-2 text-[10px]">rolled back</Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {b.imported_count} imported · {b.error_count} errors
                    {b.summary?.net != null && ` · net ${formatCurrency(Number(b.summary.net), ccy)}`}
                  </div>
                </div>
                {!b.rolled_back_at && (
                  <Button variant="ghost" size="sm" onClick={() => handleRollback(b.id)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Rollback
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="text-[11px] text-muted-foreground">
        Tip: also reachable from the Command Palette (<kbd className="px-1 border rounded">⌘K</kbd> → “Import transactions”) and the sidebar.
        <Link to="/transactions" className="ml-2 underline">View transactions →</Link>
      </div>

      <IssueResolveModal
        open={!!resolveIssue}
        onClose={() => setResolveIssue(null)}
        issue={resolveIssue}
        defaultCurrency={ccy}
        onResolved={handleResolved}
      />
    </div>
  );
}

function normLoose(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" | "warning" | "cyan" | "muted" }) {
  const color =
    tone === "success" ? "text-success" :
    tone === "destructive" ? "text-destructive" :
    tone === "warning" ? "text-warning" :
    tone === "cyan" ? "text-cyan" :
    "text-foreground";
  return (
    <div className="rounded-md border border-border/40 px-2 py-1.5 bg-card/40">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-sm font-semibold tabular-nums", color)}>{value}</div>
    </div>
  );
}

function kindIcon(kind: ParsedEntry["kind"]) {
  if (kind === "deposit") return <ArrowDownToLine className="h-3 w-3 text-success" />;
  if (kind === "expense") return <ArrowUpFromLine className="h-3 w-3 text-destructive" />;
  if (kind === "transfer") return <Repeat className="h-3 w-3 text-cyan" />;
  return <AlertTriangle className="h-3 w-3 text-warning" />;
}

function statusBadge(e: ParsedEntry) {
  if (e.severity === "error")
    return <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Error</Badge>;
  if (e.duplicateOf)
    return <Badge className="text-[10px] bg-warning/15 text-warning border-warning/30">Duplicate</Badge>;
  if (e.severity === "warning")
    return <Badge className="text-[10px] bg-warning/15 text-warning border-warning/30">Warning</Badge>;
  return <Badge className="text-[10px] bg-success/15 text-success border-success/30"><CheckCircle2 className="h-3 w-3 mr-1" />Ready</Badge>;
}

function confidenceBadge(e: ParsedEntry) {
  if (e.severity === "error") return null;
  const tone =
    e.confidenceTier === "high" ? "bg-success/10 text-success border-success/30" :
    e.confidenceTier === "medium" ? "bg-warning/10 text-warning border-warning/30" :
    "bg-destructive/10 text-destructive border-destructive/30";
  const label = e.confidenceTier === "high" ? "High" : e.confidenceTier === "medium" ? "Medium" : "Low";
  return (
    <Badge variant="outline" className={cn("text-[10px] font-normal", tone)} title={`${Math.round(e.confidence * 100)}% confidence`}>
      {label} · {Math.round(e.confidence * 100)}%
    </Badge>
  );
}

function accountLabel(e: ParsedEntry) {
  if (e.kind === "transfer")
    return `${e.fromAccount?.matchedName ?? e.fromAccount?.raw ?? "?"} → ${e.toAccount?.matchedName ?? e.toAccount?.raw ?? "?"}`;
  return e.account?.matchedName ?? e.account?.raw ?? "—";
}

function EntryRow({
  e, ccy, issue, onFix,
}: { e: ParsedEntry; ccy: string; issue: AccountIssue | null; onFix: (i: AccountIssue) => void }) {
  const rowTone = e.severity === "error" ? "bg-destructive/5"
    : e.severity === "warning" ? "bg-warning/5" : "";
  return (
    <tr className={cn("border-t border-border/30", rowTone)}>
      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
        {new Date(e.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
      </td>
      <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5">{kindIcon(e.kind)}<span className="capitalize">{e.kind}</span></span></td>
      <td className="px-3 py-2">{accountLabel(e)}</td>
      <td className={cn("px-3 py-2 text-right font-mono tabular-nums",
        e.kind === "deposit" && "text-success",
        e.kind === "expense" && "text-destructive")}>
        {e.kind === "expense" ? "−" : e.kind === "deposit" ? "+" : ""}{formatCurrency(e.amount, ccy)}
      </td>
      <td className="px-3 py-2 truncate max-w-[240px]">{e.description ?? <span className="text-muted-foreground/60">—</span>}</td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusBadge(e)}
            {confidenceBadge(e)}
            {issue && (
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => onFix(issue)}>
                <Wrench className="h-2.5 w-2.5 mr-1" />Fix
              </Button>
            )}
          </div>
          {(e.errors.length > 0 || e.warnings.length > 0) && (
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              {e.errors.map((m, i) => <div key={`e${i}`} className="text-destructive">{m}</div>)}
              {e.warnings.map((m, i) => <div key={`w${i}`}>{m}</div>)}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function EntryCard({
  e, ccy, issue, onFix,
}: { e: ParsedEntry; ccy: string; issue: AccountIssue | null; onFix: (i: AccountIssue) => void }) {
  const tone = e.severity === "error" ? "bg-destructive/5"
    : e.severity === "warning" ? "bg-warning/5" : "";
  return (
    <div className={cn("p-3 space-y-1.5", tone)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          {kindIcon(e.kind)} <span className="capitalize font-medium">{e.kind}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {new Date(e.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">{confidenceBadge(e)}{statusBadge(e)}</div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="truncate">{accountLabel(e)}</span>
        <span className={cn("font-mono font-semibold",
          e.kind === "deposit" && "text-success",
          e.kind === "expense" && "text-destructive")}>
          {e.kind === "expense" ? "−" : e.kind === "deposit" ? "+" : ""}{formatCurrency(e.amount, ccy)}
        </span>
      </div>
      {(e.description || e.category) && (
        <div className="text-[11px] text-muted-foreground">
          {e.description}{e.description && e.category ? " · " : ""}{e.category}
        </div>
      )}
      {(e.errors.length > 0 || e.warnings.length > 0) && (
        <div className="text-[10px] space-y-0.5">
          {e.errors.map((m, i) => <div key={`e${i}`} className="text-destructive">{m}</div>)}
          {e.warnings.map((m, i) => <div key={`w${i}`} className="text-muted-foreground">{m}</div>)}
        </div>
      )}
      {issue && (
        <Button size="sm" variant="outline" className="h-7 w-full text-[11px]" onClick={() => onFix(issue)}>
          <Wrench className="h-3 w-3 mr-1" />Fix issue
        </Button>
      )}
    </div>
  );
}
