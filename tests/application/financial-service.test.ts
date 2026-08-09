import { describe, expect, test } from "bun:test";
import {
  appendValidatedFxRate,
  appendValidatedPriceQuote,
  completeValidatedOnboarding,
  postValidatedTransaction,
  putValidatedAsset,
} from "../../src/application/services";
import type {
  CompleteOnboardingInput,
  FinancialRepository,
  PersistedFinancialState,
} from "../../src/application/ports";
import { userProfile, type UserProfile } from "../../src/application/profile";
import { Account, accountId } from "../../src/domain/accounts";
import { Asset, assetId } from "../../src/domain/assets";
import { Money, UtcTimestamp } from "../../src/domain/core";
import { LedgerTransaction, transactionId, transactionLegId } from "../../src/domain/ledger";
import { FxRate, PriceQuote } from "../../src/domain/valuation";

const at = (value: string) => UtcTimestamp.parse(value);

function baseState(): PersistedFinancialState {
  const accounts = [
    Account.create({
      id: accountId("account:owned"),
      name: "Owned",
      kind: "bank",
      ownership: "owned",
      includeInNetWorth: true,
    }),
    Account.create({
      id: accountId("account:external"),
      name: "External",
      kind: "external",
      ownership: "external",
      includeInNetWorth: false,
    }),
  ];
  const assets = [
    Asset.create({
      id: assetId("asset:eur"),
      symbol: "EUR",
      name: "Euro",
      kind: "fiat",
      precision: 2,
      fiatCurrency: "EUR",
    }),
    Asset.create({
      id: assetId("asset:btc"),
      symbol: "BTC",
      name: "Bitcoin",
      kind: "crypto",
      precision: 8,
    }),
  ];
  const transaction = LedgerTransaction.create({
    id: transactionId("tx:original"),
    occurredAt: at("2026-08-01T10:00:00Z"),
    recordedAt: at("2026-08-01T10:00:01Z"),
    description: "Opening cash",
    legs: [
      {
        id: transactionLegId("leg:owned"),
        accountId: accounts[0].id,
        assetId: assets[0].id,
        quantity: "100.00",
      },
      {
        id: transactionLegId("leg:external"),
        accountId: accounts[1].id,
        assetId: assets[0].id,
        quantity: "-100.00",
      },
    ],
  });
  return Object.freeze({
    profile: userProfile({ baseCurrency: "EUR", locale: "it-IT", onboarded: true }),
    accounts,
    assets,
    transactions: [transaction],
    priceQuotes: [],
    fxRates: [],
  });
}

class FakeRepository implements FinancialRepository {
  state = baseState();
  calls: string[] = [];

  async loadState() {
    return this.state;
  }
  async putAccount() {
    this.calls.push("putAccount");
  }
  async putAsset() {
    this.calls.push("putAsset");
  }
  async postTransaction() {
    this.calls.push("postTransaction");
  }
  async appendPriceQuote() {
    this.calls.push("appendPriceQuote");
  }
  async appendFxRate(_rate: FxRate) {
    this.calls.push("appendFxRate");
  }
  async completeOnboarding(input: CompleteOnboardingInput): Promise<UserProfile> {
    this.calls.push("completeOnboarding");
    return userProfile({ ...input, onboarded: true });
  }
}

describe("financial application services", () => {
  test("rejects a reversal that changes the economic timestamp before persistence", async () => {
    const repository = new FakeRepository();
    const state = repository.state;
    const reversal = LedgerTransaction.create({
      id: transactionId("tx:bad-reversal"),
      occurredAt: at("2026-08-02T10:00:00Z"),
      recordedAt: at("2026-08-02T10:00:01Z"),
      description: "Invalid reversal",
      purpose: "reversal",
      relatedTransactionId: state.transactions[0].id,
      legs: state.transactions[0].legs.map((leg, index) => ({
        id: transactionLegId(`leg:bad-reversal-${index}`),
        accountId: leg.accountId,
        assetId: leg.assetId,
        quantity: leg.quantity.negate(),
      })),
    });

    await expect(postValidatedTransaction(repository, reversal)).rejects.toThrow(
      "must preserve the economic timestamp",
    );
    expect(repository.calls).toEqual([]);
  });

  test("rejects lowering asset precision below persisted ledger quantities", async () => {
    const repository = new FakeRepository();
    const btc = repository.state.assets[1];
    const transaction = LedgerTransaction.create({
      id: transactionId("tx:btc"),
      occurredAt: at("2026-08-03T10:00:00Z"),
      recordedAt: at("2026-08-03T10:00:01Z"),
      description: "BTC position",
      legs: [
        {
          id: transactionLegId("leg:btc-owned"),
          accountId: repository.state.accounts[0].id,
          assetId: btc.id,
          quantity: "0.12345678",
        },
        {
          id: transactionLegId("leg:btc-external"),
          accountId: repository.state.accounts[1].id,
          assetId: btc.id,
          quantity: "-0.12345678",
        },
      ],
    });
    repository.state = Object.freeze({
      ...repository.state,
      transactions: [...repository.state.transactions, transaction],
    });
    const reduced = Asset.create({
      id: btc.id,
      symbol: btc.symbol,
      name: btc.name,
      kind: btc.kind,
      precision: 2,
    });

    await expect(putValidatedAsset(repository, reduced)).rejects.toThrow("exceeds precision 2");
    expect(repository.calls).toEqual([]);
  });

  test("rejects price quotes for fiat assets", async () => {
    const repository = new FakeRepository();
    const quote = PriceQuote.create({
      assetId: repository.state.assets[0].id,
      unitPrice: Money.of("1", "EUR"),
      asOf: at("2026-08-04T10:00:00Z"),
    });

    await expect(appendValidatedPriceQuote(repository, quote)).rejects.toThrow(
      "Fiat assets cannot receive price quotes",
    );
    expect(repository.calls).toEqual([]);
  });

  test("persists a valid FX rate through the application service", async () => {
    const repository = new FakeRepository();
    const rate = FxRate.create({
      sourceCurrency: "USD",
      targetCurrency: "EUR",
      rate: "1.234567890123456789",
      asOf: at("2026-08-05T10:00:00Z"),
    });

    await appendValidatedFxRate(repository, rate);

    expect(repository.calls).toEqual(["appendFxRate"]);
  });

  test("rejects a duplicate FX observation before persistence", async () => {
    const repository = new FakeRepository();
    const rate = FxRate.create({
      sourceCurrency: "USD",
      targetCurrency: "EUR",
      rate: "1.234567890123456789",
      asOf: at("2026-08-05T10:00:00Z"),
    });
    repository.state = Object.freeze({
      ...repository.state,
      fxRates: [rate],
    });

    await expect(appendValidatedFxRate(repository, rate)).rejects.toThrow(
      "already exists for that pair and timestamp",
    );
    expect(repository.calls).toEqual([]);
  });

  test("validates onboarding before calling persistence", async () => {
    const repository = new FakeRepository();
    const profile = await completeValidatedOnboarding(repository, {
      displayName: "Adam",
      baseCurrency: "EUR",
      locale: "it-IT",
    });
    expect(profile.baseCurrency?.toString()).toBe("EUR");
    expect(profile.onboarded).toBe(true);
    expect(repository.calls).toEqual(["completeOnboarding"]);
  });
});
