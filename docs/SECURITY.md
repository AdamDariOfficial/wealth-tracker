# Security and Data-Safety Baseline

**Status:** mandatory requirements before real financial data is used

## 1. Environment files

- `.env` and environment variants are local-only and must not be tracked by Git.
- A local ignored `.env` may exist after the tracked deletion is committed.
- `.env.example` contains placeholders only.
- Never commit service-role keys, access tokens, database passwords or private API credentials.
- Browser variables may contain only values intended for browser exposure.

The repository historically tracked a `.env` file. Removing it from the tracked repository tree does not erase it from Git history. History rewriting, key rotation and Supabase project replacement are separate operations requiring explicit authorization and backup planning.

## 2. Supabase keys

The publishable/anon key is designed for client use, but it grants the permissions allowed by RLS. Its safety therefore depends on complete and correct RLS policies.

The service-role key bypasses RLS and is server-only. It must never be referenced by client modules, `VITE_*` variables, browser logs or public artifacts. Phase 0 does not introduce a service-role placeholder because no approved server-only use case requires it.

## 3. RLS requirements

Every exposed user-owned table must:

- enable RLS;
- define reviewed policies for each allowed operation;
- scope rows to the authenticated user;
- prevent cross-user foreign-key references;
- have negative tests proving another user cannot read or mutate the row.

Do not disable or weaken RLS to make a UI request succeed.

## 4. Schema and migration safety

- Keep migrations versioned in Git.
- Validate migrations locally or in an isolated project.
- Never run migrations automatically from a change package.
- Export and reconcile legacy data before destructive schema changes.
- Record rollback or forward-fix behavior for each production migration.

Legacy migrations are historical evidence and remain frozen until a v2 migration strategy is approved.

## 5. Financial-data integrity

Before real data is entered, the application must have:

- domain validation for all financial writes;
- atomic multi-row commits;
- immutable posted transactions;
- backup export with schema version and checksum;
- restore validation before replacement;
- idempotent import rollback;
- audit-safe destructive actions;
- tests for storage, network and partial-failure paths.

## 6. Logging and errors

- Do not log tokens, full environment objects or financial backup payloads.
- User-facing errors must be useful without revealing database internals.
- Server logs may include operation identifiers and sanitized causes.
- Security-sensitive failures must fail closed.

## 7. Phase 0 security actions

This phase only:

- removes `.env` from the tracked repository tree;
- adds explicit environment ignore rules;
- creates a placeholder `.env.example` without service-role credentials;
- documents the historical exposure and future actions.

It does not:

- prevent a local ignored `.env` after commit;
- rewrite Git history;
- rotate Supabase keys;
- change the Supabase project;
- edit RLS or migrations;
- assert the current database is safe for real data.
