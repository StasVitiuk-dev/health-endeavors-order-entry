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

## Dashboard follow-up wave FU1–FU5 (2026-11-09) — ✅ complete
All local/synthetic, default-OFF, no push/merge/deploy. Recovery artifact
refreshed to **v38** at HEAD `f6cd560` (bundle verify OK; 86/86 checksums match;
clone tree-hash `40a39ddb` matches — `scratchpad/recovery-v38/`).
- ✅ FU1 full iPhone suite reconciled 489 pass / 11 artifact-fail / 365 skip = 865;
  emulated-iPhone vs physical-Safari/VoiceOver evidence kept separate — `59cd1a7`
- ✅ FU2 exec-list↔blueprint reconciliation + one-page release review (6 owner
  decisions left open); draft-PR checks read-only — `NOV7_RELEASE_REVIEW_ONEPAGE.md`, `4c5a03a`
- ✅ FU3 journey gaps closed: invoice reprint determinism + report missed-day
  catch-up (4 tests) — `fba0b0a`
- ✅ FU4 scanner journey gaps: no-name/multi-package receipts, masked destination
  + reasons, independent tracking-vs-email failure (4 tests) — `4956ed3`
- ✅ FU5 in-person hand-delivered sample visit log (the one unbuilt wholesale
  workflow): stock/cost/outcome, idempotent, UNKNOWN≠fake$0, write contract named
  (4 tests) — `683e0e2`; reconciliation + ordered agent backlog W-0..W-5 — `f6cd560`
- FU3+FU4+FU5 specs: 12 passed (desktop, pure Node). Browser override absent from config.

## Wholesale follow-ons W-0…W-5 (2026-11-09 → 11-13) — ✅ built, wired, tested
All draft-only behind `he_sales_growth` (OFF by default); nothing sent, spent or gifted.
- ✅ W-0 in-person sample visit page — `2b02bc4`
- ✅ W-1 content repurposing drafts (attribution, missing-input states, injection blocked) — `5c73c2c`
- ✅ W-2 ad variants (approval bound to exact wording + facts; no spend) — `2a513b0`
- ✅ W-3 feedback analysis (human routing, conflicts, private details redacted) — `a4a68d7`
- ✅ W-4 creator sample-offer drafts (unknown engagement stays unknown; contact/gifting/stock off) — `cc6c95d`
- ✅ W-5 reorder-reminder drafts (explicit cadence; opt-out / duplicate / cap guards) — `d4916a6`
- ✅ W-1…W-5 wired as five pages (54 Sales & Growth pages total) — `074e3ab`

## Original blueprint backlog (2026-11-13 → 11-14) — ✅ built and tested on the branch
- ✅ #25 service health: job state + next operator action — `f9625c2`
- ✅ #21 manual-fallback readiness (each launch flow has a manual path, cited to tests) — `fa8bc11`
- ✅ #54/#55 cycle count + adjustment approval + audit — engine `49c422a`, Inventory screen `44b4822`
- ✅ #27 recurring complaint trends (packaging / pump / quality) — `8689ddf`
- ✅ #65 saved views — engine `4542476`, Orders + Inventory screens `79982fb`
- ✅ #70/#71 scheduled reports, unchangeable versions, simulated delivery — engine `f629b49`, Report History screen `8a2c7b6`
- 🟡 #17 intake request limits — tested logic `61ef953`; the form it protects is in the public website project, so nothing to connect here; a real limit must run on the server
- ✅ #72 traceable export labels — shown on the export preview and stamped on the printed report (Nov 14, later)
- ✅ #12/#53 supplier scorecard + document checks — read-only section on Suppliers behind `he_supplier_scorecard` (Nov 14, later; example data)
- ✅ Owner decisions 1, 2, 4 applied inside the invoice and report engines (a draft with a pending tax rate cannot be issued; terms + due date at issue; Central-day roll-up)
- 🟡 #24 screen baselines — measured on the substitute browser only; re-measure in CI. #36 change record — `62eef9c`
- ✅ #08 payment reconciliation review — advisory logic + Accounting section behind `he_reconcile` (Nov 14, later; example data, real use gated)
- 🟡 #26 anomaly detection — reviewed: exists for sales/outreach figures with review states; nothing watches orders, stock or money
- ✅ Launch rehearsal (scanner, wholesale approval, receiving, invoice print, backup restore): 52 passed — recorded `0cd75ad`

## Owner decisions (2026-11-14) — ✅ decided and recorded
Authoritative record: `OWNER_DECISIONS_2026-11-14.md`. This replaces the
"Owner decisions outstanding" list above for tax, terms, invoice issuing,
day boundary, roles and export destination.
- ✅ 1 Illinois tax rule engine (combined live rate still pending the local rate) — `fe9f2f0`
- ✅ 2 payment terms · ✅ 3 numbering · ✅ 4 `America/Chicago` day cutoff — `9b0b2b8`
- ✅ 5 owner + administrator may issue / void; staff draft-only (owner confirmed) — `3f850cb`
- ✅ 6 export destination recorded (owner-side procedure)
- ✅ Decisions 1–2 shown as a worked example in the invoice preview — `5bce21f`
- 🟡 Not yet applied in the flows: tax engine in invoice totals, terms + due date at issue, daily roll-up on the new day function

## Still needed (as of 2026-11-14)
- From the owner: the local tax rate; a go-ahead to push the branch and open a pull request; confirm the required supplier documents; later a business email service, a tracking provider, a real Safari / iPhone / VoiceOver check.
- Engineering: full-suite re-run on the final commit (results in `NOV7_BOUNDED_REVIEW.md`); #24 in CI; decide whether #26 should also watch orders, stock and money; re-take the reference pictures after the owner has looked at the restyled screens.
- **Durability:** branch and recovery export exist only in this session's temporary workspace until pushed or saved by the owner.
