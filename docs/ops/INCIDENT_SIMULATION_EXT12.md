# Incident simulation and response map (EXT12)

**Status:** CURRENT (2026-10-11, extension 12). What a person does when something goes wrong, in the words the dashboard actually shows. **No incident is repaired automatically:** every step below is done by a person, and anything touching stock or money goes to the owner before it is corrected. The authoritative copy is `tests/tools/incidents.js`; the table below is generated from it, and `tests/specs/incidents-ext12.spec.js` checks that every quoted screen phrase really exists in `owner-login.html` (so training and the page cannot drift apart) and that every scenario id appears in this file.

## 1. How to use it

```bash
npm run incident                                   # list all scenarios
npm run incident -- po-receive-unknown             # one card
npm run incident -- lookup "Receipt status unknown — do not press Receive again"
```

`lookup` matches only exact screen text. No match means: treat it as unknown → stop, screenshot, tell the owner.

## 2. Stop / retry rules

| Retry word | Meaning |
|---|---|
| **SAFE** | pressing again cannot duplicate or harm. Only when request keys are ON (the page itself then says "Pressing the button again is safe"), or for read-only actions like Check again / reload |
| **AFTER CHECK** | look first (the list, the stock history, the record); repeat only if it did not happen |
| **NEVER** | do not press again; follow the steps |

Rules (enforced by `validate()` and its tests):
- An **unknown outcome is never SAFE to retry** unless a request key or an all-or-nothing function makes a second press harmless.
- Every **stock** incident goes to the owner before correcting.
- No recovery step may say "run SQL", "update … set", "delete from", use a service key, issue a refund, message a customer, or turn a switch on.
- **STOP** means: stop changing the affected records until the owner has looked.

## 3. The map

| Id | Situation | Signal (exact screen text or check) | Stop | Retry | First steps | Avoid | Recovered when | Tell |
|---|---|---|---|---|---|---|---|---|
| `po-receive-unknown` | Purchase-order receive lost its connection | "Receipt status unknown" / "Check this order now" | **STOP** | NEVER | Do not press Receive again. Press "Check this order now" and follow exactly what it says. If it says stock already shows, finish only the lines it lists, by hand, with a note. | Pressing Receive again "to be sure" (stock would be added twice before R1 is on). | Inventory history for that order shows each line exactly once; the order is Received. | owner |
| `stock-fn-unknown` | A stock action's connection dropped (adjust, recall, return, delete) | "the dashboard cannot tell whether" / "Reload the page and check the stock and its history before trying again." | **STOP** | AFTER CHECK | Reload the page. Open the product's stock history and look for the change. Only if it is not there, do it once more. | Repeating the action before looking. | The change appears exactly once in the history. | owner |
| `stock-fn-missing` | A stock switch is ON but its database function is missing | "is switched on but is not installed, so nothing was changed" / "PROBLEM: switched ON but its database step is missing" | **STOP** | NEVER | Owner turns that switch OFF on Feature Switches. The page goes back to today's path at once. Owner runs Query H to see what disappeared. | Reinstalling anything in a hurry. Turning other switches on. | System status → Database steps no longer shows PROBLEM; Query H PASS. | owner |
| `return-unknown` | Return "Mark received" outcome unknown | "Chosen outcome: " | **STOP** | AFTER CHECK | Reload Returns and read the return's status. Check the product's stock history for the restock. Only if neither shows it, mark received once more. | Marking received twice (restocks twice while R3 is off). Recording a refund to "fix" stock. | One restock line in history for that return. | owner |
| `recall-unknown` | Recall quarantine outcome unknown | "the dashboard cannot tell whether" | **STOP** | AFTER CHECK | Reload Recalls; read the recall status. Check the lot's stock buckets (available vs quarantine). | Quarantining again before looking. | The lot's quantity is in quarantine once; available went down by the same amount. | owner |
| `adjust-negative` | Manual adjustment refused (would go below zero, or stock changed) | "changed since the page loaded" | no | AFTER CHECK | Reload and re-count the shelf. Enter the adjustment again with a reason. | Forcing a number that makes another bucket wrong. | Bucket matches the count; reason saved. | owner if the count is far off |
| `product-delete` | A product with history must not be deleted | "a product with any history is never deleted" | no | NEVER | Archive (deactivate) the product instead. | Asking for a database delete. | Product shows as inactive; its history is intact. | owner |
| `save-unknown-no-keys` | A save may or may not have happened (request keys off) | "may or may not have been saved" | no | AFTER CHECK | Look at the list first. Enter it again only if it is not there. | Pressing Save again at once (duplicate record). | Exactly one record. | none unless money |
| `save-unknown-with-keys` | A save lost its reply, request keys ON | "Pressing the button again is safe" / "already saved by an earlier attempt" | no | SAFE | Press again; the database saves it only once. | — | Exactly one record. | none |
| `nightly-not-installed` | Nightly check switched on but not installed | "Switched on, but the nightly check is not installed" | **STOP** | NEVER | Owner turns integrity_results_home OFF. Install order: drafts/25 then drafts/29 (owner, separate sitting). | Reading the Home card as PASS. | Home card says "Not set up yet" (expected) or a dated result. | owner |
| `nightly-stale` | Nightly check result is old or failed | "Nightly integrity check" / Home card shows STALE or FAIL | no | SAFE | Press Check again. If still FAIL, open the rows it names and tell the owner. | Fixing numbers by hand without the owner. | A result dated today. | owner on FAIL |
| `rls-denied` | Permission refused (row-level security) or a role sees too much | "permission" / Query G shows FAIL, or a staff member sees owner-only data | **STOP** | NEVER | Screenshot what was refused or shown (no customer details). Owner reads Query G. | Asking anyone to "open up" a table. Sharing an owner login. | Query G has no FAIL; the role sees only its pages. | owner |
| `audit-gap` | A table changes without an audit record | Query C section 10: audit_trigger=NONE for a table that must be audited | no | NEVER | Record it as a finding; compare with AUDIT_REQUIRED. Owner decides whether a trigger draft is prepared. | Adding triggers in production without a reviewed draft. | Next Query C lists audit coverage for that table. | owner |
| `agent-unknown` | An agent's state is unknown, failed, or ON when it should be off | Query C section 1: switch=unknown, last_run_status=error, or an off-by-decision agent shows ON | **STOP** | NEVER | Owner turns that agent's switch OFF. Keep its last output for review; do not rerun it. | Rerunning an agent to "see what happens" (it may send or write again). | Next Query C shows the expected switch and no new runs. | owner |
| `backup-stale` | Backup is older than the allowed age or failed | Backup evidence older than 7 days, or the nightly backup run failed | **STOP** | NEVER | No production change until a fresh green backup is seen. Owner checks the backup run (backups are owner-only). | Any database step "just this once". | A green backup look dated today. | owner |
| `dashboard-unavailable` | Dashboard does not load | "The sign-in helper library did not load from the internet" / "did not load, so it cannot start" | no | SAFE | Check the internet connection. Hard refresh (Cmd+Shift+R) or a Private Window. If still broken after a merge: owner reverts the merge (rollback card). | Working from an old tab. | Sign-in screen appears. | owner if it persists |
| `session-ended` | Signed out in the background | "You were signed out" | no | AFTER CHECK | Sign in again. Check whether the last thing you typed was saved before redoing it. | Assuming the last save went through. | The record shows your last change, or you re-enter it once. | none |
| `conflict` | Someone else changed the record first | "changed elsewhere" | no | AFTER CHECK | Reload. Compare with what you meant. Redo only what is still needed. | Pressing repeatedly to force it. | The record reads as intended. | none |
| `data-drift` | Numbers disagree (stock vs history, or a total that cannot be right) | "Could not check" / Query E mismatches, or a red row on Home | **STOP** | NEVER | Stop changing the affected records. Screenshot; open an incident; link evidence. Owner decides the correction (adjustment with a reason). | Correcting stock or money before the owner looks. Reading "Could not check" as fine. | Query E 0 mismatches; the red row clears. | owner |

