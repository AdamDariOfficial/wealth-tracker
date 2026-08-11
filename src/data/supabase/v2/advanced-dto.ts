import type {
  AdvancedState,
  BackupEnvelope,
  GoalInput,
  GoalKind,
  GoalRecord,
  ImportBatchInput,
  ImportBatchReceipt,
  TradingSettings,
  TradingSettingsInput,
  WeeklyReview,
  WeeklyReviewInput,
} from "../../../application/advanced";
import { GOAL_KINDS } from "../../../application/advanced";
import { Decimal, UtcTimestamp } from "../../../domain/core";
import { serializeTransaction } from "./dto";

export class SupabaseV2AdvancedDtoError extends Error {
  readonly code = "SUPABASE_V2_ADVANCED_DTO_ERROR";

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SupabaseV2AdvancedDtoError(`${label} must be an object.`);
  }
  return value as JsonRecord;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new SupabaseV2AdvancedDtoError(`${label} must be an array.`);
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new SupabaseV2AdvancedDtoError(`${label} must be a string.`);
  }
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return stringValue(value, label);
}

function integerValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new SupabaseV2AdvancedDtoError(`${label} must be an integer.`);
  }
  return value;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new SupabaseV2AdvancedDtoError(`${label} must be a boolean.`);
  }
  return value;
}

function decimalString(value: unknown, label: string): string {
  const raw = stringValue(value, label);
  try {
    return Decimal.parse(raw).toString();
  } catch {
    throw new SupabaseV2AdvancedDtoError(`${label} must be an exact decimal string.`);
  }
}

function goalKind(value: unknown, label: string): GoalKind {
  const raw = stringValue(value, label);
  if (!(GOAL_KINDS as readonly string[]).includes(raw)) {
    throw new SupabaseV2AdvancedDtoError(`${label} is unsupported.`);
  }
  return raw as GoalKind;
}

function parseGoal(value: unknown, index: number): GoalRecord {
  const row = record(value, `goals[${index}]`);
  return Object.freeze({
    id: stringValue(row.id, `goals[${index}].id`),
    name: stringValue(row.name, `goals[${index}].name`),
    kind: goalKind(row.kind, `goals[${index}].kind`),
    targetAmount:
      row.targetAmount === null
        ? null
        : decimalString(row.targetAmount, `goals[${index}].targetAmount`),
    targetQuantity:
      row.targetQuantity === null
        ? null
        : decimalString(row.targetQuantity, `goals[${index}].targetQuantity`),
    targetAccountId: nullableString(row.targetAccountId, `goals[${index}].targetAccountId`),
    targetAssetId: nullableString(row.targetAssetId, `goals[${index}].targetAssetId`),
    targetDate: nullableString(row.targetDate, `goals[${index}].targetDate`),
    archivedAt: nullableString(row.archivedAt, `goals[${index}].archivedAt`),
  });
}

function parseTradingSettings(value: unknown): TradingSettings | null {
  if (value === null) return null;
  const row = record(value, "tradingSettings");
  return Object.freeze({
    reserve: decimalString(row.reserve, "tradingSettings.reserve"),
    defaultRiskPct: decimalString(row.defaultRiskPct, "tradingSettings.defaultRiskPct"),
    weeklyLossLimitPct: decimalString(row.weeklyLossLimitPct, "tradingSettings.weeklyLossLimitPct"),
    maxDailyLossPct: decimalString(row.maxDailyLossPct, "tradingSettings.maxDailyLossPct"),
    primaryAsset: nullableString(row.primaryAsset, "tradingSettings.primaryAsset"),
  });
}

function parseWeeklyReview(value: unknown, index: number): WeeklyReview {
  const row = record(value, `weeklyReviews[${index}]`);
  return Object.freeze({
    id: stringValue(row.id, `weeklyReviews[${index}].id`),
    weekStart: stringValue(row.weekStart, `weeklyReviews[${index}].weekStart`),
    reportedPnl: decimalString(row.reportedPnl, `weeklyReviews[${index}].reportedPnl`),
    winRate: decimalString(row.winRate, `weeklyReviews[${index}].winRate`),
    avgRr: decimalString(row.avgRr, `weeklyReviews[${index}].avgRr`),
    tradeCount: integerValue(row.tradeCount, `weeklyReviews[${index}].tradeCount`),
    maxDrawdownPct: decimalString(row.maxDrawdownPct, `weeklyReviews[${index}].maxDrawdownPct`),
    disciplineScore: integerValue(row.disciplineScore, `weeklyReviews[${index}].disciplineScore`),
    psychologyScore: integerValue(row.psychologyScore, `weeklyReviews[${index}].psychologyScore`),
    consistencyScore: integerValue(
      row.consistencyScore,
      `weeklyReviews[${index}].consistencyScore`,
    ),
    notes: nullableString(row.notes, `weeklyReviews[${index}].notes`),
    lessons: nullableString(row.lessons, `weeklyReviews[${index}].lessons`),
    isDraft: booleanValue(row.isDraft, `weeklyReviews[${index}].isDraft`),
    finalizedAt: nullableString(row.finalizedAt, `weeklyReviews[${index}].finalizedAt`),
  });
}

