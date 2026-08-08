import { describe, expect, test } from "bun:test";
import { Account, accountId } from "../../src/domain/accounts";
import { Asset, assetId } from "../../src/domain/assets";
import { Money, UtcTimestamp } from "../../src/domain/core";
import {
  LedgerTransaction,
  replayLedger,
  transactionId,
  transactionLegId,
} from "../../src/domain/ledger";
import {
  FxRate,
  PriceQuote,
  ValuationInvariantError,
  valueLedger,
} from "../../src/domain/valuation";

const broker = Account.create({
  id: accountId("account-broker"),
  name: "Broker",
  kind: "broker",
  ownership: "owned",
  includeInNetWorth: true,
});
const external = Account.create({
  id: accountId("account-market"),
  name: "Market",
  kind: "external",
  ownership: "external",
  includeInNetWorth: false,
});
const hidden = Account.create({
  id: accountId("account-hidden"),
  name: "Hidden",
  kind: "bank",
  ownership: "owned",
  includeInNetWorth: false,
});
const eur = Asset.create({
  id: assetId("asset-eur"),
  symbol: "EUR",
  name: "Euro",
  kind: "fiat",
  precision: 2,
  fiatCurrency: "EUR",
});
const usd = Asset.create({
  id: assetId("asset-usd"),
  symbol: "USD",
  name: "US Dollar",
  kind: "fiat",
  precision: 2,
  fiatCurrency: "USD",
});
const btc = Asset.create({
  id: assetId("asset-btc"),
  symbol: "BTC",
  name: "Bitcoin",
  kind: "crypto",
  precision: 8,
});
const timestamp = UtcTimestamp.parse("2026-01-01T00:00:00Z");

function createSnapshot() {
  const funding = LedgerTransaction.create({
    id: transactionId("tx-funding"),
    occurredAt: timestamp,
    recordedAt: timestamp,
    description: "Fund accounts",
    legs: [
      {
        id: transactionLegId("leg-funding-broker-eur"),
        accountId: broker.id,
        assetId: eur.id,
        quantity: "1000",
      },
      {
        id: transactionLegId("leg-funding-market-eur"),
        accountId: external.id,
        assetId: eur.id,
        quantity: "-1000",
      },
    ],
  });
  const bitcoin = LedgerTransaction.create({
    id: transactionId("tx-bitcoin"),
    occurredAt: timestamp,
    recordedAt: timestamp,
    description: "Receive bitcoin",
    legs: [
      {
        id: transactionLegId("leg-bitcoin-broker"),
        accountId: broker.id,
        assetId: btc.id,
        quantity: "0.5",
      },
      {
        id: transactionLegId("leg-bitcoin-market"),
        accountId: external.id,
        assetId: btc.id,
        quantity: "-0.5",
      },
    ],
  });
  const hiddenUsd = LedgerTransaction.create({
    id: transactionId("tx-hidden-usd"),
    occurredAt: timestamp,
    recordedAt: timestamp,
    description: "Hidden cash",
    legs: [
      {
        id: transactionLegId("leg-hidden-usd"),
        accountId: hidden.id,
        assetId: usd.id,
        quantity: "100",
      },
      {
        id: transactionLegId("leg-market-usd"),
        accountId: external.id,
        assetId: usd.id,
        quantity: "-100",
      },
    ],
  });

  return replayLedger({
    accounts: [broker, external, hidden],
    assets: [eur, usd, btc],
    transactions: [funding, bitcoin, hiddenUsd],
  });
}

