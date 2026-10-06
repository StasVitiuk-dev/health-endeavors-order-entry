# Idempotency and network retry policy (dashboard writes)

**Status:** CURRENT (2026-10-06, extension 5, workstreams 18 and 39). Source of truth for each path: `docs/ops/write-paths.classification.json` (98 paths), summarised in `WRITE_PATH_MATRIX.md`. The extractor is a **heuristic static check**: it finds `supabase.from(...).insert/update/delete/upsert`, RPCs, storage and sign-out calls. It is a tripwire, not proof of security.

## 1. The four classes

| Class | Count | Meaning | Examples | What protects it |
|---|---|---|---|---|
| **Guarded (a repeat changes nothing)** | 51 | The write only applies from the state the page showed (a condition in the same request), and the reply is read back | task / return / PO status, approvals, restores, deletes, legal hold, FDA flag, recall resolve, flags, business rules | Database condition + "0 rows means it changed elsewhere" message |
| **Naturally idempotent (repeat harmless)** | 14 | Setting a value to the same thing again does nothing new | Emergency switch-offs, agent pause, dismiss reminder, calendar note delete | Nothing needed; still read back |
| **Upsert (repeat converges)** | 2 | Insert-or-update on a unique key | low-stock threshold, calendar note | Unique key |
| **Retry-safe by design** | 6 | Manual order: the same attempt is recognised (number + person + total + customer); items only if none | `manual-order-entry.html` | Page logic (EXT3–EXT5), survives reload, orders without items listed on sign-in |
| **Dangerous to repeat (creates a record)** | 25 | A second identical request creates a second record | new expense, new return, new recall, stock adjustment, new product, new document / evidence / adverse event / legal hold / QC check / supplier / procedure, receive's lot / adjustment / expense rows | One-at-a-time button / submit lock; a lost reply says "cannot tell whether this was saved; check the list before trying again" (never "not saved"); receive is claim-first so it cannot run twice |

## 2. Retry rules

| Request kind | Automatic retry? | Rule |
|---|---|---|
| Reads (GET / HEAD) | **Yes, by the database client:** up to 3 retries (about 1 + 2 + 4 s) on network failure or 503/520 | Safe. Pages show an error after the last attempt, never an empty "nothing here" |
| Guarded / idempotent writes | **No automatic retry.** The person may press again | Safe to repeat: the condition refuses a second application, and the page says what happened |
| Retry-safe (manual order) | No automatic retry; pressing Save again is the intended recovery | The page checks first and never creates a second copy |
| Dangerous to repeat (creates) | **Never automatic.** After an unknown outcome the page tells the person to reload and check first | See section 3 for the real fix |
| Multi-step (receive, return restock, recall quarantine, upload + record) | Never automatic | Claim-first (status condition) so the whole workflow cannot run twice; part-way stops say exactly what was done. Full atomicity needs R1–R5 |
| Storage upload + record | Never automatic | A record refused after the upload removes the file; a lost reply keeps the file and says so (`storage-safety.spec.js`) |

## 3. Recommended future fix for "dangerous to repeat" (PRODUCTION CHANGE, needs approval)

Give each create a **request key** made in the browser (a random id per attempt, kept across a retry), stored in a new nullable column with a unique index (for example `client_request_id` on `expenses`, `returns`, `recalls`, `inventory_adjustments`). A retry then hits the unique index instead of creating a duplicate, and the page treats "already exists" as success. This needs:
- a schema change per table, with a rollback that drops the column and index
- a dashboard change

**Not started:** it is a production database change (owner approval), and the current protections make a duplicate unlikely and visible. Backlog: X5-11.

## 4. Evidence

- `fault-injection.spec.js` and `fault-injection-2.spec.js` run 14 single-write actions against each failure kind: server error, refusal, rule refusal, lost reply before and after saving, gateway page, busy, rate limit, expired sign-in, duplicate, cut-off reply, silent 0-row refusal, empty reply, offline, late reply with a second click. In every case: no success without evidence, and no raw internals.
- `double-submit-stale.spec.js` and `write-path-inventory.spec.js` (lock gate) prove a double click sends one write.
- `manual-order-entry.spec.js` covers the retry-safe order.
