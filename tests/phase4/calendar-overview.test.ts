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

function overview(input?: { withEtf?: boolean; withPrice?: boolean; reversed?: boolean }) {
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
          unitPrice: Money.of("100", "EUR"),
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
});
