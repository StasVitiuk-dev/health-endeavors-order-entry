# Operations handbook (EXT13)

**AUTHORITATIVE AS OF:** 2026-10-11 · for the dashboard in PR #28 (page code `32c05e2`); after the merge, this is how the live dashboard behaves.
**SUPERSEDES** as the training entry point `OPERATOR_TRAINING_EXT12.md` (kept; §3–4 there are folded in here). Still current alongside it:

- `OPERATOR_QUICK_REFERENCE_EXT10.md`: the words the dashboard uses;
- `INCIDENT_SIMULATION_EXT12.md`: the 19 incident cards, generated from `tests/tools/incidents.js`.

Plain English. Practise only on the staging copy (synthetic data) or on the screenshots, never on live records.

---

## 1. "What if…" matrix (55 cases)

**SAFE** = the dashboard's built-in response. **DO** = what the person does. **DON'T** = the mistake to avoid.

| # | What if… | Expected safe response | Operator action | Do not |
|---|---|---|---|---|
| 1 | the reply to "Receive delivery" is lost | Receive locks: "Receipt status unknown — do not press Receive again" | press "Check this order now", follow it | press Receive again |
| 2 | someone double-clicks Receive | the second press only confirms; one receive | nothing | click repeatedly "to make sure" |
| 3 | two people receive the same PO at once | the second is refused ("already received") | reload | re-enter stock by hand |
| 4 | a PO line is edited while the order is being received | the edit is refused (with the line guard) or the receive reports the difference | reload, compare | edit lines during a receive |
| 5 | a receive fails part-way (switch off) | the page lists exactly what was not done | finish only those items by hand, with a note | press Receive again |
| 6 | stock changes in another tab before an adjustment | "changed since the page loaded"; nothing saved | reload, re-count | force the old number |
| 7 | an adjustment would make a bucket negative | refused | re-count; tell the owner if far off | split it into several adjustments to get round the rule |
| 8 | the reply to "Mark received" (return) is lost | the page reads the return back and says which happened | follow the message; check stock history | mark received twice |
| 9 | the reply to "Quarantine" (recall) is lost | same read-back | check the lot's buckets | quarantine twice |
| 10 | a save says "may or may not have been saved" | nothing duplicated yet | look at the list first; re-enter only if missing | press Save again at once |
| 11 | the page says "Pressing the button again is safe" | request keys are on | press again | — |
| 12 | "already saved by an earlier attempt" appears | the first save counted; nothing added twice | check the list; redo only changes made since | enter it again |
| 13 | someone else changed the record first | "changed elsewhere"; yours not saved | reload, compare, redo what is still needed | press repeatedly |
| 14 | the session expires while typing | "You were signed out…"; unsaved text warned | sign in again; check the last save | assume it saved |
| 15 | signed out in another tab | this tab is wiped and asks to sign in | sign in | keep working in an old tab |
| 16 | a different person signs in on the same computer | the previous person's data is wiped from the page | sign in as yourself | share a login |
| 17 | the connection drops completely | errors say the connection dropped; nothing claimed as saved | wait, reload, check | retry blindly |
| 18 | the Supabase library fails to load | plain message: "The sign-in helper library did not load…" | check internet; hard refresh | use an old cached tab |
| 19 | the dashboard does not load after a merge | — | hard refresh / private window; tell the owner (revert card) | keep refreshing for an hour |
| 20 | Home shows "Could not check" | unknown, not fine | press Check again; tell the owner if it persists | read it as all clear |
| 21 | an amount shows "—" | the figure could not be read | tell the owner | treat it as $0 |
| 22 | an order has no total | it is named on the revenue pages, not counted as $0 | finish the order's total | ignore the warning |
| 23 | Query H shows FAIL | — | owner switches off what its ACTION names | take any next step |
| 24 | System status shows PROBLEM (switch ON without its step) | the page already refuses that action | owner switches it off | reinstall in a hurry |
| 25 | the backup is stale or failed | — | no database step until a green look | do the step "just this once" |
| 26 | RLS denies the owner | "not permitted, nothing was changed" | screenshot; owner reads Query G | ask anyone to open up a table |
| 27 | a staff member sees owner-only data | — | screenshot (no customer details); tell the owner | share the screenshot widely |
| 28 | an agent shows UNKNOWN | — | owner reads Query C; switch it off if unsure | rerun it to see |
| 29 | an agent that should be off shows ON | — | owner switches it off; keep its output | rerun it |
| 30 | agent #6 (notification) shows a "sent" message | it cannot send (dry run); the log shows what it would send | tell the owner immediately if anything was really sent | ignore it |
| 31 | a CSV export contains a cell starting with `=` | exports neutralise formulas | open normally | disable the guard |
| 32 | order history is huge | lists say how many are shown; "look up in all orders" | use search | assume the list is complete |
| 33 | a list hits the reply limit | a labelled warning appears | narrow the filter | trust the count without the warning |
| 34 | two replies arrive out of order | the newer one wins | nothing | — |
| 35 | the nightly check is "Not set up yet" | expected until installed | nothing | read it as PASS |
| 36 | the nightly check is STALE | — | press Check again; tell the owner on FAIL | fix numbers by hand |
| 37 | a product with history needs removing | delete refused | archive (deactivate) | ask for a database delete |
| 38 | a supplier sends more or less than ordered | Receive records the ordered quantities | receive, then record the difference as an adjustment with a reason; tell the owner | edit the PO quantity during the receive |
| 39 | a recalled lot is also in an open order | — | owner decides (hold the order); quarantine first | ship it |
| 40 | a customer asks for a refund | the dashboard never moves money | refund elsewhere; then Mark refunded | treat Mark refunded as paying |
| 41 | a refund is recorded with no date | Query F F15 flags it | add the date | leave it |
| 42 | two orders share a number | Query F F06 flags it | owner decides which is right | delete one without checking |
| 43 | two suppliers or products have the same name | Query F F07/F08 | merge by hand after checking | rename blindly |
| 44 | an approval waits more than 7 days | Home / Query F F03 | the owner decides | approve to clear the list |
| 45 | an employee tries to approve (no staff policy yet) | allowed by the database today | owner sets the policy before hiring (#10) | — |
| 46 | someone turns a feature switch on | password + probe; refused if its step is missing | owner only, one per sitting | turn several on |
| 47 | emergency mode is needed | System Mode (Admin pages) | owner turns it on; note why | use it as an everyday lock |
| 48 | a document upload fails half-way | the record is removed / cleaned up | upload again | leave a broken entry |
| 49 | an evidence file contains customer data | — | keep it in the Evidence Locker; never paste it in chat | e-mail it |
| 50 | a phone shows a table squeezed | phone cards are used on key pages | rotate or use the desktop | — |
| 51 | VoiceOver reads something wrong | not yet verified on a real device | note the page and the words; real-device card | — |
| 52 | a merge must be undone | GitHub Revert | owner reverts; switches off first if any were on | revert while a switch is on |
| 53 | a rollback file refuses | it is protecting something (a switch is on, or the wrong order) | read the message; switch off / roll back the dependent first | edit the rollback |
| 54 | Claude (or any AI) proposes running SQL in production | — | the owner decides; only reviewed drafts, one per sitting | paste anything not from the card |
| 55 | someone asks for a password or key in chat | — | refuse; never paste keys anywhere | paste it "just this once" |

## 2. Top 20 incidents (by plausible business impact)

| Rank | Incident | Card (`npm run incident -- <id>`) | Severity | Stop business action? |
|---|---|---|---|---|
| 1 | stock doubled or missing after a lost reply | `po-receive-unknown`, `stock-fn-unknown` | HIGH | YES for that product |
| 2 | switch ON without its database function | `stock-fn-missing` | HIGH | YES for that action |
| 3 | numbers disagree (stock vs history, impossible totals) | `data-drift` | HIGH | YES for the affected records |
| 4 | backup stale or failed | `backup-stale` | HIGH | YES for production changes |
| 5 | staff sees or changes owner-only data | `rls-denied` | HIGH | YES for that access |
| 6 | agent unknown or ON when it should be off | `agent-unknown` | HIGH | YES for that agent |
| 7 | return restock outcome unknown | `return-unknown` | MEDIUM | for that return |
| 8 | recall quarantine outcome unknown | `recall-unknown` | MEDIUM–HIGH (recalled stock sellable?) | for that lot |
| 9 | duplicate record after a lost reply (keys off) | `save-unknown-no-keys` | MEDIUM | no |
| 10 | dashboard unavailable after a merge | `dashboard-unavailable` | MEDIUM | revert first |
| 11 | audit trail missing on a table | `audit-gap` | MEDIUM | no |
| 12 | nightly check not installed but switched on | `nightly-not-installed` | LOW | no |
| 13 | nightly check STALE / FAIL | `nightly-stale` | LOW–MEDIUM | on FAIL rows only |
| 14 | adjustment refused (negative / changed) | `adjust-negative` | LOW | no |
| 15 | conflict ("changed elsewhere") | `conflict` | LOW | no |
| 16 | signed out in the background | `session-ended` | LOW | no |
| 17 | product with history needs removing | `product-delete` | LOW | no |
| 18 | save repeated with keys on | `save-unknown-with-keys` | LOW | no |
| 19 | GitHub admin credential still in use (X6-17) | (owner card 4) | MEDIUM (standing) | no |
| 20 | a key or password pasted into a chat | (rotate it at the provider) | HIGH | rotate first |

Severity is deliberately not inflated:

- **HIGH** = stock, money, access or backups may be wrong;
- **MEDIUM** = one record may be wrong;
- **LOW** = no wrong data, just a refusal.

## 3. Finding the right card fast

- **Search by what the screen says:** `npm run incident -- lookup "<exact text>"` matches the exact phrases. No match means: stop, screenshot, tell the owner.
- **Quick index:**
  - stock: `po-receive-unknown`, `stock-fn-unknown`, `stock-fn-missing`, `return-unknown`, `recall-unknown`, `adjust-negative`, `product-delete`;
  - saving: `save-unknown-no-keys`, `save-unknown-with-keys`, `conflict`, `session-ended`;
  - checks: `nightly-not-installed`, `nightly-stale`, `data-drift`, `audit-gap`;
  - access: `rls-denied`, `dashboard-unavailable`;
  - outside: `agent-unknown`, `backup-stale`.
- **Escalation:**

| Who | Handles |
|---|---|
| Operator | conflicts, sign-in, look-before-retry cases |
| Owner | every stock, money, access, switch, agent and backup incident; every production change |
| Developer (Claude session) | reading evidence, writing drafts, page fixes in a PR; **never** a production action |
| Accountant | refund/revenue treatment questions |
| Lawyer | holds, retention, claims |
| Provider | e-mail delivery (when one exists) |

**Stop the business action** when stock, money, access, an agent or backups may be wrong: stop changing the affected records until the owner has looked. **Continue safely** for refusals with no wrong data (conflict, sign-in, adjustment refused, archive instead of delete): follow the card and carry on.

**Evidence checklist (no secrets):**

- screenshot of the whole screen;
- the time;
- the page;
- the record number (PO-…, order number, recall or return number);
- what you pressed;
- the exact message.

**Privacy checklist:**

- no customer names, e-mails, addresses or payment details in chat or tickets;
- use record numbers;
- crop screenshots;
- files stay in the Evidence Locker;
- never paste keys, tokens or passwords.

## 4. Training modules (15)

Each module: purpose · try it (staging) · the one rule · check question.

| # | Module | Try it on staging | The one rule | Check |
|---|---|---|---|---|
| 1 | Home | read every row aloud; press Check again | red = cannot be right; "Could not check" = unknown | What does grey mean? (info) |
| 2 | Search | find an old order with "look up in all orders" | lists may be capped; the warning says so | How do you find an order not in the list? |
| 3 | Orders | open an order; find its lines and total | an order without a total is named, not $0 | Is "—" zero? |
| 4 | Customers | open a customer and their orders | one person with a changed e-mail can appear twice (no automatic merge) | Do we merge customers automatically? (no) |
| 5 | Products | create a test product; archive it | archive instead of delete when there is history | Can a sold product be deleted? (no) |
| 6 | Purchase orders | receive a test PO (press twice) | after "Receipt status unknown", only "Check this order now" | What do you press after a lost receive? |
| 7 | Inventory | make a +1 and a −1 adjustment with reasons | always a reason; never below zero | What if it says "changed since the page loaded"? |
| 8 | Returns | log, approve, mark received with an outcome | Mark refunded only records a refund made elsewhere | Does the dashboard pay refunds? (no) |
| 9 | Tasks | move a task; reopen from Recently Done | stale changes are refused | What does "changed elsewhere" mean? |
| 10 | Approvals | approve and reject test requests | the owner decides what staff may approve | Who approves today? |
| 11 | Incidents | open a test incident; link evidence | one record → at most one incident | Where do files go? (Evidence Locker) |
| 12 | Unknown status | read UNKNOWN / NOT VERIFIED rows | unknown is never fine | Is NOT VERIFIED a pass? |
| 13 | Conflict | edit one record in two tabs | reload, compare, redo | Should you press again to force it? |
| 14 | Lost response | read the three lost-reply messages | look before retrying unless the page says it is safe | When is pressing again safe? |
| 15 | Logout / session | sign out in another tab; watch the wipe | sign in again; check your last save | Does an old tab still show data? (no) |

## 5. Operator quiz (20) and answer key

| # | Question | Answer |
|---|---|---|
| 1 | "Receipt status unknown — do not press Receive again". What now? | Press "Check this order now" and follow it. |
| 2 | "may or may not have been saved". Press Save again? | No: look at the list first. |
| 3 | The page says "Pressing the button again is safe". Press again? | Yes. |
| 4 | Home says "Could not check". Fine? | No: unknown. Press Check again; tell the owner if it stays. |
| 5 | An amount shows "—". Is it $0? | No: it could not be read. |
| 6 | "changed since the page loaded" on an adjustment? | Reload and re-count. |
| 7 | "changed elsewhere" on a task? | Reload, compare, redo what is still needed. |
| 8 | You were signed out mid-form. Did it save? | Not necessarily: check the record first. |
| 9 | A customer wants a refund. Can the dashboard pay it? | No. Pay elsewhere; Mark refunded only records it. |
| 10 | A sold product must go. Delete it? | No: archive it. |
| 11 | A bucket would go below zero. Split the adjustment? | No: re-count; tell the owner. |
| 12 | System status shows PROBLEM on a switch. Who acts? | The owner switches it off. |
| 13 | An agent shows ON but should be off. Rerun it to check? | No: the owner switches it off. |
| 14 | Someone asks for your password in chat. | Refuse. Never share keys or passwords. |
| 15 | Where do customer files go? | The Evidence Locker, never chat. |
| 16 | Nightly check "Not set up yet". Problem? | No: expected until installed. |
| 17 | A receive failed part-way and lists two lines. | Finish only those lines by hand, with a note. |
| 18 | The list says it shows the newest 200. All orders? | No: use "look up in all orders". |
| 19 | Can a staff member turn on a feature switch? | No: owner only, one per sitting. |
| 20 | What should you capture for an incident? | Screenshot, time, page, record number, what you pressed, the message; no customer details. |

**High-risk certification card (informal):**

A person may receive POs, adjust stock and mark returns received after they have done all four of these:

- answered all 20 questions correctly without looking;
- received a test PO on staging;
- recovered a simulated lost reply on staging;
- read `INCIDENT_SIMULATION_EXT12.md` §2.

The owner signs it off in a note. No system records it.

## 6. Owner vs staff

| Owner only (now) | Staff (after training) |
|---|---|
| feature switches · emergency mode · business rules · agent switches | daily work: tasks, orders, inquiries |
| every production change (SQL, RLS, migrations, restores) | receiving POs, adjustments, returns (after certification) |
| approving owner-level requests (until #10 is decided) | logging incidents and evidence |
| backups, GitHub, Supabase settings | — |

**Owner high-risk actions:**

- turning a stock switch on;
- RLS / permission changes;
- running a migration draft;
- a restore;
- feature flags;
- business rules.

**Never delegate yet** (because of today's architecture, not as an HR policy):

- switches, emergency mode and business rules (the database rule is UNKNOWN until Query G; decision #11);
- approvals meant for the owner (decision #10);
- anything in Supabase or the backups repository;
- GitHub settings.

## 7. Support and troubleshooting guides

| Guide | What to do |
|---|---|
| **Screenshot** | whole window; crop customer details; include the message and the time; one screenshot per step |
| **Operation / record ID** | copy the record number shown on the row (PO number, order number, incident number); for a lost reply, the page's message plus the time is enough |
| **Conflict** | reload → compare → redo only what is needed (`conflict` card) |
| **Timeout** | the step was not done if the page says "nothing was changed by this step"; if it says "cannot tell", look before retrying |
| **Permission** | "not permitted, nothing was changed" = the database refused; screenshot; tell the owner |
| **Backup status** | System status shows Backups UNKNOWN until the backup row exists (decision #13); the backup look is the owner's 2-minute card |
| **Agent status** | System status → agents: last run, status, "Off — on purpose" for agents switched off by decision; UNKNOWN = not readable |
| **System status** | Continuity page: environment (PRODUCTION / STAGING), switches, Database steps (installed / not installed / UNKNOWN), Switch safety, copyable diagnostic summary (no record contents) |

## 8. Query F, G and H in plain English

**Query F: "is anything stuck, duplicated, pointing at the wrong thing, or impossible?"**

| Check | Means |
|---|---|
| F01 | tasks "in progress" untouched for 14+ days |
| F02 | open tasks more than 7 days past due |
| F03 | approvals waiting 7+ days |
| F04 | recalls still "initiated" (nothing quarantined) after 14+ days |
| F05 | purchase orders expected 7+ days ago and not received |
| F06 | two orders with the same number |
| F07 | two suppliers with the same name |
| F08 | two products with the same name |
| F09 | expenses that look entered twice (same date, amount, category, vendor) |
| F10 | a return linked to a line from a different order |
| F11 | order lines whose SKU matches no product |
| F12 | orders with a missing or negative total |
| F13 | order totals that don't add up (more than 1 cent off) |
| F14 | stock buckets below zero |
| F15 | refund dates missing on refunded returns, or present on unrefunded ones |

**Query G: "who can read or change what?"**

| Check | Means |
|---|---|
| G01 | a table with no row-level security (anyone signed in may see it) |
| G02 | each permission rule, written out |
| G03 | the task update rule may be open to everyone signed in |
| G04 | what visitors who are not signed in can do (should be nothing) |
| G05 | two read rules on one table (untidy, sometimes too broad) |
| G06 | functions visitors could run |
| G07 | security on but no rule (nobody can use the table) |

**Query H: "does production still match what was reviewed?"**

| Check | Means |
|---|---|
| H01 | the stock functions exist and are the reviewed version |
| H02 | visitors cannot run them |
| H03–H07 | no stock switch is ON without its function |
| H08 | request-key columns and switch match |
| H09 | nightly check and its Home switch match |
| H10 | PO line guard present |
| H11 | integrity rules present |

Each row ends in PASS / WARN / FAIL with an ACTION. **Any FAIL: do the action (usually switch something off), then stop.**

## 9. Accessibility and devices

- **Automated checks pass** (`a11y-basics`, `a11y-ext8`). Real VoiceOver and Safari are **NOT VERIFIED**.
- **Keyboard path:** Tab through the sidebar → page; Enter opens; Escape closes dialogs and returns focus to the button that opened them; the command palette (search) can be opened from the keyboard (`search-palette` tests).
- **Zoom path:** widths from desktop down to phone size are tested (`responsive-widths`); browser zoom narrows the page the same way (not tested separately).
- **Phone path:** Home, Tasks and PO lines show as cards; the lot box is inside the card; tables that stay tables scroll inside themselves.
- **Manual cards:** `MANUAL_DEVICE_CHECKLIST_EXT9.md` and card 5 of `OWNER_CHECKS_EXT11.md`.
- **Evidence format:** `device:` (iPhone Safari / Mac Safari / VoiceOver / Chrome), `sha:` (shown in the PR), `tester:`, then one line per step `name: pass` or `name: fail — what happened`.
- **Failure routing:** a FAIL becomes a page fix in a PR with a test for that area. The device result is then STALE and is re-tested on the new version.

## 10. Staging (synthetic copy) checklists

| Checklist | Items |
|---|---|
| Security | built by `tests/tools/staging/build-staging.js`; no production address or key (test); nothing outside is contacted (test); private location only |
| Privacy | synthetic seed only; no real names, e-mails (`example.test` only), addresses or orders |
| Review | banner "DEVELOPMENT / STAGING — NOT PRODUCTION" visible; System status says STAGING; walk modules 1–15 |
| Operator training | modules 1–15 and the quiz on staging; certification card |
| Real device | open the staging link on iPhone and Mac; card 5 on staging is practice only (the real result must be on the merged live version) |
| Teardown | delete the private page (owner), or delete the local folder; nothing else to remove (no database, no keys) |
| Expiry | rebuild for each review; delete it when the review is done. No automatic expiry (none needed: no data, no keys) |
