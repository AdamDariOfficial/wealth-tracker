import type { TransactionView } from "@/application/view-models";
import { Decimal } from "@/domain/core";

export type MovementDirection = "positive" | "negative" | "neutral";

export type OwnedMovementPresentation = Readonly<{
  flow: string | null;
  direction: MovementDirection;
}>;

function pushUnique(values: string[], value: string): void {
  if (!value || values.includes(value)) return;
  values.push(value);
}

/**
 * Presents one asset movement only through accounts the user owns.
 *
 * External/system counterparties remain part of the canonical transaction but
 * are intentionally hidden from normal reading surfaces.
 */
export function describeOwnedMovement(
  transaction: TransactionView,
  assetId: string,
  ownedAccountIds: ReadonlySet<string>,
): OwnedMovementPresentation {
  const from: string[] = [];
  const to: string[] = [];

  for (const leg of transaction.legs) {
    if (leg.assetId !== assetId || !ownedAccountIds.has(leg.accountId)) continue;
    const quantity = Decimal.parse(leg.quantity);
    if (quantity.isNegative()) pushUnique(from, leg.accountName);
    else if (!quantity.isZero()) pushUnique(to, leg.accountName);
  }

  const fromLabel = from.join(", ");
  const toLabel = to.join(", ");
  const flow = fromLabel && toLabel ? `${fromLabel} → ${toLabel}` : fromLabel || toLabel || null;

  const direction: MovementDirection =
    to.length > 0 && from.length === 0
      ? "positive"
      : from.length > 0 && to.length === 0
        ? "negative"
        : "neutral";

  return Object.freeze({ flow, direction });
}