function parseImportBatch(value: unknown, index: number): ImportBatchReceipt {
  const row = record(value, `importBatches[${index}]`);
  return Object.freeze({
    id: stringValue(row.id, `importBatches[${index}].id`),
    label: nullableString(row.label, `importBatches[${index}].label`),
    createdAt: stringValue(row.createdAt, `importBatches[${index}].createdAt`),
    transactionCount: integerValue(
      row.transactionCount,
      `importBatches[${index}].transactionCount`,
    ),
    rolledBackAt: nullableString(row.rolledBackAt, `importBatches[${index}].rolledBackAt`),
    transactionIds: Object.freeze(
      array(row.transactionIds, `importBatches[${index}].transactionIds`).map((entry, entryIndex) =>
        stringValue(entry, `importBatches[${index}].transactionIds[${entryIndex}]`),
      ),
    ),
  });
}

export function parseAdvancedState(value: unknown): AdvancedState {
  const root = record(value, "advanced state");
  return Object.freeze({
    goals: Object.freeze(array(root.goals, "goals").map(parseGoal)),
    tradingSettings: parseTradingSettings(root.tradingSettings),
    weeklyReviews: Object.freeze(array(root.weeklyReviews, "weeklyReviews").map(parseWeeklyReview)),
    importBatches: Object.freeze(array(root.importBatches, "importBatches").map(parseImportBatch)),
  });
}

export function serializeGoal(input: GoalInput) {
  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    targetAmount: input.targetAmount ?? null,
    targetQuantity: input.targetQuantity ?? null,
    targetAccountId: input.targetAccountId ?? null,
    targetAssetId: input.targetAssetId ?? null,
    targetDate: input.targetDate ?? null,
  } as const;
}

export function serializeTradingSettings(input: TradingSettingsInput) {
  return {
    reserve: input.reserve,
    defaultRiskPct: input.defaultRiskPct,
    weeklyLossLimitPct: input.weeklyLossLimitPct,
    maxDailyLossPct: input.maxDailyLossPct,
    primaryAsset: input.primaryAsset ?? null,
  } as const;
}

export function serializeWeeklyReview(input: WeeklyReviewInput) {
  return {
    id: input.id,
    weekStart: input.weekStart,
    reportedPnl: input.reportedPnl,
    winRate: input.winRate,
    avgRr: input.avgRr,
    tradeCount: input.tradeCount,
    maxDrawdownPct: input.maxDrawdownPct,
    disciplineScore: input.disciplineScore,
    psychologyScore: input.psychologyScore,
    notes: input.notes ?? null,
    lessons: input.lessons ?? null,
  } as const;
}

export function serializeImportBatch(input: ImportBatchInput) {
  return {
    id: input.id,
    label: input.label ?? null,
    sourceText: input.sourceText,
    transactions: input.transactions.map(serializeTransaction),
  } as const;
}

export function parseBackupEnvelope(value: unknown): BackupEnvelope {
  const root = record(value, "backup");
  if (root.schemaVersion !== 1) {
    throw new SupabaseV2AdvancedDtoError("Unsupported backup schema version.");
  }
  const exportedAt = stringValue(root.exportedAt, "backup.exportedAt");
  UtcTimestamp.parse(exportedAt);
  if (!("profile" in root) || !("financialState" in root) || !("advancedState" in root)) {
    throw new SupabaseV2AdvancedDtoError("Backup is missing required datasets.");
  }
  return Object.freeze({
    schemaVersion: 1,
    exportedAt,
    profile: root.profile,
    financialState: root.financialState,
    advancedState: root.advancedState,
  });
}
