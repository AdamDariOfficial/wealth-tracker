import { describe, expect, test } from "bun:test";
import { userProfile } from "../../src/application/profile";
import { buildDashboardInsights, buildWealthOverview } from "../../src/application/view-models";
import { Account, accountId } from "../../src/domain/accounts";
import { Asset, assetId } from "../../src/domain/assets";
import { Money, UtcTimestamp } from "../../src/domain/core";
import {
  LedgerTransaction,
  replayLedger,
  transactionId,
  transactionLegId,
} from "../../src/domain/ledger";
import { PriceQuote } from "../../src/domain/valuation";

const at = (value: string) => UtcTimestamp.parse(value);

const owned = Account.create({
  id: accountId("account:owned"),
  name: "Broker",
  kind: "broker",
  ownership: "owned",
  includeInNetWorth: true,
});
const external = Account.create({
  id: accountId("account:external"),
  name: "External",
  kind: "external",
  ownership: "external",
  includeInNetWorth: false,
});
const eur = Asset.create({
  id: assetId("asset:eur"),
  symbol: "EUR",
  name: "Euro",
  kind: "fiat",
  precision: 2,
  fiatCurrency: "EUR",
});

function cashTransaction(suffix: string, occurredAt: string, quantity: string) {
  return LedgerTransaction.create({
    id: transactionId(`tx:${suffix}`),
    occurredAt: at(occurredAt),
    recordedAt: at(occurredAt),
    description: `Deposit ${suffix}`,
    legs: [
      {
        id: transactionLegId(`leg:${suffix}-owned`),
        accountId: owned.id,
        assetId: eur.id,
        quantity,
      },
      {
        id: transactionLegId(`leg:${suffix}-external`),
        accountId: external.id,
        assetId: eur.id,
        quantity: `-${quantity}`,
      },
    ],
  });
}

function overviewFor(transactions: readonly LedgerTransaction[]) {
  const accounts = [owned, external];
  const assets = [eur];
  return buildWealthOverview({
    profile: userProfile({
      displayName: "Adam",
      baseCurrency: "EUR",
      locale: "it-IT",
      onboarded: true,
    }),
    accounts,
    assets,
    transactions: [...transactions],
    priceQuotes: [] as PriceQuote[],
    fxRates: [],
    snapshot: replayLedger({ accounts, assets, transactions: [...transactions] }),
  });
}

describe("dashboard insights", () => {
  test("returns an empty trend when there is no recorded history", () => {
    const insights = buildDashboardInsights(overviewFor([]), {
      now: new Date("2026-08-15T12:00:00Z"),
    });
    expect(insights.netWorthTrend).toHaveLength(0);
    expect(insights.trendComplete).toBe(false);
    expect(insights.activityTotal).toBe(0);
  });

  test("derives month-close valuations from the canonical ledger", () => {
    const overview = overviewFor([
      cashTransaction("june", "2026-06-10T10:00:00Z", "1000"),
      cashTransaction("july", "2026-07-10T10:00:00Z", "500"),
    ]);
    const insights = buildDashboardInsights(overview, {
      now: new Date("2026-08-15T12:00:00Z"),
    });

    expect(insights.netWorthTrend.map((point) => point.key)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    expect(insights.netWorthTrend.map((point) => point.knownNetWorth?.amount.toString())).toEqual([
      "1000",
      "1500",
      "1500",
    ]);
    expect(insights.trendComplete).toBe(true);
  });

  test("never values a period beyond the current instant", () => {
    const overview = overviewFor([cashTransaction("june", "2026-06-10T10:00:00Z", "1000")]);
    const now = new Date("2026-06-20T12:00:00Z");
    const insights = buildDashboardInsights(overview, { now });
    expect(insights.netWorthTrend).toHaveLength(1);
    expect(insights.netWorthTrend[0]?.at.getTime()).toBe(now.getTime());
  });

  test("counts exact activity per period and flags corrections", () => {
    const original = cashTransaction("june", "2026-06-10T10:00:00Z", "1000");
    const reversal = LedgerTransaction.create({
      id: transactionId("tx:reversal"),
      occurredAt: at("2026-06-10T10:00:00Z"),
      recordedAt: at("2026-07-02T10:00:00Z"),
      description: "Reversal",
      purpose: "reversal",
      relatedTransactionId: original.id,
      legs: [
        {
          id: transactionLegId("leg:reversal-owned"),
          accountId: owned.id,
          assetId: eur.id,
          quantity: "-1000",
        },
        {
          id: transactionLegId("leg:reversal-external"),
          accountId: external.id,
          assetId: eur.id,
          quantity: "1000",
        },
      ],
    });

    const insights = buildDashboardInsights(overviewFor([original, reversal]), {
      now: new Date("2026-07-20T12:00:00Z"),
    });

    expect(insights.activity.map((bucket) => bucket.eventCount)).toEqual([2, 0]);
    expect(insights.activity.map((bucket) => bucket.correctionCount)).toEqual([1, 0]);
    expect(insights.activityTotal).toBe(2);
  });

  test("ranks account values and ignores accounts excluded from net worth", () => {
    const insights = buildDashboardInsights(
      overviewFor([cashTransaction("june", "2026-06-10T10:00:00Z", "1000")]),
      { now: new Date("2026-08-15T12:00:00Z") },
    );
    expect(insights.accountValues.map((account) => account.name)).toEqual(["Broker"]);
    expect(insights.accountValues[0]?.knownValue.amount.toString()).toBe("1000");
  });
});
