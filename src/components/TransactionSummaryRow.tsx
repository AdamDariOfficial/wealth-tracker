import type { ReactNode } from "react";
import type { TransactionView } from "@/application/view-models";
import { formatDateTime, formatQuantity, humanize } from "@/features/wealth-v2/format";
import {
  describeMovementFlow,
  summarizeTransaction,
} from "@/features/wealth-v2/transaction-presentation";
import { cn } from "@/lib/utils";

/**
 * Compact, honest reading of one canonical transaction.
 *
 * Reads every leg rather than showing the first one as if it stood for the
 * whole entry: each asset that moved gets its own line with the accounts it
 * moved between.
 */
export function TransactionSummaryRow({
  transaction,
  locale,
  className,
  trailing,
  maxMovements = 2,
}: {
  transaction: TransactionView;
  locale?: string;
  className?: string;
  trailing?: ReactNode;
  maxMovements?: number;
}) {
  const movements = summarizeTransaction(transaction);
  const shown = movements.slice(0, maxMovements);
  const hidden = movements.length - shown.length;
  const corrected = transaction.state !== "active";

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{transaction.description}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatDateTime(transaction.occurredAt, locale)}
          </div>
        </div>
        {trailing}
      </div>

      {shown.length > 0 && (
        <ul className="mt-2 space-y-1">
          {shown.map((movement) => {
            const flow = describeMovementFlow(movement);
            return (
              <li
                key={movement.assetId}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="min-w-0 truncate text-muted-foreground">{flow ?? "—"}</span>
                <span className="shrink-0 font-mono text-money text-foreground/90">
                  {formatQuantity(movement.quantity)}{" "}
                  <span className="text-muted-foreground">{movement.symbol}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {(hidden > 0 || corrected) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {hidden > 0 && (
            <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
              +{hidden} more {hidden === 1 ? "asset" : "assets"}
            </span>
          )}
          {corrected && (
            <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {humanize(transaction.state)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
