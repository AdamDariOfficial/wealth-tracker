import {
  Account,
  type AccountKind,
  type AccountOwnership,
  accountId,
} from "../../../domain/accounts";
import { Asset, type AssetKind, assetId } from "../../../domain/assets";
import { CurrencyCode, Money, UtcTimestamp } from "../../../domain/core";
import {
  LedgerTransaction,
  type TransactionPurpose,
  transactionId,
  transactionLegId,
} from "../../../domain/ledger";
import { FxRate, PriceQuote } from "../../../domain/valuation";
import { userProfile, type UserProfile } from "../../../application/profile";
import type { PersistedFinancialState } from "../../../application/ports";

export class SupabaseV2DtoError extends Error {
  readonly code = "SUPABASE_V2_DTO_ERROR";

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SupabaseV2DtoError(`${label} must be an object.`);
  }
  return value as JsonRecord;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new SupabaseV2DtoError(`${label} must be an array.`);
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") throw new SupabaseV2DtoError(`${label} must be a string.`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return stringValue(value, label);
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new SupabaseV2DtoError(`${label} must be a boolean.`);
  return value;
}

function integerValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new SupabaseV2DtoError(`${label} must be an integer.`);
  }
  return value;
}

function parseProfile(value: unknown): UserProfile | null {
  if (value === null) return null;
  const row = record(value, "profile");
  return userProfile({
    displayName: nullableString(row.displayName, "profile.displayName"),
    baseCurrency: nullableString(row.baseCurrency, "profile.baseCurrency"),
    locale: nullableString(row.locale, "profile.locale"),
    onboarded: booleanValue(row.onboarded, "profile.onboarded"),
  });
}

export function parseFinancialState(value: unknown): PersistedFinancialState {
  const root = record(value, "financial state");
  const accounts = array(root.accounts, "accounts").map((value, index) => {
    const row = record(value, `accounts[${index}]`);
    return Account.create({
      id: accountId(stringValue(row.id, `accounts[${index}].id`)),
      name: stringValue(row.name, `accounts[${index}].name`),
      kind: stringValue(row.kind, `accounts[${index}].kind`) as AccountKind,
      ownership: stringValue(row.ownership, `accounts[${index}].ownership`) as AccountOwnership,
      includeInNetWorth: booleanValue(
        row.includeInNetWorth,
        `accounts[${index}].includeInNetWorth`,
      ),
      openedAt:
        row.openedAt === null
          ? null
          : UtcTimestamp.parse(stringValue(row.openedAt, `accounts[${index}].openedAt`)),
      archivedAt:
        row.archivedAt === null
          ? null
          : UtcTimestamp.parse(stringValue(row.archivedAt, `accounts[${index}].archivedAt`)),
    });
  });

  const assets = array(root.assets, "assets").map((value, index) => {
    const row = record(value, `assets[${index}]`);
    return Asset.create({
      id: assetId(stringValue(row.id, `assets[${index}].id`)),
      symbol: stringValue(row.symbol, `assets[${index}].symbol`),
      name: stringValue(row.name, `assets[${index}].name`),
      kind: stringValue(row.kind, `assets[${index}].kind`) as AssetKind,
      precision: integerValue(row.precision, `assets[${index}].precision`),
      fiatCurrency: nullableString(row.fiatCurrency, `assets[${index}].fiatCurrency`),
    });
  });

  const transactions = array(root.transactions, "transactions").map((value, index) => {
    const row = record(value, `transactions[${index}]`);
    const legs = array(row.legs, `transactions[${index}].legs`).map((value, legIndex) => {
      const leg = record(value, `transactions[${index}].legs[${legIndex}]`);
      return {
        id: transactionLegId(stringValue(leg.id, `transactions[${index}].legs[${legIndex}].id`)),
        accountId: accountId(
          stringValue(leg.accountId, `transactions[${index}].legs[${legIndex}].accountId`),
        ),
        assetId: assetId(
          stringValue(leg.assetId, `transactions[${index}].legs[${legIndex}].assetId`),
        ),
        quantity: stringValue(leg.quantity, `transactions[${index}].legs[${legIndex}].quantity`),
        memo: nullableString(leg.memo, `transactions[${index}].legs[${legIndex}].memo`),
      };
    });
    const related = nullableString(
      row.relatedTransactionId,
      `transactions[${index}].relatedTransactionId`,
    );
    return LedgerTransaction.create({
      id: transactionId(stringValue(row.id, `transactions[${index}].id`)),
      occurredAt: UtcTimestamp.parse(
        stringValue(row.occurredAt, `transactions[${index}].occurredAt`),
      ),
      recordedAt: UtcTimestamp.parse(
        stringValue(row.recordedAt, `transactions[${index}].recordedAt`),
      ),
      description: stringValue(row.description, `transactions[${index}].description`),
      purpose: stringValue(row.purpose, `transactions[${index}].purpose`) as TransactionPurpose,
      relatedTransactionId: related === null ? null : transactionId(related),
      legs,
    });
  });

  const priceQuotes = array(root.priceQuotes, "priceQuotes").map((value, index) => {
    const row = record(value, `priceQuotes[${index}]`);
    return PriceQuote.create({
      assetId: assetId(stringValue(row.assetId, `priceQuotes[${index}].assetId`)),
      unitPrice: Money.of(
        stringValue(row.amount, `priceQuotes[${index}].amount`),
        stringValue(row.currency, `priceQuotes[${index}].currency`),
      ),
      asOf: UtcTimestamp.parse(stringValue(row.asOf, `priceQuotes[${index}].asOf`)),
    });
  });

  const fxRates = array(root.fxRates, "fxRates").map((value, index) => {
    const row = record(value, `fxRates[${index}]`);
    return FxRate.create({
      sourceCurrency: stringValue(row.sourceCurrency, `fxRates[${index}].sourceCurrency`),
      targetCurrency: stringValue(row.targetCurrency, `fxRates[${index}].targetCurrency`),
      rate: stringValue(row.rate, `fxRates[${index}].rate`),
      asOf: UtcTimestamp.parse(stringValue(row.asOf, `fxRates[${index}].asOf`)),
    });
  });

  return Object.freeze({
    profile: parseProfile(root.profile),
    accounts: Object.freeze(accounts),
    assets: Object.freeze(assets),
    transactions: Object.freeze(transactions),
    priceQuotes: Object.freeze(priceQuotes),
    fxRates: Object.freeze(fxRates),
  });
}

