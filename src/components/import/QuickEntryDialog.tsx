import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, ArrowUpFromLine, Repeat, TrendingUp, TrendingDown } from "lucide-react";

export type QuickKind = "deposit" | "expense" | "transfer" | "buy" | "sell";

const TITLES: Record<QuickKind, { title: string; icon: React.ReactNode }> = {
  deposit:  { title: "Deposit",  icon: <ArrowDownToLine className="h-4 w-4 text-success" /> },
  expense:  { title: "Expense",  icon: <ArrowUpFromLine className="h-4 w-4 text-destructive" /> },
  transfer: { title: "Transfer", icon: <Repeat className="h-4 w-4 text-cyan" /> },
  buy:      { title: "Buy",      icon: <TrendingUp className="h-4 w-4 text-success" /> },
  sell:     { title: "Sell",     icon: <TrendingDown className="h-4 w-4 text-warning" /> },
};

export function QuickEntryDialog({
  open, kind, onClose, onInsert,
}: {
  open: boolean;
  kind: QuickKind;
  onClose: () => void;
  onInsert: (snippet: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState("");
  const [account2, setAccount2] = useState("");
  const [asset, setAsset] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) { setAmount(""); setAccount(""); setAccount2(""); setAsset(""); setQty(""); setPrice(""); setDescription(""); }
  }, [open]);

  function build(): string | null {
    if (kind === "deposit" || kind === "expense") {
      if (!amount.trim() || !account.trim()) return null;
      const sign = kind === "expense" ? "-" : "+";
      return `${sign}${amount.trim()} ${account.trim()}${description.trim() ? `, ${description.trim()}` : ""}`;
    }
    if (kind === "transfer") {
      if (!amount.trim() || !account.trim() || !account2.trim()) return null;
      return `${amount.trim()} ${account.trim()} -> ${account2.trim()}${description.trim() ? `, ${description.trim()}` : ""}`;
    }
    if (kind === "buy" || kind === "sell") {
      if (!qty.trim() || !asset.trim() || !account.trim()) return null;
      const verb = kind === "buy" ? "BUY" : "SELL";
      const conn = kind === "buy" ? "from" : "to";
      const px = price.trim() ? ` @ ${price.trim()}` : "";
      return `${verb} ${qty.trim()} ${asset.trim().toUpperCase()}${px} ${conn} ${account.trim()}${description.trim() ? `, ${description.trim()}` : ""}`;
    }
    return null;
  }

  const snippet = build();
  const t = TITLES[kind];

  function submit() {
    if (!snippet) return;
    onInsert(snippet);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">{t.icon}{t.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {(kind === "deposit" || kind === "expense" || kind === "transfer") && (
            <Field label="Amount">
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="250" />
            </Field>
          )}
          {(kind === "deposit" || kind === "expense") && (
            <Field label="Account"><Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Isy Bank" /></Field>
          )}
          {kind === "transfer" && (
            <>
              <Field label="From"><Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Cash Wallet" /></Field>
              <Field label="To"><Input value={account2} onChange={(e) => setAccount2(e.target.value)} placeholder="Isy Bank" /></Field>
            </>
          )}
          {(kind === "buy" || kind === "sell") && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Quantity"><Input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="2" /></Field>
                <Field label="Asset"><Input value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="BTC" /></Field>
              </div>
              <Field label="Price (optional)"><Input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="42000" /></Field>
              <Field label={kind === "buy" ? "From account" : "To account"}>
                <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Isy Bank" />
              </Field>
            </>
          )}
          <Field label="Description (optional)"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="groceries" /></Field>
        </div>

        {snippet && (
          <div className="rounded-md bg-muted/40 border border-border/40 p-2 mt-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Generated syntax</div>
            <pre className="font-mono text-xs whitespace-pre-wrap break-all">{snippet}</pre>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!snippet}>Insert into import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
