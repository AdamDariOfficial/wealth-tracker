import { supabase } from "@/integrations/supabase/client";

type ID = string;

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

async function insertTx(payload: Record<string, any>) {
  const user_id = await uid();
  const { data, error } = await (supabase as any)
    .from("transactions")
    .insert({ ...payload, user_id })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function recordDeposit(p: {
  destinationAccountId: ID; assetId?: ID | null; amount: number;
  ts?: string; note?: string; tags?: string[];
}) {
  return insertTx({
    transaction_type: "deposit",
    destination_account_id: p.destinationAccountId,
    asset_id: p.assetId ?? null,
    quantity: p.amount,
    fiat_value: p.amount,
    execution_timestamp: p.ts ?? new Date().toISOString(),
    note: p.note ?? null,
    tags: p.tags ?? [],
  });
}

export async function recordWithdrawal(p: {
  sourceAccountId: ID; assetId?: ID | null; amount: number;
  ts?: string; note?: string;
}) {
  return insertTx({
    transaction_type: "withdrawal",
    source_account_id: p.sourceAccountId,
    asset_id: p.assetId ?? null,
    quantity: p.amount,
    fiat_value: p.amount,
    execution_timestamp: p.ts ?? new Date().toISOString(),
    note: p.note ?? null,
  });
}

export async function recordTransfer(p: {
  sourceAccountId: ID; destinationAccountId: ID;
  assetId: ID; quantity: number; fiatValue?: number;
  ts?: string; note?: string;
}) {
  return insertTx({
    transaction_type: "transfer",
    source_account_id: p.sourceAccountId,
    destination_account_id: p.destinationAccountId,
    asset_id: p.assetId,
    quantity: p.quantity,
    fiat_value: p.fiatValue ?? 0,
    execution_timestamp: p.ts ?? new Date().toISOString(),
    note: p.note ?? null,
  });
}

export async function recordBuy(p: {
  cashAccountId: ID; brokerAccountId: ID; assetId: ID;
  quantity: number; price: number; fee?: number;
  ts?: string; note?: string;
}) {
  const fiat = p.quantity * p.price;
  return insertTx({
    transaction_type: "buy",
    source_account_id: p.cashAccountId,
    destination_account_id: p.brokerAccountId,
    asset_id: p.assetId,
    quantity: p.quantity,
    fiat_value: fiat,
    fee_amount: p.fee ?? 0,
    exchange_rate: p.price,
    execution_timestamp: p.ts ?? new Date().toISOString(),
    note: p.note ?? null,
  });
}

export async function recordSell(p: {
  brokerAccountId: ID; cashAccountId: ID; assetId: ID;
  quantity: number; price: number; fee?: number;
  ts?: string; note?: string;
}) {
  const fiat = p.quantity * p.price;
  return insertTx({
    transaction_type: "sell",
    source_account_id: p.brokerAccountId,
    destination_account_id: p.cashAccountId,
    asset_id: p.assetId,
    quantity: p.quantity,
    fiat_value: fiat,
    fee_amount: p.fee ?? 0,
    exchange_rate: p.price,
    execution_timestamp: p.ts ?? new Date().toISOString(),
    note: p.note ?? null,
  });
}

export async function recordWeeklyPnl(p: {
  brokerAccountId: ID; pnl: number; ts?: string; note?: string;
}) {
  if (!p.pnl) return null;
  return insertTx({
    transaction_type: "profit_realization",
    destination_account_id: p.brokerAccountId,
    quantity: 0,
    fiat_value: p.pnl,
    execution_timestamp: p.ts ?? new Date().toISOString(),
    note: p.note ?? "Weekly P&L",
    tags: ["weekly"],
  });
}

/**
 * Soft-void a transaction (financial history is never hard-deleted).
 * Sets `voided_at` so the trigger re-runs `recompute_account_balance` —
 * which now ignores voided rows — and balances are restored automatically.
 */
export async function reverseTransaction(txId: ID, reason?: string) {
  const user_id = await uid();
  const { data: tx } = await (supabase as any)
    .from("transactions").select("*").eq("id", txId).maybeSingle();
  if (!tx) throw new Error("Transaction not found");
  if (tx.voided_at) return; // already voided — no-op
  const affected: string[] = [tx.source_account_id, tx.destination_account_id].filter(Boolean);
  const before = new Map<string, number>();
  if (affected.length) {
    const { data: accts } = await (supabase as any)
      .from("accounts").select("id,current_balance").in("id", affected);
    for (const a of accts ?? []) before.set(a.id, Number(a.current_balance));
  }

  const { error } = await (supabase as any).from("transactions")
    .update({ voided_at: new Date().toISOString(), voided_reason: reason ?? null })
    .eq("id", txId);
  if (error) {
    await (supabase as any).from("audit_log").insert({
      user_id, event_type: "failed_reconciliation", transaction_id: txId,
      source: "client", message: error.message,
    });
    throw error;
  }

  if (affected.length) {
    const { data: after } = await (supabase as any)
      .from("accounts").select("id,current_balance").in("id", affected);
    const rows = (after ?? []).map((a: { id: string; current_balance: number }) => ({
      user_id, event_type: "reverse_transaction",
      account_id: a.id, transaction_id: txId,
      before_balance: before.get(a.id) ?? null,
      after_balance: Number(a.current_balance),
      delta: Number(a.current_balance) - (before.get(a.id) ?? 0),
      source: "client",
      message: `Voided ${tx.transaction_type}${reason ? ` — ${reason}` : ""}`,
      metadata: { voided_tx: tx, reason: reason ?? null },
    }));
    if (rows.length) await (supabase as any).from("audit_log").insert(rows);
  }
}

/** Restore a previously-voided transaction. Trigger re-runs reconciliation. */
export async function restoreTransaction(txId: ID) {
  const { error } = await (supabase as any).from("transactions")
    .update({ voided_at: null, voided_reason: null }).eq("id", txId);
  if (error) throw error;
}


export async function recordManualAdjustment(p: {
  accountId: ID; newBalance: number; note?: string;
}) {
  const user_id = await uid();
  const { data: acct } = await (supabase as any)
    .from("accounts").select("current_balance").eq("id", p.accountId).single();
  const before = Number(acct?.current_balance ?? 0);
  const delta = p.newBalance - before;
  const txId = await insertTx({
    transaction_type: "manual_adjustment",
    destination_account_id: p.accountId,
    quantity: 0,
    fiat_value: delta,
    note: p.note ?? "Manual balance adjustment",
    tags: ["manual"],
  });
  await (supabase as any).from("audit_log").insert({
    user_id, event_type: "manual_adjustment", account_id: p.accountId, transaction_id: txId,
    before_balance: before, after_balance: p.newBalance, delta,
    source: "client", message: p.note ?? "Manual balance adjustment",
  });
  return txId;
}

/** Find or create an asset (e.g. when user enters a new ticker). */
export async function ensureAsset(p: {
  symbol: string; name?: string; assetClass: string; price?: number;
}) {
  const user_id = await uid();
  const sym = p.symbol.trim().toUpperCase();
  const existing = await (supabase as any)
    .from("assets").select("id").eq("user_id", user_id).eq("symbol", sym).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;
  const { data, error } = await (supabase as any).from("assets").insert({
    user_id, symbol: sym, name: p.name ?? sym,
    asset_class: p.assetClass, current_price: p.price ?? 0, custom_asset: true,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateAssetPrice(assetId: ID, price: number) {
  const { error } = await (supabase as any)
    .from("assets").update({ current_price: price }).eq("id", assetId);
  if (error) throw error;
}
