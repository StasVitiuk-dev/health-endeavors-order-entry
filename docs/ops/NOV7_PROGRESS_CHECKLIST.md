# Nov 7 brief — progress checklist (kept current)

Local build on `claude/ext20-recovery-2026-10-31`, all commits unpushed on top of
`9173ccf`. Legend: ✅ done · 🟡 in progress · ⬜ not started · 🔒 blocked (owner/
provider/real-device). External actions (push/merge/deploy, production Supabase,
live email/carriers/ads/spend, real customer data) stay OFF throughout.

## Pre-work (done)
- ✅ Report-table numeric alignment (Tax Records, Report History) — `4b8c5d8`
- ✅ Nov 7 handoff recorded + capability/gap map — `c0d608e` (`NOV7_BUILD_HANDOFF_2026-11-07.md`)
- ✅ Recovery export v23 (verified, 19 patches, tree-hash match) — scratchpad

## Phase 1 — Scan Shipment ✅ (milestone)
- ✅ Engine core: tracking validation, carrier detect, trusted links, role-scoped
  ranking, dedup, simulated attach + state machines — `29eec41` (16 tests)
- ✅ View-model: masking, always-confirm, camera fallback, chooser/no-match,
  result mapping — `9c1b9e7` (7 tests)
- ✅ UI flow wired to Home + Orders behind default-OFF flag; capture (camera/
  photo/manual/fixtures) → review → confirm → result; barcode via BarcodeDetector
  with photo/manual fallback; previews desktop+mobile — `4e472ed` (9 journey tests)
- 🔒 real-device camera pass (owner device); 🔒 real OCR for printed text (fixture
  demo only today); 🟡 wire search to real accessible orders (fixtures today).

## Phase 2
- ⬜ Wholesale & Boutique Scout (extend SG-01..10) — NEXT
- ⬜ Inventory Reorder & Cash Flow

## Phase 3
- ⬜ Content & Social Repurposing (extend SG-14/15 + claim firewall)
- ⬜ Ad Creative & Copy Variations

## Phase 4
- ⬜ Review & Testimonial Analyzer (extend SG-12)
- ⬜ Micro-creator & UGC Discovery (extend SG-15)
- ⬜ Retention & Replenishment (extend SG-11; 45d as a test example)

## Operations track
- ⬜ Printable US-Letter reports + PDF generation (none exists yet)
- ⬜ Invoice & packing-slip prototypes (reuse invoice table/Agent #1 contract; mock prod)
- ⬜ Mac export design (data export ≠ backup; preserve current backups) 🔒 background downloader = separate native component

## Handoff / inputs
- ⬜ Wholesale QR storefront — documentation handoff to the website session
- ⬜ Planning inputs recorded (lab fill, jar/kit costs, provisional pricing, box-fit) — in `NOV7_BUILD_HANDOFF_2026-11-07.md`; confirm before public use

## Owner decisions outstanding (from §14–16 + phases)
Retention; export scope/attachments; destination; encryption recovery; invoice
numbering/trigger/terms/tax; role permissions; real-device & provider approvals.
