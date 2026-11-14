# Nov 7 → staging backlog status

Status: CURRENT · As of 2026-11-14 · For: Stas · Local/synthetic, default-OFF,
draft/simulated only. Branch `claude/ext20-recovery-2026-10-31` (unpushed).
Recovery export: refreshed at each checkpoint (latest v46, Nov 14 documentation
commit). It sits in the session's temporary workspace — not a durable backup
until the branch is pushed or the export file is saved by the owner.

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

## Closed after the first wave (Nov 13–14)

| Blueprint item | Commit(s) | Test evidence |
|---|---|---|
| **#65 Saved views** — engine, then wired into Orders + Inventory (`he_saved_views`) | `4542476`, `79982fb` | saved-views-ext21 (8), saved-views-wiring-ext21 (4: persists across reload, restore, reset, delete, per-screen) |
| **#54/#55 Cycle count review** wired into Inventory (`he_cycle_count`) | `44b4822` | cycle-count-wiring-ext21 (2) |
| **#70/#71 Scheduled reports + versions** — engine, then wired into Report History (`he_report_versions`) | `f629b49`, `8a2c7b6` | report-schedule-ext21 (5), report-versions-wiring-ext21 (2) |
| **#17 Intake request limits / #72 traceable export labels** (tested logic) | `61ef953` | intake-export-guard-ext21 (7) |
| **#12/#53 Supplier scorecard + document checks** (tested logic, read-only) | `c2d69ea` | supplier-scorecard-ext21 (5) |
| **#24 baselines / #36 change record** (documents) | `62eef9c`, `0cd75ad` | performance specs on the substitute browser; see caveat below |
| **Owner decisions 1–6** recorded; 1–5 built as draft-only logic | `fe9f2f0`, `9b0b2b8`, `3f850cb`, `5bce21f` | tax-ext21 (6), owner-decisions-ext21 (5), ops-preview-wiring-ext21 |

## Stage of each original blueprint item touched on this branch

- **Dashboard screen with a browser test (8):** #21, #25, #27, #54, #55, #65, #70, #71.
- **Tested logic, not yet connected to a screen (4):** #12, #17, #53, #72.
- **Documents (2):** #24, #36.
- **Live (merged and checked):** none. Nothing on this branch is on `main`.

## Open — with the named prerequisite

| Item | State | Prerequisite / next step |
|---|---|---|
| **#17 / #72** | tested logic | Connect the request limit to the live inquiry form and the label to the live export action. No outside dependency. |
| **#12 / #53** | tested logic | Add a read-only section on the Suppliers screen. Required-document list is an assumption (insurance, W-9, certificate of analysis) — owner to confirm. |
| **#24** | measured on the substitute browser only | Re-measure in CI: the CI test browser is not installed in this environment. |
| **#08 reconciliation / #26 anomaly detection** | not reviewed | Audit for missing tests and operator review states. |
| **Apply the Nov 14 decisions in the flows** | helpers built | Tax engine into invoice totals (needs the local rate); terms + due date at issue; daily roll-up switched to the `America/Chicago` day function. |
| **Full-suite re-run** | last full run Nov 9 (`59cd1a7`) | Re-run all shards on the final commit before a pull request. |

## Owner decisions

Decided Nov 14 — see `OWNER_DECISIONS_2026-11-14.md` (authoritative; not repeated
here). Still needed from the owner: the local tax rate; a go-ahead to push the
branch and open a pull request; later a business email service, a tracking
provider and a real Safari / iPhone / VoiceOver check.

## Next actionable item
Connect #17 / #72 / #12 / #53 to their screens, then apply the Nov 14 decisions in
the invoice and report flows.
