# Review item 10 — SQL draft 50: settings shared by every device

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · written 2026-11-24
Nothing here has been run in production. I never run it myself: you run it, after approving it.

Why: your rule of Nov 24, "I need everything to be updated everywhere right away": a number you
type once must be the same on every phone and on the computer. Until this step is installed, such
numbers live in the one browser where you typed them.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/50_DRAFT_shared_settings.sql` (install) | 159 | `4c7eec3e23d9374a` |
| `docs/ops/sql/drafts/51_DRAFT_rollback_shared_settings.sql` (undo) | 46 | `c5f3ce502a6feeaa` |

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by you. Tested only
on a throwaway local copy with made-up data.

## What it does, in plain words

A small new list, **shared_settings**: one line per setting, with a short name
(`profit_estimates`), its value, who saved it last and when.

- **Only you** (the owner) can save or change a setting. Administrators can read them. Staff can read
  only settings marked for staff (none yet). Visitors see nothing.
- A setting is **replaced, never deleted**. Each change is also written to the audit log (the same
  one tasks use), so the previous value and who changed it stay on record.
- It **refuses to install** if a table with this name already exists that this file did not create
  (it checks its own mark), and changes nothing in that case. It changes no existing table.
- It holds settings only. Passwords, keys and tokens are never saved there: the dashboard refuses a
  value with such a name before sending it.

**First use:** the fee, postage and packaging estimates of **Real profit** (Accounting). After this
step, pressing **Save estimates** saves them for every device, and every phone and computer shows
the same profit. Another device picks up a change when it next opens or refreshes the page.

## Order and dependencies

- Needs, in production: `auth.uid()`, `current_role()`, `is_active_staff()`, `is_owner_or_admin()`,
  the `tasks` and `audit_log` tables and the audit trigger on `tasks`. If one is missing, it stops
  and changes nothing.
- Depends on no other draft. Can be run at any time; most useful right after the Real profit PR.
- Safe to run twice.
- Supabase shows its usual warning about a "destructive operation" for this file: it lists only
  `drop policy if exists …` and `drop trigger if exists …` on this file's own new table.

## Local test (throwaway database, made-up data)

`docs/ops/sql/local-test/shared_settings_test.sh`: **40 of 40 passed** (Nov 24): install twice; only
the owner saves (administrator, staff, visitor refused, direct inserts and updates too); saving
again replaces the value; who can read (owner and administrator all; staff only settings marked for
staff; a deactivated account and a visitor nothing); refusals (a bad name, a value that is not a
list of named values, no value, a very large value, an unknown audience, renaming, deleting); a
typed "saved by" is replaced by the real person; the audit log; rollback (stops while settings
exist, removes everything with written authorization, harmless twice); and a foreign table of the
same name is refused by both files and left untouched.
Dashboard tests: `tests/specs/shared-settings-ext24.spec.js`.

## After running: check (read-only, paste into the SQL editor)

```sql
select to_regclass('public.shared_settings') is not null as table_present,
       (select count(*) from public.shared_settings) as settings,
       (select count(*) from pg_trigger where tgname = 'shared_settings_audit') as audit_trigger,
       has_table_privilege('anon', 'public.shared_settings', 'select') as visitors_can_read;
```
Expected: `true | 0 | 1 | false`. Anything else: stop and send me a screenshot.

Then on the dashboard: Accounting → Real profit → **Fee and postage estimates** → **Save
estimates**. The message reads "Estimates saved for every phone and computer." Open the dashboard
on your phone: the same numbers are there.

## Undo

- Nothing saved yet: run file 51. It removes everything 50 added. Harmless twice.
- Settings saved: file 51 stops and says how many. Note the values first, then (only if you decide
  they can go) run `set he.rollback_delete_shared_settings = 'yes, delete the shared settings';` and
  file 51 in the same session. Afterwards the dashboard keeps such numbers in each browser again.

## What else lives in one browser today (to move here next, one at a time)

| Kept per browser today | Effect on a second device | Proposed |
|---|---|---|
| Preview switches (Feature Flags) | a feature turned on here is off there | move to shared settings, so one switch turns a feature on for every device (your decision: for you only, or for staff too) |
| "Daily recap printed" mark | the Home reminder shows on the other device | move |
| Snoozed items in the attention feed | a snoozed item still shows on the other device | move |
| Chosen look (Aurora / previous) | each device keeps its own look | keep per device (a look is a personal choice), unless you say otherwise |
| Sales outreach workbench (practice data) | practice data only | keep per device |

## Your decision

- [ ] Approve running draft 50 in production, or
- [ ] Not yet.
