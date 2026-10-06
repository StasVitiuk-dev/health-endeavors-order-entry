# Mutation safety audit: stale tabs, double clicks, silent refusals, destructive actions

**Status:** CURRENT (2026-10-06, branch `claude/platform-overnight-implementation`; not live).

Every write in `owner-login.html` (~85 sites) was reviewed for these risks:
- an old tab overwriting newer data
- a double click or retry doing the work twice
- a status moving backwards
- read → calculate → write losing an update
- a refusal by the database reported as success

The destructive / high-consequence actions were also compared against the strongest existing patterns:
- **password re-check:** order delete
- **second press:** purchase-order Cancel
- **guarded update:** `updateIfUnchanged`, which changes a row only if it still holds the values the page showed

Earlier rounds (2026-10-03/05) already guarded the business-critical ones: approvals, PO status and receive, returns, recalls, legal holds, FDA flag, receipts, tasks, agent switches, feature flags, system mode, business-rule on/off, stock changes (compare-and-set). This round found and fixed:

## Fixed on branch (2026-10-06)

| # | Severity | Action | Problem | Fix | Test |
|---|---|---|---|---|---|
| M1 | HIGH | **Product delete** | An employee's delete was quietly refused by row-level security, yet the page said "Product deleted." | Owner/Administrator check first, with a plain message | `inventory-safety` "an employee is told plainly…" |
| M2 | MEDIUM | Product delete | The stock row was deleted first; if the product turned out to be in use, its (zero) stock row and low-stock threshold were lost, breaking "every product has a stock row" | Lock-free "in use?" check first (PO lines, lots, history, recalls); stock row deleted only while every bucket is still 0; restored exactly if the product delete is refused | `inventory-safety` "…put back exactly as it was", "already used…", "stock that arrives…" |
| M3 | HIGH | **Silent refusals**: product edit, order delete/restore, expense delete/restore, document delete, feature-request delete/restore, PO line remove, business-rule threshold | Row-level security doesn't raise an error for a refused update/delete; it changes 0 rows. The page then said "done" | Each asks for the changed rows back and says "already changed… or you don't have permission" when there are none; soft deletes also require "not already deleted" | `pages-data` "a write the database quietly refuses…" (product edit, order delete, expense delete); document delete assertion |
| M4 | MEDIUM | Escalate to Incident (quality check, recall) | Two tabs (or a stale page) each created an incident; the second silently re-pointed the record, orphaning the first | Fresh re-check; link only while still unlinked; if two people click at the same moment, the extra incident is named so it can be closed | `compliance-pages` (3 tests), `double-submit-stale` (2 tests) |
| M5 | LOW | Quality check "Mark resolved" | A stale page overwrote a resolution written elsewhere | Only while still unresolved | `compliance-pages` |
| M6 | MEDIUM | PO payment status | A stale tab could turn "Paid" back into "Unpaid" unnoticed | Only over the payment status the page showed | `purchase-orders` |
| M7 | LOW | Add reminder (form) / quick add (Cmd+N) | No lock on the form; quick add's Enter bypassed its disabled button, so a double click or a second Enter added the reminder twice | One save at a time | `double-submit-stale` (3 tests) |
| M8 | MEDIUM | **Receive delivery** | One click added stock and logged the expense, with no undo; cheaper actions (Cancel) already needed a second press | Second, deliberate press: "Confirm: add stock + log expense?" | `failure-recovery`, `po-receive` |
| M9 | MEDIUM | **Mark Refunded** | One click recorded a refund (final; feeds Accounting) | Second press that shows the amount: "Confirm refund of $30.00?" | `failure-recovery` |

Every new test above was run against the code before the fix and fails there (control).

## Reviewed, no change needed

| Action | Why it's fine |
|---|---|
| PO line remove | Re-reads the order's status first; now also notices a silent refusal |
| Calendar notes (upsert), personal events, reminder dismiss | Personal or idempotent data; worst case is a harmless repeat |
| Emergency mode (switches flags and agents off) | Idempotent ("off" twice is still off) and password-protected |
| Feature-request status advance, task status | Already guarded (expected current status) |
| Inquiry severity / AI draft reply / service status | Low-consequence text/labels; last write wins is acceptable. Noted as LOW if multiple staff start using it |
| Product edit (two people editing the same product at once) | Last save wins. LOW at current staff size; a guard on `updated_at` is the fix if it becomes a problem |

## Destructive / high-consequence action matrix (after this round)

| Action | Permission check | Confirmation | Stale-state guard | Double-click lock | Audit |
|---|---|---|---|---|---|
| Order delete / restore | DB (RLS) + silent-refusal check | password | not already deleted | yes | audit trigger |
| Document permanent delete | DB + silent-refusal check | confirm + password (no legal-hold check: see owner decision below) | n/a (row gone); stored file now removed too | yes | audit trigger |
| Product delete | page + DB | two presses | buckets still 0; in-use check | yes | audit trigger |
| Expense delete / restore | DB + silent-refusal check | none (soft delete, recycle bin) | not already deleted | yes | audit trigger |
| Receipt file delete | DB | two presses | guarded | yes | — |
| PO cancel | DB | two presses | guarded status | yes | audit trigger |
| PO receive (stock + expense) | page + DB | **two presses (new)** | claim-first | yes | audit trigger |
| Return restock (Mark Received) | page (restock) + DB | disposition required | claim-first | yes | audit trigger |
| Mark Refunded | DB | **two presses with amount (new)**; amount ≤ line value | only from Received | yes | audit trigger |
| Recall quarantine / resolve | page + DB | resolve: note + two presses if never quarantined | claim-first / guarded | yes | audit trigger |
| Legal hold release | DB | password | only an active hold | yes | — |
| Mark reported to FDA | DB | two presses | only if not set | yes | — |
| Approve / deny request | DB | password | only while pending | yes | audit trigger |
| Agent switch, feature flag, system mode, business rules | DB | password | guarded | yes | — |
| Manual stock adjustment | page + DB | — | compare-and-set | yes | history row |

"Audit trigger" = the database's audit trigger (Query A confirmed one on each of the 18 core tables). Tables outside Query A (legal holds, FDA reports, flags…) need Query C to confirm their audit coverage.

## OWNER DECISION REQUIRED

- **Should an active legal hold block deleting related records?** Today legal holds are records only: nothing (order delete, document delete, expense delete) checks them. The usual meaning of a legal hold is "don't delete anything related". The dashboard could refuse deletes of records linked to an active hold (e.g. a supplier's documents); the database is the stronger place for it. Not changed without your decision.
