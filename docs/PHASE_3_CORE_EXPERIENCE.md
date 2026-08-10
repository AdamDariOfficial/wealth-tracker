# Phase 3 - Core Experience

**Status:** implementation complete; final integration evidence is tracked separately; merge pending

**Baseline:** `main@186007236aa6093ca85070bdb24f60c7b0cee352`

## 1. Objective

Replace the legacy primary wealth flows with one mobile-first experience backed by the Phase 2 v2 financial boundary. Phase 3 is intentionally consolidated: shell, onboarding, Dashboard, Portfolio, Accounts, account detail, Transactions, Settings and the core composer move together so users do not cross between competing financial models during normal core usage.

Phase 3 does not migrate legacy production data and does not apply any remote Supabase migration.

## 2. Architecture

The core UI reads through:

```text
routes / features
-> TanStack Query
-> application view models and validated services
-> FinancialRepository
-> SupabaseV2FinancialRepository
-> v2 RPCs / RLS
```

Canonical calculations remain in the Phase 1 domain. The new UI does not read financial totals from legacy tables, `current_balance`, snapshots or per-module holdings.

`buildWealthOverview()` consumes `ValidatedFinancialState`, values the ledger with `valueLedger()` and produces route-ready account, position, allocation and immutable transaction views.

## 3. Mobile-first shell

Authenticated mobile navigation is:

- Dashboard;
- Portfolio;
- Add;
- Calendar;
- More.

`More` exposes Accounts, Transactions, Import, Trading, Goals and Settings. Desktop keeps the same information architecture in a restrained sidebar.

The global Add action opens the v2 Core Composer rather than the legacy transaction modal.

## 4. Canonical Portfolio

The existing `/investments` path becomes the canonical Portfolio route to preserve route compatibility without introducing a second route topology during this phase.

Portfolio supports views for:

- all positions;
- fiat;
- ETF;
- crypto;
- equity;
- fund;
- commodity;
- other.

Legacy `/etf`, `/crypto` and `/cash` routes redirect into the corresponding Portfolio view. They no longer host independent accounting surfaces.

Known values and incomplete valuation remain explicit. Missing market price or FX data is displayed as unknown, never converted to zero.

## 5. Accounts

Accounts read from the v2 dataset and display ledger-derived balances. Creating and archiving/restoring accounts uses `putValidatedAccount()` and the repository RPC boundary.

Account detail derives balances from `LedgerSnapshot.balancesForAccount()` and lists immutable transactions touching the account. No stored current balance is treated as canonical.

## 6. Transactions

The Transactions route is a mobile-safe card/list view over immutable Phase 1 transactions.

The Core Composer exposes a generic signed-leg editor. Every asset must balance independently to zero before submit. `LedgerTransaction.create()` and `postValidatedTransaction()` validate again before persistence; PostgreSQL validates critical invariants again inside the v2 RPC.

Posted standard transactions are not edited or deleted. A valid active standard transaction can be voided only after explicit user confirmation, by `LedgerTransaction.createReversal()` followed by `postValidatedTransaction()`.

CSV export serializes exact canonical string quantities.

## 7. Assets and market data

The Core Composer also supports:

- account creation;
- asset creation;
- manual price observations;
- manual FX observations.

These operations use Phase 2 application services and RPC adapters. Market observations are append-only.

## 8. Onboarding and authentication

Supabase Auth remains the authentication mechanism already present in the repository.

Protected profile reads move from the legacy `profiles` table to the v2 repository. Canonical onboarding now writes only the Phase 2 profile contract:

- display name;
- base currency;
- locale;
- onboarded state.

Legacy onboarding writes to `onboarding_data`, legacy `profiles` and `trading_account` are removed from the core onboarding route. Settings also edits the canonical v2 profile instead of legacy profile tables. Advanced investing/trading preferences and backup/restore/reset remain future feature concerns rather than authentication prerequisites.

## 9. Settings and compatibility boundaries

