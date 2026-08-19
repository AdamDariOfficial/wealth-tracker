import { describe, expect, test } from "bun:test";
import type { AllocationView } from "../../src/application/view-models";
import { prepareCompositionPresentation } from "../../src/features/wealth-v2/composition-presentation";

function slice(kind: AllocationView["kind"], amount: string): AllocationView {
  return Object.freeze({ kind, amount, currency: "EUR" });
}

describe("composition presentation", () => {
  test("keeps positive canonical amounts and omits zero-only geometry", () => {
    const result = prepareCompositionPresentation([slice("fiat", "1200"), slice("crypto", "0")]);

    expect(result.hasNegative).toBe(false);
    expect(result.positiveSlices.map((item) => item.amount)).toEqual(["1200"]);
  });

  test("flags signed composition instead of converting a negative amount to a positive slice", () => {
    const result = prepareCompositionPresentation([slice("fiat", "1200"), slice("crypto", "-250")]);

    expect(result.hasNegative).toBe(true);
    expect(result.positiveSlices.map((item) => item.amount)).toEqual(["1200"]);
  });
});
