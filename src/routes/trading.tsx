import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, ChevronDown, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TradingSettingsInput, WeeklyReview, WeeklyReviewInput } from "@/application/advanced";
import { putValidatedTradingSettings, saveValidatedWeeklyReview } from "@/application/services";
import { buildTradingOverview, type TradingOverview } from "@/application/view-models";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { TradingWeeklyPnlChart } from "@/components/charts/TradingWeeklyPnlChart";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { advancedV2Keys } from "@/data/query-keys";
import { Decimal, Money } from "@/domain/core";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { normalizeLocalizedDecimalInput } from "@/features/wealth-v2/form-utils";
import { formatMoney } from "@/features/wealth-v2/format";
import { useAdvancedState } from "@/features/wealth-v2/use-advanced-state";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useI18n } from "@/lib/use-i18n";
import { cn } from "@/lib/utils";
import { advancedV2Repository } from "@/lib/v2-runtime";
import { describeActionError } from "@/features/wealth-v2/user-message";

type TradingView = "overview" | "weeks";
type TradingSearch = { view?: TradingView; risk?: boolean };
export const Route = createFileRoute("/trading")({
  validateSearch: (search: Record<string, unknown>): TradingSearch => {
    const tab = typeof search.tab === "string" ? search.tab : "";
    const view = search.view === "weeks" || tab === "weekly" ? "weeks" : "overview";
    const risk =
      search.risk === true || search.risk === "true" || tab === "capital" ? true : undefined;
    return { view, risk };
  },
  component: TradingWorkspace,
});

type RiskPlan = Readonly<{ deployable: Money | null; reserve: Money | null }>;
function buildRiskPlan(trading: TradingOverview): RiskPlan {
  if (!trading.knownCapital) return { deployable: null, reserve: null };
  const reserveAmount = Decimal.parse(trading.settings.reserve);
  const capped =
    reserveAmount.compare(trading.knownCapital.amount) > 0
      ? trading.knownCapital.amount
      : reserveAmount;
  return {
    reserve: Money.of(capped, trading.knownCapital.currency),
    deployable: Money.of(trading.knownCapital.amount.minus(capped), trading.knownCapital.currency),
  };
}
function averageReviewMetric(
  reviews: readonly WeeklyReview[],
  value: (review: WeeklyReview) => string,
): Decimal | null {
  if (reviews.length === 0) return null;
  let total = Decimal.zero();
  for (const review of reviews) total = total.plus(Decimal.parse(value(review)));
  return total.dividedBy(Decimal.fromInteger(reviews.length), 18, "half-even");
}
function reviewTone(value: string) {
  const amount = Decimal.parse(value);
  return amount.isZero()
    ? "text-foreground"
    : amount.isNegative()
      ? "text-destructive"
      : "text-success";
}

