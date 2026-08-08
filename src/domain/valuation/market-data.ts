import type { AssetId } from "../assets";
import {
  CurrencyCode,
  CurrencyMismatchError,
  Decimal,
  type DecimalRoundingMode,
  DomainError,
  Money,
  UtcTimestamp,
} from "../core";

export class MarketDataInvariantError extends DomainError {
  readonly code = "MARKET_DATA_INVARIANT_ERROR";

  constructor(message: string) {
    super(message);
  }
}

export type PriceQuoteInput = Readonly<{
  assetId: AssetId;
  unitPrice: Money;
  asOf: UtcTimestamp;
}>;

export class PriceQuote {
  readonly assetId: AssetId;
  readonly unitPrice: Money;
  readonly asOf: UtcTimestamp;

  private constructor(input: PriceQuoteInput) {
    this.assetId = input.assetId;
    this.unitPrice = input.unitPrice;
    this.asOf = input.asOf;
    Object.freeze(this);
  }

  static create(input: PriceQuoteInput): PriceQuote {
    if (input.unitPrice.amount.isNegative()) {
      throw new MarketDataInvariantError("Asset unit price cannot be negative.");
    }

    return new PriceQuote(input);
  }
}

export type FxRateInput = Readonly<{
  sourceCurrency: CurrencyCode | string;
  targetCurrency: CurrencyCode | string;
  rate: Decimal | string;
  asOf: UtcTimestamp;
}>;

export class FxRate {
  readonly sourceCurrency: CurrencyCode;
  readonly targetCurrency: CurrencyCode;
  readonly rate: Decimal;
  readonly asOf: UtcTimestamp;

  private constructor(
    input: Omit<FxRateInput, "sourceCurrency" | "targetCurrency" | "rate"> & {
      sourceCurrency: CurrencyCode;
      targetCurrency: CurrencyCode;
      rate: Decimal;
    },
  ) {
    this.sourceCurrency = input.sourceCurrency;
    this.targetCurrency = input.targetCurrency;
    this.rate = input.rate;
    this.asOf = input.asOf;
    Object.freeze(this);
  }

  static create(input: FxRateInput): FxRate {
    const sourceCurrency =
      typeof input.sourceCurrency === "string"
        ? CurrencyCode.parse(input.sourceCurrency)
        : input.sourceCurrency;
    const targetCurrency =
      typeof input.targetCurrency === "string"
        ? CurrencyCode.parse(input.targetCurrency)
        : input.targetCurrency;
    const rate = typeof input.rate === "string" ? Decimal.parse(input.rate) : input.rate;

    if (sourceCurrency.equals(targetCurrency)) {
      throw new MarketDataInvariantError("FX source and target currencies must differ.");
    }

    if (rate.compare(Decimal.zero()) <= 0) {
      throw new MarketDataInvariantError("FX rate must be greater than zero.");
    }

    return new FxRate({ ...input, sourceCurrency, targetCurrency, rate });
  }

  convert(amount: Money, scale: number, rounding: DecimalRoundingMode): Money {
    if (!amount.currency.equals(this.sourceCurrency)) {
      throw new CurrencyMismatchError(amount.currency, this.sourceCurrency);
    }

    return amount.convert(this.rate, this.targetCurrency, scale, rounding);
  }

  inverted(scale: number, rounding: DecimalRoundingMode): FxRate {
    const inverse = Decimal.fromInteger(1n).dividedBy(this.rate, scale, rounding);
    return FxRate.create({
      sourceCurrency: this.targetCurrency,
      targetCurrency: this.sourceCurrency,
      rate: inverse,
      asOf: this.asOf,
    });
  }
}
