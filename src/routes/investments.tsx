import { MetricCard } from "@/components/MetricCard";
import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { AssetForm } from "@/features/wealth-v2/forms/AssetForm";
import { formatMoney, formatQuantity, humanize } from "@/features/wealth-v2/format";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useAuth } from "@/lib/auth-store";
import { useCoreUI } from "@/lib/core-ui-store";
import { cn } from "@/lib/utils";

const views = ["all", "fiat", "etf", "crypto", "equity", "fund", "commodity", "other"] as const;
type PortfolioView = (typeof views)[number];

type SearchState = { view: PortfolioView; q: string; asset: string };

export const Route = createFileRoute("/investments")({
  validateSearch: (search: Partial<Record<keyof SearchState, unknown>>): SearchState => ({
    view: views.includes(search.view as PortfolioView) ? (search.view as PortfolioView) : "all",
    q: typeof search.q === "string" ? search.q : "",
    asset: typeof search.asset === "string" ? search.asset : "",
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { profile } = useAuth();
  const query = useFinancialState();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const openComposer = useCoreUI((state) => state.openComposer);

  const positions = useMemo(() => {
    if (!query.data) return [];
    const q = search.q.trim().toLowerCase();
    return query.data.positions.filter((position) => {
      if (search.view !== "all" && position.kind !== search.view) return false;
      return (
        !q ||
        `${position.symbol} ${position.assetName} ${position.accountName}`.toLowerCase().includes(q)
      );
    });
  }, [query.data, search.q, search.view]);

  const assets = useMemo(() => {
    if (!query.data) return [];
    const q = search.q.trim().toLowerCase();
    return query.data.state.assets.filter((asset) => {
      if (search.view !== "all" && asset.kind !== search.view) return false;
      return !q || `${asset.symbol} ${asset.name}`.toLowerCase().includes(q);
    });
  }, [query.data, search.q, search.view]);

  if (query.isLoading) return <FinancialLoading />;
  if (query.isError || !query.data) {
    return <FinancialError error={query.error} retry={() => void query.refetch()} />;
  }

  const overview = query.data;
  const selectedAsset = search.asset
    ? (overview.state.assets.find((asset) => asset.id.toString() === search.asset) ?? null)
    : null;
  const selectedAssetHasHistory = selectedAsset
    ? overview.state.transactions.some((transaction) =>
        transaction.legs.some((leg) => leg.assetId.equals(selectedAsset.id)),
      )
    : false;
  const setSearch = (patch: Partial<SearchState>) =>
    void navigate({
      search: (previous: SearchState) => ({ ...previous, ...patch }),
      replace: patch.q !== undefined,
    });

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Portfolio"
        subtitle="Everything you own in one view — cash, ETFs, crypto, equities, funds and commodities."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openComposer("market-data")}>
              Market data
            </Button>
            <Button
              onClick={() => openComposer("asset")}
              className="bg-cyan text-background hover:bg-cyan/90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Asset
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary
          label="Known net worth"
          value={formatMoney(overview.knownNetWorth, profile?.locale ?? undefined)}
        />
        <Summary
          label="Known positions"
          value={`${overview.knownPositionCount}/${overview.totalPositionCount}`}
        />
        <Summary
          label="Unknown"
          value={String(overview.unknownPositionCount)}
          warning={overview.unknownPositionCount > 0}
        />
        <Summary label="Base currency" value={overview.baseCurrency ?? "—"} />
      </div>

      <div className="space-y-3">
        <div className="scroll-x-snap flex gap-2 pb-1">
          {views.map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setSearch({ view })}
              className={cn(
                "min-h-11 shrink-0 rounded-xl border px-3 text-xs font-medium",
                search.view === view
                  ? "border-cyan/30 bg-cyan/10 text-cyan"
                  : "border-border/60 bg-card/40 text-muted-foreground",
              )}
            >
              {view === "all" ? "All" : humanize(view)}
            </button>
          ))}
        </div>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.q}
            onChange={(event) => setSearch({ q: event.target.value })}
            placeholder="Search asset or account…"
            className="pl-9"
          />
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 px-4 py-14 text-center">
          <SlidersHorizontal className="mx-auto h-5 w-5 text-muted-foreground" />
          <div className="mt-3 text-sm font-medium">No matching positions</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Post a transaction or change the current Portfolio filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {positions.map((position) => (
            <article
              key={`${position.accountId}:${position.assetId}`}
              className="glass rounded-2xl p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-semibold">{position.symbol}</span>
                    <span className="rounded-full bg-muted/50 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {position.kind}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {position.assetName} · {position.accountName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm tabular-nums">
                    {formatQuantity(position.quantity)}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    quantity
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Known value
                  </div>
                  <div className="mt-1 font-display text-xl font-semibold">
                    {formatMoney(position.value, profile?.locale ?? undefined)}
                  </div>
                </div>
                {position.missingReason && (
                  <div className="max-w-[45%] rounded-lg border border-warning/25 bg-warning/5 px-2 py-1 text-right text-[10px] text-warning">
                    {humanize(position.missingReason)}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <section className="glass rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display font-semibold">Asset registry</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Details for this asset. Renaming it never changes your recorded transaction history.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {assets.length} matching asset{assets.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {assets.length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
              No assets match the current filters.
            </div>
          ) : (
            assets.map((asset) => (
              <div
                key={asset.id.toString()}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/30 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{asset.symbol}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {humanize(asset.kind)}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {asset.name} · precision {asset.precision}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => setSearch({ asset: asset.id.toString() })}
                  aria-label={`Edit ${asset.symbol}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      <Dialog
        open={selectedAsset !== null}
        onOpenChange={(open) => {
          if (!open) setSearch({ asset: "" });
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto motion-reduce:animate-none motion-reduce:transition-none">
          <DialogHeader>
            <DialogTitle>Edit asset</DialogTitle>
            <DialogDescription>
              Update the asset name, ticker and class. Your holdings and history are unaffected.
            </DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <AssetForm
              key={selectedAsset.id.toString()}
              existing={selectedAsset}
              identityLocked={selectedAssetHasHistory}
              onSaved={() => setSearch({ asset: "" })}
            />
          )}
        </DialogContent>
      </Dialog>
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
