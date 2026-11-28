# Two-week launch plan (Nov 27 → about Dec 11, 2026)

Status: **PROPOSED, a target that depends on your inputs (not a promise)** · written Nov 27, 2026 (night) after the owner asked "is there any way we can finish in 2
weeks?" · owner decision required: launch a **smaller first version** with a simple Shopify theme, the
custom website and the extras following after launch.

This page is the plan only. What is done lives in `docs/PROJECT_RECORD.md`, progress in
`docs/health-endeavors-progress.md`, the database steps in `docs/ops/sql-review/START_HERE_GUIDED_RUNS.md`.

## What "launched" means in this plan

1. Customers can buy your products in the Shopify store (simple theme, your real products, prices, photos).
2. Every order lands on the dashboard; stock goes down correctly, never twice; returns and recalls are
   correct; a packing slip prints; the day's recap prints.
3. Money is checked: sales tax confirmed, invoices numbered (wholesale), Shopify payouts match.
4. You can undo a bad change (rollback practised once), and backups are green.

**After launch (weeks 3–5), not in this plan:** the custom website design, the New Employee page and
manager accounts, email campaigns, customer reviews store, extra agents, phone extras.

## The critical path (what decides the date)

| # | Item | Who | Needed by | Why it blocks |
|---|---|---|---|---|
| 1 | **Product list from the lab**: name, size, flavour, exact code (SKU), price, cost, photos | **Stas** | **Day 3 (Mon Nov 30)** | No products, no store, no stock counts (R8) |
| 2 | Launch-critical database steps (below), 2–4 per evening | Stas runs, Claude prepares | Days 2–7 | Stock must be right from the first order (R1–R5) |
| 3 | Sales tax: your Illinois registration and the rate(s) you charge | **Stas** (or accountant) | Day 5 | Invoices and tax records (steps 6 and 8) |
| 4 | Store settings in Shopify: payments, shipping rates, policies (**click-by-click steps written Nov 28: `SHOPIFY_STORE_SETUP_GUIDE.md`**) | **Stas**, Claude writes the texts | Day 8 | Checkout |
| 5 | Legal pages: privacy, terms, refund/return, shipping (**drafted Nov 28** with 9 choices and 3 lawyer questions; sent to the owner as a file, kept out of this repository until the owner decides where store texts live) | Claude drafts, **Stas approves** | Day 8 | Required by Shopify and payment providers |
| 6 | Rollback practice (one time, 15 minutes) | **Stas**, Claude guides | Day 10 | Safety on launch day |
| 7 | Test orders end to end (fake card, then one real small order refunded) | both | Days 11–12 | Proof everything is connected |

## Day by day

| Day | Claude (no waiting needed) | Stas (time) |
|---|---|---|
| **1 · Fri Nov 27** | Shared settings for every device (PR); this plan; audit every launch-critical database step against your real database's shape (as tonight's history-recorder check), fix any mismatch | Merge the PRs I mark ready (5 min) |
| **2 · Sat Nov 28** | Guides for steps R1–R5 (stock) in tonight's format: exact SQL, what it does in 3 lines, the read-only check (**done Nov 27**: item 20) | Database evening 1: Query I (reads only) + steps 2–3 (30 min) |
| **3 · Sun Nov 29** | Product import ready for your list (template + checker already built) | **Send the product list** (the earlier the better); database evening 2: stock functions R1 + R4 (30 min) |
| **4 · Mon Nov 30** | Import your products into a checked file for Shopify; flag anything missing (**the Shopify file button is built, Nov 28**) | Database evening 3: R2, R3, R5 + request keys (30 min) |
| **5 · Tue Dec 1** | Tax rate screen ready; invoice numbering ready | Tax answers (registration, rate); database evening 4: tax rates + invoices (30 min) |
| **6 · Wed Dec 2** | Simple-theme setup written as click-by-click steps (your logo, colours, products). Shopify stays off-limits to me unless you approve that specific task | Set up the theme with the steps, or approve me doing it in Shopify (20–40 min) |
| **7 · Thu Dec 3** | Legal page drafts; shipping and returns texts | Read and approve the texts (30 min) |
| **8 · Fri Dec 4** | Shopify feed + money matching ready for real payouts | Shopify: payments, shipping, policies pasted in (45 min, I guide step by step) |
| **9 · Sat Dec 5** | Full test run on everything; fix what it finds | Rest day, or catch up on anything above |
| **10 · Sun Dec 6** | Rollback practice guide (exists: `LAUNCH_DAY_ROLLBACK_PRACTICE.md`) | Rollback practice (15 min); daily print timer switched on |
| **11 · Mon Dec 7** | Test-order checklist | Fake-card order end to end; check stock, slip, recap (30 min) |
| **12 · Tue Dec 8** | Fix anything the test order shows | One real small order, then refund it (20 min) |
| **13 · Wed Dec 9** | Launch-day checklist; watch everything | **Go/no-go** decision |
| **14 · Thu Dec 10** | Watch orders, stock and money all day; fix fast | **Launch**: publish the store |

