import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { putValidatedAccount } from "@/application/services";
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
import { Switch } from "@/components/ui/switch";
import { financialV2Keys } from "@/data/query-keys";
import { Account, type AccountKind, accountId } from "@/domain/accounts";
import { financialV2Repository } from "@/lib/v2-runtime";
import { useI18n } from "@/lib/use-i18n";
import { safeEntityId } from "../form-utils";
import { describeActionError } from "@/features/wealth-v2/user-message";

const USER_ACCOUNT_KINDS = [
  "cash",
  "bank",
  "savings",
  "broker",
  "exchange",
  "crypto-wallet",
  "cold-wallet",
  "investment",
  "liability",
] as const satisfies readonly AccountKind[];

const ACCOUNT_KIND_LABELS: Readonly<Record<(typeof USER_ACCOUNT_KINDS)[number], string>> = {
  cash: "Cash",
  bank: "Bank",
  savings: "Savings",
  broker: "Broker",
  exchange: "Exchange",
  "crypto-wallet": "Crypto Wallet",
  "cold-wallet": "Cold Wallet",
  investment: "Investment",
  liability: "Liability",
};

export function AccountForm({
  onSaved,
  existing,
}: {
  onSaved: (account?: Account) => void;
  existing?: Account;
}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [name, setName] = useState(() => existing?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(() => existing?.kind ?? "bank");
  const [includeInNetWorth, setIncludeInNetWorth] = useState(
    () => existing?.includeInNetWorth ?? true,
  );
  const [saving, setSaving] = useState(false);

  const ownership = existing?.ownership ?? "owned";
  const isUserManaged = ownership === "owned";
  const visibleKinds: readonly AccountKind[] = isUserManaged ? USER_ACCOUNT_KINDS : [kind];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const account = Account.create({
        id: existing?.id ?? accountId(safeEntityId("account")),
        name: name.trim(),
        kind,
        ownership,
        includeInNetWorth: ownership === "owned" && includeInNetWorth,
        openedAt: existing?.openedAt ?? null,
        archivedAt: existing?.archivedAt ?? null,
      });
      await putValidatedAccount(financialV2Repository, account);
      await queryClient.invalidateQueries({ queryKey: financialV2Keys.all });
      toast.success(t(existing ? "Account saved" : "Account created"));
      onSaved(account);
    } catch (error) {
      toast.error(describeActionError(error, t("Could not create account")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="account-name">{t("Name")}</Label>
        <Input
          id="account-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("Main bank")}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{t("Kind")}</Label>
        <Select
          value={kind}
          disabled={!isUserManaged}
          onValueChange={(value) => setKind(value as AccountKind)}
        >
          <SelectTrigger aria-label={t("Account kind")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visibleKinds.map((value) => (
              <SelectItem key={value} value={value}>
                {value in ACCOUNT_KIND_LABELS
                  ? t(ACCOUNT_KIND_LABELS[value as keyof typeof ACCOUNT_KIND_LABELS])
                  : value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="surface-quiet flex items-center justify-between gap-4 rounded-xl p-4">
        <div>
          <div className="text-sm font-medium">{t("Include in net worth")}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Only accounts you own count towards your net worth.")}
          </p>
        </div>
        <Switch
          checked={includeInNetWorth}
          disabled={!isUserManaged}
          onCheckedChange={setIncludeInNetWorth}
        />
      </div>

      <Button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full bg-cyan text-background hover:bg-cyan/90"
      >
        {saving ? t("Saving…") : t(existing ? "Save account" : "Create account")}
      </Button>
    </form>
  );
}
