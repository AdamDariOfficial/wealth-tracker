import { MetricCard, metricToneFromClass } from "@/components/MetricCard";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
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
import { advancedV2Keys, financialV2Keys } from "@/data/query-keys";
import { useAdvancedState } from "@/features/wealth-v2/use-advanced-state";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { formatDateTime, formatQuantity } from "@/features/wealth-v2/format";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useI18n } from "@/lib/use-i18n";
import { advancedV2Repository } from "@/lib/v2-runtime";
import { PageHeader } from "@/components/PageHeader";
import { describeActionError } from "@/features/wealth-v2/user-message";

export const Route = createFileRoute("/import")({ component: ImportPage });

function ImportPage() {
  const financial = useFinancialState();
  const advanced = useAdvancedState();
  const queryClient = useQueryClient();
  const { locale, t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceText, setSourceText] = useState("");
  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [committing, setCommitting] = useState(false);
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const preview = useMemo(() => {
    if (!financial.data || !sourceText.trim()) return null;
    return parseLedgerImport(sourceText, financial.data.state);
  }, [financial.data, sourceText]);

  const loadImportFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error(t("Choose a .csv file"));
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) {
        toast.error(t("The selected CSV file is empty"));
        return;
      }
      setSourceText(text);
      setSourceFilename(file.name);
      setLabel((current) => current || file.name.replace(/\.[^.]+$/, ""));
    } catch (error) {
      toast.error(describeActionError(error, t("Could not read CSV file")));
    }
  };

  const clearImportFile = () => {
    setSourceText("");
    setSourceFilename(null);
  };

  const downloadTemplate = () => {
    const blob = new Blob([LEDGER_IMPORT_EXAMPLE], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nebula-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

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
      toast.success(
        `${t("Imported")} ${preview.transactionCount} ${t(preview.transactionCount === 1 ? "transaction" : "transactions")}.`,
      );
      setSourceText("");
      setSourceFilename(null);
      setLabel("");
    } catch (error) {
      toast.error(describeActionError(error, t("Import failed")));
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
      toast.success(t("Import undone."));
      setRollbackId(null);
    } catch (error) {
      toast.error(describeActionError(error, t("Could not undo import")));
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
        subtitle="Upload a CSV file, review it, then import when everything looks right."
      />

      <section className="surface-section p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan" aria-hidden="true" />
              <h2 className="font-display font-semibold">{t("Import from CSV")}</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t(
                "Upload a CSV file and review the result before anything is saved. You never need to type CSV rows by hand.",
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={downloadTemplate}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("Download template")}
          </Button>
        </div>

        <div
          className="mt-5 rounded-2xl border border-dashed border-border/70 bg-muted/10 p-5 text-center sm:p-7"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) void loadImportFile(file);
          }}
        >
          <Upload className="mx-auto h-7 w-7 text-cyan" aria-hidden="true" />
          <div className="mt-3 font-display font-semibold">
            {sourceFilename ?? t("Drop your CSV file here")}
          </div>
          <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
            {t(
              sourceFilename
                ? "The file is loaded. Review the preview below before importing."
                : "Or choose a .csv file from your device.",
            )}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              {t(sourceFilename ? "Replace file" : "Choose CSV file")}
            </Button>
            {sourceFilename ? (
              <Button type="button" variant="ghost" className="min-h-11" onClick={clearImportFile}>
                {t("Remove")}
              </Button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void loadImportFile(file);
            }}
          />
        </div>

        <details className="mt-4 rounded-xl border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            {t("CSV format details")}
          </summary>
          <p className="mt-3 leading-5">
            {t(
              "A transaction may use more than one row. Rows that belong together use the same transaction ID.",
            )}
          </p>
          <code className="mt-2 block break-all font-mono">{LEDGER_IMPORT_HEADER.join(",")}</code>
        </details>

        <div className="mt-5 space-y-2">
          <Label htmlFor="import-label">{t("Import name")}</Label>
          <Input
            id="import-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={120}
            placeholder={t("August transactions")}
          />
        </div>
      </section>

      {sourceText.trim() && preview ? (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Transactions" value={String(preview.transactionCount)} />
            <Metric label="Rows" value={String(preview.legCount)} />
            <Metric
              label="Issues"
              value={String(preview.issues.length)}
              tone={preview.issues.length ? "text-destructive" : "text-success"}
            />
            <Metric
              label="Status"
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
                {t("Fix these issues before importing")}
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {preview.issues.map((issue, index) => (
                  <li key={`${issue.line ?? "batch"}-${index}`} className="flex gap-2">
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {issue.line === null ? t("Batch") : `${t("Line")} ${issue.line}`}
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
                {t("File is ready to import.")}
              </div>
            </div>
          )}

          <div className="surface-section overflow-hidden">
            <div className="border-b border-border/40 p-4 sm:p-5">
              <h2 className="font-display font-semibold">{t("Row preview")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("Preview shows the exact values that will be saved.")}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="text-left label-muted">
                  <tr className="border-b border-border/40">
                    <th className="px-4 py-3">{t("Line")}</th>
                    <th className="px-4 py-3">{t("Transaction")}</th>
                    <th className="px-4 py-3">{t("Account")}</th>
                    <th className="px-4 py-3">{t("Asset")}</th>
                    <th className="px-4 py-3 text-right">{t("Quantity")}</th>
                    <th className="px-4 py-3">{t("Description")}</th>
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
                        {formatQuantity(row.quantity, 18, locale)}
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
              {committing
                ? t("Importing…")
                : `${t("Import")} ${preview.transactionCount} ${t(preview.transactionCount === 1 ? "transaction" : "transactions")}`}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="surface-section p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-cyan" aria-hidden="true" />
          <h2 className="font-display font-semibold">{t("Import history")}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("You can undo an import later without deleting the activity that existed before it.")}
        </p>

        {receipts.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t("No imports yet.")}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {receipts.map((receipt) => (
              <article
                key={receipt.id}
                className="flex flex-col gap-4 rounded-xl border border-border/50 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{receipt.label ?? t("CSV import")}</span>
                    <Badge variant="secondary">
                      {receipt.transactionCount}{" "}
                      {t(receipt.transactionCount === 1 ? "transaction" : "transactions")}
                    </Badge>
                    {receipt.rolledBackAt ? <Badge variant="outline">{t("Undone")}</Badge> : null}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(receipt.createdAt, locale)}
                  </div>
                  {receipt.rolledBackAt ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t("Undone")} {formatDateTime(receipt.rolledBackAt, locale)}
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
                  {t("Undo import")}
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={rollbackId !== null} onOpenChange={(open) => !open && setRollbackId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this import?</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "This removes the effect of every transaction added by this import. If it cannot be undone safely, nothing changes.",
              )}
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
              {rollingBack ? t("Undoing…") : t("Undo import")}
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
