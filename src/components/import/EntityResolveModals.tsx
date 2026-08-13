import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
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
import { supabase } from "@/integrations/supabase/client";
import { useUserTable } from "@/hooks/use-user-table";
import type { ImportIssue } from "@/lib/import-parser";
import { toast } from "sonner";
import { Sparkles, Plus, Link2 } from "lucide-react";

type AssetClass =
  | "crypto"
  | "stock"
  | "etf"
  | "fiat"
  | "commodity"
  | "forex"
  | "cash"
  | "stablecoin"
  | "custom";
const CLASSES: { value: AssetClass; label: string }[] = [
  { value: "crypto", label: "Crypto" },
  { value: "stock", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "fiat", label: "Fiat" },
  { value: "stablecoin", label: "Stablecoin" },
  { value: "commodity", label: "Commodity" },
  { value: "forex", label: "Forex" },
  { value: "cash", label: "Cash" },
  { value: "custom", label: "Custom" },
];

type Mode = "choose" | "create" | "map";

export interface ResolveResult {
  kind: "created" | "mapped" | "ignored";
  alias: string;
  entityType: "asset" | "goal";
  entityId?: string;
  entityName?: string;
}

interface AssetRow {
  id: string;
  symbol: string;
  name: string;
}
interface GoalRow {
  id: string;
  name: string;
  target_amount: number;
}

