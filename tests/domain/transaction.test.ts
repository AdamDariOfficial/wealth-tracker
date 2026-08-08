import { describe, expect, test } from "bun:test";
import { accountId } from "../../src/domain/accounts";
import { assetId } from "../../src/domain/assets";
import { UtcTimestamp } from "../../src/domain/core";
import {
  LedgerTransaction,
  TransactionInvariantError,
  transactionId,
  transactionLegId,
} from "../../src/domain/ledger";

const occurredAt = UtcTimestamp.parse("2026-01-01T10:00:00Z");
const recordedAt = UtcTimestamp.parse("2026-01-01T10:05:00Z");
const cashAccount = accountId("account-cash");
const counterpartyAccount = accountId("account-counterparty");
const eurAsset = assetId("asset-eur");

function createDeposit(): LedgerTransaction {
  return LedgerTransaction.create({
    id: transactionId("tx-deposit"),
    occurredAt,
    recordedAt,
    description: "Initial funding",
    legs: [
      {
        id: transactionLegId("leg-deposit-owned"),
        accountId: cashAccount,
        assetId: eurAsset,
        quantity: "1000.00",
      },
      {
        id: transactionLegId("leg-deposit-external"),
        accountId: counterpartyAccount,
        assetId: eurAsset,
        quantity: "-1000.00",
      },
    ],
  });
}

describe("LedgerTransaction", () => {
  test("creates a balanced immutable transaction", () => {
    const transaction = createDeposit();

    expect(transaction.purpose).toBe("standard");
    expect(transaction.relatedTransactionId).toBeNull();
    expect(transaction.legs).toHaveLength(2);
    expect(transaction.legs[0].quantity.toString()).toBe("1000");
  });

  test("rejects unbalanced quantities by asset", () => {
    expect(() =>
      LedgerTransaction.create({
        id: transactionId("tx-unbalanced"),
        occurredAt,
        recordedAt,
        description: "Broken funding",
        legs: [
          {
            id: transactionLegId("leg-unbalanced-1"),
            accountId: cashAccount,
            assetId: eurAsset,
            quantity: "100",
          },
          {
            id: transactionLegId("leg-unbalanced-2"),
            accountId: counterpartyAccount,
            assetId: eurAsset,
            quantity: "-99",
          },
        ],
      }),
    ).toThrow(TransactionInvariantError);
  });

  test("rejects duplicate account and asset pairs", () => {
    expect(() =>
      LedgerTransaction.create({
        id: transactionId("tx-duplicate-pair"),
        occurredAt,
        recordedAt,
        description: "Duplicate pair",
        legs: [
          {
            id: transactionLegId("leg-duplicate-1"),
            accountId: cashAccount,
            assetId: eurAsset,
            quantity: "25",
          },
          {
            id: transactionLegId("leg-duplicate-2"),
            accountId: cashAccount,
            assetId: eurAsset,
            quantity: "-25",
          },
        ],
      }),
    ).toThrow(TransactionInvariantError);
  });

  test("creates an exact immutable reversal", () => {
    const original = createDeposit();
    const reversal = LedgerTransaction.createReversal({
      id: transactionId("tx-deposit-reversal"),
      original,
      recordedAt: UtcTimestamp.parse("2026-01-02T10:00:00Z"),
      legIds: [transactionLegId("leg-reversal-owned"), transactionLegId("leg-reversal-external")],
    });

    expect(reversal.purpose).toBe("reversal");
    expect(reversal.relatedTransactionId?.equals(original.id)).toBe(true);
    expect(reversal.legs[0].quantity.toString()).toBe("-1000");
    expect(reversal.legs[1].quantity.toString()).toBe("1000");
  });

  test("rejects reversal chains and non-later recording times", () => {
    const original = createDeposit();
    const reversal = LedgerTransaction.createReversal({
      id: transactionId("tx-first-reversal"),
      original,
      recordedAt: UtcTimestamp.parse("2026-01-02T10:00:00Z"),
      legIds: [
        transactionLegId("leg-first-reversal-owned"),
        transactionLegId("leg-first-reversal-external"),
      ],
    });

    expect(() =>
      LedgerTransaction.createReversal({
        id: transactionId("tx-reversal-chain"),
        original: reversal,
        recordedAt: UtcTimestamp.parse("2026-01-03T10:00:00Z"),
        legIds: [transactionLegId("leg-chain-owned"), transactionLegId("leg-chain-external")],
      }),
    ).toThrow(TransactionInvariantError);

    expect(() =>
      LedgerTransaction.createReversal({
        id: transactionId("tx-same-time-reversal"),
        original,
        recordedAt: original.recordedAt,
        legIds: [
          transactionLegId("leg-same-time-owned"),
          transactionLegId("leg-same-time-external"),
        ],
      }),
    ).toThrow(TransactionInvariantError);
  });

  test("requires correction relationships", () => {
    expect(() =>
      LedgerTransaction.create({
        id: transactionId("tx-invalid-reversal"),
        occurredAt,
        recordedAt,
        description: "Invalid reversal",
        purpose: "reversal",
        legs: createDeposit().legs,
      }),
    ).toThrow(TransactionInvariantError);
  });
});
