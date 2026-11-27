# Review item 18 — SQL draft 72: the "active staff member" check

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · written 2026-11-27
Nothing here has been run in production. I never run it myself: you run it, after approving it.

## Why

On Nov 27 step A (draft 50) stopped safely, changing nothing: "this database is missing function
public.is_active_staff()". Your read-only look the same night listed the helper functions your
database has: `current_role()` and `is_owner_or_admin()` exist; `is_active_staff()` does not.
Eleven waiting drafts (32, 34, 36, 40, 44, 46, 48, 50, 54, 58, 64) use it to mean "any active
staff member", so each of them would stop the same way. The drafts and their tests assumed it
existed; it was never checked against production until now (recorded in `docs/PROJECT_RECORD.md`).

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/72_DRAFT_active_staff_helper.sql` (install) | 82 | `0f4d13ac1f07b0cc` |
| `docs/ops/sql/drafts/73_DRAFT_rollback_active_staff_helper.sql` (undo) | 41 | `c09df45034d8ca14` |

## What it does, in plain words

One small function, `is_active_staff()`: "yes" when the signed-in person's account is **active**,
**not removed**, and their role is **owner, administrator, manager** (once that role exists) or
**employee**. An **AI agent** account is not staff. A visitor cannot use it at all.

- Built like your existing `is_owner_or_admin()` (same table and columns), but it runs with the
  caller's own rights (project rule): it only reads the person's own account row, which every
  signed-in person may read. If that row could not be read, the answer is "no".
- It changes **no table, no rule, no account and no existing function**. Nothing calls it until
  a later step (like step A) uses it.
- It stops, changing nothing, if the accounts table lacks the expected columns, if no rule lets a
  person read their own account row, or if a function of the same name already exists that this
  file did not create.
- Supabase's warning: expected to list only `revoke` (taking the right to use it away from
  visitors). Anything else: Cancel and send a screenshot.

## Local test (throwaway database shaped like production)

`docs/ops/sql/local-test/active_staff_helper_test.sh`: production's shape (no such function, the
role as a fixed list, your two helpers as they are); step A stops as it did on Nov 27; after
draft 72, the answers are right for owner, administrator, employee, a switched-off employee, a
removed employee, an AI agent and a signed-in person without an account row; visitors refused;
step A then installs and an employee reads only settings marked for staff; the undo refuses while
step A's rule uses it, and works after step A's own undo; it refuses a same-named function it did
not create, and refuses when no own-row reading rule exists. **35 of 35 passed (Nov 27).**

## Found at the same time: the role is a fixed list in production

The owner's second look (Nov 27) showed that production's `current_role()` answers the fixed list
`app_role`, not text, and that a signed-in person reads their own account row (`profiles_select_own`).
Several drafts compared the role with `''` or with `'manager'` (a word the list holds only after
draft 62), which stops an install on that list. Drafts 34, 36, 38, 40, 46, 50, 56 and 66 now compare
the role **as text**, which works on both shapes; their fingerprints changed (the guides show the new
ones). A new local test, `production_shape_install_test.sh`, installs every waiting draft (72 first)
on a copy shaped like production: **all 20 install**. With the old drafts, 5 stopped (36, 38, 46, 50,
56). A static check now refuses any draft that compares the role without `::text`.

## After running: check (read-only)

```sql
select to_regprocedure('public.is_active_staff()') is not null as present,
       (select prosecdef from pg_proc where oid = to_regprocedure('public.is_active_staff()')) as raised_rights,
       has_function_privilege('anon', 'public.is_active_staff()', 'execute') as visitors_can_use;
```
Expected: `true | false | false`. Then step A (draft 50) can be run.

## Undo

File 73. It removes the function only if this file created it, and only while no rule uses it
(undo the later steps that use it first). Harmless twice.
