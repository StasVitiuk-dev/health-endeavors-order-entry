# Production change log

Status: **CURRENT.** One entry per production change, newest first. Each entry shows who approved and ran it, the exact SQL, the exact rollback and the check result. Claude never runs anything on production: the owner runs every change after approving it.

Only changes that are already applied are recorded here. Fixes that are still waiting are not published in this public repository until they are applied.

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

**Still open for this view:** signed-in users still read it with the owner's rights (Query G2 is expected to show WARN, not FAIL). A follow-up change, FIX 1B (`security_invoker`), is prepared and tested. It waits for the owner's separate approval.
