import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, type Account } from "@/hooks/use-ledger";
import type { AccountIssue } from "@/lib/import-parser";
import { toast } from "sonner";
import { recordManualAdjustment } from "@/lib/ledger-actions";
import { Sparkles, Plus, Link2 } from "lucide-react";

type AccountType = Account["type"];
const TYPES: { value: AccountType; label: string }[] = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Cash" },
  { value: "broker", label: "Broker" },
  { value: "exchange", label: "Exchange" },
  { value: "crypto_wallet", label: "Crypto Wallet" },
  { value: "cold_wallet", label: "Cold Wallet" },
  { value: "investment", label: "Investment" },
  { value: "savings", label: "Savings" },
  { value: "external", label: "Other" },
];

type Mode = "choose" | "create" | "map";

export interface ResolveResult {
  kind: "created" | "mapped" | "ignored";
  alias: string;
  accountId?: string;
  accountName?: string;
}

export function IssueResolveModal({
  open, onClose, issue, defaultCurrency, onResolved,
}: {
  open: boolean;
  onClose: () => void;
  issue: AccountIssue | null;
  defaultCurrency: string;
  onResolved: (r: ResolveResult) => void;
}) {
  const { rows: accounts, refresh } = useAccounts();
  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState(false);
  // create
  const [form, setForm] = useState({
    name: "", type: "bank" as AccountType, currency: defaultCurrency,
    description: "", initialBalance: "" as string,
  });
  // map
  const [mapTo, setMapTo] = useState<string>("");

  useEffect(() => {
    if (open && issue) {
      setMode("choose");
      setForm({
        name: issue.raw,
        type: guessType(issue.raw),
        currency: defaultCurrency,
        description: "",
        initialBalance: "",
      });
      setMapTo(issue.suggestions[0]?.id ?? "");
    }
  }, [open, issue, defaultCurrency]);

  const affected = issue?.lineNos.length ?? 0;

  async function persistAlias(accountId: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !issue) return;
    await (supabase as any).from("import_aliases").upsert(
      {
        user_id: u.user.id,
        alias: issue.normalized,
        entity_type: "account",
        entity_id: accountId,
      },
      { onConflict: "user_id,entity_type,alias" },
    );
  }

  async function handleCreate() {
    if (!issue) return;
    if (!form.name.trim()) return toast.error("Name required");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any)
        .from("accounts")
        .insert({
          user_id: u.user.id,
          name: form.name.trim(),
          type: form.type,
          currency: form.currency.toUpperCase(),
          description: form.description || null,
          color: "#22d3ee",
        })
        .select("id,name")
        .single();
      if (error) throw error;
      await persistAlias(data.id);
      const init = Number(form.initialBalance);
      if (Number.isFinite(init) && init !== 0) {
        await recordManualAdjustment({
          accountId: data.id,
          newBalance: init,
          note: "Initial balance (import)",
        });
      }
      await refresh();
      toast.success(`Account "${data.name}" created`);
      onResolved({ kind: "created", alias: issue.normalized, accountId: data.id, accountName: data.name });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create account");
    } finally {
      setBusy(false);
    }
  }

  async function handleMap() {
    if (!issue || !mapTo) return;
    setBusy(true);
    try {
      await persistAlias(mapTo);
      const acct = accounts.find((a) => a.id === mapTo);
      toast.success(`Mapped "${issue.raw}" → ${acct?.name ?? "account"}`);
      onResolved({ kind: "mapped", alias: issue.normalized, accountId: mapTo, accountName: acct?.name });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to map");
    } finally {
      setBusy(false);
    }
  }

  function handleIgnore() {
    if (!issue) return;
    onResolved({ kind: "ignored", alias: issue.normalized });
    onClose();
  }

  const sorted = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );

  if (!issue) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create account" : mode === "map" ? "Map to existing" : "Resolve issue"}
      size="md"
      footer={
        mode === "choose" ? (
          <Button variant="ghost" onClick={onClose}>Close</Button>
        ) : mode === "create" ? (
          <>
            <Button variant="outline" onClick={() => setMode("choose")} disabled={busy}>Back</Button>
            <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={handleCreate} disabled={busy}>
              {busy ? "Creating…" : "Create & resolve"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setMode("choose")} disabled={busy}>Back</Button>
            <Button
              className="bg-cyan text-background hover:bg-cyan/90"
              onClick={handleMap}
              disabled={busy || !mapTo}
            >
              {busy ? "Mapping…" : "Map & resolve"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border border-border/40 bg-card/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unknown account detected</div>
          <div className="font-mono text-sm mt-1">"{issue.raw}"</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Affects {affected} row{affected === 1 ? "" : "s"}. Resolving once fixes every match.
          </div>
        </div>

        {mode === "choose" && (
          <div className="space-y-2">
            {issue.suggestions.length > 0 && (
              <div className="rounded-md border border-cyan/30 bg-cyan/5 p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-cyan flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Suggestions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {issue.suggestions.map((s) => (
                    <button
                      key={s.id}
                      className="px-2 py-1 text-xs rounded-md border border-border/60 hover:bg-cyan/10 hover:border-cyan/40 transition-colors"
                      onClick={() => { setMapTo(s.id); setMode("map"); }}
                    >
                      {s.name} <span className="text-muted-foreground">· {Math.round(s.score * 100)}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setMode("create")}>
                <Plus className="h-4 w-4 mr-2 text-success" />
                <div className="text-left">
                  <div className="text-sm font-medium">Create Account</div>
                  <div className="text-[10px] text-muted-foreground">New account, saved alias</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setMode("map")}>
                <Link2 className="h-4 w-4 mr-2 text-cyan" />
                <div className="text-left">
                  <div className="text-sm font-medium">Map to Existing</div>
                  <div className="text-[10px] text-muted-foreground">Alias an existing one</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={handleIgnore}>
                <div className="h-4 w-4 mr-2 rounded-full border border-muted-foreground/60" />
                <div className="text-left">
                  <div className="text-sm font-medium">Ignore</div>
                  <div className="text-[10px] text-muted-foreground">Skip rows this session</div>
                </div>
              </Button>
            </div>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AccountType })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Initial Balance (optional)</Label>
              <Input
                type="number" inputMode="decimal" placeholder="0.00"
                value={form.initialBalance}
                onChange={(e) => setForm({ ...form, initialBalance: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        )}

        {mode === "map" && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Existing account</Label>
              <Select value={mapTo} onValueChange={setMapTo}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pick an account" /></SelectTrigger>
                <SelectContent>
                  {sorted.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} <span className="text-muted-foreground">· {a.type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-[11px] text-muted-foreground">
              "<span className="font-mono">{issue.raw}</span>" will be remembered as an alias and resolved automatically in future imports.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function guessType(raw: string): AccountType {
  const t = raw.toLowerCase();
  if (/cash|contant|wallet cash/.test(t)) return "cash";
  if (/binance|coinbase|kraken|exchange/.test(t)) return "exchange";
  if (/ibkr|broker|fineco|degiro|trading/.test(t)) return "broker";
  if (/ledger|trezor|cold/.test(t)) return "cold_wallet";
  if (/metamask|phantom|hot|wallet/.test(t)) return "crypto_wallet";
  if (/saving|deposito|risparmio/.test(t)) return "savings";
  return "bank";
}
