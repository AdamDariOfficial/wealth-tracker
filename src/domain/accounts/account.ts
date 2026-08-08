import { DomainError, EntityId, UtcTimestamp } from "../core";

export const ACCOUNT_KINDS = [
  "cash",
  "bank",
  "savings",
  "broker",
  "exchange",
  "crypto-wallet",
  "cold-wallet",
  "investment",
  "liability",
  "income",
  "expense",
  "external",
  "equity",
] as const;

export const ACCOUNT_OWNERSHIPS = ["owned", "external", "system"] as const;

export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export type AccountOwnership = (typeof ACCOUNT_OWNERSHIPS)[number];
export type AccountId = EntityId<"account">;

export class AccountInvariantError extends DomainError {
  readonly code = "ACCOUNT_INVARIANT_ERROR";

  constructor(message: string) {
    super(message);
  }
}

export type AccountInput = Readonly<{
  id: AccountId;
  name: string;
  kind: AccountKind;
  ownership: AccountOwnership;
  includeInNetWorth: boolean;
  openedAt?: UtcTimestamp | null;
  archivedAt?: UtcTimestamp | null;
}>;

function assertName(name: string): void {
  if (name.trim() !== name || name.length === 0 || name.length > 120) {
    throw new AccountInvariantError("Account name must contain 1-120 trimmed characters.");
  }
}

export function accountId(input: string): AccountId {
  return EntityId.parse<"account">(input);
}

export class Account {
  readonly id: AccountId;
  readonly name: string;
  readonly kind: AccountKind;
  readonly ownership: AccountOwnership;
  readonly includeInNetWorth: boolean;
  readonly openedAt: UtcTimestamp | null;
  readonly archivedAt: UtcTimestamp | null;

  private constructor(input: AccountInput) {
    this.id = input.id;
    this.name = input.name;
    this.kind = input.kind;
    this.ownership = input.ownership;
    this.includeInNetWorth = input.includeInNetWorth;
    this.openedAt = input.openedAt ?? null;
    this.archivedAt = input.archivedAt ?? null;
    Object.freeze(this);
  }

  static create(input: AccountInput): Account {
    assertName(input.name);

    if (!ACCOUNT_KINDS.includes(input.kind)) {
      throw new AccountInvariantError(`Unsupported account kind: ${String(input.kind)}.`);
    }

    if (!ACCOUNT_OWNERSHIPS.includes(input.ownership)) {
      throw new AccountInvariantError(`Unsupported account ownership: ${String(input.ownership)}.`);
    }

    if (input.ownership !== "owned" && input.includeInNetWorth) {
      throw new AccountInvariantError(
        "External and system accounts cannot be included in net worth.",
      );
    }

    if ((input.kind === "external") !== (input.ownership === "external")) {
      throw new AccountInvariantError(
        "External account kind and external ownership must be used together.",
      );
    }

    const systemKinds: readonly AccountKind[] = ["income", "expense", "equity"];
    if (systemKinds.includes(input.kind) !== (input.ownership === "system")) {
      throw new AccountInvariantError(
        "Income, expense and equity accounts require system ownership, and vice versa.",
      );
    }

    if (input.openedAt && input.archivedAt && input.archivedAt.compare(input.openedAt) < 0) {
      throw new AccountInvariantError("Account archivedAt cannot precede openedAt.");
    }

    return new Account(input);
  }

  isArchived(): boolean {
    return this.archivedAt !== null;
  }
}
