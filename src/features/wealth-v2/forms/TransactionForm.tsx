import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { buildTransactionLegInputs, safeEntityId, toLocalDateTimeInputValue } from "../form-utils";
import { buildSimpleActivityDraft, type SimpleActivityKind } from "../simple-activity";
import { useFinancialState } from "../use-financial-state";
import { describeActionError } from "@/features/wealth-v2/user-message";
import { cn } from "@/lib/utils";

const ACTIVITY_LABELS: Record<SimpleActivityKind, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

export function TransactionForm({ onSaved }: { onSaved: () => void }) {
  const queryClient = useQueryClient();
  const { data } = useFinancialState();
  const [kind, setKind] = useState<SimpleActivityKind>("expense");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [accountId, setAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const ownedAccounts = useMemo(
    () =>
      data?.state.accounts.filter(
        (account) => account.ownership === "owned" && !account.isArchived(),
      ) ?? [],
    [data],
  );
  const assets = data?.state.assets ?? [];
  const incomeAccount = data?.state.accounts.find(
    (account) =>
      account.ownership === "system" && account.kind === "income" && !account.isArchived(),
  );
  const expenseAccount = data?.state.accounts.find(
    (account) =>
      account.ownership === "system" && account.kind === "expense" && !account.isArchived(),
  );
  const internalReady =
    kind === "transfer" || (kind === "income" ? Boolean(incomeAccount) : Boolean(expenseAccount));

  const draft = useMemo(() => {
    if (!accountId || !assetId || !amount.trim() || !internalReady) return null;
    if (kind === "transfer" && !destinationAccountId) return null;
    try {
      return buildSimpleActivityDraft({
        kind,
        accountId,
        destinationAccountId: kind === "transfer" ? destinationAccountId : undefined,
        assetId,
        amount,
        incomeAccountId: incomeAccount?.id.toString(),
        expenseAccountId: expenseAccount?.id.toString(),
      });
    } catch {
      return null;
    }
  }, [
    accountId,
    amount,
    assetId,
    destinationAccountId,
    expenseAccount,
    incomeAccount,
    internalReady,
    kind,
  ]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    try {
      const transaction = LedgerTransaction.create({
        id: transactionId(safeEntityId("tx")),
        occurredAt: UtcTimestamp.fromDate(new Date(occurredAt)),
        recordedAt: UtcTimestamp.fromDate(new Date()),
        description: description.trim() || ACTIVITY_LABELS[kind],
        legs: buildTransactionLegInputs(draft),
      });
      await postValidatedTransaction(financialV2Repository, transaction);
      await queryClient.invalidateQueries({ queryKey: financialV2Keys.all });
      toast.success(`${ACTIVITY_LABELS[kind]} recorded`);
      onSaved();
    } catch (error) {
      toast.error(describeActionError(error, "Could not record activity"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label>Activity type</Label>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/60 bg-muted/15 p-1">
          {(Object.keys(ACTIVITY_LABELS) as SimpleActivityKind[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                if (value !== "transfer") setDestinationAccountId("");
              }}
              className={cn(
                "min-h-11 rounded-lg px-2 text-xs font-semibold transition-colors",
                kind === value
                  ? "bg-cyan/10 text-cyan ring-1 ring-inset ring-cyan/20"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {ACTIVITY_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            {kind === "transfer" ? "From account" : kind === "income" ? "To account" : "Account"}
          </Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="min-h-11">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {ownedAccounts.map((account) => (
                <SelectItem key={account.id.toString()} value={account.id.toString()}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {kind === "transfer" ? (
          <div className="space-y-2">
            <Label>To account</Label>
            <Select value={destinationAccountId} onValueChange={setDestinationAccountId}>
              <SelectTrigger className="min-h-11">
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                {ownedAccounts
                  .filter((account) => account.id.toString() !== accountId)
                  .map((account) => (
                    <SelectItem key={account.id.toString()} value={account.id.toString()}>
                      {account.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Asset</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger className="min-h-11">
                <SelectValue placeholder="Select asset" />
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
        )}
      </div>

      {kind === "transfer" && (
        <div className="space-y-2">
          <Label>Asset</Label>
          <Select value={assetId} onValueChange={setAssetId}>
            <SelectTrigger className="min-h-11">
              <SelectValue placeholder="Select asset" />
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
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="activity-amount">Amount</Label>
          <Input
            id="activity-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0,00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="activity-date">Date and time</Label>
          <Input
            id="activity-date"
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="activity-description">
          Description <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="activity-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={
            kind === "expense" ? "Online purchase" : kind === "income" ? "Salary" : "Move money"
          }
          maxLength={240}
        />
      </div>

      {!internalReady && (
        <p
          role="alert"
          className="rounded-xl border border-warning/25 bg-warning/5 p-3 text-xs text-warning"
        >
          This workspace needs an internal setup repair before this activity can be recorded.
        </p>
      )}

      <Button
        type="submit"
        disabled={saving || !draft}
        className="w-full bg-cyan text-background hover:bg-cyan/90"
      >
        {saving ? "Recording…" : "Record activity"}
      </Button>
    </form>
  );
}
