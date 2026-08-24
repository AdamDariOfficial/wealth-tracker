import { Account } from "../../domain/accounts";
import type { Asset } from "../../domain/assets";
import { Money } from "../../domain/core";
import { LedgerTransaction, replayLedger } from "../../domain/ledger";
import { valueLedger, type LedgerValuation } from "../../domain/valuation";
import { valuationAt } from "./historical-valuation";
import type { TransactionView, WealthOverview } from "./wealth-overview";

export const CALENDAR_SCOPES = ["day", "week", "month", "quarter", "year"] as const;
export type CalendarScope = (typeof CALENDAR_SCOPES)[number];

export type CalendarRange = Readonly<{
  start: Date;
  end: Date;
}>;

export type CalendarValuationIssue = Readonly<{
  key: string;
  reason: "missing-price" | "missing-fx-rate";
  assetId: string;
  assetSymbol: string;
  assetName: string;
  sourceCurrency: string | null;
  targetCurrency: string | null;
}>;

export type CalendarValuationView = Readonly<{
  knownNetWorth: Money;
  complete: boolean;
  knownPositionCount: number;
  totalPositionCount: number;
  unknownPositionCount: number;
  issues: readonly CalendarValuationIssue[];
}>;

export type CalendarBucketView = Readonly<{
  key: string;
  start: Date;
  end: Date;
  eventCount: number;
  correctionCount: number;
  knownNetWorth: Money | null;
  knownDelta: Money | null;
  knownInflow: Money | null;
  knownOutflow: Money | null;
  flowComplete: boolean;
  valuationComplete: boolean;
  deltaComplete: boolean;
  unknownPositionCount: number;
  issues: readonly CalendarValuationIssue[];
  future: boolean;
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
  diagnostics: readonly CalendarValuationIssue[];
}>;