function TradingWorkspace() {
  const financial = useFinancialState();
  const advanced = useAdvancedState();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { locale, t } = useI18n();
  const trading = useMemo(
    () =>
      financial.data && advanced.data ? buildTradingOverview(financial.data, advanced.data) : null,
    [financial.data, advanced.data],
  );
  if (financial.isLoading || advanced.isLoading) return <FinancialLoading />;
  if (financial.error || advanced.error || !financial.data || !advanced.data || !trading)
    return (
      <FinancialError
        error={financial.error ?? advanced.error}
        retry={() => {
          void financial.refetch();
          void advanced.refetch();
        }}
      />
    );
  const setSearch = (patch: Partial<TradingSearch>) =>
    void navigate({
      search: (previous: TradingSearch) => ({ ...previous, ...patch }),
      resetScroll: false,
    });
  if (search.view === "weeks") return <WeeklyHistoryPage trading={trading} locale={locale} />;
  const risk = buildRiskPlan(trading);
  const averageWinRate = averageReviewMetric(trading.reviews, (r) => r.winRate);
  const averageRr = averageReviewMetric(trading.reviews, (r) => r.avgRr);
  const profitable = trading.reviews.filter(
    (r) => Decimal.parse(r.reportedPnl).compare(Decimal.zero()) > 0,
  ).length;
  let worst: Decimal | null = null;
  for (const r of trading.reviews) {
    const d = Decimal.parse(r.maxDrawdownPct);
    if (!worst || d.compare(worst) > 0) worst = d;
  }
  const currency =
    trading.reviewReportedPnl?.currency.toString() ??
    trading.knownCapital?.currency.toString() ??
    null;
  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Trading Workspace"
        subtitle="Your trading capital, risk rules and weekly performance reviews in one workspace."
        action={
          <Button variant="outline" onClick={() => setSearch({ risk: true })}>
            <Settings2 className="mr-2 h-4 w-4" /> Risk settings
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Trading capital"
          value={formatMoney(trading.knownCapital, locale)}
          hint={trading.capitalComplete ? "Current valued capital" : "Some positions need a value"}
        />
        <MetricCard
          label="Available after reserve"
          value={formatMoney(risk.deployable, locale)}
          hint={
            risk.reserve
              ? `${t("Capital reserve")}: ${formatMoney(risk.reserve, locale)}`
              : undefined
          }
        />
        <MetricCard
          label="Review P&L"
          value={formatMoney(trading.reviewReportedPnl, locale)}
          hint="Journal data, not an account balance"
          tone={
            !trading.reviewReportedPnl || trading.reviewReportedPnl.amount.isZero()
              ? "neutral"
              : trading.reviewReportedPnl.amount.isNegative()
                ? "negative"
                : "positive"
          }
        />
        <MetricCard
          label="Average win rate"
          value={averageWinRate ? `${averageWinRate.toFixed(1, "half-even")}%` : "—"}
          hint="Across weekly reviews"
        />
      </div>
      <SectionCard
        title="Weekly reported P&L"
        description="The weekly results recorded in your journal. This chart never changes account balances."
        icon={BarChart3}
      >
        {trading.reviews.length === 0 ? (
          <EmptyState
            compact
            title="No weekly data yet"
            description="Create your first weekly review and the chart will appear here."
          />
        ) : (
          <ChartFrame
            height="default"
            caption={
              locale === "it-IT"
                ? "Verde positivo, rosso negativo, zero neutro."
                : "Green is positive, red is negative and zero stays neutral."
            }
          >
            <TradingWeeklyPnlChart reviews={trading.reviews} currency={currency} locale={locale} />
          </ChartFrame>
        )}
      </SectionCard>
      {trading.reviews.length > 0 && (
        <SectionCard
          title="Key review stats"
          description="Only the review metrics that help read trading quality at a glance."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MiniMetric
              label="Average R:R"
              value={averageRr ? averageRr.toFixed(2, "half-even") : "—"}
            />
            <MiniMetric
              label="Worst drawdown"
              value={worst ? `${worst.toFixed(1, "half-even")}%` : "—"}
              tone={worst?.isZero() ? "text-foreground" : "text-destructive"}
            />
            <MiniMetric label="Profitable weeks" value={`${profitable}/${trading.reviewCount}`} />
          </div>
        </SectionCard>
      )}
      <WeeklySection trading={trading} locale={locale} compact />
      <RiskDialog
        open={search.risk === true}
        trading={trading}
        locale={locale}
        onOpenChange={(open) => setSearch({ risk: open ? true : undefined })}
      />
    </div>
  );
}

function WeeklyHistoryPage({ trading, locale }: { trading: TradingOverview; locale: string }) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Weekly reviews"
        subtitle="All your trading reviews, newest first."
        action={
          <Button asChild variant="outline">
            <Link to="/trading" search={{ view: "overview" }}>
              Back to trading
            </Link>
          </Button>
        }
      />
      <WeeklySection trading={trading} locale={locale} />
    </div>
  );
}

