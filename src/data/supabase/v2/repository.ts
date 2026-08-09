import { authUserId, type AuthenticatedUser } from "../../../application/auth";
import type {
  CompleteOnboardingInput,
  FinancialRepository,
  IdentityProvider,
  PersistedFinancialState,
} from "../../../application/ports";
import type { UserProfile } from "../../../application/profile";
import type { Account } from "../../../domain/accounts";
import type { Asset } from "../../../domain/assets";
import type { LedgerTransaction } from "../../../domain/ledger";
import type { FxRate, PriceQuote } from "../../../domain/valuation";
import {
  parseFinancialState,
  parseProfileDto,
  serializeAccount,
  serializeAsset,
  serializeFxRate,
  serializeOnboarding,
  serializePriceQuote,
  serializeTransaction,
} from "./dto";
import { SupabaseV2Transport, type V2Transport } from "./transport";

export class SupabaseV2FinancialRepository implements FinancialRepository {
  readonly #transport: V2Transport;

  constructor(transport: V2Transport = new SupabaseV2Transport()) {
    this.#transport = transport;
  }

  async loadState(): Promise<PersistedFinancialState> {
    return parseFinancialState(await this.#transport.rpc("v2_get_financial_state"));
  }

  async putAccount(account: Account): Promise<void> {
    await this.#transport.rpc("v2_put_account", { p_account: serializeAccount(account) });
  }

  async putAsset(asset: Asset): Promise<void> {
    await this.#transport.rpc("v2_put_asset", { p_asset: serializeAsset(asset) });
  }

  async postTransaction(transaction: LedgerTransaction): Promise<void> {
    await this.#transport.rpc("v2_post_transaction", {
      p_transaction: serializeTransaction(transaction),
    });
  }

  async appendPriceQuote(quote: PriceQuote): Promise<void> {
    await this.#transport.rpc("v2_append_price_quote", {
      p_quote: serializePriceQuote(quote),
    });
  }

  async appendFxRate(rate: FxRate): Promise<void> {
    await this.#transport.rpc("v2_append_fx_rate", { p_rate: serializeFxRate(rate) });
  }

  async completeOnboarding(input: CompleteOnboardingInput): Promise<UserProfile> {
    return parseProfileDto(
      await this.#transport.rpc("v2_complete_onboarding", {
        p_profile: serializeOnboarding(input),
      }),
    );
  }
}

export class SupabaseV2IdentityProvider implements IdentityProvider {
  readonly #transport: V2Transport;

  constructor(transport: V2Transport = new SupabaseV2Transport()) {
    this.#transport = transport;
  }

  async currentUser(): Promise<AuthenticatedUser | null> {
    const user = await this.#transport.getAuthenticatedUser();
    if (!user) return null;
    return Object.freeze({ id: authUserId(user.id), email: user.email });
  }

  async requireUser(): Promise<AuthenticatedUser> {
    const user = await this.currentUser();
    if (!user) throw new Error("Authentication required.");
    return user;
  }
}
