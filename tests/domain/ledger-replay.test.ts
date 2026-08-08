import { describe, expect, test } from "bun:test";
import { Account, accountId } from "../../src/domain/accounts";
import { Asset, assetId } from "../../src/domain/assets";
import { UtcTimestamp } from "../../src/domain/core";
import {
  LedgerDatasetError,
  LedgerTransaction,
  replayLedger,
  transactionId,
  transactionLegId,
} from "../../src/domain/ledger";

const owned = Account.create({
  id: accountId("account-owned"),
  name: "Owned account",
  kind: "broker",
  ownership: "owned",
  includeInNetWorth: true,
});
const external = Account.create({
  id: accountId("account-external"),
  name: "External counterparty",
  kind: "external",
  ownership: "external",
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

function fundingTransaction(id = "tx-funding"): LedgerTransaction {
  return LedgerTransaction.create({
    id: transactionId(id),
    occurredAt: UtcTimestamp.parse("2026-01-01T00:00:00Z"),
    recordedAt: UtcTimestamp.parse("2026-01-01T00:01:00Z"),
    description: "Funding",
    legs: [
      {
        id: transactionLegId(`${id}-owned`),
        accountId: owned.id,
        assetId: eur.id,
        quantity: "1000",
      },
      {
        id: transactionLegId(`${id}-external`),
        accountId: external.id,
        assetId: eur.id,
        quantity: "-1000",
      },
    ],
  });
}

describe("replayLedger", () => {
  test("derives balances from the immutable transaction sequence", () => {
    const transaction = fundingTransaction();
    const snapshot = replayLedger({
      accounts: [owned, external],
      assets: [eur],
      transactions: [transaction],
    });

    expect(snapshot.quantity(owned.id, eur.id).toString()).toBe("1000");
    expect(snapshot.quantity(external.id, eur.id).toString()).toBe("-1000");
    expect(snapshot.auditStates[0].state).toBe("active");
  });

  test("reversal removes the original economic effect without mutating it", () => {
    const original = fundingTransaction();
    const reversal = LedgerTransaction.createReversal({
      id: transactionId("tx-funding-void"),
      original,
      recordedAt: UtcTimestamp.parse("2026-01-02T00:00:00Z"),
      legIds: [transactionLegId("leg-void-owned"), transactionLegId("leg-void-external")],
    });
    const snapshot = replayLedger({
      accounts: [owned, external],
      assets: [eur],
      transactions: [reversal, original],
    });

    expect(snapshot.quantity(owned.id, eur.id).toString()).toBe("0");
    expect(snapshot.balances).toHaveLength(0);
    const originalState = snapshot.auditStates.find((state) =>
      state.transactionId.equals(original.id),
    );
    expect(originalState?.state).toBe("voided");
    expect(
      snapshot.auditStates.find((state) => state.transactionId.equals(reversal.id))?.state,
    ).toBe("reversal");
  });

  test("rejects a reversal that changes the original economic timestamp", () => {
    const original = fundingTransaction();
    const shiftedReversal = LedgerTransaction.create({
      id: transactionId("tx-shifted-reversal"),
      occurredAt: UtcTimestamp.parse("2026-01-01T00:30:00Z"),
      recordedAt: UtcTimestamp.parse("2026-01-02T00:00:00Z"),
      description: "Invalid shifted reversal",
      purpose: "reversal",
      relatedTransactionId: original.id,
      legs: [
        {
          id: transactionLegId("leg-shifted-reversal-owned"),
          accountId: owned.id,
          assetId: eur.id,
          quantity: "-1000",
        },
        {
          id: transactionLegId("leg-shifted-reversal-external"),
          accountId: external.id,
          assetId: eur.id,
          quantity: "1000",
        },
      ],
    });

    expect(() =>
      replayLedger({
        accounts: [owned, external],
        assets: [eur],
        transactions: [original, shiftedReversal],
      }),
    ).toThrow(LedgerDatasetError);
  });

  test("replacement requires the target to be reversed first", () => {
    const original = fundingTransaction();
    const replacement = LedgerTransaction.create({
      id: transactionId("tx-funding-replacement"),
      occurredAt: original.occurredAt,
      recordedAt: UtcTimestamp.parse("2026-01-02T00:01:00Z"),
      description: "Corrected funding",
      purpose: "replacement",
      relatedTransactionId: original.id,
      legs: [
        {
          id: transactionLegId("leg-replacement-owned"),
          accountId: owned.id,
          assetId: eur.id,
          quantity: "900",
        },
        {
          id: transactionLegId("leg-replacement-external"),
          accountId: external.id,
          assetId: eur.id,
          quantity: "-900",
        },
      ],
    });

    expect(() =>
      replayLedger({
        accounts: [owned, external],
        assets: [eur],
        transactions: [original, replacement],
      }),
    ).toThrow(LedgerDatasetError);
  });

  test("replays a void and replacement as one corrected result", () => {
    const original = fundingTransaction();
    const reversal = LedgerTransaction.createReversal({
      id: transactionId("tx-funding-void"),
      original,
      recordedAt: UtcTimestamp.parse("2026-01-02T00:00:00Z"),
      legIds: [transactionLegId("leg-void-owned"), transactionLegId("leg-void-external")],
    });
    const replacement = LedgerTransaction.create({
      id: transactionId("tx-funding-replacement"),
      occurredAt: original.occurredAt,
      recordedAt: UtcTimestamp.parse("2026-01-02T00:01:00Z"),
      description: "Corrected funding",
      purpose: "replacement",
      relatedTransactionId: original.id,
      legs: [
        {
          id: transactionLegId("leg-replacement-owned"),
          accountId: owned.id,
          assetId: eur.id,
          quantity: "900",
        },
        {
          id: transactionLegId("leg-replacement-external"),
          accountId: external.id,
          assetId: eur.id,
          quantity: "-900",
        },
      ],
    });
    const snapshot = replayLedger({
      accounts: [owned, external],
      assets: [eur],
      transactions: [replacement, reversal, original],
    });

    expect(snapshot.quantity(owned.id, eur.id).toString()).toBe("900");
    const originalState = snapshot.auditStates.find((state) =>
      state.transactionId.equals(original.id),
    );
    expect(originalState?.state).toBe("replaced");
    expect(
      snapshot.auditStates.find((state) => state.transactionId.equals(replacement.id))?.state,
    ).toBe("replacement");
  });

  test("rejects corrections that target another correction", () => {
    const original = fundingTransaction();
    const reversal = LedgerTransaction.createReversal({
      id: transactionId("tx-correction-target-reversal"),
      original,
      recordedAt: UtcTimestamp.parse("2026-01-02T00:00:00Z"),
      legIds: [
        transactionLegId("leg-correction-target-owned"),
        transactionLegId("leg-correction-target-external"),
      ],
    });
    const chainedReplacement = LedgerTransaction.create({
      id: transactionId("tx-chained-replacement"),
      occurredAt: reversal.occurredAt,
      recordedAt: UtcTimestamp.parse("2026-01-03T00:00:00Z"),
      description: "Invalid correction chain",
      purpose: "replacement",
      relatedTransactionId: reversal.id,
      legs: [
        {
          id: transactionLegId("leg-chained-owned"),
          accountId: owned.id,
          assetId: eur.id,
          quantity: "800",
        },
        {
          id: transactionLegId("leg-chained-external"),
          accountId: external.id,
          assetId: eur.id,
          quantity: "-800",
        },
      ],
    });

    expect(() =>
      replayLedger({
        accounts: [owned, external],
        assets: [eur],
        transactions: [original, reversal, chainedReplacement],
      }),
    ).toThrow(LedgerDatasetError);
  });

  test("rejects unknown account and asset references", () => {
    const transaction = fundingTransaction();

    expect(() =>
      replayLedger({
        accounts: [owned],
        assets: [eur],
        transactions: [transaction],
      }),
    ).toThrow(LedgerDatasetError);
  });

  test("rejects quantities beyond the asset precision", () => {
    const imprecise = LedgerTransaction.create({
      id: transactionId("tx-imprecise"),
      occurredAt: UtcTimestamp.parse("2026-01-01T00:00:00Z"),
      recordedAt: UtcTimestamp.parse("2026-01-01T00:01:00Z"),
      description: "Imprecise fiat",
      legs: [
        {
          id: transactionLegId("leg-imprecise-owned"),
          accountId: owned.id,
          assetId: eur.id,
          quantity: "1.001",
        },
        {
          id: transactionLegId("leg-imprecise-external"),
          accountId: external.id,
          assetId: eur.id,
          quantity: "-1.001",
        },
      ],
    });

    expect(() =>
      replayLedger({
        accounts: [owned, external],
        assets: [eur],
        transactions: [imprecise],
      }),
    ).toThrow(LedgerDatasetError);
  });

  test("rejects transactions outside an account lifecycle", () => {
    const archived = Account.create({
      id: accountId("account-archived"),
      name: "Archived account",
      kind: "bank",
      ownership: "owned",
      includeInNetWorth: true,
      openedAt: UtcTimestamp.parse("2025-01-01T00:00:00Z"),
      archivedAt: UtcTimestamp.parse("2025-12-31T23:59:59Z"),
    });
    const late = LedgerTransaction.create({
      id: transactionId("tx-late"),
      occurredAt: UtcTimestamp.parse("2026-01-01T00:00:00Z"),
      recordedAt: UtcTimestamp.parse("2026-01-01T00:01:00Z"),
      description: "Late transaction",
      legs: [
        {
          id: transactionLegId("leg-late-owned"),
          accountId: archived.id,
          assetId: eur.id,
          quantity: "1",
        },
        {
          id: transactionLegId("leg-late-external"),
          accountId: external.id,
          assetId: eur.id,
          quantity: "-1",
        },
      ],
    });

    expect(() =>
      replayLedger({
        accounts: [archived, external],
        assets: [eur],
        transactions: [late],
      }),
    ).toThrow(LedgerDatasetError);
  });

  test("rejects duplicate transaction IDs", () => {
    const first = fundingTransaction("tx-duplicate");
    const second = fundingTransaction("tx-duplicate");

    expect(() =>
      replayLedger({
        accounts: [owned, external],
        assets: [eur],
        transactions: [first, second],
      }),
    ).toThrow(LedgerDatasetError);
  });
});
