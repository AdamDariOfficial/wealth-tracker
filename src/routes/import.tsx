import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText, Play, RotateCcw, AlertTriangle, CheckCircle2, ArrowDownToLine,
  ArrowUpFromLine, Repeat, History, Sparkles, Wrench, Link2, Plus,
  TrendingUp, TrendingDown, Target, Wallet, Coins, Search, X, Pencil,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAccounts, useAssets, useTransactions, useHoldings } from "@/hooks/use-ledger";
import { useUserTable } from "@/hooks/use-user-table";
import {
  parseImportText, groupImportIssues, applyEntryOverride, recomputeBatchAfterEdits,
  type ParsedEntry, type ImportIssue, type ImportAlias, type EntryEditOverride,
} from "@/lib/import-parser";
import { executeImport, rollbackImport } from "@/lib/import-engine";
import { computeImportHealth, healthTierLabel, type HealthReport } from "@/lib/import-health";
import { simulateImpact } from "@/lib/import-analytics";
import { formatMoney } from "@/lib/format-currency";
const formatCurrency = (v: number, currency: string) => formatMoney(v, { currency });
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { IssueResolveModal, type ResolveResult as AcctResolveResult } from "@/components/import/IssueResolveModal";
import { AssetResolveModal, GoalResolveModal, type ResolveResult } from "@/components/import/EntityResolveModals";
import { SyntaxGuide } from "@/components/import/SyntaxGuide";
import { ImpactPreview } from "@/components/import/ImpactPreview";
import { OpeningPositionWizard, type WizardTab } from "@/components/import/OpeningPositionWizard";
import { QuickEntryDialog, type QuickKind } from "@/components/import/QuickEntryDialog";
import { QuickActions, type QuickAction } from "@/components/import/QuickActions";
import { InlineEditDialog } from "@/components/import/InlineEditDialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/import")({ component: ImportPage });


type ImportBatch = {
  id: string; source_text: string;
  imported_count: number; error_count: number;
  errors: any; summary: any;
  label: string | null;
  created_at: string;
  rolled_back_at: string | null;
};

type GoalRow = { id: string; name: string; current_amount: number; target_amount: number };

const EXAMPLE = `Lunedì 11/05/26 00:00
+240 Cash Wallet, salary
-50 Isy Bank, groceries

# Transfers
250 Cash Wallet -> Isy Bank

# Buys & sells
BUY 2 BTC @ 42000 from Isy Bank
SELL 0.5 BTC @ 65000 to Isy Bank

# Goals
GOAL Emergency Fund target 10000
500 -> GOAL Emergency Fund

# Opening setup
ACCOUNT Cash Wallet balance 1375
ASSET VWCE qty 25 avg 128.45`;

