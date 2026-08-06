import { describe, expect, test } from "bun:test";

import {
  Decimal,
  DecimalDivisionByZeroError,
  DecimalParseError,
  DecimalScaleError,
  DecimalUnsafeIntegerError,
} from "../../src/domain/core/decimal";

describe("Decimal", () => {
  test("parses canonical decimal strings", () => {
    expect(Decimal.parse("001.2300").toString()).toBe("1.23");
    expect(Decimal.parse("-0").toString()).toBe("0");
    expect(Decimal.parse("+42").toString()).toBe("42");
  });

  test("rejects unsupported literals", () => {
    const invalidInputs = ["", " 1", "1 ", ".5", "1.", "1e3", "NaN", "Infinity"];

    for (const input of invalidInputs) {
      expect(() => Decimal.parse(input)).toThrow(DecimalParseError);
    }
  });

  test("rejects excessive scale", () => {
    const parse = () => Decimal.parse("0.1234567890123456789");
    expect(parse).toThrow(DecimalScaleError);
  });

  test("accepts bigint and safe integers only", () => {
    const largeInteger = Decimal.fromInteger(9007199254740993n);
    const unsafeInteger = () => Decimal.fromInteger(Number.MAX_SAFE_INTEGER + 1);

    expect(Decimal.fromInteger(42).toString()).toBe("42");
    expect(largeInteger.toString()).toBe("9007199254740993");
    expect(unsafeInteger).toThrow(DecimalUnsafeIntegerError);
  });

  test("adds and subtracts exactly", () => {
    const sum = Decimal.parse("0.1").plus(Decimal.parse("0.2"));
    const preciseDifference = Decimal.parse("1000.00000001").minus(Decimal.parse("0.00000001"));
    const negativeDifference = Decimal.parse("1.25").minus(Decimal.parse("2.5"));

    expect(sum.toString()).toBe("0.3");
    expect(preciseDifference.toString()).toBe("1000");
    expect(negativeDifference.toString()).toBe("-1.25");
  });

  test("multiplies at supported scale", () => {
    const fiatProduct = Decimal.parse("12.50").times(Decimal.parse("3.2"));
    const cryptoProduct = Decimal.parse("0.00000001").times(Decimal.parse("2"));

    expect(fiatProduct.toString()).toBe("40");
    expect(cryptoProduct.toString()).toBe("0.00000002");
  });

  test("multiplies high-precision values into an explicit scale", () => {
    const product = Decimal.parse("0.123456789012345678").multipliedBy(
      Decimal.parse("1.234567890123456789"),
      8,
      "half-even",
    );

    expect(product.toString()).toBe("0.15241579");
  });

  test("divides with explicit scale and rounding", () => {
    const eighth = Decimal.parse("1").dividedBy(Decimal.parse("8"), 4, "toward-zero");
    const twoThirds = Decimal.parse("2").dividedBy(Decimal.parse("3"), 2, "half-up");

    expect(eighth.toFixed(4, "toward-zero")).toBe("0.1250");
    expect(twoThirds.toString()).toBe("0.67");
  });

  test("supports explicit rounding modes", () => {
    expect(Decimal.parse("1.25").quantize(1, "half-up").toString()).toBe("1.3");
    expect(Decimal.parse("-1.25").quantize(1, "half-up").toString()).toBe("-1.3");
    expect(Decimal.parse("1.25").quantize(1, "half-even").toString()).toBe("1.2");
    expect(Decimal.parse("1.35").quantize(1, "half-even").toString()).toBe("1.4");
    expect(Decimal.parse("-1.25").quantize(1, "half-even").toString()).toBe("-1.2");
  });

  test("throws on division by zero", () => {
    const divideByZero = () => Decimal.parse("1").dividedBy(Decimal.zero(), 2, "half-even");

    expect(divideByZero).toThrow(DecimalDivisionByZeroError);
  });

  test("compares values across scales", () => {
    expect(Decimal.parse("1.0").compare(Decimal.parse("1.000"))).toBe(0);
    expect(Decimal.parse("-2").compare(Decimal.parse("-1.999"))).toBe(-1);
    expect(Decimal.parse("5.01").compare(Decimal.parse("5"))).toBe(1);
  });

  test("formats fixed-scale output", () => {
    expect(Decimal.parse("123.4").toFixed(4, "half-even")).toBe("123.4000");
    expect(Decimal.parse("9.999").toFixed(2, "half-up")).toBe("10.00");
    expect(Decimal.parse("-0.004").toFixed(2, "half-up")).toBe("0.00");
  });

  test("serializes as a string", () => {
    const serialized = JSON.stringify({ value: Decimal.parse("10.500") });
    expect(serialized).toBe('{"value":"10.5"}');
  });
});
