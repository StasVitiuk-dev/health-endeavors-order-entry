# Nov 7 → staging backlog status

Status: CURRENT · As of 2026-11-13 · For: Stas · Local/synthetic, default-OFF,
draft/simulated only. Branch `claude/ext20-recovery-2026-10-31` (unpushed).
Recovery snapshot: `scratchpad/recovery-v41/` at HEAD `8689ddf` (bundle verified,
98/98 checksums OK).

This tracks the panel-wiring run + the launch-critical reconciliation + the
newer approved blueprint backlog. Each closed item cites its commit and tests.

## Closed this wave (verified, local/synthetic)

| Blueprint item | Commit | Test evidence |
|---|---|---|
| Wire W-1…W-5 into 5 default-OFF panels | `074e3ab` | sales-wiring (flag-OFF sweep + 5 content tests), sales-pages-sync (54), a11y + mobile(320px/200%) + uncertainty matrices, modules-ext15 |
| **#25 Service Health** (state + next operator action) | `f9625c2` | sales-health-ext21 (5, pure Node) + agent-safety/registry/truth + wiring |
| **#21 Manual fallback** readiness (on Service Health) | `fa8bc11` | ops-fallback-ext21 (3, incl. cited-spec-exists) + wiring |
| **#54/#55 Cycle count + adjustment approval** journey | `49c422a` | inventory-count-ext21 (6, incl. canceled + duplicate submissions) |
| **#27 Complaint trends** (recurring packaging/pump/quality) | `8689ddf` | sales-feedback-ext21 (+2 trend tests) + wiring |

## Reconciled as already covered (skip — current test evidence)

- **Prior item 2 — scanner (B11-01):** entry points, upload/manual capture,
  candidate matching + confirmation, split packages, duplicate/concurrent
  confirm, simulated tracking + one notification with safe retry — covered by
  `scan-engine/ui/flow/recovery-ext21` + `fu4-scan-journey-ext21`. Real
  iPhone/Safari/VoiceOver remain emulated-only (device-dependent; kept separate).
- **Prior item 3 — wholesale journey:** lead import/dedupe (`sales-import`,
  `duplicate-import-ext21`), attribution/qualification (`sales-leads`), approval
  bound to exact recipient+version (`approval-binding-ext21`), outbox/replies/
  follow-up stop (`sales-replies-followup`), visit→order handoff (`sales-visit`).
- **Prior item 4 — order/inventory:** partial receiving (`po-receive`, reorder
  `receivePartial`), returns/retries + stale/duplicate (`failure-recovery-ext21`),
  roles (`role-boundary`, `role-matrix`), search (`search-*`).
- **Prior item 5 — invoice/print/backup:** invoice drafts + lifecycle + print
  (`invoice-*-ext21`, 9 specs), daily report print/export (`report-*-ext21`),
  encrypted export + isolated scratch restore (`export-recovery-ext21`,
  `recovery-compat-ext21`, `recovery-drill-wiring-ext21`).

## Open — in the ledger with named prerequisite

| Item | State | Prerequisite / next step |
|---|---|---|
| **#70/#71 Scheduled reports + versioning** | partial | Local report history + reruns exist (`report-ledger`, `report-export`); build local version-history + simulated delivery states. **Prereq for real delivery:** business email (owner decision O5/providers). |
| **#65 Saved views & filters** | open | Persist personal views for Orders/Wholesale/Inventory; verify restore/clear/role/mobile. No external prereq — implementable next. |
| **#12/#53 Supplier scorecards + doc validation** | blocked | Needs supplier records to already carry delivery + document data. **Prereq:** confirm supplier schema/fixtures exist before building (avoid inventing supplier data). |
| **#17/#72 Intake protections + export watermarking** | applicability check | Confirm in-scope public intake form / export surface exists; add request limits + traceable export label where present. **Prereq:** identify the in-scope intake/export. |
| **#24/#36 Perf baselines + change management** | doc | Record baselines for launch-critical screens + tested revision/rollback in existing docs. No external prereq. |

## Six owner decisions (unchanged — still open, each with the exact input needed)

1. **Tax rate** — the % to charge, and whether tax applies to shipping.
2. **Payment terms** — e.g. due-on-receipt vs net-14.
3. **Invoice issuing** — manual vs automatic, and confirm numbering `HE-YYYY-NNNN`.
4. **Day-boundary convention** — fixed offset vs IANA/DST-aware.
5. **Roles** — who besides the owner may issue/void invoices and release held notifications.
6. **Export destination** — where exports go, and whether to enable automatic Mac sync later.

Provider/device approvals (real tracking + notifications, business email, real
Safari/iPhone/VoiceOver) remain separate and open.

## Next actionable item
**#65 Saved views & filters** — implementable with no external prerequisite.
