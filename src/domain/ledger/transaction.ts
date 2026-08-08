import type { AccountId } from "../accounts";
import type { AssetId } from "../assets";
import { Decimal, DomainError, EntityId, UtcTimestamp } from "../core";

export const TRANSACTION_PURPOSES = ["standard", "reversal", "replacement"] as const;

export type TransactionPurpose = (typeof TRANSACTION_PURPOSES)[number];
export type TransactionId = EntityId<"transaction">;
export type TransactionLegId = EntityId<"transaction-leg">;

export class TransactionInvariantError extends DomainError {
  readonly code = "TRANSACTION_INVARIANT_ERROR";

  constructor(message: string) {
    super(message);
  }
}

export type TransactionLegInput = Readonly<{
  id: TransactionLegId;
  accountId: AccountId;
  assetId: AssetId;
  quantity: Decimal | string;
  memo?: string | null;
}>;

export class TransactionLeg {
  readonly id: TransactionLegId;
  readonly accountId: AccountId;
  readonly assetId: AssetId;
  readonly quantity: Decimal;
  readonly memo: string | null;

  private constructor(input: TransactionLegInput, quantity: Decimal, memo: string | null) {
    this.id = input.id;
    this.accountId = input.accountId;
    this.assetId = input.assetId;
    this.quantity = quantity;
    this.memo = memo;
    Object.freeze(this);
  }

  static create(input: TransactionLegInput): TransactionLeg {
    const quantity =
      typeof input.quantity === "string" ? Decimal.parse(input.quantity) : input.quantity;

    if (quantity.isZero()) {
      throw new TransactionInvariantError("Transaction legs cannot have zero quantity.");
    }

    const memo = input.memo ?? null;
    if (memo !== null && (memo.trim() !== memo || memo.length === 0 || memo.length > 240)) {
      throw new TransactionInvariantError(
        "Transaction leg memo must contain 1-240 trimmed characters when provided.",
      );
    }

    return new TransactionLeg(input, quantity, memo);
  }
}

export type LedgerTransactionInput = Readonly<{
  id: TransactionId;
  occurredAt: UtcTimestamp;
  recordedAt: UtcTimestamp;
  description: string;
  purpose?: TransactionPurpose;
  relatedTransactionId?: TransactionId | null;
  legs: readonly (TransactionLeg | TransactionLegInput)[];
}>;

function assertDescription(description: string): void {
  if (description.trim() !== description || description.length === 0 || description.length > 240) {
    throw new TransactionInvariantError(
      "Transaction description must contain 1-240 trimmed characters.",
    );
  }
}

function assertPurpose(
  purpose: TransactionPurpose,
  relatedTransactionId: TransactionId | null,
): void {
  if (!TRANSACTION_PURPOSES.includes(purpose)) {
    throw new TransactionInvariantError(`Unsupported transaction purpose: ${String(purpose)}.`);
  }

  if (purpose === "standard" && relatedTransactionId !== null) {
    throw new TransactionInvariantError(
      "Standard transactions cannot reference a related transaction.",
    );
  }

  if (purpose !== "standard" && relatedTransactionId === null) {
    throw new TransactionInvariantError(`${purpose} transactions require relatedTransactionId.`);
  }
}

function assertBalanced(legs: readonly TransactionLeg[]): void {
  const totals = new Map<string, Decimal>();

  for (const leg of legs) {
    const key = leg.assetId.toString();
    totals.set(key, (totals.get(key) ?? Decimal.zero()).plus(leg.quantity));
  }

  const unbalanced = [...totals.entries()].filter(([, total]) => !total.isZero());
  if (unbalanced.length !== 0) {
    const detail = unbalanced
      .map(([assetId, total]) => `${assetId}=${total.toString()}`)
      .join(", ");
    throw new TransactionInvariantError(`Transaction legs are not balanced by asset: ${detail}.`);
  }
}

