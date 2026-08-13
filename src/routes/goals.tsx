import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { GoalInput, GoalKind, GoalRecord } from "@/application/advanced";
import { putValidatedGoal } from "@/application/services";
import { buildGoalsOverview } from "@/application/view-models";
import { PageHeader } from "@/components/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { advancedV2Keys } from "@/data/query-keys";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { formatMoney, formatQuantity, humanize } from "@/features/wealth-v2/format";
import { useAdvancedState } from "@/features/wealth-v2/use-advanced-state";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { advancedV2Repository } from "@/lib/v2-runtime";
import { cn } from "@/lib/utils";
import { describeActionError } from "@/features/wealth-v2/user-message";

export const Route = createFileRoute("/goals")({ component: GoalsPage });

type GoalFormState = {
  name: string;
  kind: GoalKind;
  targetAmount: string;
  targetQuantity: string;
  targetAccountId: string;
  targetAssetId: string;
  targetDate: string;
};

const EMPTY_FORM: GoalFormState = {
  name: "",
  kind: "net_worth",
  targetAmount: "",
  targetQuantity: "",
  targetAccountId: "",
  targetAssetId: "",
  targetDate: "",
};

function formFromGoal(goal: GoalRecord): GoalFormState {
  return {
    name: goal.name,
    kind: goal.kind,
    targetAmount: goal.targetAmount ?? "",
    targetQuantity: goal.targetQuantity ?? "",
    targetAccountId: goal.targetAccountId ?? "",
    targetAssetId: goal.targetAssetId ?? "",
    targetDate: goal.targetDate ?? "",
  };
}

