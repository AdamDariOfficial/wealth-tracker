import { describe, expect, test } from "bun:test";
import type { TransactionView } from "../../src/application/view-models";
import {
  describeMovementFlow,
  summarizeTransaction,
} from "../../src/features/wealth-v2/transaction-presentation";

function view(legs: TransactionView["legs"]): TransactionView {
  return {
    id: "tx:1",
    occurredAt: "2026-08-01T10:00:00.000Z",
    recordedAt: "2026-08-01T10:00:00.000Z",
    description: "Move cash",
    purpose: "standard",
    state: "active",
    relatedTransactionId: null,
    legs,
  };
}

const leg = (
  id: string,
  accountName: string,
  assetSymbol: string,
  quantity: string,
): TransactionView["legs"][number] => ({
  id,
  accountId: `account:${accountName}`,
  accountName,
  assetId: `asset:${assetSymbol}`,
  assetSymbol,
  quantity,
  memo: null,
});

describe("transaction presentation", () => {
  test("describes a transfer from both sides instead of a single leg", () => {
    const movements = summarizeTransaction(
      view([leg("l1", "Bank", "EUR", "-1000"), leg("l2", "Broker", "EUR", "1000")]),
    );

    expect(movements).toHaveLength(1);
    expect(movements[0]?.quantity).toBe("1000");
    expect(describeMovementFlow(movements[0]!)).toBe("Bank → Broker");
  });

  test("keeps every asset in a multi-asset transaction", () => {
    const movements = summarizeTransaction(
      view([
        leg("l1", "Broker", "EUR", "-4200"),
        leg("l2", "Market", "EUR", "4200"),
        leg("l3", "Market", "BTC", "-0.1"),
        leg("l4", "Broker", "BTC", "0.1"),
      ]),
    );

    expect(movements.map((movement) => movement.symbol)).toEqual(["EUR", "BTC"]);
    expect(describeMovementFlow(movements[0]!)).toBe("Broker → Market");
    expect(describeMovementFlow(movements[1]!)).toBe("Market → Broker");
    expect(movements[1]?.quantity).toBe("0.1");
  });

  test("sums split legs rather than reporting only the first", () => {
    const movements = summarizeTransaction(
      view([
        leg("l1", "Salary", "EUR", "-1500"),
        leg("l2", "Bank", "EUR", "1000"),
        leg("l3", "Savings", "EUR", "500"),
      ]),
    );

    expect(movements[0]?.quantity).toBe("1500");
    expect(describeMovementFlow(movements[0]!)).toBe("Salary → Bank, Savings");
  });
});
