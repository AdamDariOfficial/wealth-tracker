import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { postValidatedTransaction } from "@/application/services";
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
import { UtcTimestamp } from "@/domain/core";
import { LedgerTransaction, transactionId } from "@/domain/ledger";
import { financialV2Repository } from "@/lib/v2-runtime";
import {
  buildTransactionLegInputs,
  isBalancedDraft,
  safeEntityId,
  toLocalDateTimeInputValue,
  type DraftLeg,
} from "../form-utils";
import { useFinancialState } from "../use-financial-state";

function emptyLeg(): DraftLeg {
  return {
    rowId: safeEntityId("row"),
    accountId: "",
    assetId: "",
    quantity: "",
    memo: "",
  };
}

export function TransactionForm({ onSaved }: { onSaved: () => void }) {
  const queryClient = useQueryClient();
  const { data } = useFinancialState();
  const accounts = data?.state.accounts.filter((account) => !account.isArchived()) ?? [];
  const assets = data?.state.assets ?? [];
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [legs, setLegs] = useState<DraftLeg[]>(() => [emptyLeg(), emptyLeg()]);
  const [saving, setSaving] = useState(false);
  const balanced = useMemo(() => isBalancedDraft(legs), [legs]);

  const updateLeg = (rowId: string, patch: Partial<DraftLeg>) => {
    setLegs((current) => current.map((leg) => (leg.rowId === rowId ? { ...leg, ...patch } : leg)));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const occurred = UtcTimestamp.fromDate(new Date(occurredAt));
      const recorded = UtcTimestamp.fromDate(new Date());
      const transaction = LedgerTransaction.create({
        id: transactionId(safeEntityId("tx")),
        occurredAt: occurred,
        recordedAt: recorded,
        description: description.trim(),
        legs: buildTransactionLegInputs(legs),
      });
      await postValidatedTransaction(financialV2Repository, transaction);
      await queryClient.invalidateQueries({ queryKey: financialV2Keys.all });
      toast.success("Transaction posted");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post transaction");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="transaction-description">Description</Label>
        <Input
          id="transaction-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Monthly contribution"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="transaction-date">Occurred at</Label>
        <Input
          id="transaction-date"
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
          required
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>Ledger legs</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Signed quantities must balance to zero independently for every asset.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLegs((current) => [...current, emptyLeg()])}
          >
            <Plus className="mr-1 h-4 w-4" /> Leg
          </Button>
        </div>
        {legs.map((leg, index) => (
          <div key={leg.rowId} className="glass-strong space-y-3 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Leg {index + 1}
              </span>
              {legs.length > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setLegs((current) => current.filter((item) => item.rowId !== leg.rowId))
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remove leg ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                value={leg.accountId}
                onValueChange={(value) => updateLeg(leg.rowId, { accountId: value })}
              >
                <SelectTrigger aria-label={`Leg ${index + 1} account`}>
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id.toString()} value={account.id.toString()}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={leg.assetId}
                onValueChange={(value) => updateLeg(leg.rowId, { assetId: value })}
              >
                <SelectTrigger aria-label={`Leg ${index + 1} asset`}>
                  <SelectValue placeholder="Asset" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id.toString()} value={asset.id.toString()}>
                      {asset.symbol} · {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <Input
                inputMode="decimal"
                value={leg.quantity}
                onChange={(event) => updateLeg(leg.rowId, { quantity: event.target.value })}
                placeholder="+100 or -100"
                aria-label={`Leg ${index + 1} quantity`}
                required
              />
              <Input
                value={leg.memo}
                onChange={(event) => updateLeg(leg.rowId, { memo: event.target.value })}
                placeholder="Optional memo"
                aria-label={`Leg ${index + 1} memo`}
              />
            </div>
          </div>
        ))}
      </div>

      <div
        className={`rounded-xl border p-3 text-xs ${
          balanced
            ? "border-success/30 bg-success/5 text-success"
            : "border-warning/30 bg-warning/5 text-warning"
        }`}
      >
        {balanced
          ? "Balanced — ready to validate and post."
          : "Not balanced yet. Every asset total must equal exactly zero."}
      </div>
      <Button
        type="submit"
        disabled={saving || !description.trim() || !balanced}
        className="w-full bg-cyan text-background hover:bg-cyan/90"
      >
        {saving ? "Posting…" : "Post immutable transaction"}
      </Button>
    </form>
  );
}
