# AGENTS.md

## Project identity

Nebula Wealth Hub is a personal financial tracker. It is independent from Tretnix as a public-facing product.

Do not add:

- Tretnix branding or footer attribution;
- public references to ChatGPT, Lovable, Cursor, Codex or other production tools;
- generic SaaS positioning that changes the personal-product objective.

## Source precedence

Use this order when instructions conflict:

1. approved repository decisions and current task specification;
2. this `AGENTS.md`;
3. versioned documents under `docs/`;
4. behavior confirmed in code and migrations;
5. historical prompts and conversations.

The legacy implementation is evidence, not automatically the target architecture.

## Core objective

Preserve the existing premium charcoal-and-cyan visual identity while rebuilding the application around a correct, testable financial domain and a genuinely mobile-first interface.

## Development constraints

- Never develop directly on `main`.
- Do not edit unrelated files.
- Do not add dependencies without a documented concrete need.
- Do not weaken authentication, authorization or RLS to hide frontend errors.
- Do not run remote migrations, deploy, publish or alter repository visibility without explicit authorization.
- Do not claim tests, builds, browser checks or security reviews succeeded without direct evidence.
- Preserve Back, Forward, refresh and direct URL behavior.
- New routes open at the top without smooth scrolling.
- Respect `prefers-reduced-motion`.
- Avoid unintended horizontal overflow at every supported viewport.

## Mobile-first baseline

Design and verify in this order:

1. 320-430 px mobile;
2. 768-1024 px tablet;
3. 1280-1600 px desktop.

Mobile must use touch-native interactions, at least 44 px targets, safe-area support and content structures that do not depend on wide tables.

## Financial-domain requirements

- Financial quantities and money must not rely on floating-point arithmetic for canonical calculations.
- Posted transactions are immutable; corrections use void/replacement or another approved audit-safe mechanism.
- Balances, holdings and performance derive from one canonical ledger, not competing stored totals.
- Unknown valuation remains distinguishable from zero.
- Known partial values remain visible where mathematically valid.
- Imports require strict parsing, preview, row-level errors and atomic commit behavior.
- Backup and restore must validate schema and global invariants before replacing data.

## Supabase requirements

- UI components must not scatter raw Supabase queries across the application.
- Access flows through application services and repository adapters.
- All exposed user-owned tables require RLS and explicit policies.
- A service-role key is server-only and must never enter browser bundles, `VITE_*` variables or shared examples without an approved server-only use case.
- Schema changes use versioned migrations and local validation before any remote application.
- Legacy migrations remain frozen until a migration decision is approved.

## Environment-file baseline

- `.env` must not be tracked by Git.
- A local ignored `.env` may exist after the tracked deletion is committed.
- `.env.example` contains placeholders only and must not include service-role credentials during Phase 0.
- Removing `.env` from the current commit does not remove its historical contents from Git history.

## Validation baseline

Run repository checks individually so every result is recorded:

```powershell
bun install --frozen-lockfile
bun run format:check
bun run typecheck
bun run lint
bun run build
git diff --check
git diff --cached --check
```

Known Phase 0 baseline:

- frozen install passes;
- TypeScript passes;
- production build exits successfully;
- global Prettier and ESLint contain recorded legacy failures;
- build regenerates `src/routeTree.gen.ts`, which is outside Phase 0 and must be captured, verified and restored by the controlled validator;
- `bun run check` is fail-fast and stops at the first failed command.

Do not run global formatting, `eslint --fix` or equivalent automatic cleanup without a separately approved scope. Automated success does not authorize commit, push, migration or deployment. Manual diff review remains required.
