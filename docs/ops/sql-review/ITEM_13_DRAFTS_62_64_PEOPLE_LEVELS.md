# Review item 13 — SQL drafts 62 and 64: four levels of account

Status: **READY FOR YOUR REVIEW — not run in production** · written 2026-11-25 ·
OWNER DECISION REQUIRED (approve the run, or not yet)

This is the database part of the **New Employee** page (your decision of Nov 24). The page itself
and the small helper program that creates sign-ins come after it. Nothing here has been run in
production. I never run it myself: you run it, after approving it.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/62_DRAFT_manager_role.sql` (install, first) | 48 | `c78870424a9e247f` |
| `docs/ops/sql/drafts/63_DRAFT_rollback_manager_role.sql` (its check) | 39 | `23a7f89ef6794f75` |
| `docs/ops/sql/drafts/64_DRAFT_people_levels.sql` (install, second) | 389 | `275cdc3123fd520e` |
| `docs/ops/sql/drafts/65_DRAFT_rollback_people_levels.sql` (undo) | 74 | `d70203e851cd44b5` |

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by you. Tested only
on a throwaway local copy with made-up accounts.

## What it does, in plain words

Four levels: **Owner > Administrator > Manager (new) > Employee.**

Today only the owner can see or change another person's account. After these two steps each level
looks after the levels **below** it, and nothing else:

| Who | May look after |
|---|---|
| The owner | administrators, managers, employees |
| An administrator | managers, employees (never an owner, never another administrator) |
| A manager | employees |
| An employee | nobody |

"Look after" means: see the account, change its name and department, change its level (only to a
level below your own), suspend it, remove it, and bring it back. **Remove never deletes:** the
account is switched off and marked removed, and its whole history stays.

What never changes hands, whoever asks:

- An owner account and the emergency account are not changed by these functions at all.
- Nobody changes their own level or suspends themselves.
- Nobody is made an owner.
- The emergency mark stays owner-only, as today.

**Draft 62** adds the one word "manager" to the list of roles. It gives nobody the role and changes
no account and no rule. It is a file of its own because the database does not allow a new word to
be used in the same step that adds it.

**Draft 64** does three things:

1. The guard that already protects the accounts table learns the four levels. **Its text as it is
   today is saved first**, in a small table no signed-in person can read, so the undo can put back
   exactly what was there.
2. Two row rules are added: an administrator or a manager may read and change the accounts below
   their level. The rules that exist today are not touched.
3. Five functions for the dashboard: suspend/remove/bring back, change level, change name and
   department, switch on a brand-new account, and a yes/no question the helper program asks before
   it creates a sign-in or sets a password.

Every function runs with the rights of the person who is signed in (the project rule). The row
rules and the guard decide; nothing has more power than the person using it.

## What it does not do

- It creates no sign-in and sets no password. Only the provider's own key can do that, and that
  key never comes near the dashboard. A small helper program at the provider does that part, in a
  later step that you approve separately.
- It adds no second history. Who changed which account is in the audit log that already exists
  (the Employee Activity page).
- It changes no existing account when it is installed.

## Before you run it: one read-only look (2 minutes)

A new level is only safe if the rules that already exist treat it sensibly. This query **only
reads**. It lists the names of the rules and functions that mention the word "employee", so we can
see whether any of them would treat a manager worse than an employee. Send me the result (it holds
names only, no customer data and no secrets).

```sql
-- READ ONLY. Changes nothing.
select 'rule' as kind, tablename as on_table, policyname as name
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* '\memployee\M'
union all
select 'function', '', p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosrc ~* '''employee'''
order by 1, 2, 3;
```

If the list is empty, a manager is treated like every other active team member. If it is not empty,
I look at each name with you before anyone is given the level "manager". The two steps themselves
can be installed either way: installing gives nobody the level.

## The run, when you approve it

1. Run draft 62. Expected: "Success. No rows returned".
2. Run draft 64. Expected: "Success. No rows returned". If it stops with a message that starts
   "Not installed:", nothing was changed; send me the message.
3. The check after (read-only):

```sql
-- READ ONLY. Changes nothing.
select
  (select count(*) from pg_enum where enumtypid = 'public.app_role'::regtype and enumlabel = 'manager') as manager_word,
  (select count(*) from public.people_levels_backup) as saved_guard,
  (select obj_description('public.guard_profile_privileged_columns()'::regprocedure::oid, 'pg_proc')) as guard_mark,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname like 'profiles_levels%') as new_rules,
  (select count(*) from public.profiles where role::text = 'manager') as managers;
```

Expected: `1`, `1`, `Health Endeavors drafts/64: the guard knows four levels`, `2`, `0`.

Both steps are safe to run twice.

## How to undo it

Run draft 65. It puts the guard back to the exact saved text, removes the two row rules, the
functions and the small table. No account is changed. Draft 63 then only checks that no account
still has the level "manager" (the word itself cannot be taken out of the list, and does nothing
when unused).

## How it was tested

`docs/ops/sql/local-test/people_levels_test.sh` on a throwaway local copy made to look like
production (the role as a list type, production's two row rules, and a stand-in for today's guard
written from its description, not copied): **93 checks, all pass.** They cover: the order of the
two files; who sees which account; suspend, remove and bring back; changing a level; going around
the functions with a direct change (the row rules and the guard still refuse); a brand-new account;
the helper program's question; the audit log; the undo restoring the guard word for word; and the
cases where it must stop instead of guessing.

## Known limits

- The rule is by level. Two administrators have the same rights; neither can change the other.
- The stand-in guard in the test was written from the description of the real one. The real text
  is saved by draft 64 before it is replaced, and draft 65 restores it; but the new guard was
  written without copying the old one, so the read-only look above matters.
- Last sign-in times are not readable by these functions; the page will show them through the
  helper program.
- Work emails only (no personal addresses) is checked by the page and the helper program, not by
  the database, because the business address does not exist yet.
