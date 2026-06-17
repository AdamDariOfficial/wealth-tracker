/**
 * Pure simulation of an import's impact on the user's financial system.
 *
 * Reads current state from:
 *   - accounts (current_balance, type)
 *   - holdings  (asset positions from useHoldings → ledger engine)
 *   - goals     (current_amount, target_amount)
 *
 * Walks parsed entries and produces before/after deltas. Never writes.
 * Allocation buckets mirror src/hooks/use-portfolio.ts so analytics shown
 * here match the dashboard exactly after the user confirms the import.
 */

import type { ParsedEntry } from "./import-parser";
import type { Account, Asset, Holding } from "@/hooks/use-ledger";

export interface AnalyticsGoal {
  id: string;
  name: string;
  current_amount: number;
  target_amount: number;
}

export interface AnalyticsInput {
  entries: ParsedEntry[];
  accounts: Account[];
  assets: Asset[];
  holdings: Holding[];
  goals: AnalyticsGoal[];
}

export interface AccountDelta {
  id: string;
  name: string;
  before: number;
  after: number;
  delta: number;
}
export interface AssetExposureDelta {
  id: string;
  symbol: string;
  beforeQty: number;
  afterQty: number;
  beforeValue: number;
  afterValue: number;
}
export interface GoalDelta {
  id: string;
  name: string;
  beforeAmount: number;
  afterAmount: number;
  target: number;
  beforePct: number;
  afterPct: number;
}
export interface AllocationSlice {
  name: string;
  before: number;
  after: number;
}

export interface ImpactReport {
  netWorthBefore: number;
  netWorthAfter: number;
  netWorthDelta: number;
  cashBefore: number;
  cashAfter: number;
  investedBefore: number;
  investedAfter: number;
  tradingCapitalBefore: number;
  tradingCapitalAfter: number;
  accountDeltas: AccountDelta[];
  assetDeltas: AssetExposureDelta[];
  goalDeltas: GoalDelta[];
  allocationByClass: AllocationSlice[];
  newAccounts: number;
  newAssets: number;
  newGoals: number;
}

const isCash = (t: Account["type"]) => t === "bank" || t === "cash" || t === "savings";

