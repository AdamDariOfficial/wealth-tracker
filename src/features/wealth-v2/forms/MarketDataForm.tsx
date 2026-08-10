import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { appendValidatedFxRate, appendValidatedPriceQuote } from "@/application/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { financialV2Keys } from "@/data/query-keys";
import { assetId } from "@/domain/assets";
import { Money, UtcTimestamp } from "@/domain/core";
import { FxRate, PriceQuote } from "@/domain/valuation";
import { financialV2Repository } from "@/lib/v2-runtime";
import { normalizeCurrency } from "../form-utils";
import { useFinancialState } from "../use-financial-state";

export function MarketDataForm({ onSaved }: { onSaved: () => void }) {
  const queryClient = useQueryClient();
  const { data } = useFinancialState();
  const assets = useMemo(
    () => data?.state.assets.filter((asset) => asset.kind !== "fiat") ?? [],
    [data],
  );
  const [asset, setAsset] = useState("");
  const [price, setPrice] = useState("");
  const [priceCurrency, setPriceCurrency] = useState(data?.baseCurrency ?? "");
  const [sourceCurrency, setSourceCurrency] = useState("USD");
  const [targetCurrency, setTargetCurrency] = useState(data?.baseCurrency ?? "");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.baseCurrency) return;
    setPriceCurrency((current) => current || data.baseCurrency!);
    setTargetCurrency((current) => current || data.baseCurrency!);
  }, [data?.baseCurrency]);

  const saved = async () => {
    await queryClient.invalidateQueries({ queryKey: financialV2Keys.all });
    onSaved();
  };

  const savePrice = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const quote = PriceQuote.create({
        assetId: assetId(asset),
        unitPrice: Money.of(price.trim(), normalizeCurrency(priceCurrency)),
        asOf: UtcTimestamp.fromDate(new Date()),
      });
      await appendValidatedPriceQuote(financialV2Repository, quote);
      await saved();
      toast.success("Price observation added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add price observation");
    } finally {
      setSaving(false);
    }
  };

  const saveFx = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const fx = FxRate.create({
        sourceCurrency: normalizeCurrency(sourceCurrency),
        targetCurrency: normalizeCurrency(targetCurrency),
        rate: rate.trim(),
        asOf: UtcTimestamp.fromDate(new Date()),
      });
      await appendValidatedFxRate(financialV2Repository, fx);
      await saved();
      toast.success("FX observation added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add FX observation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tabs defaultValue="price" className="space-y-5">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="price">Asset price</TabsTrigger>
        <TabsTrigger value="fx">FX rate</TabsTrigger>
      </TabsList>
      <TabsContent value="price">
        <form onSubmit={savePrice} className="space-y-4">
          <div className="space-y-2">
            <Label>Asset</Label>
            <Select value={asset} onValueChange={setAsset}>
              <SelectTrigger aria-label="Price asset">
                <SelectValue placeholder="Select asset" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((item) => (
                  <SelectItem key={item.id.toString()} value={item.id.toString()}>
                    {item.symbol} · {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)] gap-3">
            <div className="space-y-2">
              <Label htmlFor="price-value">Unit price</Label>
              <Input
                id="price-value"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="102.45"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price-currency">Currency</Label>
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
            {saving ? "Saving…" : "Add price observation"}
          </Button>
        </form>
      </TabsContent>
      <TabsContent value="fx">
        <form onSubmit={saveFx} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fx-source">From</Label>
              <Input
                id="fx-source"
                value={sourceCurrency}
                onChange={(event) => setSourceCurrency(event.target.value.toUpperCase())}
                maxLength={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fx-target">To</Label>
              <Input
                id="fx-target"
                value={targetCurrency}
                onChange={(event) => setTargetCurrency(event.target.value.toUpperCase())}
                maxLength={3}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fx-rate">Rate</Label>
            <Input
              id="fx-rate"
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              placeholder="0.9142"
              required
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
            {saving ? "Saving…" : "Add FX observation"}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
