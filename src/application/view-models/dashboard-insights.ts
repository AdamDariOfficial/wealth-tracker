import type { Money } from "../../domain/core";
import { valuationAt } from "./historical-valuation";
import type { AccountView, AllocationView, WealthOverview } from "./wealth-overview";

/**
 * Dashboard derivations.
 *
 * Every figure below comes from the same canonical sources the rest of the
 * product uses — the replayed ledger, canonical valuation and the account
 * views. Nothing here invents a performance metric, a forecast or a stored
 * total: the trend is a series of point-in-time canonical valuations, and the
 * activity series is an exact count of recorded transactions per period.
 */

export type NetWorthPointView = Readonly<{
  /** Stable `YYYY-MM` identity for the period this point closes. */
  key: string;
  /** First instant of the period. */
  start: Date;
  /** Cutoff actually valued — never later than `now`. */
  at: Date;
  knownNetWorth: Money | null;
  valuationComplete: boolean;
  unknownPositionCount: number;
}>;

export type ActivityBucketView = Readonly<{
  key: string;
  start: Date;
  end: Date;
  /** Exact count of transactions recorded in the period. */
  eventCount: number;
  /** Of which are corrections (reversals/replacements). */
  correctionCount: number;
}>;

export type AccountValueView = Readonly<{
  id: string;
  name: string;
  kind: AccountView["kind"];
  knownValue: Money;
  unknownPositionCount: number;
}>;

export type DashboardInsights = Readonly<{
  baseCurrency: string | null;
  /** Month-close valuations, oldest first. Empty when there is no history. */
  netWorthTrend: readonly NetWorthPointView[];
  /** True only when every plotted point valued every position it held. */
  trendComplete: boolean;
  /** Current composition by asset class, canonical amounts. */
  composition: readonly AllocationView[];
  /** Accounts holding a non-zero known value, largest first. */
  accountValues: readonly AccountValueView[];
  /** Accounts counted in net worth that still hold unvalued positions. */
  accountsWithUnknownValue: number;
  activity: readonly ActivityBucketView[];
  activityTotal: number;
}>;

export type BuildDashboardInsightsInput = Readonly<{
  now: Date;
  /** Number of trailing calendar months to derive. Defaults to 12. */
  months?: number;
}>;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function earliestActivity(overview: WealthOverview): Date | null {
  let earliest: number | null = null;
  for (const transaction of overview.transactions) {
    const occurred = Date.parse(transaction.occurredAt);
    if (!Number.isFinite(occurred)) continue;
    if (earliest === null || occurred < earliest) earliest = occurred;
  }
  return earliest === null ? null : new Date(earliest);
}

/**
 * Trailing month windows, oldest first. Windows never start before the first
 * recorded transaction and never extend past `now`, so the dashboard cannot
 * plot fabricated history or a future period.
 */
function monthWindows(
  overview: WealthOverview,
  now: Date,
  months: number,
): readonly Readonly<{ start: Date; end: Date }>[] {
  const first = earliestActivity(overview);
  if (!first) return Object.freeze([]);

  const currentMonth = startOfMonth(now);
  const requestedStart = shiftMonths(currentMonth, -(Math.max(months, 1) - 1));
  const activityStart = startOfMonth(first);
  let cursor = requestedStart.getTime() > activityStart.getTime() ? requestedStart : activityStart;

  const windows: Readonly<{ start: Date; end: Date }>[] = [];
  while (cursor.getTime() <= currentMonth.getTime()) {
    const naturalEnd = shiftMonths(cursor, 1);
    const end = naturalEnd.getTime() > now.getTime() ? new Date(now.getTime()) : naturalEnd;
    windows.push(Object.freeze({ start: cursor, end }));
    cursor = naturalEnd;
  }
  return Object.freeze(windows);
}

function buildTrend(
  overview: WealthOverview,
  windows: readonly Readonly<{ start: Date; end: Date }>[],
): readonly NetWorthPointView[] {
  if (!overview.baseCurrency) return Object.freeze([]);

  return Object.freeze(
    windows.map((window) => {
      const valuation = valuationAt(overview, window.end);
      return Object.freeze({
        key: monthKey(window.start),
        start: window.start,
        at: window.end,
        knownNetWorth: valuation?.knownTotal ?? null,
        valuationComplete: valuation?.complete ?? false,
        unknownPositionCount: valuation
          ? valuation.totalPositionCount - valuation.knownPositionCount
          : 0,
      });
    }),
  );
}

function buildActivity(
  overview: WealthOverview,
  windows: readonly Readonly<{ start: Date; end: Date }>[],
): readonly ActivityBucketView[] {
  return Object.freeze(
    windows.map((window) => {
      const start = window.start.getTime();
      const end = window.end.getTime();
      const events = overview.transactions.filter((transaction) => {
        const occurred = Date.parse(transaction.occurredAt);
        return Number.isFinite(occurred) && occurred >= start && occurred < end;
      });
      return Object.freeze({
        key: monthKey(window.start),
        start: window.start,
        end: window.end,
        eventCount: events.length,
        correctionCount: events.filter((event) => event.purpose !== "standard").length,
      });
    }),
  );
}

function buildAccountValues(overview: WealthOverview): readonly AccountValueView[] {
  return Object.freeze(
    overview.accounts
      .filter(
        (account): account is AccountView & { knownValue: Money } =>
          !account.archived &&
          account.includeInNetWorth &&
          account.knownValue !== null &&
          !account.knownValue.amount.isZero(),
      )
      .map((account) =>
        Object.freeze({
          id: account.id,
          name: account.name,
          kind: account.kind,
          knownValue: account.knownValue,
          unknownPositionCount: account.unknownPositionCount,
        }),
      )
      .sort((left, right) => right.knownValue.amount.compare(left.knownValue.amount)),
  );
}

export function buildDashboardInsights(
  overview: WealthOverview,
  input: BuildDashboardInsightsInput,
): DashboardInsights {
  if (!Number.isFinite(input.now.getTime())) {
    throw new Error("Dashboard insights require a valid current date.");
  }

  const windows = monthWindows(overview, input.now, input.months ?? 12);
  const netWorthTrend = buildTrend(overview, windows);
  const activity = buildActivity(overview, windows);

  return Object.freeze({
    baseCurrency: overview.baseCurrency,
    netWorthTrend,
    trendComplete:
      netWorthTrend.length > 0 && netWorthTrend.every((point) => point.valuationComplete),
    composition: overview.allocation,
    accountValues: buildAccountValues(overview),
    accountsWithUnknownValue: overview.accounts.filter(
      (account) => !account.archived && account.includeInNetWorth && account.unknownPositionCount > 0,
    ).length,
    activity,
    activityTotal: activity.reduce((total, bucket) => total + bucket.eventCount, 0),
  });
}

