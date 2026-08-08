import { CurrencyCode, DomainError, EntityId, MAX_DECIMAL_SCALE } from "../core";

export const ASSET_KINDS = [
  "fiat",
  "crypto",
  "equity",
  "etf",
  "fund",
  "commodity",
  "other",
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];
export type AssetId = EntityId<"asset">;

export class AssetInvariantError extends DomainError {
  readonly code = "ASSET_INVARIANT_ERROR";

  constructor(message: string) {
    super(message);
  }
}

export type AssetInput = Readonly<{
  id: AssetId;
  symbol: string;
  name: string;
  kind: AssetKind;
  precision: number;
  fiatCurrency?: CurrencyCode | string | null;
}>;

function assertSymbol(symbol: string): string {
  if (symbol.trim() !== symbol || !/^[A-Za-z0-9][A-Za-z0-9.-]{0,15}$/.test(symbol)) {
    throw new AssetInvariantError(
      "Asset symbol must contain 1-16 trimmed ASCII letters, digits, dots or hyphens.",
    );
  }

  return symbol.toUpperCase();
}

function assertName(name: string): void {
  if (name.trim() !== name || name.length === 0 || name.length > 120) {
    throw new AssetInvariantError("Asset name must contain 1-120 trimmed characters.");
  }
}

export function assetId(input: string): AssetId {
  return EntityId.parse<"asset">(input);
}

export class Asset {
  readonly id: AssetId;
  readonly symbol: string;
  readonly name: string;
  readonly kind: AssetKind;
  readonly precision: number;
  readonly fiatCurrency: CurrencyCode | null;

  private constructor(
    input: Omit<AssetInput, "symbol" | "fiatCurrency"> & {
      symbol: string;
      fiatCurrency: CurrencyCode | null;
    },
  ) {
    this.id = input.id;
    this.symbol = input.symbol;
    this.name = input.name;
    this.kind = input.kind;
    this.precision = input.precision;
    this.fiatCurrency = input.fiatCurrency;
    Object.freeze(this);
  }

  static create(input: AssetInput): Asset {
    const symbol = assertSymbol(input.symbol);
    assertName(input.name);

    if (!ASSET_KINDS.includes(input.kind)) {
      throw new AssetInvariantError(`Unsupported asset kind: ${String(input.kind)}.`);
    }

    if (
      !Number.isInteger(input.precision) ||
      input.precision < 0 ||
      input.precision > MAX_DECIMAL_SCALE
    ) {
      throw new AssetInvariantError(
        `Asset precision must be an integer between 0 and ${MAX_DECIMAL_SCALE}.`,
      );
    }

    const fiatCurrency =
      input.fiatCurrency == null
        ? null
        : typeof input.fiatCurrency === "string"
          ? CurrencyCode.parse(input.fiatCurrency)
          : input.fiatCurrency;

    if (input.kind === "fiat" && fiatCurrency === null) {
      throw new AssetInvariantError("Fiat assets require fiatCurrency.");
    }

    if (input.kind !== "fiat" && fiatCurrency !== null) {
      throw new AssetInvariantError("Only fiat assets may define fiatCurrency.");
    }

    if (fiatCurrency && fiatCurrency.toString() !== symbol) {
      throw new AssetInvariantError("Fiat asset symbol must match fiatCurrency.");
    }

    return new Asset({ ...input, symbol, fiatCurrency });
  }
}
