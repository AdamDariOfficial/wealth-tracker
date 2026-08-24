import { Money } from "../../domain/core";
import { valuationAt } from "./historical-valuation";
import type { WealthOverview } from "./wealth-overview";

export type AccountValuePointView = Readonly<{
  key: string;
  start: Date;
  at: Date;
  knownValue: Money;
  complete: boolean;
  unknownPositionCount: number;
}>;

export type BuildAccountValueTrendInput = Readonly<{
  accountId: string;
  now: Date;
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

function earliestAccountActivity(overview: WealthOverview, accountId: string): Date | null {
  let earliest: number | null = null;

  for (const transaction of overview.transactions) {
    if (!transaction.legs.some((leg) => leg.accountId === accountId)) continue;
    const occurred = Date.parse(transaction.occurredAt);
    if (!Number.isFinite(occurred)) continue;
    if (earliest === null || occurred < earliest) earliest = occurred;
  }

  return earliest === null ? null : new Date(earliest);
}

function monthWindows(
  overview: WealthOverview,
  accountId: string,
  now: Date,
  months: number,
): readonly Readonly<{ start: Date; end: Date }>[] {
  const first = earliestAccountActivity(overview, accountId);
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

/**
 * Historical value for one owned account.
 *
 * Uses the same canonical point-in-time ledger replay and market observations as
 * the Calendar and Dashboard. This is account value change, not investment
 * performance: deposits, withdrawals, transfers and market moves are all
 * reflected.
 *
 * Accounts excluded from totals intentionally return no trend because the
 * current valuation layer excludes them from valued positions.
 */
export function buildAccountValueTrend(
  overview: WealthOverview,
  input: BuildAccountValueTrendInput,
): readonly AccountValuePointView[] {
  if (!Number.isFinite(input.now.getTime())) {
    throw new Error("Account value trend requires a valid current date.");
  }

  const account = overview.accounts.find((item) => item.id === input.accountId);
  if (!account || !account.includeInNetWorth || !overview.baseCurrency) {
    return Object.freeze([]);
  }

  const windows = monthWindows(overview, input.accountId, input.now, input.months ?? 12);

  return Object.freeze(
    windows.map((window) => {
      const valuation = valuationAt(overview, window.end);
      if (!valuation) {
        return Object.freeze({
          key: monthKey(window.start),
          start: window.start,
          at: window.end,
          knownValue: Money.zero(overview.baseCurrency as string),
          complete: false,
          unknownPositionCount: 0,
        });
      }

      const positions = valuation.positions.filter(
        (position) => position.accountId.toString() === input.accountId,
      );
      let knownValue = Money.zero(valuation.baseCurrency);
      let unknownPositionCount = 0;

      for (const position of positions) {
        if (position.status === "known") knownValue = knownValue.plus(position.value);
        else unknownPositionCount += 1;
      }

      return Object.freeze({
        key: monthKey(window.start),
        start: window.start,
        at: window.end,
        knownValue,
        complete: unknownPositionCount === 0,
        unknownPositionCount,
      });
    }),
  );
}
