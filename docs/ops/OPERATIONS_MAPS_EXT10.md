# Operations maps (EXT10): entities, write and read paths, side effects, automation rules

**Status:** CURRENT (2026-10-11). For whoever maintains the dashboard. Authoritative detail stays in the generated files (linked); this page connects them. Nothing here is deployed by being written down.

## 1. Critical entities and relationships (from the Query A schema; no full dump)

| Entity (table) | Key links | Notes that matter operationally |
|---|---|---|
| orders | `customer_id` → customers; `entered_by` → profiles; UNIQUE (`channel`, `external_order_id`) | `source` = manual / shopify (future sources fit the same column); `status` free text (classified by `classifyOrderStatus`); `deleted_at` = recycle bin |
| order_items | `order_id` → orders | `sku` matched to products case-insensitively (Query F F11) |
| customers | written by Agent #4 | duplicate watcher: none built (no reliable normalized key yet; see §8) |
| products | `status` draft / active / discontinued; `is_active` | deactivate keeps history; delete refused when used (R5) |
| inventory | one row per product (UNIQUE product_id); 8 buckets, CHECK ≥ 0 (7 today, `recalled` with draft 23) | changed only through `changeStock` (compare-and-set) or R1–R5 |
| inventory_adjustments | product, bucket, change, reason, `adjusted_by`, lot | the stock history (provenance: who, when, why, which lot) |
| inventory_lots | product, PO, received / remaining | lot ranges enforced by draft 23 |
| purchase_orders / purchase_order_items | supplier; lines with `quantity_received`, landed cost | status machine §4; lines editable only draft/ordered |
| expenses | one per received PO (note "Purchase order PO-…") | duplicate check on Home and Query F F09 |
| returns | order, order line, status, disposition, refund amount/date | physical return, stock and refund are **separate fields** (§6) |
| recalls | lot, product, status, quantity quarantined | |
| tasks / incidents / approval_requests | — | status machines in `STATE_MACHINES.md` |
| audit_log | written by triggers on core tables | business actions; **not** a technical error log (§9) |
| feature_flags / agent_controls / business_rules | — | switches and settings; every change uses `updateIfUnchanged` and a password |

## 2. High-risk write paths: UI → code → database → audit → result

Full generated list (105 paths, guards, retry class): `WRITE_PATH_INVENTORY.md` / `MUTATION_WRITE_PATH_INVENTORY.json`. The high-risk ones:

| UI action | Page function | Database (today) | With switch on | Audit / history | Result shown |
|---|---|---|---|---|---|
| Receive delivery | `wirePoDetail` → recvBtn | claim `purchase_orders` (conditional) → per line `changeStock` + `inventory_adjustments` + lots + line `quantity_received` → `expenses` insert | `receive_purchase_order` (R1) | audit trigger + adjustments rows with reason "Delivery received (PO)" | toast with items stocked; partial failure names what to finish; unknown → receipt lock (§7) |
| Manual stock adjustment | adjust form | `changeStock` (compare-and-set, 5 retries) + `inventory_adjustments` | `adjust_inventory` (R4, sends the number shown) | adjustments row with reason and actor | toast / "changed since the page loaded" |
| Recall quarantine | `.recallQuarantineBtn` | 2 × `changeStock` + 2 history rows + recall status | `quarantine_recall` (R2) | history rows "Recall — quarantined" | — |
| Return received | `.markReceivedBtn` | claim return → `changeStock` + history | `receive_return` (R3) | history row "Return received (order …)" | — |
| Product delete | product row | fresh reference checks → delete | `delete_unused_product` (R5) | audit trigger | refused when used / stocked |
| Approve / deny | approvals | conditional status update after password | — | audit trigger | stale tab told |
| Switches | Feature Switches / AI Agents | `updateIfUnchanged` after password (+ dependency probe) | — | `updated_by/at` on the row | refused with the reason |

## 3. Side-effect map vs the R1–R5 SQL (transaction boundary check)

Checked against `drafts/10_DRAFT_stock_functions.sql` (line numbers of the reviewed version, fingerprint `3df2bf7a…`):

