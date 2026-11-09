# Nov 7 build — one-page release review (owner)

**Preview build:** branch `claude/ext20-recovery-2026-10-31`, commit `59cd1a7`
(local, **unpushed**), base `9173ccf`. **All new features default-OFF** (localStorage
flags: `he_scan_shipment`, `he_reorder_planning`, `he_report_export`,
`he_invoice_preview`, `he_recovery_drill`; Sales & Growth behind `he_sales_growth`).
**Local & synthetic only** — no production data, live calls, spending, or backups.

## Blueprint reconciliation (B11 phases = the NOV7 blueprint; no doc is literally named "B11-01/02/03" — naming dependency recorded)

| Area (blueprint phase) | Status | Evidence |
|---|---|---|
| B11-01 Scan Shipment (capture→match→confirm→attach) | implemented + verified (synthetic, emulated) | scan-engine/ui/flow/recovery-ext21; cross-order guard wired `0863bc0` |
| B11-02 Operations: invoice / print / export / recovery | implemented + verified (synthetic) | invoice-* , report-* , export-recovery-, invoice-print/slip/report-view, lifecycle, money-props |
| Inventory reorder & cash flow | implemented + verified | reorder-ext21, reorder-view, inv-wholesale-rehearsal, sample-reconcile |
| B11-03 Sales & Growth (Scout, content, ad, reviews, creators, retention) | implemented + verified (engines + journeys) | scout-slice, content-ad-slice, sales-reviews, creator-slice, retention, approval-binding |
| Full desktop suite | verified GREEN | 16 shards, 2,138 passed / 0 failed (`NOV7_BOUNDED_REVIEW.md`) |
| Full iPhone suite (emulated) | verified w/ caveats | 489 passed / 365 skipped; 11 failures are override/env artifacts (visual pixel-diffs + 1 perf), not regressions |
| Real invoice issuing / numbering live | implemented-unverified for production | owner decisions O1 pending (tax/terms/issuing) |
| Real tracking + shipping notifications | absent (simulated only) | provider approval pending (E1) |
| Automatic Mac export sync | absent (named dependency) | separate native component; owner decision O4 |
| Day-boundary DST correctness | implemented (fixed offset); policy open | `NOV7_DAY_BOUNDARY_POLICY.md` (O2) |
| Real Safari / physical iPhone / VoiceOver | absent (owner/device) | emulated Chromium only here |

## Draft-PR checks (recorded, remote unchanged)
Open draft PRs #16–#35 are prior "DO NOT MERGE" review packages. The one at my
base is **#35** (`9173ccf`): its "Browser suite (shard 3/3)" shows **failure in one
workflow run (41393623252) but success in a parallel run (41393630587)** — a known
intermittent, at the base commit dated 2026-11-02, **before** this work. My 80
commits are unpushed so no CI ran on `59cd1a7`; the failing check **does not apply
to this checkpoint**. Current local evidence: desktop 2,138/0, iPhone 489 pass.

## Six pending owner decisions (LEFT OPEN — needed before go-live)
1. **Tax rate** (and whether tax applies to shipping)
2. **Payment terms** (e.g. due-on-receipt / net-14)
3. **Invoice issuing**: manual vs automatic (+ confirm numbering `HE-YYYY-NNNN`)
4. **Day-boundary convention**: fixed offset vs IANA/DST-aware
5. **Roles**: who besides owner may issue/void invoices and release held notifications
6. **Export destination** + whether to enable automatic Mac sync later

## Rollback
Nothing is live. If merged later and an issue appears: revert the merge commit on
`main` (previous `main` is the immediate parent); all features are flag-OFF so a
flag removal (`localStorage.removeItem('he_*')`) disables any preview instantly
without a deploy. Local recovery export v37 (`scratchpad/recovery-v37/`) restores
this exact checkpoint (bundle + checksums + tree-match verified).

## Known limits
Previews are SIMULATED review tools, not production actions. Invoice issuing,
tracking/notifications, exports/Mac sync, and real-device camera stay OFF until the
matching decision/approval. iPhone visual-regression + the one perf test are
unverified on the CI browser here (diagnostic-browser version mismatch). Physical
Safari/iPhone/VoiceOver not covered.
