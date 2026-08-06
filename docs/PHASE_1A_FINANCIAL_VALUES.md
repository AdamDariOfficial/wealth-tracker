# Phase 1A - Financial Value Types

**Status:** first functional rebuild slice

**Baseline:** `main@093fb38d44b74aef5559e757c71eef4b673b46fe`

## 1. Objective

Establish the pure numeric foundation required by the rebuilt ledger without changing routes, UI, Supabase, migrations or legacy financial behavior.

This slice introduces immutable decimal and money value objects that do not use JavaScript `number` for canonical financial storage or arithmetic.

## 2. Scope

- strict decimal parsing from strings;
- safe construction from `bigint` and safe integers;
- exact addition, subtraction and supported-scale multiplication;
- division and quantization with explicit scale and rounding mode;
- fixed-scale string formatting without conversion to `number`;
- three-letter currency codes;
- same-currency money arithmetic;
- explicit FX conversion through a provided rate, target currency, scale and rounding mode;
- typed domain errors;
- focused Bun unit tests.

## 3. Decisions

### Decimal representation

`Decimal` stores a signed `bigint` coefficient and a scale from 0 to 18. Trailing fractional zeros are normalized, and JSON serialization returns a canonical decimal string.

`Decimal` intentionally has no general `number` constructor. `Decimal.fromInteger(number)` accepts only safe integers. Values received from forms, APIs or PostgreSQL numeric columns must enter the domain as strings.

### Rounding

Operations that can lose precision require an explicit rounding mode:

- `toward-zero`;
- `half-up`;
- `half-even`.

Division also requires an explicit result scale. The domain must not hide division by zero, unsupported scale or unsafe-number input by returning zero.

### Money

`Money` combines a `Decimal` amount with a normalized three-letter `CurrencyCode`. Addition, subtraction and comparison reject currency mismatches.

Currency conversion is not implicit. It requires:

- an explicit positive decimal rate;
- an explicit target currency;
- an explicit result scale;
- an explicit rounding mode.

This slice does not define market-price provenance, FX timestamps, currency minor-unit metadata or valuation completeness. Those belong to subsequent Phase 1 slices.

## 4. New source boundary

```text
src/domain/core/
  decimal.ts
  domain-error.ts
  index.ts
  money.ts
```

The new domain files import no React, TanStack, Supabase, browser API, environment configuration or legacy hook type.

## 5. Explicit exclusions

This slice does not:

- replace `src/lib/decimal.ts` or the legacy ledger engine;
- wire new values into routes or components;
- change account, asset, transaction or transaction-leg models;
- change database schema, migrations, RLS or remote data;
- introduce a dependency or change `bun.lock`;
- globally format or automatically fix the legacy codebase;
- deploy or migrate data.

The legacy numeric helpers remain untouched as reference until a later controlled integration slice replaces their callers.

## 6. Acceptance criteria

- all changed paths are inside the approved Phase 1A allowlist;
- package dependencies and `bun.lock` remain unchanged;
- scoped Prettier passes;
- TypeScript passes;
- `bun run test:domain` passes;
- scoped ESLint passes for `src/domain/core` and `tests/domain`;
- production build passes;
- any deterministic `src/routeTree.gen.ts` build drift is captured, verified and restored;
- global Prettier and ESLint legacy debt is recorded without hiding failures in changed files;
- no stage, commit, push, migration or deployment is automated.

## 7. Required verification

```powershell
bun install --frozen-lockfile
bunx prettier --check README.md package.json docs/PHASE_1A_FINANCIAL_VALUES.md src/domain/core tests/domain
bun run typecheck
bun run test:domain
bunx eslint src/domain/core tests/domain
bun run format:check
bun run lint
bun run build
git diff --check
git diff --cached --check
```

Browser, backend, database, staging and production validation are not part of Phase 1A.
