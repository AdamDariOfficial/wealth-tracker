import type { Account, AccountId } from "../accounts";
import type { Asset, AssetId } from "../assets";
import { Decimal, DomainError } from "../core";
import type { TransactionId, TransactionLeg } from "./transaction";
import { LedgerTransaction } from "./transaction";

export class LedgerDatasetError extends DomainError {
  readonly code = "LEDGER_DATASET_ERROR";

  constructor(message: string) {
    super(message);
  }
}

export type LedgerBalance = Readonly<{
  accountId: AccountId;
  assetId: AssetId;
  quantity: Decimal;
}>;

export type EffectiveTransactionState =
  | "active"
  | "voided"
  | "replaced"
  | "reversal"
  | "replacement";

export type TransactionAuditState = Readonly<{
  transactionId: TransactionId;
  state: EffectiveTransactionState;
  reversedByTransactionId: TransactionId | null;
  replacedByTransactionId: TransactionId | null;
}>;

export type LedgerReplayInput = Readonly<{
  accounts: readonly Account[];
  assets: readonly Asset[];
  transactions: readonly LedgerTransaction[];
}>;

function assertUniqueEntities<T>(
  values: readonly T[],
  getId: (value: T) => string,
  label: string,
): Map<string, T> {
  const result = new Map<string, T>();

  for (const value of values) {
    const id = getId(value);
    if (result.has(id)) {
      throw new LedgerDatasetError(`Duplicate ${label} ID: ${id}.`);
    }
    result.set(id, value);
  }

  return result;
}

function legKey(leg: TransactionLeg): string {
  return JSON.stringify([leg.accountId.toString(), leg.assetId.toString()]);
}

function assertExactReversal(original: LedgerTransaction, reversal: LedgerTransaction): void {
  if (original.legs.length !== reversal.legs.length) {
    throw new LedgerDatasetError(
      `Reversal ${reversal.id.toString()} does not match ${original.id.toString()}.`,
    );
  }

  const expected = new Map(
    original.legs.map((leg) => [legKey(leg), leg.quantity.negate()] as const),
  );

  for (const leg of reversal.legs) {
    const quantity = expected.get(legKey(leg));
    if (!quantity || !quantity.equals(leg.quantity)) {
      throw new LedgerDatasetError(
        `Reversal ${reversal.id.toString()} is not the exact inverse of ` +
          `${original.id.toString()}.`,
      );
    }
  }
}

function compareTransactions(left: LedgerTransaction, right: LedgerTransaction): number {
  const occurred = left.occurredAt.compare(right.occurredAt);
  if (occurred !== 0) return occurred;

  const recorded = left.recordedAt.compare(right.recordedAt);
  if (recorded !== 0) return recorded;

  return left.id.toString().localeCompare(right.id.toString());
}

function validateCorrections(
  transactions: readonly LedgerTransaction[],
  transactionById: ReadonlyMap<string, LedgerTransaction>,
): Readonly<{
  reversalByTarget: ReadonlyMap<string, LedgerTransaction>;
  replacementByTarget: ReadonlyMap<string, LedgerTransaction>;
}> {
  const reversalByTarget = new Map<string, LedgerTransaction>();
  const replacementByTarget = new Map<string, LedgerTransaction>();

  for (const transaction of transactions) {
    if (transaction.purpose === "standard") continue;

    const relatedId = transaction.relatedTransactionId?.toString();
    if (!relatedId) {
      throw new LedgerDatasetError(
        `Correction transaction ${transaction.id.toString()} has no related transaction.`,
      );
    }

    const target = transactionById.get(relatedId);
    if (!target) {
      throw new LedgerDatasetError(
        `Correction transaction ${transaction.id.toString()} references unknown ` +
          `transaction ${relatedId}.`,
      );
    }

    if (target.id.equals(transaction.id)) {
      throw new LedgerDatasetError("A transaction cannot correct itself.");
    }

    if (target.purpose !== "standard") {
      throw new LedgerDatasetError(
        "Correction transactions may reference only standard transactions.",
      );
    }

    if (transaction.recordedAt.compare(target.recordedAt) <= 0) {
      throw new LedgerDatasetError(
        `Correction ${transaction.id.toString()} must be recorded after its target.`,
      );
    }

    if (transaction.purpose === "reversal" && !transaction.occurredAt.equals(target.occurredAt)) {
      throw new LedgerDatasetError(
        `Reversal ${transaction.id.toString()} must preserve the economic timestamp of ` +
          `${target.id.toString()}.`,
      );
    }

    const targetId = target.id.toString();
    if (transaction.purpose === "reversal") {
      if (reversalByTarget.has(targetId)) {
        throw new LedgerDatasetError(`Transaction ${targetId} has multiple reversals.`);
      }
      assertExactReversal(target, transaction);
      reversalByTarget.set(targetId, transaction);
      continue;
    }

    if (replacementByTarget.has(targetId)) {
      throw new LedgerDatasetError(`Transaction ${targetId} has multiple replacements.`);
    }
    replacementByTarget.set(targetId, transaction);
  }

  for (const [targetId, replacement] of replacementByTarget) {
    const reversal = reversalByTarget.get(targetId);
    if (!reversal) {
      throw new LedgerDatasetError(
        `Replacement ${replacement.id.toString()} requires a reversal of ${targetId}.`,
      );
    }

    if (replacement.recordedAt.compare(reversal.recordedAt) <= 0) {
      throw new LedgerDatasetError(
        `Replacement ${replacement.id.toString()} must be recorded after its reversal.`,
      );
    }
  }

  return { reversalByTarget, replacementByTarget };
}

