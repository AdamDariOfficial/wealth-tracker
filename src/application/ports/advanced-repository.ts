import type {
  AdvancedState,
  BackupEnvelope,
  GoalInput,
  ImportBatchInput,
  TradingSettingsInput,
  WeeklyReviewInput,
} from "../advanced";

export interface AdvancedRepository {
  loadState(): Promise<AdvancedState>;
  putGoal(input: GoalInput): Promise<void>;
  archiveGoal(goalId: string): Promise<void>;
  putTradingSettings(input: TradingSettingsInput): Promise<void>;
  putWeeklyReview(input: WeeklyReviewInput): Promise<void>;
  finalizeWeeklyReview(reviewId: string): Promise<void>;
  deleteWeeklyReview(reviewId: string): Promise<void>;
  importBatch(input: ImportBatchInput): Promise<void>;
  rollbackImportBatch(batchId: string): Promise<void>;
  exportBackup(): Promise<BackupEnvelope>;
  restoreBackup(backup: BackupEnvelope): Promise<void>;
  resetWorkspace(confirmation: string): Promise<void>;
}
