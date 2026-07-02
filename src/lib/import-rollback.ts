/**
 * Advanced rollback engine for Import batches.
 *
 * Rollback rules (see Phase C engineering rules):
 *   - Financial history is NEVER hard deleted. Transactions are soft-voided
 *     via `voided_at` (the existing ledger convention). All aggregates
 *     recompute from voided_at automatically.
 *   - Paired transfers are voided together via `transfer_group_id`.
 *   - Goal contributions are reversed by subtracting the contributed amount
 *     from `goals.current_amount` (clamped ≥ 0).
 *   - Assets, accounts, and goals created by the batch are archived
 *     (`archived_at`) only when no non-import data depends on them.
 *     Otherwise the caller is warned and the entity is left intact.
 *   - Batch metadata (source text, row records, summary, errors) is
 *     preserved to keep the audit trail intact.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ImportRowRecord } from "./import-engine";
import type { ParsedEntry } from "./import-parser";

export type RollbackScope =
  | { mode: "all" }
  | { mode: "rows"; lineNos: number[] }
  | { mode: "kinds"; kinds: ParsedEntry["kind"][] }
  | { mode: "transactions" }         // only tx rows, keep created entities
  | { mode: "entities" };            // only archive created entities

export interface RollbackImpact {
  txIdsToVoid: string[];
  transferGroupsAffected: string[];
  goalReversals: { goalId: string; amount: number }[];
  createdAssetIds: string[];
  createdGoalIds: string[];
  createdAccountIds: string[];
  archivableAssetIds: string[];
  archivableGoalIds: string[];
  archivableAccountIds: string[];
  blockedEntities: {
    kind: "asset" | "goal" | "account";
    id: string;
    reason: string;
  }[];
  // financial deltas (best-effort, positive = reduces net worth)
  netWorthDelta: number;
  accountDeltas: { id: string; delta: number }[];
  assetDeltas: { id: string; qtyDelta: number }[];
}

interface BatchLike {
  id: string;
  summary: any;
}

/** Fetch batch + normalize row_records array. */
export async function loadBatch(batchId: string): Promise<BatchLike & { rows: ImportRowRecord[] }> {
  const { data, error } = await (supabase as any)
    .from("import_batches").select("*").eq("id", batchId).single();
  if (error) throw error;
  const rows: ImportRowRecord[] = data?.summary?.row_records ?? [];
  return { ...data, rows };
}

/** Filter rows in-scope for the requested rollback mode. */
function selectRows(rows: ImportRowRecord[], scope: RollbackScope): ImportRowRecord[] {
  if (scope.mode === "all" || scope.mode === "transactions") return rows;
  if (scope.mode === "entities") return [];
  if (scope.mode === "rows") {
    const set = new Set(scope.lineNos);
    return rows.filter((r) => set.has(r.lineNo));
  }
  const set = new Set(scope.kinds);
  return rows.filter((r) => set.has(r.kind));
}

/**
 * Compute a dry-run impact of the rollback. No writes.
 * Uses batch metadata + a lightweight dependency check on ledger transactions
 * outside the batch to decide whether created entities can be archived.
 */
