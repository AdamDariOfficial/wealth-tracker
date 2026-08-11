import { describe, expect, test } from "bun:test";
import type { AdvancedState } from "../../src/application/advanced";
import { userProfile } from "../../src/application/profile";
import {
  buildGoalsOverview,
  buildTradingOverview,
  buildWealthOverview,
} from "../../src/application/view-models";
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

function fixture() {
  const bank = Account.create({
    id: accountId("account:bank"),
    name: "Bank",
    kind: "bank",
    ownership: "owned",
    includeInNetWorth: true,
  });
  const broker = Account.create({
    id: accountId("account:broker"),
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
  const btc = Asset.create({
    id: assetId("asset:btc"),
    symbol: "BTC",
    name: "Bitcoin",
    kind: "crypto",
    precision: 8,
  });
  const transactions = [
    LedgerTransaction.create({
      id: transactionId("tx:cash"),
      occurredAt: at("2026-08-01T10:00:00Z"),
      recordedAt: at("2026-08-01T10:00:01Z"),
      description: "Cash",
      legs: [
        {
          id: transactionLegId("leg:cash-bank"),
          accountId: bank.id,
          assetId: eur.id,
          quantity: "1000",
        },
        {
          id: transactionLegId("leg:cash-ext"),
          accountId: external.id,
          assetId: eur.id,
          quantity: "-1000",
        },
      ],
    }),
    LedgerTransaction.create({
      id: transactionId("tx:btc"),
      occurredAt: at("2026-08-02T10:00:00Z"),
      recordedAt: at("2026-08-02T10:00:01Z"),
      description: "BTC",
      legs: [
        {
          id: transactionLegId("leg:btc-broker"),
          accountId: broker.id,
          assetId: btc.id,
          quantity: "0.5",
        },
        {
          id: transactionLegId("leg:btc-ext"),
          accountId: external.id,
          assetId: btc.id,
          quantity: "-0.5",
        },
      ],
    }),
  ];
  const accounts = [bank, broker, external];
  const assets = [eur, btc];
  const state = {
    profile: userProfile({
      displayName: "Adam",
      baseCurrency: "EUR",
      locale: "it-IT",
      onboarded: true,
    }),
    accounts,
    assets,
    transactions,
    priceQuotes: [
      PriceQuote.create({
        assetId: btc.id,
        unitPrice: Money.of("60000", "EUR"),
        asOf: at("2026-08-03T10:00:00Z"),
      }),
    ],
    fxRates: [],
    snapshot: replayLedger({ accounts, assets, transactions }),
  };
  return buildWealthOverview(state);
}

function advanced(): AdvancedState {
  return {
    goals: [
      {
        id: "goal:nw",
        name: "Net worth",
        kind: "net_worth",
        targetAmount: "40000",
        targetQuantity: null,
        targetAccountId: null,
        targetAssetId: null,
        targetDate: null,
        archivedAt: null,
      },
      {
        id: "goal:btc",
        name: "One BTC",
        kind: "asset_quantity",
        targetAmount: null,
        targetQuantity: "1",
        targetAccountId: null,
        targetAssetId: "asset:btc",
        targetDate: null,
        archivedAt: null,
      },
    ],
    tradingSettings: null,
    weeklyReviews: [
      {
        id: "review:week",
        weekStart: "2026-08-03",
        reportedPnl: "500",
        winRate: "60",
        avgRr: "1.5",
        tradeCount: 10,
        maxDrawdownPct: "4",
        disciplineScore: 80,
        psychologyScore: 70,
        consistencyScore: 85,
        notes: null,
        lessons: null,
        isDraft: false,
        finalizedAt: "2026-08-09T18:00:00Z",
      },
    ],
    importBatches: [],
  };
}

describe("Phase 4 advanced view models", () => {
  test("derives goal progress from canonical ledger and valuation", () => {
    const goals = buildGoalsOverview(fixture(), advanced());
    expect(goals[0].currentMoney?.amount.toString()).toBe("31000");
    expect(goals[0].progressPercent).toBe(77.5);
    expect(goals[1].currentQuantity?.toString()).toBe("0.5");
    expect(goals[1].progressPercent).toBe(50);
  });

  test("derives trading capital from broker/exchange/investment positions only", () => {
    const trading = buildTradingOverview(fixture(), advanced());
    expect(trading.knownCapital?.amount.toString()).toBe("30000");
    expect(trading.capitalComplete).toBe(true);
    expect(trading.reviewReportedPnl?.amount.toString()).toBe("500");
    expect(trading.finalizedReviewCount).toBe(1);
  });
});