export class LedgerSnapshot {
  readonly balances: readonly LedgerBalance[];
  readonly transactions: readonly LedgerTransaction[];
  readonly auditStates: readonly TransactionAuditState[];
  readonly #balanceByKey: ReadonlyMap<string, LedgerBalance>;

  private constructor(
    balances: readonly LedgerBalance[],
    transactions: readonly LedgerTransaction[],
    auditStates: readonly TransactionAuditState[],
  ) {
    this.balances = Object.freeze([...balances]);
    this.transactions = Object.freeze([...transactions]);
    this.auditStates = Object.freeze([...auditStates]);
    this.#balanceByKey = new Map(
      balances.map((balance) => [
        JSON.stringify([balance.accountId.toString(), balance.assetId.toString()]),
        balance,
      ]),
    );
    Object.freeze(this);
  }

  static replay(input: LedgerReplayInput): LedgerSnapshot {
    const accountById = assertUniqueEntities(
      input.accounts,
      (account) => account.id.toString(),
      "account",
    );
    const assetById = assertUniqueEntities(input.assets, (asset) => asset.id.toString(), "asset");
    const transactionById = assertUniqueEntities(
      input.transactions,
      (transaction) => transaction.id.toString(),
      "transaction",
    );

    const legIds = new Set<string>();
    for (const transaction of input.transactions) {
      for (const leg of transaction.legs) {
        const legId = leg.id.toString();
        if (legIds.has(legId)) {
          throw new LedgerDatasetError(`Duplicate transaction leg ID across ledger: ${legId}.`);
        }
        legIds.add(legId);

        const account = accountById.get(leg.accountId.toString());
        if (!account) {
          throw new LedgerDatasetError(
            `Transaction ${transaction.id.toString()} references unknown account ` +
              `${leg.accountId.toString()}.`,
          );
        }

        if (account.openedAt && transaction.occurredAt.compare(account.openedAt) < 0) {
          throw new LedgerDatasetError(
            `Transaction ${transaction.id.toString()} predates account ` +
              `${account.id.toString()}.`,
          );
        }

        if (account.archivedAt && transaction.occurredAt.compare(account.archivedAt) > 0) {
          throw new LedgerDatasetError(
            `Transaction ${transaction.id.toString()} occurs after account ` +
              `${account.id.toString()} was archived.`,
          );
        }

        const asset = assetById.get(leg.assetId.toString());
        if (!asset) {
          throw new LedgerDatasetError(
            `Transaction ${transaction.id.toString()} references unknown asset ` +
              `${leg.assetId.toString()}.`,
          );
        }

        if (leg.quantity.scale > asset.precision) {
          throw new LedgerDatasetError(
            `Transaction ${transaction.id.toString()} exceeds precision ${asset.precision} ` +
              `for asset ${asset.id.toString()}.`,
          );
        }
      }
    }

    const { reversalByTarget, replacementByTarget } = validateCorrections(
      input.transactions,
      transactionById,
    );
    const sortedTransactions = [...input.transactions].sort(compareTransactions);
    const balances = new Map<string, LedgerBalance>();

    for (const transaction of sortedTransactions) {
      for (const leg of transaction.legs) {
        const key = legKey(leg);
        const current = balances.get(key)?.quantity ?? Decimal.zero();
        const quantity = current.plus(leg.quantity);

        if (quantity.isZero()) {
          balances.delete(key);
        } else {
          balances.set(
            key,
            Object.freeze({
              accountId: leg.accountId,
              assetId: leg.assetId,
              quantity,
            }),
          );
        }
      }
    }

    const auditStates = sortedTransactions.map((transaction): TransactionAuditState => {
      const currentId = transaction.id.toString();
      const reversal = reversalByTarget.get(currentId) ?? null;
      const replacement = replacementByTarget.get(currentId) ?? null;

      let state: EffectiveTransactionState = "active";
      if (transaction.purpose === "reversal") {
        state = "reversal";
      } else if (replacement) {
        state = "replaced";
      } else if (reversal) {
        state = "voided";
      } else if (transaction.purpose === "replacement") {
        state = "replacement";
      }

      return Object.freeze({
        transactionId: transaction.id,
        state,
        reversedByTransactionId: reversal?.id ?? null,
        replacedByTransactionId: replacement?.id ?? null,
      });
    });

    const materializedBalances = [...balances.values()].sort((left, right) => {
      const account = left.accountId.toString().localeCompare(right.accountId.toString());
      if (account !== 0) return account;
      return left.assetId.toString().localeCompare(right.assetId.toString());
    });

    return new LedgerSnapshot(materializedBalances, sortedTransactions, auditStates);
  }

  quantity(accountId: AccountId, assetId: AssetId): Decimal {
    const key = JSON.stringify([accountId.toString(), assetId.toString()]);
    return this.#balanceByKey.get(key)?.quantity ?? Decimal.zero();
  }

  balancesForAccount(accountId: AccountId): readonly LedgerBalance[] {
    return this.balances.filter((balance) => balance.accountId.equals(accountId));
  }
}

export function replayLedger(input: LedgerReplayInput): LedgerSnapshot {
  return LedgerSnapshot.replay(input);
}
