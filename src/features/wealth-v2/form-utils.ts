import { accountId } from "@/domain/accounts";
import { assetId } from "@/domain/assets";
import { Decimal } from "@/domain/core";
import { transactionLegId } from "@/domain/ledger";

export type DraftLeg = Readonly<{
  rowId: string;
  accountId: string;
  assetId: string;
  quantity: string;
  memo: string;
}>;

export function safeEntityId(prefix: string): string {
  const suffix = crypto.randomUUID().replaceAll("-", "");
  return `${prefix}:${suffix}`;
}

export function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Accepts a canonical decimal literal or an Italian-formatted decimal input.
 * Examples: 0,87 -> 0.87 and 54.360,33 -> 54360.33.
 * Ambiguous dot-only values are left canonical rather than guessed as grouping.
 */
export function normalizeLocalizedDecimalInput(value: string): string {
  const compact = value.trim().replace(/[\s\u00a0\u202f]/gu, "");
  if (!compact) return compact;

  const commas = compact.match(/,/gu)?.length ?? 0;
  if (commas === 0) return compact;
  if (commas !== 1) return compact;

  const [integerPart, fractionPart] = compact.split(",");
  if (!fractionPart || !/^\d+$/u.test(fractionPart)) return compact;
  if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)$/u.test(integerPart)) return compact;

  return integerPart.replaceAll(".", "") + "." + fractionPart;
}

export function buildTransactionLegInputs(legs: readonly DraftLeg[]) {
  return legs.map((leg, index) => ({
    id: transactionLegId(safeEntityId(`leg${index + 1}`)),
    accountId: accountId(leg.accountId),
    assetId: assetId(leg.assetId),
    quantity: Decimal.parse(normalizeLocalizedDecimalInput(leg.quantity)),
    memo: leg.memo.trim() || null,
  }));
}

export function isBalancedDraft(legs: readonly DraftLeg[]): boolean {
  if (legs.length < 2) return false;
  const totals = new Map<string, Decimal>();
  const pairs = new Set<string>();
  try {
    for (const leg of legs) {
      if (!leg.accountId || !leg.assetId || !leg.quantity.trim()) return false;
      const pair = JSON.stringify([leg.accountId, leg.assetId]);
      if (pairs.has(pair)) return false;
      pairs.add(pair);
      const quantity = Decimal.parse(normalizeLocalizedDecimalInput(leg.quantity));
      if (quantity.isZero()) return false;
      const current = totals.get(leg.assetId) ?? Decimal.zero();
      totals.set(leg.assetId, current.plus(quantity));
    }
  } catch {
    return false;
  }
  return [...totals.values()].every((value) => value.isZero());
}

export function toLocalDateTimeInputValue(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(
    value.getHours(),
  )}:${pad(value.getMinutes())}`;
}
