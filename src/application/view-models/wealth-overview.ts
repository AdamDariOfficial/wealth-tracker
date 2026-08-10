import type { Account } from "../../domain/accounts";
import type { Asset, AssetKind } from "../../domain/assets";
import { Decimal, Money } from "../../domain/core";
import type { EffectiveTransactionState, LedgerTransaction } from "../../domain/ledger";
import { valueLedger, type LedgerValuation, type ValuedPosition } from "../../domain/valuation";
import type { ValidatedFinancialState } from "../services";

export type PositionView = Readonly<{
  accountId: string;
  accountName: string;
  assetId: string;
  symbol: string;
  assetName: string;
  kind: AssetKind;
  quantity: string;
  value: Money | null;
  missingReason: "missing-price" | "missing-fx-rate" | null;
}>;

export type AccountView = Readonly<{
  id: string;
  name: string;
  kind: Account["kind"];
  ownership: Account["ownership"];
  includeInNetWorth: boolean;
  archived: boolean;
  knownValue: Money | null;
  unknownPositionCount: number;
  positionCount: number;
}>;

export type TransactionView = Readonly<{
  id: string;
  occurredAt: string;
  recordedAt: string;
  description: string;
  purpose: LedgerTransaction["purpose"];
  state: EffectiveTransactionState;
  relatedTransactionId: string | null;
  legs: readonly Readonly<{
    id: string;
    accountId: string;
    accountName: string;
    assetId: string;
    assetSymbol: string;
    quantity: string;
    memo: string | null;
  }>[];
}>;

export type AllocationView = Readonly<{
  kind: AssetKind;
  amount: string;
  currency: string;
}>;

export type WealthOverview = Readonly<{
  state: ValidatedFinancialState;
  valuation: LedgerValuation | null;
  baseCurrency: string | null;
  knownNetWorth: Money | null;
  valuationComplete: boolean;
  knownPositionCount: number;
  totalPositionCount: number;
  unknownPositionCount: number;
  positions: readonly PositionView[];
  accounts: readonly AccountView[];
  transactions: readonly TransactionView[];
  allocation: readonly AllocationView[];
}>;

function indexById<T>(values: readonly T[], idOf: (value: T) => string): Map<string, T> {
  return new Map(values.map((value) => [idOf(value), value]));
}

function positionToView(
  position: ValuedPosition,
  accountById: ReadonlyMap<string, Account>,
  assetById: ReadonlyMap<string, Asset>,
): PositionView {
  const account = accountById.get(position.accountId.toString());
  const asset = assetById.get(position.assetId.toString());
  if (!account || !asset) {
    throw new Error("Validated ledger position references missing account or asset.");
  }

  return Object.freeze({
    accountId: account.id.toString(),
    accountName: account.name,
    assetId: asset.id.toString(),
    symbol: asset.symbol,
    assetName: asset.name,
    kind: asset.kind,
    quantity: position.quantity.toString(),
    value: position.status === "known" ? position.value : null,
    missingReason: position.status === "unknown" ? position.reason : null,
  });
}

function buildAccountViews(
  state: ValidatedFinancialState,
  valuation: LedgerValuation | null,
): readonly AccountView[] {
  const positions = valuation?.positions ?? [];
  return state.accounts
    .map((account) => {
      const accountPositions = positions.filter((position) =>
        position.accountId.equals(account.id),
      );
      const known = accountPositions.filter((position) => position.status === "known");
      const unknownCount = accountPositions.length - known.length;
      let knownValue: Money | null = null;
      if (valuation && account.includeInNetWorth) {
        knownValue = Money.zero(valuation.baseCurrency);
        for (const position of known) knownValue = knownValue.plus(position.value);
      }
      return Object.freeze({
        id: account.id.toString(),
        name: account.name,
        kind: account.kind,
        ownership: account.ownership,
        includeInNetWorth: account.includeInNetWorth,
        archived: account.isArchived(),
        knownValue,
        unknownPositionCount: unknownCount,
        positionCount: state.snapshot.balancesForAccount(account.id).length,
      });
    })
    .sort((left, right) => {
      if (left.archived !== right.archived) return left.archived ? 1 : -1;
      return left.name.localeCompare(right.name);
    });
}

