import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  Landmark,
  LineChart,
  PieChart,
  Plus,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { buildDashboardInsights } from "@/application/view-models";
import { ActivityRhythmChart } from "@/components/charts/ActivityRhythmChart";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { CompositionChart, compositionColor } from "@/components/charts/CompositionChart";
import { NetWorthDeltaChart } from "@/components/charts/NetWorthDeltaChart";
import { NetWorthTrendChart } from "@/components/charts/NetWorthTrendChart";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { TransactionSummaryRow } from "@/components/TransactionSummaryRow";
import { Button } from "@/components/ui/button";
import { Decimal, Money } from "@/domain/core";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { formatMoney, humanize } from "@/features/wealth-v2/format";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useAuth } from "@/lib/auth-store";
import { useCoreUI } from "@/lib/core-ui-store";
import { useI18n } from "@/lib/use-i18n";

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
  const { locale, t } = useI18n();
  const overview = query.data ?? null;

  // Derived once per data change. The dashboard never recomputes financial
  // history itself — it asks the application layer for it.
  const insights = useMemo(
    () => (overview ? buildDashboardInsights(overview, { now: new Date(), months: 12 }) : null),
    [overview],
  );

  if (query.isLoading) return <FinancialLoading />;
  if (query.isError || !overview || !insights) {
    return <FinancialError error={query.error} retry={() => void query.refetch()} />;
  }

  const recent = overview.transactions.slice(0, 5);
  const ownedAccountIds = new Set(
    overview.accounts
      .filter((account) => account.ownership === "owned")
      .map((account) => account.id),
  );
  const firstName = (profile?.displayName ?? t("there")).split(" ")[0];
  const hasAnything =
    overview.accounts.some((account) => account.ownership === "owned") ||
    overview.transactions.length > 0;
  const trend = insights.netWorthTrend;
  const topAccounts = insights.accountValues.slice(0, 5);
  const topAccountTotal = insights.accountValues.reduce(
    (total, account) => total.plus(account.knownValue.amount.abs()),
    Decimal.zero(),
  );
  const topAccountShare = (amount: Decimal) =>
    topAccountTotal.isZero()
      ? "0.0"
      : amount
          .abs()
          .dividedBy(topAccountTotal, 4, "half-even")
          .times(Decimal.fromInteger(100))
          .toFixed(1, "half-even");
  const allocationTotal = insights.composition.reduce(
    (total, slice) => total.plus(Decimal.parse(slice.amount).abs()),
    Decimal.zero(),
  );
  const liquidityAmount = insights.composition
    .filter((slice) => slice.kind === "fiat")
    .reduce((total, slice) => total.plus(Decimal.parse(slice.amount)), Decimal.zero());
  const investedAmount = insights.composition
    .filter((slice) => slice.kind !== "fiat")
    .reduce((total, slice) => total.plus(Decimal.parse(slice.amount)), Decimal.zero());
  const shareOfAllocation = (amount: Decimal) =>
    allocationTotal.isZero()
      ? "0.0"
      : amount
          .abs()
          .dividedBy(allocationTotal, 4, "half-even")
          .times(Decimal.fromInteger(100))
          .toFixed(1, "half-even");
  const liquidity = overview.baseCurrency
    ? Money.of(liquidityAmount.toString(), overview.baseCurrency)
    : null;
  const invested = overview.baseCurrency
    ? Money.of(investedAmount.toString(), overview.baseCurrency)
    : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={`${t("Welcome back")}, ${firstName}`}
        subtitle="Your complete financial position, updated as you record activity."
        action={
          <Button
            onClick={() => openComposer("transaction", "general")}
            className="bg-cyan text-background hover:bg-cyan/90"
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t("Add record")}
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
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t("Add an account")}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/import">{t("Import from a file")}</Link>
              </Button>
            </>
          }
        />
      ) : (
        <>
          {/* One focal value per page, supported by calm secondary metrics. */}
          <section
            aria-label={t("Financial summary")}
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
                    ? `${t("All positions valued in")} ${overview.baseCurrency}`
                    : `${overview.unknownPositionCount} ${t(overview.unknownPositionCount === 1 ? "position still needs a value" : "positions still need a value")}`
                  : "Set a base currency in Settings to see totals"
              }
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricCard
                label="Liquidity"
                value={formatMoney(liquidity, locale)}
                icon={Landmark}
                hint={`${shareOfAllocation(liquidityAmount)}% ${t("of known allocation")}`}
              />
              <MetricCard
                label="Invested"
                value={formatMoney(invested, locale)}
                icon={PieChart}
                hint={`${shareOfAllocation(investedAmount)}% ${t("of known allocation")}`}
              />
            </div>
          </section>

          {/* Net worth over time — each point is a canonical valuation of the
              ledger as it stood at that month's close. */}
          <SectionCard
            title="Known net worth over time"
            description={
              overview.baseCurrency
                ? `${t("Valued at each month close, in")} ${overview.baseCurrency}`
                : "Set a base currency in Settings to see your history"
            }
            icon={LineChart}
          >
            {trend.length < 2 || !overview.baseCurrency ? (
              <EmptyState
                compact
                title="Not enough history yet"
                description="Once you have activity across more than one month, your net worth curve appears here."
              />
            ) : (
              <ChartFrame
                height="tall"
                caption={
                  insights.trendComplete
                    ? "Every point values all positions held at that date."
                    : "Months where a position had no price are plotted from the known part only."
                }
              >
                <NetWorthTrendChart
                  points={trend}
                  currency={overview.baseCurrency}
                  locale={locale}
                />
              </ChartFrame>
            )}
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <SectionCard
              title="Composition"
              description={
                overview.baseCurrency
                  ? `${t("Known invested mix in")} ${overview.baseCurrency}`
                  : "Set a base currency to see your composition"
              }
              icon={PieChart}
            >
              {insights.composition.length === 0 ? (
                <EmptyState
                  compact
                  title="Nothing valued yet"
                  description="Once you hold a position with a known price, your composition appears here."
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-center">
                  <div className="h-48 w-full sm:h-52">
                    <CompositionChart slices={insights.composition} locale={locale} />
                  </div>
                  <div>
                    <ul className="space-y-1">
                      {insights.composition.map((slice, index) => {
                        const share = shareOfAllocation(Decimal.parse(slice.amount));
                        return (
                          <li key={slice.kind} className="py-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{
                                    background: compositionColor(index),
                                  }}
                                  aria-hidden="true"
                                />
                                <span className="min-w-0 truncate text-sm font-medium">
                                  {t(humanize(slice.kind))}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="block font-mono text-sm text-money">
                                  {formatMoney(Money.of(slice.amount, slice.currency), locale)}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                  {share}%
                                </span>
                              </span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${share}%`,
                                  background: compositionColor(index),
                                }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <Link
                      to="/investments"
                      search={{ view: "all", q: "", asset: "" }}
                      className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-cyan hover:underline md:min-h-0"
                    >
                      {t("Open Portfolio")}{" "}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Where your value sits"
              description="Accounts counted in net worth, largest first"
              icon={Landmark}
              bodyClassName="space-y-1"
            >
              {topAccounts.length === 0 ? (
                <EmptyState
                  compact
                  title="No valued accounts yet"
                  description="Accounts appear here once they hold a position with a known value."
                />
              ) : (
                <>
                  {topAccounts.map((account) => {
                    const share = topAccountShare(account.knownValue.amount);
                    return (
                      <Link
                        key={account.id}
                        to="/accounts/$id"
                        params={{ id: account.id }}
                        search={{ q: "", archived: false, edit: false }}
                        className="surface-interactive block rounded-lg px-2.5 py-2.5"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {account.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {t(humanize(account.kind))}
                              {account.unknownPositionCount > 0
                                ? ` · ${account.unknownPositionCount} ${t("unvalued")}`
                                : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block font-mono text-sm text-money">
                              {formatMoney(account.knownValue, locale)}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {share}%
                            </span>
                          </span>
                        </div>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/40">
                          <div
                            className="h-full rounded-full bg-cyan/70"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                  <Link
                    to="/accounts"
                    search={{ q: "", archived: false }}
                    className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-cyan hover:underline md:min-h-0"
                  >
                    {t("All accounts")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Monthly net worth change"
              description="How known net worth changed from one month close to the next"
              icon={LineChart}
            >
              {trend.length < 2 ? (
                <EmptyState
                  compact
                  title="Not enough history yet"
                  description="A monthly change chart appears after two valued month closes."
                />
              ) : (
                <ChartFrame caption="Includes recorded flows and valuation changes. This is a net-worth change view, not an investment-performance metric.">
                  <NetWorthDeltaChart points={trend} locale={locale} />
                </ChartFrame>
              )}
            </SectionCard>

            <SectionCard
              title="Recording rhythm"
              description="Entries you recorded each month"
              icon={Activity}
            >
              {insights.activityTotal === 0 ? (
                <EmptyState
                  compact
                  title="No entries in this period"
                  description="Your monthly recording rhythm appears here as you add transactions."
                />
              ) : (
                <ChartFrame
                  caption={`${insights.activityTotal} ${t(
                    insights.activityTotal === 1 ? "entry" : "entries",
                  )} ${t("in the last")} ${insights.activity.length} ${t(
                    insights.activity.length === 1 ? "month" : "months",
                  )}. ${t("Corrections are shown in violet.")}`}
                >
                  <ActivityRhythmChart buckets={insights.activity} locale={locale} />
                </ChartFrame>
              )}
            </SectionCard>

            <SectionCard
              title="Recent activity"
              className="xl:col-span-2"
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
                  {recent.map((transaction) => (
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
                  ))}
                  <Link
                    to="/transactions"
                    search={{ q: "", state: "all" }}
                    className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-cyan hover:underline md:min-h-0"
                  >
                    {t("View all transactions")}{" "}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
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
