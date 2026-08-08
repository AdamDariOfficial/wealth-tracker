import type { Account, AccountId } from "../accounts";
import type { Asset, AssetId } from "../assets";
import {
  CurrencyCode,
  Decimal,
  type DecimalRoundingMode,
  DomainError,
  MAX_DECIMAL_SCALE,
  Money,
} from "../core";
import type { LedgerBalance, LedgerSnapshot } from "../ledger";
import { FxRate, PriceQuote } from "./market-data";

export type MissingValuationReason = "missing-price" | "missing-fx-rate";

export type KnownValuedPosition = Readonly<{
  status: "known";
  accountId: AccountId;
  assetId: AssetId;
  quantity: Decimal;
  value: Money;
  quote: PriceQuote | null;
  fxRate: FxRate | null;
}>;

export type UnknownValuedPosition = Readonly<{
  status: "unknown";
  accountId: AccountId;
  assetId: AssetId;
  quantity: Decimal;
  reason: MissingValuationReason;
  quoteCurrency: CurrencyCode | null;
}>;

export type ValuedPosition = KnownValuedPosition | UnknownValuedPosition;

export type LedgerValuation = Readonly<{
  baseCurrency: CurrencyCode;
  knownTotal: Money;
  complete: boolean;
  knownPositionCount: number;
  totalPositionCount: number;
  positions: readonly ValuedPosition[];
  excludedBalances: readonly LedgerBalance[];
}>;

export type ValueLedgerInput = Readonly<{
  snapshot: LedgerSnapshot;
  accounts: readonly Account[];
  assets: readonly Asset[];
  baseCurrency: CurrencyCode | string;
  priceQuotes: readonly PriceQuote[];
  fxRates: readonly FxRate[];
  calculationScale?: number;
  rounding?: DecimalRoundingMode;
}>;

export class ValuationInvariantError extends DomainError {
  readonly code = "VALUATION_INVARIANT_ERROR";

  constructor(message: string) {
    super(message);
  }
}

function assertUniqueById<T>(
  values: readonly T[],
  getId: (value: T) => string,
  label: string,
): Map<string, T> {
  const result = new Map<string, T>();

  for (const value of values) {
    const id = getId(value);
    if (result.has(id)) {
      throw new ValuationInvariantError(`Duplicate ${label} ID: ${id}.`);
    }
    result.set(id, value);
  }

  return result;
}

function latestPriceQuotes(quotes: readonly PriceQuote[]): Map<string, PriceQuote> {
  const result = new Map<string, PriceQuote>();

  for (const quote of quotes) {
    const key = quote.assetId.toString();
    const current = result.get(key);
    if (!current || quote.asOf.compare(current.asOf) > 0) {
      result.set(key, quote);
      continue;
    }

    if (quote.asOf.equals(current.asOf)) {
      throw new ValuationInvariantError(
        `Conflicting price quotes for asset ${key} at ${quote.asOf.toString()}.`,
      );
    }
  }

  return result;
}

function latestFxRates(rates: readonly FxRate[]): Map<string, FxRate> {
  const result = new Map<string, FxRate>();

  for (const rate of rates) {
    const key = JSON.stringify([rate.sourceCurrency.toString(), rate.targetCurrency.toString()]);
    const current = result.get(key);
    if (!current || rate.asOf.compare(current.asOf) > 0) {
      result.set(key, rate);
      continue;
    }

    if (rate.asOf.equals(current.asOf)) {
      throw new ValuationInvariantError(
        `Conflicting FX rates for ${key} at ${rate.asOf.toString()}.`,
      );
    }
  }

  return result;
}

function findFxRate(
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  rates: ReadonlyMap<string, FxRate>,
  scale: number,
  rounding: DecimalRoundingMode,
): FxRate | null {
  const directKey = JSON.stringify([sourceCurrency.toString(), targetCurrency.toString()]);
  const direct = rates.get(directKey);
  if (direct) return direct;

  const inverseKey = JSON.stringify([targetCurrency.toString(), sourceCurrency.toString()]);
  const inverse = rates.get(inverseKey);
  return inverse ? inverse.inverted(scale, rounding) : null;
}

function valuePositionInQuoteCurrency(
  quantity: Decimal,
  unitPrice: Money,
  scale: number,
  rounding: DecimalRoundingMode,
): Money {
  const amount = unitPrice.amount.multipliedBy(quantity, scale, rounding);
  return Money.of(amount, unitPrice.currency);
}

