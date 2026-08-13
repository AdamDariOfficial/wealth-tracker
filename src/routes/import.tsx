import { MetricCard, metricToneFromClass } from "@/components/MetricCard";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  FileText,
  History,
  RotateCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { importValidatedBatch } from "@/application/services";
import {
  LEDGER_IMPORT_EXAMPLE,
  LEDGER_IMPORT_HEADER,
  parseLedgerImport,
} from "@/application/imports";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { advancedV2Keys, financialV2Keys } from "@/data/query-keys";
import { useAdvancedState } from "@/features/wealth-v2/use-advanced-state";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { formatDateTime, formatQuantity } from "@/features/wealth-v2/format";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { advancedV2Repository } from "@/lib/v2-runtime";
import { PageHeader } from "@/components/PageHeader";
import { describeActionError } from "@/features/wealth-v2/user-message";

export const Route = createFileRoute("/import")({ component: ImportPage });

function ImportPage() {
  const financial = useFinancialState();
  const advanced = useAdvancedState();
  const queryClient = useQueryClient();
  const [sourceText, setSourceText] = useState("");
  const [label, setLabel] = useState("");
  const [committing, setCommitting] = useState(false);
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const preview = useMemo(() => {
    if (!financial.data || !sourceText.trim()) return null;
    return parseLedgerImport(sourceText, financial.data.state);
  }, [financial.data, sourceText]);

  const refreshCanonicalState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: financialV2Keys.all }),
      queryClient.invalidateQueries({ queryKey: advancedV2Keys.all }),
    ]);
  };

  const commit = async () => {
    if (
      !financial.data ||
      !preview ||
      preview.issues.length > 0 ||
      preview.transactions.length === 0
    ) {
      return;
    }
    setCommitting(true);
    try {
      await importValidatedBatch(advancedV2Repository, financial.data.state, {
        id: `import:${crypto.randomUUID()}`,
        label: label.trim() || null,
        sourceText,
        transactions: preview.transactions,
      });
      await refreshCanonicalState();
      toast.success(`Imported ${preview.transactionCount} transaction(s).`);
      setSourceText("");
      setLabel("");
    } catch (error) {
      toast.error(describeActionError(error, "Import failed"));
    } finally {
      setCommitting(false);
    }
  };

  const rollback = async () => {
    if (!rollbackId) return;
    setRollingBack(true);
    try {
      await advancedV2Repository.rollbackImportBatch(rollbackId);
      await refreshCanonicalState();
      toast.success("Import undone. Reversals were recorded for every affected transaction.");
      setRollbackId(null);
    } catch (error) {
      toast.error(describeActionError(error, "Rollback failed"));
    } finally {
      setRollingBack(false);
    }
  };

  if (financial.isLoading || advanced.isLoading) return <FinancialLoading />;
  if (financial.isError) {
    return <FinancialError error={financial.error} retry={() => void financial.refetch()} />;
  }
  if (advanced.isError) {
    return <FinancialError error={advanced.error} retry={() => void advanced.refetch()} />;
  }
  if (!financial.data || !advanced.data) return <FinancialLoading />;

  const receipts = advanced.data.importBatches;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Import"
        subtitle="Bring in your history from a spreadsheet. Review every row before anything is saved, and undo the whole import at any time."
      />

      <section className="glass rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan" aria-hidden="true" />
              <h2 className="font-display font-semibold">Import from CSV</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Each transaction uses two or more rows that share the same transaction id. Amounts are
              written exactly as you type them. The whole file is checked before anything is saved —
              if one row is wrong, nothing is imported.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => setSourceText(LEDGER_IMPORT_EXAMPLE)}
          >
            <Clipboard className="mr-2 h-4 w-4" aria-hidden="true" />
            Load example
          </Button>
        </div>

        <div className="mt-5 rounded-xl border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Exact header:</span>{" "}
          <code className="break-all font-mono">{LEDGER_IMPORT_HEADER.join(",")}</code>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="import-label">Receipt label</Label>
            <Input
              id="import-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={120}
              placeholder="August broker export"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="import-source">CSV rows</Label>
            <Textarea
              id="import-source"
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              className="min-h-64 font-mono text-xs leading-5"
              spellCheck={false}
              placeholder={LEDGER_IMPORT_EXAMPLE}
            />
          </div>
        </div>
      </section>

      {sourceText.trim() && preview ? (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Transactions" value={String(preview.transactionCount)} />
            <Metric label="Leg rows" value={String(preview.legCount)} />
            <Metric
              label="Issues"
              value={String(preview.issues.length)}
              tone={preview.issues.length ? "text-destructive" : "text-success"}
            />
            <Metric
              label="Commit"
              value={
                preview.issues.length === 0 && preview.transactionCount > 0 ? "Ready" : "Blocked"
              }
              tone={
                preview.issues.length === 0 && preview.transactionCount > 0
                  ? "text-success"
                  : "text-muted-foreground"
              }
            />
          </div>

          {preview.issues.length > 0 ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Fix every issue before committing
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {preview.issues.map((issue, index) => (
                  <li key={`${issue.line ?? "batch"}-${index}`} className="flex gap-2">
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {issue.line === null ? "Batch" : `Line ${issue.line}`}
                    </span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-success/30 bg-success/5 p-4 text-sm text-success">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Batch passed application-level ledger validation.
              </div>
            </div>
          )}

          <div className="glass overflow-hidden rounded-2xl">
            <div className="border-b border-border/40 p-4 sm:p-5">
              <h2 className="font-display font-semibold">Row preview</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Preview shows the exact values that will be saved.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40">
                    <th className="px-4 py-3">Line</th>
                    <th className="px-4 py-3">Transaction</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.legId} className="border-b border-border/30 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {row.line}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{row.transactionId}</td>
                      <td className="px-4 py-3">{row.accountName}</td>
                      <td className="px-4 py-3 font-mono">{row.assetSymbol}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatQuantity(row.quantity, 18)}
                      </td>
                      <td className="max-w-64 truncate px-4 py-3">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              className="min-h-11 bg-cyan text-background hover:bg-cyan/90"
              disabled={committing || preview.issues.length > 0 || preview.transactionCount === 0}
              onClick={() => void commit()}
            >
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              {committing ? "Importing…" : `Import ${preview.transactionCount} transactions`}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="glass rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-cyan" aria-hidden="true" />
          <h2 className="font-display font-semibold">Import receipts</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Rollback never deletes posted history. It creates exact reversal transactions for the
          whole batch.
        </p>

        {receipts.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No imports yet.</div>
        ) : (
          <div className="mt-5 space-y-3">
            {receipts.map((receipt) => (
              <article
                key={receipt.id}
                className="flex flex-col gap-4 rounded-xl border border-border/50 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{receipt.label ?? "Ledger import"}</span>
                    <Badge variant="secondary">{receipt.transactionCount} tx</Badge>
                    {receipt.rolledBackAt ? <Badge variant="outline">Rolled back</Badge> : null}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(receipt.createdAt)} · {receipt.id}
                  </div>
                  {receipt.rolledBackAt ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Reversed {formatDateTime(receipt.rolledBackAt)}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 shrink-0"
                  disabled={receipt.rolledBackAt !== null}
                  onClick={() => setRollbackId(receipt.id)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Roll back batch
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={rollbackId !== null} onOpenChange={(open) => !open && setRollbackId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll back this import?</AlertDialogTitle>
            <AlertDialogDescription>
              Every transaction from this import will be reversed exactly. If any imported
              transaction has already been corrected, the entire rollback fails without partial
              changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={rollingBack}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void rollback();
              }}
            >
              {rollingBack ? "Rolling back…" : "Create reversals"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return <MetricCard label={label} value={value} tone={metricToneFromClass(tone)} />;
}