describe("valueLedger", () => {
  test("returns a complete known total in the requested base currency", () => {
    const result = valueLedger({
      snapshot: createSnapshot(),
      accounts: [broker, external, hidden],
      assets: [eur, usd, btc],
      baseCurrency: "EUR",
      priceQuotes: [
        PriceQuote.create({
          assetId: btc.id,
          unitPrice: Money.of("60000", "USD"),
          asOf: timestamp,
        }),
      ],
      fxRates: [
        FxRate.create({
          sourceCurrency: "USD",
          targetCurrency: "EUR",
          rate: "0.9",
          asOf: timestamp,
        }),
      ],
    });

    expect(result.knownTotal.amount.toString()).toBe("28000");
    expect(result.knownTotal.currency.toString()).toBe("EUR");
    expect(result.complete).toBe(true);
    expect(result.knownPositionCount).toBe(2);
    expect(result.totalPositionCount).toBe(2);
    expect(result.excludedBalances).toHaveLength(4);
  });

  test("keeps a known subtotal when a price is missing", () => {
    const result = valueLedger({
      snapshot: createSnapshot(),
      accounts: [broker, external, hidden],
      assets: [eur, usd, btc],
      baseCurrency: "EUR",
      priceQuotes: [],
      fxRates: [],
    });

    expect(result.knownTotal.amount.toString()).toBe("1000");
    expect(result.complete).toBe(false);
    expect(result.knownPositionCount).toBe(1);
    expect(result.totalPositionCount).toBe(2);
    expect(result.positions.find((position) => position.status === "unknown")).toMatchObject({
      reason: "missing-price",
    });
  });

  test("distinguishes a missing FX rate from a missing asset price", () => {
    const result = valueLedger({
      snapshot: createSnapshot(),
      accounts: [broker, external, hidden],
      assets: [eur, usd, btc],
      baseCurrency: "EUR",
      priceQuotes: [
        PriceQuote.create({
          assetId: btc.id,
          unitPrice: Money.of("60000", "USD"),
          asOf: timestamp,
        }),
      ],
      fxRates: [],
    });

    expect(result.positions.find((position) => position.status === "unknown")).toMatchObject({
      reason: "missing-fx-rate",
    });
  });

  test("uses the inverse of a known FX pair", () => {
    const result = valueLedger({
      snapshot: createSnapshot(),
      accounts: [broker, external, hidden],
      assets: [eur, usd, btc],
      baseCurrency: "EUR",
      priceQuotes: [
        PriceQuote.create({
          assetId: btc.id,
          unitPrice: Money.of("60000", "USD"),
          asOf: timestamp,
        }),
      ],
      fxRates: [
        FxRate.create({
          sourceCurrency: "EUR",
          targetCurrency: "USD",
          rate: "1.111111111111111111",
          asOf: timestamp,
        }),
      ],
    });

    expect(result.complete).toBe(true);
    expect(result.knownTotal.amount.toFixed(2, "half-even")).toBe("28000.00");
  });

  test("selects the latest quote for an asset", () => {
    const result = valueLedger({
      snapshot: createSnapshot(),
      accounts: [broker, external, hidden],
      assets: [eur, usd, btc],
      baseCurrency: "EUR",
      priceQuotes: [
        PriceQuote.create({
          assetId: btc.id,
          unitPrice: Money.of("50000", "EUR"),
          asOf: UtcTimestamp.parse("2025-12-31T00:00:00Z"),
        }),
        PriceQuote.create({
          assetId: btc.id,
          unitPrice: Money.of("60000", "EUR"),
          asOf: timestamp,
        }),
      ],
      fxRates: [],
    });

    expect(result.knownTotal.amount.toString()).toBe("31000");
  });

  test("treats an explicit zero quote as known rather than unknown", () => {
    const result = valueLedger({
      snapshot: createSnapshot(),
      accounts: [broker, external, hidden],
      assets: [eur, usd, btc],
      baseCurrency: "EUR",
      priceQuotes: [
        PriceQuote.create({
          assetId: btc.id,
          unitPrice: Money.of("0", "EUR"),
          asOf: timestamp,
        }),
      ],
      fxRates: [],
    });

    expect(result.complete).toBe(true);
    expect(result.knownTotal.amount.toString()).toBe("1000");
    expect(result.positions.find((position) => position.assetId.equals(btc.id))).toMatchObject({
      status: "known",
    });
  });

  test("rejects fiat price quotes because fiat valuation uses FX", () => {
    expect(() =>
      valueLedger({
        snapshot: createSnapshot(),
        accounts: [broker, external, hidden],
        assets: [eur, usd, btc],
        baseCurrency: "EUR",
        priceQuotes: [
          PriceQuote.create({
            assetId: eur.id,
            unitPrice: Money.of("1", "EUR"),
            asOf: timestamp,
          }),
        ],
        fxRates: [],
      }),
    ).toThrow(ValuationInvariantError);
  });

  test("rejects quotes for assets outside the valuation dataset", () => {
    const unknownAsset = Asset.create({
      id: assetId("asset-unknown"),
      symbol: "UNK",
      name: "Unknown",
      kind: "other",
      precision: 4,
    });

    expect(() =>
      valueLedger({
        snapshot: createSnapshot(),
        accounts: [broker, external, hidden],
        assets: [eur, usd, btc],
        baseCurrency: "EUR",
        priceQuotes: [
          PriceQuote.create({
            assetId: unknownAsset.id,
            unitPrice: Money.of("1", "EUR"),
            asOf: timestamp,
          }),
        ],
        fxRates: [],
      }),
    ).toThrow(ValuationInvariantError);
  });

  test("rejects conflicting market data at the same instant", () => {
    const quotes = [
      PriceQuote.create({
        assetId: btc.id,
        unitPrice: Money.of("50000", "EUR"),
        asOf: timestamp,
      }),
      PriceQuote.create({
        assetId: btc.id,
        unitPrice: Money.of("60000", "EUR"),
        asOf: timestamp,
      }),
    ];

    expect(() =>
      valueLedger({
        snapshot: createSnapshot(),
        accounts: [broker, external, hidden],
        assets: [eur, usd, btc],
        baseCurrency: "EUR",
        priceQuotes: quotes,
        fxRates: [],
      }),
    ).toThrow(ValuationInvariantError);
  });
});
