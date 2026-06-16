/**
 * Import Health Score — single deterministic score 0..100 derived from the
 * parsed batch. Pure function, no side effects, no DB.
 *
 * Deductions are applied to a perfect 100 baseline. The breakdown explains
 * exactly which categories cost points so the UI can show "why".
 */

import type { ParsedEntry, ImportIssue } from "./import-parser";

export type HealthTier = "excellent" | "good" | "review" | "high_risk";

export interface HealthBreakdownItem {
  key: string;
  label: string;
  count: number;
  penalty: number;
}

export interface HealthReport {
  score: number;        // 0..100
  tier: HealthTier;
  breakdown: HealthBreakdownItem[];
  duplicateCount: number;
}

export function computeImportHealth(
  entries: ParsedEntry[],
  issues: ImportIssue[],
): HealthReport {
  const total = Math.max(entries.length, 1);

  // counts
  const unresolvedAccounts = issues.filter((i) => i.kind === "unknown_account").length;
  const unresolvedAssets = issues.filter((i) => i.kind === "unknown_asset").length;
  const unresolvedGoals = issues.filter((i) => i.kind === "unknown_goal").length;

  let duplicateCount = 0;
  let missingPrice = 0;
  let invalidRows = 0;
  let lowConfidence = 0;
  let warningRows = 0;

  for (const e of entries) {
    if (e.duplicateOf) duplicateCount++;
    if (e.severity === "error") invalidRows++;
    else if (e.severity === "warning") warningRows++;
    if ((e.kind === "buy" || e.kind === "sell" || e.kind === "asset_open") && !e.price) {
      missingPrice++;
    }
    if (e.confidenceTier === "low" && e.severity !== "error") lowConfidence++;
  }

  // penalties — scaled so a single bad row barely dents, but many do.
  const items: HealthBreakdownItem[] = [];
  const push = (key: string, label: string, count: number, perRow: number, cap: number) => {
    if (!count) return;
    const penalty = Math.min(cap, Math.round((count / total) * perRow * 100));
    items.push({ key, label, count, penalty });
  };

  push("invalid_rows", "Malformed / blocked rows", invalidRows, 0.8, 50);
  push("unresolved_accounts", "Unresolved accounts", unresolvedAccounts, 0.5, 25);
  push("unresolved_assets", "Unresolved assets", unresolvedAssets, 0.5, 25);
  push("unresolved_goals", "Unresolved goals", unresolvedGoals, 0.4, 15);
  push("duplicates", "Possible duplicates", duplicateCount, 0.3, 20);
  push("missing_price", "Missing price on buy/sell", missingPrice, 0.2, 10);
  push("low_confidence", "Low-confidence matches", lowConfidence, 0.15, 10);
  push("warnings", "Other warnings", warningRows, 0.05, 5);

  const totalPenalty = items.reduce((s, x) => s + x.penalty, 0);
  const score = Math.max(0, 100 - totalPenalty);
  const tier: HealthTier =
    score >= 95 ? "excellent" :
    score >= 80 ? "good" :
    score >= 60 ? "review" :
    "high_risk";

  return { score, tier, breakdown: items, duplicateCount };
}

export function healthTierLabel(t: HealthTier): string {
  switch (t) {
    case "excellent": return "Excellent";
    case "good": return "Good";
    case "review": return "Needs review";
    case "high_risk": return "High risk";
  }
}
