# Database review items: start here (guided, one at a time)

Status: CURRENT · written Nov 23, 2026 · for Stas. Claude never runs anything in production: you
run each item yourself, after approving it, with Claude guiding you step by step in the chat.

## The order I recommend

| Step | Item | What it does, in one line | Risk | When |
|---|---|---|---|---|
| 1 | [Item 3](ITEM_3_QUERY_I_REPORT_DAY_CUTOFF.md) · Query I | **Only reads.** Checks that the nightly report counts the day in Central time, as you decided. | none: changes nothing | first: the easiest way to learn the steps (10 minutes) |
| 2 | [Item 2](ITEM_2_DRAFT_34_STOCK_COUNT_APPROVAL.md) · draft 34 | Stock-count corrections need your approval, enforced by the database. | low (adds new pieces, removes nothing; has an undo file) | any time |
| 3 | [Item 7](ITEM_7_DRAFT_44_STAFF_SEE_PURCHASE_ORDERS.md) · draft 44 | Staff can see purchase orders (your decision of Nov 22). | low | before the first lab delivery |
| 4 | [Item 5](ITEM_5_DRAFT_40_PARTIAL_RECEIVING.md) · draft 40 | Receive part of a delivery; returns checked before restocking. | low | before the first lab delivery (with step 3) |
| 5 | [Item 4](ITEM_4_DRAFT_36_SUPPLIER_DOCUMENTS.md) · drafts 36 + 38 | Supplier documents (certificates, invoices) stored privately. | low | when you start collecting supplier paperwork |
| 6 | [Item 1](ITEM_1_DRAFT_32_INVOICE_STORAGE.md) · draft 32 | Invoices stored, numbered HE-2026-0001…, payments recorded. | low | **after** the tax rate and the Illinois registration are confirmed |
| 7 | [Item 6](ITEM_6_SHOPIFY_FEED_AND_MONEY_MATCHING.md) · Shopify feed | Daily check that Shopify payouts match orders and the bank. | low | **after** the payments decision and the store has products |
| 8 | [Item 8](ITEM_8_DRAFT_46_TAX_RATES.md) · draft 46 (PR #42) | Your confirmed sales tax rates, with a re-check after every January 1 / July 1. | low | after the tax answers, **before** step 6 (invoices) |

Each item is separate: you can stop after any step, and "not yet" is always a fine answer.

## How every step works (the same each time)

1. Tell Claude in the chat: **"ready for step N"**. Claude checks that the file has not changed since
   it was reviewed (the fingerprint in the item's page) and tells you exactly what to expect.
2. Open **supabase.com** → sign in → open the **Health Endeavors** project.
3. In the left menu, click **SQL Editor**, then **New query** (top left). You get an empty box.
4. Get the SQL:
   - **Short ones (step 1):** Claude pastes it in the chat as a code block. Tap the copy button on
     the block.
   - **Long ones (steps 2–7):** open the file link Claude gives you on GitHub, click the
     **Copy raw file** button (two overlapping squares, top right of the file), and that's it.
     Claude also tells you the first and last line, so you can see the whole file was copied.
5. Click in the empty box and paste (**Cmd+V**).
6. Click **Run** (bottom right), or press **Cmd+Enter**.
   - Supabase sometimes shows a warning such as *"Potential issue detected"* for files that create
     things. Claude tells you beforehand if it will appear for that step. If a warning appears that
     Claude did not mention, click **Cancel** and send a screenshot.
7. Take a **screenshot of the result** at the bottom and send it to Claude.
8. Claude reads it and, for steps 2–7, gives you a short **check** query (read-only) to paste and run
   the same way. Its expected answer is written in the item's page.
9. If anything looks different from what Claude said: **stop**, don't run anything else, send a
   screenshot. Every item (except step 1, which changes nothing) has an **undo** file.

Never paste passwords, keys or customer details into the chat. Screenshots of results are fine:
blur anything that shows a customer's name or address.

## Step 1 in detail: Item 3 (read-only, about 10 minutes)

- **File:** `docs/ops/sql/12_READONLY_I_report_day_cutoff.sql`, 66 lines, fingerprint
  `510aac569f16c15a` (checked Nov 23).
- **What it reads:** the saved nightly reports and the order times of the last 45 days. It writes
  nothing.
- **What you'll see:** one row per saved report day and a last row `I00` with the conclusion:
  - `PASS`: the report already follows the Central-time day. Nothing to change. Done.
  - `ACTION`: it follows UTC time instead. Send the screenshot; fixing the nightly job is a separate
    approval.
  - `NOT ENOUGH DATA` / `NO DATA`: normal while there are few orders; we run it again later.
- **No warning** is expected from Supabase for this one (it only reads).

## Steps 2–8 in detail (each one the same routine as above)

Before every step Claude re-checks the fingerprint below against the file in the repository and tells
you if anything changed. **Every install file below shows Supabase's warning about a "destructive
operation"**: they contain lines like `drop policy if exists …` that only remove the file's own
earlier pieces, which is what makes each file safe to run twice. When the warning lists only `drop …
if exists`, `revoke` or `alter table … enable row level security`, confirm with the button that runs
the query anyway. If it mentions anything else (for example `drop table` on a table you know, or
`delete from`), click **Cancel** and send a screenshot. Every file starts with a comment line
`-- DRAFT (…)` and ends with the line `commit;`: after pasting, scroll to the bottom and check that
`commit;` is there (otherwise only part of the file was copied).

| Step | File to paste (all in `docs/ops/sql/drafts/`) | Lines | Fingerprint | Check afterwards (read-only, in the item's page) | Expected | Undo file |
|---|---|---|---|---|---|---|
| 2 | `34_DRAFT_stock_count_adjustments.sql` | 432 | `d055eba3ba163b33` | Item 2, "After running" | `true \| 0 \| 0 \| false` | `35_…` |
| 3 | `44_DRAFT_staff_read_purchase_orders.sql` | 55 | `c87c37c54901a648` | Item 7, "After running" | two rows, both `SELECT` | `45_…` |
| 4 | `40_DRAFT_partial_receiving_returns.sql` | 999 | `80d3cb0848c7bd0c` | Item 5, "After running" | `true \| true \| 0 \| 0 \| false` | `41_…` |
| 5a | `36_DRAFT_supplier_documents.sql` | 1009 | `9d3d6ca4e6bcf5dd` | Item 4, "After draft 36" | `9 \| 0 \| 0 \| false` | `37_…` |
| 5b | `38_DRAFT_supplier_document_files.sql` (only after 5a) | 88 | `4e463799712f61c8` | Item 4, "After draft 38" | `false \| 10485760 \| {application/pdf,image/jpeg,image/png} \| 2` | `39_…` |
| 6 | `32_DRAFT_invoices.sql` | 950 | `7569c1ca765cc175` | Item 1, "After running" | `true \| true \| true \| 0 \| 1 \| false` | `33_…` |
| 7 | `42_DRAFT_shopify_payouts_money_issues.sql` (the daily Shopify program is a separate step after it) | 242 | `dfbcaa89a6112c17` | Item 6, "After running file 42" | `true \| true \| 0 \| false` | `43_…` |
| 8 | `46_DRAFT_tax_rates.sql` (after PR #42 is merged) | 236 | `536e2c569fdfd262` | Item 8, "After running" | `true \| 0 \| 1 \| false` | `47_…` |

Fingerprints checked against the files on Nov 23, 2026 (all match the item pages). Each step takes
about 10–20 minutes with Claude; do one per sitting if you prefer. After each step: nothing visible
changes on the dashboard until its switch is turned on, which Claude guides separately.

**If a step fails** (a red error at the bottom instead of "Success"): nothing was changed, because
each file runs as one transaction (`begin;` … `commit;`) and stops before changing anything if
something is missing. Send a screenshot of the error; don't run it again first.

