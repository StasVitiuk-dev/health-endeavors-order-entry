# Shopify ↔ internal dashboard: integration service architecture (PROPOSED)

**Status:** proposal, 2026-10-04. No repository, code or infrastructure has been created. Hosting is owner decision D-3.

**Prior work this builds on:**
- the event contracts and simulator from the website workspace: `contracts/schemas/integration/*.schema.json`, `docs/website/integration-contracts.md`, `integration-lab.md`, `idempotency.md`
- the synthetic end-to-end journey test

That code currently lives only in the website workspace (git bundle `…_v4.bundle`, `integration/` and `contracts/`). **It should move into the integration service's own private repository once the owner approves creating one**, so neither the website session nor this session owns it by accident.

## 1. The rule everything follows

**One sale = one internal order = one invoice = one ledger identity, whatever the channel.**
- Shopify, Amazon, wholesale and manual orders all land in the same `orders` table.
- Each is identified by `(channel, external_order_id)`, with a unique key, so a duplicate can't be created.
- Shopify's receipt is not an invoice. The only invoice is the internal one, made by Agent #1, exactly once per order (a unique key on `invoices.order_id`).

## 2. Responsibilities

| Shopify owns | The integration service owns | The internal platform (Supabase + dashboard) owns |
|---|---|---|
| Storefront, cart, checkout, payment, receipts, customer accounts, Shopify's own order record | Receiving and verifying Shopify webhooks; a durable inbox; turning events into platform commands; retries; reconciliation against Shopify; publishing sellable stock to Shopify (later) | The system of record: orders, invoices, ledger and accounting, physical stock by lot, fulfilment operations, returns, recalls, QC, customer service, agents |

## 3. Components

```
Shopify ──(signed webhook)──▶ [1] Receiver ──▶ [2] Inbox table ──▶ [3] Processor ──▶ [4] Platform functions (Supabase RPC)
   ▲                                                   │                                    │
   │                                         [5] Reconciler (every 15–60 min)               ▼
   └────────────── [6] Stock publisher (BLOCKED until R1–R4) ◀──── sellable stock view ─────┘
```

1. **Receiver.** Verifies Shopify's HMAC signature with the shared secret (stored only in the service's environment), stores the raw event and answers 200 quickly. Unsigned or wrongly signed requests are rejected and never stored.
2. **Inbox** (`integration_inbox`):
   - `event_id` (Shopify webhook id) is the **unique key**, so a duplicate delivery is counted, not stored twice
   - also `topic`, `received_at`, `payload_hash`, `state` (`RECEIVED`, `PROCESSING`, `PROCESSED`, `RETRY_WAIT`, `DEAD_LETTER`, `RECONCILIATION_REQUIRED`), `attempts`, `next_retry_at`, `last_error`
3. **Processor:**
   - claims events with a lease (`FOR UPDATE SKIP LOCKED`)
   - maps each event to **one** platform function call with an idempotency key, e.g. `shopify:order:<id>:paid`
   - backs off 1, 5, 15, 60 minutes, then 6 hours
   - a dependency missing for more than 2 hours → `RECONCILIATION_REQUIRED`
   - otherwise failing for more than 24 hours → `DEAD_LETTER` (visible, never deleted)
4. **Platform functions:** the same all-or-nothing pattern as the R1–R5 drafts (lock, status check, one transaction). For example:
   - `record_channel_order(channel, external_id, payload)`: creates the order and lines once (Agent #1 then makes the invoice)
   - `record_channel_refund(...)`, `record_channel_fulfillment(...)`, `record_channel_cancellation(...)`
5. **Reconciler:**
   - lists recent Shopify orders, refunds and fulfilments through the Admin API (read-only scope), compares them with the platform, and opens **exceptions** for people
   - never silently "repairs" money or stock
   - a missing paid order is replayed through the same inbox path only after a person approves (D-32)
6. **Stock publisher** (later): pushes *sellable* quantity (available minus a buffer, D-37) to Shopify with compare-and-set, so it never overwrites a newer value. **Blocked until R1–R4 are live** (§6).

## 4. Security boundary

- **The website never touches the internal database.** Only the service does, from its server.
- **Least privilege:** the service connects as a dedicated database role, not `service_role`. That role may only:
  - execute the specific platform functions
  - insert and update the inbox
  - read the sellable-stock view
  It has no direct table writes.
- **Secrets** (Shopify webhook secret, Admin API token with read-only scopes plus the inventory-write scope only when the publisher is enabled, the database role password) live in the host's secret store. Never in a repository, the dashboard or the website.
- Every inbox state change is logged. Dead letters and exceptions show on a dashboard "Integration health" page: counts by state, the oldest stuck event, duplicates prevented and open exceptions. Money and stock mismatches are labelled **HUMAN REVIEW REQUIRED**.

## 5. Failure handling (what each failure becomes)

| Failure | Result |
|---|---|
| Duplicate or retried webhook | Same `event_id` → counted as a duplicate; same idempotency key → the platform returns the earlier result |
| Payment confirmed twice (two webhook ids) | Same idempotency key `…:paid` → one order, one invoice, revenue counted once |
| Events out of order (fulfilment before order) | `RETRY_WAIT` until the order exists. Over 2 hours → reconciliation |
| Platform down or deploy in progress | Retries with back-off; nothing lost (the inbox is durable) |
| Crash mid-processing | Lease expires; another worker re-runs it; the platform's idempotency prevents a second effect |
| Webhook never arrives | The reconciler finds the paid order and opens an exception; replay needs a person's approval |
| Shopify and platform totals differ | Exception, HUMAN REVIEW REQUIRED; no automatic change |

All of these were exercised in the website workspace's simulator (synthetic, 300-seed soak). That is a design proof, not production evidence.

## 6. What stays blocked until R1–R4 are live

- **Publishing stock to Shopify:** the numbers it would publish can be wrong today (lost updates, double receive).
- **Order-driven stock moves** (reserve on paid, ship on fulfilled, restock on refund) must call the R-function helper, never raw table writes.
- **Turning on Shopify order sync** (R9).

Receiving orders *without* touching stock (orders, invoices, accounting) could technically come first. **Recommendation:** still wait, so the first real order exercises the complete, safe path once.

## 7. Hosting options (owner decision D-3)

| Option | Pros | Cons |
|---|---|---|
| **Supabase Edge Functions + pg_cron** (recommended to start) | Same project, no new vendor; secrets in Supabase's vault; the inbox sits next to the data | Edge runtime limits; logs live inside Supabase |
| A small server (e.g. Fly.io or Render) | Full control, long-running workers | A new vendor and bill; more to secure and monitor |

## 8. Build order (each step owner-approved; no stock or money in production before R1–R4)

1. Create a private repository `health-endeavors-integration` (owner approval). Move the simulator, contracts and tests there.
2. SQL draft: the inbox table, the dedicated role, unique keys on `orders(channel, external_order_id)` and `invoices(order_id)`. Owner runs it.
3. Receiver and processor for `order.paid` only, in a **Shopify development store**, against a staging copy if available.
4. Reconciler (read-only scope) and the dashboard "Integration health" page.
5. Refunds, fulfilments and returns.
6. After R1–R4 are live: the stock publisher behind a feature flag, starting in dry-run mode (log what it would publish).
