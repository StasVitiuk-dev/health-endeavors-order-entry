# Plan: make "Receive delivery" all-or-nothing

Status: **local draft, not published.** Written September 29, 2026. Nothing here has been run against Supabase.

## 1. The exact cause

The "Receive delivery" button handler (`owner-login.html`, lines 4532–4641) saves a delivery with many separate requests from the browser, one after another. For a purchase order with N catalogue lines, that's up to **3N + 5N + 2** writes:

| Step | Table | When |
| --- | --- | --- |
| 1 | `purchase_order_items.landed_unit_cost` | once per line (4551) |
| 2 | `inventory_lots` read + insert/update | per line, only if a lot # was typed (4567–4589) |
| 3 | `inventory` read, then write `available = old + qty` | per catalogue line (4592–4600) |
| 4 | `inventory_adjustments` insert | per catalogue line (4601) |
| 5 | `purchase_order_items.quantity_received` | per catalogue line (4606) |
| 6 | `expenses` insert (whole PO total) | once (4614) |
| 7 | `purchase_orders.status = 'received'` | once, last (4624) |

Each request is its own database transaction. If the connection drops, or any one request fails, the earlier ones stay saved and the later ones never happen. Nothing undoes them.

The retry makes it worse:

- **Immediate retry doubles everything.** After an error the button is re-enabled (4638), but the page keeps the order data it loaded *before* the first attempt. That data still says 0 received on every line. So pressing Receive again re-adds **all** the stock, writes all the adjustments again, and logs the expense a second time. This is true even for lines that were fully saved.
- **Retry after a reload still double-counts:**
  - The expense is inserted *before* the status update. If only the status update was lost, the expense is logged twice.
  - A line whose stock was added (step 3) but whose "received" mark (step 5) was lost gets its stock added again.
- **"Saved but the reply was lost" is the worst case.** The database did the write but the browser never heard back. The browser can't tell this apart from "never saved", so it cannot safely decide what to redo.
- **A related problem (review item 2.2):** step 3 reads the stock number, adds in the browser, and writes the total back. Two people receiving, or an agent adjusting the same product at the same moment, can silently overwrite each other.

## 2. Reproduced? Yes, with synthetic data only

The new test file `tests/specs/po-receive.spec.js` sets up a fake purchase order in the mock:
- 2 lines: 50 units of product A at $2, and 20 units of product B at $5
- $15 shipping and $5 tax
- starting stock: A = 10, B = 0

It then simulates a dropped connection at a chosen request, either before the database saves it or after it saves but before the reply arrives.

| Scenario | What the data looked like afterwards | Correct result |
| --- | --- | --- |
| Good connection (baseline) | A 60, B 20, 2 adjustments, 1 expense, received | same ✅ |
| Drop on the final status update | A 60, B 20, 2 adjustments, 1 expense, **still "shipped"** | nothing changed, or all done |
| …then press Receive again | **A 110, B 40, 4 adjustments, 2 expenses** | A 60, B 20, 1 expense |
| …or reload, then press Receive | A 60, B 20, **2 expenses** | 1 expense |
| Line A's stock saved, reply lost | **A 60, 0 adjustments, lines not marked received**, still "shipped" | nothing changed, or all done |
| …then reload and press Receive | **A 110**, B 20, 1 expense | A 60 |

Test results:
- New file: 16/16 passing (8 scenarios × desktop and iPhone size).
- 80/80 across 5 repeats, with no flakiness.
- Full suite: 81 passed, 9 skipped (the same 9 as before).

About the test types:
- The 6 "current behaviour" tests assert today's wrong numbers, so they pass now and document the bug.
- The 2 "all-or-nothing" tests assert the correct numbers and are marked `test.fail()`. I checked that they fail on the numbers, not on a click or timeout. Once the fix lands, Playwright will flag them. Then we remove `test.fail()` and delete or flip the "current behaviour" tests.

The test file adds its own fault injection and lets inserts on these tables persist, on top of the shared mock. The shared helpers in `tests/helpers/` were **not** changed.

## 3. Proposed fix: one database function, one call

Move the whole receive into **one Postgres function**. Postgres runs a function in a single transaction, so either every write happens or none do.

```
receive_purchase_order(p_po_id uuid, p_lots jsonb) returns jsonb
```

Inside the function, in order:

