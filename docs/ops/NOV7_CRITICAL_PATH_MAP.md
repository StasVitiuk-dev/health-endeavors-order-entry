# Nov 7 build — critical-path map (order → fulfill → bill → report)

Status date: 2026-11-08. Branch: `claude/ext20-recovery-2026-10-31` (local,
unpushed). This maps the one end-to-end operations path a store actually runs
each day onto the engines built in the Nov 7 cycle, and states honestly what is
verified-synthetic versus blocked on an owner decision, a provider, or a real
device. It is the companion to `NOV7_PROGRESS_CHECKLIST.md` (what got built) and
`NOV7_BUILD_HANDOFF_2026-11-07.md` (capability/gap map).

Legend: ✅ verified with synthetic tests · 🟡 partial / model-only · 🔒 blocked
(owner / provider / real device) · ⬜ not started. Nothing here touches
production, real customers, live providers, money movement, email, pushes,
merges or deploys. Every new module is pure, dual-mode, and default-OFF behind a
feature flag.

## The daily critical path, step by step

| # | Step the store does | Engine(s) | State | What proves it | What's still needed |
|---|---------------------|-----------|-------|----------------|---------------------|
| 1 | An order arrives / is entered | existing `manual-order-entry` + `orders` | ✅ (pre-existing) | existing suite | — |
| 2 | Pick & reserve stock; see days-of-cover and reorder need | `assets/inventory/he-reorder.js` | ✅ | `inventory-reorder-*`, reorder planning view | 🔒 real purchasing stays OFF (owner) |
| 3 | Pack a shipment; print a packing slip (lot numbers, no prices) | `assets/invoice/he-invoice.js` `packingSlip()` | ✅ | `invoice-ext21`, `ops-journey-ext21` | ⬜ print/PDF renderer (model only today) |
| 4 | Scan the shipping label; attach tracking; queue one notification | `assets/scan/he-scan.js` | ✅ | `scan-engine`, `scan-ui`, `scan-journey`, `ops-journey-ext21` | 🔒 real-device camera; 🔒 real carrier/notify (Agent #5); 🟡 real-order wiring |
| 5 | Bill the order; issue an invoice; record payments | `assets/invoice/he-invoice.js` | ✅ (model) | `invoice-ext21` | 🔒 numbering/trigger/terms/tax **owner decision**; no prod `invoices` write |
| 6 | Close the day; review the daily report | existing `he-reports.js` + `assets/reports/he-report-export.js` | ✅ | `report-export-ext21` | 🟡 live wiring to real `daily_reports`; 🔒 nightly job unchanged |
| 7 | Export / archive the report for records | `he-report-export.js` manifest + checksum | ✅ (model) | `report-export-ext21` | ⬜ real file write; 🔒 Mac background downloader (separate native) |

## Where the path is continuous vs. where it breaks

**Continuous today (synthetic):** steps 2→3→4 and 6→7 compose cleanly. The
`ops-journey-ext21` test runs one synthetic order through scan → packing slip →
report with a **partial shipment** and **repeated actions**, and shows the three
properties that matter at the seams:
- re-scanning the same label attaches **once** (dedup key), queues nothing twice;
- a not-yet-invoiced partial shipment reports revenue **UNKNOWN**, never `$0`;
- a failed export **retries once** and never double-exports.

**Deliberate breaks (by design, until an owner decision):**
- **Step 5 billing is a model, not a ledger.** Invoice numbering, the issuing
  trigger, payment terms and tax are all **owner decisions** (see
  `NOV7_PROGRESS_CHECKLIST.md` → "Owner decisions outstanding"). The engine
  reuses the production invoice *contract shape* but never writes an `invoices`
  row. No money moves; payments only represent a balance.
- **Step 4 real send.** A scan does not prove carrier acceptance and sends
  nothing; the shipping notification and tracking check are *queued* states, not
  real calls. Real delivery belongs to Agent #5 and is OFF.
- **Steps 3 & 7 rendering.** Packing slip and report are print/export *models*
  (US-Letter geometry, deterministic checksum) — no PDF is rendered and no file
  is written. A renderer and the Mac downloader are separate components.

## Owner decisions that unblock the critical path (priority order)

1. **Invoice numbering + issuing trigger + terms + tax** (step 5) — the single
   biggest unblock; everything else in billing waits on it.
2. **Carrier + notification provider approval** (step 4) — real tracking/sends.
3. **Real-order wiring scope** (step 4) — which accessible orders the scanner
   searches once fixtures are replaced.
4. **Export destination + encryption/recovery** (step 7) — before any real
   archive leaves the machine.
5. **Role permissions** — who may issue/void invoices and release notifications
   (engine already gates to owner/administrator; confirm the policy).

## Verification index (synthetic, Node-only unless noted)

- `tests/specs/invoice-ext21.spec.js` — 6 cases (totals, issue, payments, void, overdue, packing slip)
- `tests/specs/report-export-ext21.spec.js` — 5 cases (selection, UNKNOWN≠0, US-Letter model, checksum+tamper, retry)
- `tests/specs/ops-journey-ext21.spec.js` — 3 cases (scan→slip→report, partial shipment, idempotent repeats)
- Scan suite (`scan-engine`, `scan-ui`, scan journey) and inventory suite — prior commits.

All new modules are OFF by default and perform no I/O. Passing synthetic tests
are **not** production acceptance: steps 3–7 each carry an explicit owner /
provider / device dependency above before any live use.