function assertUniqueLegs(legs: readonly TransactionLeg[]): void {
  const legIds = new Set<string>();
  const accountAssets = new Set<string>();

  for (const leg of legs) {
    const legId = leg.id.toString();
    if (legIds.has(legId)) {
      throw new TransactionInvariantError(`Duplicate transaction leg ID: ${legId}.`);
    }
    legIds.add(legId);

    const accountAsset = JSON.stringify([leg.accountId.toString(), leg.assetId.toString()]);
    if (accountAssets.has(accountAsset)) {
      throw new TransactionInvariantError(
        `Duplicate account and asset pair inside transaction: ${accountAsset}.`,
      );
    }
    accountAssets.add(accountAsset);
  }
}

export function transactionId(input: string): TransactionId {
  return EntityId.parse<"transaction">(input);
}

export function transactionLegId(input: string): TransactionLegId {
  return EntityId.parse<"transaction-leg">(input);
}

export class LedgerTransaction {
  readonly id: TransactionId;
  readonly occurredAt: UtcTimestamp;
  readonly recordedAt: UtcTimestamp;
  readonly description: string;
  readonly purpose: TransactionPurpose;
  readonly relatedTransactionId: TransactionId | null;
  readonly legs: readonly TransactionLeg[];

  private constructor(
    input: Omit<LedgerTransactionInput, "purpose" | "relatedTransactionId" | "legs"> & {
      purpose: TransactionPurpose;
      relatedTransactionId: TransactionId | null;
      legs: readonly TransactionLeg[];
    },
  ) {
    this.id = input.id;
    this.occurredAt = input.occurredAt;
    this.recordedAt = input.recordedAt;
    this.description = input.description;
    this.purpose = input.purpose;
    this.relatedTransactionId = input.relatedTransactionId;
    this.legs = Object.freeze([...input.legs]);
    Object.freeze(this);
  }

  static create(input: LedgerTransactionInput): LedgerTransaction {
    assertDescription(input.description);

    const purpose = input.purpose ?? "standard";
    const relatedTransactionId = input.relatedTransactionId ?? null;
    assertPurpose(purpose, relatedTransactionId);

    if (input.recordedAt.compare(input.occurredAt) < 0) {
      throw new TransactionInvariantError("recordedAt cannot precede occurredAt.");
    }

    const legs = input.legs.map((leg) =>
      leg instanceof TransactionLeg ? leg : TransactionLeg.create(leg),
    );

    if (legs.length < 2) {
      throw new TransactionInvariantError("Transactions require at least two legs.");
    }

    assertUniqueLegs(legs);
    assertBalanced(legs);

    return new LedgerTransaction({
      ...input,
      purpose,
      relatedTransactionId,
      legs,
    });
  }

  static createReversal(
    input: Readonly<{
      id: TransactionId;
      original: LedgerTransaction;
      recordedAt: UtcTimestamp;
      legIds: readonly TransactionLegId[];
      description?: string;
    }>,
  ): LedgerTransaction {
    if (input.original.purpose !== "standard") {
      throw new TransactionInvariantError("Reversals may target only standard transactions.");
    }

    if (input.recordedAt.compare(input.original.recordedAt) <= 0) {
      throw new TransactionInvariantError(
        "A reversal must be recorded after the original transaction.",
      );
    }

    if (input.legIds.length !== input.original.legs.length) {
      throw new TransactionInvariantError(
        "Reversal requires exactly one new leg ID for each original leg.",
      );
    }

    return LedgerTransaction.create({
      id: input.id,
      occurredAt: input.original.occurredAt,
      recordedAt: input.recordedAt,
      description: input.description ?? `Void: ${input.original.description}`,
      purpose: "reversal",
      relatedTransactionId: input.original.id,
      legs: input.original.legs.map((leg, index) => ({
        id: input.legIds[index],
        accountId: leg.accountId,
        assetId: leg.assetId,
        quantity: leg.quantity.negate(),
        memo: leg.memo,
      })),
    });
  }
}
