import { MetricCard } from "@/components/MetricCard";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { createReversalTransaction } from "@/application/commands";
import { postValidatedTransaction } from "@/application/services";
import { transactionId, transactionLegId } from "@/domain/ledger";
import { financialV2Keys } from "@/data/query-keys";
import { PageHeader } from "@/components/PageHeader";
import { TransactionSummaryRow } from "@/components/TransactionSummaryRow";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { humanize } from "@/features/wealth-v2/format";
import { safeEntityId } from "@/features/wealth-v2/form-utils";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useCoreUI } from "@/lib/core-ui-store";
import { financialV2Repository } from "@/lib/v2-runtime";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { describeActionError } from "@/features/wealth-v2/user-message";

type SearchState = { q: string; state: string };

export const Route = createFileRoute("/transactions")({
  validateSearch: (search: Record<string, unknown>): SearchState => ({
    q: typeof search.q === "string" ? search.q : "",
    state: typeof search.state === "string" ? search.state : "all",
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const query = useFinancialState();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const openComposer = useCoreUI((state) => state.openComposer);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);

  const transactions = useMemo(() => {
    if (!query.data) return [];
    const needle = search.q.trim().toLowerCase();
    return query.data.transactions.filter((transaction) => {
      if (search.state !== "all" && transaction.state !== search.state) return false;
      if (!needle) return true;
      const haystack = [
        transaction.id,
        transaction.description,
        transaction.state,
        transaction.purpose,
        ...transaction.legs.flatMap((leg) => [
          leg.accountName,
          leg.assetSymbol,
          leg.quantity,
          leg.memo ?? "",
        ]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query.data, search]);

  if (query.isLoading) return <FinancialLoading />;
  if (query.isError || !query.data) {
    return <FinancialError error={query.error} retry={() => void query.refetch()} />;
  }

  const updateSearch = (patch: Partial<SearchState>) =>
    void navigate({
      search: (previous: SearchState) => ({ ...previous, ...patch }),
      replace: patch.q !== undefined,
    });

  const voidTransaction = async (id: string) => {
    const original = query.data.state.transactions.find(
      (transaction) => transaction.id.toString() === id,
    );
    if (!original) return;

    setVoiding(id);
    try {
      setVoidError(null);
      const reversal = createReversalTransaction({
        id: transactionId(safeEntityId("tx-reversal")),
        original,
        legIds: original.legs.map((_, index) =>
          transactionLegId(safeEntityId(`leg-reversal-${index + 1}`)),
        ),
      });
      await postValidatedTransaction(financialV2Repository, reversal);
      await queryClient.invalidateQueries({ queryKey: financialV2Keys.all });
      toast.success("Transaction voided. A matching reversal was recorded.");
      setVoidTarget(null);
    } catch (error) {
      const message = describeActionError(error, "Could not void transaction");
      setVoidError(message);
      toast.error(message);
    } finally {
      setVoiding(null);
    }
  };

  const exportCsv = () => {
    const rows = transactions.flatMap((transaction) =>
      transaction.legs.map((leg) => [
        transaction.id,
        transaction.occurredAt,
        transaction.recordedAt,
        transaction.description,
        transaction.purpose,
        transaction.state,
        leg.id,
        leg.accountName,
        leg.assetSymbol,
        leg.quantity,
        leg.memo ?? "",
      ]),
    );
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [
      [
        "transaction_id",
        "occurred_at",
        "recorded_at",
        "description",
        "purpose",
        "state",
        "leg_id",
        "account",
        "asset",
        "quantity",
        "memo",
      ],
      ...rows,
    ]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nebula-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const selectedVoid = voidTarget
    ? query.data.transactions.find((transaction) => transaction.id === voidTarget)
    : null;
  const locale = profile?.locale ?? undefined;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="Your recorded activity, kept immutable and easy to scan."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
            <Button
              onClick={() => openComposer("transaction")}
              className="bg-cyan text-background hover:bg-cyan/90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Activity
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Records" value={String(query.data.transactions.length)} />
        <Metric
          label="Active"
          value={String(
            query.data.transactions.filter((transaction) => transaction.state === "active").length,
          )}
        />
        <Metric
          label="Voided"
          value={String(
            query.data.transactions.filter((transaction) => transaction.state === "voided").length,
          )}
        />
        <Metric
          label="Corrections"
          value={String(
            query.data.transactions.filter((transaction) => transaction.purpose !== "standard")
              .length,
          )}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.q}
            onChange={(event) => updateSearch({ q: event.target.value })}
            placeholder="Search activity…"
            className="pl-9"
          />
        </div>
        <Select value={search.state} onValueChange={(state) => updateSearch({ state })}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Transaction state">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["all", "active", "voided", "replaced", "reversal", "replacement"].map((state) => (
              <SelectItem key={state} value={state}>
                {humanize(state)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-14 text-center text-sm text-muted-foreground">
            No matching activity.
          </div>
        ) : (
          transactions.map((transaction) => (
            <article key={transaction.id} className="surface-section px-3 py-2.5 sm:px-3.5">
              <TransactionSummaryRow
                transaction={transaction}
                locale={locale}
                maxMovements={1}
                trailing={
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] uppercase tracking-wider",
                        transaction.state === "active"
                          ? "bg-success/10 text-success"
                          : "bg-muted/60 text-muted-foreground",
                      )}
                    >
                      {transaction.state}
                    </span>
                    {transaction.state === "active" && transaction.purpose === "standard" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={voiding === transaction.id}
                        onClick={() => {
                          setVoidError(null);
                          setVoidTarget(transaction.id);
                        }}
                        className="h-11 w-11 text-muted-foreground hover:text-foreground"
                        aria-label={`Void ${transaction.description}`}
                        title="Void"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                }
              />
            </article>
          ))
        )}
      </div>

      <AlertDialog
        open={voidTarget !== null}
        onOpenChange={(open) => {
          if (!open && !voiding) {
            setVoidError(null);
            setVoidTarget(null);
          }
        }}
      >
        <AlertDialogContent className="motion-reduce:animate-none motion-reduce:transition-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Void this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedVoid
                ? `“${selectedVoid.description}” will remain in the audit history and a new exact reversal will be posted. This does not delete or edit the original record.`
                : "The original record will remain in the audit history and a new exact reversal will be posted."}
            </AlertDialogDescription>
            {voidError && (
              <p role="alert" className="text-sm text-destructive">
                {voidError}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voiding !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!voidTarget || voiding !== null}
              onClick={(event) => {
                event.preventDefault();
                if (voidTarget) void voidTransaction(voidTarget);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voiding ? "Posting reversal…" : "Post reversal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <MetricCard label={label} value={value} />;
}
