# Database review items: start here (guided, one at a time)

Status: CURRENT · written Nov 23, 2026 · for Stas. Claude never runs anything in production: you
run each item yourself, after approving it, with Claude guiding you step by step in the chat.

Each launch step's "After running" check is tested (Nov 28): on a throwaway copy, its draft is installed
and the check, exactly as written in its guide, gives the guide's Expected answer (items 1, 2, 5, 6, 7, 8,
20, 21, 23, 24, including draft 10's fingerprint; `local-test/guide_after_checks_test.js`). If your answer differs, stop and send a screenshot.

## The order I recommend

| Step | Item | What it does, in one line | Risk | When |
|---|---|---|---|---|
| 1 | [Item 3](ITEM_3_QUERY_I_REPORT_DAY_CUTOFF.md) · Query I | **Only reads.** Checks that the nightly report counts the day in Central time, as you decided. | none: changes nothing | first: the easiest way to learn the steps (10 minutes) |
| 2 | [Item 2](ITEM_2_DRAFT_34_STOCK_COUNT_APPROVAL.md) · draft 34 | Stock-count corrections need your or an administrator's approval (Nov 24), enforced by the database. | low (adds new pieces, removes nothing; has an undo file) | any time |
| 3 | [Item 7](ITEM_7_DRAFT_44_STAFF_SEE_PURCHASE_ORDERS.md) · draft 44 | Staff can see purchase orders (your decision of Nov 22). | low | before the first lab delivery |
| 4 | [Item 5](ITEM_5_DRAFT_40_PARTIAL_RECEIVING.md) · draft 40 | Receive part of a delivery; returns checked before restocking. | low | before the first lab delivery (with step 3) |
| 5 | [Item 4](ITEM_4_DRAFT_36_SUPPLIER_DOCUMENTS.md) · drafts 36 + 38 | Supplier documents (certificates, invoices) stored privately. | low | when you start collecting supplier paperwork |
| 6 | [Item 1](ITEM_1_DRAFT_32_INVOICE_STORAGE.md) · draft 32 | Invoices stored, numbered HE-2026-0001…, payments recorded. | low | **after** the tax rate and the Illinois registration are confirmed |
| 7 | [Item 6](ITEM_6_SHOPIFY_FEED_AND_MONEY_MATCHING.md) · Shopify feed | Daily check that Shopify payouts match orders and the bank. | low | **after** the payments decision and the store has products |
| 8 | [Item 8](ITEM_8_DRAFT_46_TAX_RATES.md) · draft 46 (PR #42) | Your confirmed sales tax rates, with a re-check after every January 1 / July 1. | low | after the tax answers, **before** step 6 (invoices) |

Each item is separate: you can stop after any step, and "not yet" is always a fine answer.

## The complete index of every pending database step (CURRENT, Nov 25)

Steps 1–8 above were written on Nov 23. Since then, items 9–17 were added. This is the **one
list of everything still to install**, in the recommended order, with the true dependencies
(checked against the files themselves; a test, `review-fingerprints-ext25`, fails if any
fingerprint on these pages goes out of date). For every row: **Prepared** = written and tested
on a throwaway copy; **Reviewed / Approved / Installed / Verified** are yours, one at a time.
Today every row is **Prepared** only, except steps 18 and 19: **installed and verified by you on Nov 26,
2026** (evening, Central: each gave one `pg_advisory_xact_lock` row; the read-only checks showed all three
search paths ending in `pg_temp`, and `true | 1 | SELECT | 0` for the backup reports table), and step 0:
**installed and verified by you on Nov 27, 2026** (about 2:15 AM Central, after #137 merged: one
`pg_advisory_xact_lock` row; the read-only check showed `active_role | false | false` and
`is_active_staff | false | false`), and step A: **installed and verified by you on Nov 27, 2026** (about
2:45 AM Central: one `pg_advisory_xact_lock` row; the read-only check showed `true | 0 | 1 | false`). Step A's
first save was refused by your history recorder (`record "new" has no field "id"`, nothing changed), so
step **A2** followed: **installed and verified by you on Nov 27, 2026** (about 4:07 AM Central, after #139:
one `pg_advisory_xact_lock` row; the read-only check showed `uuid | 0 | 1`); then the first shared save from
the dashboard worked (one row `feature_switches | staff`, 2 rows in the history log). Nothing else is
reviewed, approved, installed or verified.

| Order | What it enables | Needs first | File (`docs/ops/sql/drafts/`) | Lines | Fingerprint | Undo file | Before (read-only) | After (read-only check) |
|---|---|---|---|---|---|---|---|---|
| 0 | **First, before A and the steps that use it:** the "active staff member" and "role of a switched-on account" checks production does not have (found Nov 27 when step A stopped safely). **Done Nov 27: installed and verified** | nothing | `72_DRAFT_active_staff_helper.sql` | 108 | `da6f7ed3ca5eacc8` | `73_…` | — | Item 18 |
| A | Settings and switches the same on every phone and computer (your standing rule); the owner or an administrator saves them. **Done Nov 27: installed and verified; saving works since A2** | **0** | `50_DRAFT_shared_settings.sql` | 193 | `0d17fc4e94fbd847` | `51_…` | — | Item 10, "After running" |
| A2 | **Right after A:** the `id` your history recorder writes for every change (without it every save of a shared setting is refused: found Nov 27). **Done Nov 27: installed and verified; shared saves work** | **A** | `74_DRAFT_shared_settings_audit_id.sql` | 57 | `27550a1b2cda75ef` | `75_…` | — | Item 19, "After running" |
| 1–8 | as in the table above | as above | (see above) | | | | | |
| 9 | Parcels and tracking per order, delivery problems watch | nothing | `48_DRAFT_order_parcels.sql` | 392 | `ca25da9142afa5b0` | `49_…` | — | Item 9, "After running" |
| 10 | Packaging and shipping cost per order (real profit) | nothing | `52_DRAFT_order_costs.sql` | 191 | `10f53b1d7b57a6e1` | `53_…` | — | Item 11, "After running" |
| 11 | Batch (lot) on each order line, for recalls | nothing | `54_DRAFT_order_batches.sql` | 299 | `a19bbc8a6e156aee` | `55_…` | Item 12, "Open question" | Item 12, "After running" |
| 12 | Saved email campaigns approved by you or an administrator (**still sends nothing**; real sending is a separate decision) | nothing | `56_DRAFT_email_sending.sql` | 567 | `fd78ceae4e4f04ed` | `57_…` | — | Item 13, "After running" |
| 13 | "My settings" kept per person on every device | nothing | `58_DRAFT_my_settings.sql` | 176 | `35ce08fdd4e4caea` | `59_…` | — | Item 14, "After running" |
| 14 | Customer reviews stored | nothing | `60_DRAFT_customer_reviews.sql` | 262 | `096167f3c7cf7581` | `61_…` | — | Item 15, "After running" |
| 15a | The word "manager" | nothing | `62_DRAFT_manager_role.sql` | 48 | `c78870424a9e247f` | `63_…` | Item 16, "Before you run it" | Item 16 |
| 15b | Four levels; each looks after the levels below (owner accounts untouchable) | **15a** | `64_DRAFT_people_levels.sql` | 389 | `275cdc3123fd520e` | `65_…` | (same look) | Item 16 |
| 16 | The sign-in helper for the New Employee page (a deploy at Supabase, not SQL) | **15b** | `docs/ops/edge-drafts/people-accounts/` (2 files) | | Item 17 table | delete the function | Item 17, "Before you deploy" | one made-up employee, Item 17 |
| 17 | Managers decide deliveries and returns someone else recorded (your choice A, Nov 25) | **4** and **15a** (best after 15b) | `66_DRAFT_managers_approve_stock.sql` | 119 | `d00d38b72d87af87` | `67_…` | — | Item 5, "Prepared for A" |
| 18 | Small hardening of three existing history and sign-in functions (pg_temp named last; nothing else changes) | nothing | `68_DRAFT_history_functions_search_path.sql` | 52 | `5a842bd5b4bb92c4` | `69_…` | — | `docs/ops/OWNER_PROTECTION_AND_PRIVATE_HISTORY.md`, "Second look" |
| 19 | Backup status on Home: a small table the backup job writes after each run, read by you and administrators (then one step in the backups repository) | nothing | `70_DRAFT_backup_reports.sql` | 73 | `fef6f3402edfcbf6` | `71_…` | — | `docs/ops/RECOVERY_AND_BACKUP_READINESS.md` §3a |
| 20 | Stock per order (Nov 28): an order takes its bottles off the stock count once, all or nothing, and gives them back once if cancelled (launch promise 2; the Orders button waits for it) | nothing | `76_DRAFT_order_stock_moves.sql` | 308 | `ec4bbe2de2f13853` | `77_…` | [Item 23](ITEM_23_STOCK_PER_ORDER.md), "Before running" | [Item 23](ITEM_23_STOCK_PER_ORDER.md), "After running" |
| 21 | Shopify orders saved once (Nov 28; **only if you choose R9 path B**, a new read-only order program instead of today's import) | nothing (item 23 first is better) | `78_DRAFT_shopify_orders.sql` | 210 | `3738c0142c925194` | `79_…` | — | [Item 24](ITEM_24_SHOPIFY_ORDERS_PATH_B.md) |
| — | Your private history hidden from administrators | — | **not needed**: already true in production (your second read-only look, Nov 25) | | | | | |

Real dependencies (all others are independent): 38 needs 36 · 64 needs 62 · 66 needs 40 and 62 · the helper needs 64 ·
the daily Shopify program needs 42. The older reliability drafts (10–29: stock functions, request
keys, integrity checks, report totals) are **not in this plan**; installing them is a separate
decision, recorded in `docs/PROJECT_RECORD.md`. **Nov 27:** the two-week launch plan (PROPOSED) needs the
stock steps R1–R5 (drafts 10, 21, then 17): [Item 20](ITEM_20_STOCK_STEPS_R1_R5.md) puts that decision and
the steps on one page (OWNER DECISION REQUIRED); [Item 21](ITEM_21_REQUEST_KEYS.md) does the same for the
request keys (drafts 19 and 27), and [Item 22](ITEM_22_NIGHTLY_CHECK.md) for the nightly "everything adds up"
check (drafts 23, 25, 29).

**Each sitting, in short:** tell Claude "ready for step N" → Claude re-checks the fingerprint →
open Supabase → SQL Editor → New query → paste the file → check the last line is `commit;` → Run →
screenshot → paste Claude's read-only check → screenshot. **Stop** if anything differs, and send a
screenshot. **If a draft changes after you reviewed it,** Claude tells you what changed and the new
fingerprint, and you review that new version first.

**Newly created records and undo:** undo files differ. Some refuse while records exist (for
example 39 refuses while supplier files are stored); others remove the feature's own tables
**with the records saved in them**. Each item page says which. Undo right after a failed check
loses nothing; an undo after people have used the feature can, so Claude tells you exactly what
it would remove before you run one.

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

## Steps 18 and 19 in detail (each on its own; neither needs another step first)

Same routine as above. Both are small and can be run in any order, on any day.

**Step 18: the history functions' safety setting** (`68_DRAFT_history_functions_search_path.sql`).
- **What it changes:** only one setting on three existing functions (Employee Activity, its people
  list, "my sign-ins"): `pg_temp` is named last in where they look for tables. Their text, who may run
  them and what they show stay the same.
- **Supabase warning:** none expected (the file only has `alter function … set search_path`). If a
  warning appears, click **Cancel** and send a screenshot.
- **Check afterwards (read-only):**

  ```sql
  select p.proname as function, array_to_string(p.proconfig, '; ') as setting
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('employee_activity', 'employee_activity_people', 'list_my_sessions')
  order by 1;
  ```

  **Expected:** three rows, each setting ending in `pg_temp`:
  `employee_activity | search_path=public, pg_temp` ·
  `employee_activity_people | search_path=public, pg_temp` ·
  `list_my_sessions | search_path=auth, public, pg_temp`.
- **Undo:** `69_…` (puts the three settings back exactly as your look of Nov 25 showed them).
- **Done (owner, Nov 26, evening, Central):** installed; the check showed the three expected rows.

**Step 19: backup status on Home** (`70_DRAFT_backup_reports.sql`).
- **What it adds:** one empty table the backup jobs will write to (which job, when, worked or not,
  size). You and administrators can read it; nobody signed in can change it.
- **Supabase warning:** the "destructive operation" one is expected, listing only
  `drop policy if exists backup_reports_owner_admin_read` and `revoke`. Confirm. Anything else:
  **Cancel** and send a screenshot.
- **Check afterwards (read-only):**

  ```sql
  select (select relrowsecurity from pg_class where oid = 'public.backup_reports'::regclass) as reading_rules_on,
         (select count(*) from pg_policies where schemaname = 'public' and tablename = 'backup_reports') as rules,
         (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
           where table_schema = 'public' and table_name = 'backup_reports' and grantee = 'authenticated') as signed_in_may,
         (select count(*) from public.backup_reports) as lines;
  ```

  **Expected:** one row, `true | 1 | SELECT | 0` (checked on the practice copy, Nov 26).
- **Then (not SQL):** the one step in the backups repository (`docs/ops/RECOVERY_AND_BACKUP_READINESS.md`
  §3a), and after the next nightly run, Feature Flags → **Backup status on Home** → On. Home should
  then say "Backups: last night's backup succeeded".
- **Undo:** remove the repository step first, then `71_…`.
- **Done (owner, Nov 26, evening, Central):** installed; the check showed `true | 1 | SELECT | 0`. Still to
  do: the repository step, then the switch.

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
| 2 | `34_DRAFT_stock_count_adjustments.sql` | 456 | `c94c2174afba71d0` | Item 2, "After running" | `true \| 0 \| 0 \| false` | `35_…` |
| 3 | `44_DRAFT_staff_read_purchase_orders.sql` | 55 | `c87c37c54901a648` | Item 7, "After running" | two rows, both `SELECT` | `45_…` |
| 4 | `40_DRAFT_partial_receiving_returns.sql` | 1041 | `670cbb65ca91f4b7` | Item 5, "After running" | `true \| true \| 0 \| 0 \| false` | `41_…` |
| 5a | `36_DRAFT_supplier_documents.sql` | 1034 | `54e3c73d8186273c` | Item 4, "After draft 36" | `9 \| 0 \| 0 \| false` | `37_…` |
| 5b | `38_DRAFT_supplier_document_files.sql` (only after 5a) | 97 | `4f260ac2f075a5df` | Item 4, "After draft 38" | `false \| 10485760 \| {application/pdf,image/jpeg,image/png} \| 2` | `39_…` |
| 6 | `32_DRAFT_invoices.sql` | 951 | `0de2357179e1c90d` | Item 1, "After running" | `true \| true \| true \| 0 \| 1 \| false` | `33_…` |
| 7 | `42_DRAFT_shopify_payouts_money_issues.sql` (the daily Shopify program is a separate step after it) | 242 | `dfbcaa89a6112c17` | Item 6, "After running file 42" | `true \| true \| 0 \| false` | `43_…` |
| 8 | `46_DRAFT_tax_rates.sql` (after PR #42 is merged) | 239 | `186cffd0d6dcfdbc` | Item 8, "After running" | `true \| 0 \| 1 \| false` | `47_…` |

Fingerprints checked against the files on Nov 23, 2026 (all match the item pages). Each step takes
about 10–20 minutes with Claude; do one per sitting if you prefer. After each step: nothing visible
changes on the dashboard until its switch is turned on, which Claude guides separately.

**If a step fails** (a red error at the bottom instead of "Success"): nothing was changed, because
each file runs as one transaction (`begin;` … `commit;`) and stops before changing anything if
something is missing. Send a screenshot of the error; don't run it again first.