## 4. Drills (staging or synthetic data only)

Each drill uses the staging copy (`STAGING_REVIEW_PLAN.md`; synthetic data, never connected to production) or the test suite, which already reproduces each signal:

| Drill | Reproduced by (tests, synthetic) |
|---|---|
| PO receive lost reply | `po-receive.spec.js` ("not saved: Receive is withheld", "already shows stock") |
| Return / recall lost reply | `failure-recovery.spec.js` -g "X11-02"; `inventory-safety.spec.js` -g "X11-03" |
| Stock function missing while ON | `system-status-ext10.spec.js` -g "partial install" |
| Save may or may not have happened / request keys | `request-keys.spec.js`, `request-keys-ext10.spec.js`, `failure-recovery.spec.js` |
| Conflict (changed elsewhere) | `stale-tab-gaps.spec.js` |
| Signed out in the background | `session-expiry-midway.spec.js`, `session-failures.spec.js` |
| Nightly not installed / stale | `nightly-check-ext10.spec.js`, `merge-without-sql-ext11.spec.js` |
| Agent unknown / off agent ON / audit gap | `evidence-ext12.spec.js` (Query C samples) |
| Backup stale / failed | `evidence-ext12.spec.js` -g "backup" |
| Function disappears / version drift / rollback refused | `deploy-sim-ext12.spec.js` |

A drill passes when the person names the right card, the right retry word and who to tell, without being prompted. Training questions: `OPERATOR_TRAINING_EXT12.md` §4.

## 5. Limits

The map covers what the dashboard and the read-only checks can show. It does not cover the public website, Shopify, e-mail sending (none exists) or the private backups job; those have their own owners. Real incident handling is still written up on the Incidents page of the dashboard (`OPERATOR_QUICK_REFERENCE_EXT10.md` §3).
