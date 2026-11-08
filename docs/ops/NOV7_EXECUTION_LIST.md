# Nov 7 build — dependency-ordered execution list (wave-2 item 8)

Blueprint: **Nov 7 operations build** on branch `claude/ext20-recovery-2026-10-31`
(local, unpushed). Prepared 2026-11-08. Everything below stays local/synthetic
until an owner acts. Three tracks: **LOCAL** (Claude can do now), **OWNER REVIEW**
(a decision), **EXTERNAL** (a provider/device). Items are ordered so each row's
dependencies sit above it.

## Current verified checkpoint

Wave 1 (items 1–11) and wave 2 (items 1–7) are committed and green; bounded
review 182 passed / 0 failed (`NOV7_BOUNDED_REVIEW.md`); recovery export verified
(latest `scratchpad/recovery-v*/`). The full 2118-test suite is PENDING (does not
finish in one window).

## LOCAL — runnable now, no owner input

| # | Open item | Next runnable change | Acceptance check | Evidence to close |
|---|-----------|----------------------|------------------|-------------------|
| L1 | Export preview uses a synthetic day-set, not live rows | NOTE (verified 2026-11-08): `PANEL_LOADERS` run in parallel (`Promise.all(fns.map(safeRun))`, owner-login-app ~L3230), so simply reading `REPORT_HISTORY_DATA` races `loadReportHistory`. The real change is a render-after-load hook: expose a read accessor on `he-reports` AND have `loadReportHistory` invoke a registered "reports loaded" callback that re-runs `loadReportExportPreview`; keep the synthetic fallback when no rows are loaded | with the flag on and saved reports present, the export card's row count + range match Report History after load completes | a browser spec asserting the card reflects the loaded rows once loaded; modules-ext15 + module-map regen still green |
| L2 | Recovery drill is engine-only | add a small read-only panel (behind a flag) that runs `openPackage` on a chosen synthetic package and shows ok / rejected-stage | flag OFF renders nothing; flag ON shows a clean open and a rejected (bad-checksum) case | a wiring spec like ops-preview-wiring; no TT/CSP violation |
| L3 | Print models are data, not a rendered page | add a print-only HTML view (new tab / print stylesheet) that lays out `invoicePrint` / `packingSlipPrint` pages | a 2-page invoice prints with repeating headings and totals on the last page | a browser spec capturing the print DOM; a11y pass |
| L4 | Full-suite confidence | run the suite in reproducible shards on CI (or several windows) and record counts | all shards green except the known `inventory-safety` test.fail | shard logs + counts appended to `NOV7_BOUNDED_REVIEW.md` |
| L5 | Day-boundary policy (if owner picks IANA) | replace `businessDate`'s fixed offset with a zone-aware local-date calc; pass the store zone from config | the near-midnight summer order lands on the DST-correct day; report/history/export agree | update `dst-boundary-ext21`; `NOV7_DAY_BOUNDARY_POLICY.md` marked resolved |

L1 is the highest-priority local item (it makes the export preview reflect real
saved reports). It depends on nothing above it.

## OWNER REVIEW — needs a decision before the matching LOCAL work goes live

| # | Decision | Unblocks | Evidence waiting |
|---|----------|----------|------------------|
| O1 | Invoice numbering + issuing trigger + payment terms + tax | real invoice issuing (engine already owner-gated) | invoice-ext21, invoice-corrections-ext21 |
| O2 | Day-boundary convention (fixed offset vs IANA zone) | L5; consistent report/history/export dates | NOV7_DAY_BOUNDARY_POLICY.md |
| O3 | Role policy: who may issue/void invoices, release held notifications | role gating sign-off | role-boundary-ext21, role-matrix |
| O4 | Export destination + encryption/recovery scope | L2 going beyond a drill; real archive | export-recovery-ext21 |

## EXTERNAL — provider / device

| # | Dependency | Unblocks |
|---|-----------|----------|
| E1 | Carrier + notification provider approval | real tracking + shipping notifications (today queued states) |
| E2 | Real-device camera + printed-text OCR | scanner capture beyond fixtures |
| E3 | Automatic Mac background sync component | off-machine export sync (named separate; backups untouched) |
| E4 | Real-order data wiring scope | scanner search over live accessible orders |

## Immediate pickup

Highest-priority local item is **L1**. On inspection its clean form needs a
render-after-load hook (the panel loaders run in parallel, so a bare variable
read would race the fetch), which is a larger change than a quick pickup — doing
it half-way would leave non-deterministic behavior. So L1 stays OPEN with its
next runnable change made accurate above, and the session stops at the verified
wave-1/wave-2 checkpoint rather than ship a fragile slice. Nothing here depends
on L1.
