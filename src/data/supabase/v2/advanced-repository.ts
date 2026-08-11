import type {
  AdvancedState,
  BackupEnvelope,
  GoalInput,
  ImportBatchInput,
  TradingSettingsInput,
  WeeklyReviewInput,
} from "../../../application/advanced";
import type { AdvancedRepository } from "../../../application/ports";
import {
  parseAdvancedState,
  parseBackupEnvelope,
  serializeGoal,
  serializeImportBatch,
  serializeTradingSettings,
  serializeWeeklyReview,
} from "./advanced-dto";
import { SupabaseV2Transport, type V2Transport } from "./transport";

export class SupabaseV2AdvancedRepository implements AdvancedRepository {
  readonly #transport: V2Transport;

  constructor(transport: V2Transport = new SupabaseV2Transport()) {
    this.#transport = transport;
  }

  async loadState(): Promise<AdvancedState> {
    return parseAdvancedState(await this.#transport.rpc("v2_get_advanced_state"));
  }

  async putGoal(input: GoalInput): Promise<void> {
    await this.#transport.rpc("v2_put_goal", { p_goal: serializeGoal(input) });
  }

  async archiveGoal(goalId: string): Promise<void> {
    await this.#transport.rpc("v2_archive_goal", { p_goal_id: goalId });
  }

  async putTradingSettings(input: TradingSettingsInput): Promise<void> {
    await this.#transport.rpc("v2_put_trading_settings", {
      p_settings: serializeTradingSettings(input),
    });
  }

  async putWeeklyReview(input: WeeklyReviewInput): Promise<void> {
    await this.#transport.rpc("v2_put_weekly_review", {
      p_review: serializeWeeklyReview(input),
    });
  }

  async finalizeWeeklyReview(reviewId: string): Promise<void> {
    await this.#transport.rpc("v2_finalize_weekly_review", { p_review_id: reviewId });
  }

  async deleteWeeklyReview(reviewId: string): Promise<void> {
    await this.#transport.rpc("v2_delete_weekly_review", { p_review_id: reviewId });
  }

  async importBatch(input: ImportBatchInput): Promise<void> {
    await this.#transport.rpc("v2_import_batch", { p_batch: serializeImportBatch(input) });
  }

  async rollbackImportBatch(batchId: string): Promise<void> {
    await this.#transport.rpc("v2_rollback_import_batch", { p_batch_id: batchId });
  }

  async exportBackup(): Promise<BackupEnvelope> {
    return parseBackupEnvelope(await this.#transport.rpc("v2_export_backup"));
  }

  async restoreBackup(backup: BackupEnvelope): Promise<void> {
    await this.#transport.rpc("v2_restore_backup", { p_backup: backup });
  }

  async resetWorkspace(confirmation: string): Promise<void> {
    await this.#transport.rpc("v2_reset_workspace", { p_confirmation: confirmation });
  }
}
