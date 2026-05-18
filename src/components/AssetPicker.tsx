import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAssets, type Asset } from "@/hooks/use-ledger";
import { AssetFormModal } from "@/components/AssetFormModal";
import { Plus, Pencil } from "lucide-react";

export function AssetPicker({
  value, onChange, assetClass, label = "Asset",
}: {
  value: string;
  onChange: (id: string) => void;
  assetClass: "crypto" | "etf" | "stock" | "fiat";
  label?: string;
}) {
  const { rows: assets } = useAssets();
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [presetSym, setPresetSym] = useState<string>("");

  const filtered = useMemo(
    () => assets.filter((a) => a.asset_class === assetClass &&
      (!q || a.symbol.toLowerCase().includes(q.toLowerCase()) || a.name.toLowerCase().includes(q.toLowerCase()))),
    [assets, assetClass, q],
  );
  const selected = assets.find((a) => a.id === value);

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <div className="flex gap-1">
          {selected && (
            <button type="button" onClick={() => { setEditing(selected); setPresetSym(""); setFormOpen(true); }} className="text-[10px] text-muted-foreground hover:text-cyan flex items-center gap-1">
              <Pencil className="h-2.5 w-2.5" /> edit
            </button>
          )}
          <button type="button" onClick={() => { setEditing(null); setPresetSym(""); setFormOpen(true); }} className="text-[10px] text-cyan hover:underline flex items-center gap-1">
            <Plus className="h-2.5 w-2.5" /> new
          </button>
        </div>
      </div>
      <Input
        className="mt-1"
        placeholder={selected ? `${selected.symbol} — ${selected.name}` : "Search ticker or symbol"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mt-2 max-h-40 overflow-y-auto glass rounded-lg divide-y divide-border/30">
        {filtered.slice(0, 8).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => { onChange(a.id); setQ(""); }}
            className={`w-full text-left px-3 py-2 hover:bg-muted/30 flex justify-between ${value === a.id ? "bg-cyan/10" : ""}`}
          >
            <span className="font-mono text-cyan">{a.symbol}</span>
            <span className="text-xs text-muted-foreground">{a.name}</span>
          </button>
        ))}
        {q && filtered.length === 0 && (
          <button
            type="button"
            onClick={() => { setEditing(null); setPresetSym(q); setFormOpen(true); }}
            className="w-full text-left px-3 py-2 hover:bg-muted/30 text-cyan"
          >
            + Create "{q.toUpperCase()}" with full details
          </button>
        )}
      </div>
      <AssetFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        edit={editing}
        presetClass={assetClass}
        presetSymbol={presetSym}
        onCreated={(id) => { onChange(id); setQ(""); }}
      />
    </div>
  );
}
