# Review item 14 — SQL draft 58: each person's own settings on every device

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · written 2026-11-24
Nothing here has been run in production. I never run it myself: you run it, after approving it.

Why: your rule of Nov 24, "the same on every phone and computer; nothing kept in only one browser".
Draft 50 (review item 10) does this for settings the whole business shares. This one is for the small
choices that belong to **one person**. First use: what you set aside until tomorrow on Home.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/58_DRAFT_my_settings.sql` (install) | 145 | `095d7c4be43d7d52` |
| `docs/ops/sql/drafts/59_DRAFT_rollback_my_settings.sql` (undo) | 45 | `d0ef5efbde58a5be` |

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by you. Tested only
on a throwaway local copy with made-up data.

## What it does, in plain words

A small new list, **my_settings**: one line per person and setting, with a short name
(`feed_snooze`), its value and when it was saved.

- **Each person reads and saves only their own.** Nobody sees another person's, you included.
  A deactivated account and a visitor see nothing.
- A setting is **replaced, never deleted**. At most 40 settings per person, each small.
- These are **not written to the audit log, on purpose**: they are view preferences (what is set
  aside on your own Home), not business records.
- It refuses to install over a table of the same name that it did not create, and changes no
  existing table.

What is saved for "set aside until tomorrow": the item's id, a short fingerprint and the times.
Never the text of a question, never a customer.

## Order and dependencies

- Needs, in production: `auth.uid()`, `is_active_staff()`, `is_owner_or_admin()`. If one is
  missing, it stops and changes nothing.
- Depends on no other draft. Safe to run twice.
- Supabase shows its usual warning about a "destructive operation": the file lists only
  `drop policy if exists …` and `drop trigger if exists …` on its own new table.

## Local test (throwaway database, made-up data)

`docs/ops/sql/local-test/my_settings_test.sh`: **37 of 37 passed** (Nov 24). It acts as the owner,
an administrator, two staff members, a deactivated account and a visitor, and covers: install twice;
each person saves and reads only their own (the owner cannot read a staff member's); a row typed for
someone else is stored under the signed-in person; replacing; the limits (40 per person, the size, a
bad name); nothing can be deleted or renamed; the rollback; a foreign table of the same name is left
untouched.
Dashboard tests: `tests/specs/attention-feed-ext24.spec.js` ("set aside on every device").

## After running: check (read-only, paste into the SQL editor)

```sql
select to_regclass('public.my_settings') is not null as table_present,
       (select count(*) from public.my_settings) as settings,
       (select relrowsecurity from pg_class where oid = 'public.my_settings'::regclass) as row_level_security_on,
       has_table_privilege('anon', 'public.my_settings', 'select') as visitors_can_read;
```
Expected: `true | 0 | true | false`. Anything else: stop and send me a screenshot. This check was
tried on the throwaway local database.

Then on the dashboard:

1. **Admin → Feature Flags → Features that save real records (owner only) → Your own settings on
   every device → Turn on.** It shows "Installed" once this step has run. Reload the page.
2. On Home ("Needs you now"), press **Later** on an item. The line below the list reads
   "1 set aside until tomorrow (on every device you sign in to)."
3. On your phone: turn the same switch on, reload, open Home. The same item is set aside there.
4. Press **Show them again** on one device; after a reload the item is back on the other too.

## Undo

- Nothing saved yet: run file 59. It removes everything 58 added. Harmless twice.
- Settings saved: file 59 stops and says how many. Then (only if you decide they can go) run
  `set he.rollback_delete_my_settings = 'yes, delete the personal settings';` and file 59 in the
  same session. Afterwards setting aside works in each browser again, as before.

## Your decision

- [ ] Approve running draft 58 in production, or
- [ ] Not yet.
