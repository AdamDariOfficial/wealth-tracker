import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  CircleDollarSign,
  Landmark,
  LineChart,
  PieChart,
  Plus,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { buildDashboardInsights } from "@/application/view-models";
import { ActivityRhythmChart } from "@/components/charts/ActivityRhythmChart";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { CompositionChart, compositionColor } from "@/components/charts/CompositionChart";
import { NetWorthTrendChart } from "@/components/charts/NetWorthTrendChart";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { TransactionSummaryRow } from "@/components/TransactionSummaryRow";
import { Button } from "@/components/ui/button";
import { Money } from "@/domain/core";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { formatMoney, humanize } from "@/features/wealth-v2/format";
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

  const locale = profile?.locale ?? undefined;
  const recent = overview.transactions.slice(0, 5);
  const activeAccounts = overview.accounts.filter((account) => !account.archived).length;
  const firstName = (profile?.displayName ?? "there").split(" ")[0];
  const hasAnything = overview.accounts.length > 0 || overview.transactions.length > 0;
  const trend = insights.netWorthTrend;
  const topAccounts = insights.accountValues.slice(0, 5);

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

          {/* Net worth over time — each point is a canonical valuation of the
              ledger as it stood at that month's close. */}
          <SectionCard
            title="Known net worth over time"
            description={
              overview.baseCurrency
                ? `Valued at each month close, in ${overview.baseCurrency}`
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
              title="Composition by asset class"
              description={
                overview.baseCurrency
                  ? `Valued positions only, shown in ${overview.baseCurrency}`
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
                <div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:items-center">
                  <ChartFrame height="compact" className="sm:space-y-0">
                    <CompositionChart slices={insights.composition} locale={locale} />
                  </ChartFrame>
                  <div>
                    <ul className="space-y-1">
                      {insights.composition.map((slice, index) => (
                        <li
                          key={slice.kind}
                          className="flex items-baseline justify-between gap-3 py-1.5"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: compositionColor(index) }}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 truncate text-sm font-medium">
                              {humanize(slice.kind)}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-sm text-money">
                            {formatMoney(Money.of(slice.amount, slice.currency), locale)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/investments"
                      search={{ view: "all", q: "", asset: "" }}
                      className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-cyan hover:underline md:min-h-0"
                    >
                      Open Portfolio <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
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
                  {topAccounts.map((account) => (
                    <Link
                      key={account.id}
                      to="/accounts/$id"
                      params={{ id: account.id }}
                      search={{ q: "", archived: false, edit: false }}
                      className="surface-interactive flex items-baseline justify-between gap-3 rounded-lg px-2.5 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{account.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {humanize(account.kind)}
                          {account.unknownPositionCount > 0
                            ? ` · ${account.unknownPositionCount} unvalued`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-sm text-money">
                        {formatMoney(account.knownValue, locale)}
                      </span>
                    </Link>
                  ))}
                  <Link
                    to="/accounts"
                    search={{ q: "", archived: false }}
                    className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-cyan hover:underline md:min-h-0"
                  >
                    All accounts <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
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
                  caption={`${insights.activityTotal} ${
                    insights.activityTotal === 1 ? "entry" : "entries"
                  } in the last ${insights.activity.length} ${
                    insights.activity.length === 1 ? "month" : "months"
                  }. Corrections are shown in violet.`}
                >
                  <ActivityRhythmChart buckets={insights.activity} locale={locale} />
                </ChartFrame>
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
                  {recent.map((transaction) => (
                    <Link
                      key={transaction.id}
                      to="/transactions"
                      search={{ q: transaction.id, state: "all" }}
                      className="surface-quiet surface-interactive block px-3 py-2.5"
                    >
                      <TransactionSummaryRow transaction={transaction} locale={locale} />
                    </Link>
                  ))}
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
