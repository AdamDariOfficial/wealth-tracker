import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedEntry } from "@/lib/import-parser";
import type { Account, Asset } from "@/hooks/use-ledger";

export interface EntryOverride {
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  assetId?: string | null;
  goalId?: string | null;
  amount?: number;
  quantity?: number;
  price?: number;
  targetAmount?: number;
  timestamp?: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
}

export function InlineEditDialog({
  open,
  entry,
  override,
  accounts,
  assets,
  goals,
  onClose,
  onSave,
}: {
  open: boolean;
  entry: ParsedEntry | null;
  override: EntryOverride;
  accounts: Account[];
  assets: Asset[];
  goals: { id: string; name: string }[];
  onClose: () => void;
  onSave: (o: EntryOverride) => void;
}) {
  const [form, setForm] = useState<EntryOverride>(override);
  useEffect(() => {
    setForm(override);
  }, [override, entry?.lineNo]);

  if (!entry) return null;
  const kind = entry.kind;
  const accountId = form.accountId ?? entry.account?.matchedId ?? "";
  const fromId = form.fromAccountId ?? entry.fromAccount?.matchedId ?? "";
  const toId = form.toAccountId ?? entry.toAccount?.matchedId ?? "";
  const assetId = form.assetId ?? entry.asset?.matchedId ?? "";
  const goalId = form.goalId ?? entry.goal?.matchedId ?? "";
  const ts = (form.timestamp ?? entry.timestamp).slice(0, 16);

  const showAccount = ["deposit", "expense", "buy", "sell", "account_open"].includes(kind);
  const showTransfer = kind === "transfer";
  const showAsset = ["buy", "sell", "asset_open"].includes(kind);
  const showGoal = kind === "goal_contribution" || kind === "goal_create";
  const showQtyPrice = ["buy", "sell", "asset_open"].includes(kind);
  const showAmount = !["asset_open", "goal_create"].includes(kind);
  const showTarget = kind === "goal_create";

  function set<K extends keyof EntryOverride>(k: K, v: EntryOverride[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Edit row {entry.lineNo} ·{" "}
            <span className="capitalize text-muted-foreground">{kind.replace("_", " ")}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {showAccount && (
            <Field label="Account">
              <Select
                value={accountId}
                onChange={(v) => set("accountId", v || null)}
                options={[
                  { v: "", label: "—" },
                  ...accounts.map((a) => ({ v: a.id, label: a.name })),
                ]}
              />
            </Field>
          )}
          {showTransfer && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="From">
                <Select
                  value={fromId}
                  onChange={(v) => set("fromAccountId", v || null)}
                  options={[
                    { v: "", label: "—" },
                    ...accounts.map((a) => ({ v: a.id, label: a.name })),
                  ]}
                />
              </Field>
              <Field label="To">
                <Select
                  value={toId}
                  onChange={(v) => set("toAccountId", v || null)}
                  options={[
                    { v: "", label: "—" },
                    ...accounts.map((a) => ({ v: a.id, label: a.name })),
                  ]}
                />
              </Field>
            </div>
          )}
          {showAsset && (
            <Field label="Asset">
              <Select
                value={assetId}
                onChange={(v) => set("assetId", v || null)}
                options={[
                  { v: "", label: "—" },
                  ...assets.map((a) => ({ v: a.id, label: `${a.symbol} · ${a.name}` })),
                ]}
              />
            </Field>
          )}
          {showGoal && (
            <Field label="Goal">
              <Select
                value={goalId}
                onChange={(v) => set("goalId", v || null)}
                options={[{ v: "", label: "—" }, ...goals.map((g) => ({ v: g.id, label: g.name }))]}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-2">
            {showAmount && (
              <Field label="Amount">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.amount ?? entry.amount}
                  onChange={(e) => set("amount", Number(e.target.value))}
                />
              </Field>
            )}
            {showTarget && (
              <Field label="Target">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.targetAmount ?? entry.targetAmount ?? 0}
                  onChange={(e) => set("targetAmount", Number(e.target.value))}
                />
              </Field>
            )}
            {showQtyPrice && (
              <Field label="Quantity">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.quantity ?? entry.quantity ?? 0}
                  onChange={(e) => set("quantity", Number(e.target.value))}
                />
              </Field>
            )}
            {showQtyPrice && (
              <Field label="Price">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.price ?? entry.price ?? 0}
                  onChange={(e) => set("price", Number(e.target.value))}
                />
              </Field>
            )}
            <Field label="Date / time">
              <Input
                type="datetime-local"
                value={ts}
                onChange={(e) => set("timestamp", new Date(e.target.value).toISOString())}
              />
            </Field>
            <Field label="Category">
              <Input
                value={form.category ?? entry.category ?? ""}
                onChange={(e) => set("category", e.target.value || null)}
              />
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              value={form.description ?? entry.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              className="text-xs min-h-[60px]"
            />
          </Field>

          <Field label="Tags (comma-separated)">
            <Input
              value={(form.tags ?? []).join(", ")}
              onChange={(e) =>
                set(
                  "tags",
                  e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                )
              }
              placeholder="reviewed, q3"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(form);
              onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 min-w-0">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-8 px-2 rounded-md bg-card/60 border border-border/40 text-xs"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
