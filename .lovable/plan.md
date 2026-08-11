# Repolish Audit — Nebula Wealth Hub

Audit only. No repository edits, no database writes, no publish/deploy were performed in this pass.

## 1. Source inspected

Working tree at local head `1f91a7b` ("Applied v2 migrations"), on top of `e96aa17` / `2d6d4fa`. This corresponds to the repolish state you referenced as main `9efee26`; nothing in this pass changed it.

Inspected:

- Canonical routes: `src/routes/index.tsx`, `investments.tsx`, `accounts.tsx`, `accounts.$id.tsx`, `transactions.tsx`, `calendar.tsx`, `import.tsx`, `trading.tsx`, `goals.tsx`, `settings.tsx`, `login.tsx`, `signup.tsx`, `onboarding.tsx`.
- Closed/redirect routes: `cash`, `crypto`, `etf`, `analytics`, `audit`, `journal`, `timeline`, `activity`, `dev-tools`, `trading-capital`.
- Shell/shared: `AppSidebar`, `AppMobileNavigation`, `CommandPalette`, `PageHeader`, `MetricCard`, `SectionCard`, `EmptyState`, `Modal`, `FinancialStatePanel`, `CoreComposer`, `features/wealth-v2/forms/*`, `components/ui/*`.
- Data boundary: `src/features/wealth-v2/use-financial-state.ts`, `use-advanced-state.ts`, `src/lib/v2-runtime.ts`, `src/data/supabase/v2/*`, `src/application/*`.
- Legacy layer: `src/hooks/use-portfolio.ts`, `use-ledger.ts`, `use-user-table.ts`, `use-timeline.ts`, `use-networth-series.ts`, `use-trading.ts`, `use-positions.ts`, `use-activity-feed.ts`, `src/lib/{seed-data,ledger-actions,import-engine,import-rollback,import-analytics,trading-engine,temporal-engine,ledger-engine,history-reconstruction}.ts`, `src/components/{AccountFormModal,AssetFormModal,GoalFormModal,TransactionModal,HoldingActionModal,AccountPicker,AssetPicker,TagPicker,ActivityDrawer}.tsx`, `src/components/trading/*`, `src/components/import/*`.
- `src/styles.css`, `src/routes/__root.tsx`.

## 2. Confirmed pass

- **Data boundary is clean on every canonical route.** All ten authenticated routes plus `/onboarding` read through `features/wealth-v2/use-financial-state` / `use-advanced-state` and write through `lib/v2-runtime` repositories. No canonical route or its component tree issues a direct financial database query.
- **No domain/financial logic changes from the repolish.** `src/domain/**` and `src/application/**` contain no repolish edits; money, decimal, balancing, immutability, reversal, unknown-vs-zero, goal progress, trading capital, import and backup/restore/reset semantics are untouched.
- **No new product modules or metrics.** No transaction detail route, no CAGR/Sharpe/drawdown, no market-data history, no password recovery, no activation checklist. No new chart module was introduced.
- **Route/search contracts preserved.** `validateSearch` on `/accounts`, `/investments`, `/transactions`, `/trading`, `/import`, `/calendar` still normalises the same keys with the same defaults, and every legacy path is still a `beforeLoad` redirect carrying valid search state (e.g. `/cash` -> `/investments?view=fiat`, `/journal` -> `/trading?tab=weekly`).
- **Mobile shell matches the approved model.** `AppMobileNavigation` keeps Dashboard, Portfolio, Add, Calendar, More, with More exposing Accounts, Transactions, Import, Trading, Goals, Settings.
- **No user-facing technical terminology.** A case-insensitive scan of `src/routes`, `src/components`, `src/features` for canonical / v2 / RPC / repository boundary / Phase N / Lovable returned no user-visible strings. Internal identifiers (`wealth-v2`, `v2-runtime`) remain, which is allowed since they are never rendered.
- **Reduced-motion is handled.** `src/styles.css` has a `prefers-reduced-motion: reduce` block and dialogs/animated affordances carry `motion-reduce:` guards.
- **Generated files untouched.** `src/routeTree.gen.ts` and `src/integrations/supabase/types.ts` show no hand edits; types now reflect the freshly bootstrapped schema.

## 3. Confirmed gaps and regressions

### G1 — Build is broken: orphaned legacy hook queries tables that no longer exist (blocker)

`src/hooks/use-portfolio.ts` lines 167, 187, 211, 235, 236 query `trading_account` and `performance_snapshots` through the typed client. Those tables do not exist in the bootstrapped database, so the generated table union no longer contains them and every call resolves to `never` (TS2769/TS2352/TS2345/TS2322). This is real on the current tree, not a stale report.

Root cause: the file is the only legacy module that uses the **typed** client. Every other legacy module (`use-timeline`, `seed-data`, `ledger-actions`, `import-engine`, `import-rollback`, `AccountFormModal`, `AssetFormModal`, `import/*Modal*`, `trading/WeeklyTab`) casts through `(supabase as any)`, which hides the identical problem from the compiler while remaining broken at runtime.

Scope note: this entire legacy layer is **orphaned**. No canonical route imports it — the only routes that ever did are now pure redirects. It is dead code that still ships in the bundle and still gates typecheck.

### G2 — Build is broken: `/accounts` back-link omits required search (blocker)

