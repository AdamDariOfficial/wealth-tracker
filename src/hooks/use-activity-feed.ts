import { useMemo } from "react";
import { useTransactions, useAccounts, useAssets, type Transaction, type Account, type Asset } from "@/hooks/use-ledger";
import { useUserTable } from "@/hooks/use-user-table";

export type ActivityKind =
  | "transaction" | "transfer" | "reconciliation" | "audit"
  | "weekly_report" | "goal" | "account" | "import";

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  at: string;
  title: string;
  subtitle?: string;
  amount?: number | null;
  currency?: string | null;
  tone?: "positive" | "negative" | "neutral" | "warning";
  /** Stable references used by the drawer & linked-event navigation. */
  refs: {
    txId?: string;
    transferGroupId?: string | null;
    sourceAccountId?: string | null;
    destinationAccountId?: string | null;
    assetId?: string | null;
    accountId?: string | null;
    reportId?: string;
    goalId?: string;
    auditId?: string;
  };
  tags?: string[];
  /** Free-form payload — diffs, fx info, balance deltas, etc. */
  meta?: Record<string, unknown>;
};

export type ActivityFilters = {
  kinds?: ActivityKind[];
  accountId?: string | null;
  assetId?: string | null;
  transferGroupId?: string | null;
  tag?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  q?: string | null;
  limit?: number;
};

type WeeklyReport = {
  id: string; week_start: string; pnl: number; num_trades: number;
  winrate: number; avg_rr: number; finalized_at: string | null; created_at: string;
  broker_account_id: string | null; posted_transaction_id: string | null;
};
type Goal = {
  id: string; name: string; target_amount: number; current_amount: number;
  archived_at: string | null; updated_at: string; created_at: string;
  target_account_id: string | null; target_asset_id: string | null;
};
type AuditRow = {
  id: string; event_type: string; entity_type: string | null;
  entity_id: string | null; account_id: string | null;
  transaction_id: string | null;
  before_balance: number | null; after_balance: number | null; delta: number | null;
  message: string | null; diff: Record<string, unknown> | null;
  source: string | null; created_at: string;
};
type ImportBatchRow = {
  id: string; label: string | null;
  imported_count: number; error_count: number;
  summary: any; created_at: string;
  rolled_back_at: string | null;
};

function txEvent(t: Transaction, accounts: Account[], assets: Asset[]): ActivityEvent {
  const isTransfer = t.transaction_type === "transfer" || !!t.transfer_group_id;
  const positive = ["deposit", "sell", "dividend", "interest", "staking_reward", "profit_realization"].includes(t.transaction_type);
  const negative = ["withdrawal", "fee", "buy"].includes(t.transaction_type);
  const acct = (id: string | null) => id ? accounts.find((a) => a.id === id)?.name ?? "—" : "—";
  const asset = t.asset_id ? assets.find((a) => a.id === t.asset_id) : null;
  const path = [acct(t.source_account_id), acct(t.destination_account_id)].filter((s) => s !== "—").join(" → ");
  return {
    id: `tx:${t.id}`,
    kind: isTransfer ? "transfer" : "transaction",
    at: t.execution_timestamp,
    title: `${t.transaction_type.replace(/_/g, " ")}${asset ? ` · ${asset.symbol}` : ""}`,
    subtitle: path || (t.note ?? ""),
    amount: Number(t.fiat_value) || 0,
    currency: t.base_currency ?? null,
    tone: positive ? "positive" : negative ? "negative" : "neutral",
    refs: {
      txId: t.id,
      transferGroupId: t.transfer_group_id ?? null,
      sourceAccountId: t.source_account_id,
      destinationAccountId: t.destination_account_id,
      assetId: t.asset_id,
    },
    tags: t.tags ?? [],
    meta: {
      type: t.transaction_type,
      quantity: t.quantity,
      asset_price: t.asset_price,
      asset_currency: t.asset_currency,
      fiat_value: t.fiat_value,
      base_value: t.base_value,
      base_currency: t.base_currency,
      exchange_rate: t.exchange_rate,
      fee_amount: t.fee_amount,
      fee_base_value: t.fee_base_value,
      note: t.note,
      voided_at: t.voided_at ?? null,
      voided_reason: t.voided_reason ?? null,
    },
  };
}