export async function computeRollbackImpact(
  batchId: string, scope: RollbackScope,
): Promise<RollbackImpact> {
  const batch = await loadBatch(batchId);
  const tag = `import:${batchId}`;
  const selected = selectRows(batch.rows, scope);

  // 1. Transactions to void
  const txIds: string[] = [];
  const transferGroups = new Set<string>();
  const goalReversals: { goalId: string; amount: number }[] = [];
  const accountDeltaMap = new Map<string, number>();
  const assetDeltaMap = new Map<string, number>();

  if (scope.mode !== "entities") {
    for (const r of selected) {
      if (r.skipped || r.error) continue;
      for (const id of r.txIds) txIds.push(id);
      if (r.transferGroupId) transferGroups.add(r.transferGroupId);
      if (r.goalContribution && r.goalId) {
        goalReversals.push({ goalId: r.goalId, amount: r.goalContribution });
      }
      // Best-effort financial delta preview (mirrors what voiding will do).
      const signCash =
        r.kind === "deposit" ? -1 :
        r.kind === "expense" ? +1 :
        r.kind === "buy" ? +1 :
        r.kind === "sell" ? -1 : 0;
      if (signCash && r.accountId) {
        accountDeltaMap.set(r.accountId, (accountDeltaMap.get(r.accountId) ?? 0) + signCash * r.amount);
      }
      if (r.kind === "transfer" && r.transferGroupId) {
        // Cash movement between two accounts nets to zero on net worth.
      }
      if ((r.kind === "buy" || r.kind === "asset_open") && r.assetId) {
        const qty = r.amount; // We don't track qty separately in the record; treat amount as cash.
        void qty;
        assetDeltaMap.set(r.assetId, (assetDeltaMap.get(r.assetId) ?? 0) - 1);
      }
      if (r.kind === "sell" && r.assetId) {
        assetDeltaMap.set(r.assetId, (assetDeltaMap.get(r.assetId) ?? 0) + 1);
      }
    }
  }

  // 2. Created-entity candidates and dependency checks.
  const summary = batch.summary ?? {};
  const createdAccountIds: string[] = summary.created_account_ids ?? [];
  const createdAssetIds: string[]   = summary.created_asset_ids ?? [];
  const createdGoalIds: string[]    = summary.created_goal_ids ?? [];

  const includeEntities = scope.mode === "all" || scope.mode === "entities";
  const archivableAssetIds: string[] = [];
  const archivableGoalIds: string[] = [];
  const archivableAccountIds: string[] = [];
  const blocked: RollbackImpact["blockedEntities"] = [];

  if (includeEntities) {
    // Assets: safe to archive if no non-import (untagged or other-batch) tx references it.
    for (const id of createdAssetIds) {
      const { count, error } = await (supabase as any)
        .from("transactions").select("id", { count: "exact", head: true })
        .eq("asset_id", id).not("tags", "cs", `{${tag}}`).is("voided_at", null);
      if (error) { blocked.push({ kind: "asset", id, reason: error.message }); continue; }
      if ((count ?? 0) > 0) blocked.push({ kind: "asset", id, reason: `${count} external transaction(s) reference this asset` });
      else archivableAssetIds.push(id);
    }
    // Accounts: any active tx (source or dest) outside this batch blocks archive.
    for (const id of createdAccountIds) {
      const { count } = await (supabase as any)
        .from("transactions").select("id", { count: "exact", head: true })
        .or(`source_account_id.eq.${id},destination_account_id.eq.${id}`)
        .not("tags", "cs", `{${tag}}`)
        .is("voided_at", null);
      if ((count ?? 0) > 0) blocked.push({ kind: "account", id, reason: `${count} external transaction(s)` });
      else archivableAccountIds.push(id);
    }
    // Goals: check for other batches' contributions or non-zero remaining current_amount not from this batch.
    for (const id of createdGoalIds) {
      // If the goal has current_amount > total contributions from this batch, external contributions exist.
      const { data: g } = await (supabase as any).from("goals").select("current_amount").eq("id", id).single();
      const contributed = batch.rows.filter((r) => r.goalId === id).reduce((s, r) => s + (r.goalContribution ?? 0), 0);
      if (Number(g?.current_amount ?? 0) > contributed + 0.001) {
        blocked.push({ kind: "goal", id, reason: "Goal has external contributions" });
      } else {
        archivableGoalIds.push(id);
      }
    }
  }

  // 3. Compose deltas.
  const accountDeltas = [...accountDeltaMap].map(([id, delta]) => ({ id, delta }));
  const assetDeltas = [...assetDeltaMap].map(([id, qtyDelta]) => ({ id, qtyDelta }));
  const netWorthDelta = accountDeltas.reduce((s, a) => s + a.delta, 0);

  return {
    txIdsToVoid: Array.from(new Set(txIds)),
    transferGroupsAffected: Array.from(transferGroups),
    goalReversals,
    createdAssetIds,
    createdGoalIds,
    createdAccountIds,
    archivableAssetIds,
    archivableGoalIds,
    archivableAccountIds,
    blockedEntities: blocked,
    netWorthDelta,
    accountDeltas,
    assetDeltas,
  };
}

