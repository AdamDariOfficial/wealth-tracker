import { DomainError } from "./domain-error";

export const MAX_DECIMAL_SCALE = 18;

export type DecimalRoundingMode = "toward-zero" | "half-up" | "half-even";

export class DecimalParseError extends DomainError {
  readonly code = "DECIMAL_PARSE_ERROR";

  constructor(input: string) {
    super(`Invalid decimal literal: ${JSON.stringify(input)}.`);
  }
}

export class DecimalScaleError extends DomainError {
  readonly code = "DECIMAL_SCALE_ERROR";

  constructor(scale: number) {
    super(
      `Decimal scale must be an integer between 0 and ${MAX_DECIMAL_SCALE}; received ${scale}.`,
    );
  }
}

export class DecimalDivisionByZeroError extends DomainError {
  readonly code = "DECIMAL_DIVISION_BY_ZERO";

  constructor() {
    super("Cannot divide by zero.");
  }
}

export class DecimalUnsafeIntegerError extends DomainError {
  readonly code = "DECIMAL_UNSAFE_INTEGER";

  constructor(value: number) {
    super(`Decimal.fromInteger requires a safe integer; received ${value}.`);
  }
}

const MAX_INTERNAL_POWER = MAX_DECIMAL_SCALE * 2;
const POWERS_OF_TEN: bigint[] = [1n];

function assertScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_DECIMAL_SCALE) {
    throw new DecimalScaleError(scale);
  }
}

function powerOfTen(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > MAX_INTERNAL_POWER) {
    throw new DecimalScaleError(exponent);
  }

  for (let index = POWERS_OF_TEN.length; index <= exponent; index += 1) {
    POWERS_OF_TEN.push(POWERS_OF_TEN[index - 1] * 10n);
  }

  return POWERS_OF_TEN[exponent];
}

function signOf(value: bigint): bigint {
  if (value < 0n) return -1n;
  if (value > 0n) return 1n;
  return 0n;
}

function roundQuotient(numerator: bigint, denominator: bigint, mode: DecimalRoundingMode): bigint {
  if (denominator === 0n) {
    throw new DecimalDivisionByZeroError();
  }

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;

  if (remainder === 0n || mode === "toward-zero") {
    return quotient;
  }

  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const doubledRemainder = absoluteRemainder * 2n;
  const adjustment = signOf(numerator) * signOf(denominator);

  if (mode === "half-up") {
    return doubledRemainder >= absoluteDenominator ? quotient + adjustment : quotient;
  }

  if (doubledRemainder > absoluteDenominator) {
    return quotient + adjustment;
  }

  if (doubledRemainder < absoluteDenominator) {
    return quotient;
  }

  const absoluteQuotient = quotient < 0n ? -quotient : quotient;
  return absoluteQuotient % 2n === 1n ? quotient + adjustment : quotient;
}

function normalize(coefficient: bigint, scale: number): readonly [bigint, number] {
  if (coefficient === 0n) {
    return [0n, 0] as const;
  }

  let normalizedCoefficient = coefficient;
  let normalizedScale = scale;

  while (normalizedScale > 0 && normalizedCoefficient % 10n === 0n) {
    normalizedCoefficient /= 10n;
    normalizedScale -= 1;
  }

  assertScale(normalizedScale);
  return [normalizedCoefficient, normalizedScale] as const;
}

function align(
  leftCoefficient: bigint,
  leftScale: number,
  rightCoefficient: bigint,
  rightScale: number,
): readonly [bigint, bigint, number] {
  const scale = Math.max(leftScale, rightScale);
  const alignedLeft = leftCoefficient * powerOfTen(scale - leftScale);
  const alignedRight = rightCoefficient * powerOfTen(scale - rightScale);
  return [alignedLeft, alignedRight, scale] as const;
}

export class Decimal {
  readonly #coefficient: bigint;
  readonly #scale: number;

  private constructor(coefficient: bigint, scale: number) {
    const [normalizedCoefficient, normalizedScale] = normalize(coefficient, scale);
    this.#coefficient = normalizedCoefficient;
    this.#scale = normalizedScale;
    Object.freeze(this);
  }

  static zero(): Decimal {
    return new Decimal(0n, 0);
  }