export function simulateImpact(input: AnalyticsInput): ImpactReport {
  const { entries, accounts, assets, holdings, goals } = input;

  // ---- BEFORE state ----
  const acctBalance = new Map<string, number>();
  const acctType = new Map<string, Account["type"]>();
  const acctName = new Map<string, string>();
  for (const a of accounts) {
    if (a.archived_at) continue;
    acctBalance.set(a.id, Number(a.current_balance ?? 0));
    acctType.set(a.id, a.type);
    acctName.set(a.id, a.name);
  }

  // Holdings: aggregate by asset (sum across accounts).
  const heldQty = new Map<string, number>();
  const heldValue = new Map<string, number>();
  for (const h of holdings) {
    heldQty.set(h.assetId, (heldQty.get(h.assetId) ?? 0) + h.quantity);
    heldValue.set(h.assetId, (heldValue.get(h.assetId) ?? 0) + h.marketValue);
  }
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const goalAmount = new Map<string, number>();
  const goalTarget = new Map<string, number>();
  const goalName = new Map<string, string>();
  for (const g of goals) {
    goalAmount.set(g.id, Number(g.current_amount ?? 0));
    goalTarget.set(g.id, Number(g.target_amount ?? 0));
    goalName.set(g.id, g.name);
  }

  // Snapshot "before" totals.
  const snapshotCash = () => {
    let cash = 0, trading = 0;
    for (const [id, bal] of acctBalance) {
      if (isCash(acctType.get(id) ?? "external")) cash += bal;
      else trading += bal;
    }
    return { cash, trading };
  };
  const snapshotHoldings = () => {
    let v = 0;
    for (const x of heldValue.values()) v += x;
    return v;
  };

  const beforeCashSplit = snapshotCash();
  const beforeHoldings = snapshotHoldings();
  const netWorthBefore = beforeCashSplit.cash + beforeCashSplit.trading + beforeHoldings;
  const investedBefore = beforeCashSplit.trading + beforeHoldings;

  let newAccounts = 0, newAssets = 0, newGoals = 0;

  // ---- APPLY each entry ----
  for (const e of entries) {
    if (e.errors.length) continue;
    switch (e.kind) {
      case "deposit": {
        const id = e.account?.matchedId; if (!id) continue;
        acctBalance.set(id, (acctBalance.get(id) ?? 0) + e.amount); break;
      }
      case "expense": {
        const id = e.account?.matchedId; if (!id) continue;
        acctBalance.set(id, (acctBalance.get(id) ?? 0) - e.amount); break;
      }
      case "transfer": {
        const f = e.fromAccount?.matchedId; const t = e.toAccount?.matchedId;
        if (f) acctBalance.set(f, (acctBalance.get(f) ?? 0) - e.amount);
        if (t) acctBalance.set(t, (acctBalance.get(t) ?? 0) + e.amount); break;
      }
      case "buy": {
        const acc = e.account?.matchedId;
        const a = e.asset?.matchedId; if (!a) continue;
        const qty = e.quantity ?? 0;
        const price = e.price ?? Number(assetById.get(a)?.current_price ?? 0);
        if (acc) acctBalance.set(acc, (acctBalance.get(acc) ?? 0) - e.amount);
        heldQty.set(a, (heldQty.get(a) ?? 0) + qty);
        heldValue.set(a, (heldValue.get(a) ?? 0) + qty * price);
        break;
      }
      case "sell": {
        const acc = e.account?.matchedId;
        const a = e.asset?.matchedId; if (!a) continue;
        const qty = e.quantity ?? 0;
        const price = e.price ?? Number(assetById.get(a)?.current_price ?? 0);
        if (acc) acctBalance.set(acc, (acctBalance.get(acc) ?? 0) + e.amount);
        heldQty.set(a, Math.max(0, (heldQty.get(a) ?? 0) - qty));
        heldValue.set(a, Math.max(0, (heldValue.get(a) ?? 0) - qty * price));
        break;
      }
      case "account_open": {
        const id = e.account?.matchedId;
        if (id) acctBalance.set(id, e.amount);
        else {
          newAccounts++;
          const tmp = `__new_acct_${newAccounts}`;
          acctBalance.set(tmp, e.amount);
          acctType.set(tmp, "bank");
          acctName.set(tmp, e.account?.raw ?? "(new account)");
        }
        break;
      }
      case "asset_open": {
        const aId = e.asset?.matchedId;
        const qty = e.quantity ?? 0;
        const price = e.price ?? (aId ? Number(assetById.get(aId)?.current_price ?? 0) : 0);
        if (aId) {
          heldQty.set(aId, (heldQty.get(aId) ?? 0) + qty);
          heldValue.set(aId, (heldValue.get(aId) ?? 0) + qty * price);
        } else {
          newAssets++;
          const tmp = `__new_asset_${newAssets}`;
          heldQty.set(tmp, qty);
          heldValue.set(tmp, qty * price);
        }
        break;
      }
      case "goal_create": {
        const id = e.goal?.matchedId;
        if (id) goalTarget.set(id, e.targetAmount ?? 0);
        else {
          newGoals++;
          const tmp = `__new_goal_${newGoals}`;
          goalName.set(tmp, e.goal?.raw ?? "(new goal)");
          goalAmount.set(tmp, 0);
          goalTarget.set(tmp, e.targetAmount ?? 0);
        }
        break;
      }
      case "goal_contribution": {
        const id = e.goal?.matchedId; if (!id) continue;
        goalAmount.set(id, (goalAmount.get(id) ?? 0) + e.amount);
        break;
      }
    }
  }

  // ---- AFTER state ----
  const afterCashSplit = snapshotCash();
  const afterHoldings = snapshotHoldings();
  const netWorthAfter = afterCashSplit.cash + afterCashSplit.trading + afterHoldings;
  const investedAfter = afterCashSplit.trading + afterHoldings;

  // ---- per-account deltas ----
  const accountDeltas: AccountDelta[] = [];
  for (const [id, after] of acctBalance) {
    const before = id.startsWith("__new_") ? 0 : Number(accounts.find((a) => a.id === id)?.current_balance ?? 0);
    if (Math.abs(after - before) < 0.005) continue;
    accountDeltas.push({
      id, name: acctName.get(id) ?? id,
      before, after, delta: after - before,
    });
  }
  accountDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // ---- asset exposure deltas ----
  const assetDeltas: AssetExposureDelta[] = [];
  const seenAssets = new Set<string>([...heldQty.keys()]);
  for (const id of seenAssets) {
    const beforeQty = id.startsWith("__new_") ? 0 : (holdings.find((h) => h.assetId === id)?.quantity ?? 0);
    const afterQty = heldQty.get(id) ?? 0;
    if (Math.abs(afterQty - beforeQty) < 1e-8) continue;
    const beforeValue = id.startsWith("__new_") ? 0 : (() => {
      let v = 0; for (const h of holdings) if (h.assetId === id) v += h.marketValue; return v;
    })();
    const afterValue = heldValue.get(id) ?? 0;
    const sym = id.startsWith("__new_")
      ? entries.find((e) => e.kind === "asset_open" && !e.asset?.matchedId)?.asset?.raw ?? "(new)"
      : (assetById.get(id)?.symbol ?? id);
    assetDeltas.push({ id, symbol: sym, beforeQty, afterQty, beforeValue, afterValue });
  }
  assetDeltas.sort((a, b) => Math.abs(b.afterValue - b.beforeValue) - Math.abs(a.afterValue - a.beforeValue));

  // ---- goal deltas ----
  const goalDeltas: GoalDelta[] = [];
  for (const [id, after] of goalAmount) {
    const beforeAmt = id.startsWith("__new_") ? 0 : Number(goals.find((g) => g.id === id)?.current_amount ?? 0);
    const target = Number(goalTarget.get(id) ?? 0);
    const targetBefore = id.startsWith("__new_") ? 0 : Number(goals.find((g) => g.id === id)?.target_amount ?? 0);
    const changedAmt = Math.abs(after - beforeAmt) > 0.005;
    const changedTarget = Math.abs(target - targetBefore) > 0.005;
    if (!changedAmt && !changedTarget && !id.startsWith("__new_")) continue;
    goalDeltas.push({
      id, name: goalName.get(id) ?? id,
      beforeAmount: beforeAmt, afterAmount: after, target,
      beforePct: targetBefore > 0 ? Math.min(100, (beforeAmt / targetBefore) * 100) : 0,
      afterPct: target > 0 ? Math.min(100, (after / target) * 100) : 0,
    });
  }

  // ---- allocation by class ----
  const allocationByClass: AllocationSlice[] = [
    { name: "Cash", before: beforeCashSplit.cash, after: afterCashSplit.cash },
    { name: "Trading", before: beforeCashSplit.trading, after: afterCashSplit.trading },
    { name: "Holdings", before: beforeHoldings, after: afterHoldings },
  ];

  return {
    netWorthBefore, netWorthAfter, netWorthDelta: netWorthAfter - netWorthBefore,
    cashBefore: beforeCashSplit.cash, cashAfter: afterCashSplit.cash,
    investedBefore, investedAfter,
    tradingCapitalBefore: beforeCashSplit.trading, tradingCapitalAfter: afterCashSplit.trading,
    accountDeltas, assetDeltas, goalDeltas, allocationByClass,
    newAccounts, newAssets, newGoals,
  };
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return +((part / whole) * 100).toFixed(1);
}
