import { describe, expect, test } from "bun:test";
import { Account, AccountInvariantError, accountId } from "../../src/domain/accounts";
import { Asset, AssetInvariantError, assetId } from "../../src/domain/assets";
import { CurrencyCode, UtcTimestamp } from "../../src/domain/core";

describe("Account", () => {
  test("creates an owned net-worth account", () => {
    const account = Account.create({
      id: accountId("account-bank"),
      name: "Primary bank",
      kind: "bank",
      ownership: "owned",
      includeInNetWorth: true,
      openedAt: UtcTimestamp.parse("2025-01-01T00:00:00Z"),
    });

    expect(account.name).toBe("Primary bank");
    expect(account.isArchived()).toBe(false);
  });

  test("prevents external accounts from entering net worth", () => {
    expect(() =>
      Account.create({
        id: accountId("account-external"),
        name: "Market counterparty",
        kind: "external",
        ownership: "external",
        includeInNetWorth: true,
      }),
    ).toThrow(AccountInvariantError);
  });

  test("requires account kind and ownership classifications to agree", () => {
    expect(() =>
      Account.create({
        id: accountId("account-wrong-external"),
        name: "Wrong external",
        kind: "external",
        ownership: "owned",
        includeInNetWorth: false,
      }),
    ).toThrow(AccountInvariantError);

    expect(() =>
      Account.create({
        id: accountId("account-wrong-income"),
        name: "Wrong income",
        kind: "income",
        ownership: "owned",
        includeInNetWorth: false,
      }),
    ).toThrow(AccountInvariantError);
  });

  test("rejects archive timestamps before account opening", () => {
    expect(() =>
      Account.create({
        id: accountId("account-old"),
        name: "Old account",
        kind: "bank",
        ownership: "owned",
        includeInNetWorth: true,
        openedAt: UtcTimestamp.parse("2026-01-02T00:00:00Z"),
        archivedAt: UtcTimestamp.parse("2026-01-01T00:00:00Z"),
      }),
    ).toThrow(AccountInvariantError);
  });
});

describe("Asset", () => {
  test("normalizes symbols and models fiat explicitly", () => {
    const eur = Asset.create({
      id: assetId("asset-eur"),
      symbol: "eur",
      name: "Euro",
      kind: "fiat",
      precision: 2,
      fiatCurrency: "EUR",
    });

    expect(eur.symbol).toBe("EUR");
    expect(eur.fiatCurrency?.equals(CurrencyCode.parse("EUR"))).toBe(true);
  });

  test("rejects fiat identity mismatches", () => {
    expect(() =>
      Asset.create({
        id: assetId("asset-eur"),
        symbol: "USD",
        name: "Euro",
        kind: "fiat",
        precision: 2,
        fiatCurrency: "EUR",
      }),
    ).toThrow(AssetInvariantError);
  });

  test("rejects currency metadata on non-fiat assets", () => {
    expect(() =>
      Asset.create({
        id: assetId("asset-btc"),
        symbol: "BTC",
        name: "Bitcoin",
        kind: "crypto",
        precision: 8,
        fiatCurrency: "USD",
      }),
    ).toThrow(AssetInvariantError);
  });
});
