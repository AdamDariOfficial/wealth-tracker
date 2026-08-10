import { describe, expect, test } from "bun:test";
import {
  isBalancedDraft,
  normalizeCurrency,
  toLocalDateTimeInputValue,
  type DraftLeg,
} from "../../src/features/wealth-v2/form-utils";

const leg = (rowId: string, accountId: string, assetId: string, quantity: string): DraftLeg => ({
  rowId,
  accountId,
  assetId,
  quantity,
  memo: "",
});

describe("transaction form utilities", () => {
  test("requires exact balance independently per asset", () => {
    expect(
      isBalancedDraft([
        leg("1", "account:a", "asset:eur", "100.00"),
        leg("2", "account:b", "asset:eur", "-100"),
      ]),
    ).toBe(true);
    expect(
      isBalancedDraft([
        leg("1", "account:a", "asset:eur", "100"),
        leg("2", "account:b", "asset:usd", "-100"),
      ]),
    ).toBe(false);
  });

  test("rejects zero, malformed and incomplete draft legs", () => {
    expect(
      isBalancedDraft([
        leg("1", "account:a", "asset:eur", "0"),
        leg("2", "account:b", "asset:eur", "0"),
      ]),
    ).toBe(false);
    expect(
      isBalancedDraft([
        leg("1", "account:a", "asset:eur", "abc"),
        leg("2", "account:b", "asset:eur", "-1"),
      ]),
    ).toBe(false);
    expect(
      isBalancedDraft([leg("1", "", "asset:eur", "1"), leg("2", "account:b", "asset:eur", "-1")]),
    ).toBe(false);
  });

  test("rejects duplicate account and asset pairs before domain validation", () => {
    expect(
      isBalancedDraft([
        leg("1", "account:a", "asset:eur", "50"),
        leg("2", "account:a", "asset:eur", "50"),
        leg("3", "account:b", "asset:eur", "-100"),
      ]),
    ).toBe(false);
  });

  test("normalizes currency without inventing a rate", () => {
    expect(normalizeCurrency(" eur ")).toBe("EUR");
  });

  test("formats datetime-local values in local calendar time", () => {
    const value = new Date(2026, 7, 10, 14, 5, 30);
    expect(toLocalDateTimeInputValue(value)).toBe("2026-08-10T14:05");
  });
});
