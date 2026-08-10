import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { putValidatedAsset } from "@/application/services";
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
import { financialV2Keys } from "@/data/query-keys";
import { Asset, ASSET_KINDS, assetId } from "@/domain/assets";
import { financialV2Repository } from "@/lib/v2-runtime";
import { normalizeCurrency, safeEntityId } from "../form-utils";
import { humanize } from "../format";

export function AssetForm({
  onSaved,
  existing,
  identityLocked = false,
}: {
  onSaved: () => void;
  existing?: Asset;
  identityLocked?: boolean;
}) {
  const queryClient = useQueryClient();
  const [symbol, setSymbol] = useState(() => existing?.symbol ?? "");
  const [name, setName] = useState(() => existing?.name ?? "");
  const [kind, setKind] = useState<(typeof ASSET_KINDS)[number]>(() => existing?.kind ?? "etf");
  const [precision, setPrecision] = useState(() => String(existing?.precision ?? 8));
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const normalizedSymbol = normalizeCurrency(symbol);
      const asset = Asset.create({
        id: existing?.id ?? assetId(safeEntityId("asset")),
        symbol: normalizedSymbol,
        name: name.trim(),
        kind,
        precision: Number(precision),
        fiatCurrency: kind === "fiat" ? normalizedSymbol : null,
      });
      await putValidatedAsset(financialV2Repository, asset);
      await queryClient.invalidateQueries({ queryKey: financialV2Keys.all });
      toast.success(existing ? "Asset saved" : "Asset created");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create asset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)] gap-3">
        <div className="space-y-2">
          <Label htmlFor="asset-symbol">Symbol</Label>
          <Input
            id="asset-symbol"
            value={symbol}
            disabled={identityLocked && existing?.kind === "fiat"}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder="VWCE"
            maxLength={16}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="asset-name">Name</Label>
          <Input
            id="asset-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Vanguard FTSE All-World"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Kind</Label>
          <Select
            value={kind}
            disabled={identityLocked}
            onValueChange={(value) => setKind(value as (typeof ASSET_KINDS)[number])}
          >
            <SelectTrigger aria-label="Asset kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_KINDS.map((value) => (
                <SelectItem key={value} value={value}>
                  {humanize(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="asset-precision">Precision</Label>
          <Input
            id="asset-precision"
            type="number"
            min="0"
            max="18"
            value={precision}
            onChange={(event) => setPrecision(event.target.value)}
            required
          />
        </div>
      </div>
      {kind === "fiat" && (
        <p className="text-xs text-muted-foreground">
          For fiat assets the symbol is also used as the ISO-style currency code.
        </p>
      )}
      {identityLocked && (
        <p className="text-xs text-muted-foreground">
          Kind and fiat identity are locked because this asset already appears in ledger history.
        </p>
      )}
      <Button
        type="submit"
        disabled={saving || !symbol.trim() || !name.trim()}
        className="w-full bg-cyan text-background hover:bg-cyan/90"
      >
        {saving ? "Saving…" : existing ? "Save asset" : "Create asset"}
      </Button>
    </form>
  );
}
