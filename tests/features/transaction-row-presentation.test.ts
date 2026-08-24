import { describe, expect, test } from "bun:test";
import type { TransactionView } from "../../src/application/view-models";
import { describeOwnedMovement } from "../../src/features/wealth-v2/transaction-row-presentation";

function transaction(legs: TransactionView["legs"]): TransactionView {
  return {
    id: "tx:test",
    occurredAt: "2026-08-20T10:00:00Z",
    recordedAt: "2026-08-20T10:00:00Z",
    description: "Test",
    purpose: "standard",
    state: "active",
    relatedTransactionId: null,
    legs,
  };
}

describe("transaction row presentation", () => {
  test("marks an asset entering an owned account as positive", () => {
    const tx = transaction([
      {
        id: "leg:owned",
        accountId: "account:wallet",
        accountName: "Wallet",
        assetId: "asset:eur",
        assetSymbol: "EUR",
        quantity: "100",
        memo: null,
      },
      {
        id: "leg:system",
        accountId: "account:income",
        accountName: "",
        assetId: "asset:eur",
        assetSymbol: "EUR",
        quantity: "-100",
        memo: null,
      },
    ]);

    expect(describeOwnedMovement(tx, "asset:eur", new Set(["account:wallet"]))).toEqual({
      flow: "Wallet",
      direction: "positive",
    });
  });

  test("marks an asset leaving an owned account as negative", () => {
    const tx = transaction([
      {
        id: "leg:owned",
        accountId: "account:card",
        accountName: "Credit Card",
        assetId: "asset:eur",
        assetSymbol: "EUR",
        quantity: "-60",
        memo: null,
      },
      {
        id: "leg:system",
        accountId: "account:expense",
        accountName: "",
        assetId: "asset:eur",
        assetSymbol: "EUR",
        quantity: "60",
        memo: null,
      },
    ]);

    expect(describeOwnedMovement(tx, "asset:eur", new Set(["account:card"]))).toEqual({
      flow: "Credit Card",
      direction: "negative",
    });
  });

  test("keeps an internal transfer neutral", () => {
    const tx = transaction([
      {
        id: "leg:bank",
        accountId: "account:bank",
        accountName: "Bank",
        assetId: "asset:eur",
        assetSymbol: "EUR",
        quantity: "-100",
        memo: null,
      },
      {
        id: "leg:cash",
        accountId: "account:cash",
        accountName: "Cash Wallet",
        assetId: "asset:eur",
        assetSymbol: "EUR",
        quantity: "100",
        memo: null,
      },
    ]);

    expect(
      describeOwnedMovement(tx, "asset:eur", new Set(["account:bank", "account:cash"])),
    ).toEqual({
      flow: "Bank → Cash Wallet",
      direction: "neutral",
    });
  });

  test("keeps an external market counterparty out of normal flow text", () => {
    const tx = transaction([
      {
        id: "leg:broker",
        accountId: "account:broker",
        accountName: "Axi Trading",
        assetId: "asset:eur",
        assetSymbol: "EUR",
        quantity: "65",
        memo: null,
      },
      {
        id: "leg:market",
        accountId: "account:market",
        accountName: "Market Counterparty",
        assetId: "asset:eur",
        assetSymbol: "EUR",
        quantity: "-65",
        memo: null,
      },
    ]);

    const result = describeOwnedMovement(tx, "asset:eur", new Set(["account:broker"]));
    expect(result.flow).toBe("Axi Trading");
    expect(result.direction).toBe("positive");
    expect(result.flow).not.toContain("Market Counterparty");
  });
});
