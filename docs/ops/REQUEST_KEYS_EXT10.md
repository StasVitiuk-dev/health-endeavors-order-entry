# Request keys: coverage, lifecycle and concurrency (EXT10, U42)

**Status:** CURRENT (2026-10-11). Dashboard side IMPLEMENTED IN BRANCH and TESTED LOCALLY. Database side (drafts/19 columns + unique indexes, drafts/27 switch row): **NOT INSTALLED**. The `request_keys` switch stays **OFF**; with it off the dashboard sends no key (today's behaviour, proven by a test per form). Earlier design: `IDEMPOTENCY_AND_RETRY_POLICY.md` (still valid); EXT9 first five forms: `DEEP_PLATFORM_EXTENSION_9_2026-10-10.md` §3.

Plain English: when the internet drops at the exact moment you press Save, the dashboard cannot know whether the record was saved. Pressing Save again could create a duplicate. A request key is a random label made for that one attempt; the database refuses a second record with the same label, and the page says "already saved". After EXT10 every form that creates a record sends one (once the database step is installed and the switch is on).

## 1. Coverage (generated inventory: `WRITE_PATH_INVENTORY.md`, class "REQUEST KEY IN PAGE")

| Create | Since | Element holding the key |
|---|---|---|
| Expenses (with or without receipt), products, suppliers, purchase orders, recalls | EXT9 | the form |
| Home reminder, quick-add reminder, feature request, procedure (SOP), legal hold, adverse event, quality check, personal event, document (with/without file), evidence (with/without file), return, purchase order line | **EXT10** | the form (quick add: its Save button; PO line: its Add button) |
| Escalate a quality check / recall to an incident | **EXT10** | key **made from the record** (`fixedRequestKey('escalate|table|id')`): every tab and every retry makes the same key, so at most one incident; a repeat finds the existing incident and links it |

**Not keyed, on purpose:**

| Path | Why | Protection instead |
|---|---|---|
| Stock rows written during PO receive, recall quarantine, return restock, manual adjustment (browser path) | these are steps of a stock change, not a person's create | claim-first + conditional updates today; **R1–R5** behind `stock_fn_*` switches make the whole change one database step |
| Manual orders (`manual-order-entry.html`) | separate page with its own duplicate check (same order only if every field matches; survives reload) | client-side match (CLIENT-SIDE MITIGATION ONLY in the inventory). A key there is a possible next step (backlog X10-05) |
| Calendar note | one note per event: insert-then-conditional-update (EXT9) | unique per event |

## 2. Lifecycle (TTL)

| Rule | Behaviour | Test |
|---|---|---|
| Made | on the first press, only if the switch reads ON at that press | switch-off tests (one per form) |
| Kept | until a save succeeds or is reported as a repeat | "lost reply, press again" per form |
| Same content, any age | same key (a real retry is never duplicated, even hours later) | "the same content even hours later" |
| Different content within 10 min of the first attempt | same key: refused and the person is told "those changes were not saved" (no silent duplicate) | "different content right after" |
| Different content after 10 min | treated as a new entry: new key (stale key dropped) | "more than 10 minutes" |
| Another person signs in on the tab | new key (a key is tied to the signed-in user) | "another person signs in" |
| Reload / new tab | no key carried over; the page's lost-reply message says to check the list first | by design |
| Two tabs, same text | two keys, two records: two separate entries are two decisions, not a retry | "two tabs" |

**Same key, different user (database side):** drafts/19's index is per table, not per user, so a key collision across users would be refused. Keys are 122 random bits made with `crypto.getRandomValues`, so an accidental collision is not a realistic risk; a deliberately reused key can only make the second insert fail (never overwrite). Binding the key to `auth.uid()` in the index (`unique (created_by, client_request_id)`) is an option for a later draft; it needs every table to have a reliable creator column (not true today: e.g. `returns.created_by` nullable). Recorded as X10-06 (OWNER DECISION not needed; technical follow-up).

## 3. Concurrency cases (tests in `tests/specs/request-keys-ext10.spec.js`, 30 tests)

Same button twice → one request · rapid repeats after a lost reply (5 presses) → one record, one key · timeout where nothing was saved, then retry → saved once, no false "already saved" · lost reply where it was saved, then retry → "already saved" · same payload after success → new key, new record · different payload same key → refused and told · stale key → dropped after 10 min · another user → new key · two tabs → two records · escalate twice → one incident, linked.

Mutation check: 12 deliberate breakages of this logic, all caught (`tests/mutation/run-page-mutations.js`, EXT10 block).

## 4. Turning it on (owner, later; unchanged order)

1. Install drafts/19 (columns + unique indexes) and drafts/27 (switch row, off). 2. Run the read-only check in `PRODUCTION_READONLY_VERIFICATION_EXT10.md` (V-RK). 3. Turn on `request_keys` on Feature Switches: the switch refuses to turn on if the columns are missing. 4. Rollback = switch off (instant); drafts/20 + 28 remove the database part.
