# Phase 4 - Manual QA Checklist

Run only after repository validation and the explicit local Phase 4 database gate pass.

Record viewport, browser, user identity and result for every critical flow. Do not convert an untested item into PASS.

## Viewports

- 320 x 568
- 375 x 812
- 390 x 844
- 430 x 932
- 768 x 1024
- 1024 x 768
- 1440 x 900
- 1600 x 1000

## Global

- direct URL, refresh, Back and Forward preserve route/search state;
- new routes open at the top without smooth scrolling;
- no page-level horizontal overflow;
- intentional local scrollers remain contained;
- interactive controls are at least 44 px on mobile;
- keyboard focus is visible and dialogs are operable without a pointer;
- reduced-motion preference removes nonessential transition/animation behavior;
- no console errors attributable to Phase 4.

## Calendar

- Year / Quarter / Month / Week / Day switch correctly;
- Previous / Today / Next update URL-backed anchor;
- active-year controls are touch-safe;
- Month at 320-430 px uses contained horizontal scrolling and keeps day targets touch-safe;
- selected day is URL-backed and survives refresh;
- partial valuation remains visibly distinct from complete valuation;
- reversal/replacement events show current audit state;
- later price/FX observations do not change earlier historical cutoffs.

## Goals

- create each supported kind;
- edit a target without changing current ledger-derived progress manually;
- account goal accepts only owned accounts;
- asset quantity beyond asset precision is rejected;
- unknown asset valuation produces partial rather than zero progress;
- archive removes the goal from active view without financial-history changes.

## Trading

- known capital derives only from owned broker/exchange/investment positions;
- partial market data marks trading capital partial;
- risk settings save and reload exact values;
- draft weekly review can be created, edited and deleted;
- week start must be Monday;
- finalization confirmation works and finalized review becomes immutable;
- reported weekly P&L never changes a financial account balance;
- Overview and Insights preserve the separation between ledger capital and journal metrics.

## Import

- valid strict CSV preview shows exact row/transaction counts;
- invalid header is blocked with a row/batch issue;
- unknown account/asset, duplicate IDs, precision violation and unbalanced transaction are blocked before commit;
- valid multi-transaction batch commits atomically and creates one receipt;
- deliberately invalid database batch leaves no receipt and no partial transaction;
- rollback creates exact reversal transactions and preserves original transactions;
- rolled-back receipt cannot be rolled back twice;
- batch containing an already-corrected imported transaction fails rollback without partial reversals.

## Backup / restore / reset

- export downloads schemaVersion 1 JSON;
- valid backup restores accounts, assets, ledger, market observations, goals, trading settings/reviews and import receipts;
- malformed/unsupported backup is rejected before restore;
- deliberately tampered but syntactically valid backup fails in the database and leaves prior workspace unchanged;
- reset button remains disabled until exact `RESET WORKSPACE` is entered;
- confirmed reset clears canonical workspace/advanced data but preserves authenticated profile/onboarding.

## User isolation smoke

- sign in as user A and load all Phase 4 routes;
- sign out;
- sign in as user B and verify no user A Goals, Trading reviews or Import receipts appear;
- create a user B advanced record;
- sign out and return to user A;
- verify user A data is unchanged and user B data is absent.

## Integration gate

Only after the full checklist and automated/local-database evidence are reviewed may Phase 4 documentation move from `IN_PROGRESS` to `IMPLEMENTED_AND_VALIDATED` on the same integration branch. Commit/push/PR/merge remain explicit separate approvals.
