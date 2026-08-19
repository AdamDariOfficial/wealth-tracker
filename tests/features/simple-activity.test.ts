import { describe, expect, test } from "bun:test";
import { isBalancedDraft } from "../../src/features/wealth-v2/form-utils";
import { buildSimpleActivityDraft } from "../../src/features/wealth-v2/simple-activity";

describe("simple activity presentation boundary", () => {
  test("records an expense with a hidden system counterpart", () => {
    const legs = buildSimpleActivityDraft({
      kind: "expense",
      accountId: "account:bank",
      assetId: "asset:eur",
      amount: "25,50",
      expenseAccountId: "account:expense",
    });

    expect(legs.map((item) => [item.accountId, item.quantity])).toEqual([
      ["account:bank", "-25.5"],
      ["account:expense", "25.5"],
    ]);
    expect(isBalancedDraft(legs)).toBe(true);
  });

  test("records income without asking the user for the second side", () => {
    const legs = buildSimpleActivityDraft({
      kind: "income",
      accountId: "account:cash",
      assetId: "asset:eur",
      amount: "240",
      incomeAccountId: "account:income",
    });

    expect(legs.map((item) => [item.accountId, item.quantity])).toEqual([
      ["account:income", "-240"],
      ["account:cash", "240"],
    ]);
    expect(isBalancedDraft(legs)).toBe(true);
  });

  test("records a transfer directly between two owned accounts", () => {
    const legs = buildSimpleActivityDraft({
      kind: "transfer",
      accountId: "account:cash",
      destinationAccountId: "account:bank",
      assetId: "asset:eur",
      amount: "54.360,33",
    });

    expect(legs.map((item) => [item.accountId, item.quantity])).toEqual([
      ["account:cash", "-54360.33"],
      ["account:bank", "54360.33"],
    ]);
    expect(isBalancedDraft(legs)).toBe(true);
  });

  test("rejects zero, negative and same-account movements", () => {
    expect(() =>
      buildSimpleActivityDraft({
        kind: "expense",
        accountId: "account:bank",
        assetId: "asset:eur",
        amount: "0",
        expenseAccountId: "account:expense",
      }),
    ).toThrow();

    expect(() =>
      buildSimpleActivityDraft({
        kind: "income",
        accountId: "account:bank",
        assetId: "asset:eur",
        amount: "-1",
        incomeAccountId: "account:income",
      }),
    ).toThrow();

    expect(() =>
      buildSimpleActivityDraft({
        kind: "transfer",
        accountId: "account:bank",
        destinationAccountId: "account:bank",
        assetId: "asset:eur",
        amount: "10",
      }),
    ).toThrow();
  });
});
