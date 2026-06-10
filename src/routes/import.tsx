import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText, Play, RotateCcw, AlertTriangle, CheckCircle2, ArrowDownToLine,
  ArrowUpFromLine, Repeat, History, Trash2, Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAccounts, useTransactions } from "@/hooks/use-ledger";
import { useUserTable } from "@/hooks/use-user-table";
import { parseImportText, type ParsedEntry } from "@/lib/import-parser";
import { executeImport, rollbackImport } from "@/lib/import-engine";
import { formatMoney } from "@/lib/format-currency";
const formatCurrency = (v: number, currency: string) => formatMoney(v, { currency });
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

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

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    return parseImportText({
      text,
      accounts,
      existingTransactions: existingTx.map((t) => ({
        id: t.id,
        execution_timestamp: t.execution_timestamp,
        fiat_value: Number(t.fiat_value),
        source_account_id: t.source_account_id,
        destination_account_id: t.destination_account_id,
        note: t.note,
      })),
    });
  }, [text, accounts, existingTx]);

  const canImport =
    parsed &&
    parsed.entries.length > 0 &&
    parsed.entries.some((e) => e.errors.length === 0);

  async function handleImport() {
    if (!parsed) return;
    setIsImporting(true);
    try {
      const res = await executeImport({
        sourceText: text,
        entries: parsed.entries,
        summary: parsed.summary,
        label: label || undefined,
        skipDuplicates,
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* INPUT */}
        <Card className="glass p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
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
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            className="font-mono text-xs min-h-[320px] resize-y"
            spellCheck={false}
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="accent-cyan"
              />
              Skip likely duplicates
            </label>
            <Button onClick={handleImport} disabled={!canImport || isImporting} size="sm">
              <Play className="h-3.5 w-3.5 mr-1.5" />
              {isImporting ? "Importing…" : "Confirm import"}
            </Button>
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
                <Stat label="Errors" value={parsed.summary.errorCount.toString()} tone={parsed.summary.errorCount ? "destructive" : "muted"} />
                <Stat label="Warnings" value={parsed.summary.warningCount.toString()} tone={parsed.summary.warningCount ? "warning" : "muted"} />
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
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.entries.map((e, i) => (
                  <EntryRow key={i} e={e} ccy={ccy} />
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border/40">
            {parsed.entries.map((e, i) => (
              <EntryCard key={i} e={e} ccy={ccy} />
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
    </div>
  );
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
  if (e.errors.length)
    return <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Error</Badge>;
  if (e.duplicateOf)
    return <Badge className="text-[10px] bg-warning/15 text-warning border-warning/30">Duplicate</Badge>;
  if (e.warnings.length)
    return <Badge variant="outline" className="text-[10px]">Warning</Badge>;
  return <Badge className="text-[10px] bg-success/15 text-success border-success/30"><CheckCircle2 className="h-3 w-3 mr-1" />Ready</Badge>;
}

function accountLabel(e: ParsedEntry) {
  if (e.kind === "transfer")
    return `${e.fromAccount?.matchedName ?? e.fromAccount?.raw ?? "?"} → ${e.toAccount?.matchedName ?? e.toAccount?.raw ?? "?"}`;
  return e.account?.matchedName ?? e.account?.raw ?? "—";
}

function EntryRow({ e, ccy }: { e: ParsedEntry; ccy: string }) {
  return (
    <tr className={cn("border-t border-border/30", e.errors.length && "bg-destructive/5")}>
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
      <td className="px-3 py-2">{e.category ?? <span className="text-muted-foreground/60">—</span>}</td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col gap-1">
          {statusBadge(e)}
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

function EntryCard({ e, ccy }: { e: ParsedEntry; ccy: string }) {
  return (
    <div className={cn("p-3 space-y-1.5", e.errors.length && "bg-destructive/5")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          {kindIcon(e.kind)} <span className="capitalize font-medium">{e.kind}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {new Date(e.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
          </span>
        </div>
        {statusBadge(e)}
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
    </div>
  );
}
