# Five priority areas: what is verified, what was added, what remains

Status: CURRENT · 2026-11-16 (later) · For: Stas
Scope: staging only — the local test browser (Chromium on Linux) and throwaway
local databases, made-up data. Nothing here is live. "Verified" below means
"verified in staging", never "live".

Blueprint numbering: only the items worked on are numbered in this repository
(#08, #12, #17, #21, #24–#27, #36, #53–#55, #65, #70–#72). The full 90-item list
is your Sept 26 recount and is not stored here, so areas without a number are
named by the earlier phase that built them.

All tests named below were rerun on this commit: 276 browser and Node tests
passed (0 failed; 41 skipped because they run at one screen size only), plus the
database tests listed.

## 1. Invoices (Phase 2 items 9–10; invoice decisions of Nov 14 and 16)

| Check | Evidence | Status |
|---|---|---|
| Draft editing | `invoice-corrections-ext21` "draft edits preserve a history trail (prior totals kept on each revision)"; database: drafts editable, issued invoices refused (`invoices_test.sh`, 87/87) | verified earlier, rerun |
| Print layout | `invoice-print-view-ext21` (US-Letter, repeated headings, totals last, TAX PENDING mark) | verified earlier, rerun; **fixed today**, see below |
| Duplicate issuance | `invoice-desk-ext21`; database: the same draft issued 12 times at once gets one number; 20 invoices at once get 20 consecutive numbers (`invoices_test.sh`) | verified earlier, rerun |
| Void history | `invoice-desk-ext21` "voiding needs a reason, keeps the number on the record, and the number is never reused"; database records who voided, when and why | verified earlier, rerun |
| Pending tax never $0.00, never issued | `tax-pending-sweep-ext22` (new today, see the tax section) | **added today** |

**Found and fixed today:** a printed *draft* carried the next invoice number
(HE-2026-0001), although numbers are only given when an invoice is issued. A
numbered printout could be mistaken for a real invoice. A draft now prints
"Invoice (draft — numbered when issued)". New test in `invoice-print-view-ext21`.

## 2. Inventory (blueprint #54, #55)

| Check | Evidence | Status |
|---|---|---|
| Approving a stock adjustment twice changes stock only once | `docs/ops/sql/local-test/stock_count_apply_once_test.sh` (new, 17/17): approving again, and ten times at once, decides once and changes no stock; applying the approved figure through the safe stock function, once, again, and five times at once, changes stock **once** and writes **one** stock-history row | **added today** |
| Audit history | the same test: the approval record (original 40, requested 38, reason, proposer, decider, times) can no longer change or be deleted; the stock-history row names who, the change and the approved count | **added today** |
| Partial receiving | the dashboard receives a purchase order **as a whole**, tested against drops, retries, second clicks, stale tabs and lines changed elsewhere (`po-receive`, 20 tests); receiving **part** of an order's quantity exists only in the wholesale reconcile engine (`inv-wholesale-rehearsal-ext21`: never double-counts, never credits more than is in transit) | whole-order receive verified; **part-quantity receive not built** (see "remaining") |
| Returns | `failure-recovery`, `inventory-safety`: the return is claimed first, a dropped claim changes nothing, a retry restocks once | verified earlier, rerun |

Note for the later "apply" step: draft 34 keeps an `applied_at` field for it,
but its guard lets nothing change after a decision, so the apply step will need
its own small change to record "applied". Real stock writes stay gated: there is
no apply button.

## 3. Receipt scanner (Nov 7 Phase 1, Scan Shipment, B11-01)

| Check | Evidence | Status |
|---|---|---|
| Match a carrier receipt to the right order (made-up examples) | `scan-engine-ext21`, `scan-flow-ext21`, `fu4-scan-journey-ext21` | verified earlier, rerun |
| Several possible orders: show the options, require confirmation before saving | `scan-engine-ext21` "rankOrders: same name + ZIP returns multiple matches, none auto-picked"; `scan-flow-ext21` "same-name accounts produce a chooser, never an auto-pick"; "a no-name receipt never auto-picks" | verified earlier, rerun |
| Duplicate scans | "a duplicate scan of the same label attaches nothing the second time"; "scan attaches once to the partial shipment even when the label is scanned twice" | verified earlier, rerun |
| Simulated notification retries | "a provider outage holds the notification with a safe retry; the attach is kept" | verified earlier, rerun |

Real iPhone camera, Safari and VoiceOver: your checks (device list in the review package).

## 4. Backups and printing (blueprint #70, #71, #72; recovery drill)

| Check | Evidence | Status |
|---|---|---|
| Daily export across the Chicago day cutoff | `docs/ops/sql/local-test/daily_export_restore_test.js` (new, 20/20): 11:30 pm Central counts on that day and 12:30 am on the next, also on the nights daylight saving starts and ends; a control shows UTC counting would split them differently | **added today** |
| Restore one export into a disposable database | same test: a brand-new empty database, the export restored, the rows read back reproduce the export's checksum exactly; restoring twice adds nothing; a tampered export and a newer-version export are refused before anything is written; the database is dropped afterwards | **added today** |
| Whole-database restore drill | `restore_drill.sh` (6/6): backup, restore into a new database, same row counts, the original unchanged | verified earlier, rerun |
| Print preview of the daily report | `report-print-view-ext21`; picture in the review package (`print-previews/daily-report.png`) | verified earlier, rerun; **picture added** |

**Found and fixed today:** an export re-read after restoring turned "UNKNOWN"
(a figure never measured) into a blank, so any restored export with an unknown
figure could never be checked against its own checksum. UNKNOWN now stays
UNKNOWN (and unreadable text becomes UNKNOWN, never blank, never 0). Regression
test in `report-export-ext21`.

## 5. Sales workflow (SG and W items)

| Check | Evidence | Status |
|---|---|---|
| Store lead → draft email → exact-version approval → mock outbox → follow-up | `sales-endtoend-ext21`, `sales-workbench-ext21`, `sales-workbench-wiring-ext21` | verified earlier, rerun |
| Editing an approved draft needs a new approval | `approval-binding-ext21` "editing an APPROVED draft returns it to review (approval invalidated)" | verified earlier, rerun |
| A reply stops automated follow-up | `sales-replies-followup-ext20j` "a newer reply supersedes a pending follow-up" | verified earlier, rerun |
| An opt-out stops automated follow-up | `sales-replies-followup-ext20j` "opt-out / declined / bounced / do-not-contact never get a follow-up"; `approval-binding-ext21` "opt-out after approval supersedes the approval" | verified earlier, rerun |

Nothing is sent: the outbox is simulated, and the Gmail connector stays off-limits.

## Also found today by the module robustness probe

`he-supplier-docs-store.js` (new today) failed on malformed input in one
function; fixed (the probe now passes 75/75).

## Remaining in these areas (not built, and why)

| Item | Why it is not built | Needs |
|---|---|---|
| Receiving part of a purchase order's quantity | changes how real stock is written; real stock writes stay gated. **Nov 21:** rules prototype and worked example built (`PARTIAL_RECEIVING_RULES_2026-11-21.md`) | your decision D-ops-5, then a reviewed database change |
| Partial-quantity returns (backlog INV-17, decision D-ops-5) | the same; **Nov 21:** sellable/damaged split in the same prototype | your decision D-ops-5 |
| Applying an approved stock count to stock | gated by your standing rule | drafts 10 and 34 installed, then its own approval |
| Real notification and email delivery | no live messages | an email provider decision |

## Nov 22 additions (independent gaps; staging only)

| Area | Check | Evidence | Status |
|---|---|---|---|
| Backups | A backup restored **with the pending drafts installed** keeps every protection: row-level security on all 11 new tables, identical rules, guards, functions (caller's rights, fixed search path) and permissions; identical records; the invoice counter carries on (the next invoice gets the next number); on the copy an administrator still cannot approve a stock count or a supplier document, an issued invoice still cannot be edited, staff and administrators still cannot open a stored file, nobody can delete review history | `docs/ops/sql/local-test/restore_with_drafts_test.sh` (new, 32/32) | **added** |
| Backups | **Found and fixed:** the Oct 7 restore drill's clean-up removed its test order lines by their own (random) id, so each run left about 2,000 order lines pointing at deleted orders in the local template database, and a backup of it could no longer be restored. Clean-up fixed; the new test checks the template first | `restore_drill.sh` 6/6, template clean afterwards | **fixed** (local test harness only; production untouched) |
| Failed saves | Attaching a supplier document file when the reply is lost: the page redraws with the file attached, once | `supplier-docs-storage-ext22` (new test) | **added** |
| Failed saves | **Found and fixed:** retrying the attach from a page that had not redrawn said "The file was not stored" although the file was attached. The page now reads the document back and says "That file is already attached"; a different file afterwards is refused | `supplier-docs-storage-ext22` (new test) | **fixed** |
| Receipt scanner, sales follow-up | Already verified on Nov 16 (sections 3 and 5 above); rerun in the final full pass | — | skipped, verified |
