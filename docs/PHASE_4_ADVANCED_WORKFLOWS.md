# Phase 4 - Advanced Workflows

**Status:** implementation complete; repository, local database and manual QA gates validated

**Baseline:** `main@9ad098cf08c02e71d53eb1854b3ed92e6deae2ee`

**Working branch:** `rebuild/phase-4-advanced-workflows`

## 1. Objective

Move every advanced workflow left outside the Phase 3 certification boundary onto the canonical v2 architecture in one coherent Phase 4 integration: Calendar, Goals, Trading, bulk Import with receipt and rollback, plus backup, restore and reset.

The legacy implementation remains product evidence only. Phase 4 must not preserve legacy persistence patterns that duplicate balances, progress or financial totals.

## 2. Consolidated delivery rule

Phase 4 is reviewed and integrated as one branch and one pull request. Internal workstreams may be developed separately for reasoning and validation, but Calendar, Goals, Trading, Import and Data Management do not receive independent merge gates.

The branch begins from the already validated Calendar checkpoint and finishes only after the complete Phase 4 repository, local-database and browser matrices are satisfied.

## 3. Canonical data model

Phase 4 keeps the Phase 2 financial ledger authoritative and adds only workflow records that cannot be derived from it.

Additive v2 persistence introduces:

- `v2_goals` for targets and entity references only;
- `v2_trading_settings` for risk preferences only;
- `v2_weekly_reviews` for weekly journal/performance metadata;
- `v2_import_batches` for immutable import receipts;
- `v2_import_batch_transactions` for normalized receipt membership.

It does not store a second account balance, holding, net worth, goal progress or trading-capital total.

All five new user-owned tables:

- enable and force RLS;
- scope SELECT to `auth.uid()`;
- expose no direct authenticated INSERT/UPDATE/DELETE privilege;
- use reviewed RPCs for writes;
- include user ownership in cross-table foreign keys;
- participate in the same per-user transaction-scoped advisory lock used by Phase 2 writes.

Canonical numeric values cross the browser/database boundary as exact decimal strings.

## 4. Calendar

Calendar derives current corrected economic history from `ValidatedFinancialState` and the Phase 1 ledger.

For each cutoff:

1. transactions before the cutoff are replayed through the canonical ledger;
2. only price and FX observations available before that cutoff are supplied to `valueLedger()`;
3. known subtotal and valuation completeness remain distinct;
4. unknown positions never become zero;
5. reversal/replacement audit state comes from the validated ledger.

Year, Quarter, Month, Week and Day views remain URL-backed. The Month surface may use a local horizontal scroll at narrow widths so every day remains a touch-safe target without creating page-level horizontal overflow.

Phase 4 intentionally does not invent legacy transaction-type analytics that are not represented by an approved v2 semantic taxonomy.

## 5. Goals

Supported goal kinds are:

- `net_worth`;
- `liquid`;
- `account_balance`;
- `asset_quantity`;
- `asset_value`.

Goals persist targets only. Current progress derives from the canonical ledger and valuation layer on every read.

Rules include:

- account goals reference an existing owned account;
- asset goals reference an existing asset;
- asset-quantity target scale cannot exceed the referenced asset precision;
- value-based goals preserve partial/unknown valuation state instead of substituting zero;
- archival is explicit and does not mutate historical financial records.

The legacy `custom` goal kind is not carried forward because it requires a competing manually stored progress value.

## 6. Trading weekly workspace

Trading capital derives from canonical positions held in owned broker, exchange and investment accounts.

Phase 4 stores only:

- reserve and risk-percentage preferences;
- optional primary trading asset label;
- weekly review metadata such as reported P&L, win rate, R:R, drawdown, trade count, discipline, psychology, notes and lessons.

Reported weekly P&L is journal metadata. Saving a review never silently posts a financial transaction or changes ledger balances.

Draft reviews may be edited or deleted. Finalization is one-way and the database prevents later mutation of finalized reviews.

## 7. Bulk Import

The canonical import format is strict ledger CSV with the exact header:

```text
transaction_id,leg_id,occurred_at,recorded_at,description,account_id,asset_id,quantity,memo
```

Rows sharing `transaction_id` describe one standard ledger transaction. Import does not infer accounts, assets, transaction types, FX or missing balancing legs.

Before commit the application validates:

- CSV structure and row count;
- canonical entity IDs;
- explicit ISO-8601 instants;
- account and asset references;
- exact decimal syntax and asset precision through the domain;
- duplicate transaction and leg IDs;
- transaction balancing;
- complete ledger replay with the proposed batch.

