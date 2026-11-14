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
full desktop suite stands at **2,138 passed / 0 failed** (sharded; see
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
- **Owner review steps:** enable `he_sales_growth` in localStorage to see the new
  Sales & Growth pages; everything else is engine + tests (run `npm test`).
- **Rollback:** nothing is live. If merged later, revert the merge commit on
  `main` (previous `main` is its parent); every new feature is flag-OFF so
  `localStorage.removeItem('he_*')` disables any preview instantly with no deploy.
  Local recovery snapshot restores this exact checkpoint (§6).

## 5. Owner review checklist

### The six decisions (each with the exact input needed)
1. **Tax rate** — the % to charge, and whether tax also applies to shipping.
2. **Payment terms** — e.g. due-on-receipt vs net-14 (and any per-customer terms).
3. **Invoice issuing** — manual vs automatic, and confirm the numbering format `HE-YYYY-NNNN`.
4. **Day-boundary convention** — fixed UTC offset vs IANA/DST-aware (which timezone).
5. **Roles** — who besides the owner may issue/void invoices and release held notifications.
6. **Export destination** — where exports go, and whether to enable automatic Mac sync later.

### Device & provider checks (separate from mocks — owner/device required)
- **Real Safari / physical iPhone / VoiceOver** — only emulated Chromium here; verify on a real device.
- **Business email provider** — required before any real report/notification delivery (#70/#71 delivery is simulated).
- **Real tracking + shipping notifications** — provider approval (simulated only today).
- **`adjust_inventory` (R4)** — the safe stock-write contract named by the visit log, creator offers and cycle-count adjustments; not in the local build.

## 6. Checkpoint & recovery

- Branch `claude/ext20-recovery-2026-10-31`, unpushed; working tree clean.
- Recovery snapshot in `scratchpad/recovery-v42/` at this HEAD (bundle verified,
  checksums OK) — restores the exact checkpoint.

## 7. Remaining estimate to owner-reviewable staging

The staging build is **owner-reviewable now** for the items in §1–§3 (engine +
tests green; features default-OFF). Remaining to a fully wired review build:
- **~1 focused day:** wire #65 saved-views + #54/#55 cycle-count + #70/#71 report
  schedule into their panels (engines are done & tested; wiring follows the W-0
  pattern) and add keyboard/mobile e2e for those panels.
- **~0.5 day:** re-measure #24 baselines on the CI browser build and finalize the
  #36 record.
- **Owner-blocked (not on the engineering clock):** the six decisions + device/
  provider checks in §5.

So: **~1.5 focused engineering days** to a fully-wired, re-measured staging build;
go-live then waits only on the owner decisions and provider/device approvals.
