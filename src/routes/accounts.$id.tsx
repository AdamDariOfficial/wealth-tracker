import { buildAccountValueTrend } from "@/application/view-models";
import { MetricCard } from "@/components/MetricCard";
import { AccountValueTrendChart } from "@/components/charts/AccountValueTrendChart";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { SectionCard } from "@/components/SectionCard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { TransactionSummaryRow } from "@/components/TransactionSummaryRow";
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
import { formatMoney, formatQuantity, humanize } from "@/features/wealth-v2/format";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useAuth } from "@/lib/auth-store";
import { useCoreUI } from "@/lib/core-ui-store";
import { useI18n } from "@/lib/use-i18n";

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
  const { locale, t } = useI18n();
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
  if (!account || !view || account.ownership !== "owned") {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
        <div className="font-display font-semibold">{t("Account not found")}</div>
        <Link
          to="/accounts"
          search={{ q: "", archived: false }}
          className="mt-3 inline-flex text-xs font-semibold text-cyan"
        >
          {t("Back to Accounts")}
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
  const ownedAccountIds = new Set(
    query.data.accounts.filter((item) => item.ownership === "owned").map((item) => item.id),
  );
  const valueTrend = account.includeInNetWorth
    ? buildAccountValueTrend(query.data, {
        accountId: id,
        now: new Date(),
        months: 12,
      })
    : [];
  const firstTrendPoint = valueTrend.length > 1 ? valueTrend[0] : null;
  const lastTrendPoint = valueTrend.length > 1 ? valueTrend[valueTrend.length - 1] : null;
  const valueChange =
    firstTrendPoint && lastTrendPoint
      ? lastTrendPoint.knownValue.minus(firstTrendPoint.knownValue)
      : null;
  const valueChangeComplete =
    Boolean(firstTrendPoint?.complete) && Boolean(lastTrendPoint?.complete);
  const valueChangeTone = !valueChange
    ? "neutral"
    : !valueChangeComplete
      ? "warning"
      : valueChange.amount.isNegative()
        ? "negative"
        : valueChange.amount.isZero()
          ? "neutral"
          : "positive";

  return (
    <div className="space-y-5 sm:space-y-6">
      <Link
        to="/accounts"
        search={{ q: "", archived: false }}
        className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("Accounts")}
      </Link>
      <PageHeader
        title={account.name}
        subtitle={`${t(humanize(account.kind))} · ${t(account.includeInNetWorth ? "Included in totals" : "Excluded from totals")}${
          account.isArchived() ? ` · ${t("Archived")}` : ""
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
              <Pencil className="mr-1.5 h-4 w-4" /> {t("Edit")}
            </Button>
            <Button
              onClick={() => openComposer("transaction")}
              className="bg-cyan text-background hover:bg-cyan/90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add transaction
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Account value"
          value={account.includeInNetWorth ? formatMoney(view.knownValue, locale) : "Excluded"}
          hint="Current account value"
        />
        <Metric
          label="Value change"
          value={formatMoney(valueChange, locale)}
          hint="Includes deposits, withdrawals and market moves"
          tone={valueChangeTone}
        />
        <Metric label="Assets" value={String(balances.length)} hint="Current balances" />
        <Metric label="Transactions" value={String(transactions.length)} hint="Recorded history" />
      </div>

      {view.unknownPositionCount > 0 ? (
        <div className="rounded-xl border border-warning/25 bg-warning/[0.05] px-4 py-3 text-sm text-warning">
          {view.unknownPositionCount} ·{" "}
          {t(
            "Some asset values are unavailable. Account totals and the trend use only the values currently known.",
          )}
        </div>
      ) : null}

      {valueTrend.length > 1 ? (
        <SectionCard
          title="Account value trend"
          description="How this account value changed over the last 12 months. This is not investment performance."
        >
          <ChartFrame
            height="compact"
            caption="Deposits, withdrawals, transfers and market moves are all reflected."
          >
            <AccountValueTrendChart points={valueTrend} locale={locale} />
          </ChartFrame>
        </SectionCard>
      ) : null}

      <section className="surface-section p-4 sm:p-5">
        <h2 className="font-display font-semibold">{t("Balances & assets")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("What this account currently holds.")}
        </p>
        <div className="mt-4 divide-y divide-border/40">
          {positions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No holdings in this account.
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
                      ? formatMoney(valued.value, locale)
                      : account.includeInNetWorth
                        ? "Value unavailable"
                        : "Excluded"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="surface-section p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold">{t("Recent transactions")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The latest transactions involving this account.
            </p>
          </div>
          <Link
            to="/transactions"
            search={{ q: "", state: "all", account: id }}
            className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-cyan hover:underline md:min-h-0"
          >
            View all transactions <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No transactions yet.
            </div>
          ) : (
            transactions.slice(0, 8).map((transaction) => (
              <Link
                key={transaction.id}
                to="/transactions"
                search={{ q: transaction.id, state: "all" }}
                className="surface-quiet surface-interactive block px-3 py-2.5"
              >
                <TransactionSummaryRow
                  transaction={transaction}
                  locale={locale}
                  ownedAccountIds={ownedAccountIds}
                />
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
              Change the account name and type. Your transaction history stays exactly as recorded.
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

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative" | "warning";
}) {
  return <MetricCard label={label} value={value} hint={hint} tone={tone} />;
}
