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
| L1 | ✅ DONE (`caa8e7f`) — Export preview packages live saved reports | Implemented: `he-reports.reportHistoryRows()` read accessor + a composed loader `loadReportHistoryThenExport` that awaits the history load then paints the preview (the panel loaders run in parallel), with a synthetic fallback and a Source line | met: export card shows "saved reports (N days)", row count + range match the loaded rows; demo fallback on empty DB | `export-preview-live-ext21` (2) green; modules-ext15 (12) green; module-map + write-path regenerated |
| L2 | ✅ DONE (`e1d9f4a`) — read-only recovery-drill panel | Implemented behind `he_recovery_drill` (OFF): shows schema version, a clean open with coverage, and tampered/missing packages rejected before apply | met: flag OFF renders nothing; flag ON shows clean open + both rejections | `recovery-drill-wiring-ext21` (2) green; no TT/CSP violation |
| L3 | ✅ DONE (`77069c4`) — US-Letter invoice print view | Implemented: a Print button builds the print layout into a body-level host; @media print + @page letter rules hide the dashboard, break each page onto its own sheet, repeat the heading, total on last page | met: print DOM has one page per modelled page, repeating thead, total last; host empty on screen until pressed | `invoice-print-view-ext21` (2) green; visual print = manual owner check |
| L4 | ✅ DONE (`c3e75a3`) — full desktop suite run in 16 shards | Ran `--shard=N/16` to completion overnight, counts recorded | met: **2,138 passed, 0 failed** across all 16 shards; no non-pre-existing failures | `NOV7_BOUNDED_REVIEW.md` (per-shard table). Full iPhone suite still PENDING |
| L5 | Day-boundary policy (if owner picks IANA) | replace `businessDate`'s fixed offset with a zone-aware local-date calc; pass the store zone from config | the near-midnight summer order lands on the DST-correct day; report/history/export agree | update `dst-boundary-ext21`; `NOV7_DAY_BOUNDARY_POLICY.md` marked resolved |

L1 and L2 are DONE. The next local item is **L3** (print-only HTML view over the
print models). It depends on nothing above it.

### Invoice O1 — local prep done (owner still owes 3 answers)
Started the invoice-numbering decision and built everything that can be built
locally, each default-OFF / synthetic and reversible:
- Numbering generator `HE-YYYY-NNNN` + preview suggestion — `30052cd`
- Invoice header block (name + placeholder address/remit) — `3d9380d`
- Collision-safe number sequence (draft, reserve/commit) — `977af06`
- Credit note for a paid invoice (owner-gated, references, no mutation) — `e977461`

O1 now needs only three owner answers before real issuing: **tax rate**,
**payment terms**, and **manual vs automatic issuing**. Nothing else local is
blocked on them.

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

**L1, L2, L3 and the local invoice-O1 prep are all complete** (export preview over
live rows; recovery-drill panel; US-Letter print view; invoice numbering + header
+ number sequence + credit note — all default-OFF / synthetic, each with passing
specs). The only remaining LOCAL items are **L4** (run the full suite in
reproducible shards — needs CI or several windows; bounded shards stand in) and
**L5** (day-boundary IANA zone — blocked on owner decision O2). Everything else
local is done. Owner O1 now needs only tax rate, payment terms, and manual-vs-
automatic issuing; O2 the day-boundary convention.
