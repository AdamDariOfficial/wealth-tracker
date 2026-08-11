import type { AdvancedState, GoalKind, GoalRecord } from "../advanced";
import { Decimal, Money } from "../../domain/core";
import type { WealthOverview } from "./wealth-overview";

export type GoalProgressView = Readonly<{
  goal: GoalRecord;
  kind: GoalKind;
  currentMoney: Money | null;
  targetMoney: Money | null;
  currentQuantity: Decimal | null;
  targetQuantity: Decimal | null;
  assetSymbol: string | null;
  complete: boolean;
  progressPercent: number;
}>;

function visualPercent(current: Decimal, target: Decimal): number {
  if (target.compare(Decimal.zero()) <= 0) return 0;
  const ratio = current.dividedBy(target, 6, "half-even").times(Decimal.fromInteger(100));
  const clamped = ratio.isNegative()
    ? Decimal.zero()
    : ratio.compare(Decimal.fromInteger(100)) > 0
      ? Decimal.fromInteger(100)
      : ratio;
  return Number(clamped.toFixed(2, "half-even"));
}

function sumMoney(values: readonly Money[], currency: string): Money {
  let total = Money.zero(currency);
  for (const value of values) total = total.plus(value);
  return total;
}

export function buildGoalsOverview(
  financial: WealthOverview,
  advanced: AdvancedState,
): readonly GoalProgressView[] {
  const currency = financial.baseCurrency;
  const accountById = new Map(
    financial.state.accounts.map((value) => [value.id.toString(), value]),
  );
  const assetById = new Map(financial.state.assets.map((value) => [value.id.toString(), value]));

  return Object.freeze(
    advanced.goals
      .filter((goal) => goal.archivedAt === null)
      .map((goal): GoalProgressView => {
        if (goal.kind === "asset_quantity") {
          const targetQuantity = Decimal.parse(goal.targetQuantity ?? "0");
          let currentQuantity = Decimal.zero();
          for (const balance of financial.state.snapshot.balances) {
            if (balance.assetId.toString() !== goal.targetAssetId) continue;
            const account = accountById.get(balance.accountId.toString());
            if (account?.ownership === "owned")
              currentQuantity = currentQuantity.plus(balance.quantity);
          }
          const asset = goal.targetAssetId ? assetById.get(goal.targetAssetId) : null;
          return Object.freeze({
            goal,
            kind: goal.kind,
            currentMoney: null,
            targetMoney: null,
            currentQuantity,
            targetQuantity,
            assetSymbol: asset?.symbol ?? null,
            complete: true,
            progressPercent: visualPercent(currentQuantity, targetQuantity),
          });
        }

        if (!currency) {
          return Object.freeze({
            goal,
            kind: goal.kind,
            currentMoney: null,
            targetMoney: null,
            currentQuantity: null,
            targetQuantity: null,
            assetSymbol: null,
            complete: false,
            progressPercent: 0,
          });
        }

        const targetMoney = Money.of(goal.targetAmount ?? "0", currency);
        const values: Money[] = [];
        let totalPositions = 0;
        let knownPositions = 0;

        if (goal.kind === "net_worth") {
          const currentMoney = financial.knownNetWorth;
          return Object.freeze({
            goal,
            kind: goal.kind,
            currentMoney,
            targetMoney,
            currentQuantity: null,
            targetQuantity: null,
            assetSymbol: null,
            complete: financial.valuationComplete,
            progressPercent: currentMoney
              ? visualPercent(currentMoney.amount, targetMoney.amount)
              : 0,
          });
        }

        for (const position of financial.positions) {
          const account = accountById.get(position.accountId);
          if (!account || account.ownership !== "owned") continue;

          const selected =
            goal.kind === "liquid"
              ? ["cash", "bank", "savings"].includes(account.kind)
              : goal.kind === "account_balance"
                ? position.accountId === goal.targetAccountId
                : goal.kind === "asset_value"
                  ? position.assetId === goal.targetAssetId
                  : false;

          if (!selected) continue;
          totalPositions += 1;
          if (position.value) {
            knownPositions += 1;
            values.push(position.value);
          }
        }

        const currentMoney = sumMoney(values, currency);
        return Object.freeze({
          goal,
          kind: goal.kind,
          currentMoney,
          targetMoney,
          currentQuantity: null,
          targetQuantity: null,
          assetSymbol:
            goal.kind === "asset_value" && goal.targetAssetId
              ? (assetById.get(goal.targetAssetId)?.symbol ?? null)
              : null,
          complete: knownPositions === totalPositions,
          progressPercent: visualPercent(currentMoney.amount, targetMoney.amount),
        });
      }),
  );
}
