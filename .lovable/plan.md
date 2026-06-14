# Import Data 2.0 — Plan

This is a large, multi-surface refactor. To keep risk low and respect the **single source of truth** rule (everything flows through ledger / holdings / goals engines), I'll ship in 4 sequenced phases. Each phase is independently shippable and testable.

Confirm the phasing (or pick which phases to ship now) before I start.

---

## Phase 1 — Parser & Engine Foundation (no UI changes yet)

Rewrite `src/lib/import-parser.ts` into a modular grammar with one tokenizer per operation kind, plus a normalizer for "natural language" phrasings. Output a discriminated union `ParsedEntry` covering every new type.

**New operation kinds:**
- `deposit` / `expense` (existing, kept)
- `transfer` (existing, kept; reinforced)
- `buy` / `sell` — with `@ price`, `at price`, `qty/price` keywords, and capital-only form
- `goal_create` / `goal_contribution`
- `account_open` (opening balance)
- `asset_open` (opening position)
- `snapshot` (NET WORTH / ACCOUNT / ETF / CRYPTO bulk lines → expands into opening txns + positions)

**Natural-language normalizer:** rule-based regex layer that rewrites
`Bought 2 BTC at 42000 from X` → `BUY 2 BTC @ 42000 from X` before main parse. No LLM.

**Engine layer:** extend `src/lib/import-engine.ts` so every kind dispatches to existing primitives:
- buys/sells → existing trade/holding actions in `ledger-actions.ts`
- transfers → `recordPairedTransfer` with `transfer_group_id`
- goals → `goals` table via existing hook
- opening balances → `recordManualAdjustment`
- opening positions → buy txn dated `opening_date`
- every created row tagged `import:<batchId>` (rollback already works)

**Issue model:** extend `AccountIssue` into a generic `ImportIssue` union: `unknown_account | unknown_asset | unknown_goal | invalid_price | missing_qty | invalid_date | duplicate`.

---

## Phase 2 — Resolution Center & Editable Preview

Refactor `src/routes/import.tsx`:

- **Issue Resolution Panel** (replaces today's flat error list): grouped by issue type, each with row count + inline actions. Reuse `IssueResolveModal` for accounts; add `AssetResolveModal` and `GoalResolveModal` (same 3-mode pattern: create / map / ignore). All resolutions persist via `import_aliases` (entity_type already supports `asset` and `goal`).
- **Editable Preview Table:** per-row inline editors for account, asset, goal, qty, price, amount, date, description — diff-applied to the parsed entry, no re-parse needed.
- **Dry-Run Summary Card:** rows parsed · new accounts/assets/goals · deposits / withdrawals / transfers / buys / sells / goal contributions · estimated net-worth impact. Always shown before commit (current "preview" becomes a true dry-run; commit is a separate explicit step).
- **Capital-only BUY flow:** if price unknown AND no live market price, mark row `needs_price` and surface a single-field inline prompt in the issues panel.

Mobile: stacked cards already exist for preview; extend with collapsible row editor.

---

## Phase 3 — Templates, Syntax Guide, History

- **Templates:** new `import_templates` table (`id, user_id, name, body, created_at`). Sidebar panel on `/import` with built-in presets (Salary, Weekly Work, DCA BTC, Goal Contribution) + user-saved templates. Click → appends to textarea.
- **Syntax Guide:** collapsible right-rail (desktop) / bottom-sheet (mobile) using `Collapsible`. Each section has copyable example blocks.
- **Import History:** existing `import_batches` already stores most of this. Expand summary JSON to include created accounts/assets/goals counts. Render as a table with rollback button per batch (rollback already implemented; extend to also void created `assets`/`goals` rows tagged with batch).

---

## Phase 4 — Recurring Rules & Performance

- **Recurring Rules:** new `import_recurring_rules` table (`id, user_id, schedule, body, next_run_at, last_run_at, active`). Background `pg_cron` job (hourly) calls a public API route `/api/public/hooks/run-recurring-imports` that materializes due rules into transactions via the same engine. UI: "Recurring" tab on `/import` to create/edit/pause rules.
- **Performance:**
  - Move parse off the main thread for >200 rows via `requestIdleCallback` chunking (50-row chunks).
  - Virtualize preview table with `@tanstack/react-virtual` (already in tree via shadcn).
  - Memoize row components by stable `lineNo`.
  - Batch DB writes: group all deposits/withdrawals into a single `transactions` insert per batch where possible.

---

## Technical notes

**No new "special-case" paths.** Every executor in `import-engine.ts` calls existing helpers in `ledger-actions.ts` / `useUserTable` / `recordManualAdjustment`. The engine is purely a translator.

**Migrations needed:**
1. `import_templates` (Phase 3)
2. `import_recurring_rules` (Phase 4)
3. Extend `import_batches.summary` schema (additive JSON, no migration strictly needed)

All with full `GRANT` + RLS scoped to `auth.uid()`.

**Files touched (high level):**
- `src/lib/import-parser.ts` — full rewrite (modular)
- `src/lib/import-engine.ts` — extended dispatchers
- `src/routes/import.tsx` — UI refactor (split into subcomponents under `src/components/import/`)
- `src/components/import/` — new: `AssetResolveModal`, `GoalResolveModal`, `IssuePanel`, `PreviewTable`, `DryRunSummary`, `TemplatesPanel`, `SyntaxGuide`, `RecurringRulesPanel`, `HistoryPanel`
- Supabase migrations for templates + recurring rules
- `/api/public/hooks/run-recurring-imports` server route + pg_cron entry

---

## Question before I start

This is roughly 3–4 days of focused work if shipped end-to-end. Two options:

1. **Ship all 4 phases now in one large pass** — long single response, more files changed at once, harder to review.
2. **Ship Phase 1 + Phase 2 first** (parser, engine, resolution, editable preview, dry-run) — the highest-leverage work, fully usable. Then Phase 3 (templates / guide / history polish) and Phase 4 (recurring + perf) in follow-ups.

I recommend **Option 2**. Reply "go" for Option 2, "all" for Option 1, or tell me which specific phases to prioritize.
