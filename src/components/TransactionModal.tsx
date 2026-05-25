import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts, useAssets, useTransactions, type Transaction } from "@/hooks/use-ledger";
import { AccountPicker } from "@/components/AccountPicker";
import { AssetPicker } from "@/components/AssetPicker";
import { TagPicker } from "@/components/TagPicker";
import { dec } from "@/lib/decimal";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

type TxType = Transaction["transaction_type"];
const TYPES: { value: TxType; label: string }[] = [
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdraw" },
  { value: "transfer", label: "Transfer" },
  { value: "buy", label: "Buy Asset" },
  { value: "sell", label: "Sell Asset" },
  { value: "convert", label: "Convert" },
  { value: "fee", label: "Fee" },
  { value: "dividend", label: "Dividend" },
  { value: "interest", label: "Interest" },
  { value: "staking_reward", label: "Staking Reward" },
  { value: "profit_realization", label: "Record Profit" },
  { value: "manual_adjustment", label: "Manual Adjustment" },
];

const NEEDS_SOURCE: TxType[] = ["withdrawal", "transfer", "sell", "convert", "fee"];
const NEEDS_DEST: TxType[] = ["deposit", "transfer", "buy", "convert", "dividend", "interest", "staking_reward", "profit_realization", "manual_adjustment"];
const NEEDS_ASSET: TxType[] = ["buy", "sell", "convert", "transfer", "dividend", "staking_reward"];

export function TransactionModal({
  open, onClose, defaultType = "deposit", defaultAccountId, edit,
}: {
  open: boolean;
  onClose: () => void;
  defaultType?: TxType;
  defaultAccountId?: string;
  /** When set, modal opens in edit mode and updates the existing row. */
  edit?: Transaction | null;
}) {
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const { insert, update } = useTransactions();
  const { profile } = useAuth();
  const baseCurrency = profile?.currency ?? "USD";

  const nowLocal = () => {
    const d = new Date(); d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const toLocal = (iso: string) => {
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [type, setType] = useState<TxType>(defaultType);
  const [src, setSrc] = useState<string>("");
  const [dst, setDst] = useState<string>(defaultAccountId ?? "");
  const [assetId, setAssetId] = useState<string>("");
  const [qty, setQty] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [fiat, setFiat] = useState<string>("");
  const [fee, setFee] = useState<string>("");
  const [ts, setTs] = useState<string>(nowLocal());
  const [note, setNote] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setType(edit.transaction_type);
      setSrc(edit.source_account_id ?? "");
      setDst(edit.destination_account_id ?? "");
      setAssetId(edit.asset_id ?? "");
      setQty(String(edit.quantity ?? ""));
      setFiat(String(edit.fiat_value ?? ""));
      setPrice(edit.quantity ? String(dec.div(edit.fiat_value, edit.quantity)) : "");
      setFee(String(edit.fee_amount ?? ""));
      setTs(toLocal(edit.execution_timestamp));
      setNote(edit.note ?? "");
      setTags(edit.tags ?? []);
    } else {
      setType(defaultType);
      setDst(defaultAccountId ?? "");
      setSrc("");
      setAssetId("");
      setQty(""); setFiat(""); setPrice(""); setFee("");
      setTs(nowLocal()); setNote(""); setTags([]);
    }
  }, [open, edit, defaultType, defaultAccountId]);

  // Auto-default fiat asset for cash flows
  useEffect(() => {
    if (!edit && !NEEDS_ASSET.includes(type) && assets.length && !assetId) {
      const usd = assets.find((a) => a.symbol === "USD") ?? assets[0];
      setAssetId(usd.id);
    }
  }, [type, assets, assetId, edit]);

  // Decimal-safe derived fiat for asset trades: qty * price
  const derivedFiat = useMemo(() => {
    const q = parseFloat(qty || "0");
    const p = parseFloat(price || "0");
    if (!q || !p) return null;
    return dec.mul(q, p);
  }, [qty, price]);

  const effectiveFiat = useMemo(() => {
    if (fiat) return parseFloat(fiat) || 0;
    return derivedFiat ?? 0;
  }, [fiat, derivedFiat]);

  const submit = async () => {
    try {
      const q = parseFloat(qty || "0") || 0;
      const f = effectiveFiat;
      const payload: any = {
        transaction_type: type,
        source_account_id: NEEDS_SOURCE.includes(type) && src ? src : null,
        destination_account_id: NEEDS_DEST.includes(type) && dst ? dst : null,
        asset_id: assetId || null,
        quantity: q,
        fiat_value: f,
        base_value: f,
        base_currency: baseCurrency,
        asset_price: q ? dec.div(f, q) : null,
        fee_amount: parseFloat(fee || "0") || 0,
        execution_timestamp: new Date(ts).toISOString(),
        note: note || null,
        tags,
      };
      if (edit) {
        await update(edit.id, payload);
        toast.success("Transaction updated · balances reconciled");
      } else {
        await insert(payload);
        toast.success("Transaction recorded");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={edit ? "Edit transaction" : "New Transaction"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={submit}>{edit ? "Save changes" : "Record"}</Button></>}>
      <div>
        <Label className="text-xs">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as TxType)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {NEEDS_SOURCE.includes(type) && (
          <AccountPicker value={src} onChange={setSrc} label="From" />
        )}
        {NEEDS_DEST.includes(type) && (
          <AccountPicker value={dst} onChange={setDst} label="To" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <AssetPicker
          value={assetId}
          onChange={setAssetId}
          assetClass={NEEDS_ASSET.includes(type) ? "crypto" : "fiat"}
        />
        <div>
          <Label className="text-xs">Timestamp</Label>
          <Input type="datetime-local" value={ts} onChange={(e) => setTs(e.target.value)} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div><Label className="text-xs">Quantity</Label><Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1" /></div>
        <div><Label className="text-xs">Price</Label><Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" placeholder="per unit" /></div>
        <div>
          <Label className="text-xs">Fiat value</Label>
          <Input type="number" step="any" value={fiat} onChange={(e) => setFiat(e.target.value)} className="mt-1" placeholder={derivedFiat != null ? derivedFiat.toFixed(2) : ""} />
        </div>
        <div><Label className="text-xs">Fee</Label><Input type="number" step="any" value={fee} onChange={(e) => setFee(e.target.value)} className="mt-1" /></div>
      </div>

      <TagPicker value={tags} onChange={setTags} />

      <div>
        <Label className="text-xs">Note</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" rows={2} placeholder="Weekly DCA, salary, profit lock-in…" />
      </div>
    </Modal>
  );
}