1. `select … from purchase_orders where id = p_po_id for update`. This locks the order row, so two clicks or two people can't receive the same order at once.
2. **Idempotency guard:** if the status is already `received`, return `{ "already_received": true }` without changing anything. If the status is not `ordered` or `shipped`, raise an error.
   - This makes "saved but reply lost" safe. The retry just gets back "already received".
3. For each line: set `landed_unit_cost`, using the same formula as today.
4. For each catalogue line with outstanding quantity:
   - find or create the lot (if a lot # was given in `p_lots`)
   - update stock with `insert … on conflict (product_id) do update set available = inventory.available + excluded.available`. The arithmetic happens in the database, which also fixes item 2.2.
   - insert the `inventory_adjustments` row
   - set `quantity_received = quantity`
5. Insert the `expenses` row, if the total is above 0.
6. Set `purchase_orders.status = 'received'`, `received_at = now()`, `received_by = auth.uid()`.
7. Return counts (stocked, skipped) for the toast message.

**Security choice:** `security invoker`, which is the default. The function then runs with the logged-in user's own permissions, so row-level security still applies exactly as it does today. It never gets more power than the button already has. Execute permission is granted to `authenticated` only.

**Dashboard change (small):** replace lines 4536–4628 with one call, `supabase.rpc('receive_purchase_order', { p_po_id, p_lots })`, where `p_lots` collects the typed lot numbers. Error handling changes too:
- On any error, **reload the order list** instead of re-enabling a button that holds stale data.
- If the reload shows the order is already received, say so rather than showing an error.

**Before writing the SQL**, I need the real table definitions: column types, defaults, constraints, triggers, and RLS policies for `purchase_orders`, `purchase_order_items`, `inventory`, `inventory_lots`, `inventory_adjustments` and `expenses`. You can get them with a read-only query in the Supabase SQL editor, which I'll give you when we start. I have not guessed them into a file here on purpose.

## 4. Rollout order (each step needs your approval)

1. **PR A (tests only):** add `tests/specs/po-receive.spec.js`. No dashboard change.
2. **SQL draft (in a PR, not run):**
   - `sql/receive_purchase_order.sql`, plus a rollback script (`drop function …`)
   - a test script you can run inside `begin … rollback` on synthetic rows, so nothing is kept
3. **You run the SQL** in Supabase after reviewing it. The function sits unused until step 4, so this changes nothing on the live site.
4. **PR B (dashboard):**
   - switch the button to the single `rpc` call
   - add the function to the mock
   - flip the two `test.fail()` tests to normal tests, and retire the "current behaviour" ones
   - Rollback = revert PR B. The old code path still works, because the tables are unchanged.
5. Later, same pattern: recall "quarantine stock" (review item 2.3, lines ~4910–4990) has the identical problem.

## 5. Decisions and risks for you

- **Database change:** this adds a function to production, and it changes money and inventory logic (it writes expenses and stock). Per the rules, only you run it.
- **Receiving part of a delivery:** today there is no partial receive. Every line is marked fully received. The plan keeps that. Say if you want partial deliveries, because that changes the design.
- **Retries:** with the idempotency guard, a second press on an already-received order does nothing and says "already received". Please confirm that's what you want.
- **Audit:** the `tasks` audit trigger doesn't cover these tables as far as the page shows. It's worth checking whether `inventory` or `expenses` have audit triggers, since they'd fire inside the function exactly as before.
- **Existing double-counts:** any delivery that already failed halfway in the past may have left extra stock or duplicate expenses. A read-only query can look for duplicate `expenses` rows with the same "Purchase order …" note. That's optional, and I'd give you the query rather than run anything.
- **Side finding (phone):** on an iPhone-size screen, tapping a purchase order row also opens the "change history" overlay on top of the order. You have to close it to reach "Receive delivery". This isn't part of this fix, but it's worth its own small PR.
- **Minor:** when every line costs $0, shipping and tax are split by number of lines, including zero-quantity lines (4549). This is harmless today. The SQL version should mirror it exactly so that true costs don't change.

## 6. Owner decisions (September 29, 2026)

1. Yes: before drafting the SQL, Stas runs a read-only query to show the real table structure.
2. Yes: receiving an already-received order returns "already received" and changes nothing.
3. Partial deliveries stay unsupported for now.
4. Yes: later, a separate read-only check for possible duplicate expenses from past failed receives.
