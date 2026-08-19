import { MetricCard, metricToneFromClass } from "@/components/MetricCard";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  Lock,
  Pencil,
  Plus,
  Save,
  Shield,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import type { TradingSettingsInput, WeeklyReview, WeeklyReviewInput } from "@/application/advanced";
import { putValidatedTradingSettings, putValidatedWeeklyReview } from "@/application/services";
import { buildTradingOverview, type TradingOverview } from "@/application/view-models";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { advancedV2Keys } from "@/data/query-keys";
import { Money } from "@/domain/core";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { normalizeLocalizedDecimalInput } from "@/features/wealth-v2/form-utils";
import { formatMoney } from "@/features/wealth-v2/format";
import { useAdvancedState } from "@/features/wealth-v2/use-advanced-state";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { advancedV2Repository } from "@/lib/v2-runtime";
import { cn } from "@/lib/utils";
import { describeActionError } from "@/features/wealth-v2/user-message";

type Tab = "overview" | "capital" | "weekly" | "insights";
const TABS: Tab[] = ["overview", "capital", "weekly", "insights"];

export const Route = createFileRoute("/trading")({
  component: TradingWorkspace,
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const raw = typeof search.tab === "string" ? search.tab : "";
    if (raw === "trades") return { tab: "insights" };
    return (TABS as readonly string[]).includes(raw) ? { tab: raw as Tab } : {};
  },
});

