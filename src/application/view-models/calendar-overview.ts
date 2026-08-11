import type { Money } from "../../domain/core";
import { replayLedger } from "../../domain/ledger";
import { valueLedger, type LedgerValuation } from "../../domain/valuation";
import type { TransactionView, WealthOverview } from "./wealth-overview";

export const CALENDAR_SCOPES = ["day", "week", "month", "quarter", "year"] as const;
export type CalendarScope = (typeof CALENDAR_SCOPES)[number];

export type CalendarRange = Readonly<{
  start: Date;
  end: Date;
}>;

export type CalendarValuationView = Readonly<{
  knownNetWorth: Money;
  complete: boolean;
  knownPositionCount: number;
  totalPositionCount: number;
  unknownPositionCount: number;
}>;

export type CalendarBucketView = Readonly<{
  key: string;
  start: Date;
  end: Date;
  eventCount: number;
  correctionCount: number;
  knownNetWorth: Money | null;
  knownDelta: Money | null;
  valuationComplete: boolean;
  deltaComplete: boolean;
  unknownPositionCount: number;
}>;

export type CalendarOverview = Readonly<{
  scope: CalendarScope;
  range: CalendarRange;
  activeYears: readonly number[];
  events: readonly TransactionView[];
  selectedDayEvents: readonly TransactionView[];
  buckets: readonly CalendarBucketView[];
  startValuation: CalendarValuationView | null;
  endValuation: CalendarValuationView | null;
  knownDelta: Money | null;
  deltaComplete: boolean;
}>;

export type BuildCalendarOverviewInput = Readonly<{
  scope: CalendarScope;
  anchor: Date;
  selectedDay?: Date | null;
}>;

function validDate(date: Date): Date {
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Calendar requires a valid date.");
  }
  return date;
}

