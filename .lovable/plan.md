# Phase 3 — Full Ledger Migration

The transaction ledger (`accounts`, `assets`, `transactions`) becomes the single source of truth. All modules read derived state via `useHoldings()` and write via `TransactionModal` / typed helpers. Legacy balance tables (`investments`, `etfs`, `crypto_holdings`, `cash_reserves`, `trading_account.balance`) are kept read-only during migration, then hidden once parity is confirmed.

## Scope

Migrate: Investments, ETF, Crypto, Trading Capital, Goals, Dashboard, Analytics, Weekly Reports. Add a global Timeline. Add ledger integrity helpers.

## Architecture

```text
TransactionModal ──▶ transactions table
                         │
                         ▼
               useHoldings() (replay)
                ├─ per-account value
                ├─ per-asset position (qty, avg cost, P&L)
                └─ totals (net worth, liquid, invested, realized, unrealized)
                         │
        ┌────────────────┼─────────────────┐
        ▼                ▼                 ▼
   Module pages     Dashboard         Analytics + Snapshots
```

Helper layer in `src/lib/ledger-actions.ts`:
- `recordBuy({ accountId, assetId, qty, price, fee, ts })` — emits one `buy` transaction (debits cash account, credits asset to broker/wallet account).
- `recordSell(...)` — `sell`, realizes P&L.
- `recordTransfer({ from, to, assetId, qty, ts })` — owned-account transfer, preserves cost basis (engine already handles).
- `recordDeposit / recordWithdrawal / recordFee / recordDividend / recordWeeklyPnl`.
- `recordRecurringDCA(planId)` — generates buy txs from a DCA plan.

All module CRUD is rewritten to call these helpers. No module touches `current_balance` directly.

## Schema additions (one migration)

- `dca_plans` (id, user_id, account_id, asset_id, amount_fiat, frequency, next_run_at, active).
- `goals.kind` enum (`net_worth | liquid | account_balance | asset_quantity | asset_value`), `goals.target_account_id`, `goals.target_asset_id`. Drop hand-edited `current_amount` (compute from ledger).
- `weekly_reports.posted_transaction_id` (nullable FK) — link the auto-generated `profit_realization` tx so edits/deletes can reverse it.
- Indexes: `transactions(user_id, execution_timestamp desc)`, `(user_id, asset_id)`, `(user_id, source_account_id)`, `(user_id, destination_account_id)`.
- Trigger `tg_transactions_update_balance`: on insert/update/delete of a transaction, recompute affected `accounts.current_balance` (cash side) so legacy reads stay coherent. Keeps double-entry consistent.
- Integrity view `v_ledger_integrity` (per user: txs without account on cash legs, negative balances, orphan transfer pairs).

## Module-by-module changes

### Investments / ETF / Crypto (`src/routes/{investments,etf,crypto}.tsx`)
- Replace direct table CRUD with:
  - List = `useHoldings()` filtered by `asset_class` (`stock`, `etf`, `crypto`).
  - "Add position" → opens `TransactionModal` preset to `buy` for that asset class.
  - Row actions: Buy more, Sell, Transfer (crypto only), View history (filtered timeline).
- Asset auto-create: if user types a new ticker, create `assets` row inline then emit `buy`.
- ETF page adds "DCA Plans" panel (CRUD on `dca_plans`) and a "Run now" button.
- Crypto page adds Wallet Allocation donut and Transfer flow showing `from → to` per asset (uses `transactions.transaction_type='transfer'`).

### Trading Capital (`src/routes/trading-capital.tsx`)
- Page becomes a broker-account view: pick a broker `account` (type `broker`), show derived equity (= account_value from ledger), deposits, withdrawals, weekly P&L stream, drawdown, equity curve from snapshots filtered to that account.
- Risk parameters stay on `trading_account` (config only — no balance writes).
- "Record weekly P&L" CTA opens the weekly report modal.

### Weekly Reports (`src/routes/journal.tsx`)
- On save with non-zero `pnl`, create a `profit_realization` tx on the selected broker account, store id in `posted_transaction_id`. On edit, reverse + re-post. On delete, reverse.
- Screenshots already wired.

### Goals (`src/routes/goals.tsx`)
- Form: choose `kind` + (account or asset) + target value/qty.
- `current_amount` is computed live from `useHoldings()` / account values; remove +/- buttons.
- Historical progress chart from `portfolio_snapshots_v2`.

### Dashboard (`src/routes/index.tsx`)
- KPIs from `useHoldings().totals`. Add: Account Allocation (donut by account), Asset Allocation (donut by asset_class), Monthly Cash Flow (deposits − withdrawals from txs grouped by month), Rolling 30d P&L, Recent Activity (last 8 txs).
- Animated balance transitions via framer-motion `animate` on numeric values.

### Analytics (`src/routes/analytics.tsx`)
- Period selector: 24h / 7d / 30d / 90d / YTD / ALL — drives a single `useSnapshots(range)` hook.
- Charts: Net Worth history, Liquidity evolution, Cumulative deposits vs withdrawals, Realized P&L curve, Allocation drift (stacked area by asset_class over time), Per-asset and Per-account performance tables.
- Capital Flow visualization: simple Sankey (custom SVG) of deposits → accounts → assets over the selected range.

### Timeline (`src/routes/timeline.tsx` — new)
- Global chronological feed with exact `YYYY-MM-DD HH:mm:ss`.
- Day-grouped, expandable cards. Linked transfer pairs share an icon + hover highlight. Filter by type, account, asset. Paginated (50/page) with infinite scroll.

## Performance

- `useHoldings` becomes selector-driven: memoized by `txs.length + last updated_at` so it doesn't re-replay on unrelated state.
- Snapshot writer: batch + only when net worth delta > 0.5% or once/day.
- Realtime: a single `transactions` channel that invalidates derived selectors (no per-page subscription churn).
- Add table indexes listed above.

## Migration safety

1. Ship schema migration + helpers + Timeline + Dashboard rewrite first.
2. Migrate Investments → ETF → Crypto pages to ledger-driven UI.
3. Migrate Trading Capital + Weekly Reports posting.
4. Migrate Goals.
5. Add Analytics rewrite + integrity view.
6. After 1 full session of parity verification, hide legacy tables from the Settings → Data panel (kept in DB for rollback).

## Files

New: `src/lib/ledger-actions.ts`, `src/hooks/use-snapshots.ts`, `src/hooks/use-timeline.ts`, `src/components/AssetPicker.tsx`, `src/components/AccountPicker.tsx`, `src/components/SankeyFlow.tsx`, `src/routes/timeline.tsx`, one migration file.
Edited: `src/routes/{index,investments,etf,crypto,trading-capital,journal,goals,analytics}.tsx`, `src/components/TransactionModal.tsx` (presets + asset autocreate), `src/components/AppSidebar.tsx` (add Timeline).

## Out of scope (deferred)

Broker/exchange API sync, tax engine, staking yield automation, liabilities, multi-user — schema stays compatible but no UI.