export function parseProfileDto(value: unknown): UserProfile {
  const profile = parseProfile(value);
  if (!profile) throw new SupabaseV2DtoError("Profile RPC returned null.");
  return profile;
}

export function serializeAccount(account: Account) {
  return {
    id: account.id.toString(),
    name: account.name,
    kind: account.kind,
    ownership: account.ownership,
    includeInNetWorth: account.includeInNetWorth,
    openedAt: account.openedAt?.toString() ?? null,
    archivedAt: account.archivedAt?.toString() ?? null,
  } as const;
}

export function serializeAsset(asset: Asset) {
  return {
    id: asset.id.toString(),
    symbol: asset.symbol,
    name: asset.name,
    kind: asset.kind,
    precision: asset.precision,
    fiatCurrency: asset.fiatCurrency?.toString() ?? null,
  } as const;
}

export function serializeTransaction(transaction: LedgerTransaction) {
  return {
    id: transaction.id.toString(),
    occurredAt: transaction.occurredAt.toString(),
    recordedAt: transaction.recordedAt.toString(),
    description: transaction.description,
    purpose: transaction.purpose,
    relatedTransactionId: transaction.relatedTransactionId?.toString() ?? null,
    legs: transaction.legs.map((leg) => ({
      id: leg.id.toString(),
      accountId: leg.accountId.toString(),
      assetId: leg.assetId.toString(),
      quantity: leg.quantity.toString(),
      memo: leg.memo,
    })),
  } as const;
}

export function serializePriceQuote(quote: PriceQuote) {
  return {
    assetId: quote.assetId.toString(),
    amount: quote.unitPrice.amount.toString(),
    currency: quote.unitPrice.currency.toString(),
    asOf: quote.asOf.toString(),
  } as const;
}

export function serializeFxRate(rate: FxRate) {
  return {
    sourceCurrency: rate.sourceCurrency.toString(),
    targetCurrency: rate.targetCurrency.toString(),
    rate: rate.rate.toString(),
    asOf: rate.asOf.toString(),
  } as const;
}

export function serializeOnboarding(input: {
  displayName?: string | null;
  baseCurrency: CurrencyCode | string;
  locale: string;
}) {
  return {
    displayName: input.displayName ?? null,
    baseCurrency:
      typeof input.baseCurrency === "string"
        ? CurrencyCode.parse(input.baseCurrency).toString()
        : input.baseCurrency.toString(),
    locale: input.locale,
  } as const;
}
