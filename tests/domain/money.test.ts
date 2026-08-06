import { describe, expect, test } from "bun:test";

import { Decimal } from "../../src/domain/core/decimal";
import {
  CurrencyCode,
  CurrencyCodeError,
  CurrencyMismatchError,
  Money,
  MoneyConversionRateError,
} from "../../src/domain/core/money";

describe("CurrencyCode", () => {
  test("normalizes three-letter codes", () => {
    expect(CurrencyCode.parse("eur").toString()).toBe("EUR");
    expect(CurrencyCode.parse("JOD").toString()).toBe("JOD");
  });

  test("rejects invalid codes", () => {
    const invalidCodes = [" EU", "EU", "EURO", "€UR", "12A"];

    for (const value of invalidCodes) {
      expect(() => CurrencyCode.parse(value)).toThrow(CurrencyCodeError);
    }
  });
});

describe("Money", () => {
  test("adds and subtracts one currency", () => {
    const balance = Money.of("100.10", "EUR");
    const movement = Money.of("0.20", "eur");

    expect(balance.plus(movement).amount.toString()).toBe("100.3");
    expect(balance.minus(movement).amount.toString()).toBe("99.9");
  });

  test("rejects currency mismatches", () => {
    const euros = Money.of("10", "EUR");
    const dollars = Money.of("10", "USD");

    expect(() => euros.plus(dollars)).toThrow(CurrencyMismatchError);
    expect(() => euros.minus(dollars)).toThrow(CurrencyMismatchError);
    expect(() => euros.compare(dollars)).toThrow(CurrencyMismatchError);
  });

  test("multiplies by an exact factor", () => {
    const price = Money.of("19.99", "EUR");
    const total = price.times(Decimal.parse("3"));

    expect(total.amount.toString()).toBe("59.97");
  });

  test("converts through explicit inputs", () => {
    const euros = Money.of("100", "EUR");
    const dollars = euros.convert(Decimal.parse("1.08765"), "USD", 2, "half-even");

    expect(dollars.toJSON()).toEqual({ amount: "108.76", currency: "USD" });
  });

  test("rounds high-precision conversion at the requested boundary", () => {
    const source = Money.of("0.123456789012345678", "EUR");
    const converted = source.convert(Decimal.parse("1.234567890123456789"), "USD", 8, "half-even");

    expect(converted.toJSON()).toEqual({
      amount: "0.15241579",
      currency: "USD",
    });
  });

  test("rejects invalid conversion rates", () => {
    const euros = Money.of("100", "EUR");
    const zeroRate = () => euros.convert(Decimal.zero(), "USD", 2, "half-even");
    const negativeRate = () => euros.convert(Decimal.parse("-1"), "USD", 2, "half-even");

    expect(zeroRate).toThrow(MoneyConversionRateError);
    expect(negativeRate).toThrow(MoneyConversionRateError);
  });

  test("preserves currency on zero", () => {
    const zero = Money.zero("JOD");

    expect(zero.isZero()).toBe(true);
    expect(zero.toJSON()).toEqual({ amount: "0", currency: "JOD" });
  });

  test("serializes amount as a string", () => {
    const serialized = JSON.stringify(Money.of("9007199254740993.01", "EUR"));

    expect(serialized).toBe('{"amount":"9007199254740993.01","currency":"EUR"}');
  });
});
