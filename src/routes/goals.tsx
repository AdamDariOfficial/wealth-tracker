import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { GoalInput, GoalKind, GoalRecord } from "@/application/advanced";
import { putValidatedGoal } from "@/application/services";
import { buildGoalsOverview } from "@/application/view-models";
import { MetricCard } from "@/components/MetricCard";
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
import { EntityCombobox } from "@/features/wealth-v2/EntityCombobox";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { AccountForm } from "@/features/wealth-v2/forms/AccountForm";
import { AssetForm } from "@/features/wealth-v2/forms/AssetForm";
import { normalizeLocalizedDecimalInput } from "@/features/wealth-v2/form-utils";
import { formatMoney, formatQuantity } from "@/features/wealth-v2/format";
import { useAdvancedState } from "@/features/wealth-v2/use-advanced-state";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useI18n } from "@/lib/use-i18n";
import { advancedV2Repository } from "@/lib/v2-runtime";
import { cn } from "@/lib/utils";
import { describeActionError } from "@/features/wealth-v2/user-message";

export const Route = createFileRoute("/goals")({ component: GoalsPage });

type GoalStatusFilter = "all" | "in-progress" | "completed";
type GoalSort = "deadline" | "progress" | "name";
type GoalSortDirection = "asc" | "desc";

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

function goalKindLabel(kind: GoalKind): string {
  switch (kind) {
    case "net_worth":
      return "Net worth";
    case "liquid":
      return "Cash & liquidity";
    case "account_balance":
      return "Account";
    case "asset_quantity":
      return "Asset quantity";
    case "asset_value":
      return "Asset value";
  }
}

function formatGoalDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function GoalsPage() {
  const financial = useFinancialState();
  const advanced = useAdvancedState();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GoalRecord | null>(null);
  const [form, setForm] = useState<GoalFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<GoalStatusFilter>("all");
  const [goalSort, setGoalSort] = useState<GoalSort>("deadline");
  const [goalSortDirection, setGoalSortDirection] = useState<GoalSortDirection>("asc");
  const [quickAccountOpen, setQuickAccountOpen] = useState(false);
  const [quickAssetOpen, setQuickAssetOpen] = useState(false);

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

  const locale = financial.data.state.profile?.locale ?? "it-IT";
  const completedGoalCount = goals.filter((goal) => goal.progressPercent >= 100).length;
  const activeGoalCount = goals.length - completedGoalCount;
  const nextDeadlineGoal = [...goals]
    .filter((goal) => goal.progressPercent < 100 && goal.goal.targetDate)
    .sort((left, right) =>
      (left.goal.targetDate ?? "").localeCompare(right.goal.targetDate ?? ""),
    )[0];
  const nextDeadline = nextDeadlineGoal?.goal.targetDate
    ? formatGoalDate(nextDeadlineGoal.goal.targetDate, locale)
    : t("No deadline");

  const visibleGoals = (() => {
    const filtered = goals.filter((item) =>
      statusFilter === "completed"
        ? item.progressPercent >= 100
        : statusFilter === "in-progress"
          ? item.progressPercent < 100
          : true,
    );
    const direction = goalSortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => {
      if (goalSort === "name") {
        return left.goal.name.localeCompare(right.goal.name, locale) * direction;
      }
      if (goalSort === "progress") {
        return (left.progressPercent - right.progressPercent) * direction;
      }
      const leftDate = left.goal.targetDate ?? "9999-12-31";
      const rightDate = right.goal.targetDate ?? "9999-12-31";
      return leftDate.localeCompare(rightDate) * direction;
    });
  })();
  const ownedAccounts = financial.data.state.accounts.filter(
    (account) => account.ownership === "owned",
  );
  const assets = financial.data.state.assets;
  const accountOptions = ownedAccounts.map((account) => ({
    value: account.id.toString(),
    label: account.name,
    keywords: account.kind,
  }));
  const assetOptions = assets.map((asset) => ({
    value: asset.id.toString(),
    label: `${asset.symbol} · ${asset.name}`,
    keywords: asset.kind,
  }));

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
        targetAmount: form.targetAmount ? normalizeLocalizedDecimalInput(form.targetAmount) : null,
        targetQuantity: form.targetQuantity
          ? normalizeLocalizedDecimalInput(form.targetQuantity)
          : null,
        targetAccountId: form.targetAccountId || null,
        targetAssetId: form.targetAssetId || null,
        targetDate: form.targetDate || null,
      };
      await putValidatedGoal(advancedV2Repository, financial.data.state, input);
      await queryClient.invalidateQueries({ queryKey: advancedV2Keys.all });
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast.success(t(editing ? "Goal updated" : "Goal created"));
    } catch (error) {
      toast.error(describeActionError(error, t("Could not save goal")));
    } finally {
      setSaving(false);
    }
  };

  const archiveGoal = async (goal: GoalRecord) => {
    try {
      await advancedV2Repository.archiveGoal(goal.id);
      await queryClient.invalidateQueries({ queryKey: advancedV2Keys.all });
      toast.success(t("Goal archived"));
    } catch (error) {
      toast.error(describeActionError(error, t("Could not archive goal")));
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
            {t("New goal")}
          </Button>
        }
      />

      {goals.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard label="In progress" value={String(activeGoalCount)} />
          <MetricCard
            label="Completed"
            value={String(completedGoalCount)}
            tone={completedGoalCount > 0 ? "positive" : "neutral"}
          />
          <MetricCard
            label="Next deadline"
            value={nextDeadline}
            hint={nextDeadlineGoal?.goal.name ?? t("No active deadline")}
          />
        </div>
      ) : null}

      {goals.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as GoalStatusFilter)}
          >
            <SelectTrigger className="w-full sm:w-44" aria-label={t("Goal status")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="in-progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select value={goalSort} onValueChange={(value) => setGoalSort(value as GoalSort)}>
              <SelectTrigger className="min-w-0 flex-1 sm:w-44" aria-label={t("Goal sort")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deadline">Deadline</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label={t(goalSortDirection === "asc" ? "Ascending" : "Descending")}
              title={t(goalSortDirection === "asc" ? "Ascending" : "Descending")}
              onClick={() =>
                setGoalSortDirection((current) => (current === "asc" ? "desc" : "asc"))
              }
            >
              {goalSortDirection === "asc" ? (
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {goals.length === 0 ? (
        <div className="surface-section border-dashed p-8 text-center sm:p-12">
          <Target className="mx-auto h-8 w-8 text-cyan" aria-hidden="true" />
          <h2 className="mt-3 font-display font-semibold">{t("No active goals")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Create a net-worth, liquidity, account, quantity or asset-value target.")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visibleGoals.map((item) => {
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
            const goalReached = item.progressPercent >= 100;
            const remainingMoney =
              item.currentMoney && item.targetMoney
                ? item.targetMoney.amount.compare(item.currentMoney.amount) <= 0
                  ? null
                  : item.targetMoney.minus(item.currentMoney)
                : null;
            const remainingQuantity =
              item.currentQuantity && item.targetQuantity
                ? item.targetQuantity.compare(item.currentQuantity) <= 0
                  ? null
                  : item.targetQuantity.minus(item.currentQuantity)
                : null;
            const remaining = goalReached
              ? t("Goal reached")
              : remainingMoney
                ? formatMoney(remainingMoney, locale)
                : remainingQuantity
                  ? `${formatQuantity(remainingQuantity.toString())} ${item.assetSymbol ?? ""}`.trim()
                  : "—";
            const deadline = item.goal.targetDate
              ? formatGoalDate(item.goal.targetDate, locale)
              : t("No deadline");
            const overdue =
              !goalReached &&
              Boolean(item.goal.targetDate) &&
              new Date(`${item.goal.targetDate}T23:59:59`).getTime() < Date.now();

            return (
              <article
                key={item.goal.id}
                className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/75 to-card/35 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cyan/10 px-2 py-1 text-[10px] font-medium text-cyan">
                        {t(goalKindLabel(item.kind))}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          overdue ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {overdue ? `${t("Overdue")} · ` : ""}
                        {deadline}
                      </span>
                    </div>
                    <h2 className="mt-2 truncate font-display text-base font-semibold">
                      {item.goal.name}
                    </h2>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="min-h-11 min-w-11"
                      onClick={() => openEdit(item.goal)}
                      aria-label={`${t("Edit")} ${item.goal.name}`}
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
                          aria-label={`${t("Archive")} ${item.goal.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Archive this goal?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t(
                              "The target will leave the active Goals view. Financial history is not changed.",
                            )}
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

                <div className="mt-4 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className="label-muted">{t("Current")}</div>
                    <div className="mt-0.5 truncate font-display text-xl font-semibold">
                      {current}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={cn(
                        "font-mono text-2xl font-semibold",
                        goalReached ? "text-success" : "text-cyan",
                      )}
                    >
                      {item.progressPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/45">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] motion-reduce:transition-none",
                      goalReached ? "bg-success" : "bg-cyan",
                    )}
                    style={{ width: `${item.progressPercent}%` }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/15 p-3">
                  <div className="min-w-0">
                    <div className="label-muted">{t("Target")}</div>
                    <div className="mt-1 truncate text-sm font-medium">{target}</div>
                  </div>
                  <div className="min-w-0 text-right">
                    <div className="label-muted">{t("Remaining")}</div>
                    <div className="mt-1 truncate text-sm font-medium">{remaining}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span>{deadline}</span>
                  {goalReached ? (
                    <span className="rounded-full bg-success/10 px-2 py-1 text-success">
                      {t("Completed")}
                    </span>
                  ) : !item.complete ? (
                    <span className="rounded-full bg-warning/10 px-2 py-1 text-warning">
                      {t("Data incomplete")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted/40 px-2 py-1">{t("In progress")}</span>
                  )}
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
              {t("You set the target — progress is calculated automatically from your accounts.")}
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
                <EntityCombobox
                  value={form.targetAccountId}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, targetAccountId: value }))
                  }
                  options={accountOptions}
                  placeholder="Select an owned account"
                  searchPlaceholder="Search accounts…"
                  emptyText="No matching accounts."
                  createLabel="+ Create new account"
                  onCreate={() => setQuickAccountOpen(true)}
                />
              </div>
            ) : null}

            {form.kind === "asset_quantity" || form.kind === "asset_value" ? (
              <div className="space-y-2">
                <Label>Asset</Label>
                <EntityCombobox
                  value={form.targetAssetId}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, targetAssetId: value }))
                  }
                  options={assetOptions}
                  placeholder="Select an asset"
                  searchPlaceholder="Search assets…"
                  emptyText="No matching assets."
                  createLabel="+ Create new asset"
                  onCreate={() => setQuickAssetOpen(true)}
                />
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
              {t("Cancel")}
            </Button>
            <Button
              type="button"
              disabled={saving}
              className="bg-cyan text-background hover:bg-cyan/90"
              onClick={() => void saveGoal()}
            >
              {saving ? t("Saving…") : editing ? t("Save changes") : t("Create goal")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quickAccountOpen} onOpenChange={setQuickAccountOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Create account")}</DialogTitle>
            <DialogDescription>
              {t(
                "Create the account without closing the goal form. It will be selected automatically.",
              )}
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            onSaved={(account) => {
              if (!account) return;
              setForm((current) => ({ ...current, targetAccountId: account.id.toString() }));
              setQuickAccountOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={quickAssetOpen} onOpenChange={setQuickAssetOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Create asset")}</DialogTitle>
            <DialogDescription>
              {t(
                "Create the asset without closing the goal form. It will be selected automatically.",
              )}
            </DialogDescription>
          </DialogHeader>
          <AssetForm
            onSaved={(asset) => {
              if (!asset) return;
              setForm((current) => ({ ...current, targetAssetId: asset.id.toString() }));
              setQuickAssetOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