## Launch-critical database steps (in order)

From `START_HERE_GUIDED_RUNS.md` and, for the stock steps, `sql-review/ITEM_20_STOCK_STEPS_R1_R5.md` (written Nov 27;
the index had listed drafts 10–29 as a separate decision). Done already: 0, 18, 19, A, A2.

1. Query I (reads only: the day counted in Central time)
2. Stock functions **R1–R5** (drafts 10, 21, then 17; one at a time, each with its switch) — stock never doubles or goes wrong
   - **Added Nov 28: stock per order (draft 76)**, so a sale takes its bottles off the count exactly once and a cancellation gives them back once (launch promise 2). Needs your answer on **when** an order takes its stock (paid or shipped) before anything calls it
3. Request keys (drafts 19, 27) — no double order or double save after a dropped connection
4. Step 2 (stock-count approval, draft 34), step 3 (staff see purchase orders, 44), step 4 (partial receiving, 40)
5. Step 8 (tax rates, 46) then step 6 (invoices, 32)
6. Step 7 (Shopify payouts and money differences, 42), then the daily Shopify program
7. Integrity checks and report totals (drafts 23, 25, 29, 13) — the nightly "everything adds up" check

Not needed for launch: 9–17 (parcels, costs, batches, email, my settings, reviews, managers, people page).

**Checked Nov 27 (night):** every one of these steps, and every other waiting step, installs in this
order on a throwaway copy shaped like your real database (`local-test/production_shape_install_test.sh`:
33 of 33), after the five already installed. One thing is still unverified in your real database: the
columns of the switches table `feature_flags` that steps 21, 27 and 29 add their switches to. They check it
themselves and stop safely if it differs, but this read-only look settles it first (it only reads):

```sql
select (select string_agg(column_name || ' ' || data_type || coalesce(' default ' || column_default, ''), ', ' order by ordinal_position)
          from information_schema.columns where table_schema = 'public' and table_name = 'feature_flags') as columns,
       (select string_agg(tgname || ' -> ' || tgfoid::regproc::text, ', ')
          from pg_trigger where tgrelid = 'public.feature_flags'::regclass and not tgisinternal) as triggers,
       (select count(*) from public.feature_flags) as switches;
```
Expected: the columns include `id uuid default gen_random_uuid()`, `flag_key text`, `label text`,
`description text`, `enabled boolean`.

## The database steps, exactly (Nov 27 night; each file's own fingerprint, check and undo)

Run in this order, one sitting at a time; each one stops by itself, changing nothing, if what it needs is
missing (its precheck). Fingerprint = first 16 characters of SHA-256 of the file as it is now (a test fails
if a page shows an old one). The pages named give the read-only check to run after.

