import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FilterX, Plus, Search, Undo2 } from "lucide-react";
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
import { safeEntityId } from "@/features/wealth-v2/form-utils";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useCoreUI } from "@/lib/core-ui-store";
import { financialV2Repository } from "@/lib/v2-runtime";
import { useI18n } from "@/lib/use-i18n";
import { cn } from "@/lib/utils";
import { describeActionError } from "@/features/wealth-v2/user-message";

type SearchState = { q: string; state: string; account?: string };

export const Route = createFileRoute("/transactions")({
  validateSearch: (search: Record<string, unknown>): SearchState => ({
    q: typeof search.q === "string" ? search.q : "",
    state: typeof search.state === "string" ? search.state : "all",
    account: typeof search.account === "string" ? search.account : "",
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const { locale, t } = useI18n();
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
      if (search.state === "active" && transaction.state !== "active") return false;
      if (search.state === "adjusted" && transaction.state === "active") return false;
      if (search.account && !transaction.legs.some((leg) => leg.accountId === search.account)) {
        return false;
      }
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
      toast.success(t("Transaction undone."));
      setVoidTarget(null);
    } catch (error) {
      const message = describeActionError(error, t("Could not undo transaction"));
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
  const accountOptions = query.data.accounts.filter(
    (account) => account.ownership === "owned" && !account.archived,
  );
  const ownedAccountIds = new Set(accountOptions.map((account) => account.id));
  const dayFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const groupedTransactions: Array<{
    label: string;
    items: (typeof transactions)[number][];
  }> = [];
  for (const transaction of transactions) {
    const label = dayFormatter.format(new Date(transaction.occurredAt));
    const current = groupedTransactions[groupedTransactions.length - 1];
    if (current?.label === label) current.items.push(transaction);
    else groupedTransactions.push({ label, items: [transaction] });
  }
  const hasFilters = Boolean(search.q || search.account || search.state !== "all");

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="All your recorded transactions in one place."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" /> {t("Export")}
            </Button>
            <Button
              onClick={() => openComposer("transaction")}
              className="bg-cyan text-background hover:bg-cyan/90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> {t("Add transaction")}
            </Button>
          </div>
        }
      />

      <div className="surface-section p-3 sm:p-4">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search.q}
              onChange={(event) => updateSearch({ q: event.target.value })}
              placeholder="Search transactions…"
              className="min-h-11 pl-9"
            />
          </div>
          <Select value={search.state} onValueChange={(state) => updateSearch({ state })}>
            <SelectTrigger className="min-h-11 w-full" aria-label={t("Transaction status")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Recorded</SelectItem>
              <SelectItem value="adjusted">Adjusted</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={search.account || "all"}
            onValueChange={(account) => updateSearch({ account: account === "all" ? "" : account })}
          >
            <SelectTrigger className="min-h-11 w-full" aria-label={t("Account filter")}>
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accountOptions.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => updateSearch({ q: "", state: "all", account: "" })}
            >
              <FilterX className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("Clear")}
            </Button>
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {transactions.length}{" "}
          {t(transactions.length === 1 ? "transaction shown" : "transactions shown")}
        </div>
      </div>

      <div className="space-y-6">
        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-14 text-center text-sm text-muted-foreground">
            {t("No matching transactions.")}
          </div>
        ) : (
          groupedTransactions.map((group) => (
            <section key={group.label} className="space-y-2.5">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-sm font-semibold capitalize text-foreground/80">
                  {group.label}
                </h2>
                <span className="rounded-full bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {group.items.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {group.items.map((transaction) => (
                  <article
                    key={transaction.id}
                    className="surface-quiet px-4 py-3.5 transition-colors hover:bg-muted/20"
                  >
                    <TransactionSummaryRow
                      transaction={transaction}
                      locale={locale}
                      maxMovements={2}
                      ownedAccountIds={ownedAccountIds}
                      dateMode="time"
                      trailing={
                        <div className="flex shrink-0 items-center gap-1">
                          {transaction.state !== "active" ? (
                            <span className="rounded-full bg-warning/10 px-2 py-1 text-[10px] uppercase tracking-wider text-warning">
                              {t("Adjusted")}
                            </span>
                          ) : null}
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
                              aria-label={`${t("Undo")} ${transaction.description}`}
                              title={t("Undo")}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      }
                    />
                  </article>
                ))}
              </div>
            </section>
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
            <AlertDialogTitle>Undo this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedVoid
                ? `“${selectedVoid.description}” ${t("will be undone while keeping your earlier history intact.")}`
                : t("This transaction will be undone while keeping your earlier history intact.")}
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
              {voiding ? t("Undoing…") : t("Undo transaction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
