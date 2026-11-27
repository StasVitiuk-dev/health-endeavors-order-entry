# Two-week launch plan (Nov 27 → about Dec 11, 2026)

Status: **PROPOSED** · written Nov 27, 2026 (night) after the owner asked "is there any way we can finish in 2
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
| 4 | Store settings in Shopify: payments, shipping rates, policies | **Stas**, Claude writes the texts | Day 8 | Checkout |
| 5 | Legal pages: privacy, terms, refund/return, shipping | Claude drafts, **Stas approves** | Day 8 | Required by Shopify and payment providers |
| 6 | Rollback practice (one time, 15 minutes) | **Stas**, Claude guides | Day 10 | Safety on launch day |
| 7 | Test orders end to end (fake card, then one real small order refunded) | both | Days 11–12 | Proof everything is connected |

## Day by day

| Day | Claude (no waiting needed) | Stas (time) |
|---|---|---|
| **1 · Fri Nov 27** | Shared settings for every device (PR); this plan; audit every launch-critical database step against your real database's shape (as tonight's history-recorder check), fix any mismatch | Merge the PRs I mark ready (5 min) |
| **2 · Sat Nov 28** | Guides for steps R1–R5 (stock) in tonight's format: exact SQL, what it does in 3 lines, the read-only check | Database evening 1: Query I (reads only) + steps 2–3 (30 min) |
| **3 · Sun Nov 29** | Product import ready for your list (template + checker already built) | **Send the product list** (the earlier the better); database evening 2: stock functions R1 + R4 (30 min) |
| **4 · Mon Nov 30** | Import your products into a checked file for Shopify; flag anything missing | Database evening 3: R2, R3, R5 + request keys (30 min) |
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

From `START_HERE_GUIDED_RUNS.md`. Done already: 0, 18, 19, A, A2.

1. Query I (reads only: the day counted in Central time)
2. Stock functions **R1–R5** (drafts 10, 21, then 17; one at a time, each with its switch) — stock never doubles or goes wrong
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

## Risks and how this plan handles them

- **The product list comes late** → the whole plan moves by the same number of days. Everything else
  is prepared so the list is the only wait.
- **A database step surprises us** (as on Nov 27) → each step stops safely by itself; Claude fixes the
  draft the same night; plan for one such day.
- **Shopify review of the store or payments** can take 1–3 days → payments are set up on Day 8, well
  before launch.
- **Tiredness** → evenings are 30–45 minutes; Day 9 is a rest/catch-up day.
