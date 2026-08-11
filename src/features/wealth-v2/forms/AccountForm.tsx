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
import { Account, ACCOUNT_KINDS, ACCOUNT_OWNERSHIPS, accountId } from "@/domain/accounts";
import { financialV2Repository } from "@/lib/v2-runtime";
import { safeEntityId } from "../form-utils";
import { humanize } from "../format";

export function AccountForm({ onSaved, existing }: { onSaved: () => void; existing?: Account }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(() => existing?.name ?? "");
  const [kind, setKind] = useState<(typeof ACCOUNT_KINDS)[number]>(() => existing?.kind ?? "bank");
  const [ownership, setOwnership] = useState<(typeof ACCOUNT_OWNERSHIPS)[number]>(
    () => existing?.ownership ?? "owned",
  );
  const [includeInNetWorth, setIncludeInNetWorth] = useState(
    () => existing?.includeInNetWorth ?? true,
  );
  const [saving, setSaving] = useState(false);

  const onOwnership = (value: (typeof ACCOUNT_OWNERSHIPS)[number]) => {
    setOwnership(value);
    if (value !== "owned") setIncludeInNetWorth(false);
    if (value === "external") {
      setKind("external");
    } else if (value === "system") {
      setKind((current) =>
        ["income", "expense", "equity"].includes(current) ? current : "equity",
      );
    } else {
      setKind((current) =>
        ["external", "income", "expense", "equity"].includes(current) ? "bank" : current,
      );
    }
  };

  const onKind = (value: (typeof ACCOUNT_KINDS)[number]) => {
    setKind(value);
    if (value === "external") {
      setOwnership("external");
      setIncludeInNetWorth(false);
    } else if (["income", "expense", "equity"].includes(value)) {
      setOwnership("system");
      setIncludeInNetWorth(false);
    } else {
      setOwnership("owned");
    }
  };

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
      toast.success(existing ? "Account saved" : "Account created");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="account-name">Name</Label>
        <Input
          id="account-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Main bank"
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Kind</Label>
          <Select
            value={kind}
            onValueChange={(value) => onKind(value as (typeof ACCOUNT_KINDS)[number])}
          >
            <SelectTrigger aria-label="Account kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_KINDS.map((value) => (
                <SelectItem key={value} value={value}>
                  {humanize(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ownership</Label>
          <Select
            value={ownership}
            onValueChange={(value) => onOwnership(value as (typeof ACCOUNT_OWNERSHIPS)[number])}
          >
            <SelectTrigger aria-label="Account ownership">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_OWNERSHIPS.map((value) => (
                <SelectItem key={value} value={value}>
                  {humanize(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="glass-strong flex items-center justify-between gap-4 rounded-xl p-4">
        <div>
          <div className="text-sm font-medium">Include in net worth</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Only accounts you own count towards your net worth.
          </p>
        </div>
        <Switch
          checked={includeInNetWorth}
          disabled={ownership !== "owned"}
          onCheckedChange={setIncludeInNetWorth}
        />
      </div>
      <Button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full bg-cyan text-background hover:bg-cyan/90"
      >
        {saving ? "Saving…" : existing ? "Save account" : "Create account"}
      </Button>
    </form>
  );
}
