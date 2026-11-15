# Nov 7 → owner-reviewable staging review + owner checklist

Status: CURRENT · As of 2026-11-14 · For: Stas · Local/synthetic, default-OFF,
draft/simulated only. Branch `claude/ext20-recovery-2026-10-31` (unpushed).
Nothing deployed, merged, pushed, or sent. Recovery snapshot refreshed (see end).

This is the end-to-end staging review with linked evidence, the #24/#36 records,
and the owner review checklist. It reconciles the original blueprint by ID and
tracks the newer approved agent/wholesale work separately, as requested.

---

## 1. Blueprint reconciliation — before → after (this session)

Counts are by blueprint ID. "Verified (staging)" = implemented locally + backed
by a passing synthetic test at this checkpoint. "Production" is tracked
separately and is **0/90 by design** — nothing is deployed; every new feature is
default-OFF and every external action is simulated.

| ID | Item | Before | After | Evidence (spec / commit) |
|---|---|---|---|---|
| #21 | Manual fallback + pause/recovery | partial | **verified (staging)** | ops-fallback-ext21 · `fa8bc11` |
| #25 | Service health (stale/last-success/error + next action) | partial | **verified (staging)** | sales-health-ext21 · `f9625c2` |
| #27 | Complaint trends (packaging/pump/quality) | open | **verified (staging)** | sales-feedback-ext21 · `8689ddf` |
| #54 | Cycle counts (draft count + discrepancy) | open | **verified (staging)** | inventory-count-ext21 · `49c422a` |
| #55 | Adjustment approval + audit | open | **verified (staging)** | inventory-count-ext21 · `49c422a` |
| #65 | Saved views & filters (engine) | open | **verified (staging, engine)** | saved-views-ext21 · `4542476` |
| #70 | Scheduled reports | partial | **verified (staging)** | report-schedule-ext21 · `f629b49` |
| #71 | Report versioning + reruns | partial | **verified (staging)** | report-schedule-ext21 · `f629b49` |
| #17 | Public intake protections (request limits) | open | **verified (staging)** | intake-export-guard-ext21 · `61ef953` |
| #72 | Export watermarking (traceable label) | open | **verified (staging)** | intake-export-guard-ext21 · `61ef953` |
| #12 | Supplier scorecard (delivery accuracy) | open | **verified (staging, read-only)** | supplier-scorecard-ext21 · `c2d69ea` |
| #53 | Supplier document validation | open | **verified (staging, read-only)** | supplier-scorecard-ext21 · `c2d69ea` |

**This session moved 12 blueprint IDs from open/partial → verified-staging.**
Earlier sessions verified the B11 phases, the operations/invoice/report items
(#4/#5/#6 and the invoice-* / report-* suites), and the scanner (B11-01). The
full desktop suite was **2,138 passed / 14 failed** on Nov 9 (corrected Nov 14: 10
picture comparisons that cannot pass in this environment, 4 real check failures
fixed in `edfe565`; sharded; see
`NOV7_BOUNDED_REVIEW.md`); this session added **69** new synthetic engine tests,
all green.

**Production (deployed & verified): 0/90 — by design.** No item is live; this is
a staging/review build.

## 2. Newer approved work (tracked separately from the 90-item blueprint)

The Sales & Growth / wholesale additions are a NEW subsystem on top of the
original blueprint, kept separate here so the 90-item baseline stays honest.

| Area | State | Evidence |
|---|---|---|
| W-0 in-person visit log (wired panel) | verified (staging) | sales-visit-ext21 · `2b02bc4` |
| W-1..W-5 engines + 5 default-OFF panels | verified (staging) | sales-repurpose/advariants/feedback/creatoroffer/retentionreminder-ext21 · `074e3ab` |
| Service Health panel (+ manual-fallback section) | verified (staging) | sales-wiring-ext20j · `f9625c2`, `fa8bc11` |

All behind `he_sales_growth` (OFF by default); draft-only; nothing sent/spent/gifted.

## 3. End-to-end staging review (synthetic, read-only) — evidence links

| Journey | Status | Evidence (specs) |
|---|---|---|
| **Scanner / fulfillment** | verified (emulated) | scan-engine/ui/flow/recovery-ext21, fu4-scan-journey-ext21 |
| **Wholesale** (lead→draft→approve→reply→follow-up→visit) | verified | sales-import, sales-leads, approval-binding-ext21, sales-replies-followup, sales-visit-ext21 |
| **Inventory** (receive, reorder, cycle count + adjustment) | verified | po-receive, reorder-ext21, inventory-count-ext21 |
| **Invoice drafts** (draft→issue→print→credit note) | verified | invoice-ext21, invoice-lifecycle-ext21, invoice-print-ext21, invoice-creditnote-ext21 |
| **Backup / restore** (manifest + isolated scratch restore) | verified | export-recovery-ext21, recovery-compat-ext21, recovery-drill-wiring-ext21 |

All synthetic; real providers/devices remain out of scope (section 5).

## 4. #24 measured screen baselines & #36 change/release record

### #24 — Screen baselines (launch-critical)
Baselines are captured by dedicated specs, run on the diagnostic browser:
- `performance-scale.spec.js` — list screens under large synthetic data.
- `palette-perf-ext20.spec.js` — command palette responsiveness.
- `request-baseline.spec.js` — network/request count baseline (no surprise calls).
- `sales-decision-perf-ext20k.spec.js` — decision panels render-once, no DOM growth on revisit (leak check).
Recorded caveat: iPhone visual-regression + one perf test are unverified on the
CI browser here (diagnostic-browser build mismatch) — an environment artifact,
not a regression (`NOV7_BOUNDED_REVIEW.md`). Re-measure on the CI browser build
before go-live.

### #36 — Change / release record (this build)
- **Tested revision:** `claude/ext20-recovery-2026-10-31` HEAD (see §6), base `9173ccf`.
- **What changed:** 12 blueprint IDs (§1) + the W-series panels (§2), all
  default-OFF / draft-only / synthetic; no production code path altered.
- **Owner review steps:** see "How to look at the new features" in section 5 —
  on/off buttons on the Feature Flags page (no typed commands).
- **Rollback:** nothing is live. If merged later, revert the merge commit on
  `main` (previous `main` is its parent); every new feature is off by default, and
  "Turn all off" on the Feature Flags page hides any preview at once with no deploy.
  Local recovery snapshot restores this exact checkpoint (§6).

## 5. Owner review checklist

### The six decisions — DECIDED Nov 14, 2026
Answered by Stas on Nov 14. The answers, what was built from each, and what is not
yet applied are recorded in one place: **`OWNER_DECISIONS_2026-11-14.md`**
(authoritative — not repeated here). Section 9 below summarises the build.

### How to look at the new features (no typed commands)
This works wherever the branch's dashboard is open (a preview copy, or the live
site after a merge). Nothing here is on by default.

