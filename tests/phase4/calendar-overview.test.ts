import { describe, expect, test } from "bun:test";
import { userProfile } from "../../src/application/profile";
import { buildCalendarOverview } from "../../src/application/view-models";
import { buildWealthOverview } from "../../src/application/view-models/wealth-overview";
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

function baseFixture() {
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
  const etf = Asset.create({
    id: assetId("asset:etf"),
    symbol: "VWCE",
    name: "All World",
    kind: "etf",
    precision: 4,
  });

  return { owned, external, eur, etf };
}

function openingCash(owned: Account, external: Account, eur: Asset) {
  return LedgerTransaction.create({
    id: transactionId("tx:cash"),
    occurredAt: at("2026-08-01T10:00:00Z"),
    recordedAt: at("2026-08-01T10:00:01Z"),
    description: "Opening cash",
    legs: [
      {
        id: transactionLegId("leg:cash-owned"),
        accountId: owned.id,
        assetId: eur.id,
        quantity: "100",
      },
      {
        id: transactionLegId("leg:cash-external"),
        accountId: external.id,
        assetId: eur.id,
        quantity: "-100",
      },
    ],
  });
}

function etfPosition(owned: Account, external: Account, etf: Asset) {
  return LedgerTransaction.create({
    id: transactionId("tx:etf"),
    occurredAt: at("2026-08-02T10:00:00Z"),
    recordedAt: at("2026-08-02T10:00:01Z"),
    description: "ETF position",
    legs: [
      {
        id: transactionLegId("leg:etf-owned"),
        accountId: owned.id,
        assetId: etf.id,
        quantity: "2",
      },
      {
        id: transactionLegId("leg:etf-external"),
        accountId: external.id,
        assetId: etf.id,
        quantity: "-2",
      },
    ],
  });
}

function overview(input?: {
  withEtf?: boolean;
  withPrice?: boolean;
  priceCurrency?: "EUR" | "USD";
  reversed?: boolean;
}) {
  const { owned, external, eur, etf } = baseFixture();
  const cash = openingCash(owned, external, eur);
  const transactions: LedgerTransaction[] = [cash];

  if (input?.withEtf) transactions.push(etfPosition(owned, external, etf));
  if (input?.reversed) {
    transactions.push(
      LedgerTransaction.createReversal({
        id: transactionId("tx:cash-reversal"),
        original: cash,
        recordedAt: at("2026-08-04T10:00:00Z"),
        legIds: [transactionLegId("leg:cash-r1"), transactionLegId("leg:cash-r2")],
      }),
    );
  }

  const priceQuotes = input?.withPrice
    ? [
        PriceQuote.create({
          assetId: etf.id,
          unitPrice: Money.of("100", input?.priceCurrency ?? "EUR"),
          asOf: at("2026-08-03T12:00:00Z"),
        }),
      ]
    : [];
  const accounts = [owned, external];
  const assets = [eur, etf];
  const state = Object.freeze({
    profile: userProfile({
      displayName: "Adam",
      baseCurrency: "EUR",
      locale: "it-IT",
      onboarded: true,
    }),
    accounts,
    assets,
    transactions,
    priceQuotes,
    fxRates: [],
    snapshot: replayLedger({ accounts, assets, transactions }),
  });

  return buildWealthOverview(state);
}

function cashFlowOverview() {
  const owned = Account.create({
    id: accountId("account:cash-flow"),
    name: "Bank",
    kind: "bank",
    ownership: "owned",
    includeInNetWorth: true,
  });
  const income = Account.create({
    id: accountId("account:income"),
    name: "Income",
    kind: "income",
    ownership: "system",
    includeInNetWorth: false,
  });
  const expense = Account.create({
    id: accountId("account:expense"),
    name: "Expense",
    kind: "expense",
    ownership: "system",
    includeInNetWorth: false,
  });
  const eur = Asset.create({
    id: assetId("asset:flow-eur"),
    symbol: "EUR",
    name: "Euro",
    kind: "fiat",
    precision: 2,
    fiatCurrency: "EUR",
  });
  const inflow = LedgerTransaction.create({
    id: transactionId("tx:income"),
    occurredAt: at("2026-08-05T09:00:00Z"),
    recordedAt: at("2026-08-05T09:00:01Z"),
    description: "Salary",
    legs: [
      {
        id: transactionLegId("leg:income-bank"),
        accountId: owned.id,
        assetId: eur.id,
        quantity: "200",
      },
      {
        id: transactionLegId("leg:income-system"),
        accountId: income.id,
        assetId: eur.id,
        quantity: "-200",
      },
    ],
  });
  const outflow = LedgerTransaction.create({
    id: transactionId("tx:expense"),
    occurredAt: at("2026-08-05T13:00:00Z"),
    recordedAt: at("2026-08-05T13:00:01Z"),
    description: "Groceries",
    legs: [
      {
        id: transactionLegId("leg:expense-bank"),
        accountId: owned.id,
        assetId: eur.id,
        quantity: "-40",
      },
      {
        id: transactionLegId("leg:expense-system"),
        accountId: expense.id,
        assetId: eur.id,
        quantity: "40",
      },
    ],
  });
  const accounts = [owned, income, expense];
  const assets = [eur];
  const transactions = [inflow, outflow];
  const state = Object.freeze({
    profile: userProfile({
      displayName: "Adam",
      baseCurrency: "EUR",
      locale: "it-IT",
      onboarded: true,
    }),
    accounts,
    assets,
    transactions,
    priceQuotes: [],
    fxRates: [],
    snapshot: replayLedger({ accounts, assets, transactions }),
  });
  return buildWealthOverview(state);
}