function GoalsPage() {
  const financial = useFinancialState();
  const advanced = useAdvancedState();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GoalRecord | null>(null);
  const [form, setForm] = useState<GoalFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const goals = useMemo(() => {
    if (!financial.data || !advanced.data) return [];
    return buildGoalsOverview(financial.data, advanced.data);
  }, [financial.data, advanced.data]);

  if (financial.isLoading || advanced.isLoading) return <FinancialLoading />;
  if (financial.error || advanced.error || !financial.data || !advanced.data) {
    return (
      <FinancialError
        error={financial.error ?? advanced.error}
        retry={() => {
          void financial.refetch();
          void advanced.refetch();
        }}
      />
    );
  }

  const locale = financial.data.state.profile?.locale ?? "en-US";
  const ownedAccounts = financial.data.state.accounts.filter(
    (account) => account.ownership === "owned",
  );
  const assets = financial.data.state.assets;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (goal: GoalRecord) => {
    setEditing(goal);
    setForm(formFromGoal(goal));
    setDialogOpen(true);
  };

  const saveGoal = async () => {
    setSaving(true);
    try {
      const input: GoalInput = {
        id: editing?.id ?? crypto.randomUUID(),
        name: form.name,
        kind: form.kind,
        targetAmount: form.targetAmount || null,
        targetQuantity: form.targetQuantity || null,
        targetAccountId: form.targetAccountId || null,
        targetAssetId: form.targetAssetId || null,
        targetDate: form.targetDate || null,
      };
      await putValidatedGoal(advancedV2Repository, financial.data.state, input);
      await queryClient.invalidateQueries({ queryKey: advancedV2Keys.all });
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast.success(editing ? "Goal updated" : "Goal created");
    } catch (error) {
      toast.error(describeActionError(error, "Could not save goal"));
    } finally {
      setSaving(false);
    }
  };

  const archiveGoal = async (goal: GoalRecord) => {
    try {
      await advancedV2Repository.archiveGoal(goal.id);
      await queryClient.invalidateQueries({ queryKey: advancedV2Keys.all });
      toast.success("Goal archived");
    } catch (error) {
      toast.error(describeActionError(error, "Could not archive goal"));
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Goals"
        subtitle="Track what you are saving towards. Progress is calculated from your real balances, always up to date."
        action={
          <Button
            className="min-h-11 bg-cyan text-background hover:bg-cyan/90"
            onClick={openCreate}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New goal
          </Button>
        }
      />

      {goals.length === 0 ? (
        <div className="glass rounded-2xl border-dashed p-8 text-center sm:p-12">
          <Target className="mx-auto h-8 w-8 text-cyan" aria-hidden="true" />
          <h2 className="mt-3 font-display font-semibold">No active goals</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a net-worth, liquidity, account, quantity or asset-value target.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((item) => {
            const current =
              item.currentMoney !== null
                ? formatMoney(item.currentMoney, locale)
                : item.currentQuantity !== null
                  ? `${formatQuantity(item.currentQuantity.toString())} ${item.assetSymbol ?? ""}`.trim()
                  : "—";
            const target =
              item.targetMoney !== null
                ? formatMoney(item.targetMoney, locale)
                : item.targetQuantity !== null
                  ? `${formatQuantity(item.targetQuantity.toString())} ${item.assetSymbol ?? ""}`.trim()
                  : "—";

            return (
              <article key={item.goal.id} className="glass rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
                      <h2 className="truncate font-display font-semibold">{item.goal.name}</h2>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {humanize(item.kind)}
                      {item.goal.targetDate ? ` · by ${item.goal.targetDate}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="min-h-11 min-w-11"
                      onClick={() => openEdit(item.goal)}
                      aria-label={`Edit ${item.goal.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="min-h-11 min-w-11 text-destructive"
                          aria-label={`Archive ${item.goal.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Archive this goal?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The target will leave the active Goals view. Financial history is not
                            changed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void archiveGoal(item.goal)}
                          >
                            Archive goal
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="mt-5 flex min-w-0 items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Current
                    </div>
                    <div className="mt-1 truncate font-display text-xl font-semibold">
                      {current}
                    </div>
                  </div>
                  <div className="min-w-0 text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Target
                    </div>
                    <div className="mt-1 truncate font-mono text-sm">{target}</div>
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full bg-cyan transition-[width] motion-reduce:transition-none"
                    style={{ width: `${item.progressPercent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-mono text-muted-foreground">
                    {item.progressPercent.toFixed(1)}%
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-[10px]",
                      item.complete ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
                    )}
                  >
                    {item.complete ? "complete valuation" : "partial valuation"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit goal" : "New goal"}</DialogTitle>
            <DialogDescription>
              You set the target — progress is calculated automatically from your accounts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal-name">Name</Label>
              <Input
                id="goal-name"
                value={form.name}
                maxLength={120}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Goal type</Label>
              <Select
                value={form.kind}
                onValueChange={(kind) =>
                  setForm((current) => ({
                    ...EMPTY_FORM,
                    name: current.name,
                    targetDate: current.targetDate,
                    kind: kind as GoalKind,
                  }))
                }
              >
                <SelectTrigger className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="net_worth">Net worth</SelectItem>
                  <SelectItem value="liquid">Liquid value</SelectItem>
                  <SelectItem value="account_balance">Account value</SelectItem>
                  <SelectItem value="asset_quantity">Asset quantity</SelectItem>
                  <SelectItem value="asset_value">Asset value</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.kind === "account_balance" ? (
              <div className="space-y-2">
                <Label>Account</Label>
                <Select
                  value={form.targetAccountId}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, targetAccountId: value }))
                  }
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder="Select an owned account" />
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
            ) : null}

            {form.kind === "asset_quantity" || form.kind === "asset_value" ? (
              <div className="space-y-2">
                <Label>Asset</Label>
                <Select
                  value={form.targetAssetId}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, targetAssetId: value }))
                  }
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder="Select an asset" />
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
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="goal-target">
                {form.kind === "asset_quantity" ? "Target quantity" : "Target amount"}
              </Label>
              <Input
                id="goal-target"
                inputMode="decimal"
                value={form.kind === "asset_quantity" ? form.targetQuantity : form.targetAmount}
                placeholder={form.kind === "asset_quantity" ? "1" : "10000"}
                onChange={(event) =>
                  setForm((current) =>
                    current.kind === "asset_quantity"
                      ? { ...current, targetQuantity: event.target.value }
                      : { ...current, targetAmount: event.target.value },
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-date">Target date</Label>
              <Input
                id="goal-date"
                type="date"
                value={form.targetDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, targetDate: event.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              className="bg-cyan text-background hover:bg-cyan/90"
              onClick={() => void saveGoal()}
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Create goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
