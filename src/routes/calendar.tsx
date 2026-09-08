import { MetricCard, metricToneFromClass } from "@/components/MetricCard";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  CALENDAR_SCOPES,
  addCalendarDays,
  addCalendarMonths,
  buildCalendarOverview,
  type CalendarBucketView,
  type CalendarScope,
  type CalendarValuationIssue,
  type TransactionView,
} from "@/application/view-models";
import { CalendarValueTrendChart } from "@/components/charts/CalendarValueTrendChart";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { PageHeader } from "@/components/PageHeader";
import { TransactionSummaryRow } from "@/components/TransactionSummaryRow";
import { useIsMobile } from "@/hooks/use-mobile";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Decimal, type Money } from "@/domain/core";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { formatDateTime, formatMoney } from "@/features/wealth-v2/format";
import {
  calendarDeltaStatus,
  calendarDeltaVisual,
  calendarHeatmapScale,
  type CalendarDeltaVisual,
} from "@/features/wealth-v2/calendar-color-grading";
import { calendarPeriodStatus } from "@/features/wealth-v2/calendar-period-status";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useI18n } from "@/lib/use-i18n";
import { cn } from "@/lib/utils";

type CalendarSearch = Readonly<{
  view?: CalendarScope;
  anchor?: string;
  day?: string;
}>;

function isDateKey(value: unknown): value is string {
  return (
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && parseDateKey(value) !== null
  );
}

export const Route = createFileRoute("/calendar")({
  validateSearch: (search: Record<string, unknown>): CalendarSearch => {
    const rawView = typeof search.view === "string" ? search.view : "";
    const anchor = isDateKey(search.anchor) ? search.anchor : undefined;
    const legacyDay = rawView === "day";
    const view = legacyDay
      ? "month"
      : CALENDAR_SCOPES.includes(rawView as CalendarScope)
        ? (rawView as CalendarScope)
        : "year";

    return {
      view,
      anchor,
      day: legacyDay
        ? isDateKey(search.day)
          ? search.day
          : anchor
        : isDateKey(search.day)
          ? search.day
          : undefined,
    };
  },
  component: CalendarPage,
});

function parseDateKey(value: string | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(year, month - 1, day);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return null;
  }
  return result;
}

function dateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function moneyTone(value: Money | null, complete = true): string {
  if (!value) return "text-muted-foreground";
  if (!complete) return "text-warning";
  const comparison = value.amount.compare(Decimal.zero());
  if (comparison > 0) return "text-success";
  if (comparison < 0) return "text-destructive";
  return "text-foreground";
}

function calendarSurfaceClass(visual: CalendarDeltaVisual): string {
  if (visual.tone === "muted") return "border-border/20 bg-muted/5 text-muted-foreground";
  if (visual.tone === "warning") return "semantic-surface-warning";
  if (visual.tone === "neutral") return "border-border/30 bg-muted/10";
  if (visual.tone === "positive") {
    if (visual.intensity === 3) return "semantic-surface-positive-3";
    if (visual.intensity === 2) return "semantic-surface-positive-2";
    return "semantic-surface-positive-1";
  }
  if (visual.intensity === 3) return "semantic-surface-negative-3";
  if (visual.intensity === 2) return "semantic-surface-negative-2";
  return "semantic-surface-negative-1";
}

function calendarStatusClass(status: ReturnType<typeof calendarDeltaStatus>): string {
  if (status === "partial") return "bg-warning/10 text-warning";
  if (status === "complete") return "bg-background/30 text-muted-foreground";
  return "bg-muted/40 text-muted-foreground";
}

