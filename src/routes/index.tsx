import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  ArrowRight,
  CircleDollarSign,
  Landmark,
  PieChart,
  Plus,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Decimal, Money } from "@/domain/core";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { formatDateTime, formatMoney, formatQuantity, humanize } from "@/features/wealth-v2/format";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useAuth } from "@/lib/auth-store";
import { useCoreUI } from "@/lib/core-ui-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nebula Wealth Hub" },
      {
        name: "description",
        content:
          "See your complete financial position at a glance: net worth, allocation across asset classes and your most recent activity.",
      },
      { property: "og:title", content: "Dashboard — Nebula Wealth Hub" },
      {
        property: "og:description",
        content:
          "See your complete financial position at a glance: net worth, allocation and recent activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile } = useAuth();
  const query = useFinancialState();
  const openComposer = useCoreUI((state) => state.openComposer);

  if (query.isLoading) return <FinancialLoading />;
  if (query.isError || !query.data) {
    return <FinancialError error={query.error} retry={() => void query.refetch()} />;
  }

  const overview = query.data;
  const locale = profile?.locale ?? undefined;
  const recent = overview.transactions.slice(0, 5);
  const activeAccounts = overview.accounts.filter((account) => !account.archived).length;
  const firstName = (profile?.displayName ?? "there").split(" ")[0];
  const hasAnything = overview.accounts.length > 0 || overview.transactions.length > 0;

  // Visual share only. The bar width is a presentation ratio and is never
  // used as, or displayed as, a monetary amount.
  const allocationTotal = overview.allocation.reduce(
    (total, item) => total.plus(Decimal.parse(item.amount)),
    Decimal.zero(),
  );
  const allocationTotalNumber = Number(allocationTotal.toString());
  const shareOf = (amount: string) =>
    allocationTotalNumber > 0 ? (Number(amount) / allocationTotalNumber) * 100 : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Your complete financial position, updated as you record activity."
        action={
          <Button
            onClick={() => openComposer("transaction")}
            className="bg-cyan text-background hover:bg-cyan/90"
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Add
          </Button>
        }
      />

      {!hasAnything ? (
        <EmptyState
          icon={Wallet}
          title="Let's set up your first account"
          description="Add an account to start tracking your balances. Once you record some activity, your net worth and allocation appear here automatically."
          action={
            <>
              <Button
                onClick={() => openComposer("account")}
                className="bg-cyan text-background hover:bg-cyan/90"
              >
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Add an account
              </Button>
              <Button variant="outline" asChild>
                <Link to="/import">Import from a file</Link>
              </Button>
            </>
          }
        />
      ) : (
        <>
          {/* One focal value per page, supported by calm secondary metrics. */}
          <section
            aria-label="Financial summary"
            className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]"
          >
            <MetricCard
              label="Known net worth"
              value={formatMoney(overview.knownNetWorth, locale)}
              icon={Wallet}
              emphasis="hero"
              tone="accent"
              hint={
                overview.baseCurrency
                  ? overview.valuationComplete
                    ? `All positions valued in ${overview.baseCurrency}`
                    : `${overview.unknownPositionCount} position${
                        overview.unknownPositionCount === 1 ? "" : "s"
                      } still need a value`
                  : "Set a base currency in Settings to see totals"
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard
                label="Valuation"
                value={
                  overview.valuationComplete
                    ? "Complete"
                    : `${overview.unknownPositionCount} unknown`
                }
                tone={overview.valuationComplete ? "positive" : "warning"}
                icon={CircleDollarSign}
                hint={`${overview.knownPositionCount} of ${overview.totalPositionCount} valued`}
              />
              <MetricCard
                label="Active accounts"
                value={String(activeAccounts)}
                icon={Landmark}
                hint={
                  overview.accounts.length > activeAccounts
                    ? `${overview.accounts.length - activeAccounts} archived`
                    : "None archived"
                }
              />
              <MetricCard
                label="Transactions"
                value={String(overview.transactions.length)}
                icon={ArrowLeftRight}
                className="col-span-2 sm:col-span-1"
                hint="Recorded to date"
              />
            </div>
          </section>

          {!overview.valuationComplete && overview.totalPositionCount > 0 && (
            <div
              className="rounded-2xl border border-warning/25 bg-warning/5 p-4 sm:p-5"
              role="status"
            >
              <div className="flex items-start gap-3">
                <TriangleAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-warning">Some values are missing</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {overview.knownPositionCount} of {overview.totalPositionCount} positions have a
                    known value. The rest are shown as unknown rather than counted as zero, so your
                    net worth stays honest.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => openComposer("market-data")}
                  >
                    Add missing prices
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <SectionCard
              title="Allocation by asset class"
              description={
                overview.baseCurrency
                  ? `Valued positions only, shown in ${overview.baseCurrency}`
                  : "Set a base currency to see your allocation"
              }
              icon={PieChart}
              bodyClassName="space-y-2.5"
            >
              {overview.allocation.length === 0 ? (
                <EmptyState
                  compact
                  title="Nothing valued yet"
                  description="Once you hold a position with a known price, your allocation appears here."
                />
              ) : (
                <>
                  {overview.allocation.map((item) => {
                    const share = shareOf(item.amount);
                    return (
                      <div key={item.kind} className="surface-quiet px-3 py-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium">
                            {humanize(item.kind)}
                          </span>
                          <span className="shrink-0 font-mono text-sm text-money">
                            {formatMoney(Money.of(item.amount, item.currency), locale)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40"
                            role="presentation"
                          >
                            <div
                              className="h-full rounded-full bg-cyan/80"
                              style={{ width: `${Math.max(share, 1.5)}%` }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                            {share.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <Link
                    to="/investments"
                    search={{ view: "all", q: "", asset: "" }}
                    className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-cyan hover:underline md:min-h-0"
                  >
                    Open Portfolio <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </>
              )}
            </SectionCard>

            <SectionCard
              title="Recent activity"
              description="Your five most recent entries"
              icon={ArrowLeftRight}
              bodyClassName="space-y-2"
            >
              {recent.length === 0 ? (
                <EmptyState
                  compact
                  title="No activity yet"
                  description="Record your first transaction to start building your history."
                  action={
                    <Button size="sm" variant="outline" onClick={() => openComposer("transaction")}>
                      Add a transaction
                    </Button>
                  }
                />
              ) : (
                <>
                  {recent.map((transaction) => {
                    const primaryLeg = transaction.legs[0];
                    return (
                      <Link
                        key={transaction.id}
                        to="/transactions"
                        search={{ q: transaction.id, state: "all" }}
                        className="block rounded-xl border border-border/50 bg-card/30 p-3 transition-colors hover:border-cyan/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {transaction.description}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatDateTime(transaction.occurredAt, locale)}
                            </div>
                          </div>
                          {primaryLeg && (
                            <div className="shrink-0 text-right">
                              <div className="font-mono text-sm text-money">
                                {formatQuantity(primaryLeg.quantity)}{" "}
                                <span className="text-muted-foreground">
                                  {primaryLeg.assetSymbol}
                                </span>
                              </div>
                              <div className="mt-0.5 max-w-[9rem] truncate text-xs text-muted-foreground">
                                {primaryLeg.accountName}
                              </div>
                            </div>
                          )}
                        </div>
                        {transaction.state !== "active" && (
                          <span className="mt-2 inline-flex rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {humanize(transaction.state)}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  <Link
                    to="/transactions"
                    search={{ q: "", state: "all" }}
                    className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-cyan hover:underline md:min-h-0"
                  >
                    View all transactions <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
