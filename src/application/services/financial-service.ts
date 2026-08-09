import type { Account } from "../../domain/accounts";
import type { Asset } from "../../domain/assets";
import { DomainError } from "../../domain/core";
import { replayLedger, type LedgerSnapshot, type LedgerTransaction } from "../../domain/ledger";
import type { FxRate, PriceQuote } from "../../domain/valuation";
import { userProfile } from "../profile";
import type {
  CompleteOnboardingInput,
  FinancialRepository,
  PersistedFinancialState,
} from "../ports";

export class FinancialApplicationError extends DomainError {
  readonly code = "FINANCIAL_APPLICATION_ERROR";

  constructor(message: string) {
    super(message);
  }
}

export type ValidatedFinancialState = PersistedFinancialState &
  Readonly<{
    snapshot: LedgerSnapshot;
  }>;

function replaceById<T>(
  values: readonly T[],
  replacement: T,
  getId: (value: T) => string,
): readonly T[] {
  const replacementId = getId(replacement);
  let replaced = false;
  const result = values.map((value) => {
    if (getId(value) !== replacementId) return value;
    replaced = true;
    return replacement;
  });
  return replaced ? result : [...result, replacement];
}

export async function loadValidatedFinancialState(
  repository: FinancialRepository,
): Promise<ValidatedFinancialState> {
  const state = await repository.loadState();
  const snapshot = replayLedger({
    accounts: state.accounts,
    assets: state.assets,
    transactions: state.transactions,
  });

  return Object.freeze({ ...state, snapshot });
}

export async function putValidatedAccount(
  repository: FinancialRepository,
  account: Account,
): Promise<void> {
  const state = await repository.loadState();
  const accounts = replaceById(state.accounts, account, (value) => value.id.toString());
  replayLedger({ accounts, assets: state.assets, transactions: state.transactions });
  await repository.putAccount(account);
}

export async function putValidatedAsset(
  repository: FinancialRepository,
  asset: Asset,
): Promise<void> {
  const state = await repository.loadState();
  const assets = replaceById(state.assets, asset, (value) => value.id.toString());
  replayLedger({ accounts: state.accounts, assets, transactions: state.transactions });
  await repository.putAsset(asset);
}

export async function postValidatedTransaction(
  repository: FinancialRepository,
  transaction: LedgerTransaction,
): Promise<void> {
  const state = await repository.loadState();
  replayLedger({
    accounts: state.accounts,
    assets: state.assets,
    transactions: [...state.transactions, transaction],
  });
  await repository.postTransaction(transaction);
}

export async function appendValidatedPriceQuote(
  repository: FinancialRepository,
  quote: PriceQuote,
): Promise<void> {
  const state = await repository.loadState();
  const asset = state.assets.find((value) => value.id.equals(quote.assetId));
  if (!asset) {
    throw new FinancialApplicationError(
      `Price quote references unknown asset ${quote.assetId.toString()}.`,
    );
  }
  if (asset.kind === "fiat") {
    throw new FinancialApplicationError("Fiat assets cannot receive price quotes.");
  }
  const conflict = state.priceQuotes.some(
    (value) => value.assetId.equals(quote.assetId) && value.asOf.equals(quote.asOf),
  );
  if (conflict) {
    throw new FinancialApplicationError("A price quote already exists at that timestamp.");
  }
  await repository.appendPriceQuote(quote);
}

export async function appendValidatedFxRate(
  repository: FinancialRepository,
  rate: FxRate,
): Promise<void> {
  const state = await repository.loadState();
  const conflict = state.fxRates.some(
    (value) =>
      value.sourceCurrency.equals(rate.sourceCurrency) &&
      value.targetCurrency.equals(rate.targetCurrency) &&
      value.asOf.equals(rate.asOf),
  );
  if (conflict) {
    throw new FinancialApplicationError("An FX rate already exists for that pair and timestamp.");
  }
  await repository.appendFxRate(rate);
}

export async function completeValidatedOnboarding(
  repository: FinancialRepository,
  input: CompleteOnboardingInput,
) {
  const validated = userProfile({ ...input, onboarded: true });
  return repository.completeOnboarding({
    displayName: validated.displayName,
    baseCurrency: validated.baseCurrency!,
    locale: validated.locale!,
  });
}