function WeeklySection({
  trading,
  locale,
  compact = false,
}: {
  trading: TradingOverview;
  locale: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WeeklyReview | null>(null);
  const { t } = useI18n();
  const reviews = compact ? trading.reviews.slice(0, 4) : trading.reviews;
  const create = () => {
    setEditing(null);
    setOpen(true);
  };
  return (
    <SectionCard
      title={compact ? "Recent weeks" : "Weekly reviews"}
      description={
        compact
          ? "Your latest trading reviews."
          : "Drafts can be edited. Saved reviews are permanent."
      }
      action={
        <Button onClick={create} className="bg-cyan text-background hover:bg-cyan/90">
          <Plus className="mr-2 h-4 w-4" /> New review
        </Button>
      }
    >
      <div className="space-y-2">
        {reviews.length === 0 ? (
          <EmptyState
            compact
            title="No weekly data yet"
            description="Create your first weekly review."
          />
        ) : (
          reviews.map((review) => (
            <ReviewRow
              key={review.id}
              review={review}
              trading={trading}
              locale={locale}
              onEdit={() => {
                setEditing(review);
                setOpen(true);
              }}
            />
          ))
        )}
      </div>
      {compact && trading.reviews.length > 0 && (
        <div className="mt-4 border-t border-border/40 pt-4">
          <Button asChild variant="ghost">
            <Link to="/trading" search={{ view: "weeks" }}>
              View all weeks
            </Link>
          </Button>
        </div>
      )}
      <ReviewDialog open={open} review={editing} onOpenChange={setOpen} />
    </SectionCard>
  );
}
function ReviewRow({
  review,
  trading,
  locale,
  onEdit,
}: {
  review: WeeklyReview;
  trading: TradingOverview;
  locale: string;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const remove = async () => {
    try {
      await advancedV2Repository.deleteWeeklyReview(review.id);
      await queryClient.invalidateQueries({ queryKey: advancedV2Keys.all });
      toast.success(`${t("Draft")} ${t("deleted")}`);
    } catch (error) {
      toast.error(describeActionError(error, t("Could not delete review")));
    }
  };
  return (
    <article className="rounded-xl border border-border/45 bg-muted/10 p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat(locale, {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date(`${review.weekStart}T00:00:00`))}
          </div>
          <div
            className={cn(
              "mt-1 font-mono text-xl font-semibold tracking-tight sm:text-2xl",
              reviewTone(review.reportedPnl),
            )}
          >
            {trading.reviewReportedPnl
              ? formatMoney(
                  Money.of(review.reportedPnl, trading.reviewReportedPnl.currency),
                  locale,
                )
              : review.reportedPnl}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            {review.tradeCount} {t("trades")} · {review.consistencyScore}/100
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {review.isDraft && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] text-warning">
              {t("Draft")}
            </span>
          )}
          {review.isDraft && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t("Edit")}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void remove()}
                className="text-destructive"
                aria-label={t("Delete")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
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
function mondayDateKey(date = new Date()) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
function reviewForm(review?: WeeklyReview | null): ReviewForm {
  return review
    ? {
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
      }
    : {
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
function ReviewDialog({
  open,
  review,
  onOpenChange,
}: {
  open: boolean;
  review: WeeklyReview | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ReviewForm>(() => reviewForm(review));
  const [saving, setSaving] = useState(false);
  const { locale, t } = useI18n();
  useEffect(() => {
    if (open) setForm(reviewForm(review));
  }, [open, review]);
  const save = async (finalize: boolean) => {
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
      await saveValidatedWeeklyReview(advancedV2Repository, input, finalize);
      await queryClient.invalidateQueries({ queryKey: advancedV2Keys.all });
      toast.success(
        finalize
          ? locale === "it-IT"
            ? "Review salvata definitivamente"
            : "Weekly review saved"
          : locale === "it-IT"
            ? "Bozza salvata"
            : "Draft saved",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(describeActionError(error, t("Could not save weekly review")));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{review ? "Edit weekly review" : "New weekly review"}</DialogTitle>
          <DialogDescription>
            {locale === "it-IT"
              ? "Salva rende la review definitiva e non più modificabile. Usa “Salva come bozza” se vuoi continuare a modificarla."
              : "Save makes this review final and immutable. Choose Save as draft if you want to keep editing it."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="review-week" label="Week start">
            <Input
              id="review-week"
              type="date"
              value={form.weekStart}
              onChange={(e) => setForm({ ...form, weekStart: e.target.value })}
            />
          </Field>
          <Exact
            id="review-pnl"
            label="Reported P&L"
            value={form.reportedPnl}
            set={(v) => setForm({ ...form, reportedPnl: v })}
          />
          <Exact
            id="review-win"
            label="Win rate %"
            value={form.winRate}
            set={(v) => setForm({ ...form, winRate: v })}
          />
          <Exact
            id="review-rr"
            label="Average R:R"
            value={form.avgRr}
            set={(v) => setForm({ ...form, avgRr: v })}
          />
          <Field id="review-trades" label="Trade count">
            <Input
              id="review-trades"
              inputMode="numeric"
              value={form.tradeCount}
              onChange={(e) => setForm({ ...form, tradeCount: e.target.value })}
            />
          </Field>
          <Exact
            id="review-dd"
            label="Max drawdown %"
            value={form.maxDrawdownPct}
            set={(v) => setForm({ ...form, maxDrawdownPct: v })}
          />
          <Exact
            id="review-discipline"
            label="Discipline 0–100"
            value={form.disciplineScore}
            set={(v) => setForm({ ...form, disciplineScore: v })}
          />
          <Exact
            id="review-psychology"
            label="Psychology 0–100"
            value={form.psychologyScore}
            set={(v) => setForm({ ...form, psychologyScore: v })}
          />
        </div>
        <Field id="review-notes" label="Notes">
          <Textarea
            id="review-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <Field id="review-lessons" label="Lessons">
          <Textarea
            id="review-lessons"
            rows={3}
            value={form.lessons}
            onChange={(e) => setForm({ ...form, lessons: e.target.value })}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="inline-flex overflow-hidden rounded-lg">
            <Button
              disabled={saving}
              onClick={() => void save(true)}
              className="rounded-r-none bg-cyan text-background hover:bg-cyan/90"
            >
              Save
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={saving}
                  className="rounded-l-none border-l border-background/20 bg-cyan px-3 text-background hover:bg-cyan/90"
                  aria-label={t("Save options")}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void save(false)}>
                  {t("Save as draft")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
function Exact({
  id,
  label,
  value,
  set,
}: {
  id: string;
  label: string;
  value: string;
  set: (value: string) => void;
}) {
  return (
    <Field id={id} label={label}>
      <Input id={id} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
    </Field>
  );
}

function RiskDialog({
  open,
  trading,
  locale,
  onOpenChange,
}: {
  open: boolean;
  trading: TradingOverview;
  locale: string;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TradingSettingsInput>(trading.settings);
  const [saving, setSaving] = useState(false);
  const { t } = useI18n();
  useEffect(() => setForm(trading.settings), [trading.settings, open]);
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
      toast.success(locale === "it-IT" ? "Limiti di rischio salvati" : "Risk guardrails saved");
      onOpenChange(false);
    } catch (error) {
      toast.error(describeActionError(error, t("Could not save trading settings")));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Risk guardrails")}</DialogTitle>
          <DialogDescription>
            {locale === "it-IT"
              ? "Parametri di pianificazione: non modificano i saldi e non bloccano automaticamente le transazioni."
              : "Planning parameters only: they never change balances or automatically block transactions."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Exact
            id="trading-reserve"
            label="Capital reserve"
            value={form.reserve}
            set={(reserve) => setForm({ ...form, reserve })}
          />
          <Field id="trading-primary" label="Primary asset">
            <Input
              id="trading-primary"
              value={form.primaryAsset ?? ""}
              onChange={(e) => setForm({ ...form, primaryAsset: e.target.value || null })}
            />
          </Field>
          <Exact
            id="trading-risk"
            label="Default risk %"
            value={form.defaultRiskPct}
            set={(defaultRiskPct) => setForm({ ...form, defaultRiskPct })}
          />
          <Exact
            id="trading-daily"
            label="Max daily loss %"
            value={form.maxDailyLossPct}
            set={(maxDailyLossPct) => setForm({ ...form, maxDailyLossPct })}
          />
          <Exact
            id="trading-weekly"
            label="Max weekly loss %"
            value={form.weeklyLossLimitPct}
            set={(weeklyLossLimitPct) => setForm({ ...form, weeklyLossLimitPct })}
          />
        </div>
        <Button
          disabled={saving}
          onClick={() => void save()}
          className="w-full bg-cyan text-background hover:bg-cyan/90"
        >
          Save guardrails
        </Button>
      </DialogContent>
    </Dialog>
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
  const { t } = useI18n();
  return (
    <div className="rounded-xl bg-muted/20 p-3">
      <div className="label-muted">{t(label)}</div>
      <div className={cn("mt-1 font-mono text-sm", tone)}>{value}</div>
    </div>
  );
}
