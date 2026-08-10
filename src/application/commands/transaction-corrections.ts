import { UtcTimestamp } from "../../domain/core";
import { LedgerTransaction, type TransactionId, type TransactionLegId } from "../../domain/ledger";

export type CreateReversalInput = Readonly<{
  id: TransactionId;
  original: LedgerTransaction;
  legIds: readonly TransactionLegId[];
  now?: Date;
  description?: string;
}>;

export function createReversalTransaction(input: CreateReversalInput): LedgerTransaction {
  const nowMilliseconds = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(nowMilliseconds)) {
    throw new Error("Reversal recording time must be a valid date.");
  }

  const recordedMilliseconds = Math.max(
    nowMilliseconds,
    input.original.recordedAt.toEpochMilliseconds() + 1,
  );

  return LedgerTransaction.createReversal({
    id: input.id,
    original: input.original,
    recordedAt: UtcTimestamp.fromDate(new Date(recordedMilliseconds)),
    legIds: input.legIds,
    description: input.description,
  });
}