1. Sign in as the owner (or an administrator).
2. Open **Feature Flags** in the sidebar and scroll to **Preview features**.
3. Press **Turn on** next to the feature you want to see, then **Reload now**.
4. Open the page named in the "Where it appears" column.
5. When finished, press **Turn all off**, then **Reload now**.

A switch is remembered by that browser on that device only. It is not saved to the
database, nobody else sees a change, and each preview uses example data or is
read-only — nothing is sent, issued, charged or written to stock.

| Preview | Where it appears | What to look for |
|---|---|---|
| Scan Shipment | Home and Orders | A scan button; typing a label number finds its order |
| Reorder planning | Inventory | What to reorder and the cash it needs |
| Saved views | Orders and Inventory | Save a filter under a name, reload, bring it back |
| Cycle count review | Inventory | Count differences; only the owner can approve; stock is not changed |
| Supplier scorecard | Suppliers | On-time deliveries and missing or expiring documents |
| Payment reconciliation | Accounting | Each difference is named; closing one needs a written note |
| Operations watch | Report History | Unusual daily figures, stock and orders, most serious first |
| Export preview and report print | Report History | Package contents, checksum, trace label, print layout |
| Report versions | Report History | Kept versions, a rerun adds a version, delivery is simulated |
| Invoice preview | Report History | Your tax and terms rules. Try the review desk: "Issue" is refused while the local rate is pending; type a rate (for example 2.75), confirm, issue, then void with a reason |
| Export recovery drill | Report History | A good package opens; a damaged one is refused |
| Sales & Growth pages | Sidebar | The draft-only sales and wholesale pages. At the bottom of **Sales & Growth → Approvals**, the **Outreach workbench** runs the whole path on one screen: press "Load the example store list", draft an email to a store, approve it, "Send (simulated)" (nothing is sent), then record a reply. Reload the page: it is all still there. "Reset workbench" clears it |

Also sent separately: before/after pictures (`restyle-review.html`) of the control
and form styling the owner directed on Nov 3, for the owner's final look-over.

### Still needed from the owner
- **The local tax rate** for the business location (the 6.25% Illinois state rate is
  in; the combined live rate stays pending until this is confirmed).
- **A go-ahead to push the branch and open a pull request** — the step that makes the
  work durable on GitHub and reviewable. Merging stays the owner's action.