| # | Step | File (`docs/ops/sql/drafts/`) | Lines | Fingerprint | Stops by itself if | After (read-only) | Undo |
|---|---|---|---|---|---|---|---|
| 0 | Query C (reads only) | `../02_READONLY_C_agents.sql` | — | (guide) | — | `QUERY_C_OWNER_RUN_GUIDE.md` | — |
| 0 | `feature_flags` look (reads only) | in this page, above | — | — | — | — | — |
| 1 | Stock functions R1–R5 | `10_DRAFT_stock_functions.sql` | 618 | `7fd83dde8009f018` | a table, column, helper or index is missing | item 20 (6 rows; md5 `f6d9c2c8…`) | `11_…` |
| 2 | The five stock switches, off | `21_DRAFT_stock_function_switches.sql` | 79 | `c0d789cc056b7f27` | no drafts/10, or `feature_flags` cannot fill its own id | 5 rows, all off | `22_…` |
| 3 | PO line guard (optional) | `17_DRAFT_po_line_delete_guard.sql` | 139 | `3c09d100648ba588` | the purchase-order tables are missing | the guard is there | `18_…` |
| 3b | Stock per order (Nov 28) | `76_DRAFT_order_stock_moves.sql` | 241 | `e6836e56ff32cb68` | orders, order lines, products or stock differ from Query A, or a needed index or helper is missing | [Item 23](sql-review/ITEM_23_STOCK_PER_ORDER.md) | `77_…` |
| 4 | Request keys | `19_DRAFT_request_keys.sql` | 88 | `dd917fab8111e5b1` | the dashboard could not write the new column (a missing table is skipped and named) | item 21 | `20_…` |
| 5 | Request-keys switch, off | `27_DRAFT_request_keys_switch.sql` | 51 | `0447f2ae7d10c478` | no drafts/19, or `feature_flags` | 1 row, off | `28_…` |
| 6 | Stock-count approval | `34_DRAFT_stock_count_adjustments.sql` | 456 | `c94c2174afba71d0` | a helper or the products table is missing | item 2 | `35_…` |
| 7 | Staff see purchase orders | `44_DRAFT_staff_read_purchase_orders.sql` | 55 | `c87c37c54901a648` | the helper or the tables are missing, or row rules are off | item 7 | `45_…` |
| 8 | Partial receiving and returns | `40_DRAFT_partial_receiving_returns.sql` | 1032 | `c9f81f40f95a58c1` | a helper or the purchase-order tables are missing | item 5 | `41_…` |
| 9 | Tax rates | `46_DRAFT_tax_rates.sql` | 239 | `186cffd0d6dcfdbc` | a helper or the tasks / history tables are missing | item 8 | `47_…` |
| 10 | Invoices (after the tax answers) | `32_DRAFT_invoices.sql` | 951 | `0de2357179e1c90d` | a helper or the orders / tasks / history tables are missing | item 1 | `33_…` |
| 11 | Shopify payouts and money differences | `42_DRAFT_shopify_payouts_money_issues.sql` | 242 | `dfbcaa89a6112c17` | a helper is missing | item 6 | `43_…` |
| 12 | Four "impossible number" rules | `23_DRAFT_integrity_constraints.sql` | 60 | `5a2d462e3ede105c` | any existing row already breaks a rule (it says how many) | item 22 | `24_…` |
| 13 | The nightly check | `25_DRAFT_integrity_check_schedule.sql` | 141 | `f0aeec10b5d50d6a` | (says so and schedules nothing if pg_cron is missing) | item 22 | `26_…` |
| 14 | The nightly check on Home, off | `29_DRAFT_integrity_results_on_home.sql` | 101 | `7afb423336e8a20b` | no drafts/25, a helper, or `feature_flags` | item 22 | `30_…` |

Already installed and verified: 0 (`72`), A (`50`), A2 (`74`), 18 (`68`), 19 (`70`).

## Your sittings, grouped (each 15–30 minutes; stop after any of them)

| Sitting | What | Needs first |
|---|---|---|
| S1 | Merge the open pull requests (morning list) | — |
| S2 | Query C and the `feature_flags` look (both only read) | — |
| S3 | Steps 1, 2, 3 (stock), then 3b (stock per order, item 23) | S2 shows no other stock writer |
| S4 | Steps 4, 5 (request keys); turn **Receive** on and receive one real delivery | S3 |
| S5 | Steps 6, 7, 8 (approvals, staff see POs, partial receiving) | — |
| S6 | Step 9, then 10 (tax, invoices) | your tax answers |
| S7 | Step 11 (payouts); the daily Shopify program is a separate step | payments decision |
| S8 | Steps 12, 13, 14 (nightly check) | decision X8-D4 |
| S9 | Rollback practice (15 min); one test order end to end; one real small order, refunded | the store set up |

Devices only you can check: the iPhone (shared settings, a page or two at phone size), the Brother
printer (one day pack with the one-sided preset), VoiceOver on the iPhone (`DEVICE_CHECKLIST_2026-11-16.md`).

## Is two weeks realistic? The honest critical path

Two weeks (launch about Dec 10) holds **only if** all of these happen: the product list arrives by Nov 30;
your tax answers by Dec 1; Query C shows no other stock writer; Shopify accepts payments without delay;
and you can give 30 minutes most evenings. The longest chain is:

**product list (you) → products in Shopify and the dashboard (R8) → stock steps S3–S4 → payments and
shipping set up → test order → real small order → go/no-go.**

Every other item can run beside it. If the product list comes one week late, the launch moves one week:
nothing else can make up for it. If Query C shows another stock writer (an agent or a timer), add about
two days to deal with it first. This is a **target that depends on those inputs, not a promise**.

## Risks and how this plan handles them

- **The product list comes late** → the whole plan moves by the same number of days. Everything else
  is prepared so the list is the only wait.
- **A database step surprises us** (as on Nov 27) → each step stops safely by itself; Claude fixes the
  draft the same night; plan for one such day.
- **Shopify review of the store or payments** can take 1–3 days → payments are set up on Day 8, well
  before launch.
- **Tiredness** → evenings are 30–45 minutes; Day 9 is a rest/catch-up day.
