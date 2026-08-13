import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, RotateCcw, ShieldAlert, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  computeRollbackImpact,
  executeRollback,
  type RollbackScope,
  type RollbackImpact,
} from "@/lib/import-rollback";
import { formatMoney } from "@/lib/format-currency";
import { cn } from "@/lib/utils";

const MODES: { key: RollbackScope["mode"]; label: string; hint: string }[] = [
  {
    key: "all",
    label: "Entire batch",
    hint: "Void every transaction and archive every safe entity this batch created.",
  },
  {
    key: "transactions",
    label: "Only transactions",
    hint: "Void ledger rows but keep created assets, goals and accounts.",
  },
  {
    key: "entities",
    label: "Only created entities",
    hint: "Archive assets/goals/accounts created by this batch. Keeps transactions.",
  },
  {
    key: "kinds",
    label: "By operation kind",
    hint: "Void only rows of the operations you select.",
  },
  { key: "rows", label: "Selected rows", hint: "Void only the specific rows you already picked." },
];

const KINDS = [
  "deposit",
  "expense",
  "transfer",
  "buy",
  "sell",
  "goal_contribution",
  "goal_create",
  "account_open",
  "asset_open",
] as const;

export function RollbackDialog(props: {
  open: boolean;
  onClose: () => void;
  batchId: string;
  ccy: string;
  preselectedRows?: number[];
  onDone?: () => void;
}) {
  const { open, onClose, batchId, ccy, preselectedRows, onDone } = props;
  const [mode, setMode] = useState<RollbackScope["mode"]>(preselectedRows?.length ? "rows" : "all");
  const [kinds, setKinds] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<number[]>(preselectedRows ?? []);
  const [impact, setImpact] = useState<RollbackImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(preselectedRows?.length ? "rows" : "all");
    setRows(preselectedRows ?? []);
    setKinds(new Set());
  }, [open, preselectedRows]);

  const scope: RollbackScope = useMemo(() => {
    if (mode === "rows") return { mode: "rows", lineNos: rows };
    if (mode === "kinds") return { mode: "kinds", kinds: Array.from(kinds) as any };
    return { mode } as RollbackScope;
  }, [mode, rows, kinds]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    computeRollbackImpact(batchId, scope)
      .then((i) => {
        if (alive) setImpact(i);
      })
      .catch((e) => toast.error(e?.message ?? "Failed to compute impact"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, batchId, scope.mode, JSON.stringify(scope)]);

  async function confirm() {
    setBusy(true);
    try {
      const r = await executeRollback(batchId, scope, { reason: `Rollback (${mode})` });
      toast.success(
        `Rollback complete · ${r.voidedTx} tx voided · ${r.archivedAssets + r.archivedGoals + r.archivedAccounts} entities archived`,
      );
      onDone?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Rollback failed");
    } finally {
      setBusy(false);
    }
  }

  const nothingToDo =
    !!impact &&
    impact.txIdsToVoid.length === 0 &&
    impact.archivableAssetIds.length === 0 &&
    impact.archivableGoalIds.length === 0 &&
    impact.archivableAccountIds.length === 0 &&
    impact.goalReversals.length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-warning" /> Advanced rollback
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {MODES.map((m) => {
              const disabled = m.key === "rows" && !preselectedRows?.length;
              return (
                <button
                  key={m.key}
                  disabled={disabled}
                  onClick={() => setMode(m.key)}
                  className={cn(
                    "text-left p-3 rounded-md border transition",
                    mode === m.key
                      ? "border-cyan/50 bg-cyan/5"
                      : "border-border/40 hover:border-border/70",
                    disabled && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{m.hint}</div>
                </button>
              );
            })}
          </div>

          {mode === "kinds" && (
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => {
                const active = kinds.has(k);
                return (
                  <button
                    key={k}
                    onClick={() =>
                      setKinds((p) => {
                        const n = new Set(p);
                        active ? n.delete(k) : n.add(k);
                        return n;
                      })
                    }
                    className={cn(
                      "h-7 px-2 rounded-md text-[11px] border",
                      active
                        ? "border-cyan/40 bg-cyan/10 text-cyan"
                        : "border-border/40 text-muted-foreground",
                    )}
                  >
                    {k.replace("_", " ")}
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-md border border-border/40 bg-card/40 p-3 space-y-2 text-xs">
            <div className="label-muted">Impact preview</div>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Simulating…
              </div>
            ) : impact ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Stat label="Transactions" value={String(impact.txIdsToVoid.length)} />
                  <Stat
                    label="Transfer pairs"
                    value={String(impact.transferGroupsAffected.length)}
                  />
                  <Stat label="Goal reversals" value={String(impact.goalReversals.length)} />
                  <Stat
                    label="Net-worth Δ"
                    value={formatMoney(-impact.netWorthDelta, { currency: ccy })}
                    tone={
                      impact.netWorthDelta > 0
                        ? "destructive"
                        : impact.netWorthDelta < 0
                          ? "success"
                          : "muted"
                    }
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Assets archived" value={String(impact.archivableAssetIds.length)} />
                  <Stat label="Goals archived" value={String(impact.archivableGoalIds.length)} />
                  <Stat
                    label="Accounts archived"
                    value={String(impact.archivableAccountIds.length)}
                  />
                </div>
                {impact.blockedEntities.length > 0 && (
                  <div className="rounded-md border border-warning/30 bg-warning/5 p-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-warning font-medium">
                      <ShieldAlert className="h-3.5 w-3.5" /> Cannot archive{" "}
                      {impact.blockedEntities.length} entit
                      {impact.blockedEntities.length === 1 ? "y" : "ies"}
                    </div>
                    {impact.blockedEntities.slice(0, 6).map((b, i) => (
                      <div key={i} className="text-[11px] text-muted-foreground">
                        · <span className="text-foreground">{b.kind}</span> — {b.reason}
                      </div>
                    ))}
                  </div>
                )}
                {nothingToDo && (
                  <div className="text-[11px] text-muted-foreground italic">
                    Nothing to reverse for this scope.
                  </div>
                )}
              </>
            ) : null}
          </div>

          <div className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-warning" />
            Financial history is preserved. Transactions are soft-voided (<code>voided_at</code>)
            and entities are archived. Nothing is hard-deleted.
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={busy || loading || nothingToDo}
            className="bg-warning text-background hover:bg-warning/90"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
            )}
            Confirm rollback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "destructive" | "muted";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border/40 px-2 py-1.5 bg-card/40">
      <div className="label-muted">{label}</div>
      <div className={cn("font-mono text-sm font-semibold tabular-nums", color)}>{value}</div>
    </div>
  );
}
