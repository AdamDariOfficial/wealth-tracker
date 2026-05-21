import { useMemo } from "react";
import { useUserTable } from "@/hooks/use-user-table";
import { useAccounts } from "@/hooks/use-ledger";
import type { Transaction } from "@/hooks/use-ledger";
import {
  buildEquityCurve,
  computeTradingMetrics,
  extractCapitalMovements,
  type WeeklyReport,
} from "@/lib/trading-engine";

/**
 * Single source of truth for the Trading Workspace.
 * Derives all metrics from canonical sources — no mutable frontend state.
 */
export function useTrading() {
  const { rows: accounts, loading: la } = useAccounts();
  const { rows: txs, loading: lt } = useUserTable<Transaction>("transactions", {
    col: "execution_timestamp", asc: true,
  });
  const { rows: weekly, loading: lw, insert, update, remove, refresh } =
    useUserTable<WeeklyReport>("weekly_reports", { col: "week_start", asc: false });

  const metrics = useMemo(
    () => computeTradingMetrics(txs, accounts, weekly),
    [txs, accounts, weekly],
  );
  const equity = useMemo(
    () => buildEquityCurve(txs, accounts, weekly),
    [txs, accounts, weekly],
  );
  const capital = useMemo(
    () => extractCapitalMovements(txs, accounts),
    [txs, accounts],
  );

  return {
    accounts, txs, weekly,
    metrics, equity, capital,
    loading: la || lt || lw,
    weeklyApi: { insert, update, remove, refresh },
  };
}
