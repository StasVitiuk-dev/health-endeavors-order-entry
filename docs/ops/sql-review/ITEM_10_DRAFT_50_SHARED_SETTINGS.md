# Review item 10 — SQL draft 50: settings shared by every device

Status: CURRENT · **installed and verified in production by the owner on Nov 27, 2026** (about 2:45 AM
Central: `true | 0 | 1 | false`); saving works since step A2 (drafts/74, item 19, about 4:07 AM). Since the
pull request `SHARED_SETTINGS_LIVE` (step 5 below) the shared settings are the rule on every device, with no
switch to turn on. Written 2026-11-24. I never run SQL myself: you ran it.

Why: your rule of Nov 24, "I need everything to be updated everywhere right away": a number you
type once must be the same on every phone and on the computer. Until this step is installed, such
numbers live in the one browser where you typed them.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/50_DRAFT_shared_settings.sql` (install) | 193 | `0d17fc4e94fbd847` |
| `docs/ops/sql/drafts/51_DRAFT_rollback_shared_settings.sql` (undo) | 47 | `7c666cde0eb7cee1` |

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by you. Tested only
on a throwaway local copy with made-up data.

## What it does, in plain words

A small new list, **shared_settings**: one line per setting, with a short name
(`profit_estimates`), its value, who saved it last and when.

- **You and administrators** can save or change a setting (changed Nov 25, before anything was
  installed, for your decision of Nov 24: an administrator is "almost like owner"; until then it
  was you only). Staff can read only settings marked for staff. Visitors see nothing. Who saved
  what stays in the audit log, and with "What administrators changed" on Home you are told.
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
- Supabase shows its usual warning about a "destructive operation" for this file. It lists only
  this file's own new things: `drop trigger if exists shared_settings_guard`, `drop function if
  exists public.set_shared_setting(text, jsonb, text)` (an older shape of its own function, never
  installed), `drop policy if exists shared_settings_…` (three), and `revoke` (taking rights away
  from visitors). Checked against the file on Nov 27: nothing else is dropped or revoked.

## Changed before install (Nov 25): two devices never erase each other's additions

Your queue of Nov 25 (task 7) asked that one device must not silently erase what another device
added to a shared list (for example the hand-offs marked "Handled", or the ticks on the launch
list). The save now carries **the version the page read**. The database saves only if nobody
saved in between; otherwise it changes nothing and answers "conflict", and the page reads the
newer list, adds its own change to it and saves again (at most three times, then it says "not
saved" instead of pretending). The check is inside the database, in one statement, so it holds
even when two saves arrive at the same instant. A single switch (on or off) is still saved
without a version on purpose: there, the last choice wins. The preview switches are kept as one list, so (also Nov 25) turning one
switch on or off is applied to the newest list with the version check: two devices switching
different features at the same moment both keep their choice (each switch: the last choice wins).
The undo file (51) now removes this
new shape of the function (and the earlier one, if it was ever installed).

Proven twice: the local database test (section 4b) saves from **two real connections at the same
instant**: exactly one goes through, the other is told "conflict", and after it reads again the
list holds both additions. The dashboard test `tests/specs/shared-settings-race-ext25.spec.js`
runs two simulated devices at once and shows that without the check one addition is lost, and
with it both are kept.

## Local test (throwaway database, made-up data)

`docs/ops/sql/local-test/shared_settings_test.sh`: **51 of 51 passed, three runs in a row** (Nov 25, with the
two-device check below; 42 of 42 earlier on Nov 25; 40 of 40 on Nov 24 when
only the owner saved): install twice; the owner and an administrator save, recorded under who
saved (staff, a switched-off account and a visitor refused, direct inserts and updates too); saving
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

Then on the dashboard:

1. **Feature Flags → Features that save real records → Settings shared by every device → Turn on**
   (it shows "Installed" once this step has run), then reload the page.
2. Accounting → Real profit → **Fee and postage estimates** → **Save estimates**. The message reads
   "Estimates saved for every phone and computer."
3. Feature Flags → flip any preview switch: the message says it is on (or off) for every device.
4. On your phone: turn on "Settings shared by every device" there too, reload, and check the same
   numbers and switches are there.
5. Tell Claude it works. Claude then opens a one-line PR (`SHARED_SETTINGS_LIVE`) that makes the
   shared settings the rule for every device, employees included, with no switch to turn on.

Why the switch in step 1: until this step is installed the dashboard must not ask the database for
shared settings at all (a failed request at every sign-in), so it asks only where you turned it on.

**Done (Nov 27):** steps 1–3 worked after step A2 (Real profit saved for every device; the estimates
"saved for every phone and computer"). Step 5 is the pull request `SHARED_SETTINGS_LIVE`: once merged, every
phone and computer, employees included, reads the shared switches, menu and settings at sign-in, and the
"Settings shared by every device" switch is gone from Feature Flags (an old "on" left in a browser does
nothing). Step 4 (the phone) is then automatic: open the dashboard on the phone, sign in, and the
switches you turned on are there. If the settings table ever cannot be read, each browser keeps its own
switches as before and nothing breaks. To go back to one browser each: put the previous version back (the
pull request's rollback steps); the saved settings stay in the database.

## Undo

- Nothing saved yet: run file 51. It removes everything 50 added. Harmless twice.
- Settings saved: file 51 stops and says how many. Note the values first, then (only if you decide
  they can go) run `set he.rollback_delete_shared_settings = 'yes, delete the shared settings';` and
  file 51 in the same session. Afterwards the dashboard keeps such numbers in each browser again.

## What else lives in one browser today (to move here next, one at a time)

| Kept per browser today | Effect on a second device | Proposed |
|---|---|---|
| Preview switches (Feature Flags) | a feature turned on here is off there | **BUILT (PR #53), owner decision of Nov 23:** shared by every device; work features for every employee; money, revenue and sensitive documents for the owner and administrators |
| "Daily recap printed" mark | the Home reminder shows on the other device | **BUILT (Nov 24):** kept here (`recap_printed`); the later day counts. Nov 25: saved with the version read, so an earlier day saved at the same moment never replaces a later one |
| Snoozed items in the attention feed | a snoozed item still shows on the other device | **BUILT (Nov 24):** each person's own, in draft 58 (review item 14). Nov 25: saved with the version read (both devices' items kept) |
| Chosen look (Aurora / previous) | each device keeps its own look | keep per device (a look is a personal choice), unless you say otherwise |
| Sales outreach workbench (practice data) | practice data only | keep per device |

## Your decision

- [ ] Approve running draft 50 in production, or
- [ ] Not yet.
