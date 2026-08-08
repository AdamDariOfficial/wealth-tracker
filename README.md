# Nebula Wealth Hub

Personal wealth, portfolio and trading tracker undergoing a controlled rebuild.

The current repository contains the legacy application and its visual system. The rebuild preserves the charcoal-and-cyan visual identity while replacing the financial domain, persistence boundaries and application structure with a mobile-first architecture.

## Current status

```text
PHASE_0_REPOSITORY_FOUNDATION_MERGED
PHASE_1_FINANCIAL_DOMAIN_IMPLEMENTED
PHASE_2_SUPABASE_V2_FOUNDATION_NOT_STARTED
LEGACY_APPLICATION_PRESERVED_AS_REFERENCE
NO_PRODUCTION_DATA_MIGRATION_AUTHORIZED
```

The legacy Supabase schema and migrations remain historical input until the new schema, RLS policies and migration path are approved and validated.

## Product direction

The rebuilt application will cover:

- dashboard and net-worth reporting;
- accounts and liquidity;
- portfolio positions and valuation;
- immutable financial transactions;
- calendar and historical analysis;
- bulk import with preview, receipt and rollback;
- trading capital and weekly reporting;
- goals, backup and restore.

The application is personal software. It must not include Tretnix branding or client-product attribution.

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
-> application commands and queries
-> pure financial domain
-> repository interfaces
-> Supabase adapters
-> PostgreSQL with RLS
```

Supabase remains the intended infrastructure, but the financial domain must remain independent from Supabase. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack currently present

- TanStack Start and TanStack Router;
- React 19 and TypeScript;
- Tailwind CSS 4;
- Radix UI / shadcn primitives;
- TanStack Query and Zustand;
- Recharts and Framer Motion;
- Supabase;
- Vite and Cloudflare tooling.

The previous README described Next.js and Vercel, which do not match the checked-in implementation.

## Local setup

Requirements:

- Git;
- Bun;
- a valid Supabase URL and publishable key for the legacy authenticated and data-backed routes;
- a local or isolated Supabase project before future schema work begins.

```powershell
git clone https://github.com/AdamDariOfficial/nebula-wealth-hub.git
Set-Location .\nebula-wealth-hub
Copy-Item .env.example .env
bun install --frozen-lockfile
bun run dev
```

Populate `.env` locally. The Phase 0 change removes `.env` from the tracked repository tree and adds explicit ignore rules; it does not prohibit a local ignored `.env` after the deletion is committed.

## Automated checks

```powershell
bun run format:check
bun run typecheck
bun run test:domain
bun run lint
bun run build
```

`bun run check` is a strict fail-fast aggregate. It stops at the first failed command and is not currently expected to pass on the legacy baseline.

### Known validation state

- `bun install --frozen-lockfile`: passes on the recorded controlled baselines.
- `bun run typecheck`: passes on the Phase 0 and Phase 1A baselines.
- `bun run test:domain`: covers decimal values, money, accounts, assets, transaction legs,
  correction flows, ledger replay and valuation.
- Scoped Prettier and ESLint must pass for every changed domain path.
- Global Prettier and ESLint still contain recorded legacy failures outside the rebuild domain.
- The production build succeeds on the recorded baselines.
- The build deterministically regenerates `src/routeTree.gen.ts`; controlled validation captures,
  verifies and restores that known generated drift when it is outside the approved scope.

Do not run global formatting or automatic lint fixes without a separately approved scope.

## Source-of-truth documents

- [`AGENTS.md`](AGENTS.md): repository working rules;
- [`docs/REBUILD_BASELINE.md`](docs/REBUILD_BASELINE.md): approved objective, phases and exclusions;
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): target boundaries;
- [`docs/VISUAL_SYSTEM.md`](docs/VISUAL_SYSTEM.md): visual identity and responsive rules;
- [`docs/SECURITY.md`](docs/SECURITY.md): environment, Supabase and data-safety requirements;
- [`docs/PHASE_1A_FINANCIAL_VALUES.md`](docs/PHASE_1A_FINANCIAL_VALUES.md): decimal and money foundation;
- [`docs/PHASE_1_FINANCIAL_DOMAIN.md`](docs/PHASE_1_FINANCIAL_DOMAIN.md): complete pure-domain model, ledger and valuation rules.

## Safety

No real financial data should be entered until the new schema, RLS policies, backup/restore flow and migration plan have passed their required automated and manual gates.