The database re-validates the transactions. `v2_import_batch` commits the receipt and every transaction in one PostgreSQL transaction. Any invalid row leaves no receipt and no partial financial commit.

Rollback is audit-safe: it creates exact reversal transactions for every imported transaction and then marks the receipt rolled back. It never deletes posted history. If any imported transaction can no longer be reversed safely, the whole rollback fails without partial reversals.

## 8. Backup, restore and reset

Backup schema version `1` exports the complete canonical profile, financial state and advanced state.

Restore:

- requires a supported versioned envelope;
- runs under the authenticated user's per-user write lock;
- validates every restored account, asset, transaction, market observation and advanced record through reviewed v2 invariants;
- replaces the workspace only inside one database transaction;
- rolls back to the previous dataset if any restored record fails;
- uses a transaction-local maintenance flag only inside the reviewed restore/reset RPC so immutable-history triggers cannot be bypassed by browser table writes.

Reset requires the exact confirmation `RESET WORKSPACE`, preserves `v2_profiles`, and removes canonical workspace and advanced-workflow data atomically.

## 9. Legacy debt explicitly removed from canonical routes

The rebuilt `/calendar`, `/goals`, `/trading`, `/import` and Data Management surfaces must not use:

- legacy `use-ledger` / holdings hooks;
- `useUserTable` for canonical workflow persistence;
- raw component-level Supabase `.from(...)` writes;
- legacy stored `current_balance`, `current_amount` or module holdings as a financial source of truth;
- JavaScript `number` for canonical money, quantity, price or FX values.

Presentation-only geometry and integer metadata may use native numbers after the canonical decimal calculation is complete.

## 10. Acceptance criteria

Phase 4 is ready for integration only when all of the following are directly evidenced:

- Calendar, Goals, Trading, Import and Data Management use reviewed v2 boundaries with no legacy fallback;
- canonical financial values remain exact decimal strings / `Decimal` / `Money`;
- Goals progress and Trading capital derive from the one ledger;
- finalized weekly reviews are immutable;
- import preview exposes row-level errors and commit is atomic;
- import rollback creates immutable corrections and is all-or-none;
- backup round-trip preserves the complete canonical dataset;
- invalid restore leaves the previous workspace unchanged;
- reset requires explicit destructive confirmation and preserves the profile;
- every new user-owned table has forced RLS and user isolation tests;
- Phase 1-3 regression tests still pass;
- 320-430 px mobile controls meet the 44 px touch baseline and no page-level horizontal overflow is introduced;
- URL/refresh/Back/Forward behavior remains valid on route state;
- reduced-motion behavior remains respected;
- no dependency or lockfile change is introduced without a separate documented need.

## 11. Required repository verification

The Controlled Change Package runs scoped checks against the exact Phase 4 allowlist:

```text
frozen Bun install
scoped Prettier check
TypeScript
Phase 3 regression suite
all tests/phase4
scoped ESLint
production build
generated route-tree reconciliation
staged / unstaged / untracked whitespace
final exact workspace invariant
```

Automated repository validation does not execute a database reset or migration.

## 12. Required local database gate

A separate validator requires explicit `-AllowLocalDatabaseReset` and must target only the local Supabase environment.

It performs:

```text
supabase db reset --local
Phase 2 pgTAP regression
Phase 4 schema / RLS pgTAP
Phase 4 workflow / atomicity pgTAP
```

A successful local database gate does not authorize a remote migration.

## 13. Required browser gate

Verify at minimum:

```text
320 x 568
375 x 812
390 x 844
430 x 932
768 x 1024
1024 x 768
1440 x 900
1600 x 1000
```

Critical manual flows:

- Calendar scope/period/URL state, partial valuation and narrow Month scrolling;
- Goal create/edit/archive plus unknown and exact-quantity progress;
- Trading risk settings, weekly draft edit/delete and irreversible finalization;
- valid Import preview/commit/receipt/rollback and invalid-batch rejection;
- backup export, valid restore round-trip and invalid-restore preservation;
- reset confirmation and profile preservation;
- keyboard focus, reduced motion, mobile touch targets and absence of page-level horizontal overflow;
- user A sign-out -> user B -> sign-out -> user A cache/isolation smoke.

## 14. Explicit exclusions

Phase 4 does not authorize:

- migration of legacy production data;
- remote `supabase db push` or equivalent;
- production deployment;
- service-role credentials in the browser;
- weakening RLS or immutable-history protections;
- automatic stage, commit, push, PR creation, merge or deployment by validators.

Phase 5 remains the separate legacy migration and production-readiness gate.