function TradingWorkspace() {
  const financial = useFinancialState();
  const advanced = useAdvancedState();
  const navigate = useNavigate({ from: "/trading" });
  const { tab = "overview" } = useSearch({ from: "/trading" });

  const trading = useMemo(() => {
    if (!financial.data || !advanced.data) return null;
    return buildTradingOverview(financial.data, advanced.data);
  }, [financial.data, advanced.data]);

  if (financial.isLoading || advanced.isLoading) return <FinancialLoading />;
  if (financial.error || advanced.error || !financial.data || !advanced.data || !trading) {
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

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Trading Workspace"
        subtitle="Your trading capital, risk rules and weekly performance reviews in one workspace."
      />

      <Tabs value={tab} onValueChange={(value) => void navigate({ search: { tab: value as Tab } })}>
        <div className="max-w-full overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max border border-border/40 bg-muted/40 p-1">
            <TabsTrigger className="min-h-11 px-4" value="overview">
              Overview
            </TabsTrigger>
            <TabsTrigger className="min-h-11 px-4" value="capital">
              Capital & risk
            </TabsTrigger>
            <TabsTrigger className="min-h-11 px-4" value="weekly">
              Weekly
            </TabsTrigger>
            <TabsTrigger className="min-h-11 px-4" value="insights">
              Insights
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-5">
          <OverviewPanel trading={trading} locale={locale} />
        </TabsContent>
        <TabsContent value="capital" className="mt-5">
          <CapitalPanel trading={trading} locale={locale} />
        </TabsContent>
        <TabsContent value="weekly" className="mt-5">
          <WeeklyPanel trading={trading} locale={locale} />
        </TabsContent>
        <TabsContent value="insights" className="mt-5">
          <InsightsPanel trading={trading} locale={locale} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return <MetricCard label={label} value={value} hint={hint} tone={metricToneFromClass(tone)} />;
}

function OverviewPanel({ trading, locale }: { trading: TradingOverview; locale: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Known trading capital"
          value={formatMoney(trading.knownCapital, locale)}
          hint={trading.capitalComplete ? "Complete valuation" : "Partial valuation"}
        />
        <StatCard
          label="Review P&L"
          value={formatMoney(trading.reviewReportedPnl, locale)}
          hint="Journal-reported; does not alter ledger balances"
          tone={
            trading.reviewReportedPnl?.amount.isNegative() ? "text-destructive" : "text-success"
          }
        />
        <StatCard
          label="Weekly reviews"
          value={String(trading.reviewCount)}
          hint={`${trading.finalizedReviewCount} finalized`}
        />
        <StatCard
          label="Consistency"
          value={
            trading.averageConsistencyScore === null
              ? "—"
              : `${trading.averageConsistencyScore}/100`
          }
          hint="Average review discipline signal"
          tone="text-cyan"
        />
      </div>

      <div className="surface-section p-5">
        <div className="flex items-start gap-3">
          <Activity className="mt-0.5 h-5 w-5 shrink-0 text-cyan" aria-hidden="true" />
          <div>
            <h2 className="font-display font-semibold">How trading capital is counted</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Your trading capital comes from the broker, exchange and investment accounts you own.
              The profit and loss you log in a weekly review is used for your performance stats only
              — it never changes an account balance on its own.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CapitalPanel({ trading, locale }: { trading: TradingOverview; locale: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TradingSettingsInput>(trading.settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(trading.settings);
  }, [trading.settings]);

  const save = async () => {
    setSaving(true);
    try {
      await putValidatedTradingSettings(advancedV2Repository, {
        ...form,
        reserve: normalizeLocalizedDecimalInput(form.reserve),
        defaultRiskPct: normalizeLocalizedDecimalInput(form.defaultRiskPct),
        maxDailyLossPct: normalizeLocalizedDecimalInput(form.maxDailyLossPct),
        weeklyLossLimitPct: normalizeLocalizedDecimalInput(form.weeklyLossLimitPct),
      });
      await queryClient.invalidateQueries({ queryKey: advancedV2Keys.all });
      toast.success("Trading risk settings saved");
    } catch (error) {
      toast.error(describeActionError(error, "Could not save trading settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="surface-section p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-cyan" aria-hidden="true" />
            <div>
              <h2 className="font-display font-semibold">Risk parameters</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Stored as exact settings only. They do not mutate financial balances.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ExactField
              id="trading-reserve"
              label={`Reserve (${trading.knownCapital?.currency.toString() ?? "base currency"})`}
              value={form.reserve}
              onChange={(reserve) => setForm((current) => ({ ...current, reserve }))}
            />
            <div className="space-y-2">
              <Label htmlFor="trading-primary-asset">Primary asset</Label>
              <Input
                id="trading-primary-asset"
                value={form.primaryAsset ?? ""}
                maxLength={32}
                placeholder="NQ"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    primaryAsset: event.target.value || null,
                  }))
                }
              />
            </div>
            <ExactField
              id="trading-default-risk"
              label="Default risk %"
              value={form.defaultRiskPct}
              onChange={(defaultRiskPct) => setForm((current) => ({ ...current, defaultRiskPct }))}
            />
            <ExactField
              id="trading-daily-loss"
              label="Max daily loss %"
              value={form.maxDailyLossPct}
              onChange={(maxDailyLossPct) =>
                setForm((current) => ({ ...current, maxDailyLossPct }))
              }
            />
            <ExactField
              id="trading-weekly-loss"
              label="Max weekly loss %"
              value={form.weeklyLossLimitPct}
              onChange={(weeklyLossLimitPct) =>
                setForm((current) => ({ ...current, weeklyLossLimitPct }))
              }
            />
          </div>

          <Button
            type="button"
            className="mt-5 min-h-11 bg-cyan text-background hover:bg-cyan/90"
            disabled={saving}
            onClick={() => void save()}
          >
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {saving ? "Saving…" : "Save risk settings"}
          </Button>
        </section>

        <aside className="surface-section p-5">
          <WalletCards className="h-5 w-5 text-cyan" aria-hidden="true" />
          <div className="mt-3 label-muted">Current known capital</div>
          <div className="mt-1 font-display text-3xl font-semibold">
            {formatMoney(trading.knownCapital, locale)}
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {trading.capitalComplete
              ? "All trading-account positions have current valuation."
              : "This is a known subtotal because one or more trading positions lack price or FX data."}
          </p>
        </aside>
      </div>
    </div>
  );
}

function ExactField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

type ReviewForm = {
  id: string;
  weekStart: string;
  reportedPnl: string;
  winRate: string;
  avgRr: string;
  tradeCount: string;
  maxDrawdownPct: string;
  disciplineScore: string;
  psychologyScore: string;
  notes: string;
  lessons: string;
};

function mondayDateKey(date = new Date()): string {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - offset);
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function emptyReview(): ReviewForm {
  return {
    id: crypto.randomUUID(),
    weekStart: mondayDateKey(),
    reportedPnl: "0",
    winRate: "0",
    avgRr: "0",
    tradeCount: "0",
    maxDrawdownPct: "0",
    disciplineScore: "70",
    psychologyScore: "70",
    notes: "",
    lessons: "",
  };
}

function reviewForm(review: WeeklyReview): ReviewForm {
  return {
    id: review.id,
    weekStart: review.weekStart,
    reportedPnl: review.reportedPnl,
    winRate: review.winRate,
    avgRr: review.avgRr,
    tradeCount: String(review.tradeCount),
    maxDrawdownPct: review.maxDrawdownPct,
    disciplineScore: String(review.disciplineScore),
    psychologyScore: String(review.psychologyScore),
    notes: review.notes ?? "",
    lessons: review.lessons ?? "",
  };
}

function WeeklyPanel({ trading, locale }: { trading: TradingOverview; locale: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ReviewForm>(() => emptyReview());
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm(emptyReview());
    setOpen(true);
  };

  const openEdit = (review: WeeklyReview) => {
    if (review.finalizedAt) return;
    setForm(reviewForm(review));
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const input: WeeklyReviewInput = {
        id: form.id,
        weekStart: form.weekStart,
        reportedPnl: normalizeLocalizedDecimalInput(form.reportedPnl),
        winRate: normalizeLocalizedDecimalInput(form.winRate),
        avgRr: normalizeLocalizedDecimalInput(form.avgRr),
        tradeCount: Number.parseInt(form.tradeCount, 10),
        maxDrawdownPct: normalizeLocalizedDecimalInput(form.maxDrawdownPct),
        disciplineScore: Number.parseInt(form.disciplineScore, 10),
        psychologyScore: Number.parseInt(form.psychologyScore, 10),
        notes: form.notes || null,
        lessons: form.lessons || null,
      };
      await putValidatedWeeklyReview(advancedV2Repository, input);
      await queryClient.invalidateQueries({ queryKey: advancedV2Keys.all });
      setOpen(false);
      toast.success("Weekly review saved as draft");
    } catch (error) {
      toast.error(describeActionError(error, "Could not save weekly review"));
    } finally {
      setSaving(false);
    }
  };

  const finalize = async (review: WeeklyReview) => {
    try {
      await advancedV2Repository.finalizeWeeklyReview(review.id);
      await queryClient.invalidateQueries({ queryKey: advancedV2Keys.all });
      toast.success("Weekly review finalized");
    } catch (error) {
      toast.error(describeActionError(error, "Could not finalize review"));
    }
  };

  const remove = async (review: WeeklyReview) => {
    try {
      await advancedV2Repository.deleteWeeklyReview(review.id);
      await queryClient.invalidateQueries({ queryKey: advancedV2Keys.all });
      toast.success("Draft review deleted");
    } catch (error) {
      toast.error(describeActionError(error, "Could not delete review"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold">Weekly reviews</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit a review as long as you need. Finalizing it is permanent — it can&apos;t be
            reopened, edited or deleted afterwards.
          </p>
        </div>
        <Button className="min-h-11 bg-cyan text-background hover:bg-cyan/90" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New review
        </Button>
      </div>

      {trading.reviews.length === 0 ? (
        <div className="surface-section border-dashed p-10 text-center text-sm text-muted-foreground">
          No weekly reviews yet.
        </div>
      ) : (
        <div className="space-y-3">
          {trading.reviews.map((review) => (
            <article key={review.id} className="surface-section p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-cyan" aria-hidden="true" />
                    <h3 className="font-display font-semibold">Week of {review.weekStart}</h3>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {review.tradeCount} trades · consistency {review.consistencyScore}/100
                  </div>
                </div>
                <div className="flex gap-1">
                  {!review.finalizedAt ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="min-h-11 min-w-11"
                      onClick={() => openEdit(review)}
                      aria-label={`Edit review ${review.weekStart}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {review.finalizedAt ? (
                    <span className="inline-flex min-h-11 items-center rounded-full bg-cyan/10 px-3 text-xs text-cyan">
                      <Lock className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Finalized
                    </span>
                  ) : (
                    <>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="outline" className="min-h-11">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Finalize
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Finalize this weekly review?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Finalization is permanent. The review cannot be edited or deleted
                              afterward. It still does not post P&amp;L into the financial ledger.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void finalize(review)}>
                              Finalize review
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="min-h-11 min-w-11 text-destructive"
                            aria-label={`Delete review ${review.weekStart}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Only draft review metadata is deleted. Financial ledger history is
                              unchanged.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => void remove(review)}
                            >
                              Delete draft
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniMetric
                  label="Reported P&L"
                  value={formatMoney(
                    trading.reviewReportedPnl
                      ? Money.of(review.reportedPnl, trading.reviewReportedPnl.currency)
                      : null,
                    locale,
                  )}
                  tone={review.reportedPnl.startsWith("-") ? "text-destructive" : "text-success"}
                />
                <MiniMetric label="Win rate" value={`${review.winRate}%`} />
                <MiniMetric label="Avg R:R" value={review.avgRr} />
                <MiniMetric label="Max DD" value={`${review.maxDrawdownPct}%`} />
              </div>

              {review.notes || review.lessons ? (
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  {review.notes ? (
                    <div className="rounded-xl bg-muted/20 p-3">
                      <div className="label-muted">Notes</div>
                      <p className="mt-1 whitespace-pre-wrap text-foreground/85">{review.notes}</p>
                    </div>
                  ) : null}
                  {review.lessons ? (
                    <div className="rounded-xl bg-muted/20 p-3">
                      <div className="label-muted">Lessons</div>
                      <p className="mt-1 whitespace-pre-wrap text-foreground/85">
                        {review.lessons}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Weekly review</DialogTitle>
            <DialogDescription>
              P&amp;L here is review metadata in your base currency; it never changes ledger
              balances.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="review-week">Week start</Label>
              <Input
                id="review-week"
                type="date"
                value={form.weekStart}
                onChange={(event) =>
                  setForm((current) => ({ ...current, weekStart: event.target.value }))
                }
              />
            </div>
            <ExactReviewField
              id="review-pnl"
              label="Reported P&L"
              value={form.reportedPnl}
              onChange={(reportedPnl) => setForm((current) => ({ ...current, reportedPnl }))}
            />
            <ExactReviewField
              id="review-win"
              label="Win rate %"
              value={form.winRate}
              onChange={(winRate) => setForm((current) => ({ ...current, winRate }))}
            />
            <ExactReviewField
              id="review-rr"
              label="Average R:R"
              value={form.avgRr}
              onChange={(avgRr) => setForm((current) => ({ ...current, avgRr }))}
            />
            <div className="space-y-2">
              <Label htmlFor="review-trades">Trade count</Label>
              <Input
                id="review-trades"
                inputMode="numeric"
                value={form.tradeCount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tradeCount: event.target.value }))
                }
              />
            </div>
            <ExactReviewField
              id="review-dd"
              label="Max drawdown %"
              value={form.maxDrawdownPct}
              onChange={(maxDrawdownPct) => setForm((current) => ({ ...current, maxDrawdownPct }))}
            />
            <div className="space-y-2">
              <Label htmlFor="review-discipline">Discipline 0–100</Label>
              <Input
                id="review-discipline"
                inputMode="numeric"
                value={form.disciplineScore}
                onChange={(event) =>
                  setForm((current) => ({ ...current, disciplineScore: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-psychology">Psychology 0–100</Label>
              <Input
                id="review-psychology"
                inputMode="numeric"
                value={form.psychologyScore}
                onChange={(event) =>
                  setForm((current) => ({ ...current, psychologyScore: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-notes">Notes</Label>
            <Textarea
              id="review-notes"
              value={form.notes}
              rows={3}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-lessons">Lessons</Label>
            <Textarea
              id="review-lessons"
              value={form.lessons}
              rows={3}
              onChange={(event) =>
                setForm((current) => ({ ...current, lessons: event.target.value }))
              }
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              className="bg-cyan text-background hover:bg-cyan/90"
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExactReviewField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/20 p-3">
      <div className="label-muted">{label}</div>
      <div className={cn("mt-1 font-mono text-sm", tone)}>{value}</div>
    </div>
  );
}

function InsightsPanel({ trading, locale }: { trading: TradingOverview; locale: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Average weekly P&L"
          value={formatMoney(trading.averageReportedPnl, locale)}
          hint="Review-reported average"
        />
        <StatCard
          label="Total reported P&L"
          value={formatMoney(trading.reviewReportedPnl, locale)}
          hint="Journal metric, not an account balance"
        />
        <StatCard
          label="Finalized"
          value={`${trading.finalizedReviewCount}/${trading.reviewCount}`}
          hint="Finalized weekly reviews"
        />
        <StatCard
          label="Consistency"
          value={
            trading.averageConsistencyScore === null
              ? "—"
              : `${trading.averageConsistencyScore}/100`
          }
          hint="Average across all reviews"
          tone="text-cyan"
        />
      </div>

      <div className="surface-section p-5">
        <h2 className="font-display font-semibold">Review history</h2>
        <div className="mt-4 space-y-2">
          {trading.reviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No review history yet.</p>
          ) : (
            trading.reviews.map((review) => (
              <div
                key={review.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-border/40 bg-muted/10 p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{review.weekStart}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {review.tradeCount} trades · {review.consistencyScore}/100 consistency
                  </div>
                </div>
                <div
                  className={cn(
                    "font-mono",
                    review.reportedPnl.startsWith("-") ? "text-destructive" : "text-success",
                  )}
                >
                  {formatMoney(
                    trading.reviewReportedPnl
                      ? Money.of(review.reportedPnl, trading.reviewReportedPnl.currency)
                      : null,
                    locale,
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
