# Ledger Stabilization & UX Consistency Plan

This is a large structural pass (11 areas). Shipping all of it in a single batch would produce regressions everywhere and be impossible to verify. I'll execute in **5 sequential phases**, each independently shippable and testable. After each phase you confirm before I start the next.

---

## Phase 1 — Financial Core (foundation, blocking everything else)

The calculation engine and currency model must be right before UI/UX work, otherwise we re-fix the same bugs later.

**1a. Base currency + FX engine**
- Add `base_currency` to `profiles` (default `USD`, options: `USD`, `EUR`, `JOD`, extensible).
- New `fx_rates` table: `(base, quote, rate, as_of timestamptz)`, unique `(base, quote, date_trunc('day', as_of))`.
- `src/lib/fx.ts`: `convert(amount, from, to, at?)` with daily cache + fallback chain (direct → via USD → 1:1 if same).
- `src/lib/format-currency.ts`: locale-aware `Intl.NumberFormat` formatter driven by the user's base currency. Replace hardcoded `$`/`€` formatters.

**1b. Transaction model extension** (additive — no breaking changes)
- Migration adds columns to `transactions`: `asset_price numeric`, `asset_currency text`, `base_currency text`, `base_value numeric`, `fee_asset_id uuid` (already exists), `fee_base_value numeric`. Keep `quantity`, `fiat_value`, `fee_amount` for back-compat; new code reads new columns, falls back to old.
- Backfill: `base_value = fiat_value`, `base_currency = profiles.currency`, `asset_price = fiat_value / NULLIF(quantity,0)`, `asset_currency = base_currency`.
- Update `recompute_account_balance` to prefer `base_value` when present.

**1c. Centralized calculation engine**
- New `src/lib/ledger-engine.ts`: pure functions taking `transactions[] + accounts[] + assets[] + fxRates + baseCurrency` → derived holdings, balances, P&L, net worth, allocation. Decimal-safe via a tiny `Dec` wrapper (string-based) for sums; `Number` only at format boundaries.
- Refactor `use-portfolio.ts`, `use-ledger.ts`, `use-positions.ts` to call the engine — no inline aggregations elsewhere.
- Fix: transfer double-count, missing `user_id` filter, UTC day grouping (`date_trunc('day', execution_timestamp AT TIME ZONE 'UTC')`), rounding drift.

**1d. Reconciliation**
- Extend `/dev-tools` with a "Verify integrity" action: compares `accounts.current_balance` vs engine-recomputed balance, lists drift, offers one-click reconcile (calls `recompute_account_balance` per account).

---

## Phase 2 — Universal CRUD + Inline Entity Creation

**2a. Inline create-in-place**
- New `<InlineCreatePicker>` primitive wrapping `Select` with a "+ Create new" footer item that opens a nested `Modal` (modal-in-modal supported — already used in `AccountPicker`). Generalize the AccountPicker pattern to: `AssetPicker`, `TagPicker` (new), `GoalPicker` (new), `CategoryPicker` (new).
- After create: optimistic insert via `useUserTable`, auto-select new id, preserve parent form state (no remount).
- Apply across `TransactionModal`, `HoldingActionModal`, buy/transfer flows.

**2b. Full edit/delete coverage**
- Audit every entity (`accounts`, `assets`, `goals`, `transactions`, `tags`, notes). For each missing edit path: add edit modal reusing the create form in "edit" mode.
- Soft delete: add `archived_at` where missing (accounts has it; add to `assets`, `goals`). Hard delete only for transactions (with confirm + undo toast via sonner, 5s window using cached row).
- "Correct transaction" flow: edit modal pre-fills, on save runs as UPDATE (trigger re-recomputes balances).

---

## Phase 3 — Trading Workspace Unification

- Merge `/trading-capital`, `/journal`, weekly reports into single `/trading` route with tabs: **Overview · Weekly · Journal · Calendar**.
- Shared header: broker account selector, equity curve, current week P&L, drawdown, consistency score.
- Keep old routes as redirects for 1 release so deep links don't break.
- Weekly report remains the primary entry; trade-by-trade is secondary.

---

## Phase 4 — Goals Engine

- Extend `goals` with: `contribution_frequency`, `contribution_amount`, `linked_account_id`, `linked_asset_id` (some exist).
- `src/lib/goals-engine.ts`: auto-progress from linked account/asset balance; projection = `(target - current) / contribution_per_period` → ETA date; milestone markers at 25/50/75%.
- Contribution history derived from transactions tagged to goal (new optional `goal_id` on transactions, or via tag).
- Goals page: progress timeline chart, projection card, milestone list.

---

## Phase 5 — UX Consistency & Performance Pass

- Spacing/typography audit using existing tokens in `src/styles.css`; no new design language.
- Dedupe buttons, normalize modal headers (`PageHeader`-style), consistent naming (Account vs Wallet → pick one per surface).
- Realtime: consolidate channel subscriptions in `realtime-store.ts`, single channel per table, reference-counted teardown.
- Cache: standardize React Query keys `[table, userId, ...filters]`; invalidate engine-derived queries on any transaction mutation.
- Timezone: all display via `formatInTimeZone(user.timezone)`, all grouping in UTC.

---

## Technical notes

- Migrations are additive in Phase 1 — no data loss, old code keeps working during rollout.
- New engine is pure & unit-testable; I'll add `src/lib/__tests__/ledger-engine.test.ts` with synthetic ledgers covering: buy, sell, transfer, fee, multi-currency, dividend, reconciliation drift.
- No UI redesign. No module removal. Trading consolidation is a route-level merge of existing components, not a rebuild.
- FX rates seeded from a free source on demand (manual entry in dev-tools for now; live fetch can be added later as a server fn — out of scope for this pass).

---

## Deliverable cadence

I'll start with **Phase 1** end-to-end (migration + engine + reconciliation + dev-tools verify), then stop and let you validate against your real data before moving to Phase 2. Each subsequent phase same pattern.

**Confirm to start Phase 1**, or tell me to re-scope / re-order.
