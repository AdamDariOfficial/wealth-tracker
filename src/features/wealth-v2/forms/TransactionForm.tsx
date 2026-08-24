import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postValidatedTransaction } from "@/application/services";
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
import { financialV2Keys } from "@/data/query-keys";
import { UtcTimestamp } from "@/domain/core";
import { LedgerTransaction, transactionId } from "@/domain/ledger";
import { financialV2Repository } from "@/lib/v2-runtime";
import { useI18n } from "@/lib/use-i18n";
import { buildTransactionLegInputs, safeEntityId, toLocalDateTimeInputValue } from "../form-utils";
import { buildSimpleActivityDraft, type SimpleActivityKind } from "../simple-activity";
import { useFinancialState } from "../use-financial-state";
import { describeActionError } from "@/features/wealth-v2/user-message";
import { EntityCombobox } from "@/features/wealth-v2/EntityCombobox";
import { AccountForm } from "@/features/wealth-v2/forms/AccountForm";
import { AssetForm } from "@/features/wealth-v2/forms/AssetForm";
import { cn } from "@/lib/utils";

const ACTIVITY_LABELS: Record<SimpleActivityKind, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

type AccountCreateTarget = "primary" | "destination";

export function TransactionForm({ onSaved }: { onSaved: () => void }) {
  const queryClient = useQueryClient();
  const { data } = useFinancialState();
  const { t } = useI18n();
  const [kind, setKind] = useState<SimpleActivityKind>("expense");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [accountId, setAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [accountCreateTarget, setAccountCreateTarget] = useState<AccountCreateTarget | null>(null);
  const [assetCreateOpen, setAssetCreateOpen] = useState(false);

  const ownedAccounts = useMemo(
    () =>
      data?.state.accounts.filter(
        (account) => account.ownership === "owned" && !account.isArchived(),
      ) ?? [],
    [data],
  );
  const assets = data?.state.assets ?? [];
  const accountOptions = useMemo(
    () =>
      ownedAccounts.map((account) => ({
        value: account.id.toString(),
        label: account.name,
        keywords: account.kind,
      })),
    [ownedAccounts],
  );
  const assetOptions = useMemo(
    () =>
      assets.map((asset) => ({
        value: asset.id.toString(),
        label: `${asset.symbol} · ${asset.name}`,
        keywords: asset.kind,
      })),
    [assets],
  );

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
        description: description.trim() || t(ACTIVITY_LABELS[kind]),
        legs: buildTransactionLegInputs(draft),
      });
      await postValidatedTransaction(financialV2Repository, transaction);
      await queryClient.invalidateQueries({ queryKey: financialV2Keys.all });
      toast.success(t(`${ACTIVITY_LABELS[kind]} recorded`));
      onSaved();
    } catch (error) {
      toast.error(describeActionError(error, t("Could not record activity")));
    } finally {
      setSaving(false);
    }
  };

  const primaryLabel = t(
    kind === "transfer" ? "From account" : kind === "income" ? "To account" : "Account",
  );

  return (
    <>
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <Label>{t("Activity type")}</Label>
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
                {t(ACTIVITY_LABELS[value])}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{primaryLabel}</Label>
            <EntityCombobox
              value={accountId}
              onValueChange={setAccountId}
              options={accountOptions}
              placeholder={t("Select account")}
              searchPlaceholder="Search accounts…"
              emptyText="No matching accounts."
              createLabel="+ Create new account"
              onCreate={() => setAccountCreateTarget("primary")}
            />
          </div>

          {kind === "transfer" ? (
            <div className="space-y-2">
              <Label>{t("To account")}</Label>
              <EntityCombobox
                value={destinationAccountId}
                onValueChange={setDestinationAccountId}
                options={accountOptions.filter((option) => option.value !== accountId)}
                placeholder={t("Select destination")}
                searchPlaceholder="Search accounts…"
                emptyText="No matching accounts."
                createLabel="+ Create new account"
                onCreate={() => setAccountCreateTarget("destination")}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t("Asset")}</Label>
              <EntityCombobox
                value={assetId}
                onValueChange={setAssetId}
                options={assetOptions}
                placeholder={t("Select asset")}
                searchPlaceholder="Search assets…"
                emptyText="No matching assets."
                createLabel="+ Create new asset"
                onCreate={() => setAssetCreateOpen(true)}
              />
            </div>
          )}
        </div>

        {kind === "transfer" && (
          <div className="space-y-2">
            <Label>{t("Asset")}</Label>
            <EntityCombobox
              value={assetId}
              onValueChange={setAssetId}
              options={assetOptions}
              placeholder={t("Select asset")}
              searchPlaceholder="Search assets…"
              emptyText="No matching assets."
              createLabel="+ Create new asset"
              onCreate={() => setAssetCreateOpen(true)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="activity-amount">{t("Amount")}</Label>
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
            <Label htmlFor="activity-date">{t("Date and time")}</Label>
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
            {t("Description")} <span className="text-muted-foreground">{t("(optional)")}</span>
          </Label>
          <Input
            id="activity-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t(
              kind === "expense" ? "Online purchase" : kind === "income" ? "Salary" : "Move money",
            )}
            maxLength={240}
          />
        </div>

        {!internalReady && (
          <p
            role="alert"
            className="rounded-xl border border-warning/25 bg-warning/5 p-3 text-xs text-warning"
          >
            {t(
              "This workspace needs an internal setup repair before this activity can be recorded.",
            )}
          </p>
        )}

        <Button
          type="submit"
          disabled={saving || !draft}
          className="w-full bg-cyan text-background hover:bg-cyan/90"
        >
          {saving ? t("Recording…") : t("Record activity")}
        </Button>
      </form>

      <Dialog
        open={accountCreateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAccountCreateTarget(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Create account")}</DialogTitle>
            <DialogDescription>
              Create the account without closing the activity form. It will be selected
              automatically.
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            onSaved={(account) => {
              if (!account) return;
              if (accountCreateTarget === "destination")
                setDestinationAccountId(account.id.toString());
              else setAccountId(account.id.toString());
              setAccountCreateTarget(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={assetCreateOpen} onOpenChange={setAssetCreateOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Create asset")}</DialogTitle>
            <DialogDescription>
              Create the asset without closing the activity form. It will be selected automatically.
            </DialogDescription>
          </DialogHeader>
          <AssetForm
            onSaved={(asset) => {
              if (!asset) return;
              setAssetId(asset.id.toString());
              setAssetCreateOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