export function valueLedger(input: ValueLedgerInput): LedgerValuation {
  const baseCurrency =
    typeof input.baseCurrency === "string"
      ? CurrencyCode.parse(input.baseCurrency)
      : input.baseCurrency;
  const calculationScale = input.calculationScale ?? MAX_DECIMAL_SCALE;
  const rounding = input.rounding ?? "half-even";

  if (
    !Number.isInteger(calculationScale) ||
    calculationScale < 0 ||
    calculationScale > MAX_DECIMAL_SCALE
  ) {
    throw new ValuationInvariantError(
      `calculationScale must be an integer between 0 and ${MAX_DECIMAL_SCALE}.`,
    );
  }

  const accountById = assertUniqueById(
    input.accounts,
    (account) => account.id.toString(),
    "account",
  );
  const assetById = assertUniqueById(input.assets, (asset) => asset.id.toString(), "asset");
  for (const quote of input.priceQuotes) {
    const asset = assetById.get(quote.assetId.toString());
    if (!asset) {
      throw new ValuationInvariantError(
        `Price quote references unknown asset ${quote.assetId.toString()}.`,
      );
    }

    if (asset.kind === "fiat") {
      throw new ValuationInvariantError(
        `Fiat asset ${asset.id.toString()} must be valued through FX rates, not price quotes.`,
      );
    }
  }

  const priceByAsset = latestPriceQuotes(input.priceQuotes);
  const fxByPair = latestFxRates(input.fxRates);
  const positions: ValuedPosition[] = [];
  const excludedBalances: LedgerBalance[] = [];
  let knownTotal = Money.zero(baseCurrency);

  for (const balance of input.snapshot.balances) {
    const account = accountById.get(balance.accountId.toString());
    const asset = assetById.get(balance.assetId.toString());

    if (!account) {
      throw new ValuationInvariantError(
        `Ledger balance references unknown account ${balance.accountId.toString()}.`,
      );
    }

    if (!asset) {
      throw new ValuationInvariantError(
        `Ledger balance references unknown asset ${balance.assetId.toString()}.`,
      );
    }

    if (!account.includeInNetWorth) {
      excludedBalances.push(balance);
      continue;
    }

    const quote = asset.kind === "fiat" ? null : (priceByAsset.get(asset.id.toString()) ?? null);
    const unitPrice =
      asset.kind === "fiat" ? Money.of("1", asset.fiatCurrency as CurrencyCode) : quote?.unitPrice;

    if (!unitPrice) {
      positions.push(
        Object.freeze({
          status: "unknown",
          accountId: balance.accountId,
          assetId: balance.assetId,
          quantity: balance.quantity,
          reason: "missing-price",
          quoteCurrency: null,
        }),
      );
      continue;
    }

    const valueInQuote = valuePositionInQuoteCurrency(
      balance.quantity,
      unitPrice,
      calculationScale,
      rounding,
    );

    let value: Money;
    let fxRate: FxRate | null = null;
    if (valueInQuote.currency.equals(baseCurrency)) {
      value = Money.of(valueInQuote.amount, baseCurrency);
    } else {
      fxRate = findFxRate(
        valueInQuote.currency,
        baseCurrency,
        fxByPair,
        calculationScale,
        rounding,
      );

      if (!fxRate) {
        positions.push(
          Object.freeze({
            status: "unknown",
            accountId: balance.accountId,
            assetId: balance.assetId,
            quantity: balance.quantity,
            reason: "missing-fx-rate",
            quoteCurrency: valueInQuote.currency,
          }),
        );
        continue;
      }

      value = fxRate.convert(valueInQuote, calculationScale, rounding);
    }

    knownTotal = knownTotal.plus(value);
    positions.push(
      Object.freeze({
        status: "known",
        accountId: balance.accountId,
        assetId: balance.assetId,
        quantity: balance.quantity,
        value,
        quote,
        fxRate,
      }),
    );
  }

  const knownPositionCount = positions.filter((position) => position.status === "known").length;
  const totalPositionCount = positions.length;

  return Object.freeze({
    baseCurrency,
    knownTotal,
    complete: knownPositionCount === totalPositionCount,
    knownPositionCount,
    totalPositionCount,
    positions: Object.freeze([...positions]),
    excludedBalances: Object.freeze([...excludedBalances]),
  });
}
