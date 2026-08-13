import { MetricCard } from "@/components/MetricCard";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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

  const accounts = useMemo(() => {
    if (!query.data) return [];
    const needle = search.q.trim().toLowerCase();
    return query.data.accounts.filter(
      (account) =>
        (search.archived || !account.archived) &&
        (!needle ||
          `${account.name} ${account.kind} ${account.ownership}`.toLowerCase().includes(needle)),
    );
  }, [query.data, search.archived, search.q]);

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
        subtitle="Every bank, brokerage and wallet you hold. Balances update automatically from your recorded activity."
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
        <Summary label="Accounts" value={String(query.data.accounts.length)} />
        <Summary
          label="Active"
          value={String(query.data.accounts.filter((account) => !account.archived).length)}
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
                className={cn("glass rounded-2xl p-4 sm:p-5", account.archived && "opacity-60")}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Link
                    to="/accounts/$id"
                    search={{ q: "", archived: false, edit: false }}
                    params={{ id: account.id }}
                    className="min-w-0 flex-1"
                  >
                    <div className="truncate font-display font-semibold">{account.name}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {humanize(account.kind)} · {humanize(account.ownership)}
                    </div>
                  </Link>
                </div>
                <div className="mt-5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Known value
                  </div>
                  <div className="mt-1 font-display text-xl font-semibold">
                    {account.includeInNetWorth
                      ? formatMoney(account.knownValue, profile?.locale ?? undefined)
                      : "Excluded"}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-muted-foreground">
                    {account.positionCount} balance{account.positionCount === 1 ? "" : "s"}
                    {account.unknownPositionCount > 0
                      ? ` · ${account.unknownPositionCount} unknown`
                      : ""}
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleArchive(account.id)}
                    className="h-10 w-10 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    title={account.archived ? "Restore account" : "Archive account"}
                    aria-label={`${account.archived ? "Restore" : "Archive"} ${account.name}`}
                  >
                    <Archive className="mx-auto h-4 w-4" />
                  </button>
                </div>
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
