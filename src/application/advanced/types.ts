import type { LedgerTransaction } from "../../domain/ledger";

export const GOAL_KINDS = [
  "net_worth",
  "liquid",
  "account_balance",
  "asset_quantity",
  "asset_value",
] as const;

export type GoalKind = (typeof GOAL_KINDS)[number];

export type GoalRecord = Readonly<{
  id: string;
  name: string;
  kind: GoalKind;
  targetAmount: string | null;
  targetQuantity: string | null;
  targetAccountId: string | null;
  targetAssetId: string | null;
  targetDate: string | null;
  archivedAt: string | null;
}>;

export type TradingSettings = Readonly<{
  reserve: string;
  defaultRiskPct: string;
  weeklyLossLimitPct: string;
  maxDailyLossPct: string;
  primaryAsset: string | null;
}>;

export type WeeklyReview = Readonly<{
  id: string;
  weekStart: string;
  reportedPnl: string;
  winRate: string;
  avgRr: string;
  tradeCount: number;
  maxDrawdownPct: string;
  disciplineScore: number;
  psychologyScore: number;
  consistencyScore: number;
  notes: string | null;
  lessons: string | null;
  isDraft: boolean;
  finalizedAt: string | null;
}>;

export type ImportBatchReceipt = Readonly<{
  id: string;
  label: string | null;
  createdAt: string;
  transactionCount: number;
  rolledBackAt: string | null;
  transactionIds: readonly string[];
}>;

export type AdvancedState = Readonly<{
  goals: readonly GoalRecord[];
  tradingSettings: TradingSettings | null;
  weeklyReviews: readonly WeeklyReview[];
  importBatches: readonly ImportBatchReceipt[];
}>;

export type GoalInput = Readonly<{
  id: string;
  name: string;
  kind: GoalKind;
  targetAmount?: string | null;
  targetQuantity?: string | null;
  targetAccountId?: string | null;
  targetAssetId?: string | null;
  targetDate?: string | null;
}>;

export type TradingSettingsInput = Readonly<{
  reserve: string;
  defaultRiskPct: string;
  weeklyLossLimitPct: string;
  maxDailyLossPct: string;
  primaryAsset?: string | null;
}>;

export type WeeklyReviewInput = Readonly<{
  id: string;
  weekStart: string;
  reportedPnl: string;
  winRate: string;
  avgRr: string;
  tradeCount: number;
  maxDrawdownPct: string;
  disciplineScore: number;
  psychologyScore: number;
  notes?: string | null;
  lessons?: string | null;
}>;

export type ImportBatchInput = Readonly<{
  id: string;
  label?: string | null;
  sourceText: string;
  transactions: readonly LedgerTransaction[];
}>;

export type BackupEnvelope = Readonly<{
  schemaVersion: 1;
  exportedAt: string;
  profile: unknown;
  financialState: unknown;
  advancedState: unknown;
}>;
