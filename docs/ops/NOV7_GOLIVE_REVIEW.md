# Nov 7 build — go-live review walkthrough (for the owner session)

> **Update Nov 14, 2026:** this page is a dated snapshot. The owner decisions it lists as
> open (tax, payment terms, invoice issuing, day boundary, roles, export destination) were
> made on Nov 14 — see `OWNER_DECISIONS_2026-11-14.md`. Current status of the whole build:
> `NOV7_STAGING_REVIEW_AND_OWNER_CHECKLIST.md`.

A step-by-step script for the live review. Everything here is **local and
synthetic** and **default-OFF**: turning a flag on affects only your own browser
until you decide to merge. Nothing is pushed, merged, deployed, sent, or charged.
Fuller detail: `NOV7_REVIEW_PACKAGE.md`. Status snapshot, commit at review prep:
branch `claude/ext20-recovery-2026-10-31`, recovery export verified.

## How to turn a preview on / off (same for all)

In the dashboard, open the browser console and run the "on" line, then reload and
open the named panel. Run the "off" line (or just don't keep it) to hide it again.
All are OFF by default.

| Preview | On | Off | Where to look |
|---------|----|----|---------------|
| Invoice preview | `localStorage.setItem('he_invoice_preview','on')` | `removeItem` | Report History |
| Export preview | `localStorage.setItem('he_report_export','on')` | `removeItem` | Report History |
| Recovery drill | `localStorage.setItem('he_recovery_drill','on')` | `removeItem` | Report History |
| Scan Shipment | `localStorage.setItem('he_scan_shipment','on')` | `removeItem` | Home / Orders |
| Reorder planning | `localStorage.setItem('he_reorder_planning','on')` | `removeItem` | Inventory |

## Walkthrough order (≈15 min)

1. **Invoice preview** (screenshot: golive-invoice-preview.png). Check: the header
   shows "Health Endeavors" with address/remit marked as placeholders; the
   suggested number is `HE-2026-0001`; the line items, discount, shipping, 8% tax
   and total ($276.02) read correctly; a packing slip with lot numbers and no
   prices; a "Print (US-Letter preview)" button; and the note that issuing is an
   owner decision. → **Decision prompts:** your real tax rate; payment terms;
   manual vs automatic issuing.
2. **Print** — click "Print (US-Letter preview)" and use your browser's print
   preview. Check: it looks like a one-page US-Letter invoice; a long invoice
   would repeat the column headings and put totals on the last page. (This is the
   manual visual check; the layout is otherwise test-verified.)
3. **Export preview** (golive-export-preview.png). Check: it packages your saved
   reports (or a demo set if none saved), shows the row count + date range, a
   checksum with "OK — checksum matches", the US-Letter print-model line, and the
   note that automatic Mac sync is separate and backups are untouched.
4. **Recovery drill** (golive-recovery-drill.png). Check: a clean package opens;
   a tampered one is "rejected at checksum"; a missing file is "rejected at
   files" — each before anything is applied. → **Decision prompt:** export
   destination + whether to enable automatic Mac sync later.
5. **Scan Shipment** and **Reorder planning** — already reviewed in prior
   sessions; included for completeness.

## The decisions that unlock going live (bring answers)

1. **Invoices (O1):** tax rate · payment terms · manual-vs-automatic issuing.
2. **Day boundary (O2):** fixed offset or daylight-saving-aware (see
   `NOV7_DAY_BOUNDARY_POLICY.md`).
3. **Roles (O3):** confirm who besides you may issue/void invoices and release
   held notifications.
4. **Export/Mac sync (O4):** destination + whether to turn on auto-sync later.
5. **Providers/devices (external):** carrier + notification provider; real-device
   camera. These stay simulated until approved.

## Going live (your steps, when ready)

1. I prepare the branch for your review (I cannot merge).
2. You review the pull request on GitHub and **merge** it — that publishes to the
   live dashboard (GitHub Pages, 1–5 min).
3. Hard-refresh the live site (Cmd+Shift+R) and confirm the previews appear only
   when you flip their flags.
4. Rollback if needed: the previous version is the prior commit on `main`; I can
   prepare an exact revert.

## What is NOT going live in this round
Real invoice issuing, real tracking/notifications, real exports/Mac sync, and the
real-device camera all stay OFF until the matching decision/approval above. The
previews are review tools, not production actions.
