# Nebula Wealth Hub

Personal wealth, portfolio and trading tracker undergoing a controlled rebuild.

The application preserves its charcoal-and-cyan visual identity while replacing the legacy financial domain, persistence boundaries and primary flows with a mobile-first architecture.

## Current status

```text
PHASE_0_REPOSITORY_FOUNDATION_MERGED
PHASE_1_FINANCIAL_DOMAIN_IMPLEMENTED
PHASE_2_SUPABASE_V2_FOUNDATION_MERGED_AND_LOCALLY_VALIDATED
PHASE_3_CORE_EXPERIENCE_IMPLEMENTED_PENDING_MERGE
LEGACY_APPLICATION_PRESERVED_AS_REFERENCE_OUTSIDE_MIGRATED_FLOWS
NO_PRODUCTION_DATA_MIGRATION_AUTHORIZED
NO_REMOTE_V2_MIGRATION_AUTHORIZED
```

The additive v2 schema, RLS model and repository boundary are versioned in the repository. Phase 3 moves the primary application flows onto that boundary. Legacy records remain historical input until the Phase 5 migration plan is separately approved and validated.

## Product direction

The rebuilt application covers:

- dashboard and net-worth reporting;
- one portfolio across asset classes;
- accounts and liquidity;
- immutable financial transactions;
- calendar and historical analysis;
- bulk import with preview, receipt and rollback;
- trading capital and weekly reporting;
- goals, backup and restore.

The application is personal software. It must not include Tretnix branding or public attribution to internal production tools.

## Visual baseline

Preserve the established visual DNA:

- near-black charcoal canvas;
- cyan/electric-blue accent;
- Sora, Manrope and JetBrains Mono typography;
- restrained glass surfaces, gradients and glow;
- soft green positive values and soft red negative values;
- rounded cards and institutional fintech density.

Mobile is the primary design surface. See [`docs/VISUAL_SYSTEM.md`](docs/VISUAL_SYSTEM.md).

## Architecture direction

```text
UI and route features
-> application commands, queries and view models
-> pure financial domain
-> repository interfaces
-> Supabase adapters
-> PostgreSQL with RLS
```

Supabase remains the persistence infrastructure, but canonical financial logic is independent from Supabase. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

- TanStack Start and TanStack Router;
- React 19 and TypeScript;
- Tailwind CSS 4;
- Radix UI / shadcn primitives;
- TanStack Query and Zustand;
- Recharts and Framer Motion;
- Supabase;
- Vite and Cloudflare tooling.

## Local setup

Requirements:

- Git;
- Bun;
- a Supabase environment appropriate for the flow being tested;
- the Phase 2 v2 schema applied locally or in an isolated project before Phase 3 core-flow QA.

```powershell
git clone https://github.com/AdamDariOfficial/nebula-wealth-hub.git
Set-Location .\nebula-wealth-hub
Copy-Item .env.example .env
bun install --frozen-lockfile
bun run dev
```

Populate `.env` locally. `.env` must remain ignored and untracked.

## Automated checks

```powershell
bun run typecheck
bun run test:domain
bun run test:phase2
bun run build
```

Phase-specific controlled validators add scoped Prettier, ESLint, whitespace and feature tests for their exact allowlists. Global Prettier and ESLint still contain recorded legacy debt outside the rebuilt scope; do not run automatic global cleanup without separate authorization.

## Source-of-truth documents

- [`AGENTS.md`](AGENTS.md): repository working rules;
- [`docs/REBUILD_BASELINE.md`](docs/REBUILD_BASELINE.md): approved objective, phases and exclusions;
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): target boundaries;
- [`docs/VISUAL_SYSTEM.md`](docs/VISUAL_SYSTEM.md): visual identity and responsive rules;
- [`docs/SECURITY.md`](docs/SECURITY.md): environment, Supabase and data-safety requirements;
- [`docs/PHASE_1A_FINANCIAL_VALUES.md`](docs/PHASE_1A_FINANCIAL_VALUES.md): decimal and money foundation;
- [`docs/PHASE_1_FINANCIAL_DOMAIN.md`](docs/PHASE_1_FINANCIAL_DOMAIN.md): pure financial-domain model;
- [`docs/PHASE_2_SUPABASE_V2.md`](docs/PHASE_2_SUPABASE_V2.md): persistence, RLS and repository contract;
- [`docs/PHASE_3_CORE_EXPERIENCE.md`](docs/PHASE_3_CORE_EXPERIENCE.md): mobile shell and canonical core UI contract.

## Safety

Do not enter or migrate real financial data until the relevant v2 schema, RLS, backup/restore and migration gates have been explicitly completed for the target environment. A successful repository build does not authorize a remote database migration or deployment.
