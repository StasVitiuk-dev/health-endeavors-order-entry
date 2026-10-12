# Purchase-order receive vs line changes: race review

**Status:** CURRENT (2026-10-07, extension 6; first written in extension 5). The dashboard fixes are on the extension branches; not live until merged. The database guard is a **draft, not installed**, and needs the owner's approval. **EXT6 changed the guard and the install order: see section 0.** Sections 3 and 4 below are kept as the EXT5 record; where they disagree with section 0, section 0 wins.

## 0. Extension 6 update (read this first)

### 0a. The gap EXT6 found
The EXT5 guard re-read the order's status **without locking it** when a line was deleted or changed. That is safe with R1, because R1 locks every line before it receives. It is **not safe with the dashboard's receive as it runs today**, which claims the order in one request and then stocks the lines one request at a time. A line deleted in the instant between the guard's check and its commit could still be stocked by a receive that claimed the order in that instant.

The new test `local-test/po_browser_path_races.sh` copies today's receive step by step and forces each ordering:

| Edit made in another tab | No guard | EXT5 guard | **EXT6 guard** |
|---|---|---|---|
| delete a line (edit held open while the receive runs) | reported | **reported** (stock added for a deleted line) | agree |
| delete a line (receive first) | reported | agree | agree |
| add a line (edit held open) | SILENT (EXT5 editor warning not in this path) | agree | agree |
| add a line (receive first) | reported | agree | agree |
| change quantity (edit held open) | reported | **reported** | agree |
| change quantity (receive first) | reported | agree | agree |
| change price (either order) | agree * | agree | agree |
| shipping change (either order) | agree | agree | agree |
| cancel (either order) | agree | agree | agree |

"reported" = order and stock disagree, but the dashboard tells someone (EXT5 detection). "agree" = they match. \* the expense is computed after the change, so it matched in this test; the guard refuses price changes on a received order anyway.

With R1 (`po_race_interleavings.sh`), the EXT6 guard keeps every forced ordering consistent (12/12), with no deadlock.