  static fromInteger(value: bigint | number): Decimal {
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) {
        throw new DecimalUnsafeIntegerError(value);
      }
      return new Decimal(BigInt(value), 0);
    }

    return new Decimal(value, 0);
  }

  static parse(input: string): Decimal {
    if (input.trim() !== input) {
      throw new DecimalParseError(input);
    }

    const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(input);
    if (!match) {
      throw new DecimalParseError(input);
    }

    const sign = match[1] === "-" ? -1n : 1n;
    const integerDigits = match[2];
    const fractionalDigits = match[3] ?? "";

    if (fractionalDigits.length > MAX_DECIMAL_SCALE) {
      throw new DecimalScaleError(fractionalDigits.length);
    }

    const digits = `${integerDigits}${fractionalDigits}`;
    return new Decimal(sign * BigInt(digits), fractionalDigits.length);
  }

  get scale(): number {
    return this.#scale;
  }

  plus(other: Decimal): Decimal {
    const [left, right, scale] = align(
      this.#coefficient,
      this.#scale,
      other.#coefficient,
      other.#scale,
    );
    return new Decimal(left + right, scale);
  }

  minus(other: Decimal): Decimal {
    return this.plus(other.negate());
  }

  times(other: Decimal): Decimal {
    const coefficient = this.#coefficient * other.#coefficient;
    const scale = this.#scale + other.#scale;

    if (coefficient === 0n) {
      return Decimal.zero();
    }

    let normalizedCoefficient = coefficient;
    let normalizedScale = scale;

    while (normalizedScale > MAX_DECIMAL_SCALE && normalizedCoefficient % 10n === 0n) {
      normalizedCoefficient /= 10n;
      normalizedScale -= 1;
    }

    assertScale(normalizedScale);
    return new Decimal(normalizedCoefficient, normalizedScale);
  }

  multipliedBy(other: Decimal, scale: number, rounding: DecimalRoundingMode): Decimal {
    assertScale(scale);

    const coefficient = this.#coefficient * other.#coefficient;
    const productScale = this.#scale + other.#scale;

    if (scale >= productScale) {
      return new Decimal(coefficient * powerOfTen(scale - productScale), scale);
    }

    return new Decimal(
      roundQuotient(coefficient, powerOfTen(productScale - scale), rounding),
      scale,
    );
  }

  dividedBy(divisor: Decimal, scale: number, rounding: DecimalRoundingMode): Decimal {
    assertScale(scale);

    if (divisor.isZero()) {
      throw new DecimalDivisionByZeroError();
    }

    const numerator = this.#coefficient * powerOfTen(divisor.#scale) * powerOfTen(scale);
    const denominator = divisor.#coefficient * powerOfTen(this.#scale);
    return new Decimal(roundQuotient(numerator, denominator, rounding), scale);
  }

  quantize(scale: number, rounding: DecimalRoundingMode): Decimal {
    assertScale(scale);

    if (scale >= this.#scale) {
      return new Decimal(this.#coefficient * powerOfTen(scale - this.#scale), scale);
    }

    const divisor = powerOfTen(this.#scale - scale);
    return new Decimal(roundQuotient(this.#coefficient, divisor, rounding), scale);
  }

  compare(other: Decimal): -1 | 0 | 1 {
    const [left, right] = align(this.#coefficient, this.#scale, other.#coefficient, other.#scale);

    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }

  equals(other: Decimal): boolean {
    return this.compare(other) === 0;
  }

  negate(): Decimal {
    return new Decimal(-this.#coefficient, this.#scale);
  }

  abs(): Decimal {
    return this.#coefficient < 0n ? this.negate() : this;
  }

  isZero(): boolean {
    return this.#coefficient === 0n;
  }

  isNegative(): boolean {
    return this.#coefficient < 0n;
  }

  toFixed(scale: number, rounding: DecimalRoundingMode): string {
    assertScale(scale);

    let coefficient: bigint;
    if (scale >= this.#scale) {
      coefficient = this.#coefficient * powerOfTen(scale - this.#scale);
    } else {
      coefficient = roundQuotient(this.#coefficient, powerOfTen(this.#scale - scale), rounding);
    }

    const negative = coefficient < 0n;
    const absoluteDigits = (negative ? -coefficient : coefficient).toString();

    if (scale === 0) {
      return `${negative ? "-" : ""}${absoluteDigits}`;
    }

    const padded = absoluteDigits.padStart(scale + 1, "0");
    const integerPart = padded.slice(0, -scale);
    const fractionalPart = padded.slice(-scale);
    return `${negative ? "-" : ""}${integerPart}.${fractionalPart}`;
  }

  toString(): string {
    return this.toFixed(this.#scale, "toward-zero");
  }

  toJSON(): string {
    return this.toString();
  }
}