function buildTransactionViews(state: ValidatedFinancialState): readonly TransactionView[] {
  const accountById = indexById(state.accounts, (account) => account.id.toString());
  const assetById = indexById(state.assets, (asset) => asset.id.toString());
  const auditById = new Map(
    state.snapshot.auditStates.map((audit) => [audit.transactionId.toString(), audit]),
  );

  return [...state.snapshot.transactions].reverse().map((transaction) => {
    const audit = auditById.get(transaction.id.toString());
    if (!audit) throw new Error("Validated transaction has no audit state.");
    return Object.freeze({
      id: transaction.id.toString(),
      occurredAt: transaction.occurredAt.toString(),
      recordedAt: transaction.recordedAt.toString(),
      description: transaction.description,
      purpose: transaction.purpose,
      state: audit.state,
      relatedTransactionId: transaction.relatedTransactionId?.toString() ?? null,
      legs: Object.freeze(
        transaction.legs.map((leg) => {
          const account = accountById.get(leg.accountId.toString());
          const asset = assetById.get(leg.assetId.toString());
          if (!account || !asset) {
            throw new Error("Validated transaction leg references missing data.");
          }
          return Object.freeze({
            id: leg.id.toString(),
            accountId: account.id.toString(),
            accountName: account.name,
            assetId: asset.id.toString(),
            assetSymbol: asset.symbol,
            quantity: leg.quantity.toString(),
            memo: leg.memo,
          });
        }),
      ),
    });
  });
}

function buildAllocation(
  positions: readonly PositionView[],
  currency: string | null,
): readonly AllocationView[] {
  if (!currency) return [];
  const totals = new Map<AssetKind, Decimal>();
  for (const position of positions) {
    if (!position.value) continue;
    totals.set(
      position.kind,
      (totals.get(position.kind) ?? Decimal.zero()).plus(position.value.amount),
    );
  }
  return [...totals.entries()]
    .map(([kind, amount]) => Object.freeze({ kind, amount: amount.toString(), currency }))
    .sort((left, right) => Decimal.parse(right.amount).compare(Decimal.parse(left.amount)));
}

export function buildWealthOverview(state: ValidatedFinancialState): WealthOverview {
  const profile = state.profile;
  const baseCurrency = profile?.baseCurrency?.toString() ?? null;
  const valuation = baseCurrency
    ? valueLedger({
        snapshot: state.snapshot,
        accounts: state.accounts,
        assets: state.assets,
        baseCurrency,
        priceQuotes: state.priceQuotes,
        fxRates: state.fxRates,
      })
    : null;

  const accountById = indexById(state.accounts, (account) => account.id.toString());
  const assetById = indexById(state.assets, (asset) => asset.id.toString());
  const positions = Object.freeze(
    (valuation?.positions ?? []).map((position) =>
      positionToView(position, accountById, assetById),
    ),
  );

  return Object.freeze({
    state,
    valuation,
    baseCurrency,
    knownNetWorth: valuation?.knownTotal ?? null,
    valuationComplete: valuation?.complete ?? false,
    knownPositionCount: valuation?.knownPositionCount ?? 0,
    totalPositionCount: valuation?.totalPositionCount ?? 0,
    unknownPositionCount: valuation
      ? valuation.totalPositionCount - valuation.knownPositionCount
      : 0,
    positions,
    accounts: Object.freeze(buildAccountViews(state, valuation)),
    transactions: Object.freeze(buildTransactionViews(state)),
    allocation: Object.freeze(buildAllocation(positions, baseCurrency)),
  });
}
