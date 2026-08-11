import { Decimal, UtcTimestamp } from "../../domain/core";
import { replayLedger } from "../../domain/ledger";
import type { ValidatedFinancialState } from "./financial-service";
import type { AdvancedRepository } from "../ports";
import type {
  BackupEnvelope,
  GoalInput,
  ImportBatchInput,
  TradingSettingsInput,
  WeeklyReviewInput,
} from "../advanced";

const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function requireEntityId(value: string, label: string): string {
  if (!ENTITY_ID_PATTERN.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}

function requireTrimmed(value: string, label: string, maxLength: number): string {
  if (!value || value.trim() !== value || value.length > maxLength) {
    throw new Error(`${label} must contain 1-${maxLength} trimmed characters.`);
  }
  return value;
}

function nullableTrimmed(value: string | null | undefined, label: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  return requireTrimmed(value, label, maxLength);
}

function positiveDecimal(value: string, label: string): string {
  const decimal = Decimal.parse(value);
  if (decimal.compare(Decimal.zero()) <= 0) throw new Error(`${label} must be greater than zero.`);
  return decimal.toString();
}

function nonNegativeDecimal(value: string, label: string): string {
  const decimal = Decimal.parse(value);
  if (decimal.isNegative()) throw new Error(`${label} cannot be negative.`);
  return decimal.toString();
}

function percentage(value: string, label: string): string {
  const decimal = Decimal.parse(value);
  if (decimal.isNegative() || decimal.compare(Decimal.parse("100")) > 0) {
    throw new Error(`${label} must be between 0 and 100.`);
  }
  if (decimal.scale > 6) throw new Error(`${label} supports at most 6 decimal places.`);
  return decimal.toString();
}

function optionalDate(value: string | null | undefined, label: string): string | null {
  if (!value) return null;
  if (!DATE_PATTERN.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`);
  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error(`${label} is not a valid calendar date.`);
  }
  return value;
}

function integerInRange(value: number, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function normalizeGoalInput(state: ValidatedFinancialState, input: GoalInput): GoalInput {
  const id = requireEntityId(input.id, "Goal ID");
  const name = requireTrimmed(input.name, "Goal name", 120);
  const targetDate = optionalDate(input.targetDate, "Target date");
  const accountId = input.targetAccountId || null;
  const assetId = input.targetAssetId || null;

  if (input.kind === "account_balance") {
    const account = state.accounts.find((value) => value.id.toString() === accountId);
    if (!account || account.ownership !== "owned") {
      throw new Error("Account-balance goals require an existing owned account.");
    }
  }

  const targetAsset =
    input.kind === "asset_quantity" || input.kind === "asset_value"
      ? state.assets.find((value) => value.id.toString() === assetId)
      : null;
  if ((input.kind === "asset_quantity" || input.kind === "asset_value") && !targetAsset) {
    throw new Error("Asset goals require an existing asset.");
  }

  switch (input.kind) {
    case "net_worth":
    case "liquid":
      return Object.freeze({
        id,
        name,
        kind: input.kind,
        targetAmount: positiveDecimal(input.targetAmount ?? "", "Target amount"),
        targetQuantity: null,
        targetAccountId: null,
        targetAssetId: null,
        targetDate,
      });
    case "account_balance":
      return Object.freeze({
        id,
        name,
        kind: input.kind,
        targetAmount: positiveDecimal(input.targetAmount ?? "", "Target amount"),
        targetQuantity: null,
        targetAccountId: accountId,
        targetAssetId: null,
        targetDate,
      });
    case "asset_quantity": {
      const targetQuantity = positiveDecimal(input.targetQuantity ?? "", "Target quantity");
      if (!targetAsset || Decimal.parse(targetQuantity).scale > targetAsset.precision) {
        throw new Error("Target quantity exceeds the asset precision.");
      }
      return Object.freeze({
        id,
        name,
        kind: input.kind,
        targetAmount: null,
        targetQuantity,
        targetAccountId: null,
        targetAssetId: assetId,
        targetDate,
      });
    }
    case "asset_value":
      return Object.freeze({
        id,
        name,
        kind: input.kind,
        targetAmount: positiveDecimal(input.targetAmount ?? "", "Target amount"),
        targetQuantity: null,
        targetAccountId: null,
        targetAssetId: assetId,
        targetDate,
      });
  }
}

export async function putValidatedGoal(
  repository: AdvancedRepository,
  state: ValidatedFinancialState,
  input: GoalInput,
): Promise<void> {
  await repository.putGoal(normalizeGoalInput(state, input));
}

export function normalizeTradingSettings(input: TradingSettingsInput): TradingSettingsInput {
  return Object.freeze({
    reserve: nonNegativeDecimal(input.reserve, "Reserve"),
    defaultRiskPct: percentage(input.defaultRiskPct, "Default risk"),
    weeklyLossLimitPct: percentage(input.weeklyLossLimitPct, "Weekly loss limit"),
    maxDailyLossPct: percentage(input.maxDailyLossPct, "Daily loss limit"),
    primaryAsset: nullableTrimmed(input.primaryAsset, "Primary asset", 32),
  });
}

export async function putValidatedTradingSettings(
  repository: AdvancedRepository,
  input: TradingSettingsInput,
): Promise<void> {
  await repository.putTradingSettings(normalizeTradingSettings(input));
}

export function computeConsistencyScore(input: {
  disciplineScore: number;
  psychologyScore: number;
  maxDrawdownPct: string;
  winRate: string;
}): number {
  const discipline = integerInRange(input.disciplineScore, "Discipline score", 0, 100);
  const psychology = integerInRange(input.psychologyScore, "Psychology score", 0, 100);
  const drawdown = percentage(input.maxDrawdownPct, "Max drawdown");
  const winRate = percentage(input.winRate, "Win rate");

  const base = Decimal.fromInteger(discipline + psychology).dividedBy(
    Decimal.fromInteger(2),
    6,
    "half-even",
  );
  const winBonus = Decimal.parse(winRate).dividedBy(Decimal.fromInteger(5), 6, "half-even");
  const cappedBonus =
    winBonus.compare(Decimal.fromInteger(20)) > 0 ? Decimal.fromInteger(20) : winBonus;
  const drawdownPenalty = Decimal.parse(drawdown).dividedBy(Decimal.fromInteger(2), 6, "half-even");

  let score = base.plus(cappedBonus).minus(drawdownPenalty).quantize(0, "half-up");
  if (score.isNegative()) score = Decimal.zero();
  if (score.compare(Decimal.fromInteger(100)) > 0) score = Decimal.fromInteger(100);
  return Number(score.toString());
}

export function normalizeWeeklyReview(input: WeeklyReviewInput): WeeklyReviewInput {
  requireEntityId(input.id, "Weekly review ID");
  const weekStart = optionalDate(input.weekStart, "Week start");
  if (!weekStart) throw new Error("Week start is required.");
  const [year, month, day] = weekStart.split("-").map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() !== 1) {
    throw new Error("Week start must be a Monday.");
  }

  return Object.freeze({
    id: input.id,
    weekStart,
    reportedPnl: Decimal.parse(input.reportedPnl).toString(),
    winRate: percentage(input.winRate, "Win rate"),
    avgRr: nonNegativeDecimal(input.avgRr, "Average R:R"),
    tradeCount: integerInRange(input.tradeCount, "Trade count", 0, 1000000),
    maxDrawdownPct: percentage(input.maxDrawdownPct, "Max drawdown"),
    disciplineScore: integerInRange(input.disciplineScore, "Discipline score", 0, 100),
    psychologyScore: integerInRange(input.psychologyScore, "Psychology score", 0, 100),
    notes: nullableTrimmed(input.notes, "Notes", 4000),
    lessons: nullableTrimmed(input.lessons, "Lessons", 4000),
  });
}

export async function putValidatedWeeklyReview(
  repository: AdvancedRepository,
  input: WeeklyReviewInput,
): Promise<void> {
  await repository.putWeeklyReview(normalizeWeeklyReview(input));
}

export async function importValidatedBatch(
  repository: AdvancedRepository,
  state: ValidatedFinancialState,
  input: ImportBatchInput,
): Promise<void> {
  requireEntityId(input.id, "Import batch ID");
  if (!input.sourceText.trim()) throw new Error("Import source text cannot be empty.");
  if (input.sourceText.length > 2_000_000) throw new Error("Import source text exceeds 2 MB.");
  if (input.transactions.length === 0) throw new Error("Import batch contains no transactions.");
  if (input.transactions.length > 5000) throw new Error("Import batch exceeds 5000 transactions.");
  if (input.transactions.some((transaction) => transaction.purpose !== "standard")) {
    throw new Error("Bulk import accepts only standard transactions.");
  }

  replayLedger({
    accounts: state.accounts,
    assets: state.assets,
    transactions: [...state.transactions, ...input.transactions],
  });

  await repository.importBatch(
    Object.freeze({
      id: input.id,
      label: nullableTrimmed(input.label, "Import label", 120),
      sourceText: input.sourceText,
      transactions: input.transactions,
    }),
  );
}

export function validateBackupEnvelope(value: unknown): BackupEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Backup must be a JSON object.");
  }
  const root = value as Record<string, unknown>;
  if (root.schemaVersion !== 1) throw new Error("Unsupported backup schema version.");
  if (typeof root.exportedAt !== "string") throw new Error("Backup exportedAt is missing.");
  UtcTimestamp.parse(root.exportedAt);
  if (!("profile" in root) || !("financialState" in root) || !("advancedState" in root)) {
    throw new Error("Backup is missing required datasets.");
  }
  return value as BackupEnvelope;
}
