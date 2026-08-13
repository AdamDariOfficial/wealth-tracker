import { MetricCard } from "@/components/MetricCard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowLeftRight, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { AccountForm } from "@/features/wealth-v2/forms/AccountForm";
import { formatDateTime, formatMoney, formatQuantity, humanize } from "@/features/wealth-v2/format";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useAuth } from "@/lib/auth-store";
import { useCoreUI } from "@/lib/core-ui-store";

type SearchState = { edit: boolean };

export const Route = createFileRoute("/accounts/$id")({
  validateSearch: (search: Partial<Record<keyof SearchState, unknown>>): SearchState => ({
    edit: search.edit === true || search.edit === "true" || search.edit === "1",
  }),
  component: AccountDetail,
});

function AccountDetail() {
  const { id } = Route.useParams();
  const { profile } = useAuth();
  const query = useFinancialState();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const openComposer = useCoreUI((state) => state.openComposer);

  if (query.isLoading) return <FinancialLoading />;
  if (query.isError || !query.data) {
    return <FinancialError error={query.error} retry={() => void query.refetch()} />;
  }

  const account = query.data.state.accounts.find((item) => item.id.toString() === id);
  const view = query.data.accounts.find((item) => item.id === id);
  if (!account || !view) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
        <div className="font-display font-semibold">Account not found</div>
        <Link
          to="/accounts"
          search={{ q: "", archived: false }}
          className="mt-3 inline-flex text-xs font-semibold text-cyan"
        >
          Back to Accounts
        </Link>
      </div>
    );
  }

  const assetById = new Map(query.data.state.assets.map((asset) => [asset.id.toString(), asset]));
  const balances = query.data.state.snapshot.balancesForAccount(account.id);
  const positions = balances.map((balance) => ({
    balance,
    asset: assetById.get(balance.assetId.toString()),
    valued: query.data.positions.find(
      (position) => position.accountId === id && position.assetId === balance.assetId.toString(),
    ),
  }));
  const transactions = query.data.transactions.filter((transaction) =>
    transaction.legs.some((leg) => leg.accountId === id),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <Link
        to="/accounts"
        search={{ q: "", archived: false }}
        className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Accounts
      </Link>
      <PageHeader
        title={account.name}
        subtitle={`${humanize(account.kind)} · ${humanize(account.ownership)}${
          account.isArchived() ? " · Archived" : ""
        }`}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void navigate({
                  search: { ...search, edit: true },
                })
              }
            >
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
            <Button
              onClick={() => openComposer("transaction")}
              className="bg-cyan text-background hover:bg-cyan/90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Transaction
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Known value"
          value={
            account.includeInNetWorth
              ? formatMoney(view.knownValue, profile?.locale ?? undefined)
              : "Excluded"
          }
        />
        <Metric label="Balances" value={String(balances.length)} />
        <Metric label="Unknown" value={String(view.unknownPositionCount)} />
        <Metric label="Transactions" value={String(transactions.length)} />
      </div>
      <section className="surface-section p-4 sm:p-5">
        <h2 className="font-display font-semibold">Balances</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Calculated from every transaction recorded on this account.
        </p>
        <div className="mt-4 divide-y divide-border/40">
          {positions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No balances in this account.
            </div>
          ) : (
            positions.map(({ balance, asset, valued }) => (
              <div
                key={balance.assetId.toString()}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="font-medium">{asset?.symbol ?? balance.assetId.toString()}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {asset?.name ?? "Unknown asset"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">
                    {formatQuantity(balance.quantity.toString())}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {valued
                      ? formatMoney(valued.value, profile?.locale ?? undefined)
                      : account.includeInNetWorth
                        ? "Unknown value"
                        : "Excluded"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="surface-section p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold">Account ledger</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Transactions touching this account.
            </p>
          </div>
          <ArrowLeftRight className="h-5 w-5 text-cyan" />
        </div>
        <div className="mt-4 space-y-2">
          {transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No transactions.</div>
          ) : (
            transactions.slice(0, 30).map((transaction) => (
              <Link
                key={transaction.id}
                to="/transactions"
                search={{ q: transaction.id, state: "all" }}
                className="block rounded-xl border border-border/50 bg-card/30 p-3 hover:border-cyan/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{transaction.description}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {formatDateTime(transaction.occurredAt, profile?.locale ?? undefined)}
                    </div>
                  </div>
                  <span className="label-muted">
                    {transaction.state}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
      <Dialog
        open={search.edit}
        onOpenChange={(open) => {
          if (!open) {
            void navigate({
              search: { ...search, edit: false },
              replace: true,
            });
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto motion-reduce:animate-none motion-reduce:transition-none">
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
            <DialogDescription>
              Change the account name, type and ownership. Your transaction history stays exactly as
              recorded.
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            key={account.id.toString()}
            existing={account}
            onSaved={() =>
              void navigate({
                search: { ...search, edit: false },
                replace: true,
              })
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <MetricCard label={label} value={value} />;
}
