# Review item 20 — the stock steps (R1–R5): stock is changed all at once, never twice

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · written 2026-11-27
(night, while you slept). Nothing here has been run in production. I never run it myself: you run it,
after approving it.

## Why this page exists

The two-week launch plan (`docs/ops/LAUNCH_PLAN_2_WEEKS.md`, PROPOSED) needs the stock to be right from
the very first order. Until now the stock steps were written down only in the October runbooks, and
`START_HERE_GUIDED_RUNS.md` said they were "not in this plan, a separate decision". This page is that
decision in one place, in the same format as tonight's steps 0, A and A2. The full technical runbook stays
`docs/ops/R1-R5-INSTALL-RUNBOOK.md`; this page does not replace it.

**The decision for you:** do the stock steps belong in the launch? My recommendation: **yes**, the first
four evenings of the plan, in the order below.

## What changes for you, in plain words

Today a stock button (Receive a delivery, Quarantine a recall, Restock a return, Save an adjustment,
Delete a product) sends several separate requests from the browser. If the phone loses its connection
half-way, part of the change is saved and part is not; pressing again can count it twice.

After these steps each of those buttons asks the database to do the whole change **at once**: all of it
or nothing, and pressing twice never counts twice. The buttons look and work the same. Each button
switches over only when **you** turn its own switch on, one at a time, and turning a switch off puts that
button back to today's way at once (no update needed).

## The order (one evening each, 15–30 minutes)

| Evening | What | Changes anything? | Needs first |
|---|---|---|---|
| 1 | **Query C** (only reads): is anything else writing stock (an agent, a timer, a trigger)? Guide: `docs/ops/QUERY_C_OWNER_RUN_GUIDE.md` | no | nothing |
| 1 | **The read-only look at `feature_flags`** (the switch table) from the launch plan | no | nothing |
| 2 | **Draft 10**: the five stock functions (R1–R5) | adds 6 functions; no data changes | Query C shows no other stock writer (or we dealt with it) |
| 2 | **Draft 21**: the five switches, **all off** | adds 5 switch rows, off | draft 10 |
| 3 | Turn on **one** switch (Receive first), try it once on a real delivery, then the next: Receive → Adjust → Recall → Return → Delete | one button at a time | draft 21 |
| 4 (optional) | **Draft 17**: a purchase-order line cannot be changed while that order is being received | adds 1 guard | nothing (best after evening 3) |

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/10_DRAFT_stock_functions.sql` (install R1–R5) | 618 | `7fd83dde8009f018` |
| `docs/ops/sql/drafts/11_DRAFT_rollback_stock_functions.sql` (undo of 10) | 42 | `3d8a80cc600fca5a` |
| `docs/ops/sql/drafts/21_DRAFT_stock_function_switches.sql` (the switches, all off) | 79 | `c0d789cc056b7f27` |
| `docs/ops/sql/drafts/22_DRAFT_rollback_stock_function_switches.sql` (undo of 21) | 33 | `9269b4cc5a98d18c` |
| `docs/ops/sql/drafts/17_DRAFT_po_line_delete_guard.sql` (optional guard) | 139 | `a023bf98b4f940e0` |
| `docs/ops/sql/drafts/18_DRAFT_rollback_po_line_delete_guard.sql` (undo of 17) | 18 | `e0f8ff9c6e6c53b8` |

## Is it safe? What was checked (all on throwaway copies, synthetic data)

- The functions run with **the caller's own rights** (security invoker): your existing rules and history
  recorder apply unchanged. Visitors (the public key) cannot use them.
- Every write was made to fail on purpose: the database stayed exactly as before each time. 40 stress
  runs, no deadlocks. Pressing Run twice is harmless (tested).
- Each file stops by itself, changing nothing, if a table, column or helper it needs is missing
  (the same protection that stopped step A safely on Nov 27).
- **Nov 27:** drafts 10, 21 and 17 install cleanly, in this order, on a copy shaped like your real
  database as tonight's looks showed it (`docs/ops/sql/local-test/production_shape_install_test.sh`,
  33 of 33).
- **Nov 27:** the "proof it is the reviewed code" check below still gives the value written in the
  runbook (`f6d9c2c8be690710eeb721041f6779d9`), re-computed tonight on a fresh copy.

## After each step: check (read-only)

**After draft 10** (6 rows, each `false | true | false`):

```sql
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as visitors_can_run,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as staff_can_run,
       p.prosecdef as runs_with_raised_rights
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('_he_apply_stock_change','adjust_inventory','receive_purchase_order',
                     'quarantine_recall','receive_return','delete_unused_product')
 order by 1;
```

Then the fingerprint check from the runbook (one value, `f6d9c2c8be690710eeb721041f6779d9`):

```sql
select md5(string_agg(p.proname || ':' || pg_get_function_identity_arguments(p.oid) || ':' || md5(p.prosrc), ',' order by p.proname)) as fingerprint
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('_he_apply_stock_change','adjust_inventory','receive_purchase_order',
                     'quarantine_recall','receive_return','delete_unused_product');
```

**After draft 21** (5 rows, each `false`):

```sql
select flag_key, enabled from public.feature_flags where flag_key like 'stock_fn_%' order by 1;
```

Then on the dashboard: Feature Flags shows the five stock switches, all off. Turn on **Receive** only,
receive one real delivery, and check its stock on Inventory. Tell me before the next switch.

## Undo

- One button: turn its switch off on Feature Flags. Instant, no update needed.
- All five switches: turn them off, then file 22 (it removes the five rows and stops, changing nothing, while one is still on).
- The functions: turn every switch off first, then file 11. It removes only the six functions; no
  table and no record is touched.
- The guard: file 18.

## What is NOT in this page (later, separate decisions)

Request keys (drafts 19 and 27: no double order after a dropped connection), the nightly "everything
adds up" check (drafts 23, 25, 29), report totals (draft 13) and the permission fixes that wait on
Query G. Each gets its own page in this format when its turn in the launch plan comes.
