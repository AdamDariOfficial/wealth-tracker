import { describe, expect, test } from "bun:test";
import { createReversalTransaction } from "../../src/application/commands";
import { Account, accountId } from "../../src/domain/accounts";
import { Asset, assetId } from "../../src/domain/assets";
import { UtcTimestamp } from "../../src/domain/core";
import { LedgerTransaction, transactionId, transactionLegId } from "../../src/domain/ledger";

const at = (value: string) => UtcTimestamp.parse(value);

function originalTransaction() {
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

  return LedgerTransaction.create({
    id: transactionId("tx:original"),
    occurredAt: at("2026-08-10T12:00:00.000Z"),
    recordedAt: at("2026-08-10T12:00:00.500Z"),
    description: "Original",
    legs: [
      {
        id: transactionLegId("leg:owned"),
        accountId: owned.id,
        assetId: eur.id,
        quantity: "10",
      },
      {
        id: transactionLegId("leg:external"),
        accountId: external.id,
        assetId: eur.id,
        quantity: "-10",
      },
    ],
  });
}

describe("Phase 3 reversal command", () => {
  test("preserves economic time and records strictly after the target", () => {
    const original = originalTransaction();
    const reversal = createReversalTransaction({
      id: transactionId("tx:reversal"),
      original,
      legIds: [transactionLegId("leg:r1"), transactionLegId("leg:r2")],
      now: new Date("2026-08-10T12:00:00.100Z"),
    });

    expect(reversal.occurredAt.toString()).toBe(original.occurredAt.toString());
    expect(reversal.recordedAt.toEpochMilliseconds()).toBe(
      original.recordedAt.toEpochMilliseconds() + 1,
    );
    expect(reversal.legs.map((leg) => leg.quantity.toString())).toEqual(["-10", "10"]);
  });

  test("uses current time when it is already later than the target", () => {
    const original = originalTransaction();
    const now = new Date("2026-08-10T12:00:02.000Z");
    const reversal = createReversalTransaction({
      id: transactionId("tx:reversal-later"),
      original,
      legIds: [transactionLegId("leg:r3"), transactionLegId("leg:r4")],
      now,
    });

    expect(reversal.recordedAt.toString()).toBe("2026-08-10T12:00:02.000Z");
  });
});
