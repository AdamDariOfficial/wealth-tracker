import type { ValidatedFinancialState } from "../services";
import {
  LedgerTransaction,
  replayLedger,
  transactionId,
  transactionLegId,
} from "../../domain/ledger";
import { accountId } from "../../domain/accounts";
import { assetId } from "../../domain/assets";
import { UtcTimestamp } from "../../domain/core";

export const LEDGER_IMPORT_HEADER = [
  "transaction_id",
  "leg_id",
  "occurred_at",
  "recorded_at",
  "description",
  "account_id",
  "asset_id",
  "quantity",
  "memo",
] as const;

export type LedgerImportIssue = Readonly<{
  line: number | null;
  message: string;
}>;

export type LedgerImportPreviewRow = Readonly<{
  line: number;
  transactionId: string;
  legId: string;
  occurredAt: string;
  description: string;
  accountId: string;
  accountName: string;
  assetId: string;
  assetSymbol: string;
  quantity: string;
  memo: string | null;
}>;

export type LedgerImportPreview = Readonly<{
  transactions: readonly LedgerTransaction[];
  rows: readonly LedgerImportPreviewRow[];
  issues: readonly LedgerImportIssue[];
  transactionCount: number;
  legCount: number;
}>;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      if (value.length !== 0) throw new Error("A quoted field must start with a quote.");
      quoted = true;
    } else if (char === ",") {
      result.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  if (quoted) throw new Error("Unterminated quoted field.");
  result.push(value);
  return result;
}

function isoInstant(value: string, label: string): UtcTimestamp {
  try {
    return UtcTimestamp.parse(value);
  } catch {
    throw new Error(`${label} must be an explicit ISO-8601 instant.`);
  }
}

function normalizedHeader(line: string): readonly string[] {
  const cells = parseCsvLine(line.replace(/^\uFEFF/, ""));
  return cells.map((value) => value.trim().toLowerCase());
}

type Group = {
  firstLine: number;
  occurredAt: UtcTimestamp;
  recordedAt: UtcTimestamp;
  description: string;
  legs: Array<{
    id: ReturnType<typeof transactionLegId>;
    accountId: ReturnType<typeof accountId>;
    assetId: ReturnType<typeof assetId>;
    quantity: string;
    memo: string | null;
    line: number;
  }>;
};

