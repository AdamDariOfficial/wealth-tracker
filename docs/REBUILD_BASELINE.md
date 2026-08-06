# Rebuild Baseline

**Status:** Phase 0 repository foundation prepared; functional rebuild not started

**Repository:** `AdamDariOfficial/nebula-wealth-hub`

**Baseline branch:** `main`

**Baseline commit:** `32d4a77665ea12b8e0de91b6ee5333f2701084e1`

**Recorded:** 5 August 2026

**Phase 0 amendment recorded:** 6 August 2026

## 1. Objective

Rebuild the personal wealth tracker from the legacy repository while preserving its visual identity. The target is not a patch series over the existing architecture; it is a controlled replacement of the financial domain, persistence model and primary user flows.

## 2. Confirmed current implementation

The checked-in application uses TanStack Start, React, TypeScript, Tailwind CSS, Radix/shadcn primitives, Recharts, Framer Motion, Zustand, TanStack Query and Supabase.

The previous README described Next.js and Vercel and is therefore historical prompt material rather than implementation truth.

## 3. Preserve

- charcoal/near-black visual canvas;
- cyan accent and restrained glow;
- Sora, Manrope and JetBrains Mono typography;
- premium fintech density;
- useful chart, card and modal presentation patterns;
- intentional positive/negative semantic colors.

Preservation applies to visual identity, not to legacy data flow or component coupling.

## 4. Replace or redesign

- financial calculations and ledger rules;
- database schema and RLS model;
- persistence and query boundaries;
- import, receipt and rollback flows;
- backup and restore;
- account, asset and transaction composition;
- calendar and historical reconstruction;
- trading workspace persistence;
- shell and navigation for mobile-first usage;
- route duplication and legacy module separation.

## 5. Target product navigation

### Mobile primary navigation

- Dashboard
- Portfolio
- Add
- Calendar
- More

### More

- Accounts
- Transactions
- Import
- Trading
- Goals
- Settings

Desktop may expose the same information through a restrained sidebar. ETF, crypto and cash become portfolio views or filters rather than independent accounting engines.

## 6. Delivery phases

### Phase 0 - repository foundation

- remove tracked environment configuration from the repository tree;
- establish repository rules and authoritative documentation;
- record visual and architecture baselines;
- add reproducible quality commands;
- make no functional UI, schema or migration changes.

### Phase 1 - financial domain

- decimal-safe value types;
- account, asset, transaction and transaction-leg models;
- validation and ledger replay;
- valuation completeness and known totals;
- focused unit tests.

### Phase 2 - Supabase v2 foundation

- new versioned schema;
- RLS and cross-user isolation tests;
- repository interfaces and Supabase adapters;
- onboarding and stable authenticated identity.

### Phase 3 - mobile-first shell

- primary mobile navigation;
- responsive desktop shell;
- Dashboard, Portfolio, Accounts and Transactions;
- accessible composer and detail views.

### Phase 4 - advanced workflows

- Calendar;
- bulk Import with receipt and rollback;
- Trading weekly workspace;
- Goals;
- backup, restore and reset.

### Phase 5 - legacy migration and hardening

- export and reconcile legacy data;
- dry-run migration;
- security, accessibility and viewport QA;
- production-readiness gate.

## 7. Phase 0 exclusions

Phase 0 does not authorize:

- edits under `src/` or `supabase/migrations/`;
- remote database changes;
- migration execution;
- dependency installation changes;
- visual redesign;
- deployment;
- commit, push or pull request creation by automation;
- Git-history rewriting.

## 8. Acceptance criteria for Phase 0

- exact baseline commit and branch verified;
- dedicated branch used;
- `.env` absent from the tracked repository tree and covered by explicit ignore rules;
- a local ignored `.env` may be recreated only after the tracked deletion is committed;
- `.env.example` contains placeholders only and no service-role credential;
- README matches the actual stack and rebuild status;
- repository-specific rules and architecture documents exist;
- package dependencies and lockfile remain unchanged;
- formatting, TypeScript, lint and build commands are executed individually and their actual outcomes recorded;
- known global Prettier and ESLint legacy failures are not converted into false success;
- `src/routeTree.gen.ts` build drift is captured, verified and restored because source files are outside Phase 0;
- staged, unstaged and untracked whitespace checks are recorded;
- no source code, migration or deployment change is included.

## 9. Recorded Phase 0 validation state

- frozen install: pass;
- Phase 0 payload formatting: pass required;
- TypeScript: pass;
- production build process: pass;
- global Prettier: legacy baseline failures recorded;
- global ESLint: legacy baseline failures recorded;
- build-generated `src/routeTree.gen.ts`: known deterministic drift, evidence captured and file restored;
- browser, backend, database, staging and production validation: not executed.

## 10. State after Phase 0

A successful controlled validation means only that the repository foundation is mechanically consistent and that known legacy failures are explicitly recorded. Manual amendment review, environment review and the explicit decision to continue to Phase 1 remain separate gates.
