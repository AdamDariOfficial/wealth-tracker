import type { ReactNode } from "react";
import type { TransactionView } from "@/application/view-models";
import { formatDateTime, formatQuantity } from "@/features/wealth-v2/format";
import {
  describeMovementFlow,
  summarizeTransaction,
} from "@/features/wealth-v2/transaction-presentation";
import {
  describeOwnedMovement,
  type MovementDirection,
} from "@/features/wealth-v2/transaction-row-presentation";
import { useI18n } from "@/lib/use-i18n";
import { cn } from "@/lib/utils";

function formatTime(value: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale ?? "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function amountTone(direction: MovementDirection): string {
  if (direction === "positive") return "text-success";
  if (direction === "negative") return "text-destructive";
  return "text-foreground/90";
}

function signedQuantity(quantity: string, direction: MovementDirection): string {
  if (direction === "positive") return `+${quantity}`;
  if (direction === "negative") return `−${quantity}`;
  return quantity;
}

/**
 * Compact, honest reading of one canonical transaction.
 *
 * Every asset movement is derived from all transaction legs. When owned account
 * IDs are provided, external/system counterparties stay out of the normal UX
 * and the amount receives a semantic direction:
 *
 * - positive: the asset entered owned accounts;
 * - negative: the asset left owned accounts;
 * - neutral: internal transfer or mixed owned movement.
 *
 * Color never replaces the sign/flow text.
 */
export function TransactionSummaryRow({
  transaction,
  locale,
  className,
  trailing,
  maxMovements = 2,
  ownedAccountIds,
  dateMode = "date-time",
}: {
  transaction: TransactionView;
  locale?: string;
  className?: string;
  trailing?: ReactNode;
  maxMovements?: number;
  ownedAccountIds?: ReadonlySet<string> | readonly string[];
  dateMode?: "date-time" | "time";
}) {
  const { t } = useI18n();
  const movements = summarizeTransaction(transaction);
  const shown = movements.slice(0, maxMovements);
  const hidden = movements.length - shown.length;
  const ownedIds = ownedAccountIds ? new Set(ownedAccountIds) : null;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground sm:text-[15px]">
            {transaction.description}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {dateMode === "time"
              ? formatTime(transaction.occurredAt, locale)
              : formatDateTime(transaction.occurredAt, locale)}
          </div>
        </div>
        {trailing}
      </div>

      {shown.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {shown.map((movement) => {
            const presentation = ownedIds
              ? describeOwnedMovement(transaction, movement.assetId, ownedIds)
              : {
                  flow: describeMovementFlow(movement),
                  direction: "neutral" as const,
                };
            const quantity = formatQuantity(movement.quantity, 8, locale);

            return (
              <li
                key={movement.assetId}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="min-w-0 truncate text-foreground/65">
                  {presentation.flow ?? "—"}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-money font-medium tabular-nums",
                    amountTone(presentation.direction),
                  )}
                >
                  {signedQuantity(quantity, presentation.direction)}{" "}
                  <span className="text-muted-foreground">{movement.symbol}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {hidden > 0 && (
        <div className="mt-2">
          <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            +{hidden} {t("more")} {t(hidden === 1 ? "asset" : "assets")}
          </span>
        </div>
      )}
    </div>
  );
}