Settings exposes only the canonical profile values required by the rebuilt financial core: display name, base currency and locale. Legacy profile, onboarding-data and raw export/reset writes are not reused. Data management remains explicitly gated for Phase 4, where backup and restore can validate schema and global invariants before replacing data.

`useAuth()` retains read-only legacy field aliases derived from the canonical v2 profile so untouched later-phase routes do not break merely because the profile shape changed. The aliases do not reintroduce legacy profile persistence.

## 10. Compatibility and legacy boundaries

Phase 3 intentionally leaves Phase 4 routes available but does not certify their legacy financial internals as canonical. The primary Phase 3 flows do not depend on those legacy modules.

The old global transaction modal is removed from the authenticated shell and command palette. Existing legacy components may remain in the repository as historical/reference code until their owning later phase replaces or removes them.

## 11. Editing, URL state and session isolation

Meaningful Phase 3 interaction state is recoverable through the URL where it affects navigation: Portfolio filters and selected asset, Accounts search/archive visibility, account editing, and Transactions search/state filters. Direct URL, refresh, Back and Forward must preserve those states.

Account and asset updates reuse the existing canonical IDs and pass through `putValidatedAccount()` / `putValidatedAsset()`. When an asset already has ledger history, the editor locks kind and fiat identity rather than inviting an update that the canonical persistence boundary will reject.

The financial TanStack Query key is scoped by authenticated `user.id`. Sign-out removes the entire v2 financial query family, and an asynchronous profile refresh checks that the session user is still the same before publishing profile state. This prevents a preceding user session from becoming visible in a following session through client cache or stale async completion.

Reversal creation is exposed as an application command rather than a UI timestamp workaround. It preserves the original economic timestamp and chooses a recording time strictly later than the target before the transaction is validated and persisted.

## 12. Explicit exclusions

Phase 3 does not:

- modify Phase 1 financial-domain invariants;
- modify the Phase 2 schema, migrations, RLS or RPC implementations;
- run a local or remote migration automatically;
- migrate or backfill legacy financial records;
- rebuild Calendar, Import, Trading, Goals, backup or restore;
- add dependencies or change the lockfile;
- stage, commit, push, open a pull request or deploy.

## 13. Acceptance criteria

- mobile primary navigation matches the approved information architecture;
- desktop navigation exposes the same core hierarchy;
- core Add actions use the v2 composer, not the legacy transaction modal;
- Dashboard reads only the validated v2 financial state for financial data;
- Portfolio is one canonical route with asset-class filters;
- `/etf`, `/crypto` and `/cash` converge on Portfolio;
- Accounts and account detail derive balances from `LedgerSnapshot`;
- Transactions are immutable, void requires explicit confirmation, and corrections use reversal semantics;
- unknown valuations remain distinguishable from zero;
- profile/onboarding and canonical Settings use the v2 repository boundary;
- core UI contains no new raw Supabase financial-table queries;
- 320-430 px layouts have no intended horizontal overflow and primary controls meet the touch baseline;
- direct URLs, refresh, Back and Forward remain functional;
- route changes start at the top without smooth scrolling;
- Phase 3 sheets, dialogs and page-header reveals respect `prefers-reduced-motion`;
- command palette and composer overlays expose accessible titles/descriptions and keyboard dismissal;
- no dependency, schema, RLS or remote migration change occurs.

## 14. Required verification

Automated repository gate:

```powershell
bun install --frozen-lockfile
bun run format:check:phase3
bun run typecheck
bun run test:phase2
bun run test:features
bun run lint:phase3
bun run build
git diff --check
git diff --cached --check
```

The validator must also scan untracked text payload files for whitespace errors.

Manual browser gate:

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

Verify navigation, composer keyboard behavior, safe areas, direct URLs, refresh, Back/Forward, empty/error/partial-valuation states, long financial values, focus visibility and reduced motion.

Backend gate: run Phase 3 against a local or isolated Supabase environment where the Phase 2 v2 migration has been applied and the Phase 2 database/RLS suite passes. A remote/production migration remains separately gated and is not authorized by this package.
