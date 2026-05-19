/**
 * Locale-aware currency formatter. Single source of truth for every
 * money display in the app — never hardcode `$` or `€` in components.
 *
 *   import { formatMoney } from "@/lib/format-currency";
 *   formatMoney(1234.5, { currency: "EUR" }) // "€1,234.50"
 *
 * For the user's active base currency, prefer the hook:
 *
 *   const fmt = useMoneyFormatter();
 *   fmt(1234.5)
 *
 * which pulls `profiles.currency` / `profiles.locale`.
 */
import { useAuth } from "./auth-store";
import { useCallback } from "react";

export type MoneyFmtOpts = {
  currency?: string;
  locale?: string;
  /** Hide cents for clean dashboard tiles. */
  compactCents?: boolean;
  /** Use compact notation (1.2K, 3.4M). */
  compact?: boolean;
};

const SAFE_CURRENCIES = new Set([
  "USD", "EUR", "GBP", "CHF", "JPY", "AUD", "CAD", "JOD",
  "AED", "SAR", "SEK", "NOK", "DKK", "CNY", "INR", "MXN", "BRL",
]);

export function formatMoney(value: number | null | undefined, opts: MoneyFmtOpts = {}): string {
  const n = Number(value ?? 0);
  const currency = (opts.currency ?? "USD").toUpperCase();
  const locale = opts.locale ?? "en-US";
  const fractionDigits = opts.compactCents || opts.compact ? 0 : 2;

  // Some currencies (e.g. JOD) Intl supports but may not have a symbol the
  // user expects. The `currency` style picks the right symbol/code automatically.
  if (!SAFE_CURRENCIES.has(currency)) {
    return `${currency} ${n.toLocaleString(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })}`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: opts.compact ? "compact" : "standard",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(fractionDigits)}`;
  }
}

/** React hook bound to the authenticated user's base currency + locale. */
export function useMoneyFormatter() {
  const { profile } = useAuth();
  const currency = profile?.currency ?? "USD";
  const locale = (profile as any)?.locale ?? "en-US";
  return useCallback(
    (value: number | null | undefined, opts: MoneyFmtOpts = {}) =>
      formatMoney(value, { currency, locale, ...opts }),
    [currency, locale],
  );
}

/** Just the symbol, e.g. for compact axis labels. */
export function currencySymbol(currency = "USD", locale = "en-US"): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency", currency,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}
