# Nov 7 brief — progress checklist (kept current)

Local build on `claude/ext20-recovery-2026-10-31`, all commits unpushed on top of
`9173ccf`. Legend: ✅ done · 🟡 in progress · ⬜ not started · 🔒 blocked (owner/
provider/real-device). External actions (push/merge/deploy, production Supabase,
live email/carriers/ads/spend, real customer data) stay OFF throughout.

## Pre-work (done)
- ✅ Report-table numeric alignment (Tax Records, Report History) — `4b8c5d8`
- ✅ Nov 7 handoff recorded + capability/gap map — `c0d608e` (`NOV7_BUILD_HANDOFF_2026-11-07.md`)
- ✅ Recovery export v23 (verified, 19 patches, tree-hash match) — scratchpad

## Phase 1 — Scan Shipment ✅ (milestone)
- ✅ Engine core: tracking validation, carrier detect, trusted links, role-scoped
  ranking, dedup, simulated attach + state machines — `29eec41` (16 tests)
- ✅ View-model: masking, always-confirm, camera fallback, chooser/no-match,
  result mapping — `9c1b9e7` (7 tests)
- ✅ UI flow wired to Home + Orders behind default-OFF flag; capture (camera/
  photo/manual/fixtures) → review → confirm → result; barcode via BarcodeDetector
  with photo/manual fallback; previews desktop+mobile — `4e472ed` (9 journey tests)
- 🔒 real-device camera pass (owner device); 🔒 real OCR for printed text (fixture
  demo only today); 🟡 wire search to real accessible orders (fixtures today).

## Phase 2
- ✅ Wholesale & Boutique Scout — intake carries source/date/fit/confidence +
  one-store end-to-end journey (intake→score→draft→review+invalidate→reply→
  follow-up suppression→pipeline to CUSTOMER) — `d507851`. Reuses existing engine
  + panels. (UI already present via Sales & Growth flag.)
- ✅ Wholesale storefront handoff doc (QR/PIN/cache/mobile/two-sample) — `dd5025c`
- ✅ Inventory Reorder & Cash Flow — engine `0aab9da` + read-only **planning view**
  in Inventory panel (flag `he_reorder_planning`, filter/why/draft, all branches
  on screen) `5c98e05` + **sample-handoff↔inventory** read-only reconciliation
  `5ecf1fd` (projectConsumption, idempotent, missing write contract named:
  adjust_inventory/R4). Previews desktop+mobile. Purchasing disabled.

## Phase 3
- ✅ Content & Social Repurposing + Ad Creative/Copy Variations — `8e055b5`:
  asset→draft journey (source facts + version, claim check fails-closed, status
  machine owner-gated, **edit-approved→returns-to-review**); ad variants carry
  audience/hook/hypothesis, flag claims, rank safe first.

## Phase 4
- ✅ Review & Testimonial Analyzer (SG-12) — `ad0e7ba` new he-sales-reviews:
  theme classify, leak/pump/safety urgent, permission+claim-gated quotes,
  duplicate collapse, embedded-instructions-as-data.
- ✅ Micro-creator & UGC Discovery — `24831d7`: shortlist w/ source+confidence,
  UNKNOWN reach/engagement never invented, editable draft returns-to-review,
  creator gifts separate from store visits, owner-controlled contact.
- ✅ Retention & Replenishment — `f8da8e8`: configurable timing (reviewWindow/
  defaultInterval, 45 as test example), eligibility (opt-out/refund/issue) with
  preserved holdReason, dedupe by customer+channel, uncertain→UNKNOWN/NEW.

## Operations track
- ✅ Printable US-Letter reports + export manifest — `<pending>` new
  he-report-export.js: inclusive date-range selection, MISSING stays UNKNOWN
  (never 0), US-Letter print MODEL (not a rendered PDF), deterministic FNV-1a
  checksum + verification (catches tamper), failure→retry export that never
  double-exports (5 Node tests). PDF rendering + Mac downloader still 🔒/⬜.
- ✅ Ops journey (scan→packing slip→report) — one synthetic order, PARTIAL
  shipment, repeated actions idempotent: re-scan attaches once, retry export
  once, partial shipment shows revenue UNKNOWN not $0 (3 Node tests).
- ✅ Invoice & packing-slip prototypes — `a83e135` new he-invoice.js: integer-
  cents totals, issue (role+unique-number+duplicate guard+immutable snapshot),
  partial/over/duplicate-payment guards, void rules, overdue derivation,
  packing slip w/ lot numbers + optional prices (6 Node tests). Model only:
  no prod write, no numbering/trigger/terms/tax decision (owner-pending), no UI.
- ⬜ Mac export design (data export ≠ backup; preserve current backups) 🔒 background downloader = separate native component