function periodTitle(scope: CalendarScope, anchor: Date, locale: string): string {
  if (scope === "year") return String(anchor.getFullYear());
  if (scope === "quarter") {
    const quarter = Math.floor(anchor.getMonth() / 3) + 1;
    return `Q${quarter} ${anchor.getFullYear()}`;
  }
  if (scope === "month") {
    return anchor.toLocaleDateString(locale, { month: "long", year: "numeric" });
  }
  if (scope === "week") {
    const day = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const mondayOffset = (day.getDay() + 6) % 7;
    const start = addCalendarDays(day, -mondayOffset);
    const end = addCalendarDays(start, 6);
    return `${start.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    })} – ${end.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }
  return anchor.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function CalendarPage() {
  const financial = useFinancialState();
  const { t } = useI18n();
  const navigate = useNavigate({ from: "/calendar" });
  const { view = "year", anchor, day } = useSearch({ from: "/calendar" });
  const anchorDate = useMemo(() => parseDateKey(anchor) ?? new Date(), [anchor]);
  const selectedDay = useMemo(() => parseDateKey(day), [day]);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const workspace = useMemo(() => {
    if (!financial.data) return null;
    return buildCalendarOverview(financial.data, {
      scope: view,
      anchor: anchorDate,
      selectedDay,
      now: new Date(),
    });
  }, [financial.data, view, anchorDate, selectedDay]);

  if (financial.isLoading) return <FinancialLoading />;
  if (financial.error || !financial.data || !workspace) {
    return <FinancialError error={financial.error} retry={() => void financial.refetch()} />;
  }

  const locale = financial.data.state.profile?.locale ?? "en-US";
  const periodStatus = calendarPeriodStatus(workspace, new Date());
  const ownedAccountIds = new Set(
    financial.data.accounts
      .filter((account) => account.ownership === "owned")
      .map((account) => account.id),
  );


  const updateSearch = (patch: Partial<CalendarSearch>) => {
    void navigate({
      search: (previous: CalendarSearch) => ({ ...previous, ...patch }),
      resetScroll: false,
    });
  };

  const setAnchor = (date: Date) => {
    updateSearch({ anchor: dateKey(date), day: undefined });
  };

  const setView = (next: CalendarScope) => {
    updateSearch({ view: next, anchor: dateKey(anchorDate), day: undefined });
  };

  const openBucket = (bucket: CalendarBucketView) => {
    if (view === "year" || view === "quarter") {
      updateSearch({ view: "month", anchor: dateKey(bucket.start), day: undefined });
      return;
    }
    if (view === "month" || view === "week") {
      updateSearch({ day: dateKey(bucket.start) });
    }
  };

  const stepAnchor = (direction: -1 | 1) => {
    if (view === "week") setAnchor(addCalendarDays(anchorDate, direction * 7));
    else if (view === "month") setAnchor(addCalendarMonths(anchorDate, direction));
    else if (view === "quarter") setAnchor(addCalendarMonths(anchorDate, direction * 3));
    else setAnchor(new Date(anchorDate.getFullYear() + direction, 0, 1));
  };

  const valueTrendBuckets = workspace.buckets.filter(
    (bucket) => !bucket.future && bucket.knownNetWorth !== null,
  );
  const showValueTrend =
    view !== "day" && workspace.startValuation !== null && valueTrendBuckets.length > 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Calendar" subtitle="See how your portfolio changes over time." />

      <RangeNavigator
        view={view}
        anchorDate={anchorDate}
        locale={locale}
        onScopeChange={setView}
        onStep={stepAnchor}
        onPick={setAnchor}
        diagnosticsCount={periodStatus === "partial" ? workspace.diagnostics.length : 0}
        onDiagnostics={() => setDiagnosticsOpen(true)}
      />

      <PeriodSummary
        endNetWorth={workspace.endValuation?.knownNetWorth ?? null}
        delta={workspace.knownDelta}
        eventCount={workspace.events.length}
        complete={workspace.endValuation?.complete ?? false}
        deltaComplete={workspace.deltaComplete}
        locale={locale}
      />


      {view === "month" ? (
        <MonthGrid buckets={workspace.buckets} locale={locale} onOpen={openBucket} />
      ) : view === "day" ? (
        <DayPanel events={workspace.events} locale={locale} ownedAccountIds={ownedAccountIds} />
      ) : (
        <BucketGrid scope={view} buckets={workspace.buckets} locale={locale} onOpen={openBucket} />
      )}


      {showValueTrend && workspace.startValuation ? (
        <SectionCard title="Value trend" description="Portfolio value through the selected period.">
          <ChartFrame
            height="compact"
            caption={t(
              "The line starts from the period opening value and follows every recorded value change.",
            )}
          >
            <CalendarValueTrendChart
              scope={view}
              start={workspace.startValuation}
              buckets={workspace.buckets}
              locale={locale}
            />
          </ChartFrame>
        </SectionCard>
      ) : null}


      <Dialog open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
        <DialogContent className="max-h-[85dvh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Incomplete valuation data")}</DialogTitle>
            <DialogDescription>
              {t(
                "These historical prices or FX rates are missing. No replacement values are assumed.",
              )}
            </DialogDescription>
          </DialogHeader>
          <ValuationDiagnostics issues={workspace.diagnostics} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedDay !== null}
        onOpenChange={(open) => {
          if (!open) updateSearch({ day: undefined });
        }}
      >
        <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto motion-reduce:animate-none motion-reduce:transition-none">
          <DialogHeader>
            <DialogTitle>
              {selectedDay
                ? selectedDay.toLocaleDateString(locale, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Day"}
            </DialogTitle>
            <DialogDescription>{t("Transactions recorded on this day.")}</DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <EventList
              events={workspace.selectedDayEvents}
              locale={locale}
              ownedAccountIds={ownedAccountIds}
            />
          </div>

        </DialogContent>
      </Dialog>
    </div>
  );
}

function ValuationDiagnostics({ issues }: { issues: readonly CalendarValuationIssue[] }) {
  const { t } = useI18n();
  if (issues.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("No diagnostic details available.")}</p>;
  }

  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div key={issue.key} className="rounded-xl border border-border/55 bg-muted/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">
              {issue.assetSymbol} · {issue.assetName}
            </div>
            <span className="rounded-full bg-warning/10 px-2 py-1 text-[10px] font-medium text-warning">
              {issue.reason === "missing-price"
                ? t("Missing historical price")
                : t("Missing historical FX")}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {issue.reason === "missing-price"
              ? t(
                  "A historical price observation is required to value this asset at the selected cutoff.",
                )
              : `${t("Required FX pair")}: ${issue.sourceCurrency ?? "—"}/${issue.targetCurrency ?? "—"}`}
          </p>
        </div>
      ))}
    </div>
  );
}

const SCOPES = ["week", "month", "quarter", "year"] as const;
const SCOPE_LABELS: Record<(typeof SCOPES)[number], string> = {
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

function RangeNavigator({
  view,
  anchorDate,
  locale,
  onScopeChange,
  onStep,
  onPick,
  diagnosticsCount,
  onDiagnostics,
}: {
  view: CalendarScope;
  anchorDate: Date;
  locale: string;
  onScopeChange: (scope: CalendarScope) => void;
  onStep: (direction: -1 | 1) => void;
  onPick: (date: Date) => void;
  diagnosticsCount: number;
  onDiagnostics: () => void;
}) {
  const { t } = useI18n();
  const scopeLabel = t(
    SCOPE_LABELS[(SCOPES as readonly string[]).includes(view) ? (view as never) : "month"],
  );

  return (
    <section className="surface-section overflow-hidden p-2.5 sm:p-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl"
            onClick={() => onStep(-1)}
            aria-label={`${t("Previous")} ${scopeLabel}`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1 text-center lg:text-left">
            <h2 className="truncate font-display text-lg font-semibold tracking-tight sm:text-xl">
              {periodTitle(view, anchorDate, locale)}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl"
            onClick={() => onStep(1)}
            aria-label={`${t("Next")} ${scopeLabel}`}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <label className="ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/55 bg-card/40 text-muted-foreground">
            <span className="sr-only">{t("Jump to date")}</span>
            <input
              type="date"
              value={dateKey(anchorDate)}
              onChange={(event) => {
                const next = parseDateKey(event.target.value);
                if (next) onPick(next);
              }}
              className="h-full w-full cursor-pointer bg-transparent text-transparent outline-none [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-datetime-edit]:hidden"
              aria-label={t("Jump directly to date")}
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <div className="grid min-w-0 flex-1 grid-cols-4 gap-1 rounded-xl bg-muted/25 p-1 lg:flex-none">
            {SCOPES.map((scope) => (
              <button
                type="button"
                key={scope}
                onClick={() => onScopeChange(scope)}
                aria-pressed={view === scope}
                className={cn(
                  "min-h-10 min-w-0 rounded-lg px-2 text-[11px] font-medium transition-colors sm:text-sm",
                  view === scope
                    ? "bg-cyan/12 text-cyan ring-1 ring-cyan/30"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <span className="block truncate">{t(SCOPE_LABELS[scope])}</span>
              </button>
            ))}
          </div>
          {diagnosticsCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 border-warning/30 bg-warning/[0.06] text-warning hover:bg-warning/10 hover:text-warning"
              onClick={onDiagnostics}
              aria-label={`${t("Incomplete data")} · ${diagnosticsCount}`}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PeriodSummary({
  endNetWorth,
  delta,
  eventCount,
  complete,
  deltaComplete,
  locale,
}: {
  endNetWorth: Money | null;
  delta: Money | null;
  eventCount: number;
  complete: boolean;
  deltaComplete: boolean;
  locale: string;
}) {
  const { t } = useI18n();
  const direction = delta?.amount.compare(Decimal.zero()) ?? 0;
  const DeltaIcon = direction > 0 ? ArrowUpRight : direction < 0 ? ArrowDownRight : null;

  return (
    <section className="surface-section p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="label-muted">{t("Total value")}</div>
          <div className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {formatMoney(endNetWorth, locale)}
          </div>
          <div className={cn("mt-1 text-xs", complete ? "text-muted-foreground" : "text-warning")}>
            {t(complete ? "Current portfolio value" : "Some values are missing")}
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-4 border-t border-border/45 pt-4 sm:gap-8 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
          <div className="min-w-0">
            <div className="label-muted">{t("Change")}</div>
            <div
              className={cn(
                "mt-1 flex items-center gap-1 font-mono text-base font-semibold sm:text-lg",
                moneyTone(delta, deltaComplete),
              )}
            >
              {DeltaIcon ? <DeltaIcon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
              <span className="truncate">{formatMoney(delta, locale)}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t(deltaComplete ? "This period" : "Some values are missing")}
            </div>
          </div>
          <div className="min-w-0">
            <div className="label-muted">{t("Transactions")}</div>
            <div className="mt-1 font-mono text-base font-semibold sm:text-lg">{eventCount}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t("Recorded this period")}</div>
          </div>
        </div>
      </div>
    </section>
  );
}


function BucketGrid({
  scope,
  buckets,
  locale,
  onOpen,
}: {
  scope: CalendarScope;
  buckets: readonly CalendarBucketView[];
  locale: string;
  onOpen: (bucket: CalendarBucketView) => void;
}) {
  const { t } = useI18n();
  const columns = scope === "year" ? "md:grid-cols-3 xl:grid-cols-4" : "md:grid-cols-3";
  const heatmapScale = calendarHeatmapScale(buckets);

  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", columns)}>
      {buckets.map((bucket) => (
        <button
          type="button"
          key={bucket.key}
          onClick={() => onOpen(bucket)}
          className={cn(
            "min-w-0 rounded-2xl border p-4 text-left transition-[filter] hover:brightness-110 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40",
            calendarSurfaceClass(calendarDeltaVisual(bucket, heatmapScale)),
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-display font-semibold">
                {bucketLabel(scope, bucket.start, locale)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {bucket.eventCount} {t(bucket.eventCount === 1 ? "transaction" : "transactions")}
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-1 text-[10px]",
                calendarDeltaStatus(bucket) === "complete" && "hidden",
                calendarStatusClass(calendarDeltaStatus(bucket)),
              )}
            >
              {calendarDeltaStatus(bucket) === "partial"
                ? t("incomplete")
                : calendarDeltaStatus(bucket) === "future"
                  ? t("upcoming")
                  : calendarDeltaStatus(bucket) === "unknown"
                    ? t("no data")
                    : ""}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
            <MiniValue
              label="Income"
              value={formatFlowMoney(bucket.knownInflow, locale, "+")}
              tone={bucket.flowComplete ? "text-success" : "text-warning"}
            />
            <MiniValue
              label="Expense"
              value={formatFlowMoney(bucket.knownOutflow, locale, "−")}
              tone={bucket.flowComplete ? "text-destructive" : "text-warning"}
            />
            <MiniValue
              label="Change"
              value={formatMoney(bucket.knownDelta, locale)}
              tone={moneyTone(bucket.knownDelta, bucket.deltaComplete)}
            />
            <MiniValue label="Total value" value={formatMoney(bucket.knownNetWorth, locale)} />
          </div>
        </button>
      ))}
    </div>
  );
}

function MonthGrid({
  buckets,
  locale,
  onOpen,
}: {
  buckets: readonly CalendarBucketView[];
  locale: string;
  onOpen: (bucket: CalendarBucketView) => void;
}) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [detailed, setDetailed] = useState<boolean | null>(null);
  const showDetails = detailed ?? !isMobile;
  const first = buckets[0]?.start;
  const offset = first ? (first.getDay() + 6) % 7 : 0;
  const trailing = (7 - ((offset + buckets.length) % 7)) % 7;
  const heatmapScale = calendarHeatmapScale(buckets);
  const cells: Array<CalendarBucketView | null> = [
    ...Array.from({ length: offset }, () => null),
    ...buckets,
    ...Array.from({ length: trailing }, () => null),
  ];
  const cellHeight = showDetails
    ? "min-h-[92px] sm:min-h-[112px]"
    : "min-h-[58px] sm:min-h-[68px]";

  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          aria-pressed={showDetails}
          onClick={() => setDetailed(!showDetails)}
        >
          {showDetails ? (
            <Minimize2 className="mr-2 h-4 w-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {t(showDetails ? "Hide details" : "Show details")}
        </Button>
      </div>

      <div className="w-full overflow-hidden rounded-2xl border border-border/55 bg-card/10">
        <div className="grid grid-cols-7 border-b border-border/55 bg-muted/20 text-center text-[9px] uppercase tracking-[0.12em] text-muted-foreground sm:text-[10px]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, index) => (
            <div
              key={label}
              className={cn("min-w-0 px-0.5 py-2", index < 6 && "border-r border-border/35")}
            >
              {t(label)}
            </div>
          ))}
        </div>
        <div className="grid w-full grid-cols-7">
          {cells.map((bucket, index) => {
            const lastColumn = index % 7 === 6;
            const lastRow = index >= cells.length - 7;
            const cellBorder = cn(
              !lastColumn && "border-r border-border/35",
              !lastRow && "border-b border-border/35",
            );

            if (!bucket) {
              return (
                <div
                  key={`blank-${index}`}
                  className={cn(
                    "bg-muted/[0.012] transition-[min-height] duration-300 ease-out motion-reduce:transition-none",
                    cellHeight,
                    cellBorder,
                  )}
                  aria-hidden="true"
                />
              );
            }

            const showIncome = hasMoney(bucket.knownInflow);
            const showExpense = hasMoney(bucket.knownOutflow);
            const showDelta = hasMoney(bucket.knownDelta) || bucket.eventCount > 0;
            const visual = calendarDeltaVisual(bucket, heatmapScale);

            return (
              <button
                type="button"
                key={bucket.key}
                onClick={() => onOpen(bucket)}
                className={cn(
                  "flex min-w-0 flex-col p-1.5 text-left transition-[filter,min-height] duration-300 ease-out sm:p-2.5",
                  cellHeight,
                  calendarSurfaceClass(visual),
                  cellBorder,
                  bucket.future && "opacity-45",
                  "hover:brightness-110 motion-reduce:transition-none focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan/50",
                )}
                title={[
                  `${t("Income")}: ${formatMoney(bucket.knownInflow, locale)}`,
                  `${t("Expense")}: ${formatMoney(bucket.knownOutflow, locale)}`,
                  `${t("Change")}: ${formatMoney(bucket.knownDelta, locale)}`,
                ].join(" · ")}
              >
                <div className="flex w-full items-start justify-between gap-1">
                  <span className="font-mono text-[11px] font-semibold text-foreground sm:text-xs">
                    {bucket.start.getDate()}
                  </span>
                  <div className="flex items-center gap-1">
                    {!bucket.future && (!bucket.deltaComplete || !bucket.flowComplete) ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-warning"
                        aria-label={t("Incomplete change data")}
                      />
                    ) : null}
                    {bucket.eventCount > 0 && showDetails ? (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted/60 px-1 font-mono text-[8px] text-muted-foreground">
                        {bucket.eventCount}
                      </span>
                    ) : null}
                  </div>
                </div>

                {!bucket.future && showDelta ? (
                  <div
                    className={cn(
                      "mt-auto w-full truncate pt-1 font-mono text-[10px] font-semibold leading-tight sm:text-xs",
                      moneyTone(bucket.knownDelta, bucket.deltaComplete),
                    )}
                  >
                    {formatCompactSignedMoney(bucket.knownDelta, locale)}
                  </div>
                ) : null}

                {!bucket.future ? (
                  <div
                    className={cn(
                      "grid w-full transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
                      showDetails && (showIncome || showExpense || bucket.eventCount > 0)
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                    )}
                    aria-hidden={!showDetails}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="space-y-0.5 pt-1 font-mono text-[8px] leading-tight sm:text-[10px]">
                        {showIncome ? (
                          <div
                            className={cn(
                              "truncate",
                              bucket.flowComplete ? "text-success" : "text-warning",
                            )}
                          >
                            +{formatCompactMoney(bucket.knownInflow, locale)}
                          </div>
                        ) : null}
                        {showExpense ? (
                          <div
                            className={cn(
                              "truncate",
                              bucket.flowComplete ? "text-destructive" : "text-warning",
                            )}
                          >
                            −{formatCompactMoney(bucket.knownOutflow, locale)}
                          </div>
                        ) : null}
                        {bucket.eventCount > 0 ? (
                          <div className="truncate text-muted-foreground">
                            {bucket.eventCount}{" "}
                            {t(bucket.eventCount === 1 ? "transaction" : "transactions")}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function DayPanel({
  events,
  locale,
  ownedAccountIds,
}: {
  events: readonly TransactionView[];
  locale: string;
  ownedAccountIds: ReadonlySet<string>;
}) {
  const { t } = useI18n();
  return (
    <div className="surface-section p-4 sm:p-5">
      <h3 className="font-display font-semibold">{t("Transactions")}</h3>
      <div className="mt-4">
        <EventList events={events} locale={locale} ownedAccountIds={ownedAccountIds} />
      </div>
    </div>
  );
}

function EventList({
  events,
  locale,
  ownedAccountIds,
}: {
  events: readonly TransactionView[];
  locale: string;
  ownedAccountIds: ReadonlySet<string>;
}) {
  const { t } = useI18n();
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
        {t("No transactions recorded in this period.")}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {events.map((event) => (
        <article key={event.id} className="rounded-xl border border-border/50 bg-muted/10 p-4">
          <TransactionSummaryRow
            transaction={event}
            locale={locale}
            maxMovements={3}
            ownedAccountIds={ownedAccountIds}
          />
        </article>
      ))}
    </div>
  );

}

function hasMoney(value: Money | null): boolean {
  return value !== null && !value.amount.isZero();
}

function formatCompactNumber(value: number, locale: string): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(absolute / 1_000_000)}M`;
  }
  if (absolute >= 1_000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(absolute / 1_000)}k`;
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: absolute < 10 ? 1 : 0 }).format(
    absolute,
  );
}

function formatCompactMoney(value: Money | null, locale: string): string {
  if (!value) return "—";
  return formatCompactNumber(Number(value.amount.toString()), locale);
}

function formatCompactSignedMoney(value: Money | null, locale: string): string {
  if (!value) return "—";
  const numeric = Number(value.amount.toString());
  if (numeric === 0) return "0";
  return `${numeric > 0 ? "+" : "−"}${formatCompactNumber(numeric, locale)}`;
}

function formatFlowMoney(value: Money | null, locale: string, prefix: string): string {
  if (!value) return "—";
  if (value.amount.isZero()) return formatMoney(value, locale);
  return `${prefix}${formatMoney(value, locale)}`;
}

function MiniValue({
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
    <div className="min-w-0">
      <div className="truncate label-muted">{t(label)}</div>
      <div className={cn("mt-1 truncate font-mono text-sm", tone)}>{value}</div>
    </div>
  );
}

function bucketLabel(scope: CalendarScope, date: Date, locale: string): string {
  if (scope === "year" || scope === "quarter") {
    return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
  }
  return date.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
