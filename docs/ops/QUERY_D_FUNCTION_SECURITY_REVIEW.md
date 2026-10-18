# Query D function security review

Status: **CURRENT** (2026-10-18). A read-only analysis plus local testing. Nothing in production was changed or run. The specific function names and the exact weakness are deliberately withheld from this public repository until the fix is applied, the same rule used for earlier production fixes. The full detail, the prepared fix and the local tests are kept privately and shared with the owner directly.

## What Query D is

Query D (`sql/03_READONLY_D_definer_function_identity_check.sql`) is a read-only check that lists the database functions which run with their owner's rights ("SECURITY DEFINER"). Such a function can act with more power than the person calling it, so it matters who is allowed to call it and whether it checks who is calling. Query D returns only names and yes/no answers, never function code.

## What the owner's Query D result showed

The owner ran Query D read-only on production on 2026-10-18. It returned **32** owner-rights functions, sorted by a suggested reading:

| Class | Count | Meaning |
|---|---|---|
| E | 8 | callable by not-signed-in visitors, no caller check, and changes data |
| D | 2 | callable by visitors, no caller check, reads only |
| C | 9 | callable by visitors, but checks who is calling first |
| B | 4 | not callable by visitors (signed-in users may) |
| A | 9 | trigger-only: cannot be called through the API at all |

## What the review found

- **The 9 trigger-only functions (class A) are not a problem.** A trigger function cannot be called directly through the API. This was proven locally: the database refuses the call with "trigger functions can only be called as triggers", even for the database owner. No change needed.
- **The class C functions check the caller.** They are lower priority; the gates are to be confirmed in the follow-up read-only step below, not deeply re-audited.
- **The class D and E functions (10 in total) are the real finding.** A not-signed-in visitor can call them, and they run with the owner's rights, so the normal row rules do not apply inside them. The provisional severity ranges from LOW to HIGH depending on each function's real body, which Query D does not show. This is a genuine open item.

A key subtlety, proven locally: removing the right from visitors alone is **not** enough, because a separate "everyone" (PUBLIC) right remains. The prepared fix removes both and grants the right back only to the roles that actually need it.

## Call-site check (so a fix would not break anything)

- **Dashboard:** only one of the 10 is called from dashboard code, and only after sign-in. The prepared fix keeps the signed-in right, so that path is unaffected (tested locally).
- **Scheduled / background jobs:** the data-changing ones look like scheduled maintenance. Scheduled jobs run as a privileged role, not as a visitor. The prepared fix keeps that role (tested locally). The follow-up read-only step lists the actual scheduled jobs so this can be confirmed on production before any change.
- **Public website forms:** none of the 10 is a website form target (the forms use the three tables covered in `G04_VISITOR_RIGHTS_REVIEW.md`, not these functions).

## Fix status

- A fix ("FIX 3") is **prepared and tested locally** (23/23 checks): it reproduces the issue, proves the PUBLIC-right trap, applies the fix (visitors refused, while the dashboard's signed-in path, nested calls, the background-job role and the database owner all still work, and no function body is changed), rolls back exactly, re-applies, and stops safely if a function is missing.
- The fix is **not applied**, not in this public repository, and waits for the owner's separate approval after the confirmation step below.
- Rights only: no function code, table, row or schedule is touched.

## Next step (read-only)

Before any fix, one more read-only query ("Query D2") reads the real body of each relevant function (with any sensitive line removed) and lists the scheduled jobs that use them, so the severity and the "jobs won't break" assumption are confirmed from production rather than inferred. It changes nothing and returns no customer data. It is prepared and tested locally.

## Limits

- Production function bodies were not available to this review; severity for the data-changing functions is provisional until Query D2 is read.
- No production change was made. No production SQL was run.

Related: `G04_VISITOR_RIGHTS_REVIEW.md` (visitor table rights), `PRODUCTION_CHANGE_LOG.md` (applied fixes).
