import { MetricCard, metricToneFromClass } from "@/components/MetricCard";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";
import { useMemo } from "react";
import {
  CALENDAR_SCOPES,
  addCalendarDays,
  addCalendarMonths,
  buildCalendarOverview,
  type CalendarBucketView,
  type CalendarScope,
  type TransactionView,
} from "@/application/view-models";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Decimal, type Money } from "@/domain/core";
import { FinancialError, FinancialLoading } from "@/features/wealth-v2/FinancialStatePanel";
import { formatDateTime, formatMoney, formatQuantity, humanize } from "@/features/wealth-v2/format";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
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
    const view = CALENDAR_SCOPES.includes(rawView as CalendarScope)
      ? (rawView as CalendarScope)
      : "year";

    return {
      view,
      anchor: isDateKey(search.anchor) ? search.anchor : undefined,
      day: isDateKey(search.day) ? search.day : undefined,
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

function moneyTone(value: Money | null): string {
  if (!value) return "text-muted-foreground";
  const comparison = value.amount.compare(Decimal.zero());
  if (comparison > 0) return "text-success";
  if (comparison < 0) return "text-destructive";
  return "text-foreground";
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
  const navigate = useNavigate({ from: "/calendar" });
  const { view = "year", anchor, day } = useSearch({ from: "/calendar" });
  const anchorDate = useMemo(() => parseDateKey(anchor) ?? new Date(), [anchor]);
  const selectedDay = useMemo(() => parseDateKey(day), [day]);

  const workspace = useMemo(() => {
    if (!financial.data) return null;
    return buildCalendarOverview(financial.data, {
      scope: view,
      anchor: anchorDate,
      selectedDay,
    });
  }, [financial.data, view, anchorDate, selectedDay]);

  if (financial.isLoading) return <FinancialLoading />;
  if (financial.error || !financial.data || !workspace) {
    return <FinancialError error={financial.error} retry={() => void financial.refetch()} />;
  }

  const locale = financial.data.state.profile?.locale ?? "en-US";

  const updateSearch = (patch: Partial<CalendarSearch>) => {
    void navigate({
      search: (previous: CalendarSearch) => ({ ...previous, ...patch }),
    });
  };

  const setAnchor = (date: Date) => {
    updateSearch({ anchor: dateKey(date), day: undefined });
  };

  const setView = (next: CalendarScope) => {
    updateSearch({ view: next, anchor: dateKey(anchorDate), day: undefined });
  };

  const shift = (direction: -1 | 1) => {
    if (view === "day") return setAnchor(addCalendarDays(anchorDate, direction));
    if (view === "week") return setAnchor(addCalendarDays(anchorDate, direction * 7));
    if (view === "month") return setAnchor(addCalendarMonths(anchorDate, direction));
    if (view === "quarter") return setAnchor(addCalendarMonths(anchorDate, direction * 3));
    setAnchor(new Date(anchorDate.getFullYear() + direction, 0, 1));
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

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Calendar"
        subtitle="Your financial activity day by day, including any corrections you have recorded."
        action={
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => updateSearch({ anchor: dateKey(new Date()), day: undefined })}
          >
            <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
            Today
          </Button>
        }
      />

      <ScopeSwitcher value={view} onChange={setView} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={() => shift(-1)}
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={() => shift(1)}
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="min-w-0 truncate font-display text-xl font-semibold sm:text-2xl">
            {periodTitle(view, anchorDate, locale)}
          </h2>
        </div>

        <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
          {workspace.activeYears.map((year) => (
            <button
              type="button"
              key={year}
              onClick={() =>
                setAnchor(new Date(year, view === "year" ? 0 : anchorDate.getMonth(), 1))
              }
              className={cn(
                "min-h-11 shrink-0 rounded-lg px-3 font-mono text-xs transition-colors",
                year === anchorDate.getFullYear()
                  ? "bg-cyan/10 text-cyan ring-1 ring-cyan/30"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <SummaryGrid
        endNetWorth={workspace.endValuation?.knownNetWorth ?? null}
        delta={workspace.knownDelta}
        eventCount={workspace.events.length}
        knownPositions={workspace.endValuation?.knownPositionCount ?? 0}
        totalPositions={workspace.endValuation?.totalPositionCount ?? 0}
        complete={workspace.endValuation?.complete ?? false}
        deltaComplete={workspace.deltaComplete}
        locale={locale}
      />

      {view === "month" ? (
        <MonthGrid buckets={workspace.buckets} locale={locale} onOpen={openBucket} />
      ) : view === "day" ? (
        <DayPanel events={workspace.events} locale={locale} />
      ) : (
        <BucketGrid scope={view} buckets={workspace.buckets} locale={locale} onOpen={openBucket} />
      )}

      <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <History className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
          <p className="leading-6">
            Historical values use only market observations recorded before each cutoff. A partial
            value is shown as known net worth with an explicit incomplete marker; missing valuation
            is never converted to zero.
          </p>
        </div>
      </div>

      <Sheet
        open={selectedDay !== null}
        onOpenChange={(open) => {
          if (!open) updateSearch({ day: undefined });
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[88dvh] overflow-y-auto rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="text-left">
            <SheetTitle>
              {selectedDay
                ? selectedDay.toLocaleDateString(locale, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Day activity"}
            </SheetTitle>
            <SheetDescription>Everything recorded on this day.</SheetDescription>
          </SheetHeader>
          <div className="mt-5">
            <EventList events={workspace.selectedDayEvents} locale={locale} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ScopeSwitcher({
  value,
  onChange,
}: {
  value: CalendarScope;
  onChange: (value: CalendarScope) => void;
}) {
  const labels: Record<CalendarScope, string> = {
    day: "Day",
    week: "Week",
    month: "Month",
    quarter: "Quarter",
    year: "Year",
  };

  return (
    <div className="grid grid-cols-5 gap-1 rounded-2xl border border-border/50 bg-muted/20 p-1">
      {CALENDAR_SCOPES.map((scope) => (
        <button
          type="button"
          key={scope}
          onClick={() => onChange(scope)}
          className={cn(
            "min-h-11 min-w-0 rounded-xl px-1 text-[11px] font-medium transition-colors sm:text-sm",
            value === scope
              ? "bg-cyan/10 text-cyan ring-1 ring-cyan/30"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
          )}
        >
          <span className="block truncate">{labels[scope]}</span>
        </button>
      ))}
    </div>
  );
}

function SummaryGrid({
  endNetWorth,
  delta,
  eventCount,
  knownPositions,
  totalPositions,
  complete,
  deltaComplete,
  locale,
}: {
  endNetWorth: Money | null;
  delta: Money | null;
  eventCount: number;
  knownPositions: number;
  totalPositions: number;
  complete: boolean;
  deltaComplete: boolean;
  locale: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard
        label="Known net worth"
        value={formatMoney(endNetWorth, locale)}
        hint={complete ? "Complete valuation" : "Partial valuation"}
      />
      <SummaryCard
        label="Known delta"
        value={formatMoney(delta, locale)}
        hint={deltaComplete ? "Complete period delta" : "Partial period delta"}
        tone={moneyTone(delta)}
        icon={delta?.amount.compare(Decimal.zero()) === -1 ? ArrowDownRight : ArrowUpRight}
      />
      <SummaryCard label="Ledger events" value={String(eventCount)} hint="Economic-date events" />
      <SummaryCard
        label="Valuation coverage"
        value={`${knownPositions}/${totalPositions}`}
        hint={complete ? "No unknown positions" : "Unknown positions remain"}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "text-foreground",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
  icon?: typeof ArrowUpRight;
}) {
  return (
    <MetricCard
      label={label}
      value={value}
      hint={hint}
      icon={Icon}
      tone={metricToneFromClass(tone)}
    />
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
  const columns = scope === "year" ? "md:grid-cols-3 xl:grid-cols-4" : "md:grid-cols-3";

  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", columns)}>
      {buckets.map((bucket) => (
        <button
          type="button"
          key={bucket.key}
          onClick={() => onOpen(bucket)}
          className="surface-section surface-interactive min-w-0 p-4 text-left transition-colors hover:border-cyan/35 hover:bg-cyan/[0.03]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-display font-semibold">
                {bucketLabel(scope, bucket.start, locale)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {bucket.eventCount} event{bucket.eventCount === 1 ? "" : "s"}
                {bucket.correctionCount > 0 ? ` · ${bucket.correctionCount} correction` : ""}
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-1 text-[10px]",
                bucket.valuationComplete
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning",
              )}
            >
              {bucket.valuationComplete ? "complete" : "partial"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniValue label="Known net worth" value={formatMoney(bucket.knownNetWorth, locale)} />
            <MiniValue
              label="Known delta"
              value={formatMoney(bucket.knownDelta, locale)}
              tone={moneyTone(bucket.knownDelta)}
            />
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
  const first = buckets[0]?.start;
  const offset = first ? (first.getDay() + 6) % 7 : 0;
  const cells: Array<CalendarBucketView | null> = [
    ...Array.from({ length: offset }, () => null),
    ...buckets,
  ];

  return (
    <div className="surface-section p-2 sm:p-4">
      <div className="overflow-x-auto">
        <div className="min-w-[340px]">
          <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[9px] uppercase tracking-wider text-muted-foreground sm:text-[10px]">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
              <div key={label} className="min-w-0 truncate px-0.5 py-1">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((bucket, index) =>
              bucket ? (
                <button
                  type="button"
                  key={bucket.key}
                  onClick={() => onOpen(bucket)}
                  className={cn(
                    "min-h-16 min-w-0 rounded-lg border p-1.5 text-left transition-colors sm:min-h-24 sm:p-2",
                    bucket.eventCount > 0
                      ? "border-cyan/20 bg-cyan/[0.04] hover:border-cyan/40"
                      : "border-border/30 bg-muted/10 hover:bg-muted/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-mono text-xs">{bucket.start.getDate()}</span>
                    {bucket.eventCount > 0 ? (
                      <span className="rounded-full bg-cyan/10 px-1.5 py-0.5 text-[9px] text-cyan">
                        {bucket.eventCount}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "mt-2 hidden truncate font-mono text-[10px] sm:block",
                      moneyTone(bucket.knownDelta),
                    )}
                  >
                    {formatMoney(bucket.knownDelta, locale)}
                  </div>
                  {!bucket.valuationComplete && bucket.knownNetWorth ? (
                    <div
                      className="mt-1 h-1.5 w-1.5 rounded-full bg-warning"
                      aria-label="Partial valuation"
                    />
                  ) : null}
                </button>
              ) : (
                <div key={`blank-${index}`} className="min-h-16 sm:min-h-24" aria-hidden="true" />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayPanel({ events, locale }: { events: readonly TransactionView[]; locale: string }) {
  return (
    <div className="surface-section p-4 sm:p-5">
      <h3 className="font-display font-semibold">Day activity</h3>
      <div className="mt-4">
        <EventList events={events} locale={locale} />
      </div>
    </div>
  );
}

function EventList({ events, locale }: { events: readonly TransactionView[]; locale: string }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
        No activity recorded in this period.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <article key={event.id} className="rounded-xl border border-border/50 bg-muted/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="break-words font-medium">{event.description}</h4>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(event.occurredAt, locale)}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <span className="rounded-full bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">
                {humanize(event.purpose)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-[10px]",
                  event.state === "active"
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning",
                )}
              >
                {humanize(event.state)}
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {event.legs.map((leg) => (
              <div
                key={leg.id}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg bg-background/40 px-3 py-2 text-xs"
              >
                <div className="min-w-0 truncate text-muted-foreground">
                  {leg.accountName} · {leg.assetSymbol}
                </div>
                <div className="max-w-[46vw] truncate font-mono text-foreground sm:max-w-none">
                  {formatQuantity(leg.quantity)}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
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
  return (
    <div className="min-w-0">
      <div className="truncate label-muted">
        {label}
      </div>
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
