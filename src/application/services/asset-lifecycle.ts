import type { AdvancedState } from "../advanced";
import type { PersistedFinancialState } from "../ports";

export type AssetDeletionBlocker = "transaction-history" | "goal" | "base-currency";

export interface AssetLifecycleWriter {
  deleteAsset(assetId: string): Promise<void>;
}

export function assetDeletionBlockers(
  financial: PersistedFinancialState,
  advanced: AdvancedState,
  assetId: string,
): readonly AssetDeletionBlocker[] {
  const asset = financial.assets.find((item) => item.id.toString() === assetId);
  if (!asset) throw new Error("Asset not found.");

  const blockers: AssetDeletionBlocker[] = [];
  if (
    financial.transactions.some((transaction) =>
      transaction.legs.some((leg) => leg.assetId.toString() === assetId),
    )
  ) {
    blockers.push("transaction-history");
  }
  if (advanced.goals.some((goal) => goal.targetAssetId === assetId)) blockers.push("goal");
  if (
    asset.kind === "fiat" &&
    financial.profile?.baseCurrency?.toString() === asset.fiatCurrency?.toString()
  ) {
    blockers.push("base-currency");
  }
  return Object.freeze(blockers);
}

export async function deleteValidatedUnusedAsset(
  repository: AssetLifecycleWriter,
  financial: PersistedFinancialState,
  advanced: AdvancedState,
  assetId: string,
): Promise<void> {
  const blockers = assetDeletionBlockers(financial, advanced, assetId);
  if (blockers.length > 0) {
    if (blockers.includes("transaction-history")) {
      throw new Error("This asset has transaction history and cannot be deleted.");
    }
    if (blockers.includes("goal")) {
      throw new Error("This asset is used by a goal and cannot be deleted.");
    }
    throw new Error("The base-currency asset cannot be deleted.");
  }
  await repository.deleteAsset(assetId);
}
