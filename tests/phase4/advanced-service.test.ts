import { describe, expect, test } from "bun:test";
import type {
  AdvancedState,
  BackupEnvelope,
  GoalInput,
  ImportBatchInput,
  TradingSettingsInput,
  WeeklyReviewInput,
} from "../../src/application/advanced";
import type { AdvancedRepository } from "../../src/application/ports";
import { userProfile } from "../../src/application/profile";
import {
  computeConsistencyScore,
  normalizeGoalInput,
  normalizeTradingSettings,
  normalizeWeeklyReview,
  validateBackupEnvelope,
} from "../../src/application/services";
import { Account, accountId } from "../../src/domain/accounts";
import { Asset, assetId } from "../../src/domain/assets";
import { replayLedger } from "../../src/domain/ledger";

class FakeAdvancedRepository implements AdvancedRepository {
  state: AdvancedState = {
    goals: [],
    tradingSettings: null,
    weeklyReviews: [],
    importBatches: [],
  };
  async loadState() {
    return this.state;
  }
  async putGoal(_input: GoalInput) {}
  async archiveGoal(_goalId: string) {}
  async putTradingSettings(_input: TradingSettingsInput) {}
  async putWeeklyReview(_input: WeeklyReviewInput) {}
  async finalizeWeeklyReview(_reviewId: string) {}
  async deleteWeeklyReview(_reviewId: string) {}
  async importBatch(_input: ImportBatchInput) {}
  async rollbackImportBatch(_batchId: string) {}
  async exportBackup(): Promise<BackupEnvelope> {
    throw new Error("not used");
  }
  async restoreBackup(_backup: BackupEnvelope) {}
  async resetWorkspace(_confirmation: string) {}
}

function state() {
  const bank = Account.create({
    id: accountId("account:bank"),
    name: "Bank",
    kind: "bank",
    ownership: "owned",
    includeInNetWorth: true,
  });
  const external = Account.create({
    id: accountId("account:external"),
    name: "External",
    kind: "external",
    ownership: "external",
    includeInNetWorth: false,
  });
  const btc = Asset.create({
    id: assetId("asset:btc"),
    symbol: "BTC",
    name: "Bitcoin",
    kind: "crypto",
    precision: 8,
  });
  const accounts = [bank, external];
  const assets = [btc];
  return {
    profile: userProfile({
      displayName: "Adam",
      baseCurrency: "EUR",
      locale: "it-IT",
      onboarded: true,
    }),
    accounts,
    assets,
    transactions: [],
    priceQuotes: [],
    fxRates: [],
    snapshot: replayLedger({ accounts, assets, transactions: [] }),
  };
}

describe("Phase 4 advanced application validation", () => {
  test("normalizes goal targets without Number conversion", () => {
    const result = normalizeGoalInput(state(), {
      id: "goal:btc",
      name: "One BTC",
      kind: "asset_quantity",
      targetAssetId: "asset:btc",
      targetQuantity: "1.00000000",
    });
    expect(result.targetQuantity).toBe("1");
    expect(result.targetAmount).toBeNull();
  });

  test("rejects asset quantity targets beyond asset precision", () => {
    expect(() =>
      normalizeGoalInput(state(), {
        id: "goal:btc-precision",
        name: "Precise BTC",
        kind: "asset_quantity",
        targetAssetId: "asset:btc",
        targetQuantity: "1.000000001",
      }),
    ).toThrow("asset precision");
  });

  test("rejects account goals against non-owned accounts", () => {
    expect(() =>
      normalizeGoalInput(state(), {
        id: "goal:external",
        name: "External",
        kind: "account_balance",
        targetAccountId: "account:external",
        targetAmount: "100",
      }),
    ).toThrow("owned account");
  });

  test("normalizes trading settings as exact decimal strings", () => {
    expect(
      normalizeTradingSettings({
        reserve: "9007199254740993.01",
        defaultRiskPct: "1.250000",
        weeklyLossLimitPct: "5.5",
        maxDailyLossPct: "2",
        primaryAsset: "NQ",
      }),
    ).toEqual({
      reserve: "9007199254740993.01",
      defaultRiskPct: "1.25",
      weeklyLossLimitPct: "5.5",
      maxDailyLossPct: "2",
      primaryAsset: "NQ",
    });
  });

  test("weekly review requires Monday and derives deterministic consistency", () => {
    const normalized = normalizeWeeklyReview({
      id: "review:week",
      weekStart: "2026-08-03",
      reportedPnl: "123.45",
      winRate: "60",
      avgRr: "1.5",
      tradeCount: 10,
      maxDrawdownPct: "4",
      disciplineScore: 80,
      psychologyScore: 70,
      notes: null,
      lessons: null,
    });
    expect(normalized.reportedPnl).toBe("123.45");
    expect(
      computeConsistencyScore({
        disciplineScore: 80,
        psychologyScore: 70,
        maxDrawdownPct: "4",
        winRate: "60",
      }),
    ).toBe(85);

    expect(() => normalizeWeeklyReview({ ...normalized, weekStart: "2026-08-04" })).toThrow(
      "Monday",
    );
  });

  test("validates the versioned backup envelope before persistence", () => {
    const backup = validateBackupEnvelope({
      schemaVersion: 1,
      exportedAt: "2026-08-11T00:00:00.000Z",
      profile: {},
      financialState: {},
      advancedState: {},
    });
    expect(backup.schemaVersion).toBe(1);
    expect(() =>
      validateBackupEnvelope({
        schemaVersion: 2,
        exportedAt: "2026-08-11T00:00:00.000Z",
        profile: {},
        financialState: {},
        advancedState: {},
      }),
    ).toThrow("Unsupported backup schema");
  });

  test("port type remains independently implementable", () => {
    expect(new FakeAdvancedRepository().state.goals).toEqual([]);
  });
});
