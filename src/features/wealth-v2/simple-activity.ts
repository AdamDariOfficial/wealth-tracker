import { Decimal } from "@/domain/core";
import { normalizeLocalizedDecimalInput, type DraftLeg } from "./form-utils";

export type SimpleActivityKind = "expense" | "income" | "transfer";

export type SimpleActivityInput = Readonly<{
  kind: SimpleActivityKind;
  accountId: string;
  destinationAccountId?: string;
  assetId: string;
  amount: string;
  incomeAccountId?: string;
  expenseAccountId?: string;
}>;

function required(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function canonicalPositiveAmount(value: string): Decimal {
  const normalized = normalizeLocalizedDecimalInput(value);
  const amount = Decimal.parse(normalized);
  if (amount.isZero() || amount.isNegative()) {
    throw new Error("Amount must be greater than zero.");
  }
  return amount;
}

function leg(rowId: string, accountId: string, assetId: string, quantity: string): DraftLeg {
  return { rowId, accountId, assetId, quantity, memo: "" };
}

/**
 * Converts a human activity into the balanced ledger legs required by the
 * canonical domain. System accounting accounts stay behind this boundary and
 * are never selected or edited by the user.
 */
export function buildSimpleActivityDraft(input: SimpleActivityInput): readonly DraftLeg[] {
  const accountId = required(input.accountId, "Account");
  const assetId = required(input.assetId, "Asset");
  const amount = canonicalPositiveAmount(input.amount);
  const positive = amount.toString();
  const negative = amount.negate().toString();

  if (input.kind === "expense") {
    const expenseAccountId = input.expenseAccountId;
    if (!expenseAccountId) throw new Error("Activity setup is incomplete.");
    return Object.freeze([
      leg("activity:source", accountId, assetId, negative),
      leg("activity:counterpart", expenseAccountId, assetId, positive),
    ]);
  }

  if (input.kind === "income") {
    const incomeAccountId = input.incomeAccountId;
    if (!incomeAccountId) throw new Error("Activity setup is incomplete.");
    return Object.freeze([
      leg("activity:counterpart", incomeAccountId, assetId, negative),
      leg("activity:destination", accountId, assetId, positive),
    ]);
  }

  const destinationAccountId = required(input.destinationAccountId, "Destination account");
  if (destinationAccountId === accountId) {
    throw new Error("Source and destination accounts must be different.");
  }
  return Object.freeze([
    leg("activity:source", accountId, assetId, negative),
    leg("activity:destination", destinationAccountId, assetId, positive),
  ]);
}