export function parseLedgerImport(
  sourceText: string,
  state: ValidatedFinancialState,
): LedgerImportPreview {
  const issues: LedgerImportIssue[] = [];
  const rows: LedgerImportPreviewRow[] = [];
  const transactions: LedgerTransaction[] = [];

  const physicalLines = sourceText.split(/\r?\n/);
  const firstContentIndex = physicalLines.findIndex((line) => line.trim().length > 0);
  if (firstContentIndex === -1) {
    return Object.freeze({
      transactions: Object.freeze([]),
      rows: Object.freeze([]),
      issues: Object.freeze([{ line: null, message: "Import text is empty." }]),
      transactionCount: 0,
      legCount: 0,
    });
  }

  let header: readonly string[];
  try {
    header = normalizedHeader(physicalLines[firstContentIndex]);
  } catch (error) {
    return Object.freeze({
      transactions: Object.freeze([]),
      rows: Object.freeze([]),
      issues: Object.freeze([
        {
          line: firstContentIndex + 1,
          message: error instanceof Error ? error.message : "Invalid CSV header.",
        },
      ]),
      transactionCount: 0,
      legCount: 0,
    });
  }

  if (
    header.length !== LEDGER_IMPORT_HEADER.length ||
    header.some((value, index) => value !== LEDGER_IMPORT_HEADER[index])
  ) {
    return Object.freeze({
      transactions: Object.freeze([]),
      rows: Object.freeze([]),
      issues: Object.freeze([
        {
          line: firstContentIndex + 1,
          message: `Header must be exactly: ${LEDGER_IMPORT_HEADER.join(",")}`,
        },
      ]),
      transactionCount: 0,
      legCount: 0,
    });
  }

  const accountById = new Map(state.accounts.map((account) => [account.id.toString(), account]));
  const assetById = new Map(state.assets.map((asset) => [asset.id.toString(), asset]));
  const existingTransactionIds = new Set(state.transactions.map((value) => value.id.toString()));
  const existingLegIds = new Set(
    state.transactions.flatMap((value) => value.legs.map((leg) => leg.id.toString())),
  );
  const seenLegIds = new Set<string>();
  const groups = new Map<string, Group>();

  for (let index = firstContentIndex + 1; index < physicalLines.length; index += 1) {
    const raw = physicalLines[index];
    if (!raw.trim()) continue;
    const lineNo = index + 1;

    let cells: string[];
    try {
      cells = parseCsvLine(raw);
    } catch (error) {
      issues.push({
        line: lineNo,
        message: error instanceof Error ? error.message : "Invalid CSV row.",
      });
      continue;
    }

    if (cells.length !== LEDGER_IMPORT_HEADER.length) {
      issues.push({
        line: lineNo,
        message: `Expected ${LEDGER_IMPORT_HEADER.length} columns; received ${cells.length}.`,
      });
      continue;
    }

    const [
      rawTransactionId,
      rawLegId,
      occurredAtText,
      recordedAtText,
      description,
      rawAccountId,
      rawAssetId,
      quantity,
      memoText,
    ] = cells;

    try {
      if (!description || description.trim() !== description) {
        throw new Error("description must contain trimmed text.");
      }
      const txId = transactionId(rawTransactionId);
      const legId = transactionLegId(rawLegId);
      const parsedAccountId = accountId(rawAccountId);
      const parsedAssetId = assetId(rawAssetId);
      const occurredAt = isoInstant(occurredAtText, "occurred_at");
      const recordedAt = isoInstant(recordedAtText, "recorded_at");
      const account = accountById.get(parsedAccountId.toString());
      const asset = assetById.get(parsedAssetId.toString());
      if (!account) throw new Error(`Unknown account_id: ${rawAccountId}.`);
      if (!asset) throw new Error(`Unknown asset_id: ${rawAssetId}.`);
      if (existingTransactionIds.has(txId.toString())) {
        throw new Error(`transaction_id already exists: ${rawTransactionId}.`);
      }
      if (existingLegIds.has(legId.toString()) || seenLegIds.has(legId.toString())) {
        throw new Error(`leg_id already exists: ${rawLegId}.`);
      }

      const memo = memoText === "" ? null : memoText;
      if (memo !== null && memo.trim() !== memo) {
        throw new Error("memo must be trimmed when provided.");
      }

      let group = groups.get(txId.toString());
      if (!group) {
        group = {
          firstLine: lineNo,
          occurredAt,
          recordedAt,
          description,
          legs: [],
        };
        groups.set(txId.toString(), group);
      } else if (
        !group.occurredAt.equals(occurredAt) ||
        !group.recordedAt.equals(recordedAt) ||
        group.description !== description
      ) {
        throw new Error(
          "Rows sharing transaction_id must repeat identical occurred_at, recorded_at and description.",
        );
      }

      group.legs.push({
        id: legId,
        accountId: parsedAccountId,
        assetId: parsedAssetId,
        quantity,
        memo,
        line: lineNo,
      });
      seenLegIds.add(legId.toString());

      rows.push(
        Object.freeze({
          line: lineNo,
          transactionId: txId.toString(),
          legId: legId.toString(),
          occurredAt: occurredAt.toString(),
          description,
          accountId: account.id.toString(),
          accountName: account.name,
          assetId: asset.id.toString(),
          assetSymbol: asset.symbol,
          quantity,
          memo,
        }),
      );
    } catch (error) {
      issues.push({
        line: lineNo,
        message: error instanceof Error ? error.message : "Invalid import row.",
      });
    }
  }

  for (const [id, group] of groups) {
    try {
      transactions.push(
        LedgerTransaction.create({
          id: transactionId(id),
          occurredAt: group.occurredAt,
          recordedAt: group.recordedAt,
          description: group.description,
          purpose: "standard",
          relatedTransactionId: null,
          legs: group.legs.map((leg) => ({
            id: leg.id,
            accountId: leg.accountId,
            assetId: leg.assetId,
            quantity: leg.quantity,
            memo: leg.memo,
          })),
        }),
      );
    } catch (error) {
      issues.push({
        line: group.firstLine,
        message: error instanceof Error ? error.message : `Invalid transaction ${id}.`,
      });
    }
  }

  if (issues.length === 0 && transactions.length > 0) {
    try {
      replayLedger({
        accounts: state.accounts,
        assets: state.assets,
        transactions: [...state.transactions, ...transactions],
      });
    } catch (error) {
      issues.push({
        line: null,
        message:
          error instanceof Error
            ? `Batch would violate ledger invariants: ${error.message}`
            : "Batch would violate ledger invariants.",
      });
    }
  }

  if (transactions.length === 0 && issues.length === 0) {
    issues.push({ line: null, message: "No transaction rows were found." });
  }

  return Object.freeze({
    transactions: Object.freeze(transactions),
    rows: Object.freeze(rows),
    issues: Object.freeze(issues),
    transactionCount: transactions.length,
    legCount: rows.length,
  });
}

export const LEDGER_IMPORT_EXAMPLE = `transaction_id,leg_id,occurred_at,recorded_at,description,account_id,asset_id,quantity,memo
tx:salary-2026-08,leg:salary-owned,2026-08-01T08:00:00Z,2026-08-01T08:00:01Z,Salary,account:bank,asset:eur,2500.00,
tx:salary-2026-08,leg:salary-income,2026-08-01T08:00:00Z,2026-08-01T08:00:01Z,Salary,account:income,asset:eur,-2500.00,`;
