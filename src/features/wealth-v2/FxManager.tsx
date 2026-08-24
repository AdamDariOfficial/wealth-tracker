import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { appendValidatedFxRate } from "@/application/services";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { financialV2Keys } from "@/data/query-keys";
import { UtcTimestamp } from "@/domain/core";
import { FxRate } from "@/domain/valuation";
import { financialV2Repository } from "@/lib/v2-runtime";
import { useI18n } from "@/lib/use-i18n";
import { cn } from "@/lib/utils";
import { normalizeCurrency, normalizeLocalizedDecimalInput } from "./form-utils";
import { formatDateTime } from "./format";
import { useFinancialState } from "./use-financial-state";
import { describeActionError } from "./user-message";

type FxPair = Readonly<{
  key: string;
  source: string;
  target: string;
  history: readonly FxRate[];
  latest: FxRate | null;
  missingAssets: readonly string[];
}>;

function pairKey(source: string, target: string): string {
  return `${source}->${target}`;
}

export function FxManager({ compact = false }: { compact?: boolean }) {
  const financial = useFinancialState();
  const queryClient = useQueryClient();
  const { locale, t } = useI18n();
  const baseCurrency = financial.data?.baseCurrency ?? "";
  const [sourceCurrency, setSourceCurrency] = useState("USD");
  const [targetCurrency, setTargetCurrency] = useState(baseCurrency || "EUR");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPair, setEditingPair] = useState<FxPair | null>(null);

  const pairs = useMemo(() => {
    if (!financial.data) return [];
    const groups = new Map<
      string,
      { source: string; target: string; history: FxRate[]; assets: Set<string> }
    >();

    for (const fx of financial.data.state.fxRates) {
      const source = fx.sourceCurrency.toString();
      const target = fx.targetCurrency.toString();
      const key = pairKey(source, target);
      const group = groups.get(key) ?? {
        source,
        target,
        history: [],
        assets: new Set<string>(),
      };
      group.history.push(fx);
      groups.set(key, group);
    }

    const assetById = new Map(
      financial.data.state.assets.map((asset) => [asset.id.toString(), asset] as const),
    );
    for (const position of financial.data.valuation?.positions ?? []) {
      if (position.status !== "unknown" || position.reason !== "missing-fx-rate") continue;
      const source = position.quoteCurrency?.toString();
      const target = financial.data.baseCurrency;
      if (!source || !target || source === target) continue;
      const key = pairKey(source, target);
      const group = groups.get(key) ?? {
        source,
        target,
        history: [],
        assets: new Set<string>(),
      };
      const asset = assetById.get(position.assetId.toString());
      if (asset) group.assets.add(`${asset.symbol} · ${asset.name}`);
      groups.set(key, group);
    }

    return [...groups.entries()]
      .map(([key, group]): FxPair => {
        const history = [...group.history].sort(
          (left, right) => Date.parse(right.asOf.toString()) - Date.parse(left.asOf.toString()),
        );
        return Object.freeze({
          key,
          source: group.source,
          target: group.target,
          history: Object.freeze(history),
          latest: history[0] ?? null,
          missingAssets: Object.freeze([...group.assets].sort()),
        });
      })
      .sort((left, right) => {
        if (left.missingAssets.length !== right.missingAssets.length) {
          return right.missingAssets.length - left.missingAssets.length;
        }
        return left.key.localeCompare(right.key);
      });
  }, [financial.data]);

  const missingPairCount = pairs.filter((pair) => pair.missingAssets.length > 0).length;

  const openCreate = () => {
    setEditingPair(null);
    setSourceCurrency("USD");
    setTargetCurrency(baseCurrency || "EUR");
    setRate("");
    setEditorOpen(true);
  };

  const openUpdate = (pair: FxPair) => {
    setEditingPair(pair);
    setSourceCurrency(pair.source);
    setTargetCurrency(pair.target);
    setRate("");
    setEditorOpen(true);
  };

  const saveFx = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const fx = FxRate.create({
        sourceCurrency: normalizeCurrency(sourceCurrency),
        targetCurrency: normalizeCurrency(targetCurrency),
        rate: normalizeLocalizedDecimalInput(rate),
        asOf: UtcTimestamp.fromDate(new Date()),
      });
      await appendValidatedFxRate(financialV2Repository, fx);
      await queryClient.invalidateQueries({ queryKey: financialV2Keys.all });
      toast.success(t("FX observation added"));
      setRate("");
      setEditorOpen(false);
      setEditingPair(null);
    } catch (error) {
      toast.error(describeActionError(error, t("Could not add FX observation")));
    } finally {
      setSaving(false);
    }
  };

  if (financial.isLoading) {
    return <div className="py-6 text-sm text-muted-foreground">{t("Loading FX rates…")}</div>;
  }

  if (!financial.data) {
    return <div className="py-6 text-sm text-muted-foreground">{t("FX rates unavailable")}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={openCreate}
          className="bg-cyan text-background hover:bg-cyan/90"
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t("New FX rate")}
        </Button>
      </div>

      {missingPairCount > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <div className="font-medium text-warning">{t("Missing FX rates")}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("These missing currency pairs are preventing complete portfolio valuation.")}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "md:grid-cols-2")}>
        {pairs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-5 text-sm text-muted-foreground md:col-span-2">
            {t("No FX pairs recorded yet.")}
          </div>
        ) : (
          pairs.map((pair) => {
            const isExpanded = expanded === pair.key;
            return (
              <div
                key={pair.key}
                className={cn(
                  "rounded-xl border p-3",
                  pair.missingAssets.length > 0
                    ? "border-warning/35 bg-warning/[0.04]"
                    : "border-border/55 bg-card/30",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-semibold">
                      {pair.source}/{pair.target}
                    </div>
                    {pair.latest ? (
                      <>
                        <div className="mt-1 font-mono text-base">
                          1 {pair.source} = {pair.latest.rate.toString()} {pair.target}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {t("Last updated")}: {formatDateTime(pair.latest.asOf.toString(), locale)}
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-xs text-warning">{t("No rate recorded")}</div>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openUpdate(pair)}
                  >
                    {pair.latest ? t("Update") : t("Add rate")}
                  </Button>
                </div>

                {pair.missingAssets.length > 0 ? (
                  <div className="mt-3 rounded-lg bg-warning/8 px-3 py-2 text-xs text-warning">
                    <div className="font-medium">{t("Needed for")}</div>
                    <div className="mt-1 text-muted-foreground">
                      {pair.missingAssets.join(", ")}
                    </div>
                  </div>
                ) : null}

                {pair.history.length > 0 ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => setExpanded(isExpanded ? null : pair.key)}
                    >
                      <span>
                        {t("History")} · {pair.history.length}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                    {isExpanded ? (
                      <div className="space-y-2 border-t border-border/40 pt-2">
                        {pair.history.map((observation, index) => (
                          <div
                            key={`${observation.asOf.toString()}-${index}`}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="font-mono">{observation.rate.toString()}</span>
                            <span className="text-right text-muted-foreground">
                              {formatDateTime(observation.asOf.toString(), locale)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open && saving) return;
          setEditorOpen(open);
          if (!open) {
            setEditingPair(null);
            setRate("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPair ? t("Update FX rate") : t("New FX rate")}</DialogTitle>
            <DialogDescription>
              {editingPair
                ? t(
                    "Add a new observation for this currency pair. Previous observations remain in history.",
                  )
                : t("Create a currency pair by recording its first FX observation.")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveFx} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fx-manager-source">{t("From")}</Label>
                <Input
                  id="fx-manager-source"
                  value={sourceCurrency}
                  onChange={(event) => setSourceCurrency(event.target.value.toUpperCase())}
                  maxLength={3}
                  disabled={editingPair !== null}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fx-manager-target">{t("To")}</Label>
                <Input
                  id="fx-manager-target"
                  value={targetCurrency}
                  onChange={(event) => setTargetCurrency(event.target.value.toUpperCase())}
                  maxLength={3}
                  disabled={editingPair !== null}
                  required
                  placeholder={baseCurrency || "EUR"}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fx-manager-rate">{t("Rate")}</Label>
              <Input
                id="fx-manager-rate"
                inputMode="decimal"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                placeholder="0,9142"
                required
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-cyan text-background hover:bg-cyan/90"
              disabled={
                saving ||
                !rate.trim() ||
                normalizeCurrency(sourceCurrency).length !== 3 ||
                normalizeCurrency(targetCurrency).length !== 3 ||
                normalizeCurrency(sourceCurrency) === normalizeCurrency(targetCurrency)
              }
            >
              {saving ? t("Saving…") : t(editingPair ? "Save FX update" : "Create FX rate")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
