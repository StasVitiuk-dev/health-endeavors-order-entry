# Review item 12 — SQL draft 54: which batch went into which order

Status: **READY FOR YOUR REVIEW — not run in production** · written 2026-11-24 · OWNER DECISION
REQUIRED (approve the run, or not yet)

Nothing here has been run in production. I never run it myself: you run it, after approving it.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/54_DRAFT_order_batches.sql` (install) | 299 | `a19bbc8a6e156aee` |
| `docs/ops/sql/drafts/55_DRAFT_rollback_order_batches.sql` (undo) | 53 | `930e6c190b5c994e` |

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by you. Tested only
on a throwaway local copy with made-up data.

## Why

The barcode printed on a bottle says which product it is, not which batch (your photos of Nov 24),
so each bottle gets a batch sticker (PR #57). This step is what the sticker is for: when a parcel is
packed, the sticker is scanned and the batch is kept with the order. If a batch ever has a problem,
one list shows every order (and so every customer) that got it.

## What it does, in plain words

One new list, **order_batches**: one line per order and batch, with the batch number as it was
scanned, how many bottles, who recorded it and when.

Two actions the dashboard uses:

- **Record a batch on an order.** One bottle or several. Scanning the same batch for the same order
  again adds to its count. The answer says whether the number matches a batch in stock: yes, no,
  "two products share this number", or "could not be checked with this account" (see the open
  question below). A number that matches nothing is still kept, because it is what was on the bottle.
- **Void a wrong scan** (you and administrators only), with a reason. The line stays on the record,
  marked void; the right batch is then recorded as a new line.

Rules: nothing is ever deleted; a line's order and batch number never change; its count only goes
up; a voided line is final. Every active team member, administrators and you can read and record
(packing is staff work). Visitors and deactivated accounts see nothing. Every change also goes to
the audit log. Changes no existing table: orders, batches in stock and products are only read.

## Open question (read-only check, changes nothing)

I do not know whether employees may **read** the batches in stock (`inventory_lots`) in
production. In the local copy only you and administrators can. It matters only for the message a
packer sees ("matches stock" versus "could not be checked"); the recall list works either way,
because it goes by the scanned number. This shows the rules, no data:

```sql
select policyname as rule, cmd as applies_to, roles::text as for_whom, qual as who_may
  from pg_policies where schemaname = 'public' and tablename = 'inventory_lots' order by 1;
```

## Order and dependencies

- Needs, in production: `auth.uid()`, `is_active_staff()`, `is_owner_or_admin()`, the `orders`,
  `inventory_lots`, `products`, `tasks` and `audit_log` tables and the audit trigger on `tasks`.
  If one is missing, it stops and changes nothing.
- It also stops, changing nothing, if a table or function with one of its own names already exists
  that it did not create.
- Depends on no other draft. Safe to run twice.

## Local test (throwaway database, made-up data)

`docs/ops/sql/local-test/order_batches_test.sh`: **48 of 48 passed** (Nov 24): refuses a table or
function of the same name it did not create; install twice; a packer records a bottle (saved
"unchecked" where the packer may not read stock); the same batch again adds to the count; an
administrator's scan fills in the link to the batch in stock; an unknown number is kept and flagged;
a number shared by two products is kept but linked to neither; deactivated account and visitor
refused; unknown order, empty or too-long number, zero bottles and more than 10,000 refused; who can
read; the list of orders for a batch; staff cannot void; a reason is needed; void once; a voided
line is final; no deletes; order, number and link cannot be changed; the count cannot go down; audit
log; removing a batch from stock is not held back; two people scanning at the same moment make one
line with two bottles; rollback (stops while lines exist, removes everything with written
authorization, harmless twice, reinstall works).

## After running: check (read-only, paste into the SQL editor)

```sql
select to_regclass('public.order_batches') is not null as table_there,
       (select count(*) from public.order_batches) as rows,
       (select count(*) from pg_trigger where tgname = 'order_batches_audit') as audit_trigger,
       has_table_privilege('anon', 'public.order_batches', 'select') as visitors_can_read;
```
Expected: `true | 0 | 1 | false`. Anything else: stop and send me a screenshot.

## Undo

- Nothing recorded yet: run file 55. It removes everything 54 added. Harmless twice.
- Batches recorded: file 55 stops and says how many. They are what a recall is traced with; export
  them first, then (only if you decide they can go) run
  `set he.rollback_delete_order_batches = 'yes, delete the recorded batches';` in the same SQL
  editor run, before file 55.

## Then

Turn the screen on only after this is installed: Feature Flags → "features that save real records"
→ **Batch on each order** → Turn on (it shows "Installed" once this step has run).

## Known limits

- It records what the packer scanned. It does not lower stock per batch and does not check that the
  batch still has bottles left.
- Batch numbers are not unique across products in stock; a number two products share is kept but
  linked to neither.