export interface RollbackResult {
  voidedTx: number;
  archivedAssets: number;
  archivedGoals: number;
  archivedAccounts: number;
  reversedGoalContributions: number;
  blocked: RollbackImpact["blockedEntities"];
}

/** Execute the rollback. Mirrors computeRollbackImpact's decisions. */
export async function executeRollback(
  batchId: string, scope: RollbackScope, opts: { reason?: string } = {},
): Promise<RollbackResult> {
  const impact = await computeRollbackImpact(batchId, scope);
  const reason = opts.reason ?? "Import rollback";

  // 1. Void transactions (paired transfer legs auto-included because both legs are in txIds).
  if (impact.txIdsToVoid.length) {
    const { error } = await (supabase as any)
      .from("transactions")
      .update({ voided_at: new Date().toISOString(), voided_reason: reason })
      .in("id", impact.txIdsToVoid)
      .is("voided_at", null);
    if (error) throw error;
  }

  // 2. Reverse goal contributions (clamped ≥ 0).
  let reversed = 0;
  const perGoal = new Map<string, number>();
  for (const r of impact.goalReversals) perGoal.set(r.goalId, (perGoal.get(r.goalId) ?? 0) + r.amount);
  for (const [goalId, amount] of perGoal) {
    const { data: g } = await (supabase as any).from("goals").select("current_amount").eq("id", goalId).single();
    const next = Math.max(0, Number(g?.current_amount ?? 0) - amount);
    const { error } = await (supabase as any).from("goals").update({ current_amount: next }).eq("id", goalId);
    if (!error) reversed++;
  }

  // 3. Archive created entities (safe ones only).
  const nowIso = new Date().toISOString();
  const archive = async (table: string, ids: string[]) => {
    if (!ids.length) return 0;
    const { error } = await (supabase as any).from(table).update({ archived_at: nowIso }).in("id", ids);
    if (error) throw error;
    return ids.length;
  };
  const archivedAssets   = await archive("assets",   impact.archivableAssetIds);
  const archivedGoals    = await archive("goals",    impact.archivableGoalIds);
  const archivedAccounts = await archive("accounts", impact.archivableAccountIds);

  // 4. Update batch state.
  const fullRollback = scope.mode === "all";
  const patch: any = {};
  if (fullRollback) patch.rolled_back_at = nowIso;
  // Append rollback event to summary for audit trail.
  const { data: cur } = await (supabase as any).from("import_batches").select("summary").eq("id", batchId).single();
  const events = Array.isArray(cur?.summary?.rollback_events) ? cur.summary.rollback_events : [];
  events.push({
    at: nowIso, scope, reason,
    voidedTx: impact.txIdsToVoid.length,
    archivedAssets, archivedGoals, archivedAccounts,
    reversedGoalContributions: reversed,
    blocked: impact.blockedEntities,
  });
  patch.summary = { ...(cur?.summary ?? {}), rollback_events: events };
  await (supabase as any).from("import_batches").update(patch).eq("id", batchId);

  // 5. Best-effort audit log entry (uses existing audit_log table).
  try {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await (supabase as any).from("audit_log").insert({
        user_id: u.user.id,
        event_type: "import_rollback",
        entity_type: "import_batch",
        entity_id: batchId,
        message: `Rolled back ${impact.txIdsToVoid.length} tx · scope ${scope.mode}`,
        source: "import",
        diff: { scope, voidedTx: impact.txIdsToVoid.length, archivedAssets, archivedGoals, archivedAccounts },
      });
    }
  } catch { /* audit is best-effort */ }

  return {
    voidedTx: impact.txIdsToVoid.length,
    archivedAssets, archivedGoals, archivedAccounts,
    reversedGoalContributions: reversed,
    blocked: impact.blockedEntities,
  };
}
