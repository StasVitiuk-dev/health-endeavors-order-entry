# Nov 7 → staging backlog status

Status: CURRENT · As of 2026-11-15 · For: Stas · Local/synthetic, default-OFF,
draft/simulated only. Branch `claude/ext20-recovery-2026-10-31` (unpushed).
Recovery export: refreshed at each checkpoint (latest v53, night of Nov 15, sent
to the owner as a file). The branch itself sits in the session's temporary workspace —
it is durable only once it is pushed or the owner keeps that file.

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
| **#17 Intake request limits** (tested logic) | `61ef953` | intake-export-guard-ext21 (7) |
| **#72 Traceable export labels** — logic, then shown on the export preview and stamped on the printed report (`he_report_export`) | `61ef953`, Nov 14 wiring commit | intake-export-guard-ext21 (7), ops-preview-wiring-ext21, report-print-view-ext21 |
| **#12/#53 Supplier scorecard + document checks** — logic, then a read-only section on Suppliers (`he_supplier_scorecard`) | `c2d69ea`, Nov 14 wiring commit | supplier-scorecard-ext21 (5), supplier-scorecard-wiring-ext21 (2) |
| **#08 Payment reconciliation review** — new logic plus a section on Accounting (`he_reconcile`): expected vs recorded, every difference named, closed only by an owner/administrator note, figures never altered | Nov 14 wiring commit | reconcile-ext21 (8), reconcile-wiring-ext21 (2) |
| **#26 Operations watch** — flags unusual daily figures, stock and orders for a person to look at; section on Report History (`he_ops_watch`). Advisory, thresholds declared untuned, "seen" does not clear a flag | `d0011ea` | ops-anomaly-ext21 (10), ops-watch-wiring-ext21 (2) |
| **Reconciliation reads invoice records** — expected vs recorded built from invoices, credit notes and payments | `d0011ea` | reconcile-ext21 (11) |
| **Accessibility + phone sweep with every operations switch ON** (new coverage; found and fixed a dark-mode contrast fault on the "SIMULATED" badge) | `c8dd6b3` | ops-flags-a11y-ext21 (6) |
| **Read-only Query I** — which day cutoff the nightly report uses (for decision 4) | `fcef560` | local test, 15 checks on synthetic rows |
| **Preview switches** — on/off buttons on the Feature Flags page for all 12 previews (this browser only; owner and administrators), so reviewing needs no typed commands | Nov 14 late commit | preview-switches-ext21 (6) |
| **Automatic invoice drafts from orders** (decision 3) — one draft per order, never issued, mismatches listed for review; shown on the invoice preview | Nov 14 late commit | invoice-from-order-ext21 (5), ops-preview-wiring-ext21 |
| **Fixes from a self-review of the day's code** — due date counted from the Central business day; Net 14 always needs an approved account; a fully credited invoice reconciles as matched; the large-order check no longer slows down on long lists; example screens use the signed-in person's real role | Nov 14 late commit | invoice-decisions-ext21 (9), reconcile-ext21 (12), ops-anomaly-ext21 (11), cycle-count-wiring-ext21 (3) |
| **Invoice review desk** (decisions 1, 2, 3, 5 together, simulated) — on the invoice preview: confirm the local tax rate, issue a draft, void with a reason; role-checked; numbers follow the Central-time business year | Nov 15 commit | invoice-desk-ext21 (8), ops-preview-wiring-ext21 (journey) |
| **Invoice storage and numbering — database draft** (not installed; owner approves and runs): two new tables, numbering guard, issue / void functions, access rules for its own tables; rollback refuses once an invoice has been issued | Nov 15 commit; bill-to, ship-to, account and tax choices added Nov 15 later | local database test, 64 checks; SQL package and static draft checks (190 tests) |
| **Invoice storage — dashboard side** (not connected to any screen; off unless switched on in code): turns an invoice draft into a stored row and back, and saves, issues, voids and removes drafts through the database functions, with plain-English messages. Refuses a draft whose figures do not add up, never sends an invoice number (the database assigns it), and sends a double click only once. Writing it found that the database draft did not keep who an invoice bills or the tax choices; both added | Nov 15 later commit | invoice-store-ext21 (8, including a check that every column and function name matches drafts/32); local adapter-against-database test, 29 checks |
| **Hardening against malformed data** — every function of the operations modules is now called with empty, missing and malformed values in a permanent test. Found and fixed: the print layout froze on a bad page size; an example-data generator froze on an absurd count; several functions crashed on a list containing an empty row | Nov 14 late commit | robustness-probe-ext21 (16) |
| **Owner decisions 1, 2, 4 applied inside the invoice and report engines** | Nov 14 "decisions inside the engines" commit | invoice-decisions-ext21 (8), owner-decisions-ext21 (6) |
| **#24 baselines / #36 change record** (documents) | `62eef9c`, `0cd75ad` | performance specs on the substitute browser; see caveat below |
| **Owner decisions 1–6** recorded; 1–5 built as draft-only logic | `fe9f2f0`, `9b0b2b8`, `3f850cb`, `5bce21f` | tax-ext21 (6), owner-decisions-ext21 (5), ops-preview-wiring-ext21 |

