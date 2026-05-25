/**
 * Hybrid net-worth time series.
 * Combines real performance snapshots with reconstructed ledger replay so
 * historical charts reflect imported transactions even when no snapshots
 * existed at the time. Transactions remain the source of truth.
 */
import { useMemo } from "react";
import { useSnapshots } from "@/hooks/use-portfolio";
import { useAccounts } from "@/hooks/use-ledger";
import { useUserTable } from "@/hooks/use-user-table";
import type { Transaction } from "@/hooks/use-ledger";
import {
  buildHybridTimeline,
  type DailyPoint,
  type RealSnapshot,
} from "@/lib/history-reconstruction";

export function useNetWorthSeries(opts: { days?: number; forwardFill?: boolean } = {}) {
  const { rows: snaps, loading: ls } = useSnapshots(opts.days ?? 365);
  const { rows: accounts, loading: la } = useAccounts();
  const { rows: txs, loading: lt } = useUserTable<Transaction>("transactions", {
    col: "execution_timestamp", asc: true,
  });

  const points: DailyPoint[] = useMemo(
    () => buildHybridTimeline(
      accounts,
      txs,
      snaps as unknown as RealSnapshot[],
      { forwardFill: opts.forwardFill ?? true },
    ),
    [accounts, txs, snaps, opts.forwardFill],
  );

  return { points, loading: ls || la || lt };
}
