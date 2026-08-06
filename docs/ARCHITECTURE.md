# Target Architecture

**Status:** rebuild target; legacy code is not yet migrated to this structure

## 1. Dependency direction

```text
routes and feature UI
→ application commands, queries and view models
→ pure financial domain
→ repository interfaces
→ Supabase adapters
→ PostgreSQL and RLS
```

Dependencies point inward. The financial domain must not import React, TanStack, Supabase, browser storage or environment configuration.

## 2. Proposed source structure

```text
src/
  domain/
    core/
    accounts/
    assets/
    ledger/
    valuation/
    trading/
  application/
    commands/
    queries/
    imports/
    ports/
    view-models/
  data/
    supabase/
    local/
    query-keys/
  features/
    dashboard/
    portfolio/
    accounts/
    transactions/
    calendar/
    import/
    trading/
    goals/
    settings/
  components/
    ui/
    finance/
    shell/
  routes/
```

This is a direction, not authorization for a broad one-shot move. Each phase must establish the target incrementally with focused diffs.

## 3. Canonical financial model

The target canonical records are:

- accounts;
- assets;
- transactions;
- transaction legs;
- market prices and FX rates;
- import batches and receipts;
- trading weeks and entries;
- user preferences.

A transaction carries audit metadata and status. Signed transaction legs express the actual movement of assets between accounts. Derived balances, holdings and performance are computed from the ledger.

Stored account balances, per-module holdings and snapshots must not compete as independent sources of truth.

## 4. Calculation rules

- Use decimal-safe arithmetic for canonical quantities and money.
- Preserve the distinction between zero and unknown valuation.
- Expose known subtotal plus completeness where some legs lack price or FX data.
- Reject structurally invalid transactions at the domain boundary.
- Keep posted transactions immutable.
- Make void and replacement behavior explicit and auditable.
- Do not silently infer FX 1:1 when a rate is missing.

## 5. Application layer

Application commands coordinate use cases such as:

- create account or asset;
- post, void or replace a transaction;
- import a validated batch;
- update market data;
- save a trading week;
- create and restore a backup.

Application queries build route-ready view models. UI components should not duplicate financial calculations.

## 6. Persistence boundaries

Repository interfaces belong to the application layer. Supabase adapters implement those interfaces and are the only layer that knows table and RPC details.

Multi-record operations that must be atomic use database transactions or reviewed RPC functions. Frontend loops of independent writes are not acceptable for financial commits.

## 7. Supabase strategy

- Develop schema changes as versioned migrations.
- Validate against a local or isolated Supabase project.
- Enable RLS for all exposed user-owned tables.
- Test positive and negative access paths.
- Use composite ownership constraints where cross-user references are possible.
- Keep `service_role` server-only.
- Activate Realtime only for a demonstrated workflow.

Legacy migrations remain frozen until an explicit migration map is approved.

## 8. Routing and state

Meaningful filters, date ranges and selected views belong in the URL when they must survive refresh, Back, Forward or sharing. Server/cache state uses TanStack Query. Short-lived interaction state may use component state or a focused store.

Avoid one global store that duplicates query data.

## 9. Error handling

- Domain errors are typed and user-translatable.
- Repository errors preserve cause and operation context without exposing secrets.
- Dialog errors remain inside the relevant dialog and are announced accessibly.
- Destructive actions require explicit confirmation and recoverable failure behavior.

## 10. Verification

Each implementation phase must define:

- unit tests for domain invariants;
- repository/integration tests where persistence changes;
- RLS tests for authorization changes;
- route and E2E tests for critical user workflows;
- manual viewport, keyboard and reduced-motion checks.