## Handoff / inputs
- ⬜ Wholesale QR storefront — documentation handoff to the website session
- ⬜ Planning inputs recorded (lab fill, jar/kit costs, provisional pricing, box-fit) — in `NOV7_BUILD_HANDOFF_2026-11-07.md`; confirm before public use

## Closeout
- ✅ Day rehearsal — two synthetic orders through one operating day with a
  mid-day CORRECTION (void unpaid invoice + reissue at new number) and a
  failed-then-retried export, reconciled end to end: stock consumed = units
  shipped (40→22), report revenue = sum of FINAL invoices (void excluded,
  $333), bad tracking caught before attach. `day-rehearsal-ext21.spec.js` (1).
- 🟡 Owner-review-path browser walkthrough (discoverability, nav/back/refresh,
  defaults-OFF) — pending a full-suite window; engines + flows pass.

## Blueprint verification wave 1 (2026-11-08) — ✅ complete
All local/synthetic, defaults OFF. Review package: `NOV7_REVIEW_PACKAGE.md`;
shards: `NOV7_BOUNDED_REVIEW.md`. Verify-moves drift fixed at cause (0dd6743).
- ✅ 1 report/invoice previews wired to Report History (flags OFF) — `acfdb1a`
- ✅ 2 invoice corrections: draft-edit history + retries no duplicate — `9d68279`
- ✅ 3 two-page US-Letter invoice + packing slip print models — `01e16fd`
- ✅ 4 daily report vs ledger (cancel/refund/expense/boundary, unknown≠0) — `f986de4`
- ✅ 5 export recovery drill (schema+coverage, reject before apply, Mac-sync named) — `fde1fab`
- ✅ 6 inventory+wholesale rehearsal (handoff + partial receipt, no double-count) — `6787e09`
- ✅ 7 scanner recovery (cross-order guard, split shipment, outage) — `f691882`
- ✅ 8 marketing approval binding + next-action on blocked — `5b47990`
- ✅ 9 owner vs staff boundaries on new screens — `597303e`
- ✅ 10 bounded desktop+mobile review (182 passed, 0 failed) — `6af669d`
- ✅ 11 review package + recovery v29 (verified)
- 🔒 Full 2118-test suite PENDING (infeasible in one window; shards stand in)

## Blueprint verification wave 2 (2026-11-08) — ✅ complete
All local/synthetic. Execution list: `NOV7_EXECUTION_LIST.md`.
- ✅ 1 duplicate import across refresh/two tabs (stable ids, converge, reason) — `728b49c`
- ✅ 2 money/quantity provenance (display/CSV/print, rounding, correction, unknown) — `70468d2`
- ✅ 3 recovery with supported fixtures (identity retained; bad version refused) — `d94803c`
- ✅ 4 business-day/DST boundary audit + recorded missing policy — `dad1bfe`
- ✅ 5 two-role handoff (staff prepares, owner approves; audit; stale invalidated) — `9f3d41f`
- ✅ 6 UI failure recovery (preserve input, no duplicate, explain progress) — `844b14c`
- ✅ 7 large lists/documents (paging, totals, empty, reopen filters) — `005dde4`
- ✅ 8 dependency-ordered execution list (LOCAL/OWNER/EXTERNAL; L1 = next local)

## Local build follow-on (2026-11-09) — ✅ (owner-independent items done)
All default-OFF / synthetic. Execution list: `NOV7_EXECUTION_LIST.md`;
go-live script: `NOV7_GOLIVE_REVIEW.md`.
- ✅ L1 export preview over live saved reports — `caa8e7f`
- ✅ L2 read-only export recovery-drill panel — `e1d9f4a`
- ✅ L3 US-Letter invoice print view — `77069c4`
- ✅ Invoice O1 local prep: numbering `30052cd`, header `3d9380d`, number
  sequence `977af06`, credit note `e977461`
- ✅ Invoice end-to-end lifecycle integration test — `c2cfee9`
- 🟡 L4 full desktop suite in 16 shards — in progress overnight (bounded shards
  already green: 182 + refreshed changed-code 160/0)
- 🔒 L5 day-boundary IANA — owner decision O2
- 🔒 Owner decisions before go-live: O1 tax/terms/issuing, O2 day boundary,
  O3 roles, O4 export destination; E1–E4 providers/devices; merge = owner

## Critical path
- ✅ End-to-end order→fulfill→bill→report map with honest verified/blocked
  status per step and owner-decision priority — `NOV7_CRITICAL_PATH_MAP.md`.

## Owner decisions outstanding (from §14–16 + phases)
Retention; export scope/attachments; destination; encryption recovery; invoice
numbering/trigger/terms/tax; role permissions; real-device & provider approvals.
