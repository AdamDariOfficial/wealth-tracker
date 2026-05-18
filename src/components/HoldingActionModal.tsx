import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AssetPicker } from "@/components/AssetPicker";
import { AccountPicker } from "@/components/AccountPicker";
import { useAccounts, useHoldings } from "@/hooks/use-ledger";
import {
  recordBuy, recordSell, recordTransfer, updateAssetPrice,
} from "@/lib/ledger-actions";
import { toast } from "sonner";

type Mode = "buy" | "sell" | "transfer";

export function HoldingActionModal({
  open, onClose, mode, assetClass, presetAssetId,
}: {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  assetClass: "crypto" | "etf" | "stock";
  presetAssetId?: string;
}) {
  const { rows: accounts } = useAccounts();
  const { holdings } = useHoldings();
  const cashAccounts = accounts.filter((a) => ["bank","cash","savings"].includes(a.type));
  const investAccounts = accounts.filter((a) =>
    assetClass === "crypto"
      ? ["exchange","crypto_wallet","cold_wallet"].includes(a.type)
      : ["broker","investment"].includes(a.type),
  );

  const [assetId, setAssetId] = useState(presetAssetId ?? "");
  const [primary, setPrimary] = useState(""); // broker / wallet (buy dest, sell src, transfer src)
  const [secondary, setSecondary] = useState(""); // cash account or transfer dest
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("");
  const [ts, setTs] = useState(() => {
    const d = new Date(); d.setSeconds(0,0);
    return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  });
  const [note, setNote] = useState("");
  const [updatePrice, setUpdatePrice] = useState(true);

  useEffect(() => { if (open) { setAssetId(presetAssetId ?? ""); setPrimary(""); setSecondary(""); setQty(""); setPrice(""); setFee(""); setNote(""); } }, [open, presetAssetId]);

  // available qty for sell/transfer validation
  const availableQty = (mode === "sell" || mode === "transfer") && primary && assetId
    ? holdings.find((h) => h.accountId === primary && h.assetId === assetId)?.quantity ?? 0
    : Infinity;

  const submit = async () => {
    if (!assetId) return toast.error("Pick an asset");
    if (!primary) return toast.error(mode === "transfer" ? "Pick source wallet" : "Pick wallet/broker");
    if (!secondary) return toast.error(mode === "transfer" ? "Pick destination wallet" : "Pick cash account");
    if (mode === "transfer" && primary === secondary) return toast.error("Source and destination must differ");
    const q = parseFloat(qty || "0"); const p = parseFloat(price || "0");
    if (!q || q <= 0) return toast.error("Quantity must be positive");
    if ((mode === "buy" || mode === "sell") && (!p || p <= 0)) return toast.error("Price must be positive");
    if (parseFloat(fee || "0") < 0) return toast.error("Fee cannot be negative");
    if ((mode === "sell" || mode === "transfer") && q > availableQty + 1e-9) {
      return toast.error(`Insufficient balance. Available: ${availableQty.toFixed(6)}`);
    }
    try {
      const at = new Date(ts).toISOString();
      if (mode === "buy") {
        await recordBuy({ cashAccountId: secondary, brokerAccountId: primary, assetId, quantity: q, price: p, fee: parseFloat(fee||"0"), ts: at, note });
        if (updatePrice) await updateAssetPrice(assetId, p);
      } else if (mode === "sell") {
        await recordSell({ brokerAccountId: primary, cashAccountId: secondary, assetId, quantity: q, price: p, fee: parseFloat(fee||"0"), ts: at, note });
        if (updatePrice) await updateAssetPrice(assetId, p);
      } else {
        await recordTransfer({ sourceAccountId: primary, destinationAccountId: secondary, assetId, quantity: q, fiatValue: p ? q*p : 0, ts: at, note });
      }
      toast.success(`${mode} recorded`);
      onClose();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const titles = { buy: `Buy ${assetClass.toUpperCase()}`, sell: `Sell ${assetClass.toUpperCase()}`, transfer: `Transfer ${assetClass.toUpperCase()}` };

  return (
    <Modal open={open} onClose={onClose} title={titles[mode]}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={submit}>Record</Button></>}>
      <AssetPicker value={assetId} onChange={setAssetId} assetClass={assetClass} />
      <div className="grid grid-cols-2 gap-3">
        <AccountPicker
          value={primary} onChange={setPrimary}
          label={mode === "transfer" ? "From wallet" : (mode === "buy" ? "To wallet/broker" : "From wallet/broker")}
          filter={(a) => investAccounts.some((x) => x.id === a.id)}
        />
        <AccountPicker
          value={secondary} onChange={setSecondary}
          label={mode === "transfer" ? "To wallet" : "Cash account"}
          filter={(a) => mode === "transfer" ? investAccounts.some((x) => x.id === a.id && x.id !== primary) : cashAccounts.some((x) => x.id === a.id)}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Quantity</Label>
          <Input type="number" step="any" min="0" value={qty} onChange={(e)=>setQty(e.target.value)} className="mt-1" />
          {(mode === "sell" || mode === "transfer") && primary && assetId && (
            <div className="text-[10px] text-muted-foreground mt-1 font-mono">Avail: {availableQty.toFixed(6)}</div>
          )}
        </div>
        <div><Label className="text-xs">{mode === "transfer" ? "Price (opt.)" : "Price / unit"}</Label><Input type="number" step="any" min="0" value={price} onChange={(e)=>setPrice(e.target.value)} className="mt-1" /></div>
        <div><Label className="text-xs">Fee</Label><Input type="number" step="any" min="0" value={fee} onChange={(e)=>setFee(e.target.value)} className="mt-1" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Timestamp</Label><Input type="datetime-local" value={ts} onChange={(e)=>setTs(e.target.value)} className="mt-1" /></div>
        {mode !== "transfer" && (
          <label className="flex items-center gap-2 text-xs mt-6 cursor-pointer">
            <input type="checkbox" checked={updatePrice} onChange={(e)=>setUpdatePrice(e.target.checked)} />
            Update asset market price
          </label>
        )}
      </div>
      <div><Label className="text-xs">Note</Label><Textarea value={note} onChange={(e)=>setNote(e.target.value)} rows={2} className="mt-1" /></div>
    </Modal>
  );
}
