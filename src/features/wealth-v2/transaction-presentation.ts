import type { TransactionView } from "@/application/view-models";
import { Decimal } from "@/domain/core";

/**
 * Presentation-only reading of a canonical transaction.
 *
 * A ledger transaction is a balanced set of legs. Showing its *first* leg as
 * though it represented the transaction is wrong: it silently picks one side
 * of a movement and hides the other. Instead we read every leg, group by
 * asset, and describe the movement as it actually happened.
 *
 * No arithmetic here changes canonical data — quantities stay Decimal and are
 * only summed to describe what moved.
 */

export type AssetMovementView = Readonly<{
  assetId: string;
  symbol: string;
  /** Absolute quantity that moved for this asset (the credited side). */
  quantity: string;
  /** Accounts the asset left, in leg order, de-duplicated. */
  from: readonly string[];
  /** Accounts the asset arrived in, in leg order, de-duplicated. */
  to: readonly string[];
}>;

function pushUnique(target: string[], value: string): void {
  if (!value || target.includes(value)) return;
  target.push(value);
}

export function summarizeTransaction(transaction: TransactionView): readonly AssetMovementView[] {
  const byAsset = new Map<
    string,
    { assetId: string; symbol: string; credited: Decimal; from: string[]; to: string[] }
  >();

  for (const leg of transaction.legs) {
    let entry = byAsset.get(leg.assetId);
    if (!entry) {
      entry = {
        assetId: leg.assetId,
        symbol: leg.assetSymbol,
        credited: Decimal.zero(),
        from: [],
        to: [],
      };
      byAsset.set(leg.assetId, entry);
    }

    const quantity = Decimal.parse(leg.quantity);
    if (quantity.isNegative()) {
      pushUnique(entry.from, leg.accountName);
    } else if (!quantity.isZero()) {
      entry.credited = entry.credited.plus(quantity);
      pushUnique(entry.to, leg.accountName);
    }
  }

  return Object.freeze(
    [...byAsset.values()].map((entry) =>
      Object.freeze({
        assetId: entry.assetId,
        symbol: entry.symbol,
        quantity: entry.credited.toString(),
        from: Object.freeze([...entry.from]),
        to: Object.freeze([...entry.to]),
      }),
    ),
  );
}

/**
 * "Bank → Broker", "Broker" or "Bank, Savings → Broker" depending on shape.
 * Returns null when the movement touches no named account.
 */
export function describeMovementFlow(movement: AssetMovementView): string | null {
  const from = movement.from.join(", ");
  const to = movement.to.join(", ");
  if (from && to) return `${from} → ${to}`;
  return from || to || null;
}
