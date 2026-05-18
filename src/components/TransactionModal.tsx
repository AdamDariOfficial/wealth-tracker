import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts, useAssets, useTransactions, type Transaction } from "@/hooks/use-ledger";
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
  open, onClose, defaultType = "deposit", defaultAccountId,
}: { open: boolean; onClose: () => void; defaultType?: TxType; defaultAccountId?: string }) {
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const { insert } = useTransactions();

  const nowLocal = () => {
    const d = new Date(); d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [type, setType] = useState<TxType>(defaultType);
  const [src, setSrc] = useState<string>("");
  const [dst, setDst] = useState<string>(defaultAccountId ?? "");
  const [assetId, setAssetId] = useState<string>("");
  const [qty, setQty] = useState<string>("");
  const [fiat, setFiat] = useState<string>("");
  const [fee, setFee] = useState<string>("");
  const [ts, setTs] = useState<string>(nowLocal());
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (open) {
      setType(defaultType);
      setDst(defaultAccountId ?? "");
      setSrc("");
      setAssetId("");
      setQty(""); setFiat(""); setFee("");
      setTs(nowLocal()); setNote("");
    }
  }, [open, defaultType, defaultAccountId]);

  // auto-default fiat asset for cash flows
  useEffect(() => {
    if (!NEEDS_ASSET.includes(type) && assets.length && !assetId) {
      const usd = assets.find((a) => a.symbol === "USD") ?? assets[0];
      setAssetId(usd.id);
    }
  }, [type, assets, assetId]);

  const submit = async () => {
    try {
      const payload: any = {
        transaction_type: type,
        source_account_id: NEEDS_SOURCE.includes(type) && src ? src : null,
        destination_account_id: NEEDS_DEST.includes(type) && dst ? dst : null,
        asset_id: assetId || null,
        quantity: parseFloat(qty || "0") || 0,
        fiat_value: parseFloat(fiat || "0") || 0,
        fee_amount: parseFloat(fee || "0") || 0,
        execution_timestamp: new Date(ts).toISOString(),
        note: note || null,
      };
      await insert(payload);
      toast.success("Transaction recorded");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Transaction"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={submit}>Record</Button></>}>
      <div>
        <Label className="text-xs">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as TxType)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {NEEDS_SOURCE.includes(type) && (
          <div>
            <Label className="text-xs">From</Label>
            <Select value={src} onValueChange={setSrc}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Source account" /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {NEEDS_DEST.includes(type) && (
          <div>
            <Label className="text-xs">To</Label>
            <Select value={dst} onValueChange={setDst}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Destination account" /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Asset</Label>
          <Select value={assetId} onValueChange={setAssetId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Asset" /></SelectTrigger>
            <SelectContent>{assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.symbol} — {a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Timestamp</Label>
          <Input type="datetime-local" value={ts} onChange={(e) => setTs(e.target.value)} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Quantity</Label><Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1" /></div>
        <div><Label className="text-xs">Fiat value</Label><Input type="number" step="any" value={fiat} onChange={(e) => setFiat(e.target.value)} className="mt-1" /></div>
        <div><Label className="text-xs">Fee</Label><Input type="number" step="any" value={fee} onChange={(e) => setFee(e.target.value)} className="mt-1" /></div>
      </div>

      <div>
        <Label className="text-xs">Note</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" rows={2} placeholder="Weekly DCA, salary, profit lock-in…" />
      </div>
    </Modal>
  );
}
