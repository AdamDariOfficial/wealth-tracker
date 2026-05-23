import { useMemo } from "react";
import { useTransactions, useAccounts, useAssets } from "@/hooks/use-ledger";
import { useUserTable } from "@/hooks/use-user-table";

export type ActivityKind =
  | "transaction" | "transfer" | "reconciliation" | "audit"
  | "weekly_report" | "goal" | "account";

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  /** ISO timestamp used for sort + display */
  at: string;
  title: string;
  subtitle?: string;
  /** Optional signed amount (base ccy). */
  amount?: number | null;
  /** Optional accent: "positive" | "negative" | "neutral" | "warning" */
  tone?: "positive" | "negative" | "neutral" | "warning";
  /** Free-form metadata for advanced/expanded views. */
  meta?: Record<string, unknown>;
};

type WeeklyReport = {
  id: string; week_start: string; pnl: number; num_trades: number;
  winrate: number; finalized_at: string | null; created_at: string;
};
type Goal = {
  id: string; name: string; target_amount: number; current_amount: number;
  archived_at: string | null; updated_at: string; created_at: string;
};
type AuditRow = {
  id: string; event_type: string; account_id: string | null;
  before_balance: number | null; after_balance: number | null; delta: number | null;
  message: string | null; created_at: string;
};

/**
 * Unified, derived activity stream. Pulls from the canonical ledger
 * (transactions), weekly_reports, audit_log, and goals — no separate
 * persistence. Order is strictly chronological (desc).
 */
export function useActivityFeed(opts: { limit?: number; kinds?: ActivityKind[] } = {}) {
  const { rows: txs } = useTransactions();
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const { rows: reports } = useUserTable<WeeklyReport>("weekly_reports", { col: "week_start", asc: false });
  const { rows: goals } = useUserTable<Goal>("goals", { col: "updated_at", asc: false });
  const { rows: audits } = useUserTable<AuditRow>("audit_log", { col: "created_at", asc: false });

  const acctName = (id: string | null) => id ? accounts.find((a) => a.id === id)?.name ?? "—" : "—";
  const assetSym = (id: string | null) => id ? assets.find((a) => a.id === id)?.symbol ?? "" : "";

  return useMemo(() => {
    const events: ActivityEvent[] = [];

    for (const t of txs) {
      const isTransfer = t.transaction_type === "transfer" || !!t.transfer_group_id;
      const positive = ["deposit","sell","dividend","interest","staking_reward","profit_realization"].includes(t.transaction_type);
      const negative = ["withdrawal","fee","buy"].includes(t.transaction_type);
      const sym = assetSym(t.asset_id);
      events.push({
        id: `tx:${t.id}`,
        kind: isTransfer ? "transfer" : "transaction",
        at: t.execution_timestamp,
        title: `${t.transaction_type.replace(/_/g, " ")}${sym ? ` · ${sym}` : ""}`,
        subtitle: [acctName(t.source_account_id), acctName(t.destination_account_id)]
          .filter((s) => s !== "—").join(" → ") || (t.note ?? ""),
        amount: Number(t.fiat_value) || 0,
        tone: positive ? "positive" : negative ? "negative" : "neutral",
        meta: { txId: t.id, type: t.transaction_type, tags: t.tags, note: t.note, transferGroupId: t.transfer_group_id },
      });
    }

    for (const r of reports) {
      events.push({
        id: `wr:${r.id}`,
        kind: "weekly_report",
        at: r.finalized_at ?? r.created_at,
        title: `Weekly report — ${r.week_start}${r.finalized_at ? " (finalized)" : " (draft)"}`,
        subtitle: `${r.num_trades} trades · winrate ${Math.round((r.winrate || 0) * 100)}%`,
        amount: Number(r.pnl) || 0,
        tone: (r.pnl ?? 0) >= 0 ? "positive" : "negative",
        meta: { reportId: r.id, finalized: !!r.finalized_at },
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
        subtitle: `${Math.round(pct * 100)}% of target`,
        tone: pct >= 1 ? "positive" : "neutral",
        meta: { goalId: g.id, pct },
      });
    }

    for (const a of audits) {
      const isRecon = a.event_type === "reconciliation";
      const isFail = a.event_type === "failed_reconciliation";
      events.push({
        id: `audit:${a.id}`,
        kind: isRecon ? "reconciliation" : "audit",
        at: a.created_at,
        title: a.event_type.replace(/_/g, " "),
        subtitle: a.message ?? acctName(a.account_id),
        amount: a.delta != null ? Number(a.delta) : null,
        tone: isFail ? "warning" : isRecon ? "neutral" : "neutral",
        meta: { auditId: a.id, accountId: a.account_id, before: a.before_balance, after: a.after_balance },
      });
    }

    let out = events.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    if (opts.kinds && opts.kinds.length) {
      const set = new Set(opts.kinds);
      out = out.filter((e) => set.has(e.kind));
    }
    if (opts.limit) out = out.slice(0, opts.limit);
    return out;
  }, [txs, accounts, assets, reports, goals, audits, opts.limit, opts.kinds?.join(",")]);
}
