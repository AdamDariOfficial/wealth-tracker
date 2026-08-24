import { describe, expect, test } from "bun:test";
import type { AdvancedState } from "../../src/application/advanced";
import type { PersistedFinancialState } from "../../src/application/ports";
import { assetDeletionBlockers } from "../../src/application/services/asset-lifecycle";

function asFinancialState(value: unknown): PersistedFinancialState {
  return value as PersistedFinancialState;
}

function asAdvancedState(value: unknown): AdvancedState {
  return value as AdvancedState;
}

const asset = (id: string, symbol: string, kind = "other") => ({
  id: { toString: () => id },
  symbol,
  kind,
  fiatCurrency: kind === "fiat" ? { toString: () => symbol } : null,
});

const leg = (id: string) => ({ assetId: { toString: () => id } });

describe("asset deletion blockers", () => {
  test("unused asset is deletable even when it has quotes", () => {
    const financial = asFinancialState({
      profile: { baseCurrency: { toString: () => "EUR" } },
      accounts: [],
      assets: [asset("asset:x", "X")],
      transactions: [],
      priceQuotes: [{}],
      fxRates: [],
    });
    const advanced = asAdvancedState({
      goals: [],
      tradingSettings: null,
      weeklyReviews: [],
      importBatches: [],
    });

    expect(assetDeletionBlockers(financial, advanced, "asset:x")).toEqual([]);
  });

  test("transaction history blocks deletion", () => {
    const financial = asFinancialState({
      profile: null,
      accounts: [],
      assets: [asset("asset:x", "X")],
      transactions: [{ legs: [leg("asset:x")] }],
      priceQuotes: [],
      fxRates: [],
    });
    const advanced = asAdvancedState({
      goals: [],
      tradingSettings: null,
      weeklyReviews: [],
      importBatches: [],
    });

    expect(assetDeletionBlockers(financial, advanced, "asset:x")).toContain("transaction-history");
  });

  test("goal and base currency block deletion", () => {
    const financial = asFinancialState({
      profile: { baseCurrency: { toString: () => "EUR" } },
      accounts: [],
      assets: [asset("asset:eur", "EUR", "fiat")],
      transactions: [],
      priceQuotes: [],
      fxRates: [],
    });
    const advanced = asAdvancedState({
      goals: [{ targetAssetId: "asset:eur" }],
      tradingSettings: null,
      weeklyReviews: [],
      importBatches: [],
    });

    expect(assetDeletionBlockers(financial, advanced, "asset:eur")).toEqual([
      "goal",
      "base-currency",
    ]);
  });
});
