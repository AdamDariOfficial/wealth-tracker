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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { financialV2Keys } from "@/data/query-keys";
import { Account } from "@/domain/accounts";
import { UtcTimestamp } from "@/domain/core";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { formatMoney, humanize } from "@/features/wealth-v2/format";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useAuth } from "@/lib/auth-store";
import { useCoreUI } from "@/lib/core-ui-store";
import { useI18n } from "@/lib/use-i18n";
import { cn } from "@/lib/utils";
import { financialV2Repository } from "@/lib/v2-runtime";
import { describeActionError } from "@/features/wealth-v2/user-message";

type SearchState = { q: string; archived: boolean; group?: string };

export const Route = createFileRoute("/accounts")({
  validateSearch: (search: Partial<Record<keyof SearchState, unknown>>): SearchState => ({
    q: typeof search.q === "string" ? search.q : "",
    archived: search.archived === true || search.archived === "true" || search.archived === "1",
    group: typeof search.group === "string" ? search.group : "all",
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

type AccountGroup = "all" | "cash" | "investing" | "crypto" | "other";

function accountGroup(kind: string): AccountGroup {
  if (["bank", "cash", "savings", "liability"].includes(kind)) return "cash";
  if (["broker", "investment"].includes(kind)) return "investing";
  if (["exchange", "crypto-wallet", "cold-wallet"].includes(kind)) return "crypto";
  return "other";
}

function AccountsPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const query = useFinancialState();
  const openComposer = useCoreUI((state) => state.openComposer);
  const { locale, t } = useI18n();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const showingDetail = path.startsWith("/accounts/");

  const accounts = useMemo(() => {
    if (!query.data) return [];
    const needle = search.q.trim().toLowerCase();
    return query.data.accounts.filter(
      (account) =>
        account.ownership === "owned" &&
        (search.archived || !account.archived) &&
        (search.group === "all" || accountGroup(account.kind) === search.group) &&
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
      toast.success(t(existing.archivedAt ? "Account restored" : "Account archived"));
    } catch (error) {
      toast.error(describeActionError(error, t("Could not update account")));
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
            <Plus className="mr-1.5 h-4 w-4" /> New account
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Summary label="Total value" value={formatMoney(query.data.knownNetWorth, locale)} />
        <Summary
          label="Active accounts"
          value={String(
            query.data.accounts.filter(
              (account) => account.ownership === "owned" && !account.archived,
            ).length,
          )}
        />
        <Summary
          label="Holdings"
          value={String(
            query.data.accounts
              .filter((account) => account.ownership === "owned" && !account.archived)
              .reduce((total, account) => total + account.positionCount, 0),
          )}
        />
      </div>
      <div className="surface-section flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.q}
            onChange={(event) => updateSearch({ q: event.target.value })}
            placeholder="Search accounts…"
            className="min-h-11 pl-9"
          />
        </div>
        <Select value={search.group} onValueChange={(group) => updateSearch({ group })}>
          <SelectTrigger className="min-h-11 w-full sm:w-48" aria-label={t("Account category")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            <SelectItem value="cash">Banks &amp; cash</SelectItem>
            <SelectItem value="investing">Investments</SelectItem>
            <SelectItem value="crypto">Crypto</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          className="min-h-11 sm:ml-auto"
          onClick={() => updateSearch({ archived: !search.archived })}
        >
          {search.archived ? "Hide archived" : "Show archived"}
        </Button>
      </div>
      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 px-4 py-14 text-center text-sm text-muted-foreground">
          {t("No matching accounts.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const Icon = icons[account.kind] ?? Wallet;
            return (
              <article
                key={account.id}
                className={cn("relative", account.archived && "opacity-60")}
              >
                <Link
                  to="/accounts/$id"
                  search={{ q: "", archived: false, edit: false }}
                  params={{ id: account.id }}
                  className="surface-section surface-interactive flex min-h-[76px] min-w-0 items-center gap-3 p-3 pr-14"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-semibold">{account.name}</div>
                    <div className="mt-0.5 label-muted">{t(humanize(account.kind))}</div>
                    {account.unknownPositionCount > 0 ? (
                      <div className="mt-1 text-[10px] text-warning">
                        {account.unknownPositionCount}{" "}
                        {t(account.unknownPositionCount === 1 ? "value missing" : "values missing")}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={cn(
                        "font-display text-base font-semibold",
                        account.knownValue?.amount.isNegative() && "text-destructive",
                      )}
                    >
                      {account.includeInNetWorth
                        ? formatMoney(account.knownValue, locale)
                        : t("Excluded")}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {account.positionCount}{" "}
                      {t(account.positionCount === 1 ? "holding" : "holdings")}
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => void toggleArchive(account.id)}
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  title={t(account.archived ? "Restore account" : "Archive account")}
                  aria-label={`${t(account.archived ? "Restore" : "Archive")} ${account.name}`}
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
