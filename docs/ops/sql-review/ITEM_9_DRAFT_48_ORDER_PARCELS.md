# Review item 9 — SQL draft 48: parcels and drop-off receipts

Status: **READY FOR YOUR REVIEW — not run in production** · rewritten 2026-11-24 after the
read-only shape check of Nov 23 · OWNER DECISION REQUIRED (approve the run, or not yet)

> **What changed since the first version (which was BLOCKED):** production already has a
> `shipments` table, the Shipping/Tracking agent's. Your read-only check of Nov 23 showed its
> exact shape (`docs/ops/shapes/PRODUCTION_SHAPES_2026-11-23.md`; 0 rows so far). The draft was
> rewritten so that it **never changes that table**. It keeps its records in two new lists of its
> own and only *reads* the agent's table in one place.

Nothing here has been run in production. I never run it myself: you run it, after approving it.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/48_DRAFT_order_parcels.sql` (install) | 392 | `ca25da9142afa5b0` |
| `docs/ops/sql/drafts/49_DRAFT_rollback_order_parcels.sql` (undo) | 58 | `0bd892d0c19d26eb` |

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by you. Tested only
on a throwaway local copy with made-up data.

## What it does, in plain words

Two small new lists (both new, both this draft's own):

- **order_parcels**: one line per parcel: which order it belongs to, the carrier (UPS, USPS, FedEx,
  DHL, other), the tracking number, where it is (label created → dropped off → …; or cancelled),
  when it was dropped off, how it was added and who added it.
- **order_parcel_events**: each parcel's diary, written by the database itself every time the parcel
  moves. Nobody can write, change or delete it by hand.

And two actions the dashboard uses:

- **Keep a tracking number with its order.** The same number on the same order twice is one parcel;
  the same number on a **different** order is refused (one label belongs to one parcel).
- **One drop-off receipt marks every parcel on it** (up to 500 at a time): each parcel still at
  "label created" becomes "dropped off", with the time and who did it. A label this list has not
  seen yet is **looked up in the Shipping agent's table** (labels bought in Shopify land there): if
  the agent knows which order it belongs to, the parcel is added here and marked. Each number gets
  its own answer: marked, already done, not on any order yet, on two orders (check by hand), or not
  marked (cancelled). Pressing it twice changes nothing the second time.

**What it does to the Shipping agent's `shipments` table: nothing.** It reads three columns
(order, carrier, tracking number) and nothing else. It adds no column, rule, guard, trigger or
link to it, and never inserts, changes or deletes a row in it. The agent keeps working exactly as
today. A test in the repository fails if the draft ever contains a statement that would change
that table.

Rules: a parcel only moves forward; its order, carrier and number never change; a parcel is never
deleted (it can be cancelled before it is handed over). Every active team member, administrators and
you can see and do this (packing is staff work). Visitors and deactivated accounts see nothing. Every
change also goes to the audit log. Changes no existing table.

On the dashboard (Orders page, **Drop-off receipt**, behind the switch "Drop-off receipts"): paste
the receipt text (on iPhone: open the receipt photo, press and hold the text, Select All, Copy), or
take a photo of the barcodes where the phone can read them, or type the numbers. Only numbers whose
carrier check digit is right are ticked; then **Mark N parcels dropped off**. A number that is on no
order yet can be added to its order right there.

## Order and dependencies

- Needs, in production: `auth.uid()`, `is_active_staff()`, `is_owner_or_admin()`, the `orders`,
  `tasks` and `audit_log` tables, the audit trigger on `tasks`, and the agent's `shipments`
  table with its `order_id`, `carrier` and `tracking_number` columns. If one is missing, it stops
  and changes nothing.
- It also stops, changing nothing, if a table or function with one of its own names already exists
  that it did not create.
- Depends on no other draft. Safe to run twice.

## Local test (throwaway database, made-up data)

`docs/ops/sql/local-test/order_parcels_test.sh`: **64 of 64 passed** (Nov 24). On top of the
earlier checks (who can add, read and mark; the same number twice is one parcel; another order
refused; status only forward; nothing deleted; the diary cannot be touched by hand; audit log; two
people marking the same receipt at once; rollback), it now checks, with a copy of the agent's table
in its real shape:

- without the agent's table, or with a different shape, the install stops and changes nothing;
- after installing, the agent's table has exactly the same columns, rules, triggers and links;
- a label known only to the agent is found, added here with the right order, and marked; one the
  agent stored twice for the same order is one parcel; one stored under two orders is not marked;
- the agent's rows are only read (same rows, same status, same times), and the agent can still
  change and delete its own rows afterwards;
- the rollback leaves the agent's table and its rows untouched.

Dashboard tests: `tests/specs/dropoff-ext24.spec.js`.

## After running: check (read-only, paste into the SQL editor)

```sql
select to_regclass('public.order_parcels') is not null as parcels_table,
       to_regclass('public.order_parcel_events') is not null as diary_table,
       (select count(*) from public.order_parcels) as parcels,
       (select count(*) from pg_trigger where tgname = 'order_parcels_audit') as audit_trigger,
       has_table_privilege('anon', 'public.order_parcels', 'select') as visitors_can_read,
       (select count(*) from pg_trigger where tgrelid = 'public.shipments'::regclass and not tgisinternal) as agent_table_triggers;
```
Expected: `true | true | 0 | 1 | false | 1` (the last number is the agent table's own audit
trigger, there before and after). Anything else: stop and send me a screenshot.

## Undo

- No parcel recorded yet: run file 49. It removes everything 48 added. Harmless twice.
- Parcels recorded: file 49 stops and says how many. They are the record of which tracking number
  went with which order; export them first, then (only if you decide they can go) run
  `set he.rollback_delete_order_parcels = 'yes, delete the parcels';` in the same SQL editor run,
  before file 49.
- The agent's `shipments` table is not touched by the undo either.

## Then

Turn the screen on only after this is installed: Feature Flags → "features that save real records"
→ **Drop-off receipts** → Turn on (it shows "Installed" once this step has run).

## Known limits

- The agent's table had 0 rows on Nov 23, so its status words are unknown; this draft does not read
  or write its status. "Dropped off" is what your receipt says.
- If Shopify labels turn out to reach the agent's table late (after you are at the counter), the
  receipt will answer "not on any order yet" for those; add them by hand on the same screen, or scan
  again after the agent's next hourly run.
