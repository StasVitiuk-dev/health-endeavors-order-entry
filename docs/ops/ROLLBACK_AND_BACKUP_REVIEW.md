# Rollback and backup review (internal platform)

**Status:** CURRENT (2026-10-06, extension 3; extension 4 adds the owner checklist and the PO line guard row). Written from files in this repository only. The private backups repository was **not** accessed, and nothing about backups was changed.

## Backup health: UNKNOWN (no evidence here)

The repository's records disagree, and neither is verified:

- `PROJECT_RECORD.md` §2 lists the nightly backup and monthly restore test as "kept on" (GitHub Actions in the private backups repository).
- `PROJECT_RECORD.md` history, Sept 13, says that was the "last nightly GitHub backup before the Actions minutes ran out".

**OWNER CHECK (read-only, 2 minutes):** private backups repository → Actions → did the last nightly backup and the last monthly restore test succeed, and when? Until then, treat backups as **unverified**.

## Owner backup checklist (EXT4; read-only, nothing to change)

Do this once before the first production change (R1 install), and after any long pause in Actions minutes. Claude sessions must not open the backups repository; only you look.

1. GitHub → the private Health Endeavors backups repository → **Actions**.
2. Find the newest **nightly backup** run: note its date and whether it shows a green tick.
3. Find the newest **monthly restore test** run: note its date and whether it is green.
4. Settings → Billing (or the Actions usage page): is there Actions time left this month?
5. Tell the session only: "nightly: green/red, date; restore test: green/red, date; minutes: OK/out". **Don't paste logs, file names or contents.** They may contain database details.
6. If anything is red or older than 2 days: **stop** before any production change, and tell the session. The session will then write a plan, but cannot fix the backups itself (that repository is off-limits).

The session records your answer as REPORTED (not verified), in `PROJECT_RECORD.md` and here.

## What each production step would need

| Step (all need your approval) | Changes data? | Backup needed first? | Rollback | Rollback tested? |
|---|---|---|---|---|
| Merge a dashboard PR | No (page files only) | No | Revert the merge commit; GitHub Pages republishes in 1–5 minutes. The helper/CSS version guard refuses mixed old/new files | Yes (revert simulation in the merge-order checks) |
| Run Query C / Query D | No (one read-only SELECT) | No | Nothing to roll back | Read-only proven: `sql-readonly.spec.js` |
| Install R1–R5 | No (creates 6 functions; no table or row touched) | Recommended as a precaution: confirm the last backup succeeded | `11_DRAFT_rollback_stock_functions.sql` (removes only the functions, one transaction) | Yes: `install_package_test.sh` (rollback, rollback twice, re-install, failure halfway) |
| Switch the dashboard to R1–R5 (INV-06) | Normal business writes from then on | Confirm the last backup | Revert the dashboard PR **first**, then (optionally) the function rollback | Planned with that PR |
| PO line delete guard (`drafts/17_…`, EXT4; EXT6: no longer needs R1 first) | No (adds one trigger and its function) | No | `drafts/18_DRAFT_rollback_po_line_delete_guard.sql` (one transaction) | Yes: stress S27 installs it, checks it, rolls it back and checks no trigger is left |
| Optional CHECK rules (INV-19) | No (adds rules) | No | `alter table … drop constraint …` (to be written with the draft) | Not yet: **PROPOSED**, written together with the draft |
| Remove direct stock-table writes (INV-20) | No (permissions) | No | Re-grant script, written together with the change | Not yet: **PROPOSED** |
| Extend the audit trigger to compliance tables (X3-18) | No | No | Drop the added triggers | Not yet: **PROPOSED** |

**Missing rollback instructions** (to be written when each change is drafted, not before):
- INV-19 (constraint rollback)
- INV-20 (re-grant)
- X3-18 (trigger rollback)

Nothing that exists today lacks a rollback.

## Branch changes are independently revertible

- No branch commit changes production data or schema: the database work is drafts plus local tests.
- Each fix is one commit with its own tests. Helper-file changes always ship in the same commit as the page's version-guard update (API 3 → 4 in `b22c45b`), so reverting that commit restores a matching pair.
- `claude/platform-overnight-implementation` (37050c6) is untouched by this extension: reverting the whole extension means dropping `claude/platform-overnight-extension-3`.

## Disaster readiness: what is known, what is not (EXT6, 2026-10-07)

Built only from documents in this repository. The private backups repository was **not** opened (off-limits), and no backup was read, run or changed.

| Question | What the records say | Status |
|---|---|---|
| Who owns the backups | The owner. Backups run as GitHub Actions in the private backups repository | REPORTED (PROJECT_RECORD §2) |
| Expected schedule | Nightly backup; monthly restore test | REPORTED |
| Last **verified** backup | Unknown. Records disagree ("kept on" vs "last ran Sept 13", X3-25) | **UNKNOWN** |
| Last verified restore test | Unknown | **UNKNOWN** |
| Recovery point (most data that could be lost) | Up to about 24 hours *if* the nightly backup works | **PROPOSED**; owner to confirm after the check |
| Recovery time (how long a restore takes) | Never measured from this repository | **UNKNOWN**; read the duration of the last restore-test run during the check |
| Who can restore | The owner (backups repository admin, Supabase owner). Claude cannot and must not | CURRENT (CLAUDE.md) |
| Preventing an accidental overwrite | Restore into a **new or scratch** Supabase project first, compare, then decide. Never restore over the live database without a fresh backup taken minutes before | **PROPOSED** procedure, owner decision |
| A failed database change (R1–R5, guard, request keys) | Each draft runs in one transaction: a failure part-way changes nothing. A change that installs but misbehaves is removed with its rollback file (`11_`, `18_`, `20_`), and installs and rollbacks are both tested locally. Data written meanwhile stays (rollbacks never delete business data) | CURRENT (drafts) |
| Rolling back the dashboard | Revert the merge commit on GitHub; Pages republishes in 1–5 minutes; hard refresh. The content hashes stop old and new files mixing | CURRENT |

**Before any production database change:** (1) do the 2-minute backup check above; (2) note the time of the last green nightly backup; (3) run the read-only Query E and keep its output, as a "before" picture of stock and deliveries.
