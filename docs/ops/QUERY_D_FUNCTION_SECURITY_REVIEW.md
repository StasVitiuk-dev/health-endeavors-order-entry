# Query D function security review

Status: **CURRENT** (updated 2026-11-27, night). **FIX 3 is applied and verified in production** (owner, about 8:34 PM Central): visitors who are not signed in can no longer run any of the ten functions. The full entry, with the exact SQL, the rollback and the checks, is in `PRODUCTION_CHANGE_LOG.md` ("2026-11-27 · FIX 3"). Now that the fix is applied, the function names are given there; the rule of withholding them until then is met. The sections below are the Oct 18 analysis, kept as it was; where the Nov 27 evidence changed the picture, it says so in "What Query D2 and D3 showed".


## What Query D2 and D3 showed (2026-11-27, read-only, owner)

- **Query D2** (who may run each function, whether its code checks the caller, its schema path, the scheduled jobs that use it): all ten could be run by everyone, signed in or not, with the owner's rights; nine had no caller check (`log_customer_data_access` checks `auth.uid()`); four had no fixed schema path; six are run by scheduled jobs (as `postgres`).
- **Query D3** (where each is used *inside* the database, what it returns, which login roles can run it): `generate_account_number` fills `profiles.account_number` for every new account; `record_alert` is called by `apply_inventory_adjustment`, which runs with the person's own rights, and by `escalate_overdue_tasks`; `raise_activity_alert` is called only by `detect_unusual_activity`. No trigger, view or row rule uses any of them. None returns customer data: they return nothing, a number, yes/no or one account number. So the risk was that a visitor could *trigger* them, not read data through them.
- **Consequence for the fix:** the Oct 18 plan kept signed-in staff on all ten. The applied fix is narrower. Staff keep only the three they need (the privacy log, `record_alert` for stock adjustments, and the account number for new accounts), and the sign-up service is given the account-number function by name. Removing it from everyone would otherwise have broken sign-up. A local test showed that taking all ten away from staff breaks the privacy log, stock adjustments and new accounts.
- **After the fix**, Query D2 reads "all expected functions already safe", and the scheduled jobs that ran that evening all succeeded. Still to confirm: the three jobs that were not due that evening, and the privacy log the first time the dashboard shows a real order.
- Queries D2 and D3 themselves, and the local test of the fix (50 of 50 checks), were kept out of this repository until the fix was applied. **Since Nov 27 (late night) they are in it and run on every pull request:** `sql/13_READONLY_D2_function_rights.sql` and `sql/14_READONLY_D3_function_uses.sql` (read-only; tested by `local-test/query_d2_d3_test.sh`, 37 checks), and `local-test/fix3_test.sh` (50 checks), which reads the fix and its rollback **from the change-log entry itself**, so the record and the test cannot drift apart. The drift check `sql/11_READONLY_security_fix_drift_check.sql` now has four FIX 3 rows: visitors locked out of all ten; staff locked out of the seven job-only ones; staff and sign-up keep the three they need; the ten keep a fixed schema path. Run it any time: every row should say PASS. A browser-free test, `tests/specs/fix3-dashboard-calls.spec.js`, reads the same two lists from the change-log entry and fails if any dashboard page or program names one of the seven job-only functions (staff would be refused it on the live site, while the mocked tests still pass). Checked on Nov 28: the dashboard calls only the privacy log (`log_customer_data_access`, kept for staff), and none of the pending database drafts calls any of the ten.

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

## Readiness of the fix phase (2026-10-18)

The owner-controlled steps (Query D2, then the fix) have been made as safe as possible, and the work is held privately:

- The follow-up read-only query was checked to be strictly read-only (one select, no writes, no settings changes, no customer rows, sensitive lines blanked out).
- The fix was tested against edge cases as well as the normal path: functions with more than one version (only the exact one is touched), a half-done starting state, an interrupted run (nothing changes unless the whole thing succeeds), running it twice, undoing it twice, and a check that the undo does not hand out any extra right.
- A before/after rights table was produced: visitors lose the right; signed-in users, background jobs and the database owner keep it; nothing else changes.
- Owner instruction cards for both steps, and the after-the-change checks, are prepared.

**Readiness: ready for the owner's approval once the follow-up read-only query confirms the function details and the scheduled-job roles on production.** No blockers found. The only thing this working copy cannot see is the real list of scheduled jobs, which the follow-up query shows, so it comes first.

## Fix status

- A fix ("FIX 3") is **prepared and tested locally** (23/23 checks): it reproduces the issue, proves the PUBLIC-right trap, applies the fix (visitors refused, while the dashboard's signed-in path, nested calls, the background-job role and the database owner all still work, and no function body is changed), rolls back exactly, re-applies, and stops safely if a function is missing.
- *(Oct 18 text; superseded)* The fix is **not applied** and waits for the owner's separate approval. **Update 2026-11-27:** applied and verified; see the top of this file and `PRODUCTION_CHANGE_LOG.md`.
- Rights only: no function code, table, row or schedule is touched.

## Next step (read-only)

Before any fix, one more read-only query ("Query D2") reads the real body of each relevant function (with any sensitive line removed) and lists the scheduled jobs that use them, so the severity and the "jobs won't break" assumption are confirmed from production rather than inferred. It changes nothing and returns no customer data. It is prepared and tested locally.

## Limits

- Production function bodies were not available to this review; severity for the data-changing functions is provisional until Query D2 is read.
- No production change was made. No production SQL was run.

Related: `G04_VISITOR_RIGHTS_REVIEW.md` (visitor table rights), `PRODUCTION_CHANGE_LOG.md` (applied fixes).