export type BuildCalendarOverviewInput = Readonly<{
  scope: CalendarScope;
  anchor: Date;
  selectedDay?: Date | null;
  now?: Date;
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

function valuationIssues(
  valuation: LedgerValuation,
  assetById: ReadonlyMap<string, Asset>,
): readonly CalendarValuationIssue[] {
  const issues = new Map<string, CalendarValuationIssue>();
  for (const position of valuation.positions) {
    if (position.status !== "unknown") continue;
    const asset = assetById.get(position.assetId.toString());
    if (!asset) continue;
    const sourceCurrency =
      position.reason === "missing-fx-rate" ? (position.quoteCurrency?.toString() ?? null) : null;
    const targetCurrency =
      position.reason === "missing-fx-rate" ? valuation.baseCurrency.toString() : null;
    const key = [
      position.reason,
      asset.id.toString(),
      sourceCurrency ?? "",
      targetCurrency ?? "",
    ].join(":");
    issues.set(
      key,
      Object.freeze({
        key,
        reason: position.reason,
        assetId: asset.id.toString(),
        assetSymbol: asset.symbol,
        assetName: asset.name,
        sourceCurrency,
        targetCurrency,
      }),
    );
  }
  return Object.freeze([...issues.values()]);
}

function valuationView(
  valuation: LedgerValuation | null,
  assetById: ReadonlyMap<string, Asset>,
): CalendarValuationView | null {
  if (!valuation) return null;
  return Object.freeze({
    knownNetWorth: valuation.knownTotal,
    complete: valuation.complete,
    knownPositionCount: valuation.knownPositionCount,
    totalPositionCount: valuation.totalPositionCount,
    unknownPositionCount: valuation.totalPositionCount - valuation.knownPositionCount,
    issues: valuationIssues(valuation, assetById),
  });
}

function knownDelta(
  start: CalendarValuationView | null,
  end: CalendarValuationView | null,
): Money | null {
  if (!start || !end) return null;
  return end.knownNetWorth.minus(start.knownNetWorth);
}

function rangeCutoff(range: CalendarRange, now: Date): Date | null {
  if (range.start.getTime() > now.getTime()) return null;
  return range.end.getTime() > now.getTime() ? new Date(now.getTime()) : range.end;
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

type CalendarFlowSummary = Readonly<{
  knownInflow: Money | null;
  knownOutflow: Money | null;
  complete: boolean;
}>;

function calendarFlowSummary(
  overview: WealthOverview,
  events: readonly TransactionView[],
): CalendarFlowSummary {
  const baseCurrency = overview.baseCurrency;
  if (!baseCurrency) {
    return Object.freeze({ knownInflow: null, knownOutflow: null, complete: false });
  }

  const accountById = new Map(
    overview.state.accounts.map((account) => [account.id.toString(), account]),
  );
  const transactionById = new Map(
    overview.state.transactions.map((transaction) => [transaction.id.toString(), transaction]),
  );
  const valuationAccounts = overview.state.accounts.map((account) =>
    account.ownership === "owned" && !account.includeInNetWorth
      ? Account.create({
          id: account.id,
          name: account.name,
          kind: account.kind,
          ownership: account.ownership,
          includeInNetWorth: true,
          openedAt: account.openedAt,
          archivedAt: account.archivedAt,
        })
      : account,
  );

  let knownInflow = Money.zero(baseCurrency);
  let knownOutflow = Money.zero(baseCurrency);
  let complete = true;

  for (const event of events) {
    if (event.state !== "active" && event.state !== "replacement") continue;

    const systemKinds = new Set(
      event.legs
        .map((leg) => accountById.get(leg.accountId)?.kind ?? null)
        .filter((kind): kind is "income" | "expense" => kind === "income" || kind === "expense"),
    );
    if (systemKinds.size !== 1) continue;
    const flowKind = systemKinds.has("income") ? "income" : "expense";

    const source = transactionById.get(event.id);
    if (!source) continue;
    const transaction =
      event.state === "replacement"
        ? LedgerTransaction.create({
            id: source.id,
            occurredAt: source.occurredAt,
            recordedAt: source.recordedAt,
            description: source.description,
            purpose: "standard",
            legs: source.legs,
          })
        : source;

    const snapshot = replayLedger({
      accounts: valuationAccounts,
      assets: overview.state.assets,
      transactions: [transaction],
    });
    const cutoff = transaction.occurredAt.toEpochMilliseconds() + 1;
    const valuation = valueLedger({
      snapshot,
      accounts: valuationAccounts,
      assets: overview.state.assets,
      baseCurrency,
      priceQuotes: overview.state.priceQuotes.filter(
        (quote) => quote.asOf.toEpochMilliseconds() < cutoff,
      ),
      fxRates: overview.state.fxRates.filter((rate) => rate.asOf.toEpochMilliseconds() < cutoff),
    });
    complete = complete && valuation.complete;
    const amount = Money.of(valuation.knownTotal.amount.abs(), valuation.knownTotal.currency);
    if (flowKind === "income") knownInflow = knownInflow.plus(amount);
    else knownOutflow = knownOutflow.plus(amount);
  }

  return Object.freeze({ knownInflow, knownOutflow, complete });
}
function mergeIssues(
  ...sets: readonly (readonly CalendarValuationIssue[])[]
): readonly CalendarValuationIssue[] {
  const result = new Map<string, CalendarValuationIssue>();
  for (const issues of sets) {
    for (const issue of issues) result.set(issue.key, issue);
  }
  return Object.freeze([...result.values()]);
}

export function buildCalendarOverview(
  overview: WealthOverview,
  input: BuildCalendarOverviewInput,
): CalendarOverview {
  validDate(input.anchor);
  const now = validDate(input.now ?? new Date());
  const assetById = new Map(overview.state.assets.map((asset) => [asset.id.toString(), asset]));
  const range = calendarRange(input.scope, input.anchor);
  const endCutoff = rangeCutoff(range, now);
  const startValuation =
    range.start.getTime() <= now.getTime()
      ? valuationView(valuationAt(overview, range.start), assetById)
      : null;
  const endValuation = endCutoff
    ? valuationView(valuationAt(overview, endCutoff), assetById)
    : null;
  const buckets = bucketRanges(input.scope, input.anchor).map((bucket) => {
    const future = bucket.start.getTime() > now.getTime();
    const bucketCutoff = rangeCutoff(bucket, now);
    const bucketStart = future
      ? null
      : valuationView(valuationAt(overview, bucket.start), assetById);
    const bucketEnd = bucketCutoff
      ? valuationView(valuationAt(overview, bucketCutoff), assetById)
      : null;
    const bucketEvents = eventsInRange(overview.transactions, bucket);
    const flow = future
      ? Object.freeze({ knownInflow: null, knownOutflow: null, complete: false })
      : calendarFlowSummary(overview, bucketEvents);

    return Object.freeze({
      key: dateKey(bucket.start),
      start: bucket.start,
      end: bucket.end,
      eventCount: bucketEvents.length,
      correctionCount: bucketEvents.filter((event) => event.purpose !== "standard").length,
      knownNetWorth: bucketEnd?.knownNetWorth ?? null,
      knownDelta: knownDelta(bucketStart, bucketEnd),
      knownInflow: flow.knownInflow,
      knownOutflow: flow.knownOutflow,
      flowComplete: flow.complete,
      valuationComplete: bucketEnd?.complete ?? false,
      deltaComplete: Boolean(bucketStart?.complete && bucketEnd?.complete),
      unknownPositionCount: bucketEnd?.unknownPositionCount ?? 0,
      issues: mergeIssues(bucketStart?.issues ?? [], bucketEnd?.issues ?? []),
      future,
    });
  });

  const selectedDayRange = input.selectedDay ? calendarRange("day", input.selectedDay) : null;
  const diagnostics = mergeIssues(
    startValuation?.issues ?? [],
    endValuation?.issues ?? [],
    ...buckets.map((bucket) => bucket.issues),
  );

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
    diagnostics,
  });
}
