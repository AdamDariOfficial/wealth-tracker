# Nebula Wealth Hub — Full Visual / UX Repolish

**Mode:** presentation-only repolish. No financial-logic, schema, RLS, RPC, or data-flow changes. No new dependencies. Preserves the charcoal-and-cyan identity defined in `docs/VISUAL_SYSTEM.md` and the source hierarchy in `AGENTS.md`.

**Baseline:** `main@d798032` (pre-repolish route-closure). Working tree HEAD is one WIP commit ahead containing only lockfile + `routeTree.gen.ts` drift — no UI edits yet.

---

## Guardrails (non-negotiable)

- Charcoal canvas, cyan accent, Sora/Manrope/JetBrains Mono — unchanged.
- Mobile-first: verify 320 / 375 / 390 / 430 / 768 / 1024 / 1440 / 1600.
- No horizontal overflow; ≥44px touch targets; safe-area aware; 16px mobile inputs.
- `prefers-reduced-motion` disables non-essential transforms and animated counters.
- Positive/negative states carry icon + text, not color alone.
- No Tretnix / AI-tool attribution. Brand reads "Nebula Wealth Hub" everywhere.
- No edits to domain, application, repository, RLS, migrations, or financial hooks' math.

---

## Workstream 1 — Shared metric primitive (consolidation)

Today there are **5 near-duplicate** metric/stat components with inconsistent spacing, font sizes and feature sets:
`StatCard.tsx` (global), Dashboard `Metric`, Accounts `Summary`, Calendar `SummaryCard`, Trading `StatCard`, Portfolio `Summary`.

- Create one `src/components/MetricCard.tsx` with variants: `accent` (cyan gradient + glow ring), `tone` (success/destructive/warning/cyan), optional `delta`, `icon`, `hint`, `compact`.
- Replace the local duplicates on Dashboard, Portfolio, Accounts, Calendar, Trading with `MetricCard`. Pure presentation swap — identical data props.
- Add a shared `EmptyState` (`src/components/EmptyState.tsx`): icon, title, hint, optional action. Replaces the ad-hoc dashed boxes on Transactions, Accounts, Portfolio so empty states are branded and consistent.

**Files:** new `MetricCard.tsx`, `EmptyState.tsx`; edit `index.tsx`, `investments.tsx`, `accounts.tsx`, `calendar.tsx`, `trading.tsx`, `transactions.tsx`. `StatCard.tsx` deprecated in place (not deleted this pass to avoid touching every importer).

## Workstream 2 — Dashboard elevation (flagship)

The Dashboard currently shows 4 flat tiles + a **text-list "allocation"** + recent transactions **without amounts**. Elevate to a premium wealth cockpit using only data that already exists:

1. **Net-worth trend chart.** `useNetworthSeries` + `lib/history-reconstruction` already exist and are unused on the dashboard. Render a Recharts `AreaChart` (charcoal fill, cyan stroke, cyan glow under line) over the reconstructed series. Unknown segments render as a dashed/gapped region — never as zero (honours "unknown ≠ zero").
2. **Allocation donut.** Replace the text row-list with a compact Recharts `PieChart` donut + center total. Keep the legend rows below it (known values only).
3. **Recent transactions with amounts.** Surface the signed net amount per transaction (derivable from legs, no new math) next to description/date.
4. **Valuation coverage badge.** Compact "known / total" ring or pill instead of the bare text.

**Files:** edit `src/routes/index.tsx`; verify `src/hooks/use-networth-series.ts`, `src/lib/history-reconstruction.ts` expose what the chart needs (read-only check; adapt only if signature gaps block rendering).

## Workstream 3 — Route-aware loading & empty states

- Replace `FinancialLoading`'s 3 generic pulsing bars with **route-shaped skeletons** (card-grid skeleton) that mirror each page layout, eliminating layout shift on load. Respect `motion-reduce`.
- Apply `EmptyState` consistently so every empty list reads the same brand language.

**Files:** edit `src/features/wealth-v2/FinancialStatePanel.tsx`; consumers unchanged (same export shape).

## Workstream 4 — Auth & onboarding surfaces

- **Login:** fix the "Wealth Tracker" label → "Nebula Wealth Hub" (consistency bug). Add `grid-bg` + the radial cyan glow already used elsewhere; keep the centered glass card. Verify safe-area + 16px inputs + 44px submit.
- **Onboarding:** align brand string; keep the validated v2 form untouched.

**Files:** edit `src/routes/login.tsx`, `src/routes/onboarding.tsx` (copy/brand only).

## Workstream 5 — Motion guard pass

`StatCard.tsx` animates unconditionally (no `useReducedMotion`). Audit every framer-motion surface and gate non-essential transforms behind `useReducedMotion` per VISUAL_SYSTEM §7. No animated financial counters that delay comprehension.

**Files:** edit `src/components/StatCard.tsx`; scan `PageHeader.tsx`, `Modal.tsx`, `CoreComposer.tsx`, list reveals.

## Workstream 6 — Contrast & a11y pass (VISUAL_SYSTEM §8)

- Verify contrast on glass surfaces, muted labels, and chart legends/tooltip (shared `chart-style.ts`).
- Ensure tone-only signals (e.g. Trading P&L tone, allocation row color) always pair with an icon or sign.
- Focus-visible on all interactive elements; keyboard dismiss on overlays already present.

**Files:** `src/lib/chart-style.ts`, `src/components/trading/*`, `src/routes/trading.tsx` (add icons/signs alongside tone).

## Workstream 7 — Mobile density verification

No code edits unless a defect is found: drive the 8 target viewports and confirm no overflow, reachable primary action, chart tooltips not clipped, and the trading weekly-review list reads as cards on mobile (it currently uses `flex-wrap` rows — verify it doesn't collapse awkwardly at 320px).

---

## Out of scope (explicitly untouched)

- Domain / application / repository / RPC / RLS / migrations.
- `use-portfolio`, `use-ledger`, `use-positions` math; `history-reconstruction` algorithm.
- Information architecture, navigation groups, route topology.
- Import engine, rollback, parser.
- Dependencies (Recharts, Framer Motion, react-virtual already present).

## Verification

- `bun run typecheck`, `bun run build` (per AGENTS.md; no global lint/format auto-fix without separate scope).
- Browser: all 8 target viewports, dashboard chart render + tooltip contrast, reduced-motion, empty/loading, direct URL + refresh + Back/Forward, keyboard overlay dismiss.

## Open question

Workstream 2's net-worth chart depends on `use-networth-series` producing a usable series from the validated state. If that hook returns empty for fresh accounts, the chart degrades to an empty-state (no false zero). Confirm you're happy with that graceful fallback, or want a "first transaction" empty-state instead.
