# Review item 19 — SQL draft 74: step A2, the id your history recorder needs

Status: CURRENT · **installed and verified in production by the owner on Nov 27, 2026** (about 4:07 AM
Central, after #139 merged as `6988cdb`): one `pg_advisory_xact_lock` row and no error; the read-only check
below showed exactly `uuid | 0 | 1`. Then "Settings shared by every device" was turned on and the first
shared save worked: `shared_settings` holds one row `feature_switches | staff` (Real profit and Backups &
Printouts on) and `audit_log` holds 2 rows for it. Written 2026-11-27. I never run it myself: you ran it.

## Why

Step A (draft 50) was installed and checked on Nov 27 (`true | 0 | 1 | false`). When you then
turned on "Settings shared by every device" and pressed a switch, the dashboard said:
**"The database refused: record "new" has no field "id". Nothing was changed."**

Your read-only look the same night showed the reason. Step A attaches your own history recorder
(`audit_trigger_function()`, the one on `tasks`) to the new settings table, so every change is
written to `audit_log`. That recorder writes each row's **`id`** (`new.id::text`, `old.id::text`).
The settings table names its rows by **key** and has no `id` column, so the recorder fails and the
database undoes the whole save. Nothing was ever saved and nothing else was affected.

My local test copy used a more forgiving stand-in recorder (it wrote `?` when a row had no `id`),
so the tests passed. That stand-in is now word for word your recorder, and a new check fails if
any waiting step attaches the recorder to a table without an `id` (recorded in
`docs/PROJECT_RECORD.md`, discrepancy #9).

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/74_DRAFT_shared_settings_audit_id.sql` (install) | 57 | `27550a1b2cda75ef` |
| `docs/ops/sql/drafts/75_DRAFT_rollback_shared_settings_audit_id.sql` (undo) | 44 | `aacd32e47fcc083d` |

## What it does, in plain words

- Adds **one column**, `id`, to the settings table. It is filled in automatically with a random
  identifier and is unique; nobody types it. Your recorder then writes it as the record's id, so
  every save of a setting lands in your history log with who and when, as step A intended.
- Changes **nothing else**: the setting's name (key), the rules, the guard, `set_shared_setting()`,
  your recorder and every other table stay exactly as they are. The table is empty today.
- It stops, changing nothing, if step A's table or its history trigger is missing, or if an `id`
  column is already there that this file did not add. Safe to run twice.
- Supabase's warning: none expected (it adds a column and an index; nothing is dropped). If a
  warning lists anything: Cancel and send a screenshot.

## Local test (throwaway database, your recorder word for word)

`docs/ops/sql/local-test/shared_settings_audit_id_test.sh`: after step A alone, an owner's save is
refused with exactly your message and nothing is saved or logged; after draft 74 the save is
accepted and recorded in the history log under the row's id with who saved it; saving again keeps
the id and logs old and new; the version check (two devices) still works; an employee still cannot
save; a setting still cannot be deleted; a row that existed before gets an id too; the undo
removes the column and saves are refused again; it refuses without step A and refuses an `id`
column it did not add.

## After running: check (read-only)

```sql
select format_type(a.atttypid, a.atttypmod) as id_type,
       (select count(*) from public.shared_settings) as settings,
       (select count(*) from pg_indexes where indexname = 'shared_settings_id_key') as unique_index
  from pg_attribute a
 where a.attrelid = 'public.shared_settings'::regclass and a.attname = 'id' and not a.attisdropped;
```
Expected: one row, `uuid | 0 | 1`. Then on the dashboard: Feature Flags → "Settings shared by every
device" → Turn on, reload, and turn one preview switch on: the message says it is on **for every
device**.

## Undo

File 75. It removes the column only if this file added it. Afterwards saves are refused again
(turn "Settings shared by every device" off first). Saved settings stay. Harmless twice.

## Also fixed before install (not in production)

Three waiting drafts attach the same recorder to a table without an `id`, and would have failed the
same way on their first save: draft 32 (`invoice_counters`, the yearly invoice number counter),
draft 52 (`order_costs`) and draft 56 (`email_suppressions`). Each table now has the same
automatic `id` column; their fingerprints changed (the guides show the new ones).
