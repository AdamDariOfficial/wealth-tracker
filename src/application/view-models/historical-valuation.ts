import { replayLedger } from "../../domain/ledger";
import { valueLedger, type LedgerValuation } from "../../domain/valuation";
import type { WealthOverview } from "./wealth-overview";

/**
 * Canonical point-in-time valuation.
 *
 * Replays the ledger with only the transactions that occurred strictly before
 * the cutoff, then values that snapshot with only the price and FX
 * observations known before the same cutoff. Corrections are honoured: a
 * non-standard transaction is only included when the transaction it relates to
 * is also inside the cutoff.
 *
 * This is the single derivation used by every historical view (calendar
 * periods, dashboard trend), so no surface invents its own history.
 */
export function valuationAt(overview: WealthOverview, cutoff: Date): LedgerValuation | null {
  const baseCurrency = overview.baseCurrency;
  if (!baseCurrency) return null;

  const cutoffMilliseconds = cutoff.getTime();
  if (!Number.isFinite(cutoffMilliseconds)) {
    throw new Error("A point-in-time valuation requires a valid cutoff date.");
  }

  const state = overview.state;
  const candidates = state.transactions.filter(
    (transaction) => transaction.occurredAt.toEpochMilliseconds() < cutoffMilliseconds,
  );
  const candidateIds = new Set(candidates.map((transaction) => transaction.id.toString()));
  const transactions = candidates.filter(
    (transaction) =>
      transaction.purpose === "standard" ||
      (transaction.relatedTransactionId !== null &&
        candidateIds.has(transaction.relatedTransactionId.toString())),
  );
  const snapshot = replayLedger({
    accounts: state.accounts,
    assets: state.assets,
    transactions,
  });

  return valueLedger({
    snapshot,
    accounts: state.accounts,
    assets: state.assets,
    baseCurrency,
    priceQuotes: state.priceQuotes.filter(
      (quote) => quote.asOf.toEpochMilliseconds() < cutoffMilliseconds,
    ),
    fxRates: state.fxRates.filter((rate) => rate.asOf.toEpochMilliseconds() < cutoffMilliseconds),
  });
}
