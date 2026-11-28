# Review item 21 — request keys: no double record after a dropped connection

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · written 2026-11-27
(night). Nothing here has been run in production. I never run it myself: you run it, after approving it.
Part of the two-week launch plan (`docs/ops/LAUNCH_PLAN_2_WEEKS.md`, step 3 of the database list).

## What it fixes, in plain words

Sometimes the database saves a new record but the answer never reaches the phone (a dropped
connection, a closed laptop). The person cannot tell it was saved and presses Save again: a second,
identical record. That can be a second expense (money), a second stock adjustment, a second order.

After these steps, every new record the dashboard creates carries a one-time "request key". If the
same attempt is sent again, the database recognises the key and refuses the copy instead of saving
it twice. The dashboard already sends the key on all 18 places that create records, but only once you
turn the **request keys** switch on.

## The order (one evening, about 15 minutes)

| Step | What | Changes anything? | Needs first |
|---|---|---|---|
| 0 | The read-only look at `feature_flags` from the launch plan | no | nothing |
| 1 | **Draft 19**: one empty column and one index on each table the dashboard creates records in (up to 22) | adds an empty column per table; no row, rule or permission changes | nothing |
| 2 | **Draft 27**: the `request_keys` switch, **off** | adds 1 switch row | draft 19 |
| 3 | Next day: Feature Flags → turn **request keys** on; add one test expense and delete it | the dashboard starts sending keys | draft 27 |

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/19_DRAFT_request_keys.sql` (the columns) | 88 | `dd917fab8111e5b1` |
| `docs/ops/sql/drafts/20_DRAFT_rollback_request_keys.sql` (undo of 19) | 41 | `6c70f8bf5a4a08d8` |
| `docs/ops/sql/drafts/27_DRAFT_request_keys_switch.sql` (the switch, off) | 51 | `0447f2ae7d10c478` |
| `docs/ops/sql/drafts/28_DRAFT_rollback_request_keys_switch.sql` (undo of 27) | 27 | `0eb767783f69fcfe` |

## Is it safe?

- Existing records keep an empty key and never conflict. Nothing reads the column until the switch is on.
- A table the file does not find is skipped and named in the result (nothing stops).
- Building the indexes pauses saves on each table for a fraction of a second (the tables are small).
  Run it when nobody is saving.
- Draft 27 stops, changing nothing, if draft 19 is missing or if `feature_flags` cannot give a new row
  its own id (that is why the read-only look comes first).
- **Nov 27:** both install cleanly on a copy shaped like your real database as tonight's looks showed it
  (`docs/ops/sql/local-test/production_shape_install_test.sh`, 33 of 33).

## After running: check (read-only)

```sql
select count(*) filter (where column_name = 'client_request_id') as tables_with_key
  from information_schema.columns where table_schema = 'public';
select flag_key, enabled from public.feature_flags where flag_key = 'request_keys';
```
Expected: first, the number of tables draft 19 reported (up to 22); second, one row `request_keys | false`.

## Undo

- Turn the switch off: instant, no update needed (the dashboard stops sending keys).
- Then file 28 (removes the switch row; it stops, changing nothing, while the switch is on), then
  file 20 (removes the columns and indexes; every record stays, only its key goes). Each is harmless twice.
