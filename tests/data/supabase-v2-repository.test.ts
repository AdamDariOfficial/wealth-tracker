import { describe, expect, test } from "bun:test";
import { Account, accountId } from "../../src/domain/accounts";
import { Asset, assetId } from "../../src/domain/assets";
import { Money, UtcTimestamp } from "../../src/domain/core";
import { LedgerTransaction, transactionId, transactionLegId } from "../../src/domain/ledger";
import { FxRate, PriceQuote } from "../../src/domain/valuation";
import {
  SupabaseV2FinancialRepository,
  SupabaseV2IdentityProvider,
  type RpcArguments,
  type V2Transport,
} from "../../src/data/supabase/v2";

class FakeTransport implements V2Transport {
  calls: Array<{ name: string; args: RpcArguments }> = [];
  response: unknown = null;
  user: { id: string; email: string | null } | null = null;

  async rpc<T>(name: string, args: RpcArguments = {}): Promise<T> {
    this.calls.push({ name, args });
    return this.response as T;
  }

  async getAuthenticatedUser() {
    return this.user;
  }
}

function stateDto() {
  return {
    profile: {
      displayName: "Adam",
      baseCurrency: "EUR",
      locale: "it-IT",
      onboarded: true,
    },
    accounts: [
      {
        id: "account:owned",
        name: "Owned",
        kind: "bank",
        ownership: "owned",
        includeInNetWorth: true,
        openedAt: null,
        archivedAt: null,
      },
      {
        id: "account:external",
        name: "External",
        kind: "external",
        ownership: "external",
        includeInNetWorth: false,
        openedAt: null,
        archivedAt: null,
      },
    ],
    assets: [
      {
        id: "asset:eur",
        symbol: "EUR",
        name: "Euro",
        kind: "fiat",
        precision: 2,
        fiatCurrency: "EUR",
      },
      {
        id: "asset:btc",
        symbol: "BTC",
        name: "Bitcoin",
        kind: "crypto",
        precision: 8,
        fiatCurrency: null,
      },
    ],
    transactions: [
      {
        id: "tx:large",
        occurredAt: "2026-08-01T10:00:00.000Z",
        recordedAt: "2026-08-01T10:00:01.000Z",
        description: "Exact value",
        purpose: "standard",
        relatedTransactionId: null,
        legs: [
          {
            id: "leg:owned",
            accountId: "account:owned",
            assetId: "asset:eur",
            quantity: "9007199254740993.01",
            memo: null,
          },
          {
            id: "leg:external",
            accountId: "account:external",
            assetId: "asset:eur",
            quantity: "-9007199254740993.01",
            memo: null,
          },
        ],
      },
    ],
    priceQuotes: [
      {
        assetId: "asset:btc",
        amount: "123456789012345678.12345678",
        currency: "EUR",
        asOf: "2026-08-02T10:00:00.000Z",
      },
    ],
    fxRates: [
      {
        sourceCurrency: "USD",
        targetCurrency: "EUR",
        rate: "123456789012345678.123456789012345678",
        asOf: "2026-08-02T10:00:00.000Z",
      },
    ],
  };
}

describe("Supabase v2 repository", () => {
  test("maps canonical numerics from RPC strings without Number conversion", async () => {
    const transport = new FakeTransport();
    transport.response = stateDto();
    const repository = new SupabaseV2FinancialRepository(transport);
    const state = await repository.loadState();

    expect(state.transactions[0].legs[0].quantity.toString()).toBe("9007199254740993.01");
    expect(state.priceQuotes[0].unitPrice.amount.toString()).toBe("123456789012345678.12345678");
    expect(state.fxRates[0].rate.toString()).toBe("123456789012345678.123456789012345678");
    expect(transport.calls[0].name).toBe("v2_get_financial_state");
  });

  test("serializes transaction quantities as exact strings", async () => {
    const transport = new FakeTransport();
    const repository = new SupabaseV2FinancialRepository(transport);
    const owned = Account.create({
      id: accountId("account:owned"),
      name: "Owned",
      kind: "bank",
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
    const transaction = LedgerTransaction.create({
      id: transactionId("tx:large"),
      occurredAt: UtcTimestamp.parse("2026-08-01T10:00:00Z"),
      recordedAt: UtcTimestamp.parse("2026-08-01T10:00:01Z"),
      description: "Exact value",
      legs: [
        {
          id: transactionLegId("leg:owned"),
          accountId: owned.id,
          assetId: eur.id,
          quantity: "9007199254740993.01",
        },
        {
          id: transactionLegId("leg:external"),
          accountId: external.id,
          assetId: eur.id,
          quantity: "-9007199254740993.01",
        },
      ],
    });

    await repository.postTransaction(transaction);
    expect(transport.calls[0].name).toBe("v2_post_transaction");
    const payload = transport.calls[0].args.p_transaction as {
      legs: Array<{ quantity: string }>;
    };
    expect(payload.legs.map((leg) => leg.quantity)).toEqual([
      "9007199254740993.01",
      "-9007199254740993.01",
    ]);
  });

  test("serializes price and FX observations as exact decimal strings", async () => {
    const transport = new FakeTransport();
    const repository = new SupabaseV2FinancialRepository(transport);
    const asOf = UtcTimestamp.parse("2026-08-02T10:00:00Z");
    const quote = PriceQuote.create({
      assetId: assetId("asset:btc"),
      unitPrice: Money.of("123456789012345678.12345678", "EUR"),
      asOf,
    });
    const rate = FxRate.create({
      sourceCurrency: "USD",
      targetCurrency: "EUR",
      rate: "123456789012345678.123456789012345678",
      asOf,
    });

    await repository.appendPriceQuote(quote);
    await repository.appendFxRate(rate);

    expect(transport.calls[0]).toEqual({
      name: "v2_append_price_quote",
      args: {
        p_quote: {
          assetId: "asset:btc",
          amount: "123456789012345678.12345678",
          currency: "EUR",
          asOf: "2026-08-02T10:00:00.000Z",
        },
      },
    });
    expect(transport.calls[1]).toEqual({
      name: "v2_append_fx_rate",
      args: {
        p_rate: {
          sourceCurrency: "USD",
          targetCurrency: "EUR",
          rate: "123456789012345678.123456789012345678",
          asOf: "2026-08-02T10:00:00.000Z",
        },
      },
    });
  });

  test("uses stable authenticated UUID identity", async () => {
    const transport = new FakeTransport();
    transport.user = {
      id: "9bb11aa5-b809-4f1f-b699-fd6f9d8f58f1",
      email: "adam@example.test",
    };
    const identity = new SupabaseV2IdentityProvider(transport);
    const user = await identity.requireUser();
    expect(user.id).toBe("9bb11aa5-b809-4f1f-b699-fd6f9d8f58f1");
    expect(user.email).toBe("adam@example.test");
  });

  test("rejects malformed authenticated user IDs", async () => {
    const transport = new FakeTransport();
    transport.user = { id: "not-a-uuid", email: null };
    const identity = new SupabaseV2IdentityProvider(transport);
    await expect(identity.requireUser()).rejects.toThrow("valid UUID");
  });
});