### 0b. The fix (in `drafts/17`, still NOT installed)
Line deletes and edits now take a **share lock on the order, with NOWAIT**, before reading its status. The lock is held until the edit commits, so a receive (R1 or the dashboard's claim) either waits for the edit or the edit sees "received". NOWAIT means the edit never *waits* on the order: if someone holds the order at that moment (a receive, a cancel, a shipping edit), the edit is refused at once: "Purchase order is being received or changed by someone else right now. Nothing was changed — wait a moment, reload the page and try again." Waiting could deadlock with R1 (which holds the order and waits for the lines), and refusing cannot. Inserts still wait (they hold no line lock), as before.

**Cost:** a line edit made in the same instant as another change to the same order is refused and must be repeated. This is rare and safe. The dashboard already shows the message in plain words, and `explainDbError` (EXT6) also explains a raw "could not obtain lock" or "deadlock detected" as "nothing was changed by this step".

### 0c. Install order (supersedes section 4, points 2–3)
The guard **no longer needs R1 first**. It protects the receive path in use today, so it can be installed on its own (after approval), before or after R1. Rollback is unchanged (`drafts/18`).

### 0d. Every case in the request, and where it is covered

| | Race | Outcome / protection | Evidence |
|---|---|---|---|
| A | receive vs line delete | EXT6 guard: consistent in every ordering, browser path and R1 | `po_browser_path_races.sh`, `po_race_interleavings.sh`, S27 |
| B | receive vs line insert | guard (insert waits on the order) | same |
| C | receive vs quantity change | EXT6 guard | same |
| D | receive vs price change | guard covers `unit_cost`; the dashboard re-reads after the claim (EXT5) | `po_browser_path_races.sh` (price), `po-receive.spec.js` |
| E | receive vs cancel | both are "only if still …" status writes on the same row; exactly one wins | `po_browser_path_races.sh` (cancel), S25, `state-transitions.spec.js` |
| F | receive vs approval | "approval" here is Mark ordered (draft → ordered); a receive cannot start from draft (`PO_ALLOWED_FROM`), so the two cannot overlap on one order | code review; `state-machine.spec.js` |
| G | receive vs receive | claim-first (only one claim can win); R1 locks the order | `po-receive.spec.js` (second click, second tab, stale page), stress |
| H | receive vs reload | the claimed order offers no second Receive after a reload | `po-receive.spec.js` |
| I | receive vs network loss | lost reply / drop after stock: says what was done, never "done" | `po-receive.spec.js`, `fault-injection*.spec.js`; all-or-nothing needs R1 (wanted test marked `test.fail`) |
| J | receive vs permission change | **EXT6 test:** permission refused after the claim: "stopped part-way", plain words, no success, no second Receive | `po-receive.spec.js` "permission removed while receiving" |

Still not atomic without R1: a receive that stops part-way leaves the order "Received" with some lines stocked. It is reported clearly and is visible in the new read-only **Query E** (`04_READONLY_E_stock_reconciliation.sql`), but only R1 removes it.

## 1. The problem in one paragraph

Receiving a purchase order adds each line's units to stock and logs the order's cost as an expense. If the lines change while (or after) the receive reads them, the order and the stock disagree. A removed line may already be in stock. An added line is never received, yet the order says "Received". A changed quantity no longer matches what was stocked.

## 2. What exactly goes wrong (evidence)

### 2a. Dashboard today (browser path, before R1)

| Case | Before extension 5 | Now (branch) | Test |
|---|---|---|---|
| Another tab changed the lines / shipping / tax **minutes earlier**, then Receive is pressed on a page opened before that | **Bug:** the receive used the lines, shipping and tax the page loaded. The claim only checked the status, so removed lines were stocked and charged, added lines were ignored, and the old shipping was charged | **Fixed:** the order is re-read right after the claim and the saved version is received. The page says the order had changed since it was opened | `po-receive.spec.js` "order changed in another tab" (4 tests fail on the old page) |
| A line is removed **during** the receive, before that line is marked received | Work stopped part-way, but the message guessed "no permission?" | Same truthful stop, now naming the cause ("removed from the order while it was being received") | same |
| A line changes **after** the last line was marked, before the expense | Clean "Received" success | **No success message:** a final re-check of the lines reports that the lines changed while receiving | same |
| The editor's side: the status is checked, then the line is added or removed in a second request, and a Receive lands in between | No warning to the editor | **Warned:** after the write the status is re-read; if the order is no longer editable, the editor is told to check Inventory | `purchase-orders.spec.js` (2 tests) |

**Remaining browser-side window:** an edit whose status check passed just before the claim can still land after the receive's re-read. The dashboard now *detects and reports* this (both sides). It cannot *prevent* it: the browser cannot make two requests atomic. Prevention needs the database (below).

### 2b. Database path (R1 draft), local throwaway PostgreSQL

| Interleaving (forced with held transactions, `po_race_interleavings.sh`) | No guard | With guard (`drafts/17`) |
|---|---|---|
| Line delete first, then receive | agree | agree |
| Receive first, then line delete | **disagree** | agree (delete refused) |
| Line add first, then receive | agree | agree |
| Receive first, then line add | **disagree** | agree (add refused) |
| Quantity change first, then receive | agree | agree |
| Receive first, then quantity change | **disagree** | agree (change refused) |

Random races (`stress_test.sh` S27, 20 each, simultaneous starts), no guard:
- 4–7 of 20 failed for delete, across 8 runs
- 5 of 20 failed for add
- 6 of 20 failed for quantity change

With the guard: **0 of 20 for each, 0 deadlocks**.

**Why "edit first" is already safe:** R1 locks the order row and then every line. A delete or update holds the line's lock, and an insert holds a key-share lock on the order, so R1 waits and then reads the lines fresh.

**Why "receive first" fails:** once R1 has committed (or while it holds locks, the edit then proceeds after it), nothing at the database level says a received order's lines are frozen. The status check lives only in the dashboard, in a separate request.

## 3. Protections compared

| Option | Covers | Remaining window | Deadlock risk | Retry behaviour | Migration / rollback | R1 compatible | User-facing | Verdict |
|---|---|---|---|---|---|---|---|---|
| **A. Line guard trigger** (`drafts/17`, extended in EXT5 to insert / update / delete) | Every path that writes lines: dashboard, R1, agents, SQL editor | None found: all 6 forced orderings and 60 random races agree | **None observed.** Insert waits on the order (it holds no line lock). Delete/update use a plain re-read, because waiting on the order would invert R1's lock order; a first version that did wait deadlocked once | The refused edit gets a clear message; the receive is unaffected | One trigger + one function; rollback `drafts/18` (tested in S27) | Yes; allows R1's own `quantity_received` / `landed_unit_cost` writes | "Purchase order X is Received now, so its lines can no longer be changed" | **Recommended** |
| B. Immutable lines once Received (status rule only, no locking) | Edits after the receive committed | The receive-in-progress window (status still "ordered" until R1's last statement) | — | — | Same as A | Yes | Same | Weaker than A; A includes it |
| C. Row locks only (FOR UPDATE in every editor) | Edits that take the lock | Inserts (no row to lock) and any writer that skips the convention | Medium (lock-order discipline needed everywhere) | — | Requires changing every writer | Partly | — | Fragile |
| D. Advisory lock per order (`pg_advisory_xact_lock(po_id)`) in R1 and in every editor | Writers that call it | Any writer that forgets (agents, SQL editor, the dashboard today) | Low | Fine | Needs an RPC for line edits; more code | Yes | — | Good inside functions; needs everyone to cooperate |
| E. Version column (optimistic locking) on the order | Stale editors that send the version | Writers that do not send it; needs a schema change | None | Editor retries after reload | Schema change + dashboard change | Needs R1 change | "Changed since you opened it" | Useful later; more invasive |
| F. Receive only through one RPC (R1) | Atomic receive | Line edits still race (S27 shows this with R1) | — | — | Already drafted | — | — | Necessary, not sufficient |
| G. SERIALIZABLE isolation for R1 and editors | All read/write anomalies, in principle | Only if every writer uses it; dashboard writes via PostgREST default READ COMMITTED | None (serialization failures instead) | Callers must retry on 40001 | Global behaviour change | Possible | Retry errors | Too broad for this problem |

## 4. Recommendation (draft; owner approval required)

1. **Merge the dashboard fixes** (branch). They remove the stale-tab bug that exists today, even without any database change, and they report the in-flight case on both sides.
2. **Install R1** (all-or-nothing receive) as already planned.
3. **Then install the line guard** (`drafts/17`, rollback `drafts/18`). It is small, changes no data and is covered by `stress_test.sh` S27 and `po_race_interleavings.sh`.
4. Later (optional): a version column (option E) if stale editing of order headers becomes a problem.

## 5. Interleavings in the request list and where they are covered

| Case | Coverage |
|---|---|
| delete before / after / simultaneous with receive | `po_race_interleavings.sh`, S27 |
| line edit / quantity change / add vs receive | same |
| cancel vs receive | S25 (all-or-nothing outcome), dashboard: both status-conditional (`state-transitions.spec.js`) |
| retry after failed / uncertain receive | `po-receive.spec.js` (claim lost, reply lost, drop after stock) |
| stale tab, two tabs, double click / Enter | `po-receive.spec.js`, `double-submit-stale.spec.js` |
| owner + employee at once | stress S17 (employee refused, owner once); `role-matrix.spec.js` |
| slow / dropped / delayed response; loss before / after success | `po-receive.spec.js`, `fault-injection*.spec.js`, `session-expiry-midway.spec.js` |
| receive vs product edit / product delete | product edit does not touch lines; delete refused while lines reference the product (stress S29, `product-lifecycle.spec.js`) |
| receive vs lot assignment / same lot twice | stress S26 |
| receive vs quarantine | stress S28 (recall vs stock movement) |
| two employee sessions | employees cannot receive (refused up front and by R1) |

## 6. Limits

- The local database is not Supabase. Lock behaviour is PostgreSQL's own and identical in principle, but timings differ.
- The dashboard cannot prevent the in-flight window, only report it. Prevention is the guard.
- Agents or other tools that edit lines (unknown until Query C sections 5–7) are covered by the guard once installed. Until then they are not covered.