| Function | Writes inside its one transaction | Hidden side effect outside it? |
|---|---|---|
| R1 receive_purchase_order | lines `quantity_received` (l.289, 334), lots (l.323), stock via `_he_apply_stock_change` → inventory + adjustments (l.332), expense (l.343), PO status (l.350) | none |
| R2 quarantine_recall | inventory row ensured (l.404), available −n and recalled +n with history (l.412–413), recall status (l.415) | none |
| R3 receive_return | stock + history (l.491), return status/disposition (l.498) | none; refund is **not** touched |
| R4 adjust_inventory | stock + history via the helper (l.217) | none |
| R5 delete_unused_product | product delete after checks | none |

The page code with switches on writes nothing else around these calls (`callStockFunction` then reloads). Tested: `install_package_test.sh` 61/61 (failure injected at every write leaves nothing).

## 4. Places that are intentionally NOT atomic today (eventual consistency inventory)

| Path | Why not atomic | How a half-done state is found and fixed |
|---|---|---|
| Browser receive (switch off) | several requests | claim-first; failure report names the missing parts; Home "Received orders not fully in stock"; Query E; order line says "not fully in stock" (EXT10) |
| Browser recall / return / adjustment (switch off) | stock and history are separate requests | Query E stock-vs-history; Home negative stock |
| Upload then save (receipts, documents, evidence) | storage and table are separate systems | file removed again when the row is refused; lost reply: read back by file path |
| Manual order + items | two inserts | page detects items missing; Home "Orders saved without items" |
| Nightly check run | results insert and run log | inside one function; failure recorded, half results undone (drafts/29) |

None of these is called atomic anywhere in the dashboard or the docs.

## 5. High-value read paths

| View | Reads | Truthfulness rule |
|---|---|---|
| Home checks | 13 reads via `fetchAllRows` (paged, exact) + agent switches/schedule | a failed read = "could not check" for that row only |
| Business health tiles | counts per tile | "?" on the failing tile only |
| Nightly card | flag → 2 × latest run (limit 1) → results of that run (limit 200) | NOT VERIFIED / UNKNOWN / STALE before PASS |
| Search | local index of loaded lists + order lookup in all orders | "newest N matches" labelled |
| Accounting / Tax | `fetchAllRows` (exact, paged, latest-request token) | refuses a smaller total if rows went missing |
| System status | one tiny read with timing | failure = "Could not read… UNKNOWN" |

## 6. Returns: physical, stock and money are separate

| Fact | Field | Set by |
|---|---|---|
| Product physically came back | `returns.status = received`, `received_at` | Mark received |
| Stock changed | `disposition` + history row | same step (restock available / damaged / discard) |
| Refund recorded | `refund_amount`, `refunded_at`, status `refunded` | Mark refunded (record only; money moved outside) |
| Accounting treatment | **not decided** (N4) | Accounting today ignores recorded refunds unless the order itself is marked refunded |

Partial returns: whole line today; options in `OWNER_DECISION_PACKETS_EXT10.md` §1 (no implementation that locks a policy in).

## 7. Request lookup / operation receipts (missions 24, 25, 336–338, 347)

| Operation | How the operator learns the outcome after a lost reply |
|---|---|
| Any create with request keys on | press again: the database refuses the duplicate and the page says "already saved" (request key = operation receipt) |
| PO receive (switch off) | claim stamp read-back; if unreadable → **receipt lock** + "Check this order now" (EXT10b) |
| PO receive (R1 on) | press again: R1 answers "already received" |
| Stock adjustment (R4 on) | `p_expected` refuses a second apply ("changed since the page loaded") |
| Approvals, status changes | conditional updates: a repeat changes 0 rows and the page says it was already changed |

A separate generic "operation receipts" table was **not** built: request keys + conditional updates already give every high-risk write a lookup, and a new table would need a production change for little gain.

## 8. Data-quality watchers (read-only; no merge, no delete)

| Signal | Where | Basis |
|---|---|---|
| Duplicate order numbers | Query F F06, nightly card | not-deleted orders |
| Duplicate external order IDs | database UNIQUE (`channel`, `external_order_id`) | prevents rather than detects |
| Duplicate suppliers / products by name | F07 / F08 | case and spaces ignored |
| Duplicate expenses | F09; Home duplicate PO expense | same date, amount, category, vendor |
| Duplicate PO receipt | Home duplicate PO expense; Query E "more than one delivery expense"; R1 refuses | — |
| Orphan references | F10 (return line on another order), F11 (unknown SKU) | — |
| Invalid statuses | database CHECKs (tasks, POs, returns, recalls, approvals, products); page shows unknown statuses as text, never crashes (`mock-realism`) | — |
| Duplicate customers | **not built**: emails are optional and not normalized in the schema; Agent #4 links customers. A watcher needs a decision on the matching key | owner decision (later) |
| Duplicate invoices | **not built**: invoices are written by Agent #1 (code outside this repo) | agent source |

