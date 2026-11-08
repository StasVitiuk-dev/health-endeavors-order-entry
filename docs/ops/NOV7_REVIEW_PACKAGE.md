# Nov 7 build — owner review package (wave-1 item 11)

Prepared 2026-11-08 at commit **6af669d** on `claude/ext20-recovery-2026-10-31`
(local, unpushed). This is the single place to review the Nov 7 operations build.
Everything here is **local and synthetic**: no production data, no live email /
carrier / provider, no money movement, no spending, no real backup activation,
no push / merge / deploy. Every new screen is behind a **default-OFF** flag.

Companions: `NOV7_CRITICAL_PATH_MAP.md` (end-to-end flow), `NOV7_BOUNDED_REVIEW.md`
(test shards + counts), `NOV7_PROGRESS_CHECKLIST.md` (living checklist).

## 1. Status legend

- **VERIFIED (local, synthetic):** proven by a passing test in this build.
- **SIMULATED:** runs locally on synthetic fixtures; models a real workflow but
  contacts nothing and writes nothing to production.
- **OPEN (local):** a reasonable next local step, not yet built.
- **BLOCKED (owner / provider / device):** needs an owner decision, a provider
  approval, or a real device before it can go live.

## 2. What to look at (owner click paths)

All in the browser console on the dashboard, then reload:

| Preview | Turn on | Where | Turn off |
|---------|---------|-------|----------|
| Export preview | `localStorage.setItem('he_report_export','on')` | Report History | `removeItem('he_report_export')` |
| Invoice preview | `localStorage.setItem('he_invoice_preview','on')` | Report History | `removeItem('he_invoice_preview')` |
| Scan Shipment | `localStorage.setItem('he_scan_shipment','on')` | Home / Orders | `removeItem('he_scan_shipment')` |
| Reorder planning | `localStorage.setItem('he_reorder_planning','on')` | Inventory | `removeItem('he_reorder_planning')` |

Screenshots of the two new previews are saved in the session scratchpad
(`scratchpad/shots/export-preview.png`, `invoice-preview.png`) and were sent in
chat.

## 3. What is VERIFIED in this wave (with the test that proves it)

| Capability | Status | Evidence |
|------------|--------|----------|
| Report + invoice previews reachable via normal nav, default-OFF, no TT/CSP violation | VERIFIED | ops-preview-wiring-ext21 (3) |
| Invoice totals (qty, per-line + order discount, shipping, tax rounding) | VERIFIED | invoice-ext21, invoice-corrections-ext21 |
| Invoice correction: draft-edit history preserved; retries never duplicate | VERIFIED | invoice-corrections-ext21 (4) |
| Two-page US-Letter invoice + packing slip (repeating headings, totals last page, optional prices, lot labels) | VERIFIED | invoice-print-ext21 (3) |
| Daily report vs ledger (cancel/refund/expense/boundary; unknown ≠ 0; visible = export) | VERIFIED | report-ledger-ext21 (4) |
| Export package: schema version + coverage; recovery rejects missing file / bad checksum / bad schema before applying | VERIFIED | export-recovery-ext21 (5) |
| Inventory+wholesale: sample handoff + partial receipt reconcile; interrupted retry no double-count | VERIFIED | inv-wholesale-rehearsal-ext21 (2), sample-reconcile-ext21 |
| Scanner recovery: cross-order tracking refused; split shipment; notification outage preserves shipment | VERIFIED | scan-recovery-ext21 (3), scan-flow-ext21 |
| Marketing approval bound to source/text/recipient/terms; opt-out & revoked permission block with reason + next action | VERIFIED | approval-binding-ext21 (4) |
| Owner vs staff boundaries (issue/void owner-only; staff order search no leak) | VERIFIED | role-boundary-ext21 (3), role-matrix, session-expiry-midway |
| Module guard intact after new wiring (verify-moves) | VERIFIED | modules-ext15 (12) |
| App boot / a11y / CSP / Trusted Types unaffected | VERIFIED | bounded shards (182 passed, 0 failed) |

## 4. SIMULATED (works locally, contacts nothing)

Invoice issuing/payments, packing slips, report export/restore, scan attach +
tracking + notification, reorder drafts, sample handoff. None touches production,
money, carriers or customers; each carries a visible SIMULATED / owner-decision
label.

## 5. OPEN (local, not yet built)

- A real print/PDF renderer over the print models (today the models are data).
- Wiring the report export preview to the live `daily_reports` rows (today a
  synthetic day-set; the live rows live in the he-reports module).
- A UI for the export recovery drill (today engine + tests only).

## 6. BLOCKED — the exact next decisions for live use

1. **Invoice numbering + issuing trigger + payment terms + tax** (owner) — the
   single biggest unblock; all billing waits on it. Engine gates issue/void to
   owner/administrator already.
2. **Carrier + notification provider approval** (owner/provider) — real tracking
   and shipping notifications (today queued states only).
3. **Real-order wiring for the scanner** (owner) — which accessible orders the
   search covers once fixtures are replaced.
4. **Export destination + encryption/recovery; automatic Mac sync** (owner) — a
   separate native background component, named in the manifest; existing backups
   stay untouched.
5. **Role policy confirmation** (owner) — who may issue/void invoices and release
   held notifications.

## 7. Recovery export (verified)

`scratchpad/recovery-v29/` — `he-nov7-6af669d.bundle` + 48 patches + SHA256SUMS.
Range 9173ccf..6af669d; thin bundle requires base 9173ccf. Verified: bundle
verify okay, 49/49 checksums OK, clone+fetch HEAD tree matches the working repo
exactly. Restore: fetch base 9173ccf, then fetch the bundle HEAD.

## 8. Not done here (honest)

- The **full 2118-test desktop suite and the full iPhone suite** are PENDING —
  they do not finish in one run window; bounded shards (item 10) stand in, with
  no new failure observed. The pre-existing `inventory-safety` `test.fail` cases
  are unrelated to this work.
- Nothing is pushed, merged or deployed; that remains the owner's to do.
