import { describe, expect, test } from "bun:test";
import {
  SupabaseV2AdvancedRepository,
  type RpcArguments,
  type V2Transport,
} from "../../src/data/supabase/v2";

class FakeTransport implements V2Transport {
  calls: Array<{ name: string; args: RpcArguments }> = [];
  response: unknown = null;

  async rpc<T>(name: string, args: RpcArguments = {}): Promise<T> {
    this.calls.push({ name, args });
    return this.response as T;
  }

  async getAuthenticatedUser() {
    return null;
  }
}

function advancedDto() {
  return {
    goals: [
      {
        id: "goal:nw",
        name: "Net worth",
        kind: "net_worth",
        targetAmount: "9007199254740993.01",
        targetQuantity: null,
        targetAccountId: null,
        targetAssetId: null,
        targetDate: "2030-01-01",
        archivedAt: null,
      },
    ],
    tradingSettings: {
      reserve: "123456789012345678.123456789012345678",
      defaultRiskPct: "1.25",
      weeklyLossLimitPct: "5",
      maxDailyLossPct: "2",
      primaryAsset: "NQ",
    },
    weeklyReviews: [
      {
        id: "review:week",
        weekStart: "2026-08-03",
        reportedPnl: "1234.56",
        winRate: "60.5",
        avgRr: "1.75",
        tradeCount: 12,
        maxDrawdownPct: "4.25",
        disciplineScore: 80,
        psychologyScore: 70,
        consistencyScore: 85,
        notes: null,
        lessons: null,
        isDraft: true,
        finalizedAt: null,
      },
    ],
    importBatches: [
      {
        id: "batch:x",
        label: "Import",
        createdAt: "2026-08-10T10:00:00Z",
        transactionCount: 1,
        rolledBackAt: null,
        transactionIds: ["tx:x"],
      },
    ],
  };
}

describe("Supabase v2 advanced repository", () => {
  test("maps advanced numeric values from exact strings", async () => {
    const transport = new FakeTransport();
    transport.response = advancedDto();
    const repository = new SupabaseV2AdvancedRepository(transport);
    const state = await repository.loadState();

    expect(state.goals[0].targetAmount).toBe("9007199254740993.01");
    expect(state.tradingSettings?.reserve).toBe("123456789012345678.123456789012345678");
    expect(state.weeklyReviews[0].reportedPnl).toBe("1234.56");
    expect(transport.calls[0].name).toBe("v2_get_advanced_state");
  });

  test("serializes goal and trading writes without floating-point conversion", async () => {
    const transport = new FakeTransport();
    const repository = new SupabaseV2AdvancedRepository(transport);

    await repository.putGoal({
      id: "goal:nw",
      name: "Net worth",
      kind: "net_worth",
      targetAmount: "9007199254740993.01",
    });
    await repository.putTradingSettings({
      reserve: "123456789012345678.123456789012345678",
      defaultRiskPct: "1.25",
      weeklyLossLimitPct: "5",
      maxDailyLossPct: "2",
      primaryAsset: null,
    });

    expect(transport.calls[0]).toEqual({
      name: "v2_put_goal",
      args: {
        p_goal: {
          id: "goal:nw",
          name: "Net worth",
          kind: "net_worth",
          targetAmount: "9007199254740993.01",
          targetQuantity: null,
          targetAccountId: null,
          targetAssetId: null,
          targetDate: null,
        },
      },
    });
    expect((transport.calls[1].args.p_settings as { reserve: string }).reserve).toBe(
      "123456789012345678.123456789012345678",
    );
  });

  test("routes destructive operations through dedicated reviewed RPCs", async () => {
    const transport = new FakeTransport();
    transport.response = {
      schemaVersion: 1,
      exportedAt: "2026-08-11T00:00:00.000Z",
      profile: {},
      financialState: {},
      advancedState: {},
    };
    const repository = new SupabaseV2AdvancedRepository(transport);

    await repository.rollbackImportBatch("batch:x");
    const backup = await repository.exportBackup();
    await repository.restoreBackup(backup);
    await repository.resetWorkspace("RESET WORKSPACE");

    expect(transport.calls.map((call) => call.name)).toEqual([
      "v2_rollback_import_batch",
      "v2_export_backup",
      "v2_restore_backup",
      "v2_reset_workspace",
    ]);
  });
});