function august() {
  return new Date(2026, 7, 10);
}

describe("Phase 4A calendar overview", () => {
  test("replays exact canonical balances at daily cutoffs", () => {
    const calendar = buildCalendarOverview(overview(), {
      scope: "month",
      anchor: august(),
    });
    const first = calendar.buckets.find((bucket) => bucket.key === "2026-08-01");

    expect(first?.eventCount).toBe(1);
    expect(first?.knownNetWorth?.amount.toString()).toBe("100");
    expect(first?.knownDelta?.amount.toString()).toBe("100");
    expect(first?.valuationComplete).toBe(true);
    expect(first?.deltaComplete).toBe(true);
  });

  test("keeps missing valuation unknown until a historical observation exists", () => {
    const calendar = buildCalendarOverview(overview({ withEtf: true, withPrice: true }), {
      scope: "month",
      anchor: august(),
    });
    const second = calendar.buckets.find((bucket) => bucket.key === "2026-08-02");
    const third = calendar.buckets.find((bucket) => bucket.key === "2026-08-03");

    expect(second?.eventCount).toBe(1);
    expect(second?.knownNetWorth?.amount.toString()).toBe("100");
    expect(second?.valuationComplete).toBe(false);
    expect(second?.unknownPositionCount).toBe(1);

    expect(third?.eventCount).toBe(0);
    expect(third?.knownNetWorth?.amount.toString()).toBe("300");
    expect(third?.knownDelta?.amount.toString()).toBe("200");
    expect(third?.valuationComplete).toBe(true);
  });

  test("reports the exact missing historical price and FX pair without inventing values", () => {
    const missingPrice = buildCalendarOverview(overview({ withEtf: true }), {
      scope: "month",
      anchor: august(),
      now: new Date(2026, 7, 2, 23, 59, 59, 999),
    });
    const priceIssue = missingPrice.diagnostics.find((issue) => issue.reason === "missing-price");

    expect(priceIssue?.assetSymbol).toBe("VWCE");
    expect(priceIssue?.sourceCurrency).toBeNull();
    expect(priceIssue?.targetCurrency).toBeNull();

    const missingFx = buildCalendarOverview(
      overview({ withEtf: true, withPrice: true, priceCurrency: "USD" }),
      {
        scope: "month",
        anchor: august(),
        now: new Date(2026, 7, 3, 23, 59, 59, 999),
      },
    );
    const fxIssue = missingFx.diagnostics.find((issue) => issue.reason === "missing-fx-rate");

    expect(fxIssue?.assetSymbol).toBe("VWCE");
    expect(fxIssue?.sourceCurrency).toBe("USD");
    expect(fxIssue?.targetCurrency).toBe("EUR");
    expect(missingFx.endValuation?.knownNetWorth.amount.toString()).toBe("100");
    expect(missingFx.endValuation?.complete).toBe(false);
  });

  test("exposes known daily income and expense without inventing flow values", () => {
    const calendar = buildCalendarOverview(cashFlowOverview(), {
      scope: "month",
      anchor: august(),
      now: new Date(2026, 7, 5, 23, 59, 59, 999),
    });
    const fifth = calendar.buckets.find((bucket) => bucket.key === "2026-08-05");

    expect(fifth?.knownInflow?.amount.toString()).toBe("200");
    expect(fifth?.knownOutflow?.amount.toString()).toBe("40");
    expect(fifth?.flowComplete).toBe(true);
    expect(fifth?.knownDelta?.amount.toString()).toBe("160");
  });

  test("shows current corrected economic history with explicit correction events", () => {
    const calendar = buildCalendarOverview(overview({ reversed: true }), {
      scope: "month",
      anchor: august(),
      selectedDay: new Date(2026, 7, 1),
    });
    const first = calendar.buckets.find((bucket) => bucket.key === "2026-08-01");

    expect(first?.eventCount).toBe(2);
    expect(first?.correctionCount).toBe(1);
    expect(first?.knownNetWorth?.amount.toString()).toBe("0");
    expect(calendar.selectedDayEvents.map((event) => event.state).sort()).toEqual([
      "reversal",
      "voided",
    ]);
  });

  test("does not project a current valuation into future buckets", () => {
    const calendar = buildCalendarOverview(overview(), {
      scope: "year",
      anchor: august(),
      now: new Date(2026, 7, 10, 12, 0, 0, 0),
    });

    const current = calendar.buckets.find((bucket) => bucket.key === "2026-08-01");
    const future = calendar.buckets.find((bucket) => bucket.key === "2026-09-01");

    expect(current?.future).toBe(false);
    expect(current?.knownNetWorth?.amount.toString()).toBe("100");
    expect(future?.future).toBe(true);
    expect(future?.knownNetWorth).toBeNull();
    expect(future?.knownDelta).toBeNull();
    expect(future?.valuationComplete).toBe(false);
  });
});
