# Phase 2 - Supabase v2 Foundation

**Status:** consolidated persistence foundation

**Baseline:** `main@05d35dffef4307e000c108c1ee49a8c9206d3b23`

## 1. Objective

Establish the complete persistence boundary required by the rebuilt financial domain without migrating legacy production data or wiring the legacy UI directly to the new schema.

Phase 2 introduces an additive `v2_*` schema, strict Row Level Security, atomic financial write RPCs, application repository ports, Supabase adapters and reproducible local database tests.

## 2. Additive schema strategy

Legacy tables and migrations remain frozen historical evidence. Phase 2 does not rename, drop, mutate or backfill legacy financial tables.

New canonical storage uses only:

- `v2_profiles`;
- `v2_accounts`;
- `v2_assets`;
- `v2_transactions`;
- `v2_transaction_legs`;
- `v2_price_quotes`;
- `v2_fx_rates`.

Every user-owned table carries `user_id uuid`. Account, asset and transaction identifiers remain domain text identifiers and use composite ownership keys `(user_id, id)`.

Cross-table foreign keys always include `user_id`, preventing one user's transaction or market record from referencing another user's entities even if text IDs collide.

## 3. Stable authenticated identity and onboarding

The stable identity is `auth.users.id` / `auth.uid()`.

`v2_profiles.user_id` is the same UUID and is created automatically for new auth users. The migration also backfills a profile shell for users already present in `auth.users` without importing any legacy financial record.

An incomplete profile may have no base currency or locale. `onboarded = true` requires both. The onboarding RPC never accepts a user ID; it updates only the row identified by `auth.uid()`.

## 4. RLS and direct table access

All seven v2 tables enable and force RLS.

Authenticated clients receive direct `SELECT` only for their own rows. Direct `INSERT`, `UPDATE` and `DELETE` privileges are not granted on financial tables.

Writes use reviewed RPC functions. Security-definer functions:

- require a non-null `auth.uid()`;
- never accept `user_id` as an argument;
- set `search_path = public, pg_temp`;
- derive ownership from `auth.uid()`;
- fail closed on invalid references or financial invariants.

`anon` receives no v2 table or RPC access.

## 5. Decimal-safe persistence

PostgreSQL stores canonical quantities, prices and FX rates as `numeric` with checks limiting scale to 18 fractional digits.

The browser adapter never consumes JSON numeric values for canonical decimals. The read RPC casts all canonical numeric values to text before building JSON, and all write RPCs accept decimal literals as strings before explicit PostgreSQL `numeric` casts.

This preserves values beyond JavaScript's safe integer range.

## 6. Atomic transactions and correction safety

`v2_post_transaction(jsonb)` is the only authenticated transaction-write path.

Before inserting any row it validates:

- transaction and leg identifier syntax;
- description and memo boundaries;
- purpose and related-transaction rules;
- `recordedAt >= occurredAt`;
- at least two non-zero legs;
- globally unique leg IDs per user;
- one leg per account/asset pair inside a transaction;
- existing same-user accounts and assets;
- asset precision;
- account lifecycle boundaries;
- zero balance independently for every asset;
- reversal target, timing and exact inverse legs;
- replacement target, reversal requirement and ordering.

The function inserts the transaction and all legs in one PostgreSQL transaction. Any failure leaves no partial financial commit.

Every authenticated v2 write RPC acquires the same transaction-scoped advisory lock for the current `auth.uid()`. Writes for different users remain independent, while writes for one user are serialized across onboarding, account/asset mutation, transaction posting and market-data append operations. This closes validation/write races such as lowering asset precision while a transaction is being posted or converting an asset to fiat while a price quote is being appended.

Unique partial indexes still enforce at most one reversal and one replacement for each target as structural database constraints, including under concurrent correction requests.

Posted transactions and transaction legs are additionally protected by immutable-row triggers.

## 7. Accounts, assets and market observations

Account and asset writes also use RPCs so ownership and dataset constraints cannot be bypassed through ad-hoc client queries.

Account lifecycle changes are rejected when they would place an existing transaction outside the proposed opening/archive interval.

Asset precision cannot be reduced below persisted transaction quantities. Structural fiat metadata cannot be changed after the asset has ledger activity, and fiat assets cannot receive price quotes.

Price quotes and FX rates are append-only observations. Equal-timestamp duplicates are rejected so Phase 1's conflicting-observation rules cannot be hidden by persistence.

## 8. Application and data boundaries

Phase 2 adds:

```text
src/application/
  auth/
  profile/
  ports/
  services/

src/data/supabase/v2/
  dto.ts
  repository.ts
  transport.ts
```

Application code depends on repository ports and Phase 1 domain types, not on Supabase.

The Supabase v2 adapter reuses the existing authenticated Supabase runtime client through a narrow transport that exposes only `rpc()` and `auth.getUser()`. It does not modify the legacy generated `src/integrations/supabase/types.ts` and does not create a second auth session.

The adapter validates every RPC response before constructing domain objects.

## 9. Application validation before persistence

Application services replay the complete financial dataset before account, asset or transaction writes. This catches cross-record domain failures before the database call.

The database re-validates critical invariants independently. Client-side validation is therefore not treated as an authorization or integrity boundary.

## 10. Tests

Phase 2 includes three test levels in one change:

1. existing Phase 1 domain tests;
2. Bun application/adapter tests with an isolated fake transport;
3. pgTAP schema and RLS/integration tests under `supabase/tests/phase2/`.

The pgTAP suite verifies all seven v2 RLS read boundaries, cross-user account and asset isolation, direct-write denial, exact transaction/price/FX numeric persistence, account lifecycle and asset-precision mutation guards, atomic rejection of invalid transactions, correction uniqueness and authenticated RPC behavior. Schema tests also assert immutable history triggers, RPC privilege boundaries and the per-user write-serialization lock contract.

## 11. Migration execution boundary

The controlled Apply and repository validator do **not** execute migrations.

`Validate-NebulaPhase2Database.ps1` is a separate explicit local-only gate. It refuses to run without `-AllowLocalDatabaseReset`, requires Docker, and invokes only commands with explicit `--local` targeting.

It may reset the developer's local Supabase database and replay all repository migrations. It never links, pushes, resets or tests a remote Supabase project.

No production or remote migration is authorized by Phase 2 preparation or validation.

## 12. Acceptance criteria

- Phase 1 domain remains unchanged;
- legacy schema remains unchanged;
- v2 schema is additive and versioned;
- all exposed v2 user tables have RLS and same-user policies;
- composite ownership foreign keys prevent cross-user references;
- transaction writes are atomic and immutable;
- canonical decimals cross the PostgREST boundary as strings;
- application repository interfaces contain no Supabase dependency;
- Supabase access is confined to the v2 adapter/transport;
- scoped TypeScript formatting, typecheck, tests and ESLint pass;
- production build passes;
- local migration reset and pgTAP RLS tests pass before commit;
- no remote migration, legacy-data migration or deployment occurs.

## 13. Required verification

Repository gate:

```powershell
bun install --frozen-lockfile
bun run check:phase2
bun run build
git diff --check
git diff --cached --check
```

Explicit local database gate:

```powershell
.\Validate-NebulaPhase2Database.ps1 -RepoPath <repo> -AllowLocalDatabaseReset
```

Browser, staging, production and legacy-data migration checks remain outside Phase 2.