export function AssetResolveModal({
  open,
  onClose,
  issue,
  onResolved,
}: {
  open: boolean;
  onClose: () => void;
  issue: ImportIssue | null;
  onResolved: (r: ResolveResult) => void;
}) {
  const { rows: assets, refresh } = useUserTable<AssetRow>("assets", { col: "symbol", asc: true });
  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    symbol: "",
    name: "",
    assetClass: "crypto" as AssetClass,
    price: "",
  });
  const [mapTo, setMapTo] = useState<string>("");

  useEffect(() => {
    if (open && issue) {
      setMode("choose");
      setForm({
        symbol: issue.raw.toUpperCase(),
        name: issue.raw,
        assetClass: guessClass(issue.raw),
        price: "",
      });
      setMapTo(issue.suggestions[0]?.id ?? "");
    }
  }, [open, issue]);

  async function persistAlias(entityId: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !issue) return;
    await (supabase as any)
      .from("import_aliases")
      .upsert(
        { user_id: u.user.id, alias: issue.normalized, entity_type: "asset", entity_id: entityId },
        { onConflict: "user_id,entity_type,alias" },
      );
  }

  async function handleCreate() {
    if (!issue) return;
    if (!form.symbol.trim()) return toast.error("Symbol required");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any)
        .from("assets")
        .insert({
          user_id: u.user.id,
          symbol: form.symbol.trim().toUpperCase(),
          name: form.name.trim() || form.symbol.trim().toUpperCase(),
          asset_class: form.assetClass,
          current_price: Number(form.price) || 0,
          custom_asset: true,
        })
        .select("id,symbol")
        .single();
      if (error) throw error;
      await persistAlias(data.id);
      await refresh();
      toast.success(`Asset "${data.symbol}" created`);
      onResolved({
        kind: "created",
        alias: issue.normalized,
        entityType: "asset",
        entityId: data.id,
        entityName: data.symbol,
      });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleMap() {
    if (!issue || !mapTo) return;
    setBusy(true);
    try {
      await persistAlias(mapTo);
      const a = assets.find((x) => x.id === mapTo);
      toast.success(`Mapped "${issue.raw}" → ${a?.symbol ?? "asset"}`);
      onResolved({
        kind: "mapped",
        alias: issue.normalized,
        entityType: "asset",
        entityId: mapTo,
        entityName: a?.symbol,
      });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  function handleIgnore() {
    if (!issue) return;
    onResolved({ kind: "ignored", alias: issue.normalized, entityType: "asset" });
    onClose();
  }

  const sorted = useMemo(
    () => [...assets].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [assets],
  );

  if (!issue) return null;
  const affected = issue.lineNos.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        mode === "create"
          ? "Create asset"
          : mode === "map"
            ? "Map to existing asset"
            : "Resolve asset"
      }
      size="md"
      footer={
        mode === "choose" ? (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        ) : mode === "create" ? (
          <>
            <Button variant="outline" onClick={() => setMode("choose")} disabled={busy}>
              Back
            </Button>
            <Button
              className="bg-cyan text-background hover:bg-cyan/90"
              onClick={handleCreate}
              disabled={busy}
            >
              {busy ? "Creating…" : "Create & resolve"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setMode("choose")} disabled={busy}>
              Back
            </Button>
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
          <div className="label-muted">Unknown asset detected</div>
          <div className="font-mono text-sm mt-1">"{issue.raw}"</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Affects {affected} row{affected === 1 ? "" : "s"}.
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
                      className="px-2 py-1 text-xs rounded-md border border-border/60 hover:bg-cyan/10 hover:border-cyan/40"
                      onClick={() => {
                        setMapTo(s.id);
                        setMode("map");
                      }}
                    >
                      {s.name}{" "}
                      <span className="text-muted-foreground">· {Math.round(s.score * 100)}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setMode("create")}
              >
                <Plus className="h-4 w-4 mr-2 text-success" />
                <div className="text-left">
                  <div className="text-sm font-medium">Create Asset</div>
                  <div className="text-[10px] text-muted-foreground">New asset, saved alias</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setMode("map")}
              >
                <Link2 className="h-4 w-4 mr-2 text-cyan" />
                <div className="text-left">
                  <div className="text-sm font-medium">Map to Existing</div>
                  <div className="text-[10px] text-muted-foreground">Alias to one you own</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={handleIgnore}
              >
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Symbol</Label>
                <Input
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Class</Label>
                <Select
                  value={form.assetClass}
                  onValueChange={(v) => setForm({ ...form, assetClass: v as AssetClass })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Current price (optional)</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        )}

        {mode === "map" && (
          <div>
            <Label className="text-xs">Existing asset</Label>
            <Select value={mapTo} onValueChange={setMapTo}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pick an asset" />
              </SelectTrigger>
              <SelectContent>
                {sorted.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.symbol} <span className="text-muted-foreground">· {a.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function GoalResolveModal({
  open,
  onClose,
  issue,
  onResolved,
}: {
  open: boolean;
  onClose: () => void;
  issue: ImportIssue | null;
  onResolved: (r: ResolveResult) => void;
}) {
  const { rows: goals, refresh } = useUserTable<GoalRow>("goals", { col: "name", asc: true });
  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", target: "" });
  const [mapTo, setMapTo] = useState<string>("");

  useEffect(() => {
    if (open && issue) {
      setMode("choose");
      setForm({ name: issue.raw, target: "" });
      setMapTo(issue.suggestions[0]?.id ?? "");
    }
  }, [open, issue]);

  async function persistAlias(entityId: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !issue) return;
    await (supabase as any)
      .from("import_aliases")
      .upsert(
        { user_id: u.user.id, alias: issue.normalized, entity_type: "goal", entity_id: entityId },
        { onConflict: "user_id,entity_type,alias" },
      );
  }

  async function handleCreate() {
    if (!issue) return;
    if (!form.name.trim()) return toast.error("Name required");
    const target = Number(form.target);
    if (!Number.isFinite(target) || target <= 0) return toast.error("Valid target required");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any)
        .from("goals")
        .insert({
          user_id: u.user.id,
          name: form.name.trim(),
          target_amount: target,
          current_amount: 0,
          kind: "custom",
        })
        .select("id,name")
        .single();
      if (error) throw error;
      await persistAlias(data.id);
      await refresh();
      toast.success(`Goal "${data.name}" created`);
      onResolved({
        kind: "created",
        alias: issue.normalized,
        entityType: "goal",
        entityId: data.id,
        entityName: data.name,
      });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleMap() {
    if (!issue || !mapTo) return;
    setBusy(true);
    try {
      await persistAlias(mapTo);
      const g = goals.find((x) => x.id === mapTo);
      toast.success(`Mapped "${issue.raw}" → ${g?.name ?? "goal"}`);
      onResolved({
        kind: "mapped",
        alias: issue.normalized,
        entityType: "goal",
        entityId: mapTo,
        entityName: g?.name,
      });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  function handleIgnore() {
    if (!issue) return;
    onResolved({ kind: "ignored", alias: issue.normalized, entityType: "goal" });
    onClose();
  }

  if (!issue) return null;
  const affected = issue.lineNos.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        mode === "create" ? "Create goal" : mode === "map" ? "Map to existing goal" : "Resolve goal"
      }
      size="md"
      footer={
        mode === "choose" ? (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        ) : mode === "create" ? (
          <>
            <Button variant="outline" onClick={() => setMode("choose")} disabled={busy}>
              Back
            </Button>
            <Button
              className="bg-cyan text-background hover:bg-cyan/90"
              onClick={handleCreate}
              disabled={busy}
            >
              {busy ? "Creating…" : "Create & resolve"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setMode("choose")} disabled={busy}>
              Back
            </Button>
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
          <div className="label-muted">Unknown goal detected</div>
          <div className="font-mono text-sm mt-1">"{issue.raw}"</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Affects {affected} row{affected === 1 ? "" : "s"}.
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
                      className="px-2 py-1 text-xs rounded-md border border-border/60 hover:bg-cyan/10 hover:border-cyan/40"
                      onClick={() => {
                        setMapTo(s.id);
                        setMode("map");
                      }}
                    >
                      {s.name}{" "}
                      <span className="text-muted-foreground">· {Math.round(s.score * 100)}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setMode("create")}
              >
                <Plus className="h-4 w-4 mr-2 text-success" />
                <div className="text-left">
                  <div className="text-sm font-medium">Create Goal</div>
                  <div className="text-[10px] text-muted-foreground">New goal, saved alias</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setMode("map")}
              >
                <Link2 className="h-4 w-4 mr-2 text-cyan" />
                <div className="text-left">
                  <div className="text-sm font-medium">Map to Existing</div>
                  <div className="text-[10px] text-muted-foreground">Alias to an existing goal</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={handleIgnore}
              >
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
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Target amount</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="10000"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        )}

        {mode === "map" && (
          <div>
            <Label className="text-xs">Existing goal</Label>
            <Select value={mapTo} onValueChange={setMapTo}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pick a goal" />
              </SelectTrigger>
              <SelectContent>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}{" "}
                    <span className="text-muted-foreground">
                      · target {Number(g.target_amount).toLocaleString()}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </Modal>
  );
}

function guessClass(raw: string): AssetClass {
  const t = raw.toLowerCase();
  if (/btc|eth|sol|ada|xrp|doge|bnb|matic|avax|dot|link|usdc|usdt|crypto/.test(t)) return "crypto";
  if (/etf|vwce|vusa|vti|spy|qqq|iwda/.test(t)) return "etf";
  if (/aapl|msft|googl|amzn|tsla|nvda|stock/.test(t)) return "stock";
  if (/gold|silver|oil/.test(t)) return "commodity";
  if (/usd|eur|gbp|jpy|chf|fiat/.test(t)) return "fiat";
  return "custom";
}
