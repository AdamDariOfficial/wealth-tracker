import { describe, expect, test } from "bun:test";
import { Money } from "../../src/domain/core";
import { formatMoney, formatQuantity } from "../../src/features/wealth-v2/format";

describe("Phase 3 financial presentation", () => {
  test("formats large money values without converting the canonical amount to Number", () => {
    const rendered = formatMoney(Money.of("900719925474099112345.67", "EUR"), "en-US");
    expect(rendered).toContain("900,719,925,474,099,112,345.67");
  });

  test("rounds display quantity without changing the underlying decimal contract", () => {
    expect(formatQuantity("0.123456789", 8)).toBe("0.12345679");
  });
});
