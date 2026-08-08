# Phase 1 - Financial Domain

**Status:** consolidated pure-domain implementation

**Baseline:** `main@a8992a8bbe07af1647a45f93f545ad2f70d41dfa`

## 1. Objective

Complete the pure financial domain in one coherent implementation after the Phase 1A decimal and money foundation.

This phase defines account and asset identities, immutable balanced transactions, correction flows, deterministic ledger replay and valuation completeness. It does not connect the new domain to Supabase or the legacy UI.

## 2. Source boundary

```text
src/domain/
  accounts/
  assets/
  core/
  ledger/
  valuation/
```

The domain imports no React, TanStack, Supabase, browser storage, environment configuration or legacy hook types.

## 3. Identity and time

`EntityId<TKind>` validates safe stable identifiers while preserving compile-time entity kinds.

`UtcTimestamp` accepts only ISO-8601 instants with an explicit UTC marker or offset. Values are normalized to canonical UTC and invalid calendar dates are rejected.

## 4. Accounts

Accounts define:

- stable identity and trimmed name;
- operational kind;
- owned, external or system ownership;
- explicit net-worth inclusion;
- optional opening and archive timestamps.

External and system accounts cannot enter net worth. External kind and ownership must match. Income, expense and equity accounts use system ownership.

External and system accounts provide the counter-entries required for balanced transactions without pretending that money or assets appear from nowhere.

## 5. Assets

Assets define:

- stable identity;
- normalized symbol and name;
- fiat, crypto, equity, ETF, fund, commodity or other kind;
- supported decimal precision;
- explicit currency identity for fiat assets.

Fiat symbols must match their three-letter currency code. Non-fiat assets cannot carry fiat identity metadata.

## 6. Transactions and legs

Every transaction is immutable and contains at least two non-zero legs.

Each leg identifies:

- one account;
- one asset;
- one signed decimal quantity;
- an optional memo.

A transaction must balance to zero independently for every asset. A trade therefore moves both the purchased asset and the consideration asset between owned and balancing accounts.

Duplicate leg IDs and duplicate account-asset pairs inside one transaction are rejected.

## 7. Corrections

Posted transaction data is not edited in place.

A reversal:

- references one standard transaction;
- contains the exact inverse of every original leg;
- uses new transaction and leg IDs;
- preserves the original economic timestamp;
- must be recorded after the original transaction.

A replacement:

- references the same standard transaction directly, never another correction;
- is accepted only when an exact reversal of that original also exists;
- must be recorded strictly after the reversal.

The ledger derives active, voided, replaced, reversal and replacement audit states from immutable records.

## 8. Ledger replay

Replay validates the full dataset before deriving balances:

- account, asset, transaction and leg IDs are unique;
- every leg references an existing account and asset;
- quantities respect asset precision;
- transaction dates respect account lifecycle boundaries;
- correction relationships are valid and unambiguous;
- reversals exactly negate their targets.

Transactions are ordered deterministically by economic time, recorded time and ID. Balances are derived only from the transaction legs; no stored account total competes with the ledger.

Zero balances are removed from the materialized snapshot while direct balance queries still return exact zero.

## 9. Market data and valuation

`PriceQuote` stores a timestamped unit price as `Money`.

`FxRate` stores a timestamped positive conversion rate. Direct rates are preferred; a known inverse pair may be inverted explicitly with the configured scale and rounding mode.

Valuation:

- treats fiat assets as one unit of their declared currency and rejects fiat price quotes;
- selects the latest non-conflicting price and FX observations;
- values only accounts explicitly included in net worth;
- preserves negative balances for liabilities;
- returns known positions and explicit unknown reasons;
- distinguishes missing price from missing FX;
- returns a known subtotal even when the total is incomplete;
- never treats unknown valuation as zero.

Calculations use `Decimal` and `Money` at an explicit scale with an explicit rounding mode.

## 10. Explicit exclusions

Phase 1 does not:

- modify legacy financial helpers or the legacy ledger engine;
- wire domain models into routes or components;
- define Supabase tables, adapters, RLS policies or migrations;
- import or migrate existing user data;
- calculate tax lots or realized performance policy;
- implement bulk import, backup, restore or trading persistence;
- change dependencies or `bun.lock`;
- deploy or publish the application.

Those responsibilities begin in later architecture phases and must consume this domain instead of recreating financial rules in UI or persistence code.

## 11. Acceptance criteria

- all Phase 1 source remains under `src/domain/`;
- canonical quantities never use JavaScript floating-point arithmetic;
- transactions balance by asset;
- correction records remain immutable and auditable;
- replay derives deterministic balances and audit states;
- unknown valuation remains distinct from zero;
- known partial totals remain available;
- focused domain tests pass;
- scoped Prettier and ESLint pass;
- TypeScript and production build pass;
- no dependency, lockfile, schema, migration or deployment change is included.

## 12. Required verification

```powershell
bun install --frozen-lockfile
bun run check:domain
bun run build
git diff --check
git diff --cached --check
```

Global legacy formatting and lint failures must remain separately recorded. Browser, backend, database, staging and production checks are outside Phase 1.
