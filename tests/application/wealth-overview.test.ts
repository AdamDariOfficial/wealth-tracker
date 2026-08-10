import { describe, expect, test } from "bun:test";
import { userProfile } from "../../src/application/profile";
import { buildWealthOverview } from "../../src/application/view-models";
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

function fixture(withPrice: boolean) {
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
  const transactions = [
    LedgerTransaction.create({
      id: transactionId("tx:cash"),
      occurredAt: at("2026-08-01T10:00:00Z"),
      recordedAt: at("2026-08-01T10:00:01Z"),
      description: "Opening cash",
      legs: [
        {
          id: transactionLegId("leg:cash-owned"),
          accountId: owned.id,
          assetId: eur.id,
          quantity: "1000",
        },
        {
          id: transactionLegId("leg:cash-external"),
          accountId: external.id,
          assetId: eur.id,
          quantity: "-1000",
        },
      ],
    }),
    LedgerTransaction.create({
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
    }),
  ];
  const accounts = [owned, external];
  const assets = [eur, etf];
  const priceQuotes = withPrice
    ? [
        PriceQuote.create({
          assetId: etf.id,
          unitPrice: Money.of("100", "EUR"),
          asOf: at("2026-08-03T10:00:00Z"),
        }),
      ]
    : [];

  return Object.freeze({
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
}

describe("wealth overview view model", () => {
  test("preserves unknown valuation instead of treating it as zero", () => {
    const overview = buildWealthOverview(fixture(false));
    expect(overview.knownNetWorth?.amount.toString()).toBe("1000");
    expect(overview.valuationComplete).toBe(false);
    expect(overview.unknownPositionCount).toBe(1);
    expect(overview.positions.find((position) => position.symbol === "VWCE")?.missingReason).toBe(
      "missing-price",
    );
  });

  test("builds complete known totals and one canonical account list", () => {
    const overview = buildWealthOverview(fixture(true));
    expect(overview.knownNetWorth?.amount.toString()).toBe("1200");
    expect(overview.valuationComplete).toBe(true);
    expect(overview.accounts.map((account) => account.name)).toEqual(["Broker", "External"]);
    expect(
      overview.accounts.find((account) => account.name === "Broker")?.knownValue?.amount.toString(),
    ).toBe("1200");
    expect(overview.accounts.find((account) => account.name === "External")?.positionCount).toBe(2);
    expect(overview.accounts.find((account) => account.name === "External")?.knownValue).toBeNull();
    expect(overview.allocation.map((item) => item.kind)).toEqual(["fiat", "etf"]);
  });
});
