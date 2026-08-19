import { describe, expect, test } from "bun:test";
import { Money } from "../../src/domain/core";
import { normalizeLocalizedDecimalInput } from "../../src/features/wealth-v2/form-utils";
import { formatMoney, formatQuantity } from "../../src/features/wealth-v2/format";

describe("Phase 3 financial presentation", () => {
  test("formats large money values without converting the canonical amount to Number", () => {
    const rendered = formatMoney(Money.of("900719925474099112345.67", "EUR"), "en-US");
    expect(rendered).toContain("900,719,925,474,099,112,345.67");
  });

  test("rounds display quantity without changing the underlying decimal contract", () => {
    expect(formatQuantity("0.123456789", 8)).toBe("0,12345679");
  });

  test("defaults financial display to Italian formatting", () => {
    expect(formatMoney(Money.of("54360.33", "EUR"))).toContain("54.360,33");
  });

  test("groups four-digit Italian money values with a dot", () => {
    const rendered = formatMoney(Money.of("3078", "EUR"));
    expect(rendered).toContain("3.078,00");
    expect(rendered).not.toContain("3,078,00");
  });

  test("normalizes common Italian decimal inputs without changing canonical storage", () => {
    expect(normalizeLocalizedDecimalInput("0,87")).toBe("0.87");
    expect(normalizeLocalizedDecimalInput("54.360,33")).toBe("54360.33");
    expect(normalizeLocalizedDecimalInput("54360.33")).toBe("54360.33");
  });
});
