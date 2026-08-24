import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { appendValidatedPriceQuote } from "@/application/services";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { financialV2Keys } from "@/data/query-keys";
import { assetId } from "@/domain/assets";
import { Money, UtcTimestamp } from "@/domain/core";
import { PriceQuote } from "@/domain/valuation";
import { financialV2Repository } from "@/lib/v2-runtime";
import { useI18n } from "@/lib/use-i18n";
import { EntityCombobox } from "../EntityCombobox";
import { FxManager } from "../FxManager";
import { normalizeCurrency, normalizeLocalizedDecimalInput } from "../form-utils";
import { useFinancialState } from "../use-financial-state";
import { describeActionError } from "@/features/wealth-v2/user-message";
import { AssetForm } from "./AssetForm";

export function MarketDataForm({ onSaved }: { onSaved: () => void }) {
  const queryClient = useQueryClient();
  const { data } = useFinancialState();
  const { t } = useI18n();
  const assets = useMemo(
    () => data?.state.assets.filter((asset) => asset.kind !== "fiat") ?? [],
    [data],
  );
  const assetOptions = useMemo(
    () =>
      assets.map((item) => ({
        value: item.id.toString(),
        label: `${item.symbol} · ${item.name}`,
        keywords: item.kind,
      })),
    [assets],
  );
  const [asset, setAsset] = useState("");
  const [price, setPrice] = useState("");
  const [priceCurrency, setPriceCurrency] = useState(data?.baseCurrency ?? "");
  const [saving, setSaving] = useState(false);
  const [assetCreateOpen, setAssetCreateOpen] = useState(false);

  useEffect(() => {
    if (!data?.baseCurrency) return;
    setPriceCurrency((current) => current || data.baseCurrency!);
  }, [data?.baseCurrency]);

  const savePrice = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const quote = PriceQuote.create({
        assetId: assetId(asset),
        unitPrice: Money.of(
          normalizeLocalizedDecimalInput(price),
          normalizeCurrency(priceCurrency),
        ),
        asOf: UtcTimestamp.fromDate(new Date()),
      });
      await appendValidatedPriceQuote(financialV2Repository, quote);
      await queryClient.invalidateQueries({ queryKey: financialV2Keys.all });
      toast.success(t("Price observation added"));
      onSaved();
    } catch (error) {
      toast.error(describeActionError(error, t("Could not add price observation")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Tabs defaultValue="price" className="space-y-5">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="price">{t("Asset price")}</TabsTrigger>
          <TabsTrigger value="fx">{t("FX rates")}</TabsTrigger>
        </TabsList>
        <TabsContent value="price">
          <form onSubmit={savePrice} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Asset")}</Label>
              <EntityCombobox
                value={asset}
                onValueChange={setAsset}
                options={assetOptions}
                placeholder={t("Select asset")}
                searchPlaceholder="Search assets…"
                emptyText="No matching assets."
                createLabel="+ Create new asset"
                onCreate={() => setAssetCreateOpen(true)}
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)] gap-3">
              <div className="space-y-2">
                <Label htmlFor="price-value">{t("Unit price")}</Label>
                <Input
                  id="price-value"
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="102,45"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price-currency">{t("Currency")}</Label>
                <Input
                  id="price-currency"
                  value={priceCurrency}
                  onChange={(event) => setPriceCurrency(event.target.value.toUpperCase())}
                  maxLength={3}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-cyan text-background hover:bg-cyan/90"
              disabled={
                saving || !asset || !price.trim() || normalizeCurrency(priceCurrency).length !== 3
              }
            >
              {saving ? t("Saving…") : t("Add price observation")}
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="fx">
          <FxManager compact />
        </TabsContent>
      </Tabs>

      <Dialog open={assetCreateOpen} onOpenChange={setAssetCreateOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Create asset")}</DialogTitle>
            <DialogDescription>
              {t("Create the asset without closing this form. It will be selected automatically.")}
            </DialogDescription>
          </DialogHeader>
          <AssetForm
            onSaved={(created) => {
              if (!created) return;
              setAsset(created.id.toString());
              setAssetCreateOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