`src/routes/accounts.$id.tsx` line 74 renders `<Link to="/accounts">` with no `search`. `/accounts` declares `validateSearch` producing `{ q, archived }` with no route-level `search` default, so the link type requires `search` (TS2741). The sibling not-found link at line 50 already passes `search={{ q: "", archived: false }}`; line 74 was missed. This is a repolish regression, not a pre-existing condition.

### G3 — Dead legacy layer contradicts the data-boundary constraint

Roughly 30 modules under `src/hooks`, `src/lib`, `src/components` still contain direct financial Supabase queries against dropped tables (`transactions`, `accounts`, `assets`, `goals`, `import_batches`, `import_aliases`, `etfs`, `cash_reserves`, `crypto_holdings`). They violate "no direct component-level financial queries outside the repository boundary" on paper and would fail at runtime if any surface ever re-imported them. They also keep `(supabase as any)` casts alive, which is exactly the escape hatch that let G1 hide until the schema changed.

### G4 — `src/lib/seed-data.ts` writes fabricated financial rows

It inserts synthetic accounts, assets and transactions directly. It is currently unreachable (its only entry point, `/dev-tools`, is a redirect), but it remains a live seeding path in the bundle and conflicts with the no-fake-data posture.

## 4. Hypotheses requiring authenticated browser evidence

These could not be settled by reading code, and the preview session has no signed-in user plus an empty database:

- H1 — Whether any canonical route renders horizontal overflow with long amounts at 320x568 and 375x812, particularly `/transactions`, `/import` preview rows and `/accounts/:id` position rows.
- H2 — Whether the Import mobile experience actually degrades to card-stack rather than a desktop-width table at 320-430px under real parsed rows.
- H3 — Whether every dialog/sheet reaches >=44px touch targets and >=16px form text on mobile once populated with real content.
- H4 — Whether focus order, visible focus rings and Escape behaviour hold in `CommandPalette`, `CoreComposer` and the mobile More drawer.
- H5 — Whether empty-state and error panels read correctly on a genuinely empty account (all routes will currently render empty states, since the database has zero rows).
- H6 — Whether motion durations land in the 160-240ms band in practice.

Settling H1-H6 requires you to sign in to the preview once; after that I can drive the full viewport matrix.

## 5. Minimal implementation plan (for a later, separately approved pass)

Two ordered stages. Stage A restores a green build with the smallest possible change; Stage B removes the dead layer.

**Stage A — unblock the build (2 files)**

- `src/routes/accounts.$id.tsx` — add `search={{ q: "", archived: false }}` to the back-link at line 74, matching the existing sibling link. Presentation-only.
- `src/hooks/use-portfolio.ts` — remove the two orphaned exports `useTradingAccount` and `useSnapshots` (the only consumers are themselves orphaned) or, if you prefer zero deletion, isolate them behind the same untyped access the rest of the legacy layer already uses. Deletion is preferred: it removes the query rather than hiding it.

**Stage B — retire the orphaned legacy layer (separate approval)**

Delete, not rewrite: `src/hooks/{use-portfolio,use-ledger,use-user-table,use-timeline,use-networth-series,use-trading,use-positions,use-activity-feed}.ts`, `src/lib/{seed-data,ledger-actions,import-engine,import-rollback,import-analytics,import-parser,import-chunked,import-duplicates,import-health,import-categorize,trading-engine,temporal-engine,ledger-engine,history-reconstruction}.ts`, the legacy modal/picker components and `src/components/{trading,import}/*` that are unreachable from canonical routes. Each removal must be proven unreachable from the ten canonical routes before it is applied.

**Explicit non-goals for both stages**

No visual redesign, no new charts or metrics, no route or search-contract changes, no domain/application/repository edits, no migrations or database writes, no regeneration of `types.ts` or `routeTree.gen.ts`, no publish/deploy, no touching the closed redirect routes.

## 6. Acceptance criteria and verification matrix

Acceptance:

- `bun run typecheck` exits clean with zero errors.
- `bun run build` succeeds.
- `bun test` shows no new failures versus the recorded baseline.
- Prettier and ESLint pass on touched files only; recorded legacy global failures stay as-is.
- `rg` over `src/routes`, `src/components`, `src/features` finds no `(supabase as any)` and no direct financial table query outside `src/data/supabase/**`.
- Every canonical route still resolves via direct URL, refresh and Back/Forward with its search contract intact.

Verification matrix (post-approval, after you sign in to the preview):

| Surface | 320x568 | 375x812 | 390x844 | 430x932 | 768x1024 | 1024x768 | 1440x900 | 1600x1000 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | x | x | x | x | x | x | x | x |
| `/investments` | x | x | x | x | x | x | x | x |
| `/accounts`, `/accounts/:id` | x | x | x | x | x | x | x | x |
| `/transactions` | x | x | x | x | x | x | x | x |
| `/calendar` | x | x | x | x | x | x | x | x |
| `/import` | x | x | x | x | x | x | x | x |
| `/trading`, `/goals`, `/settings` | x | x | x | x | x | x | x | x |
| `/login`, `/signup`, `/onboarding` | x | x | x | x | x | x | x | x |

Per viewport: no horizontal overflow, long amounts readable, >=44px targets, >=16px mobile form text, visible labels/errors/focus, reduced-motion respected, console clean.
