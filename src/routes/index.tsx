import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  ArrowRight,
  CircleDollarSign,
  Landmark,
  PieChart,
  Plus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Money } from "@/domain/core";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { formatDateTime, formatMoney, humanize } from "@/features/wealth-v2/format";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useAuth } from "@/lib/auth-store";
import { useCoreUI } from "@/lib/core-ui-store";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const { profile } = useAuth();
  const query = useFinancialState();
  const openComposer = useCoreUI((state) => state.openComposer);

  if (query.isLoading) return <FinancialLoading />;
  if (query.isError || !query.data) {
    return <FinancialError error={query.error} retry={() => void query.refetch()} />;
  }

  const overview = query.data;
  const recent = overview.transactions.slice(0, 5);
  const activeAccounts = overview.accounts.filter((account) => !account.archived).length;
  const firstName = (profile?.displayName ?? "there").split(" ")[0];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Canonical wealth state derived from the v2 ledger."
        action={
          <Button
            onClick={() => openComposer("transaction")}
            className="bg-cyan text-background hover:bg-cyan/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Known net worth"
          value={formatMoney(overview.knownNetWorth, profile?.locale ?? undefined)}
          icon={Wallet}
          accent
        />
        <Metric
          label="Valuation"
          value={
            overview.valuationComplete ? "Complete" : `${overview.unknownPositionCount} unknown`
          }
          icon={CircleDollarSign}
        />
        <Metric label="Active accounts" value={String(activeAccounts)} icon={Landmark} />
        <Metric
          label="Transactions"
          value={String(overview.transactions.length)}
          icon={ArrowLeftRight}
        />
      </section>

      {!overview.valuationComplete && overview.totalPositionCount > 0 && (
        <div className="rounded-2xl border border-warning/25 bg-warning/5 p-4 text-sm">
          <div className="font-medium text-warning">Partial valuation</div>
          <p className="mt-1 text-muted-foreground">
            {overview.knownPositionCount} of {overview.totalPositionCount} included positions have a
            known value. Add missing prices or FX observations instead of treating them as zero.
          </p>
          <button
            type="button"
            onClick={() => openComposer("market-data")}
            className="mt-3 text-xs font-semibold text-cyan hover:underline"
          >
            Add market data →
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="glass rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-semibold">Allocation by asset class</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Known values only · {overview.baseCurrency ?? "no base currency"}
              </p>
            </div>
            <PieChart className="h-5 w-5 text-cyan" />
          </div>
          <div className="mt-5 space-y-3">
            {overview.allocation.length === 0 ? (
              <Empty text="No valued positions yet." />
            ) : (
              overview.allocation.map((item) => (
                <div
                  key={item.kind}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/30 px-3 py-3"
                >
                  <span className="text-sm">{humanize(item.kind)}</span>
                  <span className="font-mono text-sm tabular-nums">
                    {formatMoney(
                      Money.of(item.amount, item.currency),
                      profile?.locale ?? undefined,
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
          <Link
            to="/investments"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-cyan"
          >
            Open Portfolio <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        <section className="glass rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold">Recent transactions</h2>
              <p className="mt-1 text-xs text-muted-foreground">Immutable ledger history</p>
            </div>
            <ArrowLeftRight className="h-5 w-5 text-cyan" />
          </div>
          <div className="mt-4 space-y-2">
            {recent.length === 0 ? (
              <Empty text="No transactions yet." />
            ) : (
              recent.map((transaction) => (
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
                    <span className="rounded-full bg-muted/50 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {transaction.state}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className="glass min-w-0 rounded-2xl p-3 sm:p-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
        <Icon className={`h-4 w-4 ${accent ? "text-cyan" : ""}`} />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={`mt-3 truncate font-display text-lg font-semibold sm:text-2xl ${
          accent ? "text-gradient-cyan" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
