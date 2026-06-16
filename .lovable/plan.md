# Import Data 3.0 — Production-Grade Integrity Phase

**Non-negotiable rule:** Import remains an input layer only. All math flows through the existing ledger / holdings / goals / analytics / reconstruction engines. No parallel aggregations, no new portfolio calculators.

Single source of truth stays: `transactions`, `accounts`, `assets`, `goals`. Every created row keeps the `import:<batchId>` tag so the existing rollback path keeps working.

---

## Phase A — Integrity Core (ship first)

The minimum that makes large historical imports safe.

1. **Duplicate Detection Engine** (`src/lib/import-duplicates.ts`)
   - Compares new parsed rows against: other rows in the same batch + existing `transactions` within ±3 days of the row date, scoped to user.
   - Signal weights: date proximity, amount equality, account match, asset/qty match, description similarity (token Jaccard), transfer-pair symmetry.
   - Emits `confidence 0–100` + `duplicateOf?: txId | rowIndex`.
   - Per-row action in preview: **Import / Skip / Merge** (merge = drop the new row and tag the existing tx with the alias/description from the new row).
   - Surfaces aggregated count in Dry Run ("3 possible duplicates").

2. **Import Health Score** (`src/lib/import-health.ts`)
   - Pure function over parsed rows + issues + duplicate report → `{ score, tier, breakdown[] }`.
   - Deductions: unresolved account/asset/goal, missing price, duplicate prob, invalid date, malformed row.
   - Rendered as a single header card with tier (Excellent / Good / Needs Review / High Risk) and a click-to-expand breakdown.

3. **Smarter Entity Matching**
   - Extend `assets` with `aliases text[]` and `isin text` via migration (additive, nullable).
   - `import-parser.ts` resolver: exact symbol → ISIN → alias → fuzzy (existing). When >1 candidate within score threshold, emit `ambiguous_asset` issue.
   - `EntityResolveModals.tsx` gets an "Alternative matches" list with confidence; "Map" persists into `import_aliases` AND appends to `assets.aliases` so future imports skip the modal.

4. **Auto Categorization Engine** (`src/lib/import-categorize.ts`)
   - Rule table (keyword → category/tag): salary→income, rent/groceries/utilities→expense buckets, BTC/ETH→crypto, VWCE/SWDA→etf, AAPL/MSFT→stock.
   - Runs after parse, before preview. Fills `category`/`tags` only when empty. User edit in preview wins.

---

## Phase B — Confidence & Analytics (after A lands)

5. **Import Analytics Preview** — expand existing `DryRunSummary` with: Net Worth delta, allocation delta per class, per-goal progress delta. Derived by feeding the simulated rows through existing `use-portfolio` / goals selectors against a cloned in-memory ledger (no new aggregator).

6. **Inline Correction Center** — finish making preview cells fully editable (account, asset, goal, qty, price, amount, date, description, tags) with live re-derivation of issues, duplicates, and health score. No re-parse.

7. **Opening Position Wizard** (`src/components/import/OpeningPositionWizard.tsx`) — three tabs (Account / Asset / Goal). On submit it inserts the corresponding syntax line into the import textarea — does not bypass the parser.

---

## Phase C — Post-import & Rollback (after B)

8. **Import Statistics Report** — replaces the post-commit toast with a results screen on `/import?batch=<id>`: counts per op kind, inflow/outflow bars, created-entities list, "View in Activity" deep link.

9. **Advanced Rollback** — extend existing batch rollback with:
   - Rollback selected rows (checkbox list in batch detail).
   - Rollback by operation kind (e.g. only the buys).
   - Pre-rollback impact preview ("Will remove 12 tx, 2 transfers, 1 goal contribution").
   - Reuses existing void/delete primitives; no new SQL paths.

10. **Audit Trail + Activity Feed wiring** — `import_batches.summary` already stores per-batch metadata; piggyback on the existing `audit_log` triggers (no new triggers). Add lightweight client-side mapper in `use-activity-feed.ts` so import events render as: "Imported N rows", "Created asset X", "Mapped A→B", "Skipped duplicate", "Rolled back batch".

---

## Phase D — Performance (last)

11. Chunked parsing via `requestIdleCallback` (50-row chunks).
12. `@tanstack/react-virtual` on preview + batch detail tables.
13. Memoize duplicate matrix and health score selectors keyed by `rowsHash`.
14. Single batched insert per op kind on commit (already mostly true — verify).

Target: 1000+ rows parsing < 1s on a mid-range laptop, scrolling stays at 60fps.

---

## Files (Phase A only — concrete)

- **Migration:** add `aliases text[] default '{}'`, `isin text` to `assets`; index on `isin`.
- **New:** `src/lib/import-duplicates.ts`, `src/lib/import-health.ts`, `src/lib/import-categorize.ts`.
- **Edit:** `src/lib/import-parser.ts` (ambiguous_asset, ISIN/alias resolution, hook categorizer), `src/components/import/EntityResolveModals.tsx` (alt matches + persist alias to asset), `src/routes/import.tsx` (health card, duplicate column + per-row action, dup count in dry-run).
- **No edits** to: `ledger-engine.ts`, `ledger-actions.ts`, `use-portfolio.ts`, `use-holdings`, goals selectors, reconstruction engine.

---

## Question

Ship **Phase A only** first (recommended — it's the actual integrity layer and unblocks safe historical imports), then B/C/D as follow-ups? Reply:

- **"go"** → ship Phase A now.
- **"go ab"** / **"go abc"** / **"all"** → ship more phases this turn (longer, more files at once).
- Or name the specific items you want first (e.g. "duplicates + health only").