## 9. Error telemetry contract (future; no provider, no table)

| Field | Example | Never |
|---|---|---|
| time | ISO time | — |
| page | `purchaseOrdersPanel` | URL query strings with data |
| kind | connection / permission / conflict / switch / other | raw message text |
| operation | `po.receive`, `stock.adjust` | record contents |
| request key | the attempt's UUID when present | — |
| build | helpers API + asset hashes | keys, tokens, e-mails |

Audit log = business actions (who changed what). Error log = technical failures. They stay separate. Today only the copyable diagnostic summary exists (System status).

## 10. Automation rules (D1–D11 and any future agent)

1. **Read → detect → draft → notify a person**, before any write. A write by automation needs an explicit owner decision per automation.
2. **Approval map:** D1 nightly integrity check — reads only, writes its own results (approved design, not installed). Everything that would create tasks, change stock, send messages or touch money — approval before side effect. No D-item may send customer messages or move money.
3. **Issue keys:** an automation that opens a task/incident uses a deterministic key (`check:F02`, `recon:po:<id>`, `lowstock:<product>`, `agent:<n>:failed`); an open item with the same key is updated, not duplicated; a key whose item was closed may open a new item (recurrence keeps history). Same idea as `fixedRequestKey` for escalations.
4. **Collisions:** one run at a time per automation (advisory lock or `cron.job` single schedule); a second start exits.
5. **Missed runs:** never backfilled with writes; the next run reports "last success …" and Home shows STALE.
6. **Time zone:** schedules in UTC (pg_cron) with the Central time written next to them; DST moves the local time by an hour, never the UTC run.
7. **Partial results:** a run that fails part-way records FAILED and keeps no half results (drafts/29 pattern); one failing check never marks the others good.
8. **Dry run:** a new automation first runs in dry-run (logs what it would do), like Agent #6.
9. **Audit of automation writes:** actor = the agent's identity, reason names the automation; a person changing an automation-created item is recorded as that person.

## 11. Future Shopify intake contract (internal side only; no website work)

| Concern | Contract |
|---|---|
| Duplicate webhook / replay / retry | UNIQUE (`channel`, `external_order_id`) already refuses a second order; intake must treat "already exists" as success |
| Out of order (update before create) | upsert by external id; never create from an update without the full order |
| Paid order missing internally | reconciliation queue: Shopify paid orders without an internal row = exception (read-only list) |
| Customer matching | Agent #4 links; mismatch → task, never auto-merge |
| Line items | order + items in one transaction (a future RPC), or the existing "orders without items" check |
| Invoice trigger | Agent #1 is UNVERIFIED: order creation must not assume invoices are made |
| External ID immutability | the dashboard has no edit for `external_order_id`; a future DB rule should refuse changes (proposal) |
| Integration request id | store the webhook id with the order (column proposal, not drafted) |
| Dead letter | failed intake events visible as an exception list with "replay" by a person (design only) |

## 12. Scale budget (practical, not precise)

| Operation | Expectation | Evidence |
|---|---|---|
| Sign in → Home usable | a few seconds | 5,000 tasks / 2,000 incidents / 1,500 approvals / 1,200 POs drawn in seconds (large-data-ext9) |
| Accounting / Tax all time | under 20 s at 10,000 orders on this machine | report-totals (16–19 s) |
| Pick-lists | complete at any size | scale-ext10b (300 products / 150 suppliers past a 100-row cap) |
| Nightly check | under 1 s at 50,000 orders | integrity_perf_test.sh (0.3 s) |

Structural limits found: list pages that show only the newest rows now say so; server-side pagination for Orders/PO lists is the next step when real data passes ~1,000 rows (not needed at today's volume). Multi-location stock is **not** supported by the schema (one inventory row per product): a future change, not a bug.
