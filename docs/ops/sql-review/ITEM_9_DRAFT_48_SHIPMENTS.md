# Review item 9 — SQL draft 48: parcels and drop-off receipts

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · written 2026-11-24
Nothing here has been run in production. I never run it myself: you run it, after approving it.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/48_DRAFT_shipments.sql` (install) | 312 | `21dc4b9c15213485` |
| `docs/ops/sql/drafts/49_DRAFT_rollback_shipments.sql` (undo) | 46 | `9f57badd6477c258` |

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by you. Tested only
on a throwaway local copy with made-up data.

## What it does, in plain words

Two small new lists:

- **shipments**: one line per parcel: which order it belongs to, the carrier (UPS, USPS, FedEx,
  DHL, other), the tracking number, where it is (label created → dropped off → in transit → out for
  delivery → delivered; or exception, returned, cancelled), when it was dropped off and delivered,
  and who added it.
- **shipment_events**: each parcel's diary, written by the database itself every time the parcel
  moves. Nobody can write, change or delete it by hand.

And two actions the dashboard uses:

- **Keep a tracking number with its order.** The same number on the same order twice is one parcel;
  the same number on a **different** order is refused (one label belongs to one parcel).
- **One drop-off receipt marks every parcel on it** (up to 500 at a time): each parcel still at
  "label created" becomes "dropped off", with the time and who did it. Each number gets its own
  answer: marked, already done, not on any order yet, or not marked (cancelled or returned).
  Pressing it twice changes nothing the second time.

Rules: a parcel only moves forward; its order, carrier and number never change; a parcel is never
deleted (it can be cancelled before it is handed over). Every active team member, administrators and
you can see and do this (packing is staff work). Visitors and deactivated accounts see nothing. Every
change also goes to the audit log. Changes no existing table; orders are only read.

On the dashboard (Orders page, **Drop-off receipt**, behind the `he_dropoff` switch): paste the
receipt text (on iPhone: open the receipt photo, press and hold the text, Select All, Copy), or take a
photo of the barcodes where the phone can read them, or type the numbers. Only numbers whose carrier
check digit is right are ticked; then **Mark N parcels dropped off**. A number that is on no order yet
can be added to its order right there.

## Order and dependencies

- Needs, in production: `auth.uid()`, `is_active_staff()`, `is_owner_or_admin()`, the `orders`,
  `tasks` and `audit_log` tables and the audit trigger on `tasks`. If one is missing, it stops and
  changes nothing.
- Depends on no other draft. Safe to run twice.

## Local test (throwaway database, made-up data)

`docs/ops/sql/local-test/shipments_test.sh`: **47 of 47 passed** (Nov 24): install twice; staff add
a parcel (spaces and lower case cleaned), who and when recorded; the same number twice is one parcel;
on another order refused; administrator and owner too; deactivated account and visitor refused;
unknown order or carrier refused; who can read; one receipt marks two parcels, a repeated number
counted once, an unknown number reported; pressing twice changes nothing; empty and more than 500
refused; status only forward; order and number never change; cancelled parcel not marked; no deletes;
the diary cannot be written, changed or deleted by hand; audit log; two people marking the same
receipt at the same moment mark it once; rollback (stops while parcels exist, removes everything with
written authorization, harmless twice, reinstall works).
Dashboard tests: `tests/specs/dropoff-ext24.spec.js`.

## After running: check (read-only, paste into the SQL editor)

```sql
select to_regclass('public.shipments') is not null as parcels_table,
       to_regclass('public.shipment_events') is not null as diary_table,
       (select count(*) from public.shipments) as parcels,
       (select count(*) from pg_trigger where tgname = 'shipments_audit') as audit_trigger,
       has_table_privilege('anon', 'public.shipments', 'select') as visitors_can_read;
```
Expected: `true | true | 0 | 1 | false`. Anything else: stop and send me a screenshot.

## Undo

- No parcel recorded yet: run file 49. It removes everything 48 added. Harmless twice.
- Parcels recorded: file 49 stops and says how many. They are the record of which tracking number
  went with which order; export them first, then (only if you decide they can go) run
  `set he.rollback_delete_shipments = 'yes, delete the parcels';` in the same SQL editor run,
  before file 49.

## Then

Turn the screen on only after this is installed: on the dashboard, in the browser's console, run
`localStorage.setItem('he_dropoff','on')` and reload. (I will walk you through it.)
