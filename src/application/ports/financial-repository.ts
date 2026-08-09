import type { Account } from "../../domain/accounts";
import type { Asset } from "../../domain/assets";
import type { CurrencyCode } from "../../domain/core";
import type { LedgerTransaction } from "../../domain/ledger";
import type { FxRate, PriceQuote } from "../../domain/valuation";
import type { AuthenticatedUser } from "../auth";
import type { UserProfile } from "../profile";

export type PersistedFinancialState = Readonly<{
  profile: UserProfile | null;
  accounts: readonly Account[];
  assets: readonly Asset[];
  transactions: readonly LedgerTransaction[];
  priceQuotes: readonly PriceQuote[];
  fxRates: readonly FxRate[];
}>;

export type CompleteOnboardingInput = Readonly<{
  displayName?: string | null;
  baseCurrency: CurrencyCode | string;
  locale: string;
}>;

export interface FinancialRepository {
  loadState(): Promise<PersistedFinancialState>;
  putAccount(account: Account): Promise<void>;
  putAsset(asset: Asset): Promise<void>;
  postTransaction(transaction: LedgerTransaction): Promise<void>;
  appendPriceQuote(quote: PriceQuote): Promise<void>;
  appendFxRate(rate: FxRate): Promise<void>;
  completeOnboarding(input: CompleteOnboardingInput): Promise<UserProfile>;
}

export interface IdentityProvider {
  currentUser(): Promise<AuthenticatedUser | null>;
  requireUser(): Promise<AuthenticatedUser>;
}
