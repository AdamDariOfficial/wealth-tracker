import { CurrencyCode, DomainError } from "../../domain/core";

export class UserProfileInvariantError extends DomainError {
  readonly code = "USER_PROFILE_INVARIANT_ERROR";

  constructor(message: string) {
    super(message);
  }
}

export type UserProfile = Readonly<{
  displayName: string | null;
  baseCurrency: CurrencyCode | null;
  locale: string | null;
  onboarded: boolean;
}>;

export type UserProfileInput = Readonly<{
  displayName?: string | null;
  baseCurrency?: CurrencyCode | string | null;
  locale?: string | null;
  onboarded?: boolean;
}>;

const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function parseDisplayName(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value.trim() !== value || value.length === 0 || value.length > 120) {
    throw new UserProfileInvariantError(
      "Display name must contain 1-120 trimmed characters when provided.",
    );
  }
  return value;
}

function parseLocale(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value.trim() !== value || value.length > 35 || !LOCALE_PATTERN.test(value)) {
    throw new UserProfileInvariantError("Locale must be a trimmed BCP-47 style locale tag.");
  }
  return value;
}

export function userProfile(input: UserProfileInput): UserProfile {
  const displayName = parseDisplayName(input.displayName);
  const baseCurrency =
    input.baseCurrency == null
      ? null
      : typeof input.baseCurrency === "string"
        ? CurrencyCode.parse(input.baseCurrency)
        : input.baseCurrency;
  const locale = parseLocale(input.locale);
  const onboarded = input.onboarded ?? false;

  if (onboarded && (baseCurrency === null || locale === null)) {
    throw new UserProfileInvariantError(
      "Onboarded profiles require both a base currency and a locale.",
    );
  }

  return Object.freeze({ displayName, baseCurrency, locale, onboarded });
}