- **Required supplier documents** — confirm the assumed list (insurance, W-9,
  certificate of analysis) used by the supplier document check (#53).
- **Later, before any real invoice:** a review and explicit approval of the invoice
  storage draft (`sql/drafts/32_DRAFT_invoices.sql`). It adds two new tables and
  the access rules for them; nothing is installed until the owner runs it. The
  dashboard code that will use it is ready and tested, but not connected.
- **One permission question:** should an administrator also be allowed to approve
  stock-count adjustments? Today only the owner can (blueprint #55).
- **The final look-over of the control and form styling** you directed on Nov 3
  (before/after pictures were sent as `restyle-review.html`). New reference
  pictures for the picture-comparison tests are taken only after this.
- **When convenient: run read-only Query I**
  (`sql/12_READONLY_I_report_day_cutoff.sql`). It changes nothing; it shows which
  day cutoff the nightly report uses today, which decides whether the Central-time
  cutoff (decision 4) needs a database change.

### Device & provider checks (separate from mocks — owner/device required)
- **Real Safari / physical iPhone / VoiceOver** — only emulated Chromium here; verify on a real device.
- **Business email provider** — required before any real report/notification delivery (#70/#71 delivery is simulated).
- **Real tracking + shipping notifications** — provider approval (simulated only today).
- **`adjust_inventory` (R4)** — the safe stock-write contract named by the visit log, creator offers and cycle-count adjustments; not in the local build.

## 6. Checkpoint & recovery

- Branch `claude/ext20-recovery-2026-10-31`, unpushed; working tree clean.
- A recovery export (git bundle + patches + checksums, verified) is refreshed at each
  checkpoint; the latest is v51, made on the evening of Nov 15 (sent to the owner as a file).
- **Durability warning:** the branch and the export both live in this session's
  temporary cloud workspace. They are preserved for good only once the branch is
  pushed to GitHub or the export file is saved by the owner.

## 7. Remaining estimate to an owner-reviewable package

An estimate, not a measurement. Everything in sections 1–3, 8 and 9 can be reviewed
now on the branch (features default-OFF). Remaining engineering before one clean
review package:
- **Done later on Nov 14:** #72, #12 and #53 connected to their screens; the Nov 14
  decisions applied inside the invoice and report engines (see section 10). #17
  stays logic-only — the form it protects is in the public website project.
- **Done Nov 15:** #08 and #26 audited and built (Nov 14); full passes at `4c5efc9`
  and `05fc2b7`; the sales path runnable end to end; the dashboard side of invoice
  storage; keyboard and screen-reader fixes.
- **Left:** re-measure #24 baselines in CI once the branch is pushed; new reference
  pictures once the owner has accepted the look.
- **Owner-side (not engineering time):** the items in section 5, then review and merge.

## 8. Wiring wave (2026-11-14) — engine → dashboard journey

Three engine-tested items were wired into the live dashboard behind default-OFF
flags (host-div pattern: flag OFF → host empty → these three additions show nothing;
measured Nov 14: page heights equal the Nov 9 heights. This is about these additions
only — the branch's earlier styling commits do change how the screens look with
every flag off, see `NOV7_BOUNDED_REVIEW.md`). Each is
now **dashboard-journey verified** (browser test), advancing from the "engine"
stage to the "journey" stage (not counted twice).

| ID | Journey wired | Flag | Evidence (spec · commit) |
|---|---|---|---|
| #65 | Saved views on Orders + Inventory: save → persist across reload → restore → reset → delete; per-screen; labelled keyboard-focusable controls | `he_saved_views` | saved-views-wiring-ext21 (4) · `79982fb` |
| #54/#55 | Cycle count on Inventory: discrepancies, owner-only approval boundary shown live, advisory adjustment (applied=false, R4 named), audit trail | `he_cycle_count` | cycle-count-wiring-ext21 (2) · `44b4822` |
| #70/#71 | Report versions in Report History: schedule/missed-day, immutable versions + rerun (v2 appended), simulated delivery (SENT, delivered=false) | `he_report_versions` | report-versions-wiring-ext21 (2) · `8a2c7b6` |

Regression on the live screens with flags OFF: modules-ext15 (12), csp-strict +
pages-strict + pages-data (53) — all green.

### Stage reconciliation (this branch, baseline = original ~90-item blueprint)
- **Dashboard journey verified** (wired + browser test): #21, #25, #27, #65, #54, #55, #70, #71 (8) — plus newer W-0…W-5 panels, tracked separately.
- **Engine tested** (synthetic test, not yet wired to a live screen): #17, #72, #12, #53 (4). *Superseded later on Nov 14 — see section 10: #72, #12, #53 moved to journey-verified; #17 remains.*
- **Live verified (deployed):** 0 — nothing pushed/merged/deployed.

### Launch rehearsal (2026-11-14, diagnostic browser)
52 passed across scanner flow + recovery (split shipments, duplicate, outage),
wholesale approval binding, PO receive, invoice print view, and export/backup
recovery — no launch blocker found.

### #24 baselines — status
Baselines captured on the **diagnostic browser** (performance-scale,
request-baseline, sales-decision-perf — all green). Remeasuring on the **CI
browser build (1194)** is **blocked in this environment**: that build is not
installed here (only the diagnostic build is), which is the same known
diagnostic-browser mismatch recorded in `NOV7_BOUNDED_REVIEW.md`. CI-build
remeasurement must run in CI. Not a regression — an environment limitation.

### Still open (engine done; live-entry-point wiring remaining)
- **#17 / #72** request limits + export labels: engines tested; wiring into the
  live inquiry-submit path and the live export action is the remaining step.
- **#12 / #53** supplier scorecard: engine tested (read-only, derived); a
  Suppliers-screen surface is the remaining step.
- **#08 reconciliation / #26 anomaly** review-state audit: not yet started.

---

## 9. Owner decisions wave (2026-11-14)

The six decisions were made and recorded (`OWNER_DECISIONS_2026-11-14.md`). Built
from them, all draft-only and default-OFF:

| Decision | Built | Evidence (spec · commit) |
|---|---|---|
| 1 Tax | Illinois rule engine: 6.25% state, combined rate PENDING until the local rate is confirmed; shipping taxable when mandatory/bundled, exempt when separately stated and avoidable; resale exempt only with a valid certificate | tax-ext21 (6) · `fe9f2f0` |
| 2 Terms | Due on receipt by default; Net 14 for a credit-approved account; due-date helper | owner-decisions-ext21 · `9b0b2b8` |
| 3 Invoices | `HE-YYYY-NNNN`, per-year, number assigned at issue; a voided invoice keeps its number and the number is never reissued | owner-decisions-ext21 · `9b0b2b8` |
| 4 Day cutoff | Midnight Central via `America/Chicago`, daylight saving handled (summer and winter verified) | owner-decisions-ext21 · `9b0b2b8` |
| 5 Permissions | Owner and administrator may issue / void; staff cannot (owner confirmed administrator keeps this) | owner-decisions-ext21 · `3f850cb` |
| 6 Exports | Recorded as an owner-side procedure; export labels default to CONFIDENTIAL | intake-export-guard-ext21 · `61ef953` |

The invoice preview (`he_invoice_preview`) shows decisions 1–2 as a worked example
(ops-preview-wiring-ext21 · `5bce21f`). What is built but not yet applied in the
invoice and report flows is listed in the decisions record and in section 7.

---

## 10. Second wiring wave + decisions inside the engines (2026-11-14, later)

| ID | What changed | Flag | Evidence |
|---|---|---|---|
| #72 | Trace label shown on the export preview (bound to the export's checksum, self-checking) and stamped on the printed report | `he_report_export` | ops-preview-wiring-ext21, report-print-view-ext21 |
| #12 / #53 | Read-only supplier scorecard on Suppliers: delivery accuracy (a delivery with no recorded date is "unknown", never "on time") and required-document status | `he_supplier_scorecard` | supplier-scorecard-wiring-ext21 (2) |
| #08 | Payment reconciliation review on Accounting: expected vs recorded, every difference named (short, over, nothing recorded, not expected, listed twice, amount unknown), closed only with an owner/administrator note; closing never changes a figure | `he_reconcile` | reconcile-ext21 (8), reconcile-wiring-ext21 (2) |
| #26 | Operations watch on Report History: unusual daily figures, stock and orders, most serious first, each with a suggested next step; "Mark as seen" records who looked and does not clear the flag | `he_ops_watch` | ops-anomaly-ext21 (10), ops-watch-wiring-ext21 (2) |
| Decision 1 | Invoice engine taxes mandatory shipping, exempts a certified resale order, and **refuses to issue a draft whose rate is pending** | — (engine) · shown under `he_invoice_preview` | invoice-decisions-ext21 (8), ops-preview-wiring-ext21 |
| Decision 2 | Issuing for a named account fills in terms and due date | — (engine) | invoice-decisions-ext21 |
| Decision 4 | Daily roll-up can group by Central-time day, tested on both daylight-saving change days | — (engine) | owner-decisions-ext21 (6) |

**Stage reconciliation after this wave** (same ~90-item baseline, each ID counted once
at its highest stage):
- **Dashboard journey verified (13):** #08, #12, #21, #25, #26, #27, #53, #54, #55, #65, #70, #71, #72.
- **Engine tested only (1):** #17.
- **Documents (2):** #24, #36.
- **Live verified:** 0.

Also done in this wave: an accessibility and phone-size sweep with every operations
switch ON (ops-flags-a11y-ext21 — this area had no such coverage; it found a
dark-mode contrast fault on the "SIMULATED" badge, now fixed); the reconciliation
section's logic can read invoice records; and read-only Query I for the day cutoff.
The full re-run of Nov 14 is recorded in `NOV7_BOUNDED_REVIEW.md`.
