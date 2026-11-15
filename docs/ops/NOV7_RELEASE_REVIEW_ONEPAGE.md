# Nov 7 build — one-page release review (owner)

**Updated Nov 14, 2026.** **Preview build:** branch `claude/ext20-recovery-2026-10-31`,
commit `5bce21f` plus the documentation commit that follows it (local, **unpushed**),
base `9173ccf`. **All new features default-OFF** (localStorage flags:
`he_scan_shipment`, `he_reorder_planning`, `he_report_export`, `he_invoice_preview`,
`he_recovery_drill`, `he_saved_views`, `he_cycle_count`, `he_report_versions`,
`he_supplier_scorecard`, `he_reconcile`, `he_ops_watch`;
Sales & Growth behind `he_sales_growth`).
The owner turns previews on and off with buttons on the **Feature Flags** page
("Preview features"; this browser only) — no typed commands.
**Local & synthetic only** — no production data, live calls, spending, or backups.
**Not behind a switch, by design:** the control-shape and form-layout changes the
owner directed on Nov 3 (square buttons and fields, labelled forms, right-aligned
number columns, original colours kept). The dashboard will look different on merge
even with every switch off; the owner's final look-over of the result is still
open (before/after pictures sent). Measurements in `NOV7_BOUNDED_REVIEW.md`.

The table below is the Nov 9 reconciliation at `59cd1a7`. Work after that (wholesale
W-0…W-5, blueprint items #12–#72, screen wiring, owner decisions) is reconciled item
by item in `NOV7_STAGING_REVIEW_AND_OWNER_CHECKLIST.md`.

## Blueprint reconciliation (B11 phases = the NOV7 blueprint; no doc is literally named "B11-01/02/03" — naming dependency recorded)

| Area (blueprint phase) | Status | Evidence |
|---|---|---|
| B11-01 Scan Shipment (capture→match→confirm→attach) | implemented + verified (synthetic, emulated) | scan-engine/ui/flow/recovery-ext21; cross-order guard wired `0863bc0` |
| B11-02 Operations: invoice / print / export / recovery | implemented + verified (synthetic) | invoice-* , report-* , export-recovery-, invoice-print/slip/report-view, lifecycle, money-props |
| Inventory reorder & cash flow | implemented + verified | reorder-ext21, reorder-view, inv-wholesale-rehearsal, sample-reconcile |
| B11-03 Sales & Growth (Scout, content, ad, reviews, creators, retention) | implemented + verified (engines + journeys) | scout-slice, content-ad-slice, sales-reviews, creator-slice, retention, approval-binding |
| Full desktop suite | 2,138 passed / **14 failed** on Nov 9 (corrected Nov 14; was wrongly recorded as 0 failed) | 10 picture comparisons that cannot pass in the substitute browser; 4 real check failures fixed in `edfe565`; re-run in `NOV7_BOUNDED_REVIEW.md` |
| Full iPhone suite (emulated) | 489 passed / 11 failed / 365 skipped (Nov 9) | 10 picture comparisons (cannot pass in the substitute browser, and the branch does restyle these screens — see `NOV7_BOUNDED_REVIEW.md`) + 1 timing test not re-checked |
| Real invoice issuing / numbering live | implemented-unverified for production | owner decisions made Nov 14 and built as draft-only logic (`OWNER_DECISIONS_2026-11-14.md`); the combined live tax rate is still pending the local rate |
| Real tracking + shipping notifications | absent (simulated only) | provider approval pending (E1) |
| Automatic Mac export sync | absent (named dependency) | separate native component; owner decision O4 |
| Day-boundary DST correctness | decided Nov 14: midnight Central, `America/Chicago`; DST-aware day function built and tested alongside the fixed-offset one (reports not yet switched to it) | `NOV7_DAY_BOUNDARY_POLICY.md`, `OWNER_DECISIONS_2026-11-14.md`, owner-decisions-ext21 |
| Real Safari / physical iPhone / VoiceOver | absent (owner/device) | emulated Chromium only here |

## Draft-PR checks (recorded, remote unchanged)
Open draft PRs #16–#35 are prior "DO NOT MERGE" review packages. The one at my
base is **#35** (`9173ccf`): its "Browser suite (shard 3/3)" shows **failure in one
workflow run (41393623252) but success in a parallel run (41393630587)** — a known
intermittent, at the base commit dated 2026-11-02, **before** this work. The branch
(now 112+ commits) is unpushed, so no CI has run on it; the failing check **does not
apply to this checkpoint**. Local evidence: desktop 2,138 passed / 14 failed and iPhone 489 passed / 11 failed at
`59cd1a7` (Nov 9); 95 tests added since, passing when run on their own; a 52-test launch rehearsal
passed on Nov 14. Full desktop re-run on Nov 14 at `4a99dc0`: 2,239 passed / 16 failed / 46
skipped (10 picture comparisons, 5 stale generated documents since fixed, 1 timing
failure that passed 3 of 3 alone). **Final full pass at `aa81876`: computer 2,285
passed / 10 failed / 49 skipped; phone size 505 passed / 11 failed / 376 skipped** —
the only failures are the picture comparisons and one timing test that fails the
same way on the untouched base. **Latest full pass, Nov 15 at `1a70caf`: computer
2,320 passed / 10 failed / 51 skipped; phone size 507 passed / 11 failed / 387
skipped** — the same failures and nothing else. Details in `NOV7_BOUNDED_REVIEW.md`.

## Six owner decisions — DECIDED Nov 14, 2026
All six were answered by Stas on Nov 14. The answers, what was built from each, and
what is still pending live in one place: **`OWNER_DECISIONS_2026-11-14.md`**
(authoritative — not repeated here).

**Still needed before go-live:** the local tax rate (the combined live rate stays
pending), a business email service, a tracking provider, a real Safari / iPhone /
VoiceOver check, the safe stock-change function (R4), and the owner's review and
merge.

## Rollback
Nothing is live. If merged later and an issue appears: revert the merge commit on
`main` (previous `main` is the immediate parent); all features are flag-OFF so a
flag removal (`localStorage.removeItem('he_*')`) disables any preview instantly
without a deploy. A local recovery export (git bundle + patches + checksums, verified)
is refreshed at each checkpoint; the latest is v47, made late on Nov 14 and sent to the owner as a file. **It lives in this session's temporary workspace and is not a durable
backup** — the branch is preserved for good only once it is pushed to GitHub or the
export file is saved by the owner.

## Known limits
Previews are SIMULATED review tools, not production actions. Invoice issuing,
tracking/notifications, exports/Mac sync, and real-device camera stay OFF until the
matching decision/approval. iPhone visual-regression + the one perf test are
unverified on the CI browser here (diagnostic-browser version mismatch). Physical
Safari/iPhone/VoiceOver not covered.