function ImportPage() {
  const { profile } = useAuth();
  const ccy = profile?.currency ?? "USD";
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const { rows: existingTx } = useTransactions();
  const { holdings } = useHoldings();
  const { rows: goals } = useUserTable<GoalRow>("goals", { col: "name", asc: true });
  const { rows: batches, refresh: refreshBatches } = useUserTable<ImportBatch>("import_batches", {
    col: "created_at", asc: false,
  });

  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [aliases, setAliases] = useState<ImportAlias[]>([]);
  const [ignoredAccts, setIgnoredAccts] = useState<string[]>([]);
  const [ignoredAssets, setIgnoredAssets] = useState<string[]>([]);
  const [ignoredGoals, setIgnoredGoals] = useState<string[]>([]);

  const [resolveAcctIssue, setResolveAcctIssue] = useState<ImportIssue | null>(null);
  const [resolveAssetIssue, setResolveAssetIssue] = useState<ImportIssue | null>(null);
  const [resolveGoalIssue, setResolveGoalIssue] = useState<ImportIssue | null>(null);

  // Phase B: inline overrides (per lineNo).
  const [overrides, setOverrides] = useState<Record<number, EntryEditOverride>>({});
  const [editLine, setEditLine] = useState<number | null>(null);

  // Phase B: filters.
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | ParsedEntry["kind"]>("all");
  const [issueFilter, setIssueFilter] = useState<"all" | "issues" | "duplicates" | "unresolved">("all");

  // Phase B: wizards.
  const [wizardTab, setWizardTab] = useState<WizardTab | null>(null);
  const [quickKind, setQuickKind] = useState<QuickKind | null>(null);

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
    imported: number; failed: number;
    inflow: number; outflow: number; net: number;
  } | null>(null);

  useEffect(() => { void refreshAliases(); }, []);
  async function refreshAliases() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await (supabase as any)
      .from("import_aliases")
      .select("alias,entity_type,entity_id")
      .eq("user_id", u.user.id);
    setAliases(data ?? []);
  }

  // Reset overrides when text is cleared.
  useEffect(() => { if (!text.trim()) setOverrides({}); }, [text]);

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    return parseImportText({
      text,
      accounts,
      assets,
      goals,
      aliases,
      ignoredAccounts: ignoredAccts,
      ignoredAssets,
      ignoredGoals,
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
  }, [text, accounts, assets, goals, existingTx, aliases, ignoredAccts, ignoredAssets, ignoredGoals, defaultAccountId]);

  // Apply overrides, then re-run duplicate/health pass to keep validation live.
  const { entries: effectiveEntries, summary: effectiveSummary } = useMemo(() => {
    if (!parsed) return { entries: [] as ParsedEntry[], summary: null as any };
    const overridden = parsed.entries.map((e) => {
      const o = overrides[e.lineNo];
      return o ? applyEntryOverride(e, accounts, assets, goals, o) : e;
    });
    const existing = existingTx.map((t) => ({
      id: t.id,
      execution_timestamp: t.execution_timestamp,
      fiat_value: Number(t.fiat_value),
      source_account_id: t.source_account_id,
      destination_account_id: t.destination_account_id,
      note: t.note,
    }));
    const summary = recomputeBatchAfterEdits(overridden, existing);
    return { entries: overridden, summary };
  }, [parsed, overrides, accounts, assets, goals, existingTx]);

  const issues = useMemo<ImportIssue[]>(
    () => parsed ? groupImportIssues(effectiveEntries, accounts, assets, goals) : [],
    [parsed, effectiveEntries, accounts, assets, goals],
  );

  const health = useMemo<HealthReport | null>(
    () => parsed ? computeImportHealth(effectiveEntries, issues) : null,
    [parsed, effectiveEntries, issues],
  );

  const impact = useMemo(
    () => parsed ? simulateImpact({
      entries: effectiveEntries, accounts, assets, holdings,
      goals: goals.map((g) => ({ id: g.id, name: g.name, current_amount: Number(g.current_amount ?? 0), target_amount: Number(g.target_amount ?? 0) })),
    }) : null,
    [parsed, effectiveEntries, accounts, assets, holdings, goals],
  );

  const counts = useMemo(() => {
    if (!effectiveEntries.length) return { ready: 0, warning: 0, error: 0 };
    let r = 0, w = 0, e = 0;
    for (const x of effectiveEntries) {
      if (x.severity === "error") e++;
      else if (x.severity === "warning") w++;
      else r++;
    }
    return { ready: r, warning: w, error: e };
  }, [effectiveEntries]);

  // Phase B: filtered preview rows (filtering does NOT affect impact/health).
  const filteredEntries = useMemo(() => {
    let rows = effectiveEntries;
    if (kindFilter !== "all") rows = rows.filter((e) => e.kind === kindFilter);
    if (issueFilter === "issues") rows = rows.filter((e) => e.severity === "error" || e.warnings.length > 0);
    else if (issueFilter === "duplicates") rows = rows.filter((e) => !!(e.duplicateOf || e.duplicateOfLine));
    else if (issueFilter === "unresolved")
      rows = rows.filter((e) => e.unresolvedAccounts.length || e.unresolvedAssets.length || e.unresolvedGoals.length);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((e) =>
        e.raw.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.category ?? "").toLowerCase().includes(q) ||
        (e.account?.matchedName ?? e.account?.raw ?? "").toLowerCase().includes(q) ||
        (e.asset?.matchedSymbol ?? e.asset?.raw ?? "").toLowerCase().includes(q) ||
        (e.goal?.matchedName ?? e.goal?.raw ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [effectiveEntries, kindFilter, issueFilter, search]);


  const canImport =
    parsed && effectiveEntries.length > 0 &&
    effectiveEntries.some((x) => x.severity !== "error");

  function handleAcctResolved(r: AcctResolveResult) {
    if (r.kind === "ignored") {
      setIgnoredAccts((p) => p.includes(r.alias) ? p : [...p, r.alias]);
    } else if (r.accountId) {
      setAliases((prev) => {
        const filtered = prev.filter((a) => !(a.entity_type === "account" && a.alias.toLowerCase() === r.alias));
        return [...filtered, { alias: r.alias, entity_type: "account", entity_id: r.accountId! }];
      });
      refreshAliases();
    }
  }
  function handleEntityResolved(r: ResolveResult) {
    if (r.kind === "ignored") {
      if (r.entityType === "asset") setIgnoredAssets((p) => p.includes(r.alias) ? p : [...p, r.alias]);
      else setIgnoredGoals((p) => p.includes(r.alias) ? p : [...p, r.alias]);
    } else if (r.entityId) {
      setAliases((prev) => {
        const filtered = prev.filter((a) => !(a.entity_type === r.entityType && a.alias.toLowerCase() === r.alias));
        return [...filtered, { alias: r.alias, entity_type: r.entityType, entity_id: r.entityId! }];
      });
      refreshAliases();
    }
  }

  async function handleImport() {
    if (!parsed) return;
    setIsImporting(true);
    try {
      const res = await executeImport({
        sourceText: text,
        entries: effectiveEntries,
        summary: effectiveSummary,
        label: label || undefined,
        skipDuplicates,
      });
      setLastResult({
        imported: res.imported, failed: res.failed,
        inflow: effectiveSummary.inflow,
        outflow: effectiveSummary.outflow,
        net: effectiveSummary.net,
      });
      toast.success(`Imported ${res.imported} entries${res.failed ? ` (${res.failed} failed)` : ""}`);
      setText(""); setLabel(""); setOverrides({});
      await refreshBatches();
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally { setIsImporting(false); }
  }


  async function handleRollback(id: string) {
    if (!confirm("Roll back this import batch? All transactions created by it will be voided.")) return;
    try {
      const r = await rollbackImport(id);
      toast.success(`Rolled back ${r.voided} transactions`);
      await refreshBatches();
    } catch (e: any) { toast.error(e?.message ?? "Rollback failed"); }
  }

  function openIssue(iss: ImportIssue) {
    if (iss.kind === "unknown_account") setResolveAcctIssue(iss);
    else if (iss.kind === "unknown_asset") setResolveAssetIssue(iss);
    else if (iss.kind === "unknown_goal") setResolveGoalIssue(iss);
  }

  const issueByKey = useMemo(() => {
    const m = new Map<string, ImportIssue>();
    for (const i of issues) m.set(`${i.kind}:${i.normalized}`, i);
    return m;
  }, [issues]);

  function rowIssues(e: ParsedEntry): ImportIssue[] {
    const out: ImportIssue[] = [];
    for (const r of e.unresolvedAccounts) {
      const i = issueByKey.get(`unknown_account:${normLoose(r)}`); if (i) out.push(i);
    }
    for (const r of e.unresolvedAssets) {
      const i = issueByKey.get(`unknown_asset:${normLoose(r)}`); if (i) out.push(i);
    }
    for (const r of e.unresolvedGoals) {
      const i = issueByKey.get(`unknown_goal:${normLoose(r)}`); if (i) out.push(i);
    }
    return out;
  }

  function insertSnippet(code: string) {
    setText((t) => (t.trim() ? t + "\n" + code : code));
  }

  function handleQuickPick(a: QuickAction["kind"]) {
    if (a === "open-account") setWizardTab("account");
    else if (a === "open-asset") setWizardTab("asset");
    else if (a === "open-goal") setWizardTab("goal");
    else setQuickKind(a as QuickKind);
  }

  function saveOverride(lineNo: number, o: EntryEditOverride) {
    setOverrides((p) => ({ ...p, [lineNo]: o }));
  }

  const editEntry = editLine != null ? effectiveEntries.find((e) => e.lineNo === editLine) ?? null : null;


  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Data"
        subtitle="Paste raw financial notes — treasury moves, transfers, buys, sells, goals & opening positions. Pure rule-based parsing, no AI."
        action={
          <Button variant="outline" size="sm" onClick={() => setText(EXAMPLE)}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Load example
          </Button>
        }
      />

      {lastResult && (
        <Card className="glass p-4 border-success/30">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-success" /> Import completed
              </div>
              <div className="text-xs text-muted-foreground">
                {lastResult.imported} operation{lastResult.imported === 1 ? "" : "s"}
                {lastResult.failed > 0 && ` · ${lastResult.failed} failed`}
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
              value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="Batch label (optional)"
              className="h-8 max-w-[200px] text-xs"
            />
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <label className="text-muted-foreground uppercase tracking-wider text-[10px] shrink-0">Default account</label>
            <select
              value={defaultAccountId} onChange={(e) => setDefaultAccountId(e.target.value)}
              className="flex-1 h-8 px-2 rounded-md bg-card/60 border border-border/40 text-xs"
            >
              <option value="">— none (require explicit account) —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <Textarea
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            className="font-mono text-xs min-h-[320px] resize-y"
            spellCheck={false}
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)} className="accent-cyan" />
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
                {isImporting ? "Importing…" : counts.error > 0
                  ? `Import ${counts.ready + counts.warning} ready` : "Confirm import"}
              </Button>
            </div>
          </div>
        </Card>

        {/* DRY-RUN SUMMARY */}
        <Card className="glass p-4">
          {!parsed ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Paste text on the left for a dry-run preview.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Dry-run summary</div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">simulation · no writes yet</span>
              </div>
              {health && <HealthCard health={health} />}
              {impact && <ImpactPreview impact={impact} ccy={ccy} />}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Rows" value={effectiveSummary.total.toString()} />
                <Stat label="Ready" value={counts.ready.toString()} tone="success" />
                <Stat label="Blocking" value={counts.error.toString()} tone={counts.error ? "destructive" : "muted"} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <Stat label="Deposits" value={effectiveSummary.deposits.toString()} tone="success" icon={<ArrowDownToLine className="h-3 w-3" />} />
                <Stat label="Expenses" value={effectiveSummary.expenses.toString()} tone="destructive" icon={<ArrowUpFromLine className="h-3 w-3" />} />
                <Stat label="Transfers" value={effectiveSummary.transfers.toString()} tone="cyan" icon={<Repeat className="h-3 w-3" />} />
                <Stat label="Buys" value={effectiveSummary.buys.toString()} tone="success" icon={<TrendingUp className="h-3 w-3" />} />
                <Stat label="Sells" value={effectiveSummary.sells.toString()} tone="warning" icon={<TrendingDown className="h-3 w-3" />} />
                <Stat label="Goal +" value={effectiveSummary.goalContributions.toString()} tone="cyan" icon={<Target className="h-3 w-3" />} />
                <Stat label="Acct open" value={effectiveSummary.accountOpens.toString()} tone="muted" icon={<Wallet className="h-3 w-3" />} />
                <Stat label="Asset open" value={effectiveSummary.assetOpens.toString()} tone="muted" icon={<Coins className="h-3 w-3" />} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <Stat label="Inflow" value={formatCurrency(effectiveSummary.inflow, ccy)} tone="success" />
                <Stat label="Outflow" value={formatCurrency(effectiveSummary.outflow, ccy)} tone="destructive" />
                <Stat label="Net impact" value={formatCurrency(effectiveSummary.net, ccy)} tone={effectiveSummary.net >= 0 ? "success" : "destructive"} />
                <Stat label="Duplicates" value={(effectiveSummary.duplicateCount ?? 0).toString()} tone={(effectiveSummary.duplicateCount ?? 0) > 0 ? "warning" : "muted"} />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* QUICK ADD */}
      <QuickActions onPick={handleQuickPick} />

      {/* SYNTAX GUIDE */}
      <SyntaxGuide onInsert={insertSnippet} />

      {/* ISSUES PANEL */}
      {issues.length > 0 && (
        <Card className="glass p-0 overflow-hidden border-destructive/30">
          <div className="px-4 py-3 border-b border-border/40 text-sm font-semibold flex items-center justify-between bg-destructive/5 flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-destructive" />
              Issues to resolve ({issues.length})
            </span>
            <span className="text-[11px] text-muted-foreground font-normal">
              Resolving once fixes every affected row. Mappings persist for future imports.
            </span>
          </div>
          <div className="divide-y divide-border/30">
            {issues.map((iss) => (
              <div key={`${iss.kind}:${iss.normalized}`} className="p-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-destructive">
                    {iss.kind === "unknown_account" ? "Unknown account"
                      : iss.kind === "unknown_asset" ? "Unknown asset"
                      : "Unknown goal"}
                  </div>
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
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openIssue(iss)}>
                      <Link2 className="h-3 w-3 mr-1" />Map
                    </Button>
                  )}
                  <Button size="sm" className="text-xs h-7 bg-cyan text-background hover:bg-cyan/90" onClick={() => openIssue(iss)}>
                    <Plus className="h-3 w-3 mr-1" />Resolve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* PREVIEW */}
      {parsed && effectiveEntries.length > 0 && (
        <Card className="glass p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm font-semibold">
              Preview ({filteredEntries.length}{filteredEntries.length !== effectiveEntries.length ? ` of ${effectiveEntries.length}` : ""})
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search rows…"
                  className="h-7 pl-7 pr-7 text-xs w-44"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <FilterChip active={issueFilter === "all" && kindFilter === "all"} onClick={() => { setIssueFilter("all"); setKindFilter("all"); }}>All</FilterChip>
              <FilterChip active={issueFilter === "issues"} onClick={() => setIssueFilter(issueFilter === "issues" ? "all" : "issues")}>Issues</FilterChip>
              <FilterChip active={issueFilter === "duplicates"} onClick={() => setIssueFilter(issueFilter === "duplicates" ? "all" : "duplicates")}>Duplicates</FilterChip>
              <FilterChip active={issueFilter === "unresolved"} onClick={() => setIssueFilter(issueFilter === "unresolved" ? "all" : "unresolved")}>Unresolved</FilterChip>
              <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)}
                className="h-7 px-2 rounded-md bg-card/60 border border-border/40 text-xs">
                <option value="all">Any kind</option>
                <option value="deposit">Deposits</option>
                <option value="expense">Expenses</option>
                <option value="transfer">Transfers</option>
                <option value="buy">Buys</option>
                <option value="sell">Sells</option>
                <option value="goal_contribution">Goal contribs</option>
                <option value="goal_create">Goal create</option>
                <option value="account_open">Account opens</option>
                <option value="asset_open">Asset opens</option>
              </select>
            </div>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Detail</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((e, i) => (
                  <EntryRow key={i} e={e} ccy={ccy} edited={!!overrides[e.lineNo]} issues={rowIssues(e)} onFix={openIssue} onEdit={() => setEditLine(e.lineNo)} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-border/40">
            {filteredEntries.map((e, i) => (
              <EntryCard key={i} e={e} ccy={ccy} edited={!!overrides[e.lineNo]} issues={rowIssues(e)} onFix={openIssue} onEdit={() => setEditLine(e.lineNo)} />
            ))}
          </div>
          {filteredEntries.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">No rows match the current filters.</div>
          )}
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
              <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 bg-card/40 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {b.label || `Import · ${new Date(b.created_at).toLocaleString()}`}
                    {b.rolled_back_at && (
                      <Badge variant="outline" className="ml-2 text-[10px]">rolled back</Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {b.imported_count} imported · {b.error_count} errors
                    {b.summary?.created_goals ? ` · ${b.summary.created_goals} goal${b.summary.created_goals === 1 ? "" : "s"}` : ""}
                    {b.summary?.created_assets ? ` · ${b.summary.created_assets} asset${b.summary.created_assets === 1 ? "" : "s"}` : ""}
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
        Tip: also reachable from the Command Palette (<kbd className="px-1 border rounded">⌘K</kbd> → "Import data") and the sidebar.
        <Link to="/transactions" className="ml-2 underline">View transactions →</Link>
      </div>

      <IssueResolveModal
        open={!!resolveAcctIssue}
        onClose={() => setResolveAcctIssue(null)}
        issue={resolveAcctIssue as any}
        defaultCurrency={ccy}
        onResolved={handleAcctResolved}
      />
      <AssetResolveModal
        open={!!resolveAssetIssue}
        onClose={() => setResolveAssetIssue(null)}
        issue={resolveAssetIssue}
        onResolved={handleEntityResolved}
      />
      <GoalResolveModal
        open={!!resolveGoalIssue}
        onClose={() => setResolveGoalIssue(null)}
        issue={resolveGoalIssue}
        onResolved={handleEntityResolved}
      />

      <OpeningPositionWizard
        open={wizardTab !== null}
        defaultTab={wizardTab ?? "account"}
        onClose={() => setWizardTab(null)}
        onInsert={insertSnippet}
      />
      <QuickEntryDialog
        open={quickKind !== null}
        kind={quickKind ?? "deposit"}
        onClose={() => setQuickKind(null)}
        onInsert={insertSnippet}
      />
      <InlineEditDialog
        open={editEntry !== null}
        entry={editEntry}
        override={editEntry ? (overrides[editEntry.lineNo] ?? {}) : {}}
        accounts={accounts}
        assets={assets}
        goals={goals.map((g) => ({ id: g.id, name: g.name }))}
        onClose={() => setEditLine(null)}
        onSave={(o) => { if (editEntry) saveOverride(editEntry.lineNo, o); }}
      />
    </div>
  );
}


function normLoose(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function Stat({ label, value, tone, icon }: {
  label: string; value: string;
  tone?: "success" | "destructive" | "warning" | "cyan" | "muted";
  icon?: React.ReactNode;
}) {
  const color =
    tone === "success" ? "text-success" :
    tone === "destructive" ? "text-destructive" :
    tone === "warning" ? "text-warning" :
    tone === "cyan" ? "text-cyan" :
    tone === "muted" ? "text-muted-foreground" :
    "text-foreground";
  return (
    <div className="rounded-md border border-border/40 px-2 py-1.5 bg-card/40">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className={cn("font-mono text-sm font-semibold tabular-nums", color)}>{value}</div>
    </div>
  );
}

function HealthCard({ health }: { health: HealthReport }) {
  const [open, setOpen] = useState(false);
  const tone =
    health.tier === "excellent" ? { text: "text-success", bg: "bg-success/10", border: "border-success/30", bar: "bg-success" } :
    health.tier === "good"      ? { text: "text-success", bg: "bg-success/5",  border: "border-success/20", bar: "bg-success/80" } :
    health.tier === "review"    ? { text: "text-warning", bg: "bg-warning/10", border: "border-warning/30", bar: "bg-warning" } :
                                  { text: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", bar: "bg-destructive" };
  return (
    <div className={cn("rounded-md border p-3", tone.border, tone.bg)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Import Health Score</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={cn("text-2xl font-bold tabular-nums", tone.text)}>{health.score}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
            <span className={cn("text-xs font-medium", tone.text)}>· {healthTierLabel(health.tier)}</span>
          </div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] underline text-muted-foreground hover:text-foreground"
        >
          {open ? "Hide breakdown" : "Why this score?"}
        </button>
      </div>
      <div className="mt-2 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className={cn("h-full transition-all", tone.bar)} style={{ width: `${health.score}%` }} />
      </div>
      {open && (
        <div className="mt-3 space-y-1 text-[11px]">
          {health.breakdown.length === 0 ? (
            <div className="text-muted-foreground">No issues detected — perfect import.</div>
          ) : health.breakdown.map((b) => (
            <div key={b.key} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{b.label} <span className="opacity-60">× {b.count}</span></span>
              <span className="font-mono tabular-nums text-destructive">−{b.penalty}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function kindIcon(kind: ParsedEntry["kind"]) {
  switch (kind) {
    case "deposit": return <ArrowDownToLine className="h-3 w-3 text-success" />;
    case "expense": return <ArrowUpFromLine className="h-3 w-3 text-destructive" />;
    case "transfer": return <Repeat className="h-3 w-3 text-cyan" />;
    case "buy": return <TrendingUp className="h-3 w-3 text-success" />;
    case "sell": return <TrendingDown className="h-3 w-3 text-warning" />;
    case "goal_create": return <Target className="h-3 w-3 text-cyan" />;
    case "goal_contribution": return <Target className="h-3 w-3 text-success" />;
    case "account_open": return <Wallet className="h-3 w-3 text-muted-foreground" />;
    case "asset_open": return <Coins className="h-3 w-3 text-muted-foreground" />;
    default: return <AlertTriangle className="h-3 w-3 text-warning" />;
  }
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

function detailLabel(e: ParsedEntry): string {
  switch (e.kind) {
    case "transfer":
      return `${e.fromAccount?.matchedName ?? e.fromAccount?.raw ?? "?"} → ${e.toAccount?.matchedName ?? e.toAccount?.raw ?? "?"}`;
    case "buy":
    case "sell":
      return `${e.quantity ?? "?"} ${e.asset?.matchedSymbol ?? e.asset?.raw ?? "?"}${e.price ? ` @ ${e.price}` : ""}${e.account ? ` · ${e.account.matchedName ?? e.account.raw}` : ""}`;
    case "goal_create":
      return `${e.goal?.raw} → target ${e.targetAmount ?? 0}`;
    case "goal_contribution":
      return `→ ${e.goal?.matchedName ?? e.goal?.raw ?? "?"}`;
    case "account_open":
      return `${e.account?.matchedName ?? e.account?.raw ?? "?"} → ${e.amount}`;
    case "asset_open":
      return `${e.quantity} ${e.asset?.matchedSymbol ?? e.asset?.raw}${e.price ? ` @ ${e.price}` : ""}`;
    default:
      return e.account?.matchedName ?? e.account?.raw ?? "—";
  }
}

function amountCell(e: ParsedEntry, ccy: string) {
  const sign = e.kind === "expense" || e.kind === "buy" ? "−" : e.kind === "deposit" || e.kind === "sell" || e.kind === "goal_contribution" ? "+" : "";
  const color =
    e.kind === "deposit" || e.kind === "sell" || e.kind === "goal_contribution" ? "text-success" :
    e.kind === "expense" || e.kind === "buy" ? "text-destructive" : "";
  if (e.kind === "goal_create") return <span className="text-muted-foreground">target {formatCurrency(e.targetAmount ?? 0, ccy)}</span>;
  return <span className={cn("font-mono tabular-nums", color)}>{sign}{formatCurrency(e.amount, ccy)}</span>;
}

function EntryRow({ e, ccy, edited, issues, onFix, onEdit }: {
  e: ParsedEntry; ccy: string; edited: boolean; issues: ImportIssue[];
  onFix: (i: ImportIssue) => void; onEdit: () => void;
}) {
  const rowTone = e.severity === "error" ? "bg-destructive/5" : e.severity === "warning" ? "bg-warning/5" : "";
  return (
    <tr className={cn("border-t border-border/30", rowTone)}>
      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
        {new Date(e.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1.5">
          {kindIcon(e.kind)}<span className="capitalize">{e.kind.replace("_", " ")}</span>
        </span>
      </td>
      <td className="px-3 py-2 truncate max-w-[280px]">{detailLabel(e)}</td>
      <td className="px-3 py-2 text-right">{amountCell(e, ccy)}</td>
      <td className="px-3 py-2 truncate max-w-[240px]">{e.description ?? <span className="text-muted-foreground/60">—</span>}</td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusBadge(e)}
            {confidenceBadge(e)}
            {edited && <Badge variant="outline" className="text-[10px] border-cyan/40 text-cyan">edited</Badge>}
            {issues.map((iss, i) => (
              <Button key={i} size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => onFix(iss)}>
                <Wrench className="h-2.5 w-2.5 mr-1" />Fix {iss.kind === "unknown_account" ? "account" : iss.kind === "unknown_asset" ? "asset" : "goal"}
              </Button>
            ))}
          </div>
          {(e.errors.length > 0 || e.warnings.length > 0) && (
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              {e.errors.map((m, i) => <div key={`e${i}`} className="text-destructive">{m}</div>)}
              {e.warnings.map((m, i) => <div key={`w${i}`}>{m}</div>)}
            </div>
          )}
        </div>
      </td>
      <td className="px-2 py-2 align-top">
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onEdit} title="Edit row">
          <Pencil className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}

function EntryCard({ e, ccy, edited, issues, onFix, onEdit }: {
  e: ParsedEntry; ccy: string; edited: boolean; issues: ImportIssue[];
  onFix: (i: ImportIssue) => void; onEdit: () => void;
}) {
  const tone = e.severity === "error" ? "bg-destructive/5" : e.severity === "warning" ? "bg-warning/5" : "";
  return (
    <div className={cn("p-3 space-y-1.5", tone)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs min-w-0">
          {kindIcon(e.kind)} <span className="capitalize font-medium">{e.kind.replace("_", " ")}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground truncate">
            {new Date(e.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {confidenceBadge(e)}{statusBadge(e)}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate min-w-0">{detailLabel(e)}</span>
        <span className="font-mono font-semibold shrink-0">{amountCell(e, ccy)}</span>
      </div>
      {(e.description || e.category || edited) && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
          {edited && <Badge variant="outline" className="text-[10px] border-cyan/40 text-cyan">edited</Badge>}
          <span className="truncate">{e.description}{e.description && e.category ? " · " : ""}{e.category}</span>
        </div>
      )}
      {(e.errors.length > 0 || e.warnings.length > 0) && (
        <div className="text-[10px] space-y-0.5">
          {e.errors.map((m, i) => <div key={`e${i}`} className="text-destructive">{m}</div>)}
          {e.warnings.map((m, i) => <div key={`w${i}`} className="text-muted-foreground">{m}</div>)}
        </div>
      )}
      {issues.map((iss, i) => (
        <Button key={i} size="sm" variant="outline" className="h-7 w-full text-[11px]" onClick={() => onFix(iss)}>
          <Wrench className="h-3 w-3 mr-1" />Fix {iss.kind === "unknown_account" ? "account" : iss.kind === "unknown_asset" ? "asset" : "goal"}
        </Button>
      ))}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 rounded-md text-[11px] border transition",
        active
          ? "border-cyan/40 bg-cyan/10 text-cyan"
          : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

