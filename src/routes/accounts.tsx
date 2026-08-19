import { MetricCard } from "@/components/MetricCard";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  Bitcoin,
  Briefcase,
  Building2,
  HardDrive,
  Landmark,
  Plus,
  Search,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { putValidatedAccount } from "@/application/services";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { financialV2Keys } from "@/data/query-keys";
import { Account } from "@/domain/accounts";
import { UtcTimestamp } from "@/domain/core";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { formatMoney, humanize } from "@/features/wealth-v2/format";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useAuth } from "@/lib/auth-store";
import { useCoreUI } from "@/lib/core-ui-store";
import { cn } from "@/lib/utils";
import { financialV2Repository } from "@/lib/v2-runtime";
import { describeActionError } from "@/features/wealth-v2/user-message";

type SearchState = { q: string; archived: boolean };

export const Route = createFileRoute("/accounts")({
  validateSearch: (search: Partial<Record<keyof SearchState, unknown>>): SearchState => ({
    q: typeof search.q === "string" ? search.q : "",
    archived: search.archived === true || search.archived === "true" || search.archived === "1",
  }),
  component: AccountsPage,
});

const icons = {
  bank: Landmark,
  exchange: Building2,
  broker: Briefcase,
  "crypto-wallet": Bitcoin,
  "cold-wallet": HardDrive,
  cash: Wallet,
  savings: Wallet,
  investment: Briefcase,
  liability: Wallet,
  income: Wallet,
  expense: Wallet,
  external: Wallet,
  equity: Wallet,
} as const;

function AccountsPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const query = useFinancialState();
  const openComposer = useCoreUI((state) => state.openComposer);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const showingDetail = path.startsWith("/accounts/");

  const accounts = useMemo(() => {
    if (!query.data) return [];
    const needle = search.q.trim().toLowerCase();
    return query.data.accounts.filter(
      (account) =>
        account.ownership !== "system" &&
        (search.archived || !account.archived) &&
        (!needle ||
          `${account.name} ${account.kind} ${account.ownership}`.toLowerCase().includes(needle)),
    );
  }, [query.data, search.archived, search.q]);

  if (showingDetail) return <Outlet />;

  if (query.isLoading) return <FinancialLoading />;
  if (query.isError || !query.data) {
    return <FinancialError error={query.error} retry={() => void query.refetch()} />;
  }

  const updateSearch = (patch: Partial<SearchState>) =>
    void navigate({
      search: (previous: SearchState) => ({ ...previous, ...patch }),
      replace: patch.q !== undefined,
    });

  const toggleArchive = async (id: string) => {
    const existing = query.data.state.accounts.find((account) => account.id.toString() === id);
    if (!existing) return;
    try {
      const updated = Account.create({
        id: existing.id,
        name: existing.name,
        kind: existing.kind,
        ownership: existing.ownership,
        includeInNetWorth: existing.includeInNetWorth,
        openedAt: existing.openedAt,
        archivedAt: existing.archivedAt ? null : UtcTimestamp.fromDate(new Date()),
      });
      await putValidatedAccount(financialV2Repository, updated);
      await queryClient.invalidateQueries({ queryKey: financialV2Keys.all });
      toast.success(existing.archivedAt ? "Account restored" : "Account archived");
    } catch (error) {
      toast.error(describeActionError(error, "Could not update account"));
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Accounts"
        subtitle="Your banks, brokers, exchanges and wallets — the places where your money and investments are held."
        action={
          <Button
            onClick={() => openComposer("account")}
            className="bg-cyan text-background hover:bg-cyan/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Account
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary
          label="Known net worth"
          value={formatMoney(query.data.knownNetWorth, profile?.locale ?? undefined)}
        />
        <Summary
          label="Accounts"
          value={String(
            query.data.accounts.filter((account) => account.ownership !== "system").length,
          )}
        />
        <Summary
          label="Active"
          value={String(
            query.data.accounts.filter(
              (account) => account.ownership !== "system" && !account.archived,
            ).length,
          )}
        />
        <Summary
          label="Unknown positions"
          value={String(query.data.unknownPositionCount)}
          warning={query.data.unknownPositionCount > 0}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.q}
            onChange={(event) => updateSearch({ q: event.target.value })}
            placeholder="Search accounts…"
            className="pl-9"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => updateSearch({ archived: !search.archived })}
        >
          {search.archived ? "Hide archived" : "Show archived"}
        </Button>
      </div>
      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 px-4 py-14 text-center text-sm text-muted-foreground">
          No matching accounts.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const Icon = icons[account.kind] ?? Wallet;
            return (
              <article
                key={account.id}
                className={cn(
                  "surface-section relative p-2.5 sm:p-3",
                  account.archived && "opacity-60",
                )}
              >
                <Link
                  to="/accounts/$id"
                  search={{ q: "", archived: false, edit: false }}
                  params={{ id: account.id }}
                  className="surface-interactive flex min-w-0 items-center gap-3 rounded-xl pr-12"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-semibold">{account.name}</div>
                    <div className="mt-0.5 label-muted">{humanize(account.kind)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-base font-semibold">
                      {account.includeInNetWorth
                        ? formatMoney(account.knownValue, profile?.locale ?? undefined)
                        : "Excluded"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {account.positionCount} holding{account.positionCount === 1 ? "" : "s"}
                      {account.unknownPositionCount > 0
                        ? ` · ${account.unknownPositionCount} needs value`
                        : ""}
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => void toggleArchive(account.id)}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  title={account.archived ? "Restore account" : "Archive account"}
                  aria-label={`${account.archived ? "Restore" : "Archive"} ${account.name}`}
                >
                  <Archive className="h-4 w-4" />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return <MetricCard label={label} value={value} tone={warning ? "warning" : "neutral"} />;
}
