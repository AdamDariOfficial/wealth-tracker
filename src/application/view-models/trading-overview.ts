import type { AdvancedState, TradingSettings, WeeklyReview } from "../advanced";
import { Decimal, Money } from "../../domain/core";
import type { WealthOverview } from "./wealth-overview";

export type TradingOverview = Readonly<{
  settings: TradingSettings;
  knownCapital: Money | null;
  capitalComplete: boolean;
  reviewReportedPnl: Money | null;
  averageReportedPnl: Money | null;
  reviewCount: number;
  finalizedReviewCount: number;
  averageConsistencyScore: number | null;
  reviews: readonly WeeklyReview[];
}>;

const DEFAULT_SETTINGS: TradingSettings = Object.freeze({
  reserve: "0",
  defaultRiskPct: "1",
  weeklyLossLimitPct: "5",
  maxDailyLossPct: "2",
  primaryAsset: null,
});

export function buildTradingOverview(
  financial: WealthOverview,
  advanced: AdvancedState,
): TradingOverview {
  const currency = financial.baseCurrency;
  const accountById = new Map(
    financial.state.accounts.map((value) => [value.id.toString(), value]),
  );
  const tradingKinds = new Set(["broker", "exchange", "investment"]);

  let capitalComplete = true;
  let knownCapital = currency ? Money.zero(currency) : null;
  for (const position of financial.positions) {
    const account = accountById.get(position.accountId);
    if (!account || account.ownership !== "owned" || !tradingKinds.has(account.kind)) continue;
    if (!position.value) {
      capitalComplete = false;
      continue;
    }
    if (knownCapital) knownCapital = knownCapital.plus(position.value);
  }

  const reviews = Object.freeze(
    [...advanced.weeklyReviews].sort((left, right) =>
      right.weekStart.localeCompare(left.weekStart),
    ),
  );
  let reportedPnl = Decimal.zero();
  let consistencyTotal = 0;
  for (const review of reviews) {
    reportedPnl = reportedPnl.plus(Decimal.parse(review.reportedPnl));
    consistencyTotal += review.consistencyScore;
  }

  const reviewReportedPnl = currency ? Money.of(reportedPnl, currency) : null;
  const averageReportedPnl =
    currency && reviews.length > 0
      ? Money.of(
          reportedPnl.dividedBy(Decimal.fromInteger(reviews.length), 18, "half-even"),
          currency,
        )
      : currency
        ? Money.zero(currency)
        : null;

  return Object.freeze({
    settings: advanced.tradingSettings ?? DEFAULT_SETTINGS,
    knownCapital,
    capitalComplete,
    reviewReportedPnl,
    averageReportedPnl,
    reviewCount: reviews.length,
    finalizedReviewCount: reviews.filter((review) => review.finalizedAt !== null).length,
    averageConsistencyScore:
      reviews.length === 0 ? null : Math.round(consistencyTotal / reviews.length),
    reviews,
  });
}
