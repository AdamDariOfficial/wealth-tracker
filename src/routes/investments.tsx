import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { deleteValidatedUnusedAsset, appendValidatedPriceQuote } from "@/application/services";
import type { PositionView } from "@/application/view-models/wealth-overview";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { advancedV2Keys, financialV2Keys } from "@/data/query-keys";
import type { Asset } from "@/domain/assets";
import { Decimal, Money, UtcTimestamp } from "@/domain/core";
import { PriceQuote } from "@/domain/valuation";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { FxManager } from "@/features/wealth-v2/FxManager";
import { AssetForm } from "@/features/wealth-v2/forms/AssetForm";
import { normalizeCurrency, normalizeLocalizedDecimalInput } from "@/features/wealth-v2/form-utils";
import { formatMoney, formatQuantity, humanize } from "@/features/wealth-v2/format";
import { useAdvancedState } from "@/features/wealth-v2/use-advanced-state";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/lib/use-i18n";
import { cn } from "@/lib/utils";
import { financialV2Repository } from "@/lib/v2-runtime";
import { describeActionError } from "@/features/wealth-v2/user-message";

const views = ["all", "fiat", "etf", "crypto", "equity", "fund", "commodity", "other"] as const;
type PortfolioView = (typeof views)[number];
type SearchState = { view: PortfolioView; q: string; asset: string };
type PortfolioPositionGroup = Readonly<{
  assetId: string;
  symbol: string;
  assetName: string;
  kind: PositionView["kind"];
  positions: readonly PositionView[];
}>;

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
  const financial = useFinancialState();
  const advanced = useAdvancedState();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { locale, t } = useI18n();
  const [createAssetOpen, setCreateAssetOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [priceAsset, setPriceAsset] = useState<Asset | null>(null);
  const [expandedAssetIds, setExpandedAssetIds] = useState<Set<string>>(() => new Set());
  const [fxOpen, setFxOpen] = useState(false);
  const [deleteAsset, setDeleteAsset] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const positionGroups = useMemo<readonly PortfolioPositionGroup[]>(() => {
    if (!financial.data) return [];
    const groups = new Map<
      string,
      {
        assetId: string;
        symbol: string;
        assetName: string;
        kind: PositionView["kind"];
        positions: PositionView[];
      }
    >();

    for (const position of financial.data.positions) {
      if (search.view !== "all" && position.kind !== search.view) continue;
      const current = groups.get(position.assetId);
      if (current) current.positions.push(position);
      else {
        groups.set(position.assetId, {
          assetId: position.assetId,
          symbol: position.symbol,
          assetName: position.assetName,
          kind: position.kind,
          positions: [position],
        });
      }
    }

    const q = search.q.trim().toLowerCase();
    return [...groups.values()]
      .filter((group) => {
        if (!q) return true;
        if (`${group.symbol} ${group.assetName}`.toLowerCase().includes(q)) return true;
        return group.positions.some((position) => position.accountName.toLowerCase().includes(q));
      })
      .sort((left, right) => left.symbol.localeCompare(right.symbol));
  }, [financial.data, search.q, search.view]);

  if (financial.isLoading || advanced.isLoading) return <FinancialLoading />;
  if (financial.isError || advanced.isError || !financial.data || !advanced.data) {
    return (
      <FinancialError
        error={financial.error ?? advanced.error}
        retry={() => {
          void financial.refetch();
          void advanced.refetch();
        }}
      />
    );
  }

  const overview = financial.data;
  const setSearch = (patch: Partial<SearchState>, replace = patch.q !== undefined) =>
    void navigate({ search: (previous: SearchState) => ({ ...previous, ...patch }), replace });
  const ownedIds = new Set(
    overview.state.accounts
      .filter((account) => account.ownership === "owned")
      .map((account) => account.id.toString()),
  );

  const heldAssetIds = new Set(overview.positions.map((position) => position.assetId));
  const holdingAccountIds = new Set(overview.positions.map((position) => position.accountId));
  const missingPriceAssets = new Set<string>();
  const missingFxAssets = new Set<string>();
  for (const position of overview.valuation?.positions ?? []) {
    if (position.status !== "unknown") continue;
    if (position.reason === "missing-price") missingPriceAssets.add(position.assetId.toString());
    else missingFxAssets.add(position.assetId.toString());
  }

  const assetFacts = (asset: Asset): AssetFacts => {
    let quantity = Decimal.zero();
    for (const balance of overview.state.snapshot.balances) {
      if (balance.assetId.equals(asset.id) && ownedIds.has(balance.accountId.toString())) {
        quantity = quantity.plus(balance.quantity);
      }
    }
    const assetPositions = overview.positions.filter(
      (position) => position.assetId === asset.id.toString() && ownedIds.has(position.accountId),
    );
    let knownValue: Money | null = overview.baseCurrency ? Money.zero(overview.baseCurrency) : null;
    let knownCount = 0;
    let partial = false;
    for (const position of assetPositions) {
      if (!position.value) partial = true;
      else if (knownValue) {
        knownValue = knownValue.plus(position.value);
        knownCount += 1;
      }
    }
    const value = partial && knownCount === 0 ? null : knownValue;
    const quotes = overview.state.priceQuotes.filter((quote) => quote.assetId.equals(asset.id));
    const latest =
      [...quotes].sort(
        (left, right) => Date.parse(right.asOf.toString()) - Date.parse(left.asOf.toString()),
      )[0] ?? null;
    const hasHistory = overview.state.transactions.some((transaction) =>
      transaction.legs.some((leg) => leg.assetId.equals(asset.id)),
    );
    const hasGoal = advanced.data.goals.some((goal) => goal.targetAssetId === asset.id.toString());
    const base =
      asset.kind === "fiat" && profile?.baseCurrency?.toString() === asset.fiatCurrency?.toString();
    return {
      quantity,
      value,
      partial,
      latest,
      hasHistory,
      hasGoal,
      base,
      canDelete: !hasHistory && !hasGoal && !base,
    };
  };

  const removeAsset = async () => {
    if (!deleteAsset) return;
    setDeleting(true);
    try {
      await deleteValidatedUnusedAsset(
        financialV2Repository,
        overview.state,
        advanced.data,
        deleteAsset.id.toString(),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: financialV2Keys.all }),
        queryClient.invalidateQueries({ queryKey: advancedV2Keys.all }),
      ]);
      toast.success(t("Asset deleted"));
      setDeleteAsset(null);
    } catch (error) {
      toast.error(describeActionError(error, t("Could not delete asset")));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Portfolio" subtitle="Your assets and positions across every account." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Portfolio value"
          value={formatMoney(overview.knownNetWorth, locale)}
          hint={overview.valuationComplete ? "Complete valuation" : "Partial valuation"}
          tone={overview.valuationComplete ? "neutral" : "warning"}
        />
        <MetricCard label="Assets held" value={String(heldAssetIds.size)} />
        <MetricCard label="Accounts with holdings" value={String(holdingAccountIds.size)} />
        <MetricCard label="Base currency" value={overview.baseCurrency ?? "—"} />
      </div>

      {!overview.valuationComplete && overview.unknownPositionCount > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/[0.05] p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <div className="font-medium text-warning">{t("Partial valuation")}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("Known values are shown without treating missing data as zero.")}{" "}
              {missingPriceAssets.size > 0
                ? `${missingPriceAssets.size} ${t("asset prices missing")}. `
                : ""}
              {missingFxAssets.size > 0
                ? `${missingFxAssets.size} ${t("FX conversions missing")}.`
                : ""}
            </p>
          </div>
        </div>
      ) : null}

      <section className="surface-section space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search.q}
              onChange={(event) => setSearch({ q: event.target.value })}
              placeholder="Search asset or account…"
              className="pl-9"
            />
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" className="min-h-11 flex-1 sm:flex-none" onClick={() => setFxOpen(true)}>
              {t("FX rates")}
            </Button>
            <Button
              onClick={() => setCreateAssetOpen(true)}
              className="min-h-11 flex-1 bg-cyan text-background hover:bg-cyan/90 sm:flex-none"
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t("New asset")}
            </Button>
          </div>
        </div>
        <div className="scroll-x-snap flex gap-2 pb-0.5">
          {views.map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setSearch({ view })}
              className={cn(
                "min-h-10 shrink-0 rounded-xl border px-3 text-xs font-medium",
                search.view === view
                  ? "border-cyan/30 bg-cyan/10 text-cyan"
                  : "border-border/60 bg-card/40 text-muted-foreground",
              )}
            >
              {view === "all" ? t("All") : t(humanize(view))}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">
            {t("Portfolio positions")}{" "}
            <span className="font-mono text-sm font-normal text-muted-foreground">
              {positionGroups.length}
            </span>
          </h2>
          {positionGroups.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-10 sm:hidden"
              onClick={() => {
                const allExpanded = positionGroups.every((group) =>
                  expandedAssetIds.has(group.assetId),
                );
                setExpandedAssetIds(
                  allExpanded ? new Set() : new Set(positionGroups.map((group) => group.assetId)),
                );
              }}
            >
              {positionGroups.every((group) => expandedAssetIds.has(group.assetId))
                ? t("Collapse all")
                : t("Expand all")}
            </Button>
          ) : null}
        </div>
        {positionGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-12 text-center">
            <SlidersHorizontal className="mx-auto h-5 w-5 text-muted-foreground" />
            <div className="mt-3 text-sm font-medium">{t("No matching positions")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {positionGroups.map((group) => {
              const asset = overview.state.assets.find(
                (candidate) => candidate.id.toString() === group.assetId,
              );
              if (!asset) return null;
              const facts = assetFacts(asset);
              return (
                <article key={group.assetId} className="surface-section overflow-hidden">
                  <div className="flex items-start gap-2 p-3.5 sm:p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-display text-base font-semibold">{group.symbol}</span>
                        <span className="rounded-full bg-muted/45 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {t(humanize(group.kind))}
                        </span>
                        {facts.partial ? (
                          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] text-warning">
                            {t("Partial")}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {group.assetName}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-lg font-semibold">
                        {formatMoney(facts.value, locale)}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {formatQuantity(facts.quantity.toString(), 8, locale)} {group.symbol}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="-mr-1 min-h-11 min-w-11 shrink-0 sm:hidden"
                      onClick={() =>
                        setExpandedAssetIds((current) => {
                          const next = new Set(current);
                          if (next.has(group.assetId)) next.delete(group.assetId);
                          else next.add(group.assetId);
                          return next;
                        })
                      }
                      aria-expanded={expandedAssetIds.has(group.assetId)}
                      aria-label={
                        expandedAssetIds.has(group.assetId)
                          ? t("Collapse asset")
                          : t("Expand asset")
                      }
                    >
                      {expandedAssetIds.has(group.assetId) ? (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>

                  <div
                    className={cn(
                      "border-t border-border/45 bg-background/20 sm:block",
                      expandedAssetIds.has(group.assetId) ? "block" : "hidden",
                    )}
                  >
                    {group.positions.map((position) => (
                      <div
                        key={`${position.accountId}:${position.assetId}`}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/30 px-3.5 py-2.5 last:border-b-0 sm:px-4"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{position.accountName}</div>
                          {position.missingReason ? (
                            <div className="mt-0.5 text-[10px] text-warning">
                              {t(
                                position.missingReason === "missing-price"
                                  ? "Missing price"
                                  : "Missing FX rate",
                              )}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-baseline gap-3 text-right">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {formatQuantity(position.quantity, 8, locale)} {group.symbol}
                          </span>
                          <span className="min-w-20 font-mono text-xs font-medium">
                            {formatMoney(position.value, locale)}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="px-2 pb-1">
                      <AssetActions
                        asset={asset}
                        facts={facts}
                        onEdit={() => setEditAsset(asset)}
                        onPrice={() => setPriceAsset(asset)}
                        onDelete={() => setDeleteAsset(asset)}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={createAssetOpen} onOpenChange={setCreateAssetOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("New asset")}</DialogTitle>
            <DialogDescription>
              {t("Create a new asset and keep the asset manager open.")}
            </DialogDescription>
          </DialogHeader>
          <AssetForm onSaved={() => setCreateAssetOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editAsset !== null}
        onOpenChange={(open) => {
          if (!open) setEditAsset(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Edit asset")}</DialogTitle>
            <DialogDescription>
              {t("Update the asset details. Financial history remains unchanged.")}
            </DialogDescription>
          </DialogHeader>
          {editAsset ? (
            <AssetForm
              key={editAsset.id.toString()}
              existing={editAsset}
              identityLocked={overview.state.transactions.some((transaction) =>
                transaction.legs.some((leg) => leg.assetId.equals(editAsset.id)),
              )}
              onSaved={() => setEditAsset(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <PriceDialog
        asset={priceAsset}
        baseCurrency={overview.baseCurrency}
        locale={locale}
        onClose={() => setPriceAsset(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: financialV2Keys.all })}
      />

      <Dialog open={fxOpen} onOpenChange={setFxOpen}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("FX rates")}</DialogTitle>
            <DialogDescription>
              {t("Manage currency pairs, current rates, update history and missing conversions.")}
            </DialogDescription>
          </DialogHeader>
          <FxManager />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteAsset !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteAsset(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete asset")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAsset
                ? `${t("Delete")} ${deleteAsset.symbol}? ${t(
                    "Its price observations will also be removed. This is allowed only when the asset has never been used in transactions, goals or as the base currency.",
                  )}`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void removeAsset();
              }}
            >
              {deleting ? t("Saving…") : t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type AssetFacts = {
  quantity: Decimal;
  value: Money | null;
  partial: boolean;
  latest: PriceQuote | null;
  hasHistory: boolean;
  hasGoal: boolean;
  base: boolean;
  canDelete: boolean;
};

function AssetActions({
  asset,
  facts,
  onEdit,
  onPrice,
  onDelete,
}: {
  asset: Asset;
  facts: AssetFacts;
  onEdit: () => void;
  onPrice: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-1 flex justify-end gap-0.5 border-t border-border/35 pt-1">
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11"
        onClick={onEdit}
        aria-label={t("Edit")}
        title={t("Edit")}
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Button>
      {asset.kind !== "fiat" ? (
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          onClick={onPrice}
          aria-label={t("Update price")}
          title={t("Update price")}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        disabled={!facts.canDelete}
        aria-label={t("Delete asset")}
        title={!facts.canDelete ? t("Asset is referenced by financial data") : t("Delete asset")}
        onClick={onDelete}
        className="min-h-11 min-w-11 text-destructive"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

function PriceDialog({
  asset,
  baseCurrency,
  locale,
  onClose,
  onSaved,
}: {
  asset: Asset | null;
  baseCurrency: string | null;
  locale: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState(baseCurrency ?? "EUR");
  const [saving, setSaving] = useState(false);
  const { t } = useI18n();

  const save = async () => {
    if (!asset) return;
    setSaving(true);
    try {
      const quote = PriceQuote.create({
        assetId: asset.id,
        unitPrice: Money.of(normalizeLocalizedDecimalInput(price), normalizeCurrency(currency)),
        asOf: UtcTimestamp.fromDate(new Date()),
      });
      await appendValidatedPriceQuote(financialV2Repository, quote);
      onSaved();
      toast.success(t("Price updated"));
      setPrice("");
      onClose();
    } catch (error) {
      toast.error(describeActionError(error, t("Could not update price")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={asset !== null}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {asset ? `${t("Update price")} · ${asset.symbol}` : t("Update price")}
          </DialogTitle>
          <DialogDescription>
            {t("Adds a new price observation with the current date and time.")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
          <div className="space-y-2">
            <Label htmlFor="asset-price">{t("Current price")}</Label>
            <Input
              id="asset-price"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-price-currency">{t("Currency")}</Label>
            <Input
              id="asset-price-currency"
              value={currency}
              maxLength={3}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            />
          </div>
        </div>
        <Button
          disabled={saving || !price.trim() || currency.length !== 3}
          onClick={() => void save()}
          className="w-full bg-cyan text-background hover:bg-cyan/90"
        >
          {saving ? t("Saving…") : t("Save")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