## Stage of each original blueprint item touched on this branch

- **Dashboard screen with a browser test (13):** #08, #12, #21, #25, #26, #27, #53, #54, #55, #65, #70, #71, #72.
- **Tested logic, not connected to a screen (1):** #17 — see the table below for why.
- **Documents (2):** #24, #36.
- **Live (merged and checked):** none. Nothing on this branch is on `main`.

## Open — with the named prerequisite

| Item | State | Prerequisite / next step |
|---|---|---|
| **#17** | tested logic | The form this protects (public inquiries) is part of the public website, which is a separate project and not in this repository; this dashboard has no public form to attach it to. A limit that runs in the visitor's browser is also not real protection — it has to run on the server. Next step: a draft server-side limit for the owner to review, in the website project. |
| **#72** | on the export preview + printed report | Since Nov 15 the label names the person signed in on the page (sign-in email and role), on screen and on the printed report. Stamping saved files comes with enabling real exports (decision 6). |
| **#12 / #53** | read-only section on Suppliers (example data) | Required-document list is an assumption (insurance, W-9, certificate of analysis) — owner to confirm. Scoring real suppliers needs fields the database does not store yet (listed in the section). |
| **#24** | measured on the substitute browser only | Re-measure in CI: the CI test browser is not installed in this environment. |
| **#26 anomaly detection** | built Nov 14 for operations as well as sales (advisory, example data) | Sales side: 8 kinds of warning signs with review states. Operations side (new): 10 kinds across daily figures, stock and orders. Daily figures read the saved nightly reports when there are any; stock and orders are example data until real feeds are approved. Thresholds are starting values — tuning them on real history is the owner's call. |
| **#08 reconciliation** | reviewed and built Nov 14 (example data) | Before this, the branch had roll-up and money-trail tests but nothing that compared two sources or tracked a review. Now built as advisory logic + a screen section. Not connected to real invoices or payments: there is no payments table in the dashboard yet, and matching tolerance is the owner's call (default: exact). Real financial use stays gated. |
| **Apply the Nov 14 decisions in the flows** | done in the engines Nov 14 | Remaining: the real local tax rate; the live day cutoff is a database change (draft for the owner). |
| **Full pass** | latest: Nov 15 night at `88db1fe`, quiet machine — computer 2,431 passed / 10 failed; phone 513 passed / 10 failed. **Only the 20 picture comparisons**; the timing test passes now that its cause is fixed (`NOV7_BOUNDED_REVIEW.md`) | A full pass in CI once the branch is pushed; reference pictures re-taken after the owner decides on the look. |
| **Sales & Growth modules: malformed-input crashes** | **fixed Nov 15** | The probe found 174 accidental crashes across 35 of the 54 modules; now 0. A list that is not a list, or a list with an empty row, no longer crashes a page. What remains by design: a function still refuses a programming mistake with a worded message ("inject he-sales-claims", "unknown variant kind"). The permanent probe test now covers every sales module; all 332 existing Sales & Growth tests still pass. |
| **Sales outreach workbench (Nov 3 point 8, on screen)** | **built Nov 15** (example data, simulated send) | One screen at the bottom of Sales & Growth → Approvals: import an example store list, draft from approved facts, edit (an edit cancels the approval), approve (owner or administrator only), "send" into a simulated outbox that says nothing was sent, record a reply (an opt-out puts the address on a do-not-contact list that blocks everything after). Kept in this browser only and survives a reload; "Reset workbench" clears it. Behind the Sales & Growth switch (off by default). Tests: `sales-workbench-ext21` (8), `sales-workbench-wiring-ext21` (4), `sales-workbench-a11y-ext21` (accessibility, both colour themes, phone 390 px and 320 px at 200 % text). Not connected to any mailbox or to the database. |
| **Screen-reader announcements in sections that redraw themselves** | **fixed Nov 15** | The workbench, reconciliation, preview switches and invoice desk redraw after every button, which lost the pressed button (keyboard users were thrown back to the top) and recreated the message line, which screen readers often do not read out. Now one permanent, invisible status region reads every result, and focus returns to the pressed button. Found by reading the code, not by a screen reader: a real VoiceOver check is still the owner's (item 10). Tests: `sales-workbench-a11y-ext21` (each test fails without the fix). |
| **Very long text in tables at phone size** | **fixed Nov 15** | Root cause of the one phone-size timing failure seen in every full pass (and on the untouched base): a 50,000-character task title became a card about 43,000 px tall and took about 9 s to lay out. A sweep of every operations page found the Orders page froze the same way on a long customer name (10 to 15 s). Now any table cell draws at most the first 600 characters of a text, followed by "(N more characters not shown)" — one shared rule for every table, present and future. Saved data is unchanged; shorter text looks exactly as before; text typed into a field inside a table is left alone. Phone-size Tasks page: 10.2 s → 1.5 s. Tests: `tasks-long-title-ext21` (both sizes; fails with the rule switched off); `malformed-data-ext15` now passes at phone size too. |
| **Quick reminder: first key could be lost** | **fixed Nov 15** | Found from one failure in the full pass at `05fc2b7` while the machine was busy: the quick-reminder box put the cursor in its field 10 ms after opening, so a key pressed in that gap went nowhere and the box stayed open. The field now takes focus at once (as the command palette already did). Test: `ui-chrome` ("has the cursor the instant the box opens"; fails with the fix removed). |
| **Dialogs take keyboard focus when they open** | **fixed Nov 15** | Found by a probe of every dialog: the shortcut list, the Guide box and the record history opened with focus left on the page behind, so a screen reader was told nothing and Enter or Space pressed whatever button was focused behind the dialog (for example Delete on an order — it only opened the password prompt, but other buttons act at once). Now each dialog's title takes focus (one shared rule, `focusDialog` in `assets/app/he-ui.js`). The password prompt, command palette, quick reminder and Scan Shipment already did. `tests/specs/dialog-focus-ext21.spec.js` (5 tests; 4 fail without the fix). Not a real screen-reader check. |
| **Record history title ran its words together** | **fixed Nov 15** | Seen in the same probe: the title read "Orders · SYN-1001SYNTHETIC Customer Onepaid$100.00Jun 15,". It now keeps the row's cells apart ("Orders · SYN-1001 · SYNTHETIC Customer One · paid"), uses whole cells only, leaves out button text, and cuts one very long name with "…". Same test file. |
| **Keyboard focus: Scan Shipment dialog and five more sections** | **fixed Nov 15** | A probe found that when the Scan Shipment dialog opened, focus stayed on the button behind it; after each step it fell to the page; Escape did nothing; and Tab could leave the dialog. Now focus moves into the dialog (the first field to fill in, or its heading), stays in at every step, Tab and Shift+Tab stay inside, and Escape closes it and returns focus to where it was. Reorder planning, saved views, stock-count review, report versions and the operations watch now keep focus on the pressed button, or on the section when that button is gone. Tests: `keyboard-focus-ext21` (3). Emulated browser only; a real iPhone / VoiceOver check is still the owner's. |

## Owner decisions

Decided Nov 14 — see `OWNER_DECISIONS_2026-11-14.md` (authoritative; not repeated
here). Still needed from the owner: the local tax rate; a go-ahead to push the
branch and open a pull request; later a business email service, a tracking
provider and a real Safari / iPhone / VoiceOver check.

## Next actionable item
Owner: give the final look-over of the control and form styling you directed on
Nov 3 (before/after pictures sent as `restyle-review.html`), and run read-only Query I
when convenient. Engineering (Nov 15): the Nov 3 visual-review points that needed no owner decision are done
(#2, #4, #5, #8, #10; points 6 and 7 are owner decisions). The dashboard side of invoice storage
is written and tested (not connected). Next without the owner: re-measure #24 in CI once pushed; re-take the reference pictures once the look is accepted.
