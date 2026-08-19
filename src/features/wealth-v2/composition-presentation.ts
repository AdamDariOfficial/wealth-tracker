import type { AllocationView } from "@/application/view-models";
import { Decimal } from "@/domain/core";

export type CompositionPresentation = Readonly<{
  hasNegative: boolean;
  positiveSlices: readonly AllocationView[];
}>;

/**
 * Prepares canonical asset-class amounts for donut geometry without changing
 * their financial meaning. A donut cannot encode signed values faithfully, so
 * any negative slice disables the chart instead of converting it to a positive
 * magnitude. Zero slices are omitted because they have no visible geometry.
 */
export function prepareCompositionPresentation(
  slices: readonly AllocationView[],
): CompositionPresentation {
  let hasNegative = false;
  const positiveSlices: AllocationView[] = [];

  for (const slice of slices) {
    const amount = Decimal.parse(slice.amount);
    if (amount.isNegative()) {
      hasNegative = true;
      continue;
    }
    if (!amount.isZero()) positiveSlices.push(slice);
  }

  return Object.freeze({
    hasNegative,
    positiveSlices: Object.freeze(positiveSlices),
  });
}