export function startOfCalendarDay(date: Date): Date {
  validDate(date);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addCalendarDays(date: Date, amount: number): Date {
  validDate(date);
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function addCalendarMonths(date: Date, amount: number): Date {
  validDate(date);
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfCalendarWeek(date: Date): Date {
  const day = startOfCalendarDay(date);
  const mondayOffset = (day.getDay() + 6) % 7;
  return addCalendarDays(day, -mondayOffset);
}

function startOfCalendarMonth(date: Date): Date {
  validDate(date);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfCalendarQuarter(date: Date): Date {
  validDate(date);
  const month = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), month, 1);
}

function startOfCalendarYear(date: Date): Date {
  validDate(date);
  return new Date(date.getFullYear(), 0, 1);
}

export function calendarRange(scope: CalendarScope, anchor: Date): CalendarRange {
  switch (scope) {
    case "day": {
      const start = startOfCalendarDay(anchor);
      return Object.freeze({ start, end: addCalendarDays(start, 1) });
    }
    case "week": {
      const start = startOfCalendarWeek(anchor);
      return Object.freeze({ start, end: addCalendarDays(start, 7) });
    }
    case "month": {
      const start = startOfCalendarMonth(anchor);
      return Object.freeze({ start, end: addCalendarMonths(start, 1) });
    }
    case "quarter": {
      const start = startOfCalendarQuarter(anchor);
      return Object.freeze({ start, end: addCalendarMonths(start, 3) });
    }
    case "year": {
      const start = startOfCalendarYear(anchor);
      return Object.freeze({ start, end: new Date(start.getFullYear() + 1, 0, 1) });
    }
  }
}

function dateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function eventsInRange(
  events: readonly TransactionView[],
  range: CalendarRange,
): readonly TransactionView[] {
  const start = range.start.getTime();
  const end = range.end.getTime();
  return Object.freeze(
    events.filter((event) => {
      const occurredAt = Date.parse(event.occurredAt);
      return Number.isFinite(occurredAt) && occurredAt >= start && occurredAt < end;
    }),
  );
}

function valuationAt(overview: WealthOverview, cutoff: Date): LedgerValuation | null {
  const baseCurrency = overview.baseCurrency;
  if (!baseCurrency) return null;

  const cutoffMilliseconds = validDate(cutoff).getTime();
  const state = overview.state;
  const candidates = state.transactions.filter(
    (transaction) => transaction.occurredAt.toEpochMilliseconds() < cutoffMilliseconds,
  );
  const candidateIds = new Set(candidates.map((transaction) => transaction.id.toString()));
  const transactions = candidates.filter(
    (transaction) =>
      transaction.purpose === "standard" ||
      (transaction.relatedTransactionId !== null &&
        candidateIds.has(transaction.relatedTransactionId.toString())),
  );
  const snapshot = replayLedger({
    accounts: state.accounts,
    assets: state.assets,
    transactions,
  });

  return valueLedger({
    snapshot,
    accounts: state.accounts,
    assets: state.assets,
    baseCurrency,
    priceQuotes: state.priceQuotes.filter(
      (quote) => quote.asOf.toEpochMilliseconds() < cutoffMilliseconds,
    ),
    fxRates: state.fxRates.filter((rate) => rate.asOf.toEpochMilliseconds() < cutoffMilliseconds),
  });
}

function valuationView(valuation: LedgerValuation | null): CalendarValuationView | null {
  if (!valuation) return null;
  return Object.freeze({
    knownNetWorth: valuation.knownTotal,
    complete: valuation.complete,
    knownPositionCount: valuation.knownPositionCount,
    totalPositionCount: valuation.totalPositionCount,
    unknownPositionCount: valuation.totalPositionCount - valuation.knownPositionCount,
  });
}

function knownDelta(
  start: CalendarValuationView | null,
  end: CalendarValuationView | null,
): Money | null {
  if (!start || !end) return null;
  return end.knownNetWorth.minus(start.knownNetWorth);
}

function bucketRanges(scope: CalendarScope, anchor: Date): readonly CalendarRange[] {
  const range = calendarRange(scope, anchor);
  const result: CalendarRange[] = [];

  if (scope === "year") {
    for (let month = 0; month < 12; month += 1) {
      const start = new Date(range.start.getFullYear(), month, 1);
      result.push(Object.freeze({ start, end: addCalendarMonths(start, 1) }));
    }
    return Object.freeze(result);
  }

  if (scope === "quarter") {
    for (let month = 0; month < 3; month += 1) {
      const start = addCalendarMonths(range.start, month);
      result.push(Object.freeze({ start, end: addCalendarMonths(start, 1) }));
    }
    return Object.freeze(result);
  }

  if (scope === "month" || scope === "week") {
    let cursor = range.start;
    while (cursor.getTime() < range.end.getTime()) {
      const end = addCalendarDays(cursor, 1);
      result.push(Object.freeze({ start: cursor, end }));
      cursor = end;
    }
    return Object.freeze(result);
  }

  return Object.freeze([range]);
}

function activeYears(overview: WealthOverview, anchor: Date): readonly number[] {
  const years = new Set<number>([anchor.getFullYear()]);
  for (const event of overview.transactions) {
    const date = new Date(event.occurredAt);
    if (Number.isFinite(date.getTime())) years.add(date.getFullYear());
  }
  return Object.freeze([...years].sort((left, right) => left - right));
}

export function buildCalendarOverview(
  overview: WealthOverview,
  input: BuildCalendarOverviewInput,
): CalendarOverview {
  validDate(input.anchor);
  const range = calendarRange(input.scope, input.anchor);
  const startValuation = valuationView(valuationAt(overview, range.start));
  const endValuation = valuationView(valuationAt(overview, range.end));
  const buckets = bucketRanges(input.scope, input.anchor).map((bucket) => {
    const bucketStart = valuationView(valuationAt(overview, bucket.start));
    const bucketEnd = valuationView(valuationAt(overview, bucket.end));
    const bucketEvents = eventsInRange(overview.transactions, bucket);

    return Object.freeze({
      key: dateKey(bucket.start),
      start: bucket.start,
      end: bucket.end,
      eventCount: bucketEvents.length,
      correctionCount: bucketEvents.filter((event) => event.purpose !== "standard").length,
      knownNetWorth: bucketEnd?.knownNetWorth ?? null,
      knownDelta: knownDelta(bucketStart, bucketEnd),
      valuationComplete: bucketEnd?.complete ?? false,
      deltaComplete: Boolean(bucketStart?.complete && bucketEnd?.complete),
      unknownPositionCount: bucketEnd?.unknownPositionCount ?? 0,
    });
  });

  const selectedDayRange = input.selectedDay ? calendarRange("day", input.selectedDay) : null;

  return Object.freeze({
    scope: input.scope,
    range,
    activeYears: activeYears(overview, input.anchor),
    events: eventsInRange(overview.transactions, range),
    selectedDayEvents: selectedDayRange
      ? eventsInRange(overview.transactions, selectedDayRange)
      : Object.freeze([]),
    buckets: Object.freeze(buckets),
    startValuation,
    endValuation,
    knownDelta: knownDelta(startValuation, endValuation),
    deltaComplete: Boolean(startValuation?.complete && endValuation?.complete),
  });
}
