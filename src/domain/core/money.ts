import { Decimal, type DecimalRoundingMode } from "./decimal";
import { DomainError } from "./domain-error";

export class CurrencyCodeError extends DomainError {
  readonly code = "CURRENCY_CODE_ERROR";

  constructor(input: string) {
    super(
      `Currency code must contain exactly three ASCII letters; received ${JSON.stringify(input)}.`,
    );
  }
}

export class CurrencyMismatchError extends DomainError {
  readonly code = "CURRENCY_MISMATCH";

  constructor(left: CurrencyCode, right: CurrencyCode) {
    super(`Currency mismatch: ${left.toString()} cannot be combined with ${right.toString()}.`);
  }
}

export class MoneyConversionRateError extends DomainError {
  readonly code = "MONEY_CONVERSION_RATE_ERROR";

  constructor(rate: Decimal) {
    super(`Currency conversion rate must be greater than zero; received ${rate.toString()}.`);
  }
}

export class CurrencyCode {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
    Object.freeze(this);
  }

  static parse(input: string): CurrencyCode {
    if (input.trim() !== input || !/^[A-Za-z]{3}$/.test(input)) {
      throw new CurrencyCodeError(input);
    }

    return new CurrencyCode(input.toUpperCase());
  }

  equals(other: CurrencyCode): boolean {
    return this.#value === other.#value;
  }

  toString(): string {
    return this.#value;
  }

  toJSON(): string {
    return this.#value;
  }
}

export type SerializedMoney = Readonly<{
  amount: string;
  currency: string;
}>;

export class Money {
  readonly amount: Decimal;
  readonly currency: CurrencyCode;

  private constructor(amount: Decimal, currency: CurrencyCode) {
    this.amount = amount;
    this.currency = currency;
    Object.freeze(this);
  }

  static of(amount: Decimal | string, currency: CurrencyCode | string): Money {
    return new Money(
      typeof amount === "string" ? Decimal.parse(amount) : amount,
      typeof currency === "string" ? CurrencyCode.parse(currency) : currency,
    );
  }

  static zero(currency: CurrencyCode | string): Money {
    return Money.of(Decimal.zero(), currency);
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.plus(other.amount), this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.minus(other.amount), this.currency);
  }

  times(factor: Decimal): Money {
    return new Money(this.amount.times(factor), this.currency);
  }

  dividedBy(divisor: Decimal, scale: number, rounding: DecimalRoundingMode): Money {
    return new Money(this.amount.dividedBy(divisor, scale, rounding), this.currency);
  }

  convert(
    rate: Decimal,
    targetCurrency: CurrencyCode | string,
    scale: number,
    rounding: DecimalRoundingMode,
  ): Money {
    if (rate.compare(Decimal.zero()) <= 0) {
      throw new MoneyConversionRateError(rate);
    }

    const target =
      typeof targetCurrency === "string" ? CurrencyCode.parse(targetCurrency) : targetCurrency;
    const converted = this.amount.multipliedBy(rate, scale, rounding);
    return new Money(converted, target);
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    return this.amount.compare(other.amount);
  }

  negate(): Money {
    return new Money(this.amount.negate(), this.currency);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  toJSON(): SerializedMoney {
    return {
      amount: this.amount.toString(),
      currency: this.currency.toString(),
    };
  }

  private assertSameCurrency(other: Money): void {
    if (!this.currency.equals(other.currency)) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
