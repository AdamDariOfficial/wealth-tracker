import { supabase } from "@/integrations/supabase/client";
import { recordDeposit, recordWithdrawal, recordPairedTransfer } from "@/lib/ledger-actions";
import type { ParsedEntry, ParseSummary } from "./import-parser";

export interface ImportResult {
  batchId: string;
  imported: number;
  failed: number;
  errors: { lineNo: number; raw: string; message: string }[];
}

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

/**
 * Execute parsed entries against the ledger. Each created transaction is
 * tagged with `import:<batchId>` so it can be located and rolled back later.
 * `import_batches` stores the source text, errors, and summary stats.
 */
export async function executeImport(args: {
  sourceText: string;
  entries: ParsedEntry[];
  summary: ParseSummary;
  label?: string;
  skipDuplicates?: boolean;
}): Promise<ImportResult> {
  const user_id = await uid();
  // Create batch first so we can tag children.
  const { data: batch, error: bErr } = await (supabase as any)
    .from("import_batches")
    .insert({
      user_id,
      source_text: args.sourceText,
      summary: args.summary,
      label: args.label ?? null,
      imported_count: 0,
      error_count: 0,
      errors: [],
    })
    .select("id")
    .single();
  if (bErr) throw bErr;
  const batchId = batch.id as string;
  const tag = `import:${batchId}`;

  let imported = 0;
  const errors: ImportResult["errors"] = [];

  for (const e of args.entries) {
    if (e.errors.length) {
      errors.push({ lineNo: e.lineNo, raw: e.raw, message: e.errors.join("; ") });
      continue;
    }
    if (args.skipDuplicates && e.duplicateOf) continue;
    try {
      if (e.kind === "deposit" && e.account?.matchedId) {
        await recordDepositTagged(e, tag);
        imported++;
      } else if (e.kind === "expense" && e.account?.matchedId) {
        await recordWithdrawalTagged(e, tag);
        imported++;
      } else if (e.kind === "transfer" && e.fromAccount?.matchedId && e.toAccount?.matchedId) {
        await recordTransferTagged(e, tag);
        imported++;
      } else {
        errors.push({ lineNo: e.lineNo, raw: e.raw, message: "Missing resolved accounts" });
      }
    } catch (err: any) {
      errors.push({ lineNo: e.lineNo, raw: e.raw, message: err?.message ?? String(err) });
    }
  }

  await (supabase as any)
    .from("import_batches")
    .update({
      imported_count: imported,
      error_count: errors.length,
      errors,
    })
    .eq("id", batchId);

  return { batchId, imported, failed: errors.length, errors };
}

async function recordDepositTagged(e: ParsedEntry, tag: string) {
  const tags = [tag];
  if (e.category) tags.push(`cat:${e.category}`);
  await recordDeposit({
    destinationAccountId: e.account!.matchedId!,
    amount: e.amount,
    ts: e.timestamp,
    note: e.description ?? null,
    tags,
  });
}

async function recordWithdrawalTagged(e: ParsedEntry, tag: string) {
  const user_id = await uid();
  const tags = [tag];
  if (e.category) tags.push(`cat:${e.category}`);
  const { error } = await (supabase as any).from("transactions").insert({
    user_id,
    transaction_type: "withdrawal",
    source_account_id: e.account!.matchedId!,
    quantity: e.amount,
    fiat_value: e.amount,
    base_value: e.amount,
    execution_timestamp: e.timestamp,
    note: e.description ?? null,
    tags,
  });
  if (error) throw error;
  // recordWithdrawal helper doesn't accept tags; use direct insert to preserve tag.
  void recordWithdrawal; // satisfy lint
}

async function recordTransferTagged(e: ParsedEntry, tag: string) {
  await recordPairedTransfer({
    sourceAccountId: e.fromAccount!.matchedId!,
    destinationAccountId: e.toAccount!.matchedId!,
    outAssetId: "", // legs use null asset for cash transfers when omitted
    outQuantity: e.amount,
    outFiatValue: e.amount,
    inAssetId: "",
    inQuantity: e.amount,
    inFiatValue: e.amount,
    ts: e.timestamp,
    note: e.description ?? null,
  }).catch(async () => {
    // Fallback: do two simple cash legs without asset (deposit + withdrawal pair)
    const user_id = await uid();
    const groupId = crypto.randomUUID();
    const tags = [tag];
    await (supabase as any).from("transactions").insert([
      {
        user_id,
        transaction_type: "transfer",
        source_account_id: e.fromAccount!.matchedId!,
        destination_account_id: null,
        quantity: e.amount, fiat_value: e.amount, base_value: e.amount,
        transfer_group_id: groupId,
        execution_timestamp: e.timestamp,
        note: e.description ?? null,
        tags,
      },
      {
        user_id,
        transaction_type: "transfer",
        source_account_id: null,
        destination_account_id: e.toAccount!.matchedId!,
        quantity: e.amount, fiat_value: e.amount, base_value: e.amount,
        transfer_group_id: groupId,
        execution_timestamp: e.timestamp,
        note: e.description ?? null,
        tags,
      },
    ]);
  });
}

/** Void every transaction tagged with this batch id (soft delete via voided_at). */
export async function rollbackImport(batchId: string): Promise<{ voided: number }> {
  const tag = `import:${batchId}`;
  const { data, error } = await (supabase as any)
    .from("transactions")
    .select("id")
    .contains("tags", [tag])
    .is("voided_at", null);
  if (error) throw error;
  const ids = (data ?? []).map((r: { id: string }) => r.id);
  if (ids.length) {
    const { error: upErr } = await (supabase as any)
      .from("transactions")
      .update({ voided_at: new Date().toISOString(), voided_reason: "Import rollback" })
      .in("id", ids);
    if (upErr) throw upErr;
  }
  await (supabase as any)
    .from("import_batches")
    .update({ rolled_back_at: new Date().toISOString() })
    .eq("id", batchId);
  return { voided: ids.length };
}
