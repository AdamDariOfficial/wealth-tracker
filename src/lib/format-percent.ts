/**
 * Centralized percentage formatter — single source of truth for every
 * "delta", "growth %" or "allocation %" rendered in the UI.
 *
 *   formatPct(-0.27919467)        // "-0.28%"
 *   formatPct(3.4123, { sign: true })  // "+3.41%"
 *   formatPct(0.0001, { compact: true }) // "~0%"
 *
 * Never render raw float precision again.
 */

export type PctOpts = {
  /** Max decimal places (default 2). */
  digits?: number;
  /** Force "+"/"-" prefix (default false; "-" always shown for negatives). */
  sign?: boolean;
  /** Collapse near-zero values to "~0%". */
  compact?: boolean;
  /** Locale (default "en-US"). */
  locale?: string;
};

export function formatPct(
  value: number | null | undefined,
  opts: PctOpts = {},
): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const digits = Math.max(0, Math.min(4, opts.digits ?? 2));
  const locale = opts.locale ?? "en-US";

  if (opts.compact && Math.abs(n) > 0 && Math.abs(n) < 0.01) {
    return n > 0 ? "~0%" : "~0%";
  }

  const rounded = Number(n.toFixed(digits));
  const abs = Math.abs(rounded).toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const prefix = rounded > 0 ? (opts.sign ? "+" : "") : rounded < 0 ? "-" : "";
  return `${prefix}${abs}%`;
}

/** Convenience for signed deltas (always shows + on positives). */
export function formatDeltaPct(value: number | null | undefined, digits = 2): string {
  return formatPct(value, { digits, sign: true });
}