/**
 * Unified, derived activity stream. Pulls from the canonical ledger
 * (transactions), weekly_reports, audit_log, and goals — no separate
 * persistence. Memoized & strictly chronological (desc).
 */
export function useActivityFeed(opts: ActivityFilters = {}) {
  const { rows: txs } = useTransactions();
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const { rows: reports } = useUserTable<WeeklyReport>("weekly_reports", { col: "week_start", asc: false });
  const { rows: goals } = useUserTable<Goal>("goals", { col: "updated_at", asc: false });
  const { rows: audits } = useUserTable<AuditRow>("audit_log", { col: "created_at", asc: false });
  const { rows: batches } = useUserTable<ImportBatchRow>("import_batches", { col: "created_at", asc: false });

  return useMemo(() => {
    const events: ActivityEvent[] = [];

    for (const t of txs) events.push(txEvent(t, accounts, assets));

    for (const b of batches) {
      const s = b.summary ?? {};
      const at = s.imported_at ?? b.created_at;
      const created = (s.created_accounts ?? 0) + (s.created_assets ?? 0) + (s.created_goals ?? 0);
      events.push({
        id: `import:${b.id}`,
        kind: "import",
        at,
        title: b.rolled_back_at
          ? `Import rolled back${b.label ? ` — ${b.label}` : ""}`
          : `Imported ${b.imported_count} row${b.imported_count === 1 ? "" : "s"}${b.label ? ` — ${b.label}` : ""}`,
        subtitle: [
          b.error_count ? `${b.error_count} error${b.error_count === 1 ? "" : "s"}` : null,
          s.duplicates_skipped ? `${s.duplicates_skipped} dup skipped` : null,
          created ? `${created} entit${created === 1 ? "y" : "ies"} created` : null,
          s.net != null ? `net ${Number(s.net).toFixed(2)}` : null,
        ].filter(Boolean).join(" · "),
        amount: s.net != null ? Number(s.net) : null,
        tone: b.rolled_back_at ? "warning" : (b.error_count ? "warning" : "neutral"),
        refs: {},
        tags: [`import:${b.id}`],
        meta: { batchId: b.id, health: s.healthScore ?? s.health?.score, summary: s },
      });
      for (const ev of (s.rollback_events ?? [])) {
        events.push({
          id: `import-rb:${b.id}:${ev.at}`,
          kind: "import",
          at: ev.at,
          title: `Rollback · ${ev.scope?.mode ?? "batch"}`,
          subtitle: `${ev.voidedTx ?? 0} voided · ${(ev.archivedAssets ?? 0) + (ev.archivedGoals ?? 0) + (ev.archivedAccounts ?? 0)} archived`,
          tone: "warning",
          refs: {},
          tags: [`import:${b.id}`, "rollback"],
          meta: { batchId: b.id, event: ev },
        });
      }
    }


    for (const r of reports) {
      events.push({
        id: `wr:${r.id}`,
        kind: "weekly_report",
        at: r.finalized_at ?? r.created_at,
        title: `Weekly report — ${r.week_start}${r.finalized_at ? " (finalized)" : " (draft)"}`,
        subtitle: `${r.num_trades} trades · winrate ${Math.round((r.winrate || 0) * 100)}% · RR ${Number(r.avg_rr || 0).toFixed(2)}`,
        amount: Number(r.pnl) || 0,
        tone: (r.pnl ?? 0) >= 0 ? "positive" : "negative",
        refs: { reportId: r.id, accountId: r.broker_account_id, txId: r.posted_transaction_id ?? undefined },
        meta: { finalized: !!r.finalized_at, week_start: r.week_start, num_trades: r.num_trades, winrate: r.winrate, avg_rr: r.avg_rr },
      });
    }

    for (const g of goals) {
      const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) : 0;
      const milestone = pct >= 1 ? "completed" : pct >= 0.5 ? "half-way" : null;
      if (!milestone) continue;
      events.push({
        id: `goal:${g.id}`,
        kind: "goal",
        at: g.updated_at,
        title: `Goal ${milestone}: ${g.name}`,
        subtitle: `${Math.round(pct * 100)}% of ${Number(g.target_amount).toLocaleString()}`,
        tone: pct >= 1 ? "positive" : "neutral",
        refs: { goalId: g.id, accountId: g.target_account_id, assetId: g.target_asset_id },
        meta: { pct, current_amount: g.current_amount, target_amount: g.target_amount },
      });
    }

    for (const a of audits) {
      const isRecon = a.event_type === "reconciliation";
      const isFail = a.event_type.includes("failed");
      events.push({
        id: `audit:${a.id}`,
        kind: isRecon ? "reconciliation" : "audit",
        at: a.created_at,
        title: a.event_type.replace(/_/g, " "),
        subtitle: a.message ?? (a.entity_type ? `${a.entity_type} updated` : ""),
        amount: a.delta != null ? Number(a.delta) : null,
        tone: isFail ? "warning" : "neutral",
        refs: {
          auditId: a.id,
          accountId: a.account_id,
          txId: a.transaction_id ?? undefined,
        },
        meta: {
          entity_type: a.entity_type,
          entity_id: a.entity_id,
          before_balance: a.before_balance,
          after_balance: a.after_balance,
          delta: a.delta,
          source: a.source,
          diff: a.diff,
        },
      });
    }

    let out = events;

    // Filters
    if (opts.kinds?.length) {
      const set = new Set(opts.kinds);
      out = out.filter((e) => set.has(e.kind));
    }
    if (opts.accountId) {
      out = out.filter((e) =>
        e.refs.accountId === opts.accountId ||
        e.refs.sourceAccountId === opts.accountId ||
        e.refs.destinationAccountId === opts.accountId,
      );
    }
    if (opts.assetId) out = out.filter((e) => e.refs.assetId === opts.assetId);
    if (opts.transferGroupId) out = out.filter((e) => e.refs.transferGroupId === opts.transferGroupId);
    if (opts.tag) out = out.filter((e) => (e.tags ?? []).includes(opts.tag!));
    if (opts.dateFrom) {
      const t = +new Date(opts.dateFrom);
      out = out.filter((e) => +new Date(e.at) >= t);
    }
    if (opts.dateTo) {
      const t = +new Date(opts.dateTo) + 24 * 60 * 60 * 1000;
      out = out.filter((e) => +new Date(e.at) <= t);
    }
    if (opts.q) {
      const q = opts.q.toLowerCase();
      out = out.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        (e.subtitle ?? "").toLowerCase().includes(q) ||
        (e.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    }

    out = out.slice().sort((a, b) => +new Date(b.at) - +new Date(a.at));
    if (opts.limit) out = out.slice(0, opts.limit);
    return out;
  }, [
    txs, accounts, assets, reports, goals, audits,
    opts.limit, opts.kinds?.join(","), opts.accountId, opts.assetId,
    opts.transferGroupId, opts.tag, opts.dateFrom, opts.dateTo, opts.q,
  ]);
}

/** Tag suggestions derived from existing transactions. */
export function useActivityTags(): string[] {
  const { rows: txs } = useTransactions();
  return useMemo(() => {
    const set = new Set<string>();
    for (const t of txs) for (const tag of (t.tags ?? [])) if (tag) set.add(tag);
    return Array.from(set).sort();
  }, [txs]);
}
