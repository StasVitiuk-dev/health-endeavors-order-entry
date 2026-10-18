# Production change log

Status: **CURRENT.** One entry per production change, newest first. Each entry shows who approved and ran it, the exact SQL, the exact rollback and the check result. Claude never runs anything on production: the owner runs every change after approving it.

Only changes that are already applied are recorded here. Fixes that are still waiting are not published in this public repository until they are applied.

## 2026-10-18 · FIX 2: only the owner can change a person's role, break-glass access or account status

| | |
|---|---|
| Found by | read-only Queries G2 and G3 (2026-10-18). Signed-in users held the UPDATE right on `profiles.role`; the update policy `profiles_update_self` lets a user update their own profile row, and no trigger checked which columns changed. So any signed-in user could change their own `role`, `is_break_glass`, `is_active` or `deleted_at` |
| What the fix does | a BEFORE UPDATE trigger on `profiles` (`profiles_guard_privileged_columns`). A role or break-glass change is refused unless the signed-in caller is the owner. Deactivate / reactivate / delete is refused unless the caller is the owner, or an administrator acting on someone else. Other profile edits are unchanged. Server-side work with no signed-in user (service key, SQL Editor, scheduled jobs) is not affected |
| Approved and run by | Stas (owner), in the Supabase SQL Editor of the production project `uizrazyehilyzmwttsrn` |
| Tested before | local throwaway database shaped like production, including exact copies of the `lock_account_number` trigger and the `profiles_update_self` policy: 33/33 checks. The hole was reproduced, the fix closed it, owner and normal edits still worked, the rollback restored the exact previous behaviour, and re-applying worked |
| Downtime | none |
| Dashboard change | none for the owner |
| Result | the check after the change returned `profiles_guard_privileged_columns`. The owner then re-ran read-only Query G3: the trigger is listed on `profiles`, and its source has the same checks as the SQL below (compared by Claude on the owner's CSV). The owner reports the dashboard still loads normally |
| Note | Query G2's P1 row will still say WARN: it only checks the column right, which is unchanged. The guard is what now stops the change; G3 is the check that shows it |

SQL that was run:

```sql
begin;
do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Stopped, nothing was changed: public.profiles was not found.';
  end if;
  if to_regprocedure('public."current_role"()') is null then
    raise exception 'Stopped, nothing was changed: public.current_role() was not found.';
  end if;
end $$;

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_caller uuid := auth.uid();
  v_role   text;
begin
  if v_caller is null then
    return new;  -- not a signed-in API call (database job, service key, SQL editor)
  end if;
  v_role := coalesce(public."current_role"()::text, '');
  if (new.role is distinct from old.role or new.is_break_glass is distinct from old.is_break_glass)
     and v_role <> 'owner' then
    raise exception 'Only the owner can change a person''s role or break-glass access. Nothing was changed.'
      using errcode = '42501';
  end if;
  if (new.is_active is distinct from old.is_active or new.deleted_at is distinct from old.deleted_at)
     and not (v_role = 'owner' or (v_role = 'administrator' and new.id <> v_caller)) then
    raise exception 'Only the owner (or an administrator, for someone else) can deactivate, reactivate or delete an account. Nothing was changed.'
      using errcode = '42501';
  end if;
  return new;
end
$fn$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();
commit;
-- Check (read-only): must list the new trigger
select tgname from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_guard_privileged_columns';
```

Rollback, only if something goes wrong (it removes the guard; the previous behaviour returns):

```sql
begin;
drop trigger if exists profiles_guard_privileged_columns on public.profiles;
drop function if exists public.guard_profile_privileged_columns();
commit;
select count(*) as guard_triggers_left from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_guard_privileged_columns';
```

## 2026-10-18 · FIX 1A: visitors who are not signed in can no longer read `activity_timeline`

| | |
|---|---|
| Found by | read-only Queries G, G2 and G3 (2026-10-18). The view ran with its owner's rights, did not check who was asking, and the `anon` role (anyone with the website's public key) could read all of its rows: order numbers and statuses, task titles, approval types and AI decision summaries |
| Approved and run by | Stas (owner), in the Supabase SQL Editor of the production project `uizrazyehilyzmwttsrn` |
| Tested before | local throwaway database shaped like production. The hole was reproduced, the fix applied, the rollback restored the exact previous behaviour, and re-applying worked |
| Downtime | none |
| Dashboard change | none: no dashboard page reads this view |
| Result reported by the owner | `visitors_can_still_read = false` |

SQL that was run:

```sql
begin;
do $$
begin
  if to_regclass('public.activity_timeline') is null then
    raise exception 'Stopped, nothing was changed: the view public.activity_timeline was not found.';
  end if;
end $$;
revoke all on public.activity_timeline from anon;
commit;
select has_table_privilege('anon', 'public.activity_timeline', 'SELECT') as visitors_can_still_read;
```

Rollback, only if something goes wrong (it restores exactly the previous rights):

```sql
begin;
grant all on public.activity_timeline to anon;
commit;
select has_table_privilege('anon', 'public.activity_timeline', 'SELECT') as visitors_can_read_again;
```

**Verification after the change (owner re-ran read-only Query G2, 2026-10-18; results as reported by the owner):**

| Check | Before FIX 1A | After FIX 1A |
|---|---|---|
| V1 `activity_timeline` | FAIL (readable by visitors who are not signed in) | **WARN** (readable by signed-in users only) |
| V1, the other 15 views | PASS | **PASS** (unchanged) |
| P1 (a separate item, not part of this change) | WARN | WARN (unchanged at that time; fixed later the same day by FIX 2, above) |

**Still open for this view:** signed-in users still read it with the owner's rights (Query G2 is expected to show WARN, not FAIL). A follow-up change, FIX 1B (`security_invoker`), is prepared and tested. It waits for the owner's separate approval.
